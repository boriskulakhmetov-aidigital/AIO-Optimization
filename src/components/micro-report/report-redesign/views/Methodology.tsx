import type { AIOData, IntentType } from '../types';
import { stripMd } from '../data';
import { EngineChip } from '../components/EngineChip';
import { SovBar } from '../components/SovBar';

type Props = { data: AIOData };

const INTENT_COLOR: Record<IntentType, string> = {
  direct:      '#aef33e',
  comparative: '#62c3ff',
  ranked:      '#f6ad55',
  discovery:   '#c394ff',
  sentiment:   '#72e4c8',
  contextual:  '#e079c9',
  negative:    '#e64040',
};

const DONUT_R = 54;
const DONUT_C = 2 * Math.PI * DONUT_R;

/**
 * Methodology — scan parameters, intent mix donut, engines + completion,
 * competitive-landscape narrative. No feedback widget by convention.
 */
export function Methodology({ data }: Props) {
  const totalQ = data.intentAgg.reduce((s, x) => s + x.query_count, 0) || 1;

  let cum = 0;
  const donutSegs = data.intentAgg.map((it) => {
    const frac = it.query_count / totalQ;
    const seg = {
      ...it,
      start: cum,
      end: cum + frac,
      color: INTENT_COLOR[it.intent_type] || '#999',
    };
    cum += frac;
    return seg;
  });

  return (
    <div className="aio-mth-view">
      <header className="aio-view-head mth-hero">
        <div>
          <span className="aio-eyebrow">Methodology</span>
          <h2>How this scan was run</h2>
          <p className="aio-view-dek">
            {data.overall.totalQueries} queries across {data.engines.length} AI
            engines on {data.scanDateLabel}. Queries span seven intent
            categories to simulate real-world prompt distribution.
          </p>
        </div>
      </header>

      <section className="aio-mth-grid">
        <div className="aio-card">
          <div className="aio-card-head">
            <span className="aio-eyebrow">Concept</span>
            <h3>{data.brandPretty}</h3>
          </div>
          <dl className="aio-dl">
            <dt>Type</dt><dd>{data.concept.type || '—'}</dd>
            <dt>Category</dt><dd>{data.concept.category || '—'}</dd>
            <dt>Context</dt><dd>{data.concept.context || '—'}</dd>
          </dl>
        </div>
        <div className="aio-card">
          <div className="aio-card-head">
            <span className="aio-eyebrow">Scan</span>
            <h3>Run parameters</h3>
          </div>
          <dl className="aio-dl">
            <dt>Queries</dt><dd>{data.overall.totalQueries}</dd>
            <dt>Engines</dt><dd>{data.overall.enginesTested}</dd>
            <dt>Duration</dt>
            <dd>
              {data.overall.scanDurationSeconds
                ? `${Math.round(data.overall.scanDurationSeconds)} seconds`
                : '—'}
            </dd>
            <dt>Engine consistency</dt>
            <dd>{data.overall.engineConsistency.toFixed(1)} / 10</dd>
            <dt>Scan date</dt><dd>{data.scanDateLabel}</dd>
          </dl>
        </div>
      </section>

      <section className="aio-card">
        <div className="aio-card-head">
          <span className="aio-eyebrow">Intent mix</span>
          <h3>Query distribution by intent type</h3>
        </div>
        <div className="aio-mth-intent-split">
          <div className="aio-mth-donut-wrap">
            <svg viewBox="0 0 140 140" className="aio-mth-donut">
              <circle
                cx="70" cy="70" r={DONUT_R}
                fill="none" stroke="var(--surface2)" strokeWidth={16}
              />
              {donutSegs.map((s) => {
                const len = (s.end - s.start) * DONUT_C;
                const off = -s.start * DONUT_C;
                return (
                  <circle
                    key={s.intent_type}
                    cx="70" cy="70" r={DONUT_R}
                    fill="none" stroke={s.color} strokeWidth={16}
                    strokeDasharray={`${len} ${DONUT_C - len}`}
                    strokeDashoffset={off}
                    transform="rotate(-90 70 70)"
                    className="aio-donut-seg"
                  />
                );
              })}
            </svg>
            <div className="aio-mth-donut-center">
              <div className="aio-mth-donut-n">{totalQ}</div>
              <div className="aio-mth-donut-l">queries</div>
            </div>
          </div>
          <div className="aio-mth-intent-list">
            {donutSegs.map((s) => (
              <div key={s.intent_type} className="aio-mth-intent-rowlg">
                <span
                  className="aio-mth-intent-swatch"
                  style={{ background: s.color }}
                />
                <span className="aio-mth-intent-name">{s.label}</span>
                <span className="aio-mth-intent-desc">{s.desc}</span>
                <span className="aio-mth-intent-qn">
                  <b>{s.query_count}</b>
                  <span>{Math.round((s.query_count / totalQ) * 100)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="aio-card">
        <div className="aio-card-head">
          <span className="aio-eyebrow">Engines</span>
          <h3>Models tested</h3>
        </div>
        <div className="aio-mth-engines">
          {data.engines.map((e) => (
            <div key={e.id} className="aio-mth-engine">
              <EngineChip engine={e} size="md" />
              <div className="aio-mth-engine-bar">
                <SovBar
                  pct={(e.queriesCompleted / (e.queriesTotal || 1)) * 100}
                  klass="good"
                />
              </div>
              <div className="aio-mth-engine-meta">
                <span>
                  {e.queriesCompleted}/{e.queriesTotal} completed
                  {e.queriesFailed ? ` · ${e.queriesFailed} failed` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="aio-card">
        <div className="aio-card-head">
          <span className="aio-eyebrow">Competitive landscape</span>
          <h3>Narrative context</h3>
        </div>
        <p className="aio-mth-landscape">{stripMd(data.competitiveLandscape)}</p>
      </section>
    </div>
  );
}
