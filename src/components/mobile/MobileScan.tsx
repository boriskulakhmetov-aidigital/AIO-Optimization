import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const PREP_MESSAGES = [
  'Generating search queries…',
  'Crafting questions AI engines will answer…',
  'Designing competitive comparisons…',
  'Preparing discovery queries…',
  'Building your question set…',
];

const SCAN_MESSAGES = [
  'Querying AI engines…',
  'Analyzing brand mentions…',
  'Measuring sentiment across engines…',
  'Comparing competitive positioning…',
  'Evaluating recommendation strength…',
  'Calculating share of voice…',
];

const SYNTH_MESSAGES = [
  'Cross-referencing engine results…',
  'Building your intelligence report…',
  'Synthesizing competitive landscape…',
  'Scoring recommendation strength…',
  'Almost there…',
];

const ENGINE_META: Record<string, { name: string; gradient: string; icon: string }> = {
  google_sge:   { name: 'Google Search', gradient: 'linear-gradient(135deg, #EA4335, #FF6D00)', icon: 'google' },
  gemini_free:  { name: 'Gemini',        gradient: 'linear-gradient(135deg, #00B4D8, #0096C7)', icon: 'gemini' },
  gemini_pro:   { name: 'Gemini Pro',    gradient: 'linear-gradient(135deg, #0077B6, #023E8A)', icon: 'gemini' },
  chatgpt_free: { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)', icon: 'openai' },
  chatgpt_pro:  { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)', icon: 'openai' },
  claude:       { name: 'Claude',         gradient: 'linear-gradient(135deg, #D946A8, #A855F7)', icon: 'claude' },
  grok_free:    { name: 'Grok',           gradient: 'linear-gradient(135deg, #1DA1F2, #0D7EC4)', icon: 'grok' },
  grok_pro:     { name: 'Grok Pro',       gradient: 'linear-gradient(135deg, #0D7EC4, #0A5A8E)', icon: 'grok' },
  perplexity:   { name: 'Perplexity',     gradient: 'linear-gradient(135deg, #20B2AA, #2E8B8A)', icon: 'perplexity' },
  copilot:      { name: 'Copilot',        gradient: 'linear-gradient(135deg, #258FDB, #0F6CBD)', icon: 'copilot' },
  meta_ai:      { name: 'Meta AI',        gradient: 'linear-gradient(135deg, #0668E1, #1877F2)', icon: 'meta' },
};

function ProviderIcon({ type, size = 18 }: { type: string; size?: number }) {
  const w = size, h = size;
  switch (type) {
    // OpenAI — hexagonal rotational mark
    case 'openai':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M22.28 9.82a5.98 5.98 0 00-.52-4.91 6.04 6.04 0 00-6.51-2.9A5.98 5.98 0 009.7 0a6.04 6.04 0 00-5.77 4.2 5.98 5.98 0 00-3.99 2.9A6.04 6.04 0 00.68 14.1a5.98 5.98 0 00.52 4.91A6.04 6.04 0 007.71 21.9 5.98 5.98 0 0012 24a6.04 6.04 0 005.77-4.2 5.98 5.98 0 003.99-2.9A6.04 6.04 0 0022.28 9.82zM12 22a3.63 3.63 0 01-2.33-.85l.11-.06 3.88-2.24a.64.64 0 00.32-.56v-5.47l1.64.95a.06.06 0 01.03.04v4.53A3.63 3.63 0 0112 22zm-7.8-3.33a3.62 3.62 0 01-.43-2.44l.11.07 3.88 2.24a.63.63 0 00.63 0l4.74-2.74v1.9a.07.07 0 01-.03.05L9.17 19.9A3.63 3.63 0 014.2 18.67zM3.53 9.07a3.63 3.63 0 011.93-1.6v4.52a.63.63 0 00.31.55l4.74 2.73-1.64.95a.06.06 0 01-.06 0L4.9 13.8A3.63 3.63 0 013.53 9.07zm13.46 3.12L13.2 9.47l1.63-.94a.06.06 0 01.06 0l3.91 2.26a3.63 3.63 0 01-.55 6.58v-4.61a.63.63 0 00-.32-.57zm1.63-2.46l-.11-.06-3.87-2.24a.63.63 0 00-.64 0L9.26 10.17V8.27a.07.07 0 01.03-.05l3.91-2.25a3.63 3.63 0 015.42 3.76zm-10.28 3.38-1.64-.95a.06.06 0 01-.03-.05V7.61a3.63 3.63 0 015.97-2.79l-.11.06L8.66 7.12a.64.64 0 00-.32.56v.01zm.89-1.92 2.11-1.22 2.11 1.22v2.43l-2.11 1.22-2.11-1.22z"/>
        </svg>
      );
    // Gemini — 4-pointed curved star (their exact brand mark)
    case 'gemini':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z"/>
        </svg>
      );
    // Google — the G letterform
    case 'google':
      return (
        <svg viewBox="0 0 24 24" fill="none" width={w} height={h}>
          <path fill="white" d="M21.8 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.5a4.72 4.72 0 01-2.04 3.1v2.56h3.3C20.83 17.84 21.8 15.2 21.8 12.2z"/>
          <path fill="white" d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.56c-.92.61-2.09.97-3.47.97-2.67 0-4.93-1.8-5.74-4.22H2.87v2.64A10 10 0 0012 22z"/>
          <path fill="white" d="M6.26 13.72A6.01 6.01 0 016 12c0-.6.1-1.19.26-1.72V7.64H2.87A10 10 0 002 12c0 1.61.38 3.14 1.05 4.5l3.21-2.78z"/>
          <path fill="white" d="M12 5.82c1.5 0 2.85.52 3.91 1.53l2.93-2.93A9.96 9.96 0 0012 2 10 10 0 002.87 7.64l3.39 2.64C7.07 7.62 9.33 5.82 12 5.82z" opacity=".85"/>
        </svg>
      );
    // Anthropic / Claude — stylized A mark
    case 'claude':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M17.4 1.6h-3.3L7.1 16.8H4L10.9 1.6H7.6L0 20h3.3l1.7-3.9h14l1.7 3.9H24L17.4 1.6zm-11 11.1L9.3 6.5l2.9 6.2H6.4z"/>
        </svg>
      );
    // xAI / Grok — the X mark
    case 'grok':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24H16.17l-4.71-6.23-5.4 6.23H2.75l7.73-8.84L1.25 2.25H8.08l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/>
        </svg>
      );
    // Perplexity — their compass/prism mark
    case 'perplexity':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M12 2L2 8v8l10 6 10-6V8L12 2zm0 2.28L20 9.2v5.6L12 19.72 4 14.8V9.2L12 4.28zM12 7l-5 3v4l5 3 5-3v-4l-5-3zm0 2.2l3 1.8v2l-3 1.8-3-1.8v-2z"/>
        </svg>
      );
    // Meta — infinity M shape
    case 'meta':
      return (
        <svg viewBox="0 0 24 24" fill="none" width={w} height={h}>
          <path d="M2.5 12c0-2.5 1.8-4.5 4-4.5 1.3 0 2.4.7 3.5 2.5.9 1.4 1.5 2.4 2 2.4s1.1-1 2-2.4C15.1 8.2 16.2 7.5 17.5 7.5c2.2 0 4 2 4 4.5s-1.8 4.5-4 4.5c-1.3 0-2.4-.7-3.5-2.5-.9-1.4-1.5-2.4-2-2.4s-1.1 1-2 2.4C8.9 15.8 7.8 16.5 6.5 16.5c-2.2 0-4-2-4-4.5z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    // Microsoft Copilot — the copilot circle icon
    case 'copilot':
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 13.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 8.5l-7 7z" opacity=".9"/>
        </svg>
      );
    // Default — lightning bolt
    default:
      return (
        <svg viewBox="0 0 24 24" fill="white" width={w} height={h}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" opacity="0.9"/>
        </svg>
      );
  }
}

interface SynthesisData {
  ai_sov: number;
  net_sentiment_score: number;
  avg_rank_position: number | null;
  top_positive_responses: { query: string; excerpt: string }[];
}

interface EngineRow {
  engine_id: string;
  status: string;
  queries_done: number;
  queries_total: number;
  synthesis_data: SynthesisData | null;
}

interface Props {
  supabase: SupabaseClient | null;
  scanId: string | null;
  onContinue: () => void;
}

function KpiCard({
  iconEl,
  colorClass,
  value,
  label,
  progress,
}: {
  iconEl: React.ReactNode;
  colorClass: string;
  value: string | null;
  label: string;
  progress: number;
}) {
  return (
    <div className="ms-kpi">
      <div className={`ms-kpi__icon ${colorClass}`}>{iconEl}</div>
      <span className={`ms-kpi__value${value ? ' ms-kpi__value--ready' : ''}`}>
        {value ?? '—'}
      </span>
      <span className="ms-kpi__label">{label}</span>
      <div className="ms-kpi__bar-wrap">
        <div className="ms-kpi__bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function MobileScan({ supabase, scanId, onContinue }: Props) {
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const prevPhaseRef = useRef('');

  // Poll scan_engines every 3s — includes synthesis_data
  useEffect(() => {
    if (!supabase || !scanId) return;
    let active = true;
    async function poll() {
      const { data } = await supabase!
        .from('scan_engines')
        .select('engine_id, status, queries_done, queries_total, synthesis_data')
        .eq('scan_id', scanId);
      if (active && data) setEngines(data as EngineRow[]);
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [supabase, scanId]);

  // Derived state
  const synthesized = engines.filter(e => e.synthesis_data != null);
  const allSynthesized = engines.length > 0 && synthesized.length === engines.length;
  const hasEngines = engines.length > 0;

  // Running KPIs — update as each engine returns synthesis_data
  const kpiPct = engines.length > 0 ? Math.round((synthesized.length / engines.length) * 100) : 0;

  const avgSov = synthesized.length > 0
    ? Math.round(synthesized.reduce((s, e) => s + (e.synthesis_data!.ai_sov ?? 0), 0) / synthesized.length)
    : null;

  const avgSentiment = synthesized.length > 0
    ? Math.round(synthesized.reduce((s, e) => s + (e.synthesis_data!.net_sentiment_score ?? 0), 0) / synthesized.length)
    : null;

  // Average rank position across engines that have a rank (lower = better)
  const rankedEngines = synthesized.filter(e => e.synthesis_data!.avg_rank_position != null);
  const avgRank = rankedEngines.length > 0
    ? +(rankedEngines.reduce((s, e) => s + e.synthesis_data!.avg_rank_position!, 0) / rankedEngines.length).toFixed(1)
    : null;

  // Phase-aware rotating messages
  const phaseKey = allSynthesized ? 'synth' : hasEngines ? 'scan' : 'prep';
  if (phaseKey !== prevPhaseRef.current) {
    prevPhaseRef.current = phaseKey;
    setMsgIndex(0);
  }
  const messages = allSynthesized ? SYNTH_MESSAGES : hasEngines ? SCAN_MESSAGES : PREP_MESSAGES;

  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="ms">

      {/* KPI widgets — fill as engines synthesize */}
      <div className="ms__kpis">
        <KpiCard
          colorClass="ms-kpi__icon--blue"
          iconEl={
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M3 17l6-6 4 4 8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          value={avgSov !== null ? `${avgSov}%` : null}
          label="AI Share of Voice"
          progress={kpiPct}
        />
        <KpiCard
          colorClass="ms-kpi__icon--green"
          iconEl={
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          value={avgRank !== null ? `#${avgRank}` : null}
          label="Avg Engine Rank"
          progress={kpiPct}
        />
        <KpiCard
          colorClass="ms-kpi__icon--teal"
          iconEl={
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M12 21c-4.97-4.97-8-8.03-8-11a8 8 0 0116 0c0 2.97-3.03 6.03-8 11z" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 13a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          }
          value={avgSentiment !== null ? String(avgSentiment) : null}
          label="Sentiment"
          progress={kpiPct}
        />
      </div>

      {/* Engine cards — transform from progress bar to quotes */}
      <div className="ms__engines">
        {engines.length === 0 && (
          <div className="ms__waiting">
            <div className="m-spinner" />
            <p>Starting engines…</p>
          </div>
        )}
        {engines.map(e => {
          const meta = ENGINE_META[e.engine_id] ?? { name: e.engine_id, gradient: 'linear-gradient(135deg, #666, #444)', icon: 'default' };
          const synth = e.synthesis_data;
          const pct = e.queries_total ? Math.round((e.queries_done / e.queries_total) * 100) : 0;
          // Synthesizing = scanning finished but synthesis_data not yet written
          const synthesizing = pct >= 100 && !synth;
          const quotes = synth?.top_positive_responses?.slice(0, 3) ?? [];
          // Visual bar: cap at 90% during scanning so synthesizing phase is visible
          const visualPct = synth ? 100 : synthesizing ? 90 : Math.min(pct, 90);

          return (
            <div key={e.engine_id} className={`ms-engine${synth ? ' ms-engine--revealed' : ''}`}>
              <div className="ms-engine__header">
                <div className="ms-engine__icon" style={{ background: meta.gradient, position: 'relative' }}>
                  <ProviderIcon type={meta.icon} size={20} />
                  {synth && (
                    <span style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#22C55E', border: '2px solid var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
                        <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>
                <span className="ms-engine__name">{meta.name}</span>
                {!synth && !synthesizing && <span className="ms-engine__pct">{pct}%</span>}
                {synthesizing && <span className="ms-engine__synth-label">Synthesizing…</span>}
                {synth && (
                  <span className="ms-engine__sov">{Math.round(synth.ai_sov)}% SoV</span>
                )}
              </div>

              {/* Progress bar — visible while scanning or synthesizing */}
              {!synth && (
                <div className="ms-engine__bar-wrap">
                  <div className={`ms-engine__bar${synthesizing ? ' ms-engine__bar--pulse' : ''}`} style={{ width: `${visualPct}%` }} />
                </div>
              )}

              {/* Quotes — appear after synthesis */}
              {synth && quotes.length > 0 && (
                <div className="ms-engine__quotes">
                  {quotes.map((q, i) => (
                    <div key={i} className="ms-engine__quote">"{q.excerpt}"</div>
                  ))}
                </div>
              )}
              {synth && quotes.length === 0 && (
                <div className="ms-engine__quote ms-engine__quote--empty">
                  No notable mentions for this engine.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rotating status message */}
      <div className="ms__status">
        <span className="ms__status-dot" />
        <span>{messages[msgIndex % messages.length]}</span>
      </div>

      {/* CTA — slides in when all engines have synthesis_data */}
      {allSynthesized && (
        <div className="ms__cta">
          <button className="m-btn m-btn--primary m-btn--full" onClick={onContinue}>
            Get Full Report
          </button>
        </div>
      )}
    </div>
  );
}
