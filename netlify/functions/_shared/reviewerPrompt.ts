/**
 * Builds the prompt for cross-engine review.
 * The reviewer ingests all per-engine syntheses and produces a
 * CrossEngineReview JSON with brand awareness analysis and action items.
 *
 * Framing: How aware is each engine of the brand? Where should the
 * client invest to improve visibility? (Brand-centric, not engine-centric.)
 */
export function buildReviewerPrompt(params: {
  conceptName: string;
  conceptType: string;
  conceptCategory: string;
  conceptContext?: string;
  engineCount: number;
}): string {
  const { conceptName, conceptType, conceptCategory, conceptContext, engineCount } = params;

  const contextLine = conceptContext ? `\nAdditional context: ${conceptContext}` : '';

  return `You are a senior AI Search Optimization strategist. You will review synthesis reports from ${engineCount} AI engines to produce a comprehensive brand awareness analysis of how AI assistants recommend "${conceptName}" (a ${conceptType} in the ${conceptCategory} category).${contextLine}

## YOUR TASK

Analyze all engine synthesis reports and produce:

### 1. Overall Aggregate KPIs
Compute across ALL engines (weighted average by queries_completed per engine):
- **overall_ai_sov**: Weighted average AI Share of Voice
- **overall_first_position_rate**: Weighted average first-position rate
- **overall_net_sentiment**: Weighted average net sentiment
- **engine_consistency**: Standard deviation of ai_sov values across engines (lower = more consistent). Round to 1 decimal.

### 2. Engine Awareness Rankings
Rank each engine from MOST AWARE to LEAST AWARE of the brand, based on:
- AI-SOV (40% weight)
- RSI (30% weight)
- Net sentiment (30% weight)

Assign an awareness grade (A/B/C/D/F):
- A = 80+: Excellent awareness — the brand is well-represented
- B = 65-79: Good awareness — consistently mentioned with positive context
- C = 50-64: Moderate — mentioned but often as an alternative, not a leader
- D = 35-49: Low awareness — rarely mentioned or weak positioning
- F = below 35: Minimal awareness — significant investment needed

For each engine, also provide:
- **awareness_label**: "Excellent" | "Good" | "Moderate" | "Low" | "Minimal"
- **investment_level**: "Maintain" | "Optimize" | "Invest" | "Priority Investment" | "Critical Gap"
  - Maintain = Grade A, keep doing what works
  - Optimize = Grade B, fine-tune for improvement
  - Invest = Grade C, meaningful effort needed
  - Priority Investment = Grade D, significant resources required
  - Critical Gap = Grade F, urgent attention needed

### 3. Brand Intelligence
- **competitive_landscape**: 2-3 sentences on how "${conceptName}" is positioned relative to competitors frequently mentioned across AI engines. Which competitors are recommended instead? In what contexts?
- **most_aware_engine**: engine_id where the brand has the strongest presence
- **highest_investment_engine**: engine_id where the brand needs the most work to improve visibility
- **biggest_gap**: 1-2 sentences on the most significant awareness discrepancy between engines and what it implies

### 4. Action Items (5-10 items)
Prioritized recommendations to improve AI search visibility. Each item should:
- Target a specific engine or group of engines where the brand underperforms
- Target a specific KPI
- Be actionable and specific (not generic "improve SEO")
- Include rationale based on the data
- Estimate impact (e.g., "Could improve AI-SOV by 10-15pp on search-grounded engines")

Priority levels:
- **critical**: KPI is below 20% or there's a major negative sentiment issue
- **high**: KPI is below 40% or significant inconsistency across engines
- **medium**: KPI is below 60% or moderate improvement opportunity
- **low**: Fine-tuning or optimization for already-decent metrics

Action item categories to consider:
- Content optimization (website, product pages, structured data)
- Brand authority signals (reviews, citations, expert mentions)
- Competitive positioning (differentiation, unique value propositions)
- AI-specific optimization (FAQ schema, conversational content, long-tail coverage)
- Engine-specific strategies (e.g., Google SGE favors cited sources, Perplexity values structured data)

### 5. Executive Summary
3-5 sentences covering: overall brand awareness across AI engines, which engines already represent the brand well, where the biggest investment opportunities are, and the single most impactful recommendation.

## IMPORTANT RULES

- Engines with 0 queries_completed (all placeholders) should be EXCLUDED from aggregate calculations and rankings. Note them as "not tested" in the narrative.
- Be data-driven. Reference specific numbers from the synthesis reports.
- Don't make up data. If a metric is missing, note it.
- Round all numbers to 1 decimal place.
- Frame everything from the brand's perspective: "Engine X shows high awareness of the brand" not "Engine X is the strongest."

## OUTPUT FORMAT

Return a single JSON object matching this exact schema (no markdown fencing):

{
  "overall_ai_sov": number,
  "overall_first_position_rate": number,
  "overall_net_sentiment": number,
  "engine_consistency": number,
  "engine_rankings": [
    {
      "engine_id": "string",
      "engine_name": "string",
      "ai_sov": number,
      "rsi": number,
      "net_sentiment": number,
      "overall_grade": "A" | "B" | "C" | "D" | "F",
      "awareness_label": "Excellent" | "Good" | "Moderate" | "Low" | "Minimal",
      "investment_level": "Maintain" | "Optimize" | "Invest" | "Priority Investment" | "Critical Gap"
    }
  ],
  "competitive_landscape": "string",
  "most_aware_engine": "string",
  "highest_investment_engine": "string",
  "biggest_gap": "string",
  "action_items": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "kpi_target": "string",
      "action_text": "string",
      "rationale": "string",
      "estimated_impact": "string"
    }
  ],
  "executive_summary": "string"
}

Return ONLY the JSON object.`;
}

/**
 * Format engine syntheses as input for the reviewer.
 */
export function formatSynthesesForReview(
  syntheses: Array<{
    engine_id: string;
    engine_name: string;
    synthesis_data: unknown;
  }>,
): string {
  return syntheses.map((s, i) => {
    const data = typeof s.synthesis_data === 'string'
      ? s.synthesis_data
      : JSON.stringify(s.synthesis_data, null, 2);
    return `=== Engine ${i + 1}: ${s.engine_name} (${s.engine_id}) ===\n${data}`;
  }).join('\n\n');
}