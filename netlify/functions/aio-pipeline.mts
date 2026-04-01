/**
 * Background function: AIO scan pipeline
 *
 * Orchestrates the ENTIRE scan lifecycle inline (15-min timeout):
 * 1. Generate queries via Gemini
 * 2. Dispatch scan + fire engine workers
 * 3. Poll until all engines complete
 * 4. Run synthesis for each engine (inline Gemini call)
 * 5. Trigger review
 *
 * No inter-function triggers for synthesis — Netlify background functions
 * spawned from other background functions are unreliable (202 accepted but
 * silently dropped). Only engine scan workers + review are external.
 */
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import { buildSynthesizerPrompt, formatQueriesForSynthesis } from './_shared/synthesizerPrompt.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
  getScanEngine, getScanById, getQueriesForEngine, getQueriesForScan,
  getScanEngines, updateQueryResult, saveScanEngineSynthesis, updateScanEngineStatus,
  saveScanReview, saveScanReportData, supabase as supabaseGlobal,
} from './_shared/supabase.js';
import { getEngine, getEngineName } from './_shared/engineRegistry.js';
import { buildReviewerPrompt, formatSynthesesForReview } from './_shared/reviewerPrompt.js';
import { log } from './_shared/logger.js';
import { extractGeminiTokens } from '@AiDigital-com/design-system/utils';
import { repairJson } from './_shared/repairJson.js';
import { trackTokens } from './_shared/access.js';
import type { GeneratedQuery, EngineId, EngineSynthesis, CrossEngineReview, AIOReportData, QueryLogEntry } from './_shared/types.js';
import { QUERY_COUNT_MIN, QUERY_COUNT_MAX, QUERY_COUNT_DEFAULT } from './_shared/constants.js';

const APP_NAME = 'aio-optimization';

// Netlify Functions v2: declare as streaming function for extended timeout
export const config = { path: '/.netlify/functions/aio-pipeline' };

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Streaming function — stays alive by writing heartbeat data every 10s.
 * NOT a background function (those are unreliable on Netlify).
 * Netlify keeps streaming functions alive as long as data flows.
 */
export default async (req: Request) => {
  const body = await req.json();
  const { scanId, scanConfig, selectedEngines, queryCount, userId, userEmail } = body;
  const siteUrl = process.env.URL || 'http://localhost:8888';
  const supabase = getSupabase();

  // Return a streaming response — keeps the function alive
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (msg: string) => {
        try { controller.enqueue(encoder.encode(`data: ${msg}\n\n`)); } catch {}
      };

      // Heartbeat every 10s to keep connection alive
      const heartbeat = setInterval(() => send('heartbeat'), 10_000);

      try {
        await runPipeline({ scanId, scanConfig, selectedEngines, queryCount, userId, userEmail, siteUrl, supabase, send });
        send('done');
      } catch (err) {
        send(`error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
};

async function runPipeline({ scanId, scanConfig, selectedEngines, queryCount, userId, userEmail, siteUrl, supabase, send }: any) {
  log.info('aio-pipeline.start', {
    function_name: 'aio-pipeline',
    user_id: userId,
    user_email: userEmail,
    entity_type: 'scan',
    entity_id: scanId,
    ai_provider: 'gemini',
    ai_model: 'gemini-3-flash-preview',
    meta: { engines: selectedEngines, queryCount },
  });

  try {
    // Update status
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'generating_queries' },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);

    // Step 1: Generate queries via Gemini INLINE
    // (Previously called generate-queries as a separate function, which hit the
    //  26s Netlify function timeout on function-to-function calls. Now runs inline
    //  within the 15-min background function timeout.)
    const clampedCount = Math.max(QUERY_COUNT_MIN, Math.min(QUERY_COUNT_MAX, queryCount || QUERY_COUNT_DEFAULT));
    const prompt = buildQueryGeneratorPrompt({
      conceptType: scanConfig.concept_type,
      conceptName: scanConfig.concept_name,
      conceptCategory: scanConfig.concept_category,
      conceptContext: scanConfig.concept_context || '',
      queryCount: clampedCount,
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    let queries: GeneratedQuery[] = [];
    let lastError = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            maxOutputTokens: 4096,
            temperature: 0.9 + attempt * 0.05,
            responseMimeType: 'application/json',
          },
        });

        const responseText = result.text ?? '';
        try {
          queries = JSON.parse(responseText);
          if (!Array.isArray(queries)) throw new Error('Response is not an array');
        } catch {
          const match = responseText.match(/\[[\s\S]*\]/);
          if (match) {
            queries = JSON.parse(match[0]);
          } else {
            lastError = 'Failed to parse query generation response';
            continue;
          }
        }
        break;
      } catch (err: any) {
        lastError = err.message || String(err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Validate and clean queries
    queries = queries
      .filter(q => q.text && q.intent_type)
      .map(q => ({
        text: q.text.trim(),
        intent_type: q.intent_type,
        intent_subtype: q.intent_subtype,
      }));

    if (queries.length === 0) {
      await supabase.from('job_status').update({
        status: 'error',
        error: `Failed to generate queries: ${lastError || 'No valid queries after 3 attempts'}`,
        updated_at: new Date().toISOString(),
      }).eq('id', scanId);
      return;
    }

    log.info('aio-pipeline.queries_generated', {
      function_name: 'aio-pipeline',
      user_id: userId,
      user_email: userEmail,
      entity_type: 'scan',
      entity_id: scanId,
      meta: { query_count: queries?.length, engines: selectedEngines },
    });

    // Step 2: Dispatch scan INLINE (no function-to-function call)
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'dispatching', query_count: queries?.length },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);

    // 2a. Create scan record
    await createScan({
      id: scanId,
      userId: userId || `api:pipeline`,
      userEmail: userEmail || '',
      config: { ...scanConfig, query_count: queries.length },
      messages: [],
    });

    // 2b. Filter engines with configured API keys
    const availableEngines = (selectedEngines as EngineId[]).filter(eid => {
      const eng = getEngine(eid);
      return !!process.env[eng.apiKeyEnvVar];
    });

    if (availableEngines.length === 0) {
      await supabase.from('job_status').update({
        status: 'error',
        error: 'No engines have API keys configured',
        updated_at: new Date().toISOString(),
      }).eq('id', scanId);
      return;
    }

    // 2c. Create engine jobs + insert queries
    const engineJobIds: Record<string, string> = {};
    for (const engineId of availableEngines) {
      const engineJobId = `${scanId}_${engineId}`;
      engineJobIds[engineId] = engineJobId;

      await createScanEngine({
        id: engineJobId,
        scanId,
        engineId,
        queriesTotal: queries.length,
      });

      await bulkInsertQueries(queries.map((q, idx) => ({
        id: `${engineJobId}_q${idx}`,
        scanEngineId: engineJobId,
        scanId,
        queryText: q.text,
        intentType: q.intent_type,
        intentSubtype: q.intent_subtype,
      })));
    }

    // 2d. Write initial scanning status
    await writeJobStatus(scanId, {
      status: 'scanning',
      partial_text: JSON.stringify({
        scan_id: scanId,
        status: 'scanning',
        engines: availableEngines.map(eid => ({
          engine_id: eid, status: 'pending',
          queries_total: queries.length, queries_done: 0,
        })),
      }),
    });
    await updateScanStatus(scanId, 'scanning');

    // 2e. Fire background workers — one per engine
    // (These ARE fire-and-forget background functions that return 202 immediately)
    await Promise.all(availableEngines.map(async (engineId) => {
      try {
        await fetch(`${siteUrl}/.netlify/functions/scan-engine-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanId, engineId,
            engineJobId: engineJobIds[engineId],
            conceptName: scanConfig.concept_name,
            conceptType: scanConfig.concept_type,
            conceptCategory: scanConfig.concept_category,
            conceptContext: scanConfig.concept_context,
            userId: userId || null,
            userEmail: userEmail || null,
          }),
        });
      } catch (err) {
        log.warn('aio-pipeline.engine_trigger_failed', {
          function_name: 'aio-pipeline',
          user_id: userId,
          user_email: userEmail,
          message: err instanceof Error ? err.message : String(err),
          meta: { scanId, engineId },
        });
      }
    }));

    // 2f. Track usage
    if (userId) {
      await incrementUserScanCount(userId).catch(() => {});
    }

    log.info('aio-pipeline.dispatched', {
      function_name: 'aio-pipeline',
      user_id: userId,
      user_email: userEmail,
      entity_type: 'scan',
      entity_id: scanId,
      meta: { query_count: queries.length, engines: availableEngines, total_api_calls: queries.length * availableEngines.length },
    });

    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'scanning', query_count: queries.length, engines: availableEngines },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);

    // ── Step 3: Wait for all engines to complete, then trigger synthesis + review ──
    // Don't rely on engine workers to trigger synthesis (function-to-function is unreliable).
    // The pipeline has 15 min — poll scan_engines until all are done, then trigger next steps.
    const WAIT_TIMEOUT = 600_000; // 10 min max wait for scanning
    const waitStart = Date.now();
    while (Date.now() - waitStart < WAIT_TIMEOUT) {
      await new Promise(r => setTimeout(r, 5000));
      const { data: engines } = await supabase
        .from('scan_engines')
        .select('engine_id, status')
        .eq('scan_id', scanId);
      if (!engines) continue;
      const allDone = engines.every(e => e.status === 'complete' || e.status === 'error');
      if (allDone) break;
    }

    // 3a. Run synthesis INLINE for each engine (parallel Gemini calls)
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'synthesizing' },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
    await updateScanStatus(scanId, 'synthesizing');

    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const scan = await getScanById(scanId);

    await Promise.all(availableEngines.map(async (engineId) => {
      const engineJobId = engineJobIds[engineId];
      try {
        const engineName = getEngineName(engineId);
        await updateScanEngineStatus(engineJobId, 'synthesizing');
        await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'synthesizing', engine_id: engineId } });

        const engineQueries = await getQueriesForEngine(engineJobId);
        const completedQueries = engineQueries.filter(q => q.status === 'complete' || q.status === 'error');

        if (completedQueries.length === 0) {
          console.warn(`[pipeline] No completed queries for ${engineId}, skipping synthesis`);
          await updateScanEngineStatus(engineJobId, 'complete');
          return;
        }

        const systemPrompt = buildSynthesizerPrompt({
          engineName,
          conceptName: scan?.concept_name || scanConfig.concept_name,
          conceptType: scan?.concept_type || scanConfig.concept_type,
          conceptCategory: scan?.concept_category || scanConfig.concept_category || '',
          queriesCount: completedQueries.length,
        });

        const queryData = formatQueriesForSynthesis(completedQueries);
        const synthResult = await Promise.race([
          gemini.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ role: 'user', parts: [{ text: queryData }] }],
            config: { systemInstruction: systemPrompt, maxOutputTokens: 65536, temperature: 0.3, responseMimeType: 'application/json' },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Synthesis timed out for ${engineId}`)), 120_000)),
        ]);

        const responseText = synthResult.text ?? '';
        const synthTokens = extractGeminiTokens(synthResult);
        if (userId) trackTokens(userId, 'aio-optimization:synthesis', 'gemini', 'gemini-3.1-pro-preview', synthTokens.inputTokens, synthTokens.outputTokens, synthTokens.totalTokens).catch(() => {});

        // Parse with repairJson fallback
        let synthesis: EngineSynthesis & { per_query_scores?: any[] };
        try {
          synthesis = JSON.parse(responseText);
        } catch {
          try { synthesis = JSON.parse(repairJson(responseText)); } catch {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) { synthesis = JSON.parse(repairJson(match[0])); }
            else throw new Error('Failed to parse synthesis JSON');
          }
        }

        synthesis.engine_id = engineId;
        synthesis.engine_name = engineName;
        synthesis.queries_total = engineQueries.length;
        synthesis.queries_completed = completedQueries.filter(q => q.status === 'complete').length;
        synthesis.queries_failed = completedQueries.filter(q => q.status === 'error').length;

        // Update per-query scores
        if (synthesis.per_query_scores?.length) {
          for (const score of synthesis.per_query_scores) {
            await updateQueryResult(score.query_id, {
              status: 'complete', mentioned: score.mentioned, mentionPosition: score.mention_position,
              sentiment: score.sentiment, sentimentScore: score.sentiment_score,
              recommendationStrength: score.recommendation_strength, contextType: score.context_type,
            }).catch(() => {});
          }
        }

        const { per_query_scores: _, ...synthesisData } = synthesis;
        await saveScanEngineSynthesis(engineJobId, synthesisData as EngineSynthesis);

        log.info('synthesis.complete', { function_name: 'aio-pipeline', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, meta: { engine_id: engineId, ai_sov: synthesis.ai_sov } });
        console.log(`[pipeline] Synthesis complete for ${engineName}: AI-SOV=${synthesis.ai_sov}%`);
      } catch (err) {
        console.error(`[pipeline] Synthesis failed for ${engineId}:`, err);
        log.error('synthesis.error', { function_name: 'aio-pipeline', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, message: err instanceof Error ? err.message : String(err), meta: { engine_id: engineId } });
        await updateScanEngineStatus(engineJobId, 'error', `Synthesis failed: ${err}`);
      }
    }));

    // 3c. Run review INLINE (cross-engine synthesis)
    send('reviewing');
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'reviewing' },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
    await updateScanStatus(scanId, 'reviewing');

    const reviewId = `${scanId}_review`;
    await supabase.from('scan_review').upsert({ id: reviewId, scan_id: scanId, status: 'pending' });

    const allEngines = await getScanEngines(scanId);
    const synthesizedEngines = allEngines.filter(e => e.synthesis_data);

    if (synthesizedEngines.length > 0) {
      const synthesesForReview = synthesizedEngines.map(e => ({
        engine_id: e.engine_id,
        engine_name: getEngineName(e.engine_id as EngineId),
        synthesis_data: e.synthesis_data,
      }));

      const reviewSystemPrompt = buildReviewerPrompt({
        conceptName: scan?.concept_name || scanConfig.concept_name,
        conceptType: scan?.concept_type || scanConfig.concept_type,
        conceptCategory: scan?.concept_category || scanConfig.concept_category || '',
        conceptContext: scan?.concept_context || scanConfig.concept_context,
        engineCount: synthesizedEngines.length,
      });

      const synthesisInput = formatSynthesesForReview(synthesesForReview);

      let reviewText = '';
      let reviewResult: any = null;
      const REVIEW_TIMEOUT = 120_000; // 2 min max per attempt
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          send(`review attempt ${attempt + 1}`);
          const result = await Promise.race([
            gemini.models.generateContent({
              model: 'gemini-3.1-pro-preview',
              contents: [{ role: 'user', parts: [{ text: synthesisInput }] }],
              config: { systemInstruction: reviewSystemPrompt, maxOutputTokens: 65536, temperature: 0.3, responseMimeType: 'application/json' },
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Review Gemini call timed out after 2 min')), REVIEW_TIMEOUT)),
          ]);
          reviewText = result.text ?? '';
          reviewResult = result;
          break;
        } catch (retryErr: any) {
          console.warn(`[pipeline] Review attempt ${attempt} failed:`, retryErr.message);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
            continue;
          }
          throw retryErr;
        }
      }

      const reviewTokens = extractGeminiTokens(reviewResult ?? {});
      if (userId) trackTokens(userId, 'aio-optimization:review', 'gemini', 'gemini-3.1-pro-preview', reviewTokens.inputTokens, reviewTokens.outputTokens, reviewTokens.totalTokens).catch(() => {});

      let review: CrossEngineReview;
      try {
        review = JSON.parse(reviewText);
      } catch {
        try { review = JSON.parse(repairJson(reviewText)); } catch {
          const match = reviewText.match(/\{[\s\S]*\}/);
          if (match) { review = JSON.parse(repairJson(match[0])); }
          else throw new Error('Failed to parse review JSON');
        }
      }

      await saveScanReview(scanId, review);

      // Build query log + report data
      const allQueries = await getQueriesForScan(scanId);
      const queryLog: QueryLogEntry[] = allQueries.map(q => ({
        engine_id: q.engine_id as EngineId,
        query_text: q.query_text,
        intent_type: q.intent_type,
        mentioned: q.mentioned ?? false,
        rank: q.mention_position ?? null,
        sentiment: q.sentiment ?? null,
        response_excerpt: (q.response_text ?? '').slice(0, 300),
      }));

      const engineSyntheses: EngineSynthesis[] = synthesizedEngines.map(e => {
        const data = typeof e.synthesis_data === 'string' ? JSON.parse(e.synthesis_data) : e.synthesis_data;
        return data as EngineSynthesis;
      });

      const computeAvg = (field: string) => {
        const vals = engineSyntheses.map(e => (e as any)[field]).filter((v: any) => typeof v === 'number');
        return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
      };

      const reportData: AIOReportData = {
        schema_version: '2.0',
        meta: {
          concept_type: scan?.concept_type || scanConfig.concept_type,
          concept_name: scan?.concept_name || scanConfig.concept_name,
          concept_category: scan?.concept_category || scanConfig.concept_category,
          engines_tested: synthesizedEngines.map(e => e.engine_id as EngineId),
          total_queries: allEngines.reduce((sum, e) => sum + (e.queries_total ?? 0), 0),
          scan_date: new Date().toISOString(),
          scan_duration_seconds: Math.round((Date.now() - new Date(scan?.created_at || Date.now()).getTime()) / 1000),
        },
        executive_summary: review.executive_summary,
        overall_kpis: {
          ai_sov: review.overall_ai_sov,
          first_position_rate: review.overall_first_position_rate,
          top3_rate: computeAvg('top3_rate'),
          net_sentiment: review.overall_net_sentiment,
          rsi: computeAvg('recommendation_strength_index'),
          discovery_capture_rate: computeAvg('discovery_capture_rate'),
          competitive_win_rate: computeAvg('competitive_win_rate'),
          engine_consistency: review.engine_consistency,
        },
        engine_syntheses: engineSyntheses,
        cross_engine_review: review,
        query_log: queryLog,
      };

      await saveScanReportData(scanId, reportData);
      await writeJobStatus(scanId, { status: 'complete', completed_at: new Date().toISOString() });

      log.info('aio-pipeline.complete', {
        function_name: 'aio-pipeline',
        user_id: userId,
        user_email: userEmail,
        entity_type: 'scan',
        entity_id: scanId,
        meta: { ai_sov: review.overall_ai_sov, engines: synthesizedEngines.length },
      });
    } else {
      await writeJobStatus(scanId, { status: 'error', error: 'No engine syntheses available for review' });
    }

  } catch (err) {
    log.error('aio-pipeline.error', {
      function_name: 'aio-pipeline',
      user_id: userId,
      user_email: userEmail,
      message: err instanceof Error ? err.message : String(err),
      entity_type: 'scan',
      entity_id: scanId,
    });
    await supabase.from('job_status').update({
      status: 'error',
      error: `Pipeline error: ${err instanceof Error ? err.message : String(err)}`,
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
  }
}
