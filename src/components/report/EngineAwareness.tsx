import type { CrossEngineReview, EngineId } from '../../lib/types';
import { ENGINE_META, getEngineColor } from '../../lib/engineMeta';
import { KpiTile, ProgressBar, SectionDivider } from '@AiDigital-com/design-system';

interface EngineAwarenessProps {
  review: CrossEngineReview;
  onEngineClick: (engineId: string) => void;
}

export function EngineAwareness({ review, onEngineClick }: EngineAwarenessProps) {
  const rankings = review.engine_rankings;

  return (
    <div className="engine-awareness">
      <SectionDivider label="Brand Awareness by Engine" />
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
                  <KpiTile label="AI-SOV" value={formatKpi(eng.ai_sov)} suffix="%" />
                  <KpiTile label="RSI" value={formatKpi(eng.rsi)} suffix="/3" />
                  <KpiTile label="Sentiment" value={formatKpi(eng.net_sentiment)} />
                </div>

                {/* AI-SOV bar */}
                <ProgressBar
                  value={Math.min(eng.ai_sov, 100) / 100}
                  color={color}
                />
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

function formatKpi(n: number): string {
  if (typeof n !== 'number') return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function investmentClass(level?: string): string {
  if (!level) return 'unknown';
  return level.toLowerCase().replace(/\s+/g, '-');
}