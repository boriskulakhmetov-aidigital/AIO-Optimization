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