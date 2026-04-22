import type { AIOData, Mode, EngineRow, KlassStatus } from '../types';
import { klassFromScore, klassMention, klassSentiment } from '../data';
import { EngineChip } from '../components/EngineChip';
import { EngineMark } from '../components/EngineMark';
import { GradePill } from '../components/GradePill';
import { SovBar } from '../components/SovBar';
import { KpiTile } from '../components/KpiTile';
import { IntentRow } from '../components/IntentRow';
import { FeedbackWidget } from '../components/FeedbackWidget';

type Props = {
  data: AIOData;
  mode: Mode;
  activeEngineId: string;
  onEngineChange: (id: string) => void;
};

/**
 * V3 — Engine deep-dive.
 * Engine tab picker · engine head · KPI grid · wins/gaps · full intent
 * breakdown · positive + negative excerpts. Persists active engine in
 * localStorage via parent.
 */
export function EngineDeepDive({ data, mode, activeEngineId, onEngineChange }: Props) {
  const e: EngineRow =
    data.engines.find((x) => x.id === activeEngineId) || data.engines[0];

  const intents = e.intentBreakdown.slice().sort(
    (a, b) => (b.mention_rate || 0) - (a.mention_rate || 0)
  );
  const wins = intents.filter((r) => r.mention_rate >= 50);
  const gaps = intents.filter((r) => r.mention_rate < 20);

  // KPI tile specs (mirrors render.js shape 1:1)
  const rankKlass: KlassStatus = e.avgRankPosition
    ? e.avgRankPosition <= 2 ? 'good'
    : e.avgRankPosition <= 4 ? 'mid'
    : 'low'
    : 'na';

  const kpis = [
    { v: e.aiSov, max: 100, label: 'AI Share of Voice', sub: 'Share of answers citing brand', klass: e.sovKlass, fmt: '%' as const },
    { v: e.netSentiment, max: 100, label: 'Net sentiment', sub: 'Positive − negative', klass: klassSentiment(e.netSentiment), fmt: '%' as const },
    { v: e.firstPositionRate, max: 50, label: 'First-position rate', sub: 'Brand ranks #1', klass: klassFromScore(e.firstPositionRate, [20, 10, 5]), fmt: '%' as const },
    { v: e.top3Rate, max: 50, label: 'Top-3 rate', sub: 'Ranked in top three', klass: klassFromScore(e.top3Rate, [30, 15, 5]), fmt: '%' as const },
    { v: e.discoveryCaptureRate, max: 100, label: 'Discovery capture', sub: 'Open-ended wins', klass: klassFromScore(e.discoveryCaptureRate, [50, 25, 10]), fmt: '%' as const },
    { v: e.competitiveWinRate, max: 100, label: 'Competitive win rate', sub: 'Beats head-to-head rivals', klass: klassFromScore(e.competitiveWinRate, [50, 25, 10]), fmt: '%' as const },
    {
      v: e.rsi * 100, max: 100, label: 'Recommendation strength', sub: 'Conviction when cited (RSI)',
      klass: klassFromScore(e.rsi * 100, [70, 40, 20]),
      fmt: 'raw' as const, raw: <>{e.rsi.toFixed(1)}<span>/1.0</span></>,
    },
    {
      v: e.avgRankPosition ? (10 - e.avgRankPosition) * 10 : 0, max: 100,
      label: 'Avg rank position',
      sub: e.avgRankPosition ? 'Mean position in cited answers' : 'Unranked',
      klass: rankKlass,
      fmt: 'raw' as const, raw: e.avgRankPosition ? <>#{e.avgRankPosition}</> : <>—</>,
    },
  ];

  return (
    <div className="aio-engine-view">
      {/* Engine tab picker */}
      <div className="aio-engine-picker">
        {data.engines.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`aio-engine-tab ${x.id === e.id ? 'active' : ''}`}
            onClick={() => onEngineChange(x.id)}
          >
            <EngineChip engine={x} size="md" />
            <span className="aio-engine-tab-meta">
              <GradePill grade={x.grade} klass={x.gradeKlass} />
              <span className="aio-engine-tab-sov">{Math.round(x.aiSov)}%</span>
            </span>
          </button>
        ))}
      </div>

      {/* Engine head */}
      <header
        className="aio-engine-head"
        style={{ ['--hue' as string]: e.hue }}
      >
        <div className="aio-engine-head-mark">
          <EngineMark engine={e} size="lg" />
        </div>
        <div className="aio-engine-head-text">
          <span className="aio-eyebrow">
            {e.brand} · {e.awarenessLabel || '—'} awareness · Investment: {e.investmentLevel || '—'}
          </span>
          <h2>{e.name}</h2>
          <p className="aio-engine-head-dek">
            {data.brandPretty} captures <b>{Math.round(e.aiSov)}%</b> of answers here with{' '}
            <b className={`k-${klassSentiment(e.netSentiment)}`}>
              {Math.round(e.netSentiment)}%
            </b>{' '}
            net sentiment.
            {wins.length > 0 && (
              <> Strongest on <b>{data.INTENT_LABEL[wins[0].intent_type]}</b>.</>
            )}
            {gaps.length > 0 && (
              <> Weakest on <b>{data.INTENT_LABEL[gaps[0].intent_type]}</b>.</>
            )}
          </p>
        </div>
        <div className="aio-engine-head-grade">
          <div className={`aio-engine-head-grade-v grade-${e.gradeKlass}`}>
            {e.grade || '—'}
          </div>
          <div className="aio-engine-head-grade-l">Overall grade</div>
        </div>
      </header>

      {/* KPI grid */}
      <section className="aio-engine-kpis">
        {kpis.map((k, i) => (
          <KpiTile
            key={i}
            value={k.v}
            label={k.label}
            sub={k.sub}
            klass={k.klass}
            barPct={(k.v / k.max) * 100}
            format={k.fmt === 'raw' ? 'raw' : '%'}
            rawDisplay={'raw' in k ? k.raw : undefined}
          />
        ))}
      </section>

      {/* Wins vs gaps */}
      <section className="aio-wingap-split">
        <div className="aio-card aio-wingap-card wingap-wins">
          <div className="aio-card-head">
            <span className="aio-eyebrow k-good">Wins · {wins.length}</span>
            <h3>Where {e.short} carries the brand</h3>
          </div>
          {wins.length ? (
            <div className="aio-wingap-rows">
              {wins.map((row) => {
                const klass = klassMention(row.mention_rate);
                return (
                  <div key={row.intent_type} className="aio-wingap-row">
                    <span className="aio-wingap-row-name">
                      {data.INTENT_LABEL[row.intent_type]}
                    </span>
                    <span className="aio-wingap-row-bar">
                      <SovBar pct={row.mention_rate} klass={klass} />
                    </span>
                    <span className="aio-wingap-row-v">
                      <b>{Math.round(row.mention_rate)}%</b>
                      <span>{row.query_count}q</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="aio-excerpt-empty">
              No intents above 50% mention rate on this engine.
            </div>
          )}
        </div>

        <div className="aio-card aio-wingap-card wingap-gaps">
          <div className="aio-card-head">
            <span className="aio-eyebrow k-bad">Gaps · {gaps.length}</span>
            <h3>Where {e.short} barely cites the brand</h3>
          </div>
          {gaps.length ? (
            <div className="aio-wingap-rows">
              {gaps.map((row) => {
                const klass = klassMention(row.mention_rate);
                return (
                  <div key={row.intent_type} className="aio-wingap-row">
                    <span className="aio-wingap-row-name">
                      {data.INTENT_LABEL[row.intent_type]}
                    </span>
                    <span className="aio-wingap-row-bar">
                      <SovBar pct={row.mention_rate} klass={klass} />
                    </span>
                    <span className="aio-wingap-row-v">
                      <b>{Math.round(row.mention_rate)}%</b>
                      <span>{row.query_count}q</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="aio-excerpt-empty">
              No thin intents — coverage is broad.
            </div>
          )}
        </div>
      </section>

      {/* Full intent breakdown */}
      <section className="aio-card aio-intent-breakdown">
        <div className="aio-card-head">
          <span className="aio-eyebrow">Full intent breakdown</span>
          <h3>All query types on {e.short}</h3>
        </div>
        <div className="aio-intent-breakdown-rows">
          {e.intentBreakdown.map((row) => (
            <IntentRow
              key={row.intent_type}
              row={row}
              intentLabel={data.INTENT_LABEL[row.intent_type]}
              size="lg"
            />
          ))}
        </div>
      </section>

      {/* Excerpts */}
      <section className="aio-excerpt-split">
        <div className="aio-card aio-excerpt-card k-good">
          <div className="aio-card-head">
            <span className="aio-eyebrow k-good">
              Positive excerpts · {e.topPositive.length}
            </span>
            <h3>Where {e.short} advocates for the brand</h3>
          </div>
          <div className="aio-excerpt-list">
            {e.topPositive.length === 0 ? (
              <div className="aio-excerpt-empty">No positive excerpts recorded.</div>
            ) : (
              e.topPositive.map((x, i) => (
                <div key={i} className="aio-excerpt">
                  <div className="aio-excerpt-q">“{x.query}”</div>
                  <div className="aio-excerpt-a">{x.excerpt}…</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="aio-card aio-excerpt-card k-bad">
          <div className="aio-card-head">
            <span className="aio-eyebrow k-bad">
              Negative excerpts · {e.topNegative.length}
            </span>
            <h3>Where {e.short} hurts the brand</h3>
          </div>
          <div className="aio-excerpt-list">
            {e.topNegative.length === 0 ? (
              <div className="aio-excerpt-empty">
                No negative excerpts on this engine — a clean record.
              </div>
            ) : (
              e.topNegative.map((x, i) => (
                <div key={i} className="aio-excerpt">
                  <div className="aio-excerpt-q">“{x.query}”</div>
                  <div className="aio-excerpt-a">{x.excerpt}…</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {mode === 'interactive' && (
        <FeedbackWidget
          pageKey={`v3-engine-${e.id || 'unknown'}`}
          pageLabel={`Engine · ${e.name || ''}`}
        />
      )}
    </div>
  );
}
