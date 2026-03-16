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

## Rules for Query Generation

1. **Realistic consumer language**: Write queries the way real people talk to AI assistants — natural, conversational, sometimes vague, sometimes specific.
2. **Vary specificity**: Mix highly specific queries ("best ${conceptCategory} under $40k with AWD") with broad ones ("what ${conceptCategory} should I get?").
3. **Vary phrasing**: Don't repeat sentence structures. Use questions, commands, comparisons, requests for lists, requests for opinions.
4. **Include competitor mentions**: Some comparative queries should name specific competitors in the category.
5. **Geographic/demographic variety**: Some queries should include location, demographic, or situational context.
6. **Never mention the target by name in queries**: The point is to see if the AI independently recommends/mentions "${conceptName}". The only exception is sentiment/reputation queries that directly ask about the target.
7. **${conceptType === 'offering' ? 'Include "where to buy" and location-based queries' : conceptType === 'concept' ? 'Include queries that test consumer association with the concept/phrase' : 'Focus on product recommendation and comparison queries'}**.

## Output Format
Return a JSON array of objects, each with:
- "text": the query string
- "intent_type": one of: direct, comparative, ranked, discovery, sentiment, contextual, negative
- "intent_subtype": a more specific label (e.g., "best_in_class", "versus", "top_n", "needs_based", "reputation", "regional", "why_not")

Return ONLY the JSON array, no markdown fencing, no explanation.`;
}