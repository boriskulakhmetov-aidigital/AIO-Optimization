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
  getScanEngine, getScanById, getQueriesForEngine,
  updateQueryResult, saveScanEngineSynthesis, updateScanEngineStatus,
} from './_shared/supabase.js';
import { getEngine, getEngineName } from './_shared/engineRegistry.js';
import { log } from './_shared/logger.js';
import { extractGeminiTokens } from '@boriskulakhmetov-aidigital/design-system/utils';
import { repairJson } from './_shared/repairJson.js';
import { trackTokens } from './_shared/access.js';
import type { GeneratedQuery, EngineId, EngineSynthesis } from './_shared/types.js';

const APP_NAME = 'aio-optimization';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  const body = await req.json();
  const { scanId, scanConfig, selectedEngines, queryCount, userId, userEmail } = body;
  const siteUrl = process.env.URL || 'http://localhost:8888';
  const supabase = getSupabase();

  log.info('aio-pipeline.start', {
    function_name: 'aio-pipeline-background',
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
    const clampedCount = Math.max(20, Math.min(80, queryCount || 50));
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
        // 30s timeout — Gemini sometimes hangs on generateContent
        const result = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              maxOutputTokens: 4096,
              temperature: 0.9 + attempt * 0.05,
              responseMimeType: 'application/json',
            },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini timed out after 30s')), 30_000)),
        ]);
        });

        let responseText = result.text ?? '';
        // Strip markdown fences + preamble/postamble text around JSON array
        responseText = responseText.replace(/^```(?:json)?\s*\n?/gim, '').replace(/\n?```\s*$/gim, '').trim();
        const firstBracket = responseText.indexOf('[');
        if (firstBracket > 0 && firstBracket < 200) responseText = responseText.slice(firstBracket);
        const lastBracket = responseText.lastIndexOf(']');
        if (lastBracket > 0 && lastBracket < responseText.length - 1) responseText = responseText.slice(0, lastBracket + 1);
        try {
          queries = JSON.parse(responseText);
          if (!Array.isArray(queries)) {
            if (queries && Array.isArray((queries as any).queries)) queries = (queries as any).queries;
            else if (queries && Array.isArray((queries as any).data)) queries = (queries as any).data;
            else throw new Error('Response is not an array');
          }
        } catch {
          const match = responseText.match(/\[[\s\S]*\]/);
          if (match) {
            try { queries = JSON.parse(match[0]); } catch { lastError = 'Failed to parse extracted array'; continue; }
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
      function_name: 'aio-pipeline-background',
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
          function_name: 'aio-pipeline-background',
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
      function_name: 'aio-pipeline-background',
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
        const synthResult = await gemini.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ role: 'user', parts: [{ text: queryData }] }],
          config: { systemInstruction: systemPrompt, maxOutputTokens: 65536, temperature: 0.3, responseMimeType: 'application/json' },
        });

        const responseText = synthResult.text ?? '';
        const synthTokens = extractGeminiTokens(synthResult);
        if (userId) trackTokens(userId, 'aio-optimization', 'gemini', 'gemini-3.1-pro-preview', synthTokens.inputTokens, synthTokens.outputTokens, synthTokens.totalTokens).catch(() => {});

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

        log.info('synthesis.complete', { function_name: 'aio-pipeline-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, meta: { engine_id: engineId, ai_sov: synthesis.ai_sov } });
        console.log(`[pipeline] Synthesis complete for ${engineName}: AI-SOV=${synthesis.ai_sov}%`);
      } catch (err) {
        console.error(`[pipeline] Synthesis failed for ${engineId}:`, err);
        log.error('synthesis.error', { function_name: 'aio-pipeline-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: engineJobId, correlation_id: scanId, message: err instanceof Error ? err.message : String(err), meta: { engine_id: engineId } });
        await updateScanEngineStatus(engineJobId, 'error', `Synthesis failed: ${err}`);
      }
    }));

    // 3c. Trigger review
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'reviewing' },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
    await updateScanStatus(scanId, 'reviewing');

    const reviewId = `${scanId}_review`;
    await supabase.from('scan_review').upsert({ id: reviewId, scan_id: scanId, status: 'pending' });

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`${siteUrl}/.netlify/functions/review-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanId, userId, userEmail }),
        });
        console.log(`[pipeline] Review trigger attempt ${attempt}: ${resp.status}`);
        if (resp.status === 202 || resp.ok) break;
      } catch (err) {
        console.warn(`[pipeline] Review trigger attempt ${attempt} failed:`, err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }

    log.info('aio-pipeline.review_triggered', {
      function_name: 'aio-pipeline-background',
      user_id: userId,
      user_email: userEmail,
      entity_type: 'scan',
      entity_id: scanId,
    });

  } catch (err) {
    log.error('aio-pipeline.error', {
      function_name: 'aio-pipeline-background',
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
};
