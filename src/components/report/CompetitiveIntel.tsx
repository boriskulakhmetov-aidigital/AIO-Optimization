import type { CrossEngineReview, EngineId } from '../../lib/types';
import { ENGINE_META } from '../../lib/engineMeta';
import { KpiTile, SectionDivider } from '@AiDigital-com/design-system';

interface CompetitiveIntelProps {
  review: CrossEngineReview;
}

export function CompetitiveIntel({ review }: CompetitiveIntelProps) {
  const mostAware = ENGINE_META[review.most_aware_engine as EngineId];
  const highestInvest = ENGINE_META[review.highest_investment_engine as EngineId];

  return (
    <div className="competitive-intel">
      <SectionDivider label="Competitive Intelligence" />

      {/* Landscape */}
      <div className="intel-card">
        <h4 className="intel-card__title">Competitive Landscape</h4>
        <p className="intel-card__text">{review.competitive_landscape}</p>
      </div>

      {/* Engine highlights */}
      <div className="intel-highlights">
        <div className="intel-highlight intel-highlight--best">
          <div className="intel-highlight__icon">&#9650;</div>
          <div>
            <span className="intel-highlight__label">Highest Brand Awareness</span>
            <span className="intel-highlight__engine">{mostAware?.name ?? review.most_aware_engine}</span>
            <span className="intel-highlight__hint">
              This engine already recommends your brand well. Maintain your current strategy here.
            </span>
          </div>
        </div>

        <div className="intel-highlight intel-highlight--invest">
          <div className="intel-highlight__icon">&#9660;</div>
          <div>
            <span className="intel-highlight__label">Highest Investment Needed</span>
            <span className="intel-highlight__engine">{highestInvest?.name ?? review.highest_investment_engine}</span>
            <span className="intel-highlight__hint">
              This engine has the lowest awareness of your brand. Prioritize optimization efforts here.
            </span>
          </div>
        </div>
      </div>

      {/* Biggest gap */}
      {review.biggest_gap && (
        <div className="intel-card intel-card--gap">
          <h4 className="intel-card__title">Biggest Awareness Gap</h4>
          <p className="intel-card__text">{review.biggest_gap}</p>
        </div>
      )}

      {/* Overall stats */}
      <div className="intel-stats">
        <KpiTile label="Avg AI Share of Voice" value={formatNum(review.overall_ai_sov)} suffix="%" />
        <KpiTile label="Avg First Position" value={formatNum(review.overall_first_position_rate)} suffix="%" />
        <KpiTile label="Avg Net Sentiment" value={formatNum(review.overall_net_sentiment)} />
        <KpiTile label="Consistency (std dev)" value={formatNum(review.engine_consistency)} />
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}