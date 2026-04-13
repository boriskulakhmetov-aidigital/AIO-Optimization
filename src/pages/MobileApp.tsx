import { useState, useRef, useEffect } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BrandMark, ThemeToggle, useTheme, useJobStatus } from '@AiDigital-com/design-system';
import { MobileIntake } from '../components/mobile/MobileIntake';
import { MobileScan } from '../components/mobile/MobileScan';
import { MobileEmailGate } from '../components/mobile/MobileEmailGate';
import { MobileCampaignGate } from '../components/mobile/MobileCampaignGate';
import '../mobile.css';

type MobilePhase = 'loading' | 'intake' | 'scanning' | 'email_gate' | 'campaign_gate';
type GateReason = 'limit_reached' | 'campaign_ended' | 'campaign_inactive' | 'campaign_not_found' | 'not_started' | 'no_campaign';

interface ScanMeta {
  orgName: string;
  brandName: string;
  productName: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function MobileApp() {
  const [phase, setPhase] = useState<MobilePhase>('loading');
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<ScanMeta>({ orgName: '', brandName: '', productName: '' });
  const [error, setError] = useState<string | null>(null);
  const [gateReason, setGateReason] = useState<GateReason | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  // Read campaign slug from ?c= URL param
  const campaignSlug = new URL(window.location.href).searchParams.get('c') ?? undefined;

  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (!supabaseRef.current && supabaseUrl && supabaseAnonKey) {
    supabaseRef.current = createClient(supabaseUrl, supabaseAnonKey);
  }

  // Check campaign status on mount (if campaign slug present)
  useEffect(() => {
    async function checkCampaign() {
      if (!campaignSlug) {
        setGateReason('no_campaign');
        setPhase('campaign_gate');
        return;
      }
      try {
        const res = await fetch(`/.netlify/functions/mobile-check-campaign?c=${encodeURIComponent(campaignSlug)}`);
        const data = await res.json();
        if (data.ok) {
          setPhase('intake');
        } else {
          setGateReason(data.reason as GateReason);
          setGateMessage(data.ended_message ?? null);
          setPhase('campaign_gate');
        }
      } catch {
        // If check fails, allow through (don't block users on infra errors)
        setPhase('intake');
      }
    }
    checkCampaign();
  }, []);

  // Watch job_status for error detection
  const jobStatus = useJobStatus(
    supabaseRef.current,
    phase === 'scanning' ? scanId : null,
  );
  if (jobStatus?.status === 'error' && phase === 'scanning') {
    setError('Scan failed. Please try again.');
    setPhase('intake');
  }

  async function handleSubmit(org: string, brand: string, product: string) {
    const id = crypto.randomUUID();
    setScanId(id);
    setScanMeta({ orgName: org, brandName: brand, productName: product });
    setError(null);
    setPhase('scanning');

    // Save lead immediately at intake — no email yet, just company data
    fetch('/.netlify/functions/mobile-save-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId: id,
        orgName: org,
        brandName: brand,
        productName: product || undefined,
        campaignSlug: campaignSlug ?? undefined,
      }),
    }).catch(() => { /* best effort */ });

    try {
      const res = await fetch('/.netlify/functions/mobile-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: id,
          campaignSlug: campaignSlug ?? undefined,
          intakeSummary: {
            concept_type: 'brand',
            concept_name: brand,
            concept_category: product || brand,
            concept_context: `Organization: ${org}.${product ? ` Product: ${product}.` : ''}`,
            engines: ['gemini_free', 'grok_pro', 'google_sge', 'chatgpt_pro', 'claude'],
            query_count: 10,
          },
        }),
      });

      if (res.status === 429) {
        const err = await res.json();
        setGateReason((err.error ?? 'limit_reached') as GateReason);
        setGateMessage(err.ended_message ?? null);
        setPhase('campaign_gate');
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start scan');
      }
    } catch (err: any) {
      if (phase !== 'campaign_gate') {
        setError(err.message);
        setPhase('intake');
      }
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
          campaignSlug: campaignSlug ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const { shareUrl } = await res.json();
      if (shareUrl) {
        window.location.href = shareUrl;
      } else {
        const { data: scan } = await supabaseRef.current!
          .from('scans')
          .select('share_token')
          .eq('id', scanId)
          .maybeSingle();
        if (scan?.share_token) {
          window.location.href = `/r/${scan.share_token}`;
        }
      }
    } catch {
      setError('Failed to save email. Please try again.');
    }
  }

  async function handleWarmLeadSubmit(email: string) {
    // Campaign is exhausted — still capture the warm lead (no scan)
    try {
      await fetch('/.netlify/functions/mobile-save-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: crypto.randomUUID(), // placeholder — no real scan
          email,
          orgName: '(warm lead)',
          brandName: '(warm lead)',
          campaignSlug: campaignSlug ?? undefined,
        }),
      });
    } catch {
      // silent — best effort
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

        {phase === 'loading' && (
          <div className="ms__waiting" style={{ paddingTop: 80 }}>
            <div className="m-spinner" />
          </div>
        )}

        {phase === 'intake' && (
          <MobileIntake onSubmit={handleSubmit} />
        )}

        {phase === 'scanning' && (
          <MobileScan
            supabase={supabaseRef.current}
            scanId={scanId}
            onContinue={() => setPhase('email_gate')}
            onError={(msg) => { setError(msg); setPhase('intake'); }}
          />
        )}

        {phase === 'email_gate' && (
          <MobileEmailGate
            brandName={scanMeta.brandName}
            onSubmit={handleEmailSubmit}
          />
        )}

        {phase === 'campaign_gate' && gateReason && (
          <MobileCampaignGate
            reason={gateReason}
            endedMessage={gateMessage}
            onEmailSubmit={handleWarmLeadSubmit}
          />
        )}
      </main>

      <footer className="m-footer">
        <span>Powered by <strong>AI Digital Labs</strong></span>
      </footer>
    </div>
  );
}
