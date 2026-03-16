import type { ConceptType } from './types.js';
import { QUERY_INTENT_DISTRIBUTION, INTENT_DESCRIPTIONS } from './kpiFramework.js';

/**
 * Build a prompt that instructs Gemini to generate diverse queries
 * for auditing a concept across AI search engines.
 */
export function buildQueryGeneratorPrompt(params: {
  conceptType: ConceptType;
  conceptName: string;
  conceptCategory: string;
  conceptContext?: string;
  queryCount: number;
}): string {
  const { conceptType, conceptName, conceptCategory, conceptContext, queryCount } = params;

  // Scale the distribution proportionally to the requested query count
  const scaleFactor = queryCount / 100;
  const distribution = Object.entries(QUERY_INTENT_DISTRIBUTION)
    .map(([intent, count]) => `- ${intent} (${Math.round(count * scaleFactor)} queries): ${INTENT_DESCRIPTIONS[intent]}`)
    .join('\n');

  const conceptLabel =
    conceptType === 'product' ? 'product' :
    conceptType === 'offering' ? 'offering/venue/retailer' :
    'concept/phrase/slogan';

  const contextLine = conceptContext
    ? `\nAdditional context: ${conceptContext}`
    : '';

  return `You are a market research query designer. Generate exactly ${queryCount} diverse search queries that a real consumer might ask an AI assistant (like ChatGPT, Claude, Gemini, etc.) where the answer could potentially mention or recommend "${conceptName}".

## Target
- Type: ${conceptLabel}
- Name: "${conceptName}"
- Category: ${conceptCategory}${contextLine}

## Query Intent Distribution
Generate queries across these intent types with the following approximate counts:
${distribution}

## CRITICAL: Query Style Rules

The goal is to measure whether AI engines **recommend** or **rank** "${conceptName}". Queries MUST be the kind that elicit recommendation lists, rankings, and "best of" answers — not factual/technical questions.

**DO generate queries like:**
- "What is the best ${conceptCategory} right now?"
- "Top 5 ${conceptCategory} for [use case]"
- "Which ${conceptCategory} do you recommend for a family?"
- "Best ${conceptCategory} under $[price]"
- "What ${conceptCategory} should I buy in 2026?"
- "Compare the top ${conceptCategory} options"
- "[Competitor] vs what else should I consider?"
- "Most popular ${conceptCategory} this year"

**DO NOT generate queries like:**
- "Is ${conceptCategory} fragile?" (factual, doesn't elicit recommendations)
- "How does ${conceptCategory} work?" (educational, not a purchase query)
- "What is ${conceptCategory} made of?" (technical, won't mention brands)

Every query should be one where a helpful AI assistant would naturally list, rank, or recommend specific ${conceptType === 'product' ? 'products' : conceptType === 'offering' ? 'places/services' : 'options'} by name.

## Additional Rules

1. **Natural consumer language**: Write queries the way real people talk to AI — conversational, sometimes vague, sometimes specific.
2. **Vary specificity**: Mix broad ("best ${conceptCategory}") with specific ("best ${conceptCategory} under $40k with AWD for a family of 5").
3. **Vary phrasing**: Use questions, commands ("recommend me"), comparisons ("X vs Y"), requests for lists ("top 10"), and superlatives ("best", "most reliable").
4. **Include competitor mentions**: Some comparative queries should name specific competitors in the category.
5. **Geographic/demographic variety**: Some queries should include location, demographics, budget, or situational context.
6. **Never mention "${conceptName}" by name** except in sentiment/reputation queries that directly ask about the target.
7. **${conceptType === 'offering' ? 'Include "where to buy" and "best place for" queries' : conceptType === 'concept' ? 'Include queries that test consumer association with the concept/phrase' : 'Focus on "best", "top", "recommend", and comparison queries'}**.

## Output Format
Return a JSON array of objects, each with:
- "text": the query string
- "intent_type": one of: direct, comparative, ranked, discovery, sentiment, contextual, negative
- "intent_subtype": a more specific label (e.g., "best_in_class", "versus", "top_n", "needs_based", "reputation", "regional", "why_not")

Return ONLY the JSON array, no markdown fencing, no explanation.`;
}