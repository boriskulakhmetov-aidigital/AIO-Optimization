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

interface EngineRow {
  engine_id: string;
  status: string;
  queries_done: number;
  queries_total: number;
}

const ENGINE_META: Record<string, { name: string; gradient: string }> = {
  google_sge:    { name: 'Google Search', gradient: 'linear-gradient(135deg, #EA4335, #FF6D00)' },
  gemini_free:   { name: 'Gemini',        gradient: 'linear-gradient(135deg, #00B4D8, #0096C7)' },
  gemini_pro:    { name: 'Gemini Pro',    gradient: 'linear-gradient(135deg, #0077B6, #023E8A)' },
  chatgpt_free:  { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)' },
  chatgpt_pro:   { name: 'ChatGPT Pro',   gradient: 'linear-gradient(135deg, #6C63FF, #4A42D4)' },
  claude:        { name: 'Claude',         gradient: 'linear-gradient(135deg, #D946A8, #A855F7)' },
  perplexity:    { name: 'Perplexity',     gradient: 'linear-gradient(135deg, #20B2AA, #2E8B8A)' },
  copilot:       { name: 'Copilot',        gradient: 'linear-gradient(135deg, #258FDB, #0F6CBD)' },
};

interface Props {
  brandName: string;
  jobStatus: any;
  supabase: SupabaseClient | null;
  scanId: string | null;
}

export function MobileProgress({ brandName, jobStatus, supabase, scanId }: Props) {
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const prevPhaseRef = useRef('');

  // Pick message set based on phase
  const hasEngines = engines.length > 0;
  const allDone = hasEngines && engines.every(e => e.status === 'complete' || e.status === 'synthesizing');
  const messages = allDone ? SYNTH_MESSAGES : hasEngines ? SCAN_MESSAGES : PREP_MESSAGES;

  // Reset index when phase changes
  const phaseKey = allDone ? 'synth' : hasEngines ? 'scan' : 'prep';
  if (phaseKey !== prevPhaseRef.current) {
    prevPhaseRef.current = phaseKey;
    setMsgIndex(0);
  }

  // Rotate every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    if (!supabase || !scanId) return;
    let active = true;

    async function poll() {
      const { data } = await supabase!
        .from('scan_engines')
        .select('engine_id, status, queries_done, queries_total')
        .eq('scan_id', scanId);
      if (active && data) setEngines(data);
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [supabase, scanId]);

  const statusText = allDone
    ? 'Processing your scan…'
    : hasEngines
      ? `Analyzing your brand across ${engines.length} AI platforms`
      : 'Starting engines…';

  return (
    <div className="mp">
      <h1 className="mp__title">Scanning AI Engines</h1>
      <p className="mp__subtitle">{statusText}</p>

      <div className="mp__engines">
        {engines.map(e => {
          const meta = ENGINE_META[e.engine_id] || { name: e.engine_id, gradient: 'linear-gradient(135deg, #666, #444)' };
          const done = e.status === 'complete' || e.status === 'synthesizing';
          const pct = e.queries_total ? Math.round((e.queries_done / e.queries_total) * 100) : 0;

          return (
            <div key={e.engine_id} className="mp-engine">
              <div className="mp-engine__icon" style={{ background: meta.gradient }}>
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" className="mp-engine__check">
                    <path d="M6 12.5l4 4 8-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="mp-engine__bolt">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fff" opacity="0.9"/>
                  </svg>
                )}
              </div>
              <div className="mp-engine__info">
                <div className="mp-engine__row">
                  <span className="mp-engine__name">{meta.name}</span>
                  <span className="mp-engine__pct">{pct}%</span>
                </div>
                <div className="mp-engine__bar-wrap">
                  <div
                    className="mp-engine__bar"
                    style={{ width: pct + '%' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {engines.length === 0 && (
        <div className="mp__waiting">
          <div className="m-spinner" />
          <p>Starting engines…</p>
        </div>
      )}

      <div className="mp__synthesizing">
        <span className="mp__synth-dot" />
        <span>{messages[msgIndex % messages.length]}</span>
      </div>
    </div>
  );
}
