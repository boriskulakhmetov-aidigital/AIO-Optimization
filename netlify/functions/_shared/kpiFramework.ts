// ── KPI Taxonomy for AI Search Optimization ──────────────────────────────────
// Based on marketing frameworks: AIDA, Share of Voice, Brand Equity, Customer Journey

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  scale: string;
  direction: 'higher_better' | 'lower_better';
  category: 'primary' | 'secondary';
  weight: number;              // relative importance (0-1) for overall scoring
}

export const KPI_DEFINITIONS: KPIDefinition[] = [
  // ── Primary KPIs ──────────────────────────────────────────────────────────
  {
    id: 'ai_sov',
    name: 'AI Share of Voice',
    description: 'Percentage of queries where the brand/product is mentioned at all. Analogous to traditional Share of Voice in media, but measured across AI-generated responses.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.20,
  },
  {
    id: 'first_position_rate',
    name: 'First-Position Rate',
    description: 'Percentage of queries where the brand/product is the first recommendation. The AI equivalent of ranking #1 in search results.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.18,
  },
  {
    id: 'top3_rate',
    name: 'Top-3 Rate',
    description: 'Percentage of queries where the brand appears in the top 3 recommendations. Captures prominent visibility across AI responses.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.12,
  },
  {
    id: 'rsi',
    name: 'Recommendation Strength Index',
    description: 'Average strength of recommendations when mentioned. Strong=3, Moderate=2, Weak=1, None=0. Measures conviction in the recommendation.',
    scale: '0-3.0',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.15,
  },
  {
    id: 'net_sentiment',
    name: 'Net Sentiment Score',
    description: '% positive mentions minus % negative mentions. Reflects overall brand perception in AI-generated content.',
    scale: '-100 to +100',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.10,
  },
  {
    id: 'discovery_capture_rate',
    name: 'Discovery Capture Rate',
    description: 'Percentage of open-ended/discovery queries that surface the brand. Measures how well the brand appears when users have no prior preference.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.13,
  },
  {
    id: 'competitive_win_rate',
    name: 'Competitive Win Rate',
    description: 'Percentage of comparative queries where the brand is preferred over named competitors. Direct measure of competitive positioning in AI responses.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'primary',
    weight: 0.12,
  },

  // ── Secondary KPIs ────────────────────────────────────────────────────────
  {
    id: 'objection_resilience',
    name: 'Objection Resilience',
    description: 'How well the brand holds up in negative/objection queries. Measured as net sentiment within negative-intent queries.',
    scale: '-100 to +100',
    direction: 'higher_better',
    category: 'secondary',
    weight: 0,
  },
  {
    id: 'context_diversity',
    name: 'Context Diversity',
    description: 'Number of distinct context types where brand appears (primary_rec, alternative, comparison, mention_only). Higher = more diverse presence.',
    scale: '1-4',
    direction: 'higher_better',
    category: 'secondary',
    weight: 0,
  },
  {
    id: 'engine_consistency',
    name: 'Engine Consistency',
    description: 'Standard deviation of AI-SOV across engines. Lower values mean the brand is consistently visible across all AI platforms.',
    scale: '0-50',
    direction: 'lower_better',
    category: 'secondary',
    weight: 0,
  },
  {
    id: 'intent_coverage',
    name: 'Intent Coverage',
    description: 'Percentage of intent categories where brand achieves >50% mention rate. Measures breadth of AI visibility across question types.',
    scale: '0-100%',
    direction: 'higher_better',
    category: 'secondary',
    weight: 0,
  },
];

/** Get a KPI definition by ID */
export function getKPI(id: string): KPIDefinition | undefined {
  return KPI_DEFINITIONS.find(k => k.id === id);
}

/** Get only primary KPIs */
export function getPrimaryKPIs(): KPIDefinition[] {
  return KPI_DEFINITIONS.filter(k => k.category === 'primary');
}

/** Grade scale: A/B/C/D/F based on weighted KPI performance */
export function computeOverallGrade(kpis: {
  ai_sov: number;
  first_position_rate: number;
  top3_rate: number;
  rsi: number;
  net_sentiment: number;
  discovery_capture_rate: number;
  competitive_win_rate: number;
}): 'A' | 'B' | 'C' | 'D' | 'F' {
  // Normalize each KPI to 0-100 scale
  const normalized = {
    ai_sov: kpis.ai_sov,
    first_position_rate: kpis.first_position_rate,
    top3_rate: kpis.top3_rate,
    rsi: (kpis.rsi / 3) * 100,
    net_sentiment: (kpis.net_sentiment + 100) / 2,   // -100..+100 → 0..100
    discovery_capture_rate: kpis.discovery_capture_rate,
    competitive_win_rate: kpis.competitive_win_rate,
  };

  // Weighted average
  const score =
    normalized.ai_sov * 0.20 +
    normalized.first_position_rate * 0.18 +
    normalized.top3_rate * 0.12 +
    normalized.rsi * 0.15 +
    normalized.net_sentiment * 0.10 +
    normalized.discovery_capture_rate * 0.13 +
    normalized.competitive_win_rate * 0.12;

  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

// ── Query Intent Distribution ────────────────────────────────────────────────
// Recommended distribution of 100 queries across intent types

export const QUERY_INTENT_DISTRIBUTION = {
  direct: 20,
  comparative: 20,
  ranked: 15,
  discovery: 15,
  sentiment: 10,
  contextual: 10,
  negative: 10,
} as const;

export const INTENT_DESCRIPTIONS: Record<string, string> = {
  direct: 'Questions directly asking about or for the product/concept',
  comparative: 'Head-to-head or multi-brand comparisons',
  ranked: 'Requests for ordered lists where position matters',
  discovery: 'Open-ended questions with no brand preference',
  sentiment: 'Questions probing brand/product reputation and perception',
  contextual: 'Scenario-based and situational questions',
  negative: 'Questions testing objection handling and downsides',
};