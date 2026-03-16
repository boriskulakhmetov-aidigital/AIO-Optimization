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

  useEffect(() => {
    authFetch('/.netlify/functions/list-scans')
      .then(r => r.json())
      .then(data => setScans(data.scans ?? []))
      .catch(console.warn);
  }, [refreshKey]);

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button className="sidebar__new-btn" onClick={onNewScan}>
          + New Scan
        </button>
      </div>
      <div className="sidebar__list">
        {scans.length === 0 && (
          <div className="sidebar__empty">No scans yet</div>
        )}
        {scans.map(scan => {
          const isCurrent = scan.id === currentScanId;
          const isLoading = scan.id === loadingScanId;
          const statusLabel = scan.status === 'complete' ? 'Done'
            : scan.status === 'error' ? 'Error'
            : scan.status === 'scanning' ? 'Scanning'
            : scan.status === 'synthesizing' ? 'Analyzing'
            : scan.status === 'reviewing' ? 'Reviewing'
            : '';

          return (
            <div
              key={scan.id}
              className={`scan-item ${isCurrent ? 'scan-item--active' : ''}`}
              onClick={() => onSelectScan(scan.id)}
            >
              <div className="scan-item__row">
                <StatusDot status={scan.status} />
                <div className="scan-item__text">
                  <span className="scan-item__name">
                    {isLoading ? 'Loading...' : (scan.concept_name || 'Untitled')}
                  </span>
                  <span className="scan-item__meta">
                    {scan.concept_type && <span>{scan.concept_type}</span>}
                    <span>{new Date(scan.created_at).toLocaleDateString()}</span>
                    {statusLabel && scan.status !== 'complete' && (
                      <span className={`scan-item__badge scan-item__badge--${scan.status}`}>
                        {statusLabel}
                      </span>
                    )}
                  </span>
                </div>
                <button
                  className="scan-item__delete"
                  onClick={e => { e.stopPropagation(); onDeleteScan(scan.id); }}
                  title="Delete scan"
                >
                  &times;
                </button>
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
