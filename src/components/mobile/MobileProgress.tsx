import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface EngineRow {
  engine_id: string;
  status: string;
  queries_done: number;
  queries_total: number;
}

const ENGINE_NAMES: Record<string, string> = {
  chatgpt_free: 'ChatGPT',
  chatgpt_pro: 'ChatGPT Pro',
  gemini_free: 'Gemini',
  gemini_pro: 'Gemini Pro',
  google_sge: 'Google AI',
  claude: 'Claude',
  perplexity: 'Perplexity',
  copilot: 'Copilot',
};

interface Props {
  brandName: string;
  jobStatus: any;
  supabase: SupabaseClient | null;
  scanId: string | null;
}

export function MobileProgress({ brandName, supabase, scanId }: Props) {
  const [engines, setEngines] = useState<EngineRow[]>([]);

  // Simple polling — fetch scan_engines every 3s
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

  const totalDone = engines.reduce((s, e) => s + (e.queries_done || 0), 0);
  const totalMax = engines.reduce((s, e) => s + (e.queries_total || 0), 0) || 1;
  const pct = Math.round((totalDone / totalMax) * 100);
  const completedEngines = engines.filter(e => e.status === 'complete' || e.status === 'synthesizing').length;

  return (
    <div className="m-progress">
      <h2 className="m-progress__brand">Scanning "{brandName}"</h2>
      <p className="m-progress__phase">
        {completedEngines === engines.length && engines.length > 0
          ? 'Building your report…'
          : `${completedEngines}/${engines.length || '—'} engines complete`}
      </p>

      {/* Progress bar */}
      <div className="m-progress__bar-wrap">
        <div className="m-progress__bar" style={{ width: pct + '%' }} />
      </div>
      <p className="m-progress__stats">{totalDone}/{totalMax} queries · {pct}%</p>

      {/* Engine list */}
      <div className="m-progress__engines">
        {engines.map(e => {
          const name = ENGINE_NAMES[e.engine_id] || e.engine_id;
          const done = e.status === 'complete' || e.status === 'synthesizing';
          const running = e.status === 'querying' || e.status === 'running' || e.status === 'pending';
          const epct = e.queries_total ? Math.round((e.queries_done / e.queries_total) * 100) : 0;
          return (
            <div key={e.engine_id} className={`m-engine ${done ? 'm-engine--done' : running ? 'm-engine--active' : ''}`}>
              <span className="m-engine__status">{done ? '✓' : running ? '⏳' : '·'}</span>
              <span className="m-engine__name">{name}</span>
              <span className="m-engine__pct">{epct}%</span>
            </div>
          );
        })}
      </div>

      {engines.length === 0 && (
        <div className="m-progress__waiting">
          <div className="m-spinner" />
          <p>Starting engines…</p>
        </div>
      )}
    </div>
  );
}
