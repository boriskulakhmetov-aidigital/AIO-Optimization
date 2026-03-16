import { useState, useEffect } from 'react';

interface AuditRow {
  id: string;
  brand_name: string | null;
  asset_type: string | null;
  status: string;
  created_at: string;
}

interface Props {
  refreshKey: number;
  currentJobId: string | null;
  loadingAuditId: string | null;
  onSelectAudit: (id: string) => void;
  onNewAudit: () => void;
  onDeleteAudit: (id: string) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

function groupByDate(rows: AuditRow[]): Record<string, AuditRow[]> {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const groups: Record<string, AuditRow[]> = { Today: [], Yesterday: [], 'Last 7 days': [], Older: [] };
  for (const row of rows) {
    const d = new Date(row.created_at);
    const ds = d.toDateString();
    if (ds === today) groups['Today'].push(row);
    else if (ds === yesterday) groups['Yesterday'].push(row);
    else if (d >= weekAgo) groups['Last 7 days'].push(row);
    else groups['Older'].push(row);
  }
  return groups;
}

function StatusDot({ status }: { status: string }) {
  if (status === 'complete') return null;
  if (status === 'chatting') return <span className="status-dot status-dot--chatting" title="Intake in progress" />;
  if (status === 'pending' || status === 'streaming') return <span className="status-dot status-dot--spinning" title="Audit running" />;
  if (status === 'error') return <span className="status-dot status-dot--error" title="Error" />;
  return null;
}

export function AuditSidebar({
  refreshKey, currentJobId, loadingAuditId,
  onSelectAudit, onNewAudit, onDeleteAudit, authFetch
}: Props) {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setLoading(true);
    authFetch('/.netlify/functions/list-audits')
      .then(r => r.json())
      .then(data => setAudits(data.sessions ?? []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const groups = groupByDate(audits);

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button className="sidebar__toggle" onClick={() => setCollapsed(false)} title="Open sidebar">&#9776;</button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <button className="sidebar__toggle" onClick={() => setCollapsed(true)} title="Close sidebar">&#10005;</button>
        <button className="sidebar__new-btn" onClick={onNewAudit}>+ New Audit</button>
      </div>

      <div className="sidebar__list">
        {loading && <div className="sidebar__empty">Loading…</div>}
        {!loading && audits.length === 0 && (
          <div className="sidebar__empty">No past audits yet.</div>
        )}

        {Object.entries(groups).map(([label, rows]) =>
          rows.length === 0 ? null : (
            <div key={label} className="sidebar__group">
              <div className="sidebar__group-label">{label}</div>
              {rows.map(row => {
                const effectiveStatus = row.id === loadingAuditId ? 'pending' : row.status;
                return (
                  <div
                    key={row.id}
                    className={`sidebar__item-wrap${row.id === currentJobId ? ' sidebar__item-wrap--active' : ''}`}
                  >
                    <button className="sidebar__item" onClick={() => onSelectAudit(row.id)}>
                      <span className="sidebar__item-left">
                        <StatusDot status={effectiveStatus} />
                        <span className="sidebar__item-brand">{row.brand_name ?? 'Unnamed Audit'}</span>
                      </span>
                      <span className="sidebar__item-meta">
                        {row.asset_type ?? ''}{row.status !== 'complete' ? ` · ${row.status}` : ''}
                      </span>
                    </button>
                    <button
                      className="sidebar__delete"
                      title="Remove from list"
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteAudit(row.id);
                        setAudits(a => a.filter(x => x.id !== row.id));
                      }}
                    >
                      &#10005;
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </aside>
  );
}
