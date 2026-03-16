export type AppPhase =
  | 'chat'
  | 'uploading'
  | 'audit_running'
  | 'visualizing'
  | 'report_ready'
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AssetState {
  fileUri?: string;
  mimeType?: string;
  fileName?: string;
  previewUrl?: string;
  assetUrl?: string;
}

export interface IntakeSummary {
  asset_type: string;
  asset_tier: string;
  brand_name: string;
  offer: string;
  [key: string]: unknown;
}
