// Canonical shape of a completed AIO scan — mirrors the API response.
// See fixtures/aio-report-sample.json for the reference payload.

export type IntentType =
  | 'direct'
  | 'comparative'
  | 'ranked'
  | 'discovery'
  | 'sentiment'
  | 'contextual'
  | 'negative';

export type SentimentBucket = 'positive' | 'neutral' | 'negative';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type KlassStatus = 'good' | 'good-mid' | 'mid' | 'low' | 'bad' | 'na';

export type Grade =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F'
  | string;

// ---------- Raw API shapes ----------

export type QueryLogEntry = {
  rank?: number;
  engine_id: string;
  mentioned: boolean;
  sentiment?: SentimentBucket;
  query_text: string;
  intent_type: IntentType;
  response_excerpt?: string;
};

export type IntentBreakdownRow = {
  intent_type: IntentType;
  query_count: number;
  mention_rate: number;       // 0..100
  avg_sentiment: number;      // -1..1
  avg_rank?: number | null;   // 1..N
};

export type ResponseExcerpt = {
  query: string;
  excerpt: string;
};

export type EngineSynthesis = {
  engine_id: string;
  engine_name: string;
  ai_sov: number;                          // 0..100
  top3_rate: number;                       // 0..100
  first_position_rate: number;             // 0..100
  net_sentiment_score: number;             // -100..100
  recommendation_strength_index: number;   // 0..1
  competitive_win_rate: number;            // 0..100
  discovery_capture_rate: number;          // 0..100
  avg_rank_position: number | null;        // 1..N
  queries_total: number;
  queries_completed: number;
  queries_failed: number;
  summary_text: string;
  intent_breakdown: IntentBreakdownRow[];
  top_positive_responses: ResponseExcerpt[];
  top_negative_responses: ResponseExcerpt[];
};

export type EngineRanking = {
  engine_id: string;
  engine_name: string;
  ai_sov: number;
  net_sentiment: number;
  rsi: number;
  overall_grade: Grade;
  awareness_label: string;
  investment_level: string;
};

export type ActionItem = {
  priority: Priority;
  action_text: string;
  rationale: string;
  kpi_target: string;           // e.g. 'ai_sov', 'net_sentiment'
  estimated_impact: string;
};

export type CrossEngineReview = {
  executive_summary: string;
  biggest_gap: string;
  competitive_landscape: string;
  engine_rankings: EngineRanking[];
  action_items: ActionItem[];
  most_aware_engine: string;
  highest_investment_engine: string;
  engine_consistency: number;
  overall_ai_sov: number;
  overall_net_sentiment: number;
  overall_first_position_rate: number;
};

export type Meta = {
  scan_date: string;
  concept_name: string;
  concept_type: string;
  concept_category: string;
  total_queries: number;
  engines_tested: string[];
  scan_duration_seconds: number;
};

export type OverallKpis = {
  ai_sov: number;
  top3_rate: number;
  net_sentiment: number;
  rsi: number;
  engine_consistency: number;
  first_position_rate: number;
  competitive_win_rate: number;
  discovery_capture_rate: number;
};

export type RawReport = {
  session: {
    id: string;
    concept_type: string;
    concept_name: string;
    concept_category: string;
    concept_context?: string;
    engines: string[];
    query_count: number;
    status: string;
    report_data: {
      meta: Meta;
      query_log: QueryLogEntry[];
      overall_kpis: OverallKpis;
      engine_syntheses: EngineSynthesis[];
      executive_summary?: string;
      cross_engine_review: CrossEngineReview;
    };
  };
};

// ---------- Normalized UI shape ----------

/**
 * Per-engine identity used by EngineMark / EngineChip — stable across scans.
 * `slug` resolves to the canonical DS `EngineSlug` so the DS `EngineMark`
 * component renders the real brand SVG instead of a dummy glyph.
 */
export type EngineIdentity = {
  /** DS engine slug (e.g. 'openai', 'anthropic', 'google'). */
  slug: string;
  short: string;
  brand: string;
  mark: string;
  hue: number;
  glyph: string;
};

/** Enriched engine row consumed by every view. */
export type EngineRow = EngineIdentity & {
  id: string;
  name: string;
  aiSov: number;
  top3Rate: number;
  firstPositionRate: number;
  netSentiment: number;
  rsi: number;
  rsiPct: number;
  competitiveWinRate: number;
  discoveryCaptureRate: number;
  avgRankPosition: number | null;
  queriesTotal: number;
  queriesCompleted: number;
  queriesFailed: number;
  grade: Grade | null;
  gradeKlass: KlassStatus;
  awarenessLabel: string;
  investmentLevel: string;
  summaryText: string;
  intentBreakdown: IntentBreakdownRow[];
  topPositive: ResponseExcerpt[];
  topNegative: ResponseExcerpt[];
  sovKlass: KlassStatus;
  sentimentKlass: KlassStatus;
};

export type MatrixCell =
  | { intent: IntentType; empty: true }
  | {
      intent: IntentType;
      empty?: false;
      mentionRate: number;
      mentionKlass: KlassStatus;
      sentiment: number;
      queryCount: number;
      avgRank?: number | null;
    };

export type MatrixRow = {
  engine: EngineRow;
  cells: MatrixCell[];
};

export type IntentAggregate = {
  intent_type: IntentType;
  label: string;
  desc: string;
  mention_rate: number;   // avg across engines (0..100)
  avg_sentiment: number;  // avg across engines (-1..1)
  query_count: number;
};

export type AIOData = {
  brand: string;
  brandPretty: string;
  scanDateLabel: string;
  concept: {
    name: string;
    type: string;
    category: string;
    context?: string;
  };
  overall: {
    aiSov: number;
    firstPositionRate: number;
    netSentiment: number;
    top3Rate: number;
    rsi: number;
    competitiveWinRate: number;
    discoveryCaptureRate: number;
    engineConsistency: number;
    totalQueries: number;
    enginesTested: number;
    scanDurationSeconds: number | null;
  };
  execSummary: string;
  biggestGap: string;
  competitiveLandscape: string;
  engines: EngineRow[];
  matrix: MatrixRow[];
  intentAgg: IntentAggregate[];
  bestEngine: EngineRow;
  worstEngine: EngineRow;
  highSovEngine: EngineRow;
  mostAwareEngine: EngineRow;
  highestInvestmentEngine: EngineRow;
  actions: ActionItem[];
  sentimentCounts: { positive: number; neutral: number; negative: number };
  mentionCounts: { mentioned: number; missed: number };
  totalQ: number;
  bestQueries: QueryLogEntry[];
  missedQueries: QueryLogEntry[];
  negativeQueries: QueryLogEntry[];
  queryLog: QueryLogEntry[];
  INTENT_ORDER: IntentType[];
  INTENT_LABEL: Record<IntentType, string>;
  INTENT_DESC: Record<IntentType, string>;
};

export type Variant = 'v1' | 'v2' | 'v3' | 'pa' | 'method';
export type Mode = 'interactive' | 'public' | 'print';
export type FX = 'default' | 'neuro' | 'showcase';
export type Theme = 'dark' | 'light';
