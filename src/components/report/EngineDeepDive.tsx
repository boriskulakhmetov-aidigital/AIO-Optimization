import type { EngineSynthesis, EngineId } from '../../lib/types';
import { ENGINE_META, getEngineColor } from '../../lib/engineMeta';
import { KpiTile, ReportTable, CollapsibleRow, SectionDivider } from '@boriskulakhmetov-aidigital/design-system';

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

const intentColumns = [
  { key: 'intent_type', header: 'Intent', render: (row: any) => <span className="intent-type-badge">{row.intent_type}</span> },
  { key: 'query_count', header: 'Queries', render: (row: any) => <>{row.query_count}</>, align: 'center' as const },
  { key: 'mention_rate', header: 'Mention Rate', render: (row: any) => <>{formatNum(row.mention_rate)}%</>, align: 'right' as const },
  {
    key: 'avg_sentiment',
    header: 'Avg Sentiment',
    render: (row: any) => (
      <span className={row.avg_sentiment >= 0 ? 'text-positive' : 'text-negative'}>
        {row.avg_sentiment >= 0 ? '+' : ''}{formatNum(row.avg_sentiment)}
      </span>
    ),
    align: 'right' as const,
  },
];

function fmtVal(v: number | null): string {
  if (v == null) return '—';
  return formatNum(v);
}

function EngineDetail({ synthesis: s }: { synthesis: EngineSynthesis }) {
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
        <KpiTile label="AI Share of Voice" value={fmtVal(s.ai_sov)} suffix="%" color={color} />
        <KpiTile label="First Position" value={fmtVal(s.first_position_rate)} suffix="%" color={color} />
        <KpiTile label="Top 3 Rate" value={fmtVal(s.top3_rate)} suffix="%" color={color} />
        <KpiTile label="Avg Rank" value={fmtVal(s.avg_rank_position)} color={color} />
        <KpiTile label="Rec. Strength" value={fmtVal(s.recommendation_strength_index)} suffix="/3" color={color} />
        <KpiTile label="Net Sentiment" value={fmtVal(s.net_sentiment_score)} color={color} />
        <KpiTile label="Discovery Capture" value={fmtVal(s.discovery_capture_rate)} suffix="%" color={color} />
        <KpiTile label="Competitive Win" value={fmtVal(s.competitive_win_rate)} suffix="%" color={color} />
      </div>

      {/* Intent Breakdown */}
      {s.intent_breakdown && s.intent_breakdown.length > 0 && (
        <div className="engine-detail__intents">
          <SectionDivider label="Performance by Query Intent" />
          <ReportTable
            columns={intentColumns}
            rows={s.intent_breakdown}
            getKey={(row) => row.intent_type}
          />
        </div>
      )}

      {/* Verbatims */}
      {(s.top_positive_responses?.length > 0 || s.top_negative_responses?.length > 0) && (
        <CollapsibleRow
          header={
            <span>
              Response Excerpts ({(s.top_positive_responses?.length ?? 0) + (s.top_negative_responses?.length ?? 0)})
            </span>
          }
        >
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
        </CollapsibleRow>
      )}
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