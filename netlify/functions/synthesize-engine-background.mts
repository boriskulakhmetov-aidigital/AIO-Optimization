import { createLLMProvider } from '@AiDigital-com/design-system/server';
import {
  getScanEngine, getQueriesForEngine, updateQueryResult,
  saveScanEngineSynthesis, updateScanEngineStatus,
  getScanEngines, areAllEnginesSynthesized,
  getScanById, updateScanStatus, createScanReview,
  writeJobStatus, supabase,
} from './_shared/supabase.js';
import { getEngineName } from './_shared/engineRegistry.js';
import type { EngineId, EngineSynthesis, IntentBreakdown, ResponseExcerpt } from './_shared/types.js';
import { log } from './_shared/logger.js';
import { getAppUrl } from '@AiDigital-com/design-system/utils';

// ── Brand-aware excerpt extraction ───────────────────────────────────────────
// Finds the sentence(s) in a response that actually mention the brand by name,
// rather than slicing the opening which is typically generic context text.

function extractBrandExcerpt(responseText: string, brandName: string, maxLen = 200): string {
  const lower = responseText.toLowerCase();
  const brand = brandName.toLowerCase();

  // Split into sentences on common terminators
  const sentences = responseText.split(/(?<=[.!?])\s+/);

  // Find sentences that mention the brand
  const branded = sentences.filter(s => s.toLowerCase().includes(brand));
  if (branded.length > 0) {
    // Return the first brand-mentioning sentence (or two if short)
    let excerpt = branded[0];
    if (excerpt.length < 80 && branded[1]) excerpt += ' ' + branded[1];
    return excerpt.slice(0, maxLen);
  }

  // Fallback: slice from just before the brand mention
  const idx = lower.indexOf(brand);
  if (idx >= 0) {
    const start = Math.max(0, idx - 30);
    return responseText.slice(start, start + maxLen);
  }

  // Last resort: opening text
  return responseText.slice(0, maxLen);
}

/* ── Per-query score (from LLM batch evaluation) ─────────────────────────── */

interface QueryScore {
  query_id: string;
  mentioned: boolean;
  mention_position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  recommendation_strength: 'strong' | 'moderate' | 'weak' | 'none';
  context_type: 'primary_rec' | 'alternative' | 'comparison' | 'mention_only';
}

const QUERY_SCORE_SCHEMA = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      query_id: { type: 'string' as const },
      mentioned: { type: 'boolean' as const },
      mention_position: { type: 'integer' as const, nullable: true },
      sentiment: { type: 'string' as const, enum: ['positive', 'neutral', 'negative'] },
      sentiment_score: { type: 'number' as const },
      recommendation_strength: { type: 'string' as const, enum: ['strong', 'moderate', 'weak', 'none'] },
      context_type: { type: 'string' as const, enum: ['primary_rec', 'alternative', 'comparison', 'mention_only'] },
    },
    required: ['query_id', 'mentioned', 'sentiment', 'sentiment_score', 'recommendation_strength', 'context_type'],
  },
};

const BATCH_SIZE = 10;

/* ── Main handler ────────────────────────────────────────────────────────── */

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.scanId || !body?.engineJobId) {
    return new Response('Missing scanId or engineJobId', { status: 400 });
  }

  const { scanId, engineJobId, userId, userEmail } = body as {
    scanId: string;
    engineJobId: string;
    userId?: string;
    userEmail?: string | null;
  };

  const startTime = Date.now();
  log.info('synthesis.start', { function_name: 'synthesize-engine-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, ai_provider: 'gemini', ai_model: 'gemini-3.1-pro-preview' });

  try {
    const engineJob = await getScanEngine(engineJobId);
    if (!engineJob) throw new Error(`Engine job not found: ${engineJobId}`);

    const engineId = engineJob.engine_id as EngineId;
    const engineName = getEngineName(engineId);

    const scan = await getScanById(scanId);
    if (!scan) throw new Error(`Scan not found: ${scanId}`);

    await updateScanEngineStatus(engineJobId, 'synthesizing');
    await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'synthesizing', engine_id: engineId } });

    const queries = await getQueriesForEngine(engineJobId);
    const completedQueries = queries.filter(q => q.status === 'complete' || q.status === 'error');

    if (completedQueries.length === 0) {
      console.warn(`No completed queries for engine ${engineId}, skipping synthesis`);
      await updateScanEngineStatus(engineJobId, 'complete');
      await checkAndTriggerReview(scanId, userId, userEmail);
      return new Response('No queries to synthesize', { status: 200 });
    }

    // Filter out placeholder responses — they don't count for scoring
    const validQueries = completedQueries.filter(q =>
      q.response_text && !q.response_text.includes('[PLACEHOLDER') && !q.response_text.includes('API key not configured')
    );
    const placeholderQueries = completedQueries.filter(q =>
      !q.response_text || q.response_text.includes('[PLACEHOLDER') || q.response_text.includes('API key not configured')
    );

    const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'analysis', { supabase });
    const conceptName = scan.concept_name;
    let totalInputTokens = 0, totalOutputTokens = 0, totalTokens = 0, totalThinkingTokens = 0;

    // ── Step 1: Parallel batch evaluation ────────────────────────────────
    // Split valid queries into batches, evaluate each in parallel with Pro + responseSchema

    const batches: typeof validQueries[] = [];
    for (let i = 0; i < validQueries.length; i += BATCH_SIZE) {
      batches.push(validQueries.slice(i, i + BATCH_SIZE));
    }

    const batchSystem = `You are an AI Search Optimization analyst. For each query/response pair, evaluate whether "${conceptName}" is mentioned or recommended.

For each query, return:
- query_id: the provided ID
- mentioned: was "${conceptName}" (or a clear reference) mentioned? (boolean)
- mention_position: if mentioned in a list/ranking, what position? 1 = first. null if not in a list.
- sentiment: positive, neutral, or negative
- sentiment_score: -1.0 (very negative) to +1.0 (very positive)
- recommendation_strength: "strong" (top pick), "moderate" (solid option), "weak" (with caveats), "none" (not mentioned)
- context_type: "primary_rec", "alternative", "comparison", or "mention_only"

Be precise. Return the array of scores.`;

    const allScores: QueryScore[] = [];

    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const batchText = batch.map(q =>
          `--- Query (id: ${q.id}, intent: ${q.intent_type}) ---\nQ: ${q.query_text}\nA: ${q.response_text || '(no response)'}`
        ).join('\n\n');

        const { text, usage } = await llm.generateContent({
          system: batchSystem,
          userParts: [{ text: batchText }],
          maxTokens: 8192,
          jsonMode: true,
          responseSchema: QUERY_SCORE_SCHEMA,
          app: 'aio-optimization:synthesis',
          userId: userId || scan.user_id,
        });

        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
        totalTokens += usage.totalTokens;
        totalThinkingTokens += usage.thinkingTokens || 0;

        return JSON.parse(text ?? '[]') as QueryScore[];
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') allScores.push(...r.value);
    }

    // Add placeholder queries as "none" scores
    for (const q of placeholderQueries) {
      allScores.push({
        query_id: q.id,
        mentioned: false,
        mention_position: null,
        sentiment: 'neutral',
        sentiment_score: 0,
        recommendation_strength: 'none',
        context_type: 'mention_only',
      });
    }

    // ── Step 2: Deterministic KPI aggregation ────────────────────────────

    const validScores = allScores.filter(s => !placeholderQueries.some(q => q.id === s.query_id));
    const n = validScores.length || 1; // avoid division by zero

    const mentionedScores = validScores.filter(s => s.mentioned);
    const rankedScores = validScores.filter(s => s.mention_position != null);
    const discoveryScores = validScores.filter(s => {
      const q = completedQueries.find(cq => cq.id === s.query_id);
      return q?.intent_type === 'discovery' || q?.intent_type === 'informational';
    });
    const competitiveScores = validScores.filter(s => {
      const q = completedQueries.find(cq => cq.id === s.query_id);
      return q?.intent_type === 'comparative' || q?.intent_type === 'commercial';
    });

    const rsiMap = { strong: 3, moderate: 2, weak: 1, none: 0 };

    const ai_sov = round1(mentionedScores.length / n * 100);
    const first_position_rate = round1(rankedScores.filter(s => s.mention_position === 1).length / n * 100);
    const top3_rate = round1(rankedScores.filter(s => s.mention_position != null && s.mention_position <= 3).length / n * 100);
    const avg_rank_position = rankedScores.length > 0
      ? round1(rankedScores.reduce((s, q) => s + (q.mention_position ?? 0), 0) / rankedScores.length)
      : null;
    const recommendation_strength_index = round1(validScores.reduce((s, q) => s + rsiMap[q.recommendation_strength], 0) / n);
    const positiveCount = mentionedScores.filter(s => s.sentiment === 'positive').length;
    const negativeCount = mentionedScores.filter(s => s.sentiment === 'negative').length;
    const net_sentiment_score = mentionedScores.length > 0
      ? round1((positiveCount - negativeCount) / mentionedScores.length * 100)
      : 0;
    const discoveryMentioned = discoveryScores.filter(s => s.mentioned).length;
    const discovery_capture_rate = discoveryScores.length > 0 ? round1(discoveryMentioned / discoveryScores.length * 100) : 0;
    const competitiveWins = competitiveScores.filter(s => s.context_type === 'primary_rec' || s.recommendation_strength === 'strong').length;
    const competitive_win_rate = competitiveScores.length > 0 ? round1(competitiveWins / competitiveScores.length * 100) : 0;

    // ── Intent breakdown ──
    const intentGroups = new Map<string, QueryScore[]>();
    for (const s of validScores) {
      const q = completedQueries.find(cq => cq.id === s.query_id);
      const intent = q?.intent_type || 'unknown';
      if (!intentGroups.has(intent)) intentGroups.set(intent, []);
      intentGroups.get(intent)!.push(s);
    }
    const intent_breakdown: IntentBreakdown[] = Array.from(intentGroups.entries()).map(([intent, scores]) => {
      const mentioned = scores.filter(s => s.mentioned);
      const ranked = scores.filter(s => s.mention_position != null);
      return {
        intent_type: intent as any,
        query_count: scores.length,
        mention_rate: round1(mentioned.length / scores.length * 100),
        avg_sentiment: round1(mentioned.length > 0 ? mentioned.reduce((s, q) => s + q.sentiment_score, 0) / mentioned.length : 0),
        avg_rank: ranked.length > 0 ? round1(ranked.reduce((s, q) => s + (q.mention_position ?? 0), 0) / ranked.length) : null,
      };
    });

    // ── Step 3: Verbatim selection (sort by sentiment_score) ─────────────

    const scoredWithText = validScores
      .filter(s => s.mentioned)
      .map(s => {
        const q = completedQueries.find(cq => cq.id === s.query_id);
        return { ...s, query_text: q?.query_text || '', response_text: q?.response_text || '' };
      });

    const top_positive_responses: ResponseExcerpt[] = scoredWithText
      .filter(s => s.sentiment === 'positive')
      .sort((a, b) => b.sentiment_score - a.sentiment_score)
      .slice(0, 3)
      .map(s => ({ query: s.query_text.slice(0, 120), excerpt: extractBrandExcerpt(s.response_text, conceptName) }));

    const top_negative_responses: ResponseExcerpt[] = scoredWithText
      .filter(s => s.sentiment === 'negative')
      .sort((a, b) => a.sentiment_score - b.sentiment_score)
      .slice(0, 3)
      .map(s => ({ query: s.query_text.slice(0, 120), excerpt: extractBrandExcerpt(s.response_text, conceptName) }));

    // ── Step 4: Summary (lightweight Pro call with just KPIs) ────────────

    let summary_text = `${engineName}: AI-SOV ${ai_sov}%, RSI ${recommendation_strength_index}/3.`;
    try {
      const summaryResult = await llm.generateContent({
        system: `Write a concise 2-3 sentence summary of how the AI engine "${engineName}" treats "${conceptName}" based on these KPI scores. Be specific about strengths and weaknesses.`,
        userParts: [{ text: `Engine: ${engineName}\nConcept: ${conceptName}\nAI-SOV: ${ai_sov}%\nFirst Position Rate: ${first_position_rate}%\nTop-3 Rate: ${top3_rate}%\nRSI: ${recommendation_strength_index}/3\nNet Sentiment: ${net_sentiment_score}\nDiscovery Rate: ${discovery_capture_rate}%\nCompetitive Win Rate: ${competitive_win_rate}%\nQueries analyzed: ${n}` }],
        maxTokens: 256,
        app: 'aio-optimization:synthesis',
        userId: userId || scan.user_id,
      });
      totalInputTokens += summaryResult.usage.inputTokens;
      totalOutputTokens += summaryResult.usage.outputTokens;
      totalTokens += summaryResult.usage.totalTokens;
      totalThinkingTokens += summaryResult.usage.thinkingTokens || 0;
      summary_text = summaryResult.text ?? summary_text;
    } catch {
      // Fallback to static summary — non-critical
    }

    // ── Update per-query scores in DB ──
    for (const score of allScores) {
      await updateQueryResult(score.query_id, {
        status: 'complete',
        mentioned: score.mentioned,
        mentionPosition: score.mention_position,
        sentiment: score.sentiment,
        sentimentScore: score.sentiment_score,
        recommendationStrength: score.recommendation_strength,
        contextType: score.context_type,
      }).catch(err => console.warn(`Failed to update query score ${score.query_id}:`, err));
    }

    // ── Build and save synthesis ──
    const synthesis: EngineSynthesis = {
      engine_id: engineId,
      engine_name: engineName,
      queries_total: queries.length,
      queries_completed: completedQueries.filter(q => q.status === 'complete').length,
      queries_failed: completedQueries.filter(q => q.status === 'error').length,
      ai_sov,
      first_position_rate,
      top3_rate,
      avg_rank_position,
      recommendation_strength_index,
      net_sentiment_score,
      discovery_capture_rate,
      competitive_win_rate,
      intent_breakdown,
      top_positive_responses,
      top_negative_responses,
      summary_text,
    };

    await saveScanEngineSynthesis(engineJobId, synthesis);

    log.info('synthesis.complete', { function_name: 'synthesize-engine-background', user_id: userId || scan.user_id, user_email: userEmail || scan.user_email, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, ai_provider: 'gemini', ai_model: 'gemini-3.1-pro-preview', duration_ms: Date.now() - startTime, ai_input_tokens: totalInputTokens, ai_output_tokens: totalOutputTokens, ai_total_tokens: totalTokens, ai_thinking_tokens: totalThinkingTokens, meta: { engine_id: engineId, ai_sov, batches: batches.length } });
    console.log(`Synthesis complete for ${engineName}: AI-SOV=${ai_sov}%, RSI=${recommendation_strength_index} (${batches.length} batches)`);

    await checkAndTriggerReview(scanId, userId, userEmail);

  } catch (err) {
    console.error(`synthesize-engine-background error (${engineJobId}):`, err);
    log.error('synthesis.error', { function_name: 'synthesize-engine-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, error: err, error_category: 'gemini_api', duration_ms: Date.now() - startTime });
    await updateScanEngineStatus(engineJobId, 'error', `Synthesis failed: ${err}`);
  }

  return new Response('Accepted', { status: 202 });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function checkAndTriggerReview(scanId: string, userId?: string, userEmail?: string | null) {
  const allSynthesized = await areAllEnginesSynthesized(scanId);
  if (!allSynthesized) return;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: claimed } = await supabase
    .from('scans')
    .update({ status: 'reviewing' })
    .eq('id', scanId)
    .eq('status', 'synthesizing')
    .select('id');

  if (!claimed?.length) {
    console.log(`Scan ${scanId} already moved past synthesizing — skipping review task creation`);
    return;
  }

  console.log(`All engines synthesized for scan ${scanId} — creating review task`);
  await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'reviewing' } });

  const reviewId = `${scanId}_review`;
  await createScanReview(reviewId, scanId);

  await supabase.from('pipeline_tasks').insert({
    app: 'aio-optimization',
    scan_id: scanId,
    task_type: 'review',
    payload: { scanId, userId: userId || null, userEmail: userEmail || null, scanConfig: {} },
  });

  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  await fetch(`${siteUrl}/.netlify/functions/task-worker`, { method: 'POST' }).catch(() => {});
}
