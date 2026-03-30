import type { AIOReportData } from '../../lib/types';
import { ENGINE_META, getEngineColor } from '../../lib/engineMeta';
import type { EngineId } from '../../lib/types';
import { KpiTile, ProgressBar, SectionDivider } from '@AiDigital-com/design-system';

interface KPIOverviewProps {
  data: AIOReportData;
  onEngineClick: (engineId: string) => void;
}

export function KPIOverview({ data, onEngineClick }: KPIOverviewProps) {
  const kpis = data.overall_kpis;
  const review = data.cross_engine_review;

  const kpiCards = [
    { label: 'AI Share of Voice', value: kpis.ai_sov, suffix: '%', desc: 'How often AI engines mention your brand' },
    { label: 'First Position Rate', value: kpis.first_position_rate, suffix: '%', desc: 'How often your brand is recommended first' },
    { label: 'Net Sentiment', value: kpis.net_sentiment, suffix: '', desc: 'Overall sentiment (-100 to +100)' },
    { label: 'Recommendation Strength', value: kpis.rsi, suffix: '/3', desc: 'Avg strength of recommendation (0-3)' },
    { label: 'Discovery Capture', value: kpis.discovery_capture_rate, suffix: '%', desc: 'Mentioned in discovery/exploration queries' },
    { label: 'Competitive Win Rate', value: kpis.competitive_win_rate, suffix: '%', desc: 'Recommended over competitors when compared' },
    { label: 'Engine Consistency', value: kpis.engine_consistency, suffix: '', desc: 'Std dev of AI-SOV across engines (lower = better)' },
    { label: 'Top 3 Rate', value: kpis.top3_rate, suffix: '%', desc: 'Mentioned in top 3 recommendations' },
  ];

  return (
    <div className="kpi-overview">
      {/* Executive Summary */}
      <div className="kpi-overview__exec">
        <SectionDivider label="Executive Summary" />
        <p className="kpi-overview__exec-text">{review.executive_summary}</p>
      </div>

      {/* KPI Grid */}
      <div className="kpi-overview__grid">
        {kpiCards.map(card => (
          <KpiTile
            key={card.label}
            label={card.label}
            value={typeof card.value === 'number' ? formatNum(card.value) : '—'}
            suffix={card.suffix}
            description={card.desc}
          />
        ))}
      </div>

      {/* Quick Engine Summary */}
      <div className="kpi-overview__engines">
        <SectionDivider label="Engine Awareness at a Glance" />
        <div className="engine-bars">
          {review.engine_rankings.map(eng => {
            const color = getEngineColor(eng.engine_id as EngineId);
            const meta = ENGINE_META[eng.engine_id as EngineId];
            return (
              <div
                key={eng.engine_id}
                className="engine-bar"
                onClick={() => onEngineClick(eng.engine_id)}
              >
                <div className="engine-bar__label">
                  <span className="engine-bar__dot" style={{ background: color }} />
                  <span className="engine-bar__name">{meta?.shortName ?? eng.engine_name}</span>
                  <span className={`engine-bar__grade engine-bar__grade--${eng.overall_grade.toLowerCase()}`}>
                    {eng.overall_grade}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(eng.ai_sov, 100) / 100}
                  color={color}
                  label={`${formatNum(eng.ai_sov)}%`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}