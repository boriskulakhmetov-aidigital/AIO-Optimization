import { useState } from 'react';
import type { AIOData, Mode, Variant, IntentType, EngineRow } from '../types';
import { EngineChip } from '../components/EngineChip';
import { EngineMark } from '../components/EngineMark';
import { GradePill } from '../components/GradePill';
import { SentimentMeter } from '../components/SentimentMeter';
import { FeedbackWidget } from '../components/FeedbackWidget';

type NavTarget = Variant | { variant: Variant; engineId?: string };

type Props = {
  data: AIOData;
  mode: Mode;
  onNavigate: (target: NavTarget) => void;
};

type ColTop = Record<IntentType, { engine: EngineRow; mentionRate: number } | null>;

/**
 * V2 — Engine × Intent matrix.
 * Column heads show per-intent aggregates + best engine; row heads show engine
 * identity + grade; cells show mention-rate bar + sentiment + query count.
 */
export function EngineIntentMatrix({ data, mode, onNavigate }: Props) {
  const [focusIntent, setFocusIntent] = useState<IntentType | ''>(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('aio-intent')) || '';
    return (saved as IntentType) || '';
  });

  const intents = data.INTENT_ORDER.filter((it) =>
    data.intentAgg.some((x) => x.intent_type === it)
  );

  // Best engine per intent
  const colTop: ColTop = {} as ColTop;
  intents.forEach((it) => {
    let best: { engine: EngineRow; mentionRate: number } | null = null;
    data.matrix.forEach((row) => {
      const cell = row.cells.find((c) => c.intent === it);
      if (cell && !cell.empty && (!best || cell.mentionRate > best.mentionRate)) {
        best = { engine: row.engine, mentionRate: cell.mentionRate };
      }
    });
    colTop[it] = best;
  });

  const handleIntentHead = (it: IntentType) => {
    setFocusIntent(it);
    try { localStorage.setItem('aio-intent', it); } catch { /* ignore */ }
  };

  return (
    <div className="aio-matrix-view">
      <header className="aio-view-head">
        <div>
          <span className="aio-eyebrow">Engine × intent</span>
          <h2>Where visibility lives — and where it leaks</h2>
          <p className="aio-view-dek">
            Each cell shows mention-rate (bar fill) and average sentiment (dot position).
            Green cell tint marks the best engine for each intent; click any cell to jump to engine detail.
          </p>
        </div>
        <div className="aio-legend">
          <div className="aio-legend-grp">
            <span className="aio-legend-label">Mention rate</span>
            <span className="aio-legend-scale">
              <i className="k-bad" /><i className="k-low" /><i className="k-mid" /><i className="k-good" />
            </span>
            <span className="aio-legend-nums">0 – 100%</span>
          </div>
          <div className="aio-legend-grp">
            <span className="aio-legend-label">Sentiment</span>
            <span className="aio-legend-sentiment">
              <span>neg</span>
              <span className="aio-legend-sentiment-bar" />
              <span>pos</span>
            </span>
          </div>
        </div>
      </header>

      <div
        className="aio-matrix"
        style={{ ['--intent-cols' as string]: intents.length }}
      >
        <div className="aio-matrix-corner">
          <span className="aio-matrix-corner-label">Engines ↓ / Intents →</span>
        </div>

        {intents.map((it) => {
          const agg = data.intentAgg.find((x) => x.intent_type === it)!;
          const hot = it === focusIntent;
          const top = colTop[it];
          return (
            <button
              key={`head-${it}`}
              type="button"
              className={`aio-matrix-colhead ${hot ? 'hot' : ''}`}
              onClick={() => handleIntentHead(it)}
            >
              <div className="aio-matrix-colhead-name">{data.INTENT_LABEL[it]}</div>
              <div className="aio-matrix-colhead-sub">
                {agg.query_count}q · avg {Math.round(agg.mention_rate)}%
              </div>
              {top && (
                <div className="aio-matrix-colhead-best" title={`Best: ${top.engine.short}`}>
                  <EngineMark engine={top.engine} />
                  <span>{Math.round(top.mentionRate)}%</span>
                </div>
              )}
            </button>
          );
        })}

        {data.matrix.map((row) => {
          const e = row.engine;
          return (
            <MatrixRowFragment
              key={e.id}
              engine={e}
              intents={intents}
              row={row}
              colTop={colTop}
              focusIntent={focusIntent}
              data={data}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>

      <footer className="aio-matrix-foot">
        <div className="aio-legend-note">
          <b>Read:</b> look for rows that lead a column (★) — those are your strongholds. Columns where every cell is red (e.g. <b>{data.INTENT_LABEL.negative}</b>, <b>{data.INTENT_LABEL.ranked}</b>) are open answer slots. The actions view prioritizes closing those.
        </div>
        <button type="button" className="btn" onClick={() => onNavigate('pa')}>
          Jump to priority actions →
        </button>
      </footer>

      {mode === 'interactive' && (
        <FeedbackWidget pageKey="v2-matrix" pageLabel="Engine × Intent Matrix" />
      )}
    </div>
  );
}

type RowProps = {
  engine: EngineRow;
  intents: IntentType[];
  row: AIOData['matrix'][number];
  colTop: ColTop;
  focusIntent: IntentType | '';
  data: AIOData;
  onNavigate: (target: NavTarget) => void;
};

function MatrixRowFragment({ engine: e, intents, row, colTop, focusIntent, data, onNavigate }: RowProps) {
  const go = (target: NavTarget) => onNavigate(target);

  return (
    <>
      <button
        type="button"
        className="aio-matrix-rowhead"
        title={`${e.name} deep-dive`}
        onClick={() => go({ variant: 'v3', engineId: e.id })}
      >
        <div className="aio-matrix-rowhead-mark">
          <EngineChip engine={e} size="md" />
        </div>
        <div className="aio-matrix-rowhead-meta">
          <GradePill grade={e.grade} klass={e.gradeKlass} />
          <span className="aio-matrix-rowhead-sov">{Math.round(e.aiSov)}%</span>
        </div>
      </button>

      {intents.map((it) => {
        const cell = row.cells.find((c) => c.intent === it);
        const isBest = !!(colTop[it] && colTop[it]!.engine.id === e.id);
        if (!cell || cell.empty || (cell as { queryCount?: number }).queryCount === 0) {
          return (
            <div
              key={`${e.id}-${it}`}
              className={`aio-matrix-cell empty ${it === focusIntent ? 'hot' : ''}`}
            >
              <span className="aio-cell-empty">—</span>
            </div>
          );
        }
        const c = cell;
        const sent = c.sentiment * 100;
        return (
          <button
            key={`${e.id}-${it}`}
            type="button"
            className={`aio-matrix-cell k-${c.mentionKlass} ${it === focusIntent ? 'hot' : ''} ${isBest ? 'is-best' : ''}`}
            title={`${e.short} · ${data.INTENT_LABEL[it]}: ${Math.round(c.mentionRate)}% mention, sentiment ${sent.toFixed(0)}`}
            onClick={() => {
              try { localStorage.setItem('aio-intent', it); } catch { /* ignore */ }
              go({ variant: 'v3', engineId: e.id });
            }}
          >
            <div className="aio-cell-top">
              <span className="aio-cell-mr">
                {Math.round(c.mentionRate)}<span>%</span>
              </span>
              {c.avgRank != null && (
                <span className="aio-cell-rank">
                  #{typeof c.avgRank === 'number' ? c.avgRank.toFixed(1) : c.avgRank}
                </span>
              )}
            </div>
            <div className="aio-cell-fill">
              <div
                className={`aio-cell-fill-bar k-${c.mentionKlass}`}
                style={{ width: `${Math.max(2, c.mentionRate)}%` }}
              />
            </div>
            <div className="aio-cell-foot">
              <SentimentMeter score={sent} />
              <span className="aio-cell-qn">{c.queryCount}q</span>
            </div>
            {isBest && (
              <span className="aio-cell-star" title="Best engine for this intent">★</span>
            )}
          </button>
        );
      })}
    </>
  );
}
