import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BrandMark, ThemeToggle, useTheme, ReportViewer, downloadVisualPDF } from '@AiDigital-com/design-system';
import { MicroReport } from '../components/micro-report/MicroReport';
import type { AIOReportData } from '../lib/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function PublicReportPage() {
  const token = window.location.pathname.replace(/^\/r\//, '').split('/')[0];
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [markdownReport, setMarkdownReport] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const autoPdfTriggered = useRef(false);

  useEffect(() => {
    if (!token) { setError('Invalid report link.'); return; }
    if (!supabaseUrl || !supabaseAnonKey) { setError('Supabase not configured.'); return; }

    const sb = createClient(supabaseUrl, supabaseAnonKey);
    (sb as any)
      .from('scans')
      .select('report_data, report, concept_name, concept_type, is_public')
      .eq('share_token', token)
      .eq('is_public', true)
      .single()
      .then(({ data, error: sbErr }: any) => {
        if (sbErr || !data) {
          setError('Report not found or is private.');
          return;
        }
        if (!data.report_data && !data.report) {
          setError('Report not ready yet.');
          return;
        }
        if (data.report_data) {
          setReportData(data.report_data as AIOReportData);
        }
        if (data.report) {
          setMarkdownReport(data.report as string);
        }
        setConceptName(data.concept_name ?? '');
      })
      .catch((err: any) => setError(String(err instanceof Error ? err.message : err)));
  }, [token]);

  const reportReady = !!(reportData || markdownReport);

  // Auto PDF download when ?pdf=1 is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pdf') === '1' && reportReady && !autoPdfTriggered.current) {
      autoPdfTriggered.current = true;
      setTimeout(async () => {
        try {
          await downloadVisualPDF('.aio-report, .mr-report, .mr-layout', conceptName || 'AIO Optimization');
        } catch (e) {
          console.error('Auto PDF failed:', e);
        }
      }, 2000);
    }
  }, [reportReady, conceptName]);

  // postMessage listener for JobStatusWidget iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'aidl-download-pdf') {
        downloadVisualPDF('.aio-report, .mr-report, .mr-layout', conceptName || 'AIO Optimization').catch(console.error);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [conceptName]);

  // Add aidl-pdf-mode class to body when ?pdf-mode=1 is in the URL (for PDFShift)
  useEffect(() => {
    const isPdf = new URLSearchParams(window.location.search).get('pdf-mode') === '1';
    if (isPdf) document.body.classList.add('aidl-pdf-mode');
    return () => document.body.classList.remove('aidl-pdf-mode');
  }, []);

  // Report height to parent for auto-sizing iframe
  useEffect(() => {
    if (window.parent !== window) {
      const reportHeight = () => {
        window.parent.postMessage({ type: 'aidl-report-height', height: document.body.scrollHeight }, '*');
      };
      reportHeight();
      const observer = new ResizeObserver(reportHeight);
      observer.observe(document.body);
      return () => observer.disconnect();
    }
  }, []);

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
          {!error && !reportData && !markdownReport && (
            <div className="generating-state">
              <div className="generating-state__spinner" />
              <h2 className="generating-state__title">Loading Report...</h2>
            </div>
          )}
          {reportData && (
            <MicroReport
              data={reportData}
              scanId={token}
              isPublic
              downloadTitle={conceptName || undefined}
              isPrintMode={new URLSearchParams(window.location.search).get('pdf-mode') === '1'}
            />
          )}
          {!reportData && markdownReport && (
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
              <ReportViewer reportText={markdownReport} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
