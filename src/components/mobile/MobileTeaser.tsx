import { useState } from 'react';
import type { AIOReportData } from '../../lib/types';

const ENGINE_META: Record<string, { name: string; gradient: string }> = {
  google_sge:   { name: 'Google Search', gradient: 'linear-gradient(135deg, #EA4335, #FF6D00)' },
  gemini_free:  { name: 'Gemini',        gradient: 'linear-gradient(135deg, #00B4D8, #0096C7)' },
  gemini_pro:   { name: 'Gemini Pro',    gradient: 'linear-gradient(135deg, #0077B6, #023E8A)' },
  chatgpt_free: { name: 'ChatGPT',       gradient: 'linear-gradient(135deg, #10A37F, #0D8A6A)' },
  chatgpt_pro:  { name: 'ChatGPT Pro',   gradient: 'linear-gradient(135deg, #6C63FF, #4A42D4)' },
  claude:       { name: 'Claude',         gradient: 'linear-gradient(135deg, #D946A8, #A855F7)' },
  perplexity:   { name: 'Perplexity',     gradient: 'linear-gradient(135deg, #20B2AA, #2E8B8A)' },
  copilot:      { name: 'Copilot',        gradient: 'linear-gradient(135deg, #258FDB, #0F6CBD)' },
};

interface Props {
  data: AIOReportData;
  brandName: string;
  onContinue: () => void;
}

export function MobileTeaser({ data, brandName, onContinue }: Props) {
  const rd = data as any;
  const kpis = rd.overall_kpis || {};
  const review = rd.cross_engine_review || {};

  const aiSov = kpis.ai_sov ?? review.overall_ai_sov;
  const sentiment = kpis.net_sentiment ?? review.overall_net_sentiment;

  const engineList: any[] = Array.isArray(rd.engine_syntheses)
    ? rd.engine_syntheses
    : Object.values(rd.engine_syntheses || {});

  const sorted = [...engineList].sort((a, b) => (b.ai_sov || 0) - (a.ai_sov || 0));
  const topEngine = sorted[0]?.engine_name || review.most_aware_engine || '—';

  const [currentEngine, setCurrentEngine] = useState(0);

  // Get top 3 positive response excerpts for current engine
  const eng = engineList[currentEngine];
  const engMeta = eng ? ENGINE_META[eng.engine_id] || { name: eng.engine_name, gradient: 'linear-gradient(135deg, #666, #444)' } : null;
  const quotes: string[] = [];
  if (eng?.top_positive_responses) {
    for (const q of eng.top_positive_responses.slice(0, 3)) {
      const excerpt = typeof q === 'string' ? q : q.excerpt || q.snippet || q.response || '';
      if (excerpt) quotes.push(excerpt.slice(0, 200));
    }
  }

  function prevEngine() { setCurrentEngine(i => i > 0 ? i - 1 : engineList.length - 1); }
  function nextEngine() { setCurrentEngine(i => i < engineList.length - 1 ? i + 1 : 0); }

  return (
    <div className="mt">
      {/* KPI row — compact, 3 across */}
      <div className="mt__kpis">
        <div className="mt-kpi">
          <svg viewBox="0 0 24 24" fill="none" className="mt-kpi__icon mt-kpi__icon--blue">
            <path d="M3 17l6-6 4 4 8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="mt-kpi__value">{typeof aiSov === 'number' ? Math.round(aiSov) + '%' : '—'}</span>
          <span className="mt-kpi__label">AI Share of Voice</span>
        </div>
        <div className="mt-kpi">
          <svg viewBox="0 0 24 24" fill="none" className="mt-kpi__icon mt-kpi__icon--green">
            <path d="M12 2a3 3 0 00-3 3v1a3 3 0 006 0V5a3 3 0 00-3-3zM9 10a5 5 0 0010 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="4" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="mt-kpi__value">{topEngine}</span>
          <span className="mt-kpi__label">Top Engine</span>
        </div>
        <div className="mt-kpi">
          <svg viewBox="0 0 24 24" fill="none" className="mt-kpi__icon mt-kpi__icon--teal">
            <path d="M12 21c-4.97-4.97-8-8.03-8-11a8 8 0 0116 0c0 2.97-3.03 6.03-8 11z" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 13a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="mt-kpi__value">{typeof sentiment === 'number' ? sentiment.toFixed(1) : '—'}</span>
          <span className="mt-kpi__label">Sentiment Score</span>
        </div>
      </div>

      {/* Engine quote carousel */}
      {eng && engMeta && (
        <div className="mt__carousel">
          <div className="mt__carousel-header">
            <div className="mt__carousel-engine">
              <div className="mt__carousel-icon" style={{ background: engMeta.gradient }}>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                  <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2"/>
                  <path d="M16 16l4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div className="mt__carousel-name">{engMeta.name}</div>
                <div className="mt__carousel-count">{currentEngine + 1} of {engineList.length}</div>
              </div>
            </div>
            <div className="mt__carousel-nav">
              <button className="mt__nav-btn" onClick={prevEngine}>&lsaquo;</button>
              <button className="mt__nav-btn" onClick={nextEngine}>&rsaquo;</button>
            </div>
          </div>

          <div className="mt__quotes">
            {quotes.map((q, i) => (
              <div key={i} className="mt__quote">"{q}"</div>
            ))}
            {quotes.length === 0 && (
              <div className="mt__quote mt__quote--empty">No quotes available for this engine.</div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt__cta">
        <button className="m-btn m-btn--primary m-btn--full" onClick={onContinue}>
          Get Full Report
        </button>
      </div>
    </div>
  );
}
