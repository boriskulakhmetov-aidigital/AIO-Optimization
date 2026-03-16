import { useState, useEffect } from 'react';
import type { ReportData } from '../lib/reportTypes';
import { MicroReport } from '../components/micro-report/MicroReport';

export function PublicReportPage() {
  const token = window.location.pathname.replace(/^\/r\//, '').split('/')[0];
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Invalid report link.'); return; }
    fetch(`/.netlify/functions/public-report?token=${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? `Error ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        setReportData(data.report_data as ReportData);
        setState('ready');
      })
      .catch(err => {
        setErrorMsg(String(err.message ?? err));
        setState('error');
      });
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <span className="app-header__dot" />
          Loading Report…
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="status-page">
        <div className="status-page__icon">🔒</div>
        <h2>Report Unavailable</h2>
        <p>{errorMsg || 'This report is private or no longer available.'}</p>
      </div>
    );
  }

  return (
    <MicroReport
      data={reportData!}
      jobId={token}
      isPublic
    />
  );
}
