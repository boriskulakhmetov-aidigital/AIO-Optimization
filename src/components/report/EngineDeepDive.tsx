import { useState } from 'react';
import type { EngineSynthesis, EngineId } from '../../lib/types';
import { ENGINE_META, getEngineColor } from '../../lib/engineMeta';

interface EngineDeepDiveProps {
  syntheses: EngineSynthesis[];
  selectedEngine: string | null;
  onSelect: (engineId: string) => void;
}

export function EngineDeepDive({ syntheses, selectedEngine, onSelect }: EngineDeepDiveProps) {
  const active = syntheses.find(s => s.engine_id === selectedEngine) ?? syntheses[0];

  if (!active) {
    return <div className="section-desc">No engine data available.</div>;
  }

  return (
    <div className="engine-dive">
      {/* Engine selector */}
      <div className="engine-dive__selector">
        {syntheses.map(s => {
          const color = getEngineColor(s.engine_id as EngineId);
          const meta = ENGINE_META[s.engine_id as EngineId];
          const isActive = s.engine_id === active.engine_id;
          return (
            <button
              key={s.engine_id}
              className={`engine-dive__tab ${isActive ? 'engine-dive__tab--active' : ''}`}
              onClick={() => onSelect(s.engine_id)}
              style={isActive ? { borderColor: color, color } : undefined}
            >
              <span className="engine-dive__tab-dot" style={{ background: color }} />
              {meta?.shortName ?? s.engine_name}
            </button>
          );
        })}
      </div>

      <EngineDetail synthesis={active} />
    </div>
  );
}

function EngineDetail({ synthesis: s }: { synthesis: EngineSynthesis }) {
  const [showVerbatims, setShowVerbatims] = useState(false);
  const color = getEngineColor(s.engine_id as EngineId);
  const meta = ENGINE_META[s.engine_id as EngineId];

  return (
    <div className="engine-detail">
      {/* Header */}
      <div className="engine-detail__header">
        <span className="engine-detail__dot" style={{ background: color }} />
        <div>
          <h3 className="engine-detail__name">{meta?.name ?? s.engine_name}</h3>
          <span className="engine-detail__meta">
            {s.queries_completed}/{s.queries_total} queries completed
            {s.queries_failed > 0 && ` (${s.queries_failed} failed)`}
          </span>
        </div>
      </div>

      {/* Narrative */}
      <div className="engine-detail__summary">
        <p>{s.summary_text}</p>
      </div>

      {/* KPI Grid */}
      <div className="engine-detail__kpis">
        <KpiTile label="AI Share of Voice" value={s.ai_sov} suffix="%" color={color} />
        <KpiTile label="First Position" value={s.first_position_rate} suffix="%" color={color} />
        <KpiTile label="Top 3 Rate" value={s.top3_rate} suffix="%" color={color} />
        <KpiTile label="Avg Rank" value={s.avg_rank_position} suffix="" color={color} />
        <KpiTile label="Rec. Strength" value={s.recommendation_strength_index} suffix="/3" color={color} />
        <KpiTile label="Net Sentiment" value={s.net_sentiment_score} suffix="" color={color} />
        <KpiTile label="Discovery Capture" value={s.discovery_capture_rate} suffix="%" color={color} />
        <KpiTile label="Competitive Win" value={s.competitive_win_rate} suffix="%" color={color} />
      </div>

      {/* Intent Breakdown */}
      {s.intent_breakdown && s.intent_breakdown.length > 0 && (
        <div className="engine-detail__intents">
          <h4 className="engine-detail__sub-title">Performance by Query Intent</h4>
          <div className="intent-table">
            <div className="intent-table__header">
              <span>Intent</span>
              <span>Queries</span>
              <span>Mention Rate</span>
              <span>Avg Sentiment</span>
            </div>
            {s.intent_breakdown.map(ib => (
              <div key={ib.intent_type} className="intent-table__row">
                <span className="intent-type-badge">{ib.intent_type}</span>
                <span>{ib.query_count}</span>
                <span>{formatNum(ib.mention_rate)}%</span>
                <span className={ib.avg_sentiment >= 0 ? 'text-positive' : 'text-negative'}>
                  {ib.avg_sentiment >= 0 ? '+' : ''}{formatNum(ib.avg_sentiment)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verbatims */}
      {(s.top_positive_responses?.length > 0 || s.top_negative_responses?.length > 0) && (
        <div className="engine-detail__verbatims">
          <button
            className="engine-detail__verbatim-toggle"
            onClick={() => setShowVerbatims(!showVerbatims)}
          >
            {showVerbatims ? 'Hide' : 'Show'} Response Excerpts
            ({(s.top_positive_responses?.length ?? 0) + (s.top_negative_responses?.length ?? 0)})
          </button>

          {showVerbatims && (
            <div className="verbatim-list">
              {s.top_positive_responses?.length > 0 && (
                <>
                  <h5 className="verbatim-list__heading verbatim-list__heading--positive">
                    Top Positive Mentions
                  </h5>
                  {s.top_positive_responses.map((v, i) => (
                    <VerbatimCard key={`pos-${i}`} query={v.query} excerpt={v.excerpt} positive />
                  ))}
                </>
              )}
              {s.top_negative_responses?.length > 0 && (
                <>
                  <h5 className="verbatim-list__heading verbatim-list__heading--negative">
                    Top Negative Mentions
                  </h5>
                  {s.top_negative_responses.map((v, i) => (
                    <VerbatimCard key={`neg-${i}`} query={v.query} excerpt={v.excerpt} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, suffix, color }: {
  label: string;
  value: number | null;
  suffix: string;
  color: string;
}) {
  const display = value != null ? formatNum(value) : '—';
  return (
    <div className="engine-kpi-tile">
      <span className="engine-kpi-tile__value" style={{ color }}>
        {display}{value != null ? suffix : ''}
      </span>
      <span className="engine-kpi-tile__label">{label}</span>
    </div>
  );
}

function VerbatimCard({ query, excerpt, positive }: {
  query: string;
  excerpt: string;
  positive?: boolean;
}) {
  return (
    <div className={`verbatim-card ${positive ? 'verbatim-card--positive' : 'verbatim-card--negative'}`}>
      <div className="verbatim-card__query">&ldquo;{query}&rdquo;</div>
      <div className="verbatim-card__excerpt">{excerpt}</div>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}