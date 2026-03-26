// ── AIO Optimization — Backend Types ─────────────────────────────────────────

// ── Concept Taxonomy ─────────────────────────────────────────────────────────

export type ConceptType = 'product' | 'offering' | 'concept';

export interface ScanConfig {
  concept_type: ConceptType;
  concept_name: string;           // "Toyota RAV4"
  concept_category?: string;      // "SUV", "family car"
  concept_context?: string;       // additional context from intake
  engines: EngineId[];
  query_count: number;            // queries per engine (default 100)
}

// ── Engine Taxonomy ──────────────────────────────────────────────────────────

export type EngineId =
  | 'chatgpt_free'
  | 'chatgpt_pro'
  | 'gemini_free'
  | 'gemini_pro'
  | 'claude'
  | 'grok_free'
  | 'grok_pro'
  | 'perplexity'
  | 'copilot'
  | 'meta_ai'
  | 'google_sge';

// ── Query Intent Taxonomy ────────────────────────────────────────────────────

export type QueryIntentType =
  | 'direct'
  | 'comparative'
  | 'ranked'
  | 'discovery'
  | 'sentiment'
  | 'contextual'
  | 'negative';

export interface GeneratedQuery {
  text: string;
  intent_type: QueryIntentType;
  intent_subtype?: string;        // "best_in_class", "versus", "top_n", etc.
}

// ── Scan Job Types ───────────────────────────────────────────────────────────

export type ScanStatus =
  | 'intake'
  | 'generating'
  | 'scanning'
  | 'synthesizing'
  | 'reviewing'
  | 'complete'
  | 'error';

export type EngineJobStatus = 'pending' | 'querying' | 'synthesizing' | 'complete' | 'error';
export type QueryStatus = 'pending' | 'running' | 'complete' | 'error' | 'retry';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type RecommendationStrength = 'strong' | 'moderate' | 'weak' | 'none';
export type ContextType = 'primary_rec' | 'alternative' | 'comparison' | 'mention_only';

// ── Synthesis & Review Output ────────────────────────────────────────────────

export interface IntentBreakdown {
  intent_type: QueryIntentType;
  query_count: number;
  mention_rate: number;           // 0-100
  avg_sentiment: number;          // -1.0 to 1.0
  avg_rank: number | null;
}

export interface ResponseExcerpt {
  query: string;
  excerpt: string;
}

export interface EngineSynthesis {
  engine_id: EngineId;
  engine_name: string;
  queries_total: number;
  queries_completed: number;
  queries_failed: number;

  // Primary KPIs
  ai_sov: number;                          // 0-100  (AI Share of Voice)
  first_position_rate: number;             // 0-100
  top3_rate: number;                       // 0-100
  avg_rank_position: number | null;        // null if never ranked
  recommendation_strength_index: number;   // 0-3
  net_sentiment_score: number;             // -100 to +100
  discovery_capture_rate: number;          // 0-100
  competitive_win_rate: number;            // 0-100

  // Breakdowns
  intent_breakdown: IntentBreakdown[];

  // Verbatims
  top_positive_responses: ResponseExcerpt[];
  top_negative_responses: ResponseExcerpt[];

  // Narrative
  summary_text: string;
}

export type AwarenessLabel = 'Excellent' | 'Good' | 'Moderate' | 'Low' | 'Minimal';
export type InvestmentLevel = 'Maintain' | 'Optimize' | 'Invest' | 'Priority Investment' | 'Critical Gap';

export interface EngineRanking {
  engine_id: EngineId;
  engine_name: string;
  ai_sov: number;
  rsi: number;
  net_sentiment: number;
  overall_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  awareness_label: AwarenessLabel;
  investment_level: InvestmentLevel;
}

export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  kpi_target: string;
  action_text: string;
  rationale: string;
  estimated_impact: string;
}

export interface CrossEngineReview {
  overall_ai_sov: number;
  overall_first_position_rate: number;
  overall_net_sentiment: number;
  engine_consistency: number;              // std dev of AI-SOV (lower = better)

  engine_rankings: EngineRanking[];

  competitive_landscape: string;
  most_aware_engine: EngineId;
  highest_investment_engine: EngineId;
  biggest_gap: string;

  action_items: ActionItem[];
  executive_summary: string;
}

// ── Final Report Shape ───────────────────────────────────────────────────────

export interface AIOReportMeta {
  concept_type: ConceptType;
  concept_name: string;
  concept_category?: string;
  engines_tested: EngineId[];
  total_queries: number;
  scan_date: string;
  scan_duration_seconds: number;
}

export interface OverallKPIs {
  ai_sov: number;
  first_position_rate: number;
  top3_rate: number;
  net_sentiment: number;
  rsi: number;
  discovery_capture_rate: number;
  competitive_win_rate: number;
  engine_consistency: number;
}

export interface QueryLogEntry {
  engine_id: EngineId;
  query_text: string;
  intent_type: QueryIntentType;
  mentioned: boolean;
  rank: number | null;
  sentiment: SentimentLabel | null;
  response_excerpt: string;
}

export interface AIOReportData {
  schema_version: '2.0';
  meta: AIOReportMeta;
  executive_summary: string;
  overall_kpis: OverallKPIs;
  engine_syntheses: EngineSynthesis[];
  cross_engine_review: CrossEngineReview;
  query_log: QueryLogEntry[];
}

// ── Request/Response Types ───────────────────────────────────────────────────

export interface DispatchScanRequest {
  config: ScanConfig;
  queries: Record<EngineId, GeneratedQuery[]>;
  userId: string;
  userEmail?: string;
}

export interface ScanProgressResponse {
  scan_id: string;
  status: ScanStatus;
  engines: Array<{
    engine_id: EngineId;
    status: EngineJobStatus;
    queries_total: number;
    queries_done: number;
  }>;
}