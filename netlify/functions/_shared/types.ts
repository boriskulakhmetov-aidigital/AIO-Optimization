export interface IntakeSummary {
  asset_type: string;          // C1_STATIC | C2_ANIMATED | C3_VIDEO | C4_SOCIAL_POST | C5_CAROUSEL | LANDING_PAGE | FULL_WEBSITE | EMAIL
  asset_tier: string;          // CREATIVE | PAGE_DESTINATION
  brand_name: string;
  offer: string;
  target_audience?: string;
  reading_direction?: string;
  awareness_stage?: string;
  campaign_context?: string;
  multi_campaign_confirmed?: boolean;
  traffic_source?: string;
  brand_voice?: string;
  brand_hex_primary?: string;
  brand_hex_secondary?: string;
  brand_hex_accent?: string;
  device?: string;
  competitors?: string;
  additional_context?: string;
}

export interface AuditJobRequest {
  intakeSummary: IntakeSummary;
  fileUri?: string;
  mimeType?: string;
  assetUrl?: string;
  jobId: string;
  userId?: string;
  messages?: Array<{ role: string; content: string }>;
}

export interface AuditJobStatus {
  status: 'pending' | 'streaming' | 'complete' | 'error';
  partial?: string;
  report?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
}

export interface VisualizerJobRequest {
  jobId: string;
  markdownReport: string;
  intakeSummary: IntakeSummary;
  assetUrl?: string;
  fileUri?: string;
  mimeType?: string;
}
