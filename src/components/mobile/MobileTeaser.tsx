import type { AIOReportData } from '../../lib/types';

interface Props {
  data: AIOReportData;
  brandName: string;
  onContinue: () => void;
}

export function MobileTeaser({ data, brandName, onContinue }: Props) {
  const rd = data as any;

  // KPIs live at overall_kpis (or cross_engine_review for fallback)
  const kpis = rd.overall_kpis || {};
  const review = rd.cross_engine_review || {};

  const aiSov = kpis.ai_sov ?? review.overall_ai_sov ?? '—';
  const sentiment = kpis.net_sentiment ?? review.overall_net_sentiment ?? '—';

  // Engine syntheses — array or object
  const engineList: any[] = Array.isArray(rd.engine_syntheses)
    ? rd.engine_syntheses
    : Object.values(rd.engine_syntheses || {});

  // Find strongest engine
  const sorted = [...engineList].sort((a, b) => (b.ai_sov || 0) - (a.ai_sov || 0));
  const topEngine = sorted[0]?.engine_name || review.most_aware_engine || '—';

  return (
    <div className="m-teaser">
      <h2 className="m-teaser__title">Results for "{brandName}"</h2>

      {/* KPI cards */}
      <div className="m-teaser__kpis">
        <div className="m-kpi">
          <span className="m-kpi__value">{typeof aiSov === 'number' ? aiSov.toFixed(1) + '%' : aiSov}</span>
          <span className="m-kpi__label">AI Share of Voice</span>
          <span className="m-kpi__desc">How often AI engines mention your brand</span>
        </div>
        <div className="m-kpi">
          <span className="m-kpi__value">{typeof sentiment === 'number' ? sentiment.toFixed(0) : sentiment}</span>
          <span className="m-kpi__label">Net Sentiment</span>
          <span className="m-kpi__desc">Overall tone when AI discusses your brand</span>
        </div>
        <div className="m-kpi">
          <span className="m-kpi__value">{topEngine}</span>
          <span className="m-kpi__label">Strongest Engine</span>
          <span className="m-kpi__desc">Where your brand has the best visibility</span>
        </div>
      </div>

      {/* Engine quotes — 3 per engine */}
      {engineList.length > 0 && (
        <div className="m-teaser__quotes">
          <h3 className="m-teaser__section-title">What AI engines say about you</h3>
          {engineList.map((eng: any, i: number) => {
            const name = eng.engine_name || eng.engine_id || 'Engine ' + (i + 1);
            const quotes: string[] = [];

            // top_positive_responses has the best quotes
            if (eng.top_positive_responses) {
              for (const q of eng.top_positive_responses.slice(0, 3)) {
                const text = typeof q === 'string' ? q : q.snippet || q.response || q.text || '';
                if (text) quotes.push(text.slice(0, 150));
              }
            }

            // Fallback to summary_text
            if (quotes.length === 0 && eng.summary_text) {
              quotes.push(eng.summary_text.slice(0, 150));
            }

            if (quotes.length === 0) return null;

            return (
              <div key={i} className="m-quote-group">
                <h4 className="m-quote-group__engine">{name}</h4>
                {quotes.map((q, j) => (
                  <blockquote key={j} className="m-quote">"{q}"</blockquote>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="m-teaser__cta">
        <p className="m-teaser__cta-text">
          This is a preview. Get the full report with detailed analysis per engine, competitive intelligence, and action items.
        </p>
        <button className="m-btn m-btn--primary m-btn--full" onClick={onContinue}>
          Get Full Report
        </button>
      </div>
    </div>
  );
}
