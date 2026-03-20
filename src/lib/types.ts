// ── AIO Optimization — Frontend Types ────────────────────────────────────────

export type AppPhase =
  | 'chat'           // Orchestrator intake conversation
  | 'generating'     // Generating queries
  | 'scanning'       // Running queries across engines
  | 'synthesizing'   // Per-engine synthesis running
  | 'reviewing'      // Cross-engine review running
  | 'report_ready'   // Final report available
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Re-export shared types that frontend needs
export type {
  ConceptType,
  EngineId,
  QueryIntentType,
  ScanStatus,
  EngineJobStatus,
  ScanConfig,
  GeneratedQuery,
  EngineSynthesis,
  CrossEngineReview,
  AIOReportData,
  OverallKPIs,
  AIOReportMeta,
  ScanProgressResponse,
  ActionItem,
  EngineRanking,
  IntentBreakdown,
  QueryLogEntry,
} from '../../netlify/functions/_shared/types.js';

// ── Scan progress types (used by ScanDashboard) ──────────────────────────────

import type { EngineId } from '../../netlify/functions/_shared/types.js';

export interface EngineProgress {
  engine_id: EngineId;
  status: 'pending' | 'querying' | 'complete' | 'error';
  queries_total: number;
  queries_done: number;
  latest_snippet?: {
    engine_id: string;
    query: string;
    response: string;
    ts: number;
  } | null;
}

export interface FeedSnippet {
  engine_id: string;
  query: string;
  response: string;
  ts: number;
}

export interface ScanProgress {
  scan_id: string;
  status: 'scanning' | 'synthesizing' | 'error';
  engines: EngineProgress[];
  feed: FeedSnippet[];
  skipped_engines?: string[];
}

export interface SynthesisStatus {
  scan_id: string;
  scan_status: string;
  phase: 'scanning' | 'synthesizing' | 'reviewing' | 'complete' | 'error';
  engines: Array<{
    engine_id: string;
    status: string;
    has_synthesis: boolean;
  }>;
  review_status: string | null;
  has_report: boolean;
}
