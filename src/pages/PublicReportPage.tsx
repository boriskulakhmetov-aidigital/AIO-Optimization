import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BrandMark, ThemeToggle, useTheme } from '@boriskulakhmetov-aidigital/design-system';
import { AIOReport } from '../components/report/AIOReport';
import type { AIOReportData } from '../lib/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function PublicReportPage() {
  const token = window.location.pathname.replace(/^\/r\//, '').split('/')[0];
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [conceptName, setConceptName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    if (!token) { setError('Invalid report link.'); return; }
    if (!supabaseUrl || !supabaseAnonKey) { setError('Supabase not configured.'); return; }

    const sb = createClient(supabaseUrl, supabaseAnonKey);
    (sb as any)
      .from('scans')
      .select('report_data, concept_name, concept_type, is_public')
      .eq('share_token', token)
      .eq('is_public', true)
      .single()
      .then(({ data, error: sbErr }: any) => {
        if (sbErr || !data) {
          setError('Report not found or is private.');
          return;
        }
        if (!data.report_data) {
          setError('Report not ready yet.');
          return;
        }
        setReportData(data.report_data as AIOReportData);
        setConceptName(data.concept_name ?? '');
      })
      .catch((err: any) => setError(String(err instanceof Error ? err.message : err)));
  }, [token]);

  return (
    <div className="app-layout app-layout--public">
      <div className="app-content">
        <header className="app-header">
          <div className="app-header__left">
            <div className="app-header__logo">
              <BrandMark size={20} />
              AI Labs
            </div>
            <span className="app-header__title">AIO Optimization — Shared Report</span>
          </div>
          <div className="app-header__right">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>
        <main className="app-main">
          {error && (
            <div className="error-page">
              <p className="error-page__msg">{error}</p>
              <a href="/" className="btn-primary">Go to AIO Optimization</a>
            </div>
          )}
          {!error && !reportData && (
            <div className="generating-state">
              <div className="generating-state__spinner" />
              <h2 className="generating-state__title">Loading Report...</h2>
            </div>
          )}
          {reportData && (
            <AIOReport
              data={reportData}
              conceptName={conceptName}
              onNewScan={() => { window.location.href = '/'; }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
