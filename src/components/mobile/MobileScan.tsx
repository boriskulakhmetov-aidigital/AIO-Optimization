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

const ENGINE_META: Record<string, { name: string; gradient: string }> = {
  google_sge:   { name: 'Google Search', gradient: 'linear-gradient(135deg, #EA4335, #FF6D00)' },
  gemini_free:  { name: 'Gemini',        gradient: 'linear-gradient(135deg, #00B4D8, #0096C7)' },
  gemini_pro:   { name: 'Gemini Pro',    gradient: 'linear-gradient(135deg, #0077B6, #023E8A)' },
  chatgpt_free: { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)' },
  chatgpt_pro:  { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)' },
  claude:       { name: 'Claude',         gradient: 'linear-gradient(135deg, #D946A8, #A855F7)' },
  grok_free:    { name: 'Grok',           gradient: 'linear-gradient(135deg, #1DA1F2, #0D7EC4)' },
  grok_pro:     { name: 'Grok Pro',       gradient: 'linear-gradient(135deg, #0D7EC4, #0A5A8E)' },
  perplexity:   { name: 'Perplexity',     gradient: 'linear-gradient(135deg, #20B2AA, #2E8B8A)' },
  copilot:      { name: 'Copilot',        gradient: 'linear-gradient(135deg, #258FDB, #0F6CBD)' },
};

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
  onError: (msg: string) => void;
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

export function MobileScan({ supabase, scanId, onContinue, onError }: Props) {
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const prevPhaseRef = useRef('');

  // Timeout: if no engines appear within 90s, the function likely died mid-deploy
  useEffect(() => {
    const t = setTimeout(() => {
      if (engines.length === 0) {
        onError('Scan timed out — the server may have been restarting. Please try again.');
      }
    }, 90_000);
    return () => clearTimeout(t);
  }, []);

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
          const meta = ENGINE_META[e.engine_id] ?? { name: e.engine_id, gradient: 'linear-gradient(135deg, #666, #444)' };
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
                <div className="ms-engine__icon" style={{ background: meta.gradient }}>
                  {synth ? (
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                      <path d="M6 12.5l4 4 8-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fff" opacity="0.9"/>
                    </svg>
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
