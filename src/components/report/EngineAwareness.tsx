import type { CrossEngineReview, EngineId } from '../../lib/types';
import { ENGINE_META, getEngineColor } from '../../lib/engineMeta';

interface EngineAwarenessProps {
  review: CrossEngineReview;
  onEngineClick: (engineId: string) => void;
}

export function EngineAwareness({ review, onEngineClick }: EngineAwarenessProps) {
  const rankings = review.engine_rankings;

  return (
    <div className="engine-awareness">
      <h3 className="section-title">Brand Awareness by Engine</h3>
      <p className="section-desc">
        Ranked from most to least aware. Click any engine for a deep dive.
      </p>

      <div className="awareness-list">
        {rankings.map((eng, idx) => {
          const color = getEngineColor(eng.engine_id as EngineId);
          const meta = ENGINE_META[eng.engine_id as EngineId];
          const isMostAware = eng.engine_id === review.most_aware_engine;
          const isHighestInvest = eng.engine_id === review.highest_investment_engine;

          return (
            <div
              key={eng.engine_id}
              className={`awareness-card ${isMostAware ? 'awareness-card--best' : ''} ${isHighestInvest ? 'awareness-card--invest' : ''}`}
              onClick={() => onEngineClick(eng.engine_id)}
            >
              <div className="awareness-card__rank">#{idx + 1}</div>
              <div className="awareness-card__accent" style={{ background: color }} />

              <div className="awareness-card__body">
                <div className="awareness-card__top">
                  <div className="awareness-card__engine">
                    <span className="awareness-card__dot" style={{ background: color }} />
                    <span className="awareness-card__name">{meta?.name ?? eng.engine_name}</span>
                    {isMostAware && <span className="awareness-card__badge awareness-card__badge--best">Most Aware</span>}
                    {isHighestInvest && <span className="awareness-card__badge awareness-card__badge--invest">Needs Investment</span>}
                  </div>
                  <span className={`awareness-card__grade grade--${eng.overall_grade.toLowerCase()}`}>
                    {eng.overall_grade}
                  </span>
                </div>

                <div className="awareness-card__labels">
                  <span className={`awareness-label awareness-label--${eng.awareness_label?.toLowerCase().replace(' ', '-') ?? 'moderate'}`}>
                    {eng.awareness_label ?? 'N/A'}
                  </span>
                  <span className={`investment-label investment-label--${investmentClass(eng.investment_level)}`}>
                    {eng.investment_level ?? 'N/A'}
                  </span>
                </div>

                <div className="awareness-card__kpis">
                  <KpiChip label="AI-SOV" value={eng.ai_sov} suffix="%" />
                  <KpiChip label="RSI" value={eng.rsi} suffix="/3" />
                  <KpiChip label="Sentiment" value={eng.net_sentiment} suffix="" />
                </div>

                {/* AI-SOV bar */}
                <div className="awareness-card__bar-track">
                  <div
                    className="awareness-card__bar-fill"
                    style={{ width: `${Math.min(eng.ai_sov, 100)}%`, background: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Biggest Gap callout */}
      {review.biggest_gap && (
        <div className="awareness-gap">
          <h4 className="awareness-gap__title">Biggest Awareness Gap</h4>
          <p className="awareness-gap__text">{review.biggest_gap}</p>
        </div>
      )}
    </div>
  );
}

function KpiChip({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const display = typeof value === 'number'
    ? (Number.isInteger(value) ? String(value) : value.toFixed(1))
    : '—';
  return (
    <div className="kpi-chip">
      <span className="kpi-chip__label">{label}</span>
      <span className="kpi-chip__value">{display}{suffix}</span>
    </div>
  );
}

function investmentClass(level?: string): string {
  if (!level) return 'unknown';
  return level.toLowerCase().replace(/\s+/g, '-');
}