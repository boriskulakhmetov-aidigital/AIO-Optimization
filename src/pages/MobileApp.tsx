import { useState, useRef, useEffect } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BrandMark, ThemeToggle, useTheme, useJobStatus } from '@AiDigital-com/design-system';
import { MobileIntake } from '../components/mobile/MobileIntake';
import { MobileProgress } from '../components/mobile/MobileProgress';
import { MobileTeaser } from '../components/mobile/MobileTeaser';
import { MobileEmailGate } from '../components/mobile/MobileEmailGate';
import { AIOReport } from '../components/report/AIOReport';
import type { AIOReportData } from '../lib/types';
import '../mobile.css';

type MobilePhase = 'intake' | 'scanning' | 'teaser' | 'email_gate' | 'report';

interface ScanMeta {
  orgName: string;
  brandName: string;
  productName: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function MobileApp() {
  const [phase, setPhase] = useState<MobilePhase>('intake');
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<ScanMeta>({ orgName: '', brandName: '', productName: '' });
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (!supabaseRef.current && supabaseUrl && supabaseAnonKey) {
    supabaseRef.current = createClient(supabaseUrl, supabaseAnonKey);
  }

  // Realtime job status
  const jobStatus = useJobStatus(
    supabaseRef.current,
    phase === 'scanning' ? scanId : null,
  );

  // Watch for scan completion
  useEffect(() => {
    if (jobStatus?.status === 'complete' && phase === 'scanning') {
      // Fetch report_data from scans table
      fetchReportData();
    } else if (jobStatus?.status === 'error' && phase === 'scanning') {
      setError('Scan failed. Please try again.');
      setPhase('intake');
    }
  }, [jobStatus?.status, phase]);

  async function fetchReportData() {
    if (!supabaseRef.current || !scanId) return;
    const { data } = await supabaseRef.current
      .from('scans')
      .select('report_data')
      .eq('id', scanId)
      .maybeSingle();
    if (data?.report_data) {
      setReportData(data.report_data as AIOReportData);
      setPhase('teaser');
    }
  }

  async function handleSubmit(org: string, brand: string, product: string) {
    const id = crypto.randomUUID();
    setScanId(id);
    setScanMeta({ orgName: org, brandName: brand, productName: product });
    setError(null);
    setPhase('scanning');

    try {
      const res = await fetch('/.netlify/functions/mobile-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: id, brandName: brand, orgName: org, productName: product || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start scan');
      }
    } catch (err: any) {
      setError(err.message);
      setPhase('intake');
    }
  }

  async function handleEmailSubmit(email: string) {
    if (!scanId) return;
    try {
      const res = await fetch('/.netlify/functions/mobile-save-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          email,
          orgName: scanMeta.orgName,
          brandName: scanMeta.brandName,
          productName: scanMeta.productName || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setPhase('report');
    } catch {
      setError('Failed to save email. Please try again.');
    }
  }

  return (
    <div className="m-app">
      <header className="m-header">
        <div className="m-header__brand">
          <BrandMark size={18} />
          <span className="m-header__title">AI Search Audit</span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="m-main">
        {error && (
          <div className="m-error">
            <p>{error}</p>
            <button className="m-btn m-btn--secondary" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {phase === 'intake' && (
          <MobileIntake onSubmit={handleSubmit} />
        )}

        {phase === 'scanning' && (
          <MobileProgress
            brandName={scanMeta.brandName}
            jobStatus={jobStatus}
            supabase={supabaseRef.current}
            scanId={scanId}
          />
        )}

        {phase === 'teaser' && reportData && (
          <MobileTeaser
            data={reportData}
            brandName={scanMeta.brandName}
            onContinue={() => setPhase('email_gate')}
          />
        )}

        {phase === 'email_gate' && (
          <MobileEmailGate
            brandName={scanMeta.brandName}
            onSubmit={handleEmailSubmit}
          />
        )}

        {phase === 'report' && reportData && (
          <AIOReport
            data={reportData}
            conceptName={scanMeta.brandName}
            onNewScan={() => {
              setPhase('intake');
              setScanId(null);
              setReportData(null);
            }}
            isPrintMode={false}
          />
        )}
      </main>

      <footer className="m-footer">
        <span>Powered by <strong>AI Digital Labs</strong></span>
      </footer>
    </div>
  );
}
