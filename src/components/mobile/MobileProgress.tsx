import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const ENGINE_LABELS: Record<string, { name: string; icon: string }> = {
  chatgpt_free: { name: 'ChatGPT', icon: '🟢' },
  chatgpt_pro: { name: 'ChatGPT Pro', icon: '🔵' },
  gemini_free: { name: 'Gemini', icon: '🟡' },
  gemini_pro: { name: 'Gemini Pro', icon: '🟠' },
  google_sge: { name: 'Google AI', icon: '🔴' },
  claude: { name: 'Claude', icon: '🟣' },
  perplexity: { name: 'Perplexity', icon: '🔷' },
  copilot: { name: 'Copilot', icon: '🟦' },
};

interface EngineRow {
  engine: string;
  status: string;
  queries_done: number;
  queries_total: number;
}

interface Props {
  brandName: string;
  jobStatus: any;
  supabase: SupabaseClient | null;
  scanId: string | null;
}

export function MobileProgress({ brandName, jobStatus, supabase, scanId }: Props) {
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const phase = jobStatus?.meta?.phase || jobStatus?.status || 'starting';

  // Poll scan_engines for per-engine progress
  useEffect(() => {
    if (!supabase || !scanId) return;
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      const { data } = await supabase!
        .from('scan_engines')
        .select('engine, status, queries_done, queries_total')
        .eq('scan_id', scanId);
      if (data) setEngines(data);
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [supabase, scanId]);

  const completedEngines = engines.filter(e => e.status === 'complete').length;
  const totalEngines = engines.length || 5;
  const totalQueries = engines.reduce((s, e) => s + (e.queries_done || 0), 0);
  const maxQueries = engines.reduce((s, e) => s + (e.queries_total || 10), 0) || 50;
  const pct = Math.round((totalQueries / maxQueries) * 100);

  const phaseLabel =
    phase === 'generating_queries' ? 'Generating search queries…' :
    phase === 'querying' || phase === 'scanning' ? `Scanning AI engines… ${totalQueries}/${maxQueries} queries` :
    phase === 'synthesizing' ? 'Analyzing results…' :
    phase === 'reviewing' ? 'Building your report…' :
    phase === 'complete' ? 'Done!' :
    'Starting scan…';

  return (
    <div className="m-progress">
      <h2 className="m-progress__brand">Scanning "{brandName}"</h2>
      <p className="m-progress__phase">{phaseLabel}</p>

      {/* Progress ring */}
      <div className="m-progress__ring-wrap">
        <svg viewBox="0 0 120 120" className="m-progress__ring">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <span className="m-progress__pct">{pct}%</span>
      </div>

      {/* Engine cards */}
      <div className="m-progress__engines">
        {engines.map(e => {
          const info = ENGINE_LABELS[e.engine] || { name: e.engine, icon: '⚪' };
          const done = e.status === 'complete';
          const running = e.status === 'querying' || e.status === 'running';
          return (
            <div key={e.engine} className={`m-engine ${done ? 'm-engine--done' : running ? 'm-engine--active' : ''}`}>
              <span className="m-engine__icon">{done ? '✅' : running ? '⏳' : info.icon}</span>
              <span className="m-engine__name">{info.name}</span>
              <span className="m-engine__count">{e.queries_done}/{e.queries_total}</span>
            </div>
          );
        })}
      </div>

      {engines.length === 0 && (
        <div className="m-progress__waiting">
          <div className="m-spinner" />
          <p>Preparing engines…</p>
        </div>
      )}
    </div>
  );
}
