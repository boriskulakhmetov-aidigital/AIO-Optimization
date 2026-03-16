/**
 * Builds the prompt for per-engine synthesis.
 * The synthesizer ingests all ~100 query/response pairs from ONE engine
 * and produces an EngineSynthesis JSON object with KPI scores.
 */
export function buildSynthesizerPrompt(params: {
  engineName: string;
  conceptName: string;
  conceptType: string;
  conceptCategory: string;
  queriesCount: number;
}): string {
  const { engineName, conceptName, conceptType, conceptCategory, queriesCount } = params;

  return `You are an AI Search Optimization analyst. You will analyze ${queriesCount} query/response pairs from the AI engine "${engineName}" to determine how well it recommends or mentions "${conceptName}" (a ${conceptType} in the ${conceptCategory} category).

## YOUR TASK

For each query/response pair, determine:
1. **mentioned**: Was "${conceptName}" (or a clear reference to it) mentioned in the response? (boolean)
2. **mention_position**: If mentioned in a list/ranking, what position? 1 = first recommended. null if not in a list.
3. **sentiment**: Was the mention positive, neutral, or negative?
4. **sentiment_score**: Numerical sentiment from -1.0 (very negative) to +1.0 (very positive). 0 = neutral.
5. **recommendation_strength**: How strongly was it recommended? "strong" (enthusiastic, top pick), "moderate" (included, solid option), "weak" (mentioned but with caveats), "none" (not mentioned or mentioned negatively)
6. **context_type**: How was it presented? "primary_rec" (the main recommendation), "alternative" (one of several options), "comparison" (compared against others), "mention_only" (mentioned in passing)

Then compute aggregate KPIs across ALL queries:

## KPI DEFINITIONS

- **ai_sov** (0-100): % of queries where the concept was mentioned at all
- **first_position_rate** (0-100): % of queries where the concept was recommended first (mention_position = 1)
- **top3_rate** (0-100): % of queries where the concept appeared in top 3 (mention_position <= 3)
- **avg_rank_position** (number or null): Average mention_position across queries where it was ranked. null if never ranked.
- **recommendation_strength_index** (0-3): Average of strong=3, moderate=2, weak=1, none=0 across ALL queries (including those where it wasn't mentioned = 0)
- **net_sentiment_score** (-100 to +100): (% positive - % negative) among queries where it was mentioned
- **discovery_capture_rate** (0-100): % of "discovery" intent queries where it was mentioned
- **competitive_win_rate** (0-100): % of "comparative" intent queries where it was recommended as the preferred/winning option (primary_rec or strong recommendation)

## INTENT BREAKDOWN

Group results by intent_type and compute per-group:
- query_count, mention_rate (0-100), avg_sentiment (-1.0 to 1.0), avg_rank (or null)

## VERBATIMS

Select the 3 most positive and 3 most negative response excerpts (brief, max 150 chars each).

## IMPORTANT RULES

- Responses that are PLACEHOLDER responses (containing "[PLACEHOLDER" or "API key not configured") should be EXCLUDED from all scoring. Set their mentioned=false, sentiment="neutral", recommendation_strength="none". They should NOT count toward any KPI calculations.
- Be precise with numbers. Round to 1 decimal place.
- If the concept is never mentioned across all valid (non-placeholder) queries, all rates should be 0.
- Write a brief 2-3 sentence summary_text describing this engine's overall stance toward the concept.

## OUTPUT FORMAT

Return a single JSON object matching this exact schema (no markdown fencing):

{
  "engine_id": "string",
  "engine_name": "string",
  "queries_total": number,
  "queries_completed": number,
  "queries_failed": number,
  "ai_sov": number,
  "first_position_rate": number,
  "top3_rate": number,
  "avg_rank_position": number | null,
  "recommendation_strength_index": number,
  "net_sentiment_score": number,
  "discovery_capture_rate": number,
  "competitive_win_rate": number,
  "intent_breakdown": [
    { "intent_type": "string", "query_count": number, "mention_rate": number, "avg_sentiment": number, "avg_rank": number | null }
  ],
  "top_positive_responses": [{ "query": "string", "excerpt": "string" }],
  "top_negative_responses": [{ "query": "string", "excerpt": "string" }],
  "summary_text": "string",
  "per_query_scores": [
    {
      "query_id": "string",
      "mentioned": boolean,
      "mention_position": number | null,
      "sentiment": "positive" | "neutral" | "negative",
      "sentiment_score": number,
      "recommendation_strength": "strong" | "moderate" | "weak" | "none",
      "context_type": "primary_rec" | "alternative" | "comparison" | "mention_only"
    }
  ]
}

Return ONLY the JSON object.`;
}

/**
 * Format the query/response pairs as input for the synthesizer.
 */
export function formatQueriesForSynthesis(
  queries: Array<{
    id: string;
    query_text: string;
    intent_type: string;
    response_text: string | null;
    status: string;
  }>,
): string {
  return queries.map((q, i) => {
    const status = q.status === 'error' ? ' [ERROR]' : '';
    const response = q.response_text || '(no response)';
    return `--- Query ${i + 1} (id: ${q.id}, intent: ${q.intent_type})${status} ---
Q: ${q.query_text}
A: ${response}`;
  }).join('\n\n');
}