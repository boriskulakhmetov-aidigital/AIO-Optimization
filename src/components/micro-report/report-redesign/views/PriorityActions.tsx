import { useCallback } from 'react';
import type { AIOData, Mode, Variant, Priority } from '../types';
import { ActionCard } from '../components/ActionCard';
import { FeedbackWidget } from '../components/FeedbackWidget';

type NavTarget = Variant | { variant: Variant; engineId?: string };

type Props = {
  data: AIOData;
  mode: Mode;
  onNavigate: (target: NavTarget) => void;
};

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];

const GROUP_LABEL: Record<Priority, string> = {
  critical: 'Critical — fix now',
  high: 'High — next sprint',
  medium: 'Medium — this quarter',
  low: 'Low — backlog',
};

const GROUP_SUB: Record<Priority, string> = {
  critical: 'Unblocks core visibility; top of backlog.',
  high: 'Meaningful lift within weeks.',
  medium: 'Compounding work; ship alongside roadmap.',
  low: 'Nice-to-have; revisit next scan.',
};

/**
 * PA — Priority actions.
 * Hero + plan map (one tile per populated priority bucket), then one section
 * per bucket rendering ActionCards. Plan tiles scroll-jump into their section.
 */
export function PriorityActions({ data, mode }: Props) {
  const groups = Object.fromEntries(
    PRIORITY_ORDER.map((k) => [k, data.actions.filter((a) => a.priority === k)])
  ) as Record<Priority, typeof data.actions>;

  const populated = PRIORITY_ORDER.filter((k) => groups[k].length > 0);
  const totalActions = data.actions.length;

  const jumpTo = useCallback((k: Priority) => {
    const target = document.getElementById(`pa-${k}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="aio-pa-view">
      <section className="aio-hero pa-hero">
        <div className="aio-hero-head">
          <span className="aio-eyebrow v1-hero-eyebrow">
            Priority actions · {totalActions} moves
          </span>
          <h1 className="aio-hero-h1">
            {totalActions} moves to close the{' '}
            <em className="k-mid">AI visibility gap</em>.
          </h1>
          <p className="aio-hero-sub">
            Recommendations from the cross-engine review, grouped by priority.
            Each targets a specific KPI, with directional impact and engine
            focus called out.
          </p>
        </div>
        <div className="aio-pa-plan">
          {populated.map((k) => (
            <button
              key={k}
              type="button"
              className={`aio-pa-plan-tile prio-${k}`}
              title={`Jump to ${GROUP_LABEL[k]}`}
              onClick={() => jumpTo(k)}
            >
              <div className="aio-pa-plan-head">
                <span className="aio-pa-plan-dot" />
                <span className="aio-pa-plan-label">{k}</span>
              </div>
              <div className="aio-pa-plan-n">{groups[k].length}</div>
              <div className="aio-pa-plan-sub">{GROUP_SUB[k]}</div>
            </button>
          ))}
        </div>
      </section>

      {populated.map((k) => (
        <section key={k} className="aio-pa-group" id={`pa-${k}`}>
          <div className="aio-pa-group-head">
            <span className={`aio-pa-group-dot prio-${k}`} />
            <h3>{GROUP_LABEL[k]}</h3>
            <span className="aio-pa-group-sub">{GROUP_SUB[k]}</span>
            <span className="aio-pa-group-count">
              {groups[k].length} action{groups[k].length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="aio-pa-list">
            {groups[k].map((a, i) => (
              <ActionCard
                key={i}
                action={a}
                index={i}
                engines={data.engines}
                totalEngines={data.engines.length}
              />
            ))}
          </div>
        </section>
      ))}

      {mode === 'interactive' && (
        <FeedbackWidget pageKey="pa-actions" pageLabel="Priority Actions" />
      )}
    </div>
  );
}
