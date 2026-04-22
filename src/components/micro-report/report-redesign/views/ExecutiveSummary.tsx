import type { AIOData, Mode, Variant, EngineRow, ResponseExcerpt } from '../types';
import { firstSentences, klassFromScore, stripMd } from '../data';
import { EngineChip } from '../components/EngineChip';
import { EngineMark } from '../components/EngineMark';
import { GradePill } from '../components/GradePill';
import { SovBar } from '../components/SovBar';
import { SentimentMeter } from '../components/SentimentMeter';
import { FeedbackWidget } from '../components/FeedbackWidget';

type NavTarget = Variant | { variant: Variant; engineId?: string };

type Props = {
  data: AIOData;
  mode: Mode;
  onNavigate: (target: NavTarget) => void;
};

type Quote = ResponseExcerpt & { engine: EngineRow };

/**
 * V1 — Executive summary / visibility cockpit.
 * Hero band, engine leaderboard, intent strip, biggest gap, response mix,
 * voice-of-AI quotes, and a priority-actions teaser.
 */
export function ExecutiveSummary({ data, mode, onNavigate }: Props) {
  const overallKlass = klassFromScore(data.overall.aiSov, [50, 30, 15]);
  const engineSorted = data.engines.slice().sort((a, b) => (b.aiSov || 0) - (a.aiSov || 0));
  const maxSov = Math.max(...engineSorted.map((e) => e.aiSov || 0), 10);
  const { positive: pos, neutral: neu, negative: neg } = data.sentimentCounts;
  const execFirst = firstSentences(data.execSummary, 2);
  const topActions = data.actions.slice(0, 3);

  const topPositiveQuotes: Quote[] = data.engines
    .flatMap((e) => (e.topPositive || []).slice(0, 2).map((q) => ({ ...q, engine: e })))
    .slice(0, 6);
  const topNegativeQuotes: Quote[] = data.engines
    .flatMap((e) => (e.topNegative || []).slice(0, 2).map((q) => ({ ...q, engine: e })))
    .slice(0, 4);

  const intentStripData = data.intentAgg.map((it) => {
    const perEngine = data.matrix
      .map((row) => {
        const cell = row.cells.find((c) => c.intent === it.intent_type);
        return {
          engine: row.engine,
          mr: cell && !cell.empty ? cell.mentionRate : 0,
          empty: !cell || cell.empty === true,
        };
      })
      .sort((a, b) => b.mr - a.mr);
    return { ...it, perEngine };
  });

  return (
    <div className="aio-cockpit">
      {/* HERO */}
      <section className="aio-hero v1-hero">
        <div className="aio-hero-head">
          <span className="aio-eyebrow v1-hero-eyebrow">
            Overall AI Visibility · {data.scanDateLabel}
          </span>
          <h1 className="aio-hero-h1">
            {data.brandPretty} captures{' '}
            <em className={`k-${overallKlass}`}>
              {Math.round(data.overall.aiSov)}%
            </em>{' '}
            share of voice across {data.engines.length} AI engines — strongest on{' '}
            <em>{data.mostAwareEngine.short}</em>
            {data.worstEngine && data.worstEngine.id !== data.mostAwareEngine.id && (
              <>, weakest on <em>{data.worstEngine.short}</em></>
            )}.
          </h1>
          <p className="aio-hero-sub">{execFirst}</p>
        </div>

        <div className="aio-hero-band">
          <div className={`aio-hero-stat aio-hero-stat--primary k-${overallKlass}`}>
            <div className="aio-hero-stat-v">
              {Math.round(data.overall.aiSov)}<span>%</span>
            </div>
            <div className="aio-hero-stat-l">AI Share of Voice</div>
            <div className="aio-hero-stat-sub">
              {data.overall.totalQueries} queries · {data.engines.length} engines
            </div>
            <div className="aio-hero-stat-bar">
              <SovBar pct={data.overall.aiSov} klass={overallKlass} />
            </div>
          </div>
          <div className="aio-hero-stat">
            <div className="aio-hero-stat-v">
              {Math.round(data.overall.netSentiment)}
              <span className="aio-hero-stat-unit">%</span>
            </div>
            <div className="aio-hero-stat-l">Net sentiment</div>
            <div className="aio-hero-stat-sub">Positive − negative</div>
            <SentimentMeter score={data.overall.netSentiment} />
          </div>
          <div className="aio-hero-stat">
            <div className="aio-hero-stat-v">
              {Math.round(data.overall.firstPositionRate)}
              <span className="aio-hero-stat-unit">%</span>
            </div>
            <div className="aio-hero-stat-l">First-position rate</div>
            <div className="aio-hero-stat-sub">Ranked #1 in AI answer</div>
            <div className="aio-hero-stat-bar">
              <SovBar
                pct={data.overall.firstPositionRate}
                klass={klassFromScore(data.overall.firstPositionRate, [20, 10, 5])}
              />
            </div>
          </div>
          <div className="aio-hero-stat">
            <div className="aio-hero-stat-v">
              {Math.round(data.overall.top3Rate)}
              <span className="aio-hero-stat-unit">%</span>
            </div>
            <div className="aio-hero-stat-l">Top-3 rate</div>
            <div className="aio-hero-stat-sub">In the top three cited</div>
            <div className="aio-hero-stat-bar">
              <SovBar
                pct={data.overall.top3Rate}
                klass={klassFromScore(data.overall.top3Rate, [30, 15, 5])}
              />
            </div>
          </div>
          <div className="aio-hero-stat">
            <div className="aio-hero-stat-v">
              {(data.overall.rsi || 0).toFixed(1)}
              <span className="aio-hero-stat-unit">/1.0</span>
            </div>
            <div className="aio-hero-stat-l">Recommendation</div>
            <div className="aio-hero-stat-sub">Conviction when cited (RSI)</div>
            <div className="aio-hero-stat-bar">
              <SovBar
                pct={(data.overall.rsi || 0) * 100}
                klass={klassFromScore((data.overall.rsi || 0) * 100, [70, 40, 20])}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Engine leaderboard */}
      <section className="aio-card aio-leaderboard">
        <div className="aio-card-head aio-leaderboard-head">
          <div>
            <span className="aio-eyebrow">Engine leaderboard</span>
            <h3>Share of voice by engine</h3>
          </div>
          <div className="aio-leaderboard-legend">
            <span><i className="k-good" /> Strong</span>
            <span><i className="k-mid" /> Mid</span>
            <span><i className="k-low" /> Thin</span>
            <span><i className="k-bad" /> Absent</span>
          </div>
        </div>
        <div className="aio-strip-rows">
          {engineSorted.map((e, i) => (
            <button
              key={e.id}
              type="button"
              className="aio-strip-row"
              title={`Open ${e.name} deep-dive`}
              onClick={() => onNavigate({ variant: 'v3', engineId: e.id })}
            >
              <span className="aio-strip-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="aio-strip-mark"><EngineChip engine={e} size="md" /></span>
              <span className="aio-strip-bar">
                <SovBar pct={(e.aiSov / maxSov) * 100} klass={e.sovKlass} />
              </span>
              <span className="aio-strip-sent">
                <SentimentMeter score={e.netSentiment} />
              </span>
              <span className="aio-strip-nums">
                <b>{Math.round(e.aiSov)}%</b>
                <GradePill grade={e.grade} klass={e.gradeKlass} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Intent strip */}
      <section className="aio-card aio-intents-strip-card">
        <div className="aio-card-head aio-intents-strip-head">
          <div>
            <span className="aio-eyebrow">Intent lanes</span>
            <h3>How each query type performs across engines</h3>
            <p className="aio-card-dek">
              Each card shows overall mention rate for that query type. The bar chart inside each card breaks it down by engine — tallest bar = strongest engine for that intent. Sentiment dot at bottom sits left (negative) to right (positive).
            </p>
          </div>
          <button type="button" className="aio-linkbtn" onClick={() => onNavigate('v2')}>
            Open full matrix →
          </button>
        </div>

        <div className="aio-intent-legend">
          <span className="aio-intent-legend-label">Engines in bar charts:</span>
          {data.engines.map((e) => (
            <button
              key={e.id}
              type="button"
              className="aio-intent-legend-item"
              title={`Open ${e.name} deep-dive`}
              onClick={() => onNavigate({ variant: 'v3', engineId: e.id })}
            >
              <span
                className="aio-intent-legend-swatch"
                style={{ background: `hsl(${e.hue} 70% 55%)` }}
              />
              <span>{e.short}</span>
            </button>
          ))}
        </div>

        <div className="aio-intents-strip">
          {intentStripData.map((it) => {
            const klass =
              it.mention_rate >= 70 ? 'good' :
              it.mention_rate >= 40 ? 'mid'  :
              it.mention_rate > 0   ? 'low'  : 'bad';
            return (
              <button
                key={it.intent_type}
                type="button"
                className="aio-intent-chip"
                onClick={() => onNavigate('v2')}
              >
                <div className="aio-intent-chip-head">
                  <span className={`aio-intent-dot k-${klass}`} />
                  <span className="aio-intent-chip-name">{it.label}</span>
                  <span className="aio-intent-chip-count">{it.query_count}q</span>
                </div>
                <div className="aio-intent-chip-desc">{it.desc || ''}</div>
                <div className={`aio-intent-chip-val k-${klass}`}>
                  {Math.round(it.mention_rate)}<span>%</span>
                </div>
                <div className="aio-intent-chip-bar">
                  <SovBar pct={it.mention_rate} klass={klass} />
                </div>
                <div className="aio-intent-chip-enginelabel">Per engine</div>
                <div className="aio-intent-chip-engines">
                  {it.perEngine.map((pe) => (
                    <span
                      key={pe.engine.id}
                      className={`aio-intent-chip-engine-dot ${pe.empty ? 'empty' : ''}`}
                      style={{ ['--hue' as string]: pe.engine.hue }}
                      title={`${pe.engine.short}: ${pe.empty ? 'not tested' : `${Math.round(pe.mr)}% mention`}`}
                    >
                      <span
                        className="aio-intent-chip-engine-bar"
                        style={{ height: `${pe.empty ? 4 : Math.max(6, pe.mr)}%` }}
                      />
                      <span className="aio-intent-chip-engine-glyph">
                        {pe.engine.glyph}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="aio-intent-chip-sent-row">
                  <span className="aio-intent-chip-sent-l">Sentiment</span>
                  <div className="aio-intent-chip-sent">
                    <SentimentMeter score={it.avg_sentiment} scale="unit" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Biggest gap + Response mix */}
      <section className="aio-split">
        <div className="aio-card aio-gap-card">
          <div className="aio-card-head">
            <span className="aio-eyebrow k-warn">Biggest gap</span>
            <h3>Where the picture diverges</h3>
          </div>
          <p className="aio-card-body">{stripMd(data.biggestGap)}</p>
          <div className="aio-gap-pair">
            <button
              type="button"
              className="aio-gap-side"
              title={`Open ${data.highSovEngine.name} deep-dive`}
              onClick={() => onNavigate({ variant: 'v3', engineId: data.highSovEngine.id })}
            >
              <div className="aio-gap-side-head">
                <EngineChip engine={data.highSovEngine} size="md" />
                <span className="aio-eyebrow">High SOV</span>
              </div>
              <div className="aio-gap-side-val">{Math.round(data.highSovEngine.aiSov)}%</div>
              <div className="aio-gap-side-sub">
                Net sentiment {Math.round(data.highSovEngine.netSentiment)}
              </div>
            </button>
            <div className="aio-gap-vs">vs</div>
            <button
              type="button"
              className="aio-gap-side"
              title={`Open ${data.mostAwareEngine.name} deep-dive`}
              onClick={() => onNavigate({ variant: 'v3', engineId: data.mostAwareEngine.id })}
            >
              <div className="aio-gap-side-head">
                <EngineChip engine={data.mostAwareEngine} size="md" />
                <span className="aio-eyebrow">High sentiment</span>
              </div>
              <div className="aio-gap-side-val">
                {Math.round(data.mostAwareEngine.netSentiment)}%
              </div>
              <div className="aio-gap-side-sub">
                AI-SOV {Math.round(data.mostAwareEngine.aiSov)}%
              </div>
            </button>
          </div>
        </div>

        <div className="aio-card aio-mix-card">
          <div className="aio-card-head">
            <span className="aio-eyebrow">Response mix</span>
            <h3>Where {data.brandPretty} appears, and in what tone</h3>
          </div>
          <div className="aio-mix-col">
            <div className="aio-mix-col-label">
              Mention rate · {data.mentionCounts.mentioned}/
              {data.mentionCounts.mentioned + data.mentionCounts.missed} queries
            </div>
            <div className="aio-mix-bar">
              <div
                className="aio-mix-seg k-good"
                style={{ flex: data.mentionCounts.mentioned }}
                title={`Mentioned · ${data.mentionCounts.mentioned}`}
              >
                <span>{data.mentionCounts.mentioned}</span>
              </div>
              <div
                className="aio-mix-seg k-bad"
                style={{ flex: data.mentionCounts.missed }}
                title={`Missed · ${data.mentionCounts.missed}`}
              >
                <span>{data.mentionCounts.missed}</span>
              </div>
            </div>
            <div className="aio-mix-legend">
              <span><i className="k-good" /> Mentioned · {data.mentionCounts.mentioned}</span>
              <span><i className="k-bad" /> Missed · {data.mentionCounts.missed}</span>
            </div>
          </div>
          <div className="aio-mix-col">
            <div className="aio-mix-col-label">
              Sentiment of cited answers · {pos + neu + neg} mentions
            </div>
            <div className="aio-mix-bar">
              <div className="aio-mix-seg k-good" style={{ flex: pos }} title={`Positive · ${pos}`}>
                <span>{pos}</span>
              </div>
              <div className="aio-mix-seg k-mid" style={{ flex: neu }} title={`Neutral · ${neu}`}>
                <span>{neu}</span>
              </div>
              <div className="aio-mix-seg k-bad" style={{ flex: neg }} title={`Negative · ${neg}`}>
                <span>{neg}</span>
              </div>
            </div>
            <div className="aio-mix-legend">
              <span><i className="k-good" /> Positive · {pos}</span>
              <span><i className="k-mid" /> Neutral · {neu}</span>
              <span><i className="k-bad" /> Negative · {neg}</span>
            </div>
          </div>
          <div className="aio-mix-col">
            <div className="aio-mix-col-label">Mentions by engine</div>
            <div className="aio-mix-engines">
              {engineSorted.map((e) => {
                const mentions = Math.round((e.aiSov / 100) * (e.queriesCompleted || 20));
                const total = e.queriesCompleted || 20;
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="aio-mix-engine-row"
                    title={`Open ${e.name} deep-dive`}
                    onClick={() => onNavigate({ variant: 'v3', engineId: e.id })}
                  >
                    <span className="aio-mix-engine-mark">
                      <EngineMark engine={e} />
                      <span className="aio-mix-engine-name">{e.short}</span>
                    </span>
                    <span className="aio-mix-engine-bar">
                      <SovBar pct={e.aiSov} klass={e.sovKlass} />
                    </span>
                    <span className="aio-mix-engine-v">
                      <b>{mentions}</b>
                      <span>/{total}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Quotes */}
      <section className="aio-card aio-quotes-card">
        <div className="aio-card-head">
          <span className="aio-eyebrow">Voice of AI</span>
          <h3>What engines actually say about {data.brandPretty}</h3>
          <p className="aio-card-dek">
            Representative excerpts pulled from AI responses, positive at top, negative at bottom. Click an engine chip to see its full set.
          </p>
        </div>

        <div className="aio-quotes-section">
          <div className="aio-quotes-section-head k-good">
            <span className="aio-eyebrow k-good">Positive · {topPositiveQuotes.length}</span>
            <span className="aio-quotes-section-sub">Where AI advocates for the brand</span>
          </div>
          {topPositiveQuotes.length === 0 ? (
            <div className="aio-excerpt-empty">No positive excerpts recorded in this scan.</div>
          ) : (
            <div className="aio-quotes-grid">
              {topPositiveQuotes.map((q, i) => (
                <figure key={i} className="aio-quote-card k-good">
                  <button
                    type="button"
                    className="aio-quote-engine"
                    title={`Open ${q.engine.name} deep-dive`}
                    onClick={() => onNavigate({ variant: 'v3', engineId: q.engine.id })}
                  >
                    <EngineMark engine={q.engine} />
                    <span className="aio-quote-engine-name">{q.engine.short}</span>
                  </button>
                  <blockquote className="aio-quote-q">{q.excerpt}…</blockquote>
                  <figcaption className="aio-quote-cap">On: “{q.query}”</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        {topNegativeQuotes.length > 0 && (
          <div className="aio-quotes-section">
            <div className="aio-quotes-section-head k-bad">
              <span className="aio-eyebrow k-bad">Negative · {topNegativeQuotes.length}</span>
              <span className="aio-quotes-section-sub">
                Where AI works against the brand — prioritize these
              </span>
            </div>
            <div className="aio-quotes-grid">
              {topNegativeQuotes.map((q, i) => (
                <figure key={i} className="aio-quote-card k-bad">
                  <button
                    type="button"
                    className="aio-quote-engine"
                    title={`Open ${q.engine.name} deep-dive`}
                    onClick={() => onNavigate({ variant: 'v3', engineId: q.engine.id })}
                  >
                    <EngineMark engine={q.engine} />
                    <span className="aio-quote-engine-name">{q.engine.short}</span>
                  </button>
                  <blockquote className="aio-quote-q">{q.excerpt}…</blockquote>
                  <figcaption className="aio-quote-cap">On: “{q.query}”</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Actions teaser */}
      <section className="aio-card aio-actions-teaser">
        <div className="aio-card-head">
          <span className="aio-eyebrow k-accent">Priority actions</span>
          <h3>Top {topActions.length} moves to lift AI visibility</h3>
          <button type="button" className="aio-linkbtn" onClick={() => onNavigate('pa')}>
            See all {data.actions.length} actions →
          </button>
        </div>
        <div className="aio-actions-grid">
          {topActions.map((a, i) => (
            <div key={i} className={`aio-action-card prio-${a.priority}`}>
              <div className="aio-action-head">
                <span className="aio-action-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="aio-action-prio">{a.priority}</span>
                <span className="aio-action-target">
                  → {(a.kpi_target || '').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="aio-action-text">{a.action_text}</div>
              <div className="aio-action-impact">{a.estimated_impact}</div>
            </div>
          ))}
        </div>
      </section>

      {mode === 'interactive' && (
        <FeedbackWidget pageKey="v1-exec" pageLabel="Executive Summary" />
      )}
    </div>
  );
}
