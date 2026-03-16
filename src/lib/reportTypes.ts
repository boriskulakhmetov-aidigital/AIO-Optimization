// ── Structured Report Data (output of Visualizer Agent) ──────────────────────

export type SeverityLevel = 'CRITICAL' | 'SIGNIFICANT' | 'MODERATE' | 'IMPROVEMENT';
export type CriterionType = 'compliance' | 'measurable' | 'subjective';
export type AssetTier = 'CREATIVE' | 'PAGE_DESTINATION';
export type LayoutType = 'single_image' | 'webpage_url' | 'multi_asset' | 'document' | 'video' | 'none';

export interface PrioritizedAction {
  criterion_id: string;       // "1.1"
  criterion_name: string;     // "First Fixation Point"
  severity: SeverityLevel;
  score: number | null;       // null = N/A
  action_text: string;
}

export interface CriterionBlock {
  id: string;                       // "1.1"
  name: string;                     // "First Fixation Point"
  type: CriterionType;
  score: number | null;             // null = N/A
  is_na: boolean;
  hard_floor_triggered: boolean;
  cultural_deduction: number;       // 0, -1, -2, -4
  cultural_deduction_code: string;  // "C0" | "C1" | "C2" | "C3"
  severity: SeverityLevel | null;
  observation: string;
  rubric_grounding: string;
  cultural_deduction_evidence: string;
  improvement_path: string;
}

export interface ReportSection {
  id: 1 | 2 | 3;
  name: string;
  section_average: number;
  summary: string;
  criteria: CriterionBlock[];
  prioritized_actions: PrioritizedAction[];
}

export interface ReportMeta {
  brand_name: string;
  asset_type_code: string;         // "C1", "LANDING_PAGE", etc.
  asset_type_label: string;        // Human-readable
  asset_tier: AssetTier;
  audit_date: string;
  rubric_version: string;
  overall_score: number;
  scored_criteria_count: number;
  na_criteria_count: number;
  asset_url?: string;
  asset_thumbnail_uri?: string;    // fileUri if uploaded
}

export interface UserBriefData {
  brand_name: string;
  asset_type: string;
  asset_tier: string;
  offer: string;
  target_audience: string;
  awareness_stage: string;
  traffic_source: string;
  campaign_context: string;
  reading_direction: string;
  brand_voice: string;
  brand_hex_primary: string;
  brand_hex_secondary: string;
  brand_hex_accent: string;
  device: string;
  markets: string;
  competitors: string;
  multi_campaign_confirmed: boolean;
  additional_context: string;
}

export interface MathAndLogic {
  score_anchoring: string;
  hard_floor_prescan: string;
  multi_campaign_cascade: string;
  master_scoring_table: string;
  consistency_verification: string;
  arithmetic_verification: string;
}

export interface CreativeAsset {
  label: string;
  type: 'uploaded_file' | 'url' | 'component';
  url?: string;
  description: string;
}

export interface CreativesData {
  layout: LayoutType;
  synthesis: string;
  assets: CreativeAsset[];
}

export interface ExecutiveSummary {
  text: string;
  overall_score: number;
  score_verified: boolean;
  critical_actions: PrioritizedAction[];
  high_value_actions: PrioritizedAction[];  // fills list to 10 total
}

export interface ReportData {
  schema_version: '1.0';
  meta: ReportMeta;
  executive_summary: ExecutiveSummary;
  sections: [ReportSection, ReportSection, ReportSection];
  math_and_logic: MathAndLogic;
  creatives: CreativesData;
  user_brief: UserBriefData;
}
