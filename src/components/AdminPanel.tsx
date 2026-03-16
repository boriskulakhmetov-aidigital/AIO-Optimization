import { useState, useEffect } from 'react';

const STATUSES = ['active', 'trial', 'pending', 'blocked'] as const;
const STATUSES_WITH_ADMIN = [...STATUSES, 'admin'] as const;
type Status = typeof STATUSES[number] | 'admin';

interface Account {
  domain: string;
  user_count: number;
  audit_count: number;
  last_activity: string;
}

interface UserRow {
  user_id: string;
  user_email: string;
  status: Status;
  audit_count: number;
  last_activity: string;
}

interface AuditRow {
  id: string;
  brand_name: string;
  asset_type: string;
  status: string;
  created_at: string;
  deleted_by_user?: boolean;
}

interface AuditDetail {
  report: string | null;
  brand_name: string;
  messages: Array<{ role: string; content: string }>;
  status: string;
}

interface Props {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-badge--${status}`}>{status}</span>;
}

function StatusSelect({ value, onChange, userEmail }: { value: string; onChange: (v: string) => void; userEmail?: string }) {
  const options = userEmail?.toLowerCase().endsWith('@aidigital.com') ? STATUSES_WITH_ADMIN : STATUSES;
  return (
    <select className="status-select" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

export function AdminPanel({ authFetch }: Props) {
  const [accounts, setAccounts]             = useState<Account[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [users, setUsers]                   = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userAudits, setUserAudits]         = useState<AuditRow[]>([]);
  const [auditDetail, setAuditDetail]       = useState<AuditDetail | null>(null);
  const [detailTab, setDetailTab]           = useState<'chat' | 'report'>('report');
  const [loading, setLoading]               = useState(false);
  const [migrateMsg, setMigrateMsg]         = useState('');

  useEffect(() => {
    setLoading(true);
    authFetch('/.netlify/functions/admin-accounts')
      .then(r => r.json())
      .then(data => setAccounts(data.accounts ?? []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  async function loadUsers(domain: string) {
    setSelectedDomain(domain);
    setSelectedUserId(null);
    setUserAudits([]);
    setAuditDetail(null);
    const data = await authFetch(
      `/.netlify/functions/admin-accounts?domain=${encodeURIComponent(domain)}`
    ).then(r => r.json());
    setUsers(data.users ?? []);
  }

  async function loadUserAudits(userId: string) {
    setSelectedUserId(userId);
    setAuditDetail(null);
    const data = await authFetch(
      `/.netlify/functions/admin-accounts?userId=${encodeURIComponent(userId)}`
    ).then(r => r.json());
    setUserAudits(data.sessions ?? []);
  }

  async function loadAuditDetail(id: string) {
    const data = await authFetch(
      `/.netlify/functions/get-audit?id=${encodeURIComponent(id)}`
    ).then(r => r.json());
    const s = data.session;
    if (s) {
      setAuditDetail({
        report: s.report ?? null,
        brand_name: s.brand_name ?? id,
        messages: Array.isArray(s.messages) ? s.messages : (typeof s.messages === 'string' ? JSON.parse(s.messages) : []),
        status: s.status,
      });
      setDetailTab('report');
    }
  }

  async function setUserStatus(userId: string, status: string) {
    await authFetch(
      `/.netlify/functions/admin-accounts?action=set_user_status&userId=${encodeURIComponent(userId)}&status=${status}`
    );
    setUsers(u => u.map(x => x.user_id === userId ? { ...x, status: status as Status } : x));
  }

  async function setOrgStatus(domain: string, status: string) {
    await authFetch(
      `/.netlify/functions/admin-accounts?action=set_org_status&domain=${encodeURIComponent(domain)}&status=${status}`
    );
    if (selectedDomain === domain) {
      setUsers(u => u.map(x => ({ ...x, status: status as Status })));
    }
  }

  async function runMigration() {
    setMigrateMsg('Running…');
    try {
      const data = await authFetch('/.netlify/functions/db-migrate').then(r => r.json());
      setMigrateMsg(data.message ?? JSON.stringify(data));
    } catch (err) {
      setMigrateMsg(String(err));
    }
  }

  // Detail view
  if (auditDetail) {
    return (
      <div className="admin">
        <div className="admin__toolbar">
          <button className="btn-ghost btn-sm" onClick={() => setAuditDetail(null)}>← Back</button>
          <h2 className="admin__title">{auditDetail.brand_name}</h2>
          <StatusBadge status={auditDetail.status} />
          <div className="admin__tabs">
            <button className={`admin__tab${detailTab === 'report' ? ' admin__tab--active' : ''}`} onClick={() => setDetailTab('report')}>Report</button>
            <button className={`admin__tab${detailTab === 'chat' ? ' admin__tab--active' : ''}`} onClick={() => setDetailTab('chat')}>Chat Log ({auditDetail.messages.length})</button>
          </div>
        </div>

        {detailTab === 'report' && (
          auditDetail.report
            ? <pre className="admin__report">{auditDetail.report}</pre>
            : <div className="admin__empty admin__empty--center">Report not yet available (status: {auditDetail.status})</div>
        )}

        {detailTab === 'chat' && (
          <div className="admin__chat">
            {auditDetail.messages.length === 0 && (
              <div className="admin__empty">No chat messages saved.</div>
            )}
            {auditDetail.messages.map((m, i) => (
              <div key={i} className={`admin__msg admin__msg--${m.role}`}>
                <span className="admin__msg-role">{m.role === 'user' ? 'User' : 'Agent'}</span>
                <p className="admin__msg-content">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin__toolbar">
        <h2 className="admin__title">Admin Console</h2>
        <button className="btn-ghost btn-sm" onClick={runMigration}>Run DB Migration</button>
        {migrateMsg && <span className="admin__msg-text">{migrateMsg}</span>}
      </div>

      <div className="admin__columns">
        {/* Accounts column */}
        <div className="admin__col">
          <div className="admin__col-header">Accounts</div>
          {loading && <div className="admin__empty">Loading…</div>}
          {accounts.map(a => (
            <button
              key={a.domain}
              className={`admin__row${selectedDomain === a.domain ? ' admin__row--active' : ''}`}
              onClick={() => loadUsers(a.domain)}
            >
              <strong>{a.domain}</strong>
              <span>{a.user_count} users · {a.audit_count} audits</span>
            </button>
          ))}
        </div>

        {/* Users column */}
        {selectedDomain && (
          <div className="admin__col">
            <div className="admin__col-header">
              {selectedDomain}
              <span className="admin__col-actions">
                Set all:&nbsp;
                <StatusSelect
                  value=""
                  onChange={v => v && setOrgStatus(selectedDomain, v)}
                />
              </span>
            </div>
            {users.map(u => (
              <div
                key={u.user_id}
                className={`admin__row admin__row--user${selectedUserId === u.user_id ? ' admin__row--active' : ''}`}
                onClick={() => loadUserAudits(u.user_id)}
              >
                <div className="admin__row-main">
                  <strong>{u.user_email}</strong>
                  <span>{u.audit_count} audits</span>
                </div>
                <div className="admin__row-controls" onClick={e => e.stopPropagation()}>
                  <StatusSelect value={u.status} onChange={v => setUserStatus(u.user_id, v)} userEmail={u.user_email} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audits column */}
        {selectedUserId && (
          <div className="admin__col">
            <div className="admin__col-header">Audits</div>
            {userAudits.length === 0 && <div className="admin__empty">No audits</div>}
            {userAudits.map(a => (
              <button
                key={a.id}
                className="admin__row"
                onClick={() => loadAuditDetail(a.id)}
              >
                <strong style={{ opacity: a.deleted_by_user ? 0.4 : 1 }}>
                  {a.deleted_by_user ? '[deleted] ' : ''}{a.brand_name ?? 'Unnamed'}
                </strong>
                <span><StatusBadge status={a.status} /> · {a.asset_type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
