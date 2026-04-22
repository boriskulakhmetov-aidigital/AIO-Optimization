import type { ActionItem, EngineRow } from '../types';
import { EngineMark } from './EngineMark';

const KPI_LABEL: Record<string, string> = {
  ai_sov: 'AI Share of Voice',
  net_sentiment: 'Net sentiment',
  first_position_rate: 'First-position rate',
  top3_rate: 'Top-3 rate',
  discovery_capture_rate: 'Discovery capture',
  competitive_win_rate: 'Competitive win rate',
  recommendation_strength_index: 'Recommendation',
  rsi: 'Recommendation',
  avg_rank: 'Avg rank',
};

export function kpiLabel(key: string | undefined): string {
  return KPI_LABEL[key || ''] || String(key || '').replace(/_/g, ' ');
}

/**
 * Scan the action's combined text and return which engines it references.
 * Matches `engineChipsFromText(text)` in render.js.
 */
export function enginesInAction(
  action: ActionItem,
  engines: EngineRow[]
): EngineRow[] {
  const t = (
    (action.action_text || '') +
    ' ' +
    (action.rationale || '') +
    ' ' +
    (action.estimated_impact || '')
  ).toLowerCase();
  return engines.filter(
    (e) =>
      t.includes(e.short.toLowerCase()) ||
      t.includes(e.name.toLowerCase()) ||
      (e.brand && t.includes(e.brand.toLowerCase()))
  );
}

type Props = {
  action: ActionItem;
  index: number;
  engines: EngineRow[];
  /** Total engines (used for "All N" fallback chip when action doesn't mention any). */
  totalEngines: number;
};

/**
 * Full Priority-Actions card: rail (#, priority) · body (title, chips, rationale, impact).
 * Mirrors the `.aio-pa-item` structure in render.js.
 */
export function ActionCard({ action, index, engines, totalEngines }: Props) {
  const matched = enginesInAction(action, engines);
  return (
    <article className={`aio-pa-item prio-${action.priority}`}>
      <div className="aio-pa-item-rail">
        <div className="aio-pa-item-n">{String(index + 1).padStart(2, '0')}</div>
        <div className="aio-pa-item-prio">{action.priority}</div>
      </div>
      <div className="aio-pa-item-body">
        <h4 className="aio-pa-item-title">{action.action_text}</h4>

        <div className="aio-pa-item-chips">
          <span className="aio-pa-chip aio-pa-chip--kpi" title="Targets KPI">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className="aio-pa-chip-l">Target</span>
            <b>{kpiLabel(action.kpi_target)}</b>
          </span>

          {matched.length ? (
            <span
              className="aio-pa-chip aio-pa-chip--engines"
              title="Engines in scope"
            >
              <span className="aio-pa-chip-l">Engines</span>
              {matched.slice(0, 4).map((e) => (
                <EngineMark key={e.id} engine={e} />
              ))}
              {matched.length > 4 && (
                <span className="aio-pa-chip-more">+{matched.length - 4}</span>
              )}
            </span>
          ) : (
            <span
              className="aio-pa-chip aio-pa-chip--engines muted"
              title="All engines"
            >
              <span className="aio-pa-chip-l">Engines</span>
              <b>All {totalEngines}</b>
            </span>
          )}
        </div>

        <p className="aio-pa-item-rationale">{action.rationale}</p>

        <div className="aio-pa-item-impact">
          <div className="aio-pa-item-impact-head">
            <span className="aio-eyebrow k-accent">Estimated impact</span>
          </div>
          <p className="aio-pa-item-impact-text">{action.estimated_impact}</p>
        </div>
      </div>
    </article>
  );
}
