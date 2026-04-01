import { GoogleGenAI } from '@google/genai';
import {
  getScanEngine, getQueriesForEngine, updateQueryResult,
  saveScanEngineSynthesis, updateScanEngineStatus,
  getScanEngines, areAllEnginesSynthesized,
  getScanById, updateScanStatus, createScanReview,
  writeJobStatus,
} from './_shared/supabase.js';
import { getEngineName } from './_shared/engineRegistry.js';
import { buildSynthesizerPrompt, formatQueriesForSynthesis } from './_shared/synthesizerPrompt.js';
import type { EngineId, EngineSynthesis } from './_shared/types.js';
import { log } from './_shared/logger.js';
import { getAppUrl } from '@boriskulakhmetov-aidigital/design-system/utils';
import { trackTokens } from './_shared/access.js';
import { extractGeminiTokens } from '@boriskulakhmetov-aidigital/design-system/utils';
import { repairJson } from './_shared/repairJson.js';

/**
 * POST /synthesize-engine-background  (background function)
 *
 * Runs synthesis for ONE engine. Triggered by scan-engine-background
 * when all queries for that engine are complete.
 *
 * 1. Loads all query/response pairs for the engine
 * 2. Sends them to Gemini with the synthesizer prompt
 * 3. Parses the EngineSynthesis JSON output
 * 4. Updates per-query scores in the DB
 * 5. Saves the synthesis to scan_engines.synthesis_data
 * 6. If all engines are synthesized, triggers review-background
 */
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
    // Load engine info and scan context
    const engineJob = await getScanEngine(engineJobId);
    if (!engineJob) throw new Error(`Engine job not found: ${engineJobId}`);

    const engineId = engineJob.engine_id as EngineId;
    const engineName = getEngineName(engineId);

    const scan = await getScanById(scanId);
    if (!scan) throw new Error(`Scan not found: ${scanId}`);

    // Mark engine as synthesizing
    await updateScanEngineStatus(engineJobId, 'synthesizing');

    // Write job status so frontend can track phase via Realtime
    await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'synthesizing', engine_id: engineId } });

    // Load all queries for this engine
    const queries = await getQueriesForEngine(engineJobId);
    const completedQueries = queries.filter(q => q.status === 'complete' || q.status === 'error');

    if (completedQueries.length === 0) {
      console.warn(`No completed queries for engine ${engineId}, skipping synthesis`);
      await updateScanEngineStatus(engineJobId, 'complete');
      await checkAndTriggerReview(scanId, userId, userEmail);
      return new Response('No queries to synthesize', { status: 200 });
    }

    // Build the synthesis prompt
    const systemPrompt = buildSynthesizerPrompt({
      engineName,
      conceptName: scan.concept_name,
      conceptType: scan.concept_type,
      conceptCategory: scan.concept_category ?? '',
      queriesCount: completedQueries.length,
    });

    const queryData = formatQueriesForSynthesis(completedQueries);

    // Call Gemini to synthesize with retry (transient 502/503 + JSON parse failures)
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    type SynthesisResult = EngineSynthesis & { per_query_scores?: Array<{
      query_id: string; mentioned: boolean; mention_position: number | null;
      sentiment: string; sentiment_score: number;
      recommendation_strength: string; context_type: string;
    }> };

    let synthesis: SynthesisResult = undefined as any;
    let lastResult: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ role: 'user', parts: [{ text: queryData }] }],
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 65536,
            temperature: 0.3 + attempt * 0.05,
            responseMimeType: 'application/json',
          },
        });
        lastResult = result;
        const responseText = result.text ?? '';

        // Parse with repairJson fallback
        try {
          synthesis = JSON.parse(responseText);
        } catch {
          try {
            synthesis = JSON.parse(repairJson(responseText));
          } catch {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
              synthesis = JSON.parse(repairJson(match[0]));
            } else {
              throw new Error('Failed to parse synthesis response as JSON');
            }
          }
        }
        break; // success
      } catch (retryErr: any) {
        console.warn(`Synthesis attempt ${attempt + 1}/3 failed for ${engineId}:`, retryErr.message);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        throw retryErr; // final attempt — rethrow
      }
    }

    // Track token usage
    const synthTokens = extractGeminiTokens(lastResult ?? {});
    if (scan.user_id) {
      trackTokens(scan.user_id, 'aio-optimization:pipeline', 'gemini', 'gemini-3.1-pro-preview', synthTokens.inputTokens, synthTokens.outputTokens, synthTokens.totalTokens);
    }

    // Ensure required fields
    synthesis.engine_id = engineId;
    synthesis.engine_name = engineName;
    synthesis.queries_total = queries.length;
    synthesis.queries_completed = completedQueries.filter(q => q.status === 'complete').length;
    synthesis.queries_failed = completedQueries.filter(q => q.status === 'error').length;

    // Update per-query scores in the DB if the synthesizer provided them
    if (synthesis.per_query_scores?.length) {
      for (const score of synthesis.per_query_scores) {
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
    }

    // Remove per_query_scores before saving (too large for the synthesis column)
    const { per_query_scores: _, ...synthesisData } = synthesis;

    // Save synthesis
    await saveScanEngineSynthesis(engineJobId, synthesisData as EngineSynthesis);

    log.info('synthesis.complete', { function_name: 'synthesize-engine-background', user_id: userId || scan.user_id, user_email: userEmail || scan.user_email, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, ai_provider: 'gemini', ai_model: 'gemini-3.1-pro-preview', duration_ms: Date.now() - startTime, ai_input_tokens: synthTokens.inputTokens, ai_output_tokens: synthTokens.outputTokens, ai_total_tokens: synthTokens.totalTokens, meta: { engine_id: engineId, ai_sov: synthesis.ai_sov } });
    console.log(`Synthesis complete for ${engineName}: AI-SOV=${synthesis.ai_sov}%, RSI=${synthesis.recommendation_strength_index}`);

    // Check if all engines are done and trigger review
    await checkAndTriggerReview(scanId, userId, userEmail);

  } catch (err) {
    console.error(`synthesize-engine-background error (${engineJobId}):`, err);
    log.error('synthesis.error', { function_name: 'synthesize-engine-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, error: err, error_category: 'gemini_api', duration_ms: Date.now() - startTime });
    await updateScanEngineStatus(engineJobId, 'error', `Synthesis failed: ${err}`);
  }

  return new Response('Accepted', { status: 202 });
};

// Background function: Netlify v2 detects this from the `-background` filename suffix.

// ── Helpers ──────────────────────────────────────────────────────────────────

async function checkAndTriggerReview(scanId: string, userId?: string, userEmail?: string | null) {
  const allSynthesized = await areAllEnginesSynthesized(scanId);
  if (!allSynthesized) return;

  // ATOMIC: only the first synthesis to flip synthesizing→reviewing wins (prevents duplicate review tasks)
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
    payload: { userId: userId || null, userEmail: userEmail || null, scanConfig: {} },
  });

  // Immediately notify task-worker (fire-and-forget — poller is backup)
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  fetch(`${siteUrl}/.netlify/functions/task-worker`, { method: 'POST' }).catch(() => {});
}