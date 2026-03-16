import { useState, useEffect } from 'react';
import { BrandMark } from '../design-system/BrandMark';

export function PublicReportPage() {
  const token = window.location.pathname.replace(/^\/r\//, '').split('/')[0];
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Invalid report link.'); return; }
    fetch(`/.netlify/functions/public-report?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? `Error ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        setReport((data as { report_data: Record<string, unknown> }).report_data);
        setState('ready');
      })
      .catch(err => {
        setErrorMsg(String(err instanceof Error ? err.message : err));
        setState('error');
      });
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          Loading Report...
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="status-page">
        <h2>Report Unavailable</h2>
        <p>{errorMsg || 'This report is private or no longer available.'}</p>
      </div>
    );
  }

  const summary = (report as { executive_summary?: string } | null)?.executive_summary;

  return (
    <div style={{ padding: '48px 24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <BrandMark size={24} />
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI Search Optimization Report</h1>
      </div>
      {summary && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Executive Summary</h3>
          <p style={{ lineHeight: 1.7 }}>{summary}</p>
        </div>
      )}
      <pre style={{ fontSize: '0.75rem', background: 'var(--surface-2)', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 600 }}>
        {JSON.stringify(report, null, 2)}
      </pre>
    </div>
  );
}