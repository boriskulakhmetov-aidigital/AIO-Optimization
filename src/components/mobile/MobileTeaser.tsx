import type { AIOReportData } from '../../lib/types';

interface Props {
  data: AIOReportData;
  brandName: string;
  onContinue: () => void;
}

export function MobileTeaser({ data, brandName, onContinue }: Props) {
  // Extract KPIs from report data
  const overview = data.overview || data.executive_summary || {};
  const kpis = data.kpis || overview.kpis || {};
  const engines = data.engines || data.engine_results || [];

  const aiSov = kpis.ai_share_of_voice ?? kpis.ai_sov ?? '—';
  const sentiment = kpis.net_sentiment ?? kpis.sentiment ?? '—';
  const topEngine = kpis.top_engine ?? kpis.strongest_engine ?? (engines[0]?.engine_name || '—');

  // Collect up to 3 quotes per engine
  const engineQuotes: Array<{ engine: string; quotes: string[] }> = [];
  const engineList = Array.isArray(engines) ? engines : [];
  for (const eng of engineList) {
    const name = eng.engine_name || eng.engine || eng.name || 'Unknown';
    const quotes: string[] = [];

    // Try different quote sources
    const queryResults = eng.query_results || eng.queries || eng.raw_queries || [];
    for (const q of queryResults) {
      const snippet = q.snippet || q.response_snippet || q.first_mention || q.context;
      if (snippet && quotes.length < 3) {
        quotes.push(snippet.slice(0, 150));
      }
    }

    // Fallback: use synthesis highlights
    if (quotes.length === 0 && eng.synthesis_data?.key_findings) {
      for (const f of eng.synthesis_data.key_findings.slice(0, 3)) {
        quotes.push(typeof f === 'string' ? f.slice(0, 150) : String(f).slice(0, 150));
      }
    }

    if (quotes.length > 0) {
      engineQuotes.push({ engine: name, quotes });
    }
  }

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

      {/* Engine quotes */}
      {engineQuotes.length > 0 && (
        <div className="m-teaser__quotes">
          <h3 className="m-teaser__section-title">What AI engines say about you</h3>
          {engineQuotes.map(eq => (
            <div key={eq.engine} className="m-quote-group">
              <h4 className="m-quote-group__engine">{eq.engine}</h4>
              {eq.quotes.map((q, i) => (
                <blockquote key={i} className="m-quote">"{q}"</blockquote>
              ))}
            </div>
          ))}
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
