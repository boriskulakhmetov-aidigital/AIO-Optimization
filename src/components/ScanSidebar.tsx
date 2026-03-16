import { useState, useEffect } from 'react';

interface ScanItem {
  id: string;
  concept_name: string;
  concept_type: string;
  status: string;
  created_at: string;
}

interface ScanSidebarProps {
  refreshKey: number;
  currentScanId: string | null;
  loadingScanId: string | null;
  onSelectScan: (id: string) => void;
  onNewScan: () => void;
  onDeleteScan: (id: string) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function ScanSidebar({
  refreshKey, currentScanId, loadingScanId,
  onSelectScan, onNewScan, onDeleteScan, authFetch,
}: ScanSidebarProps) {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    authFetch('/.netlify/functions/list-scans')
      .then(r => r.json())
      .then(data => setScans(data.scans ?? []))
      .catch(console.warn);
  }, [refreshKey]);

  const filtered = scans.filter(s =>
    s.concept_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button className="sidebar__new-btn" onClick={onNewScan}>
          + New Scan
        </button>
        <input
          className="sidebar__search"
          type="text"
          placeholder="Search scans..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="sidebar__list">
        {filtered.length === 0 && (
          <div className="sidebar__empty">No scans yet</div>
        )}
        {filtered.map(scan => {
          const isCurrent = scan.id === currentScanId;
          const isLoading = scan.id === loadingScanId;
          return (
            <div
              key={scan.id}
              className={`sidebar__item ${isCurrent ? 'sidebar__item--active' : ''}`}
              onClick={() => onSelectScan(scan.id)}
            >
              <div className="sidebar__item-top">
                <span className="sidebar__item-name">
                  {isLoading ? '...' : (scan.concept_name || 'Untitled')}
                </span>
                <button
                  className="sidebar__item-delete"
                  onClick={e => { e.stopPropagation(); onDeleteScan(scan.id); }}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
              <div className="sidebar__item-meta">
                <StatusDot status={scan.status} />
                <span>{scan.concept_type ?? 'scan'}</span>
                <span className="sidebar__item-date">
                  {new Date(scan.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'complete' ? 'var(--success)'
    : status === 'error' ? 'var(--error)'
    : status === 'scanning' || status === 'synthesizing' || status === 'reviewing' ? 'var(--accent)'
    : 'var(--text-muted)';
  return <span className="status-dot" style={{ background: color }} />;
}