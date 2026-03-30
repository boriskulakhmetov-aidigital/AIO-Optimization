import type { ActionItem } from '../../lib/types';
import { ActionCard, PriorityBadge, SectionDivider } from '@AiDigital-com/design-system';

interface ActionItemsProps {
  items: ActionItem[];
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

export function ActionItems({ items }: ActionItemsProps) {
  // Group by priority
  const grouped = PRIORITY_ORDER.map(p => ({
    priority: p,
    items: items.filter(i => i.priority === p),
  })).filter(g => g.items.length > 0);

  return (
    <div className="action-items">
      <SectionDivider label="Prioritized Action Items" />
      <p className="section-desc">
        Recommendations to improve your brand's AI search visibility, ordered by impact.
      </p>

      {grouped.map(group => (
        <div key={group.priority} className="action-group">
          <div className={`action-group__header action-group__header--${group.priority}`}>
            <PriorityBadge priority={group.priority} />
            <span className="action-group__count">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="action-group__list">
            {group.items.map((item, idx) => (
              <ActionCard
                key={idx}
                title={item.action_text}
                badge={<PriorityBadge priority={item.priority} />}
                meta={<span className="action-card__kpi">{item.kpi_target}</span>}
              >
                <div className="action-card__details">
                  <div className="action-card__detail">
                    <span className="action-card__detail-label">Rationale</span>
                    <span className="action-card__detail-text">{item.rationale}</span>
                  </div>
                  <div className="action-card__detail">
                    <span className="action-card__detail-label">Est. Impact</span>
                    <span className="action-card__detail-text action-card__impact">{item.estimated_impact}</span>
                  </div>
                </div>
              </ActionCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}