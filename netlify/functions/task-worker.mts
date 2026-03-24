/**
 * GET/POST /.netlify/functions/task-worker
 *
 * Claims one pending task from pipeline_tasks and executes it.
 * Called by a scheduled function (cron) or external poller every 5s.
 *
 * Each task type is a self-contained step that:
 * 1. Does its work (Gemini call, DB writes, etc.)
 * 2. Writes the next task(s) to the queue
 * 3. Updates job_status for Realtime progress tracking
 *
 * Task types:
 * - generate_queries: Generate search queries via Gemini Flash
 * - dispatch_engines: Create scan records + fire engine workers
 * - synthesize_engine: Run Gemini Pro synthesis for one engine
 * - review: Cross-engine review via Gemini Pro
 */
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import { buildSynthesizerPrompt, formatQueriesForSynthesis } from './_shared/synthesizerPrompt.js';
import { buildReviewerPrompt, formatSynthesesForReview } from './_shared/reviewerPrompt.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
  getScanById, getQueriesForEngine, getQueriesForScan,
  getScanEngines, updateQueryResult, saveScanEngineSynthesis, updateScanEngineStatus,
  saveScanReview, saveScanReportData,
} from './_shared/supabase.js';
import { getEngine, getEngineName } from './_shared/engineRegistry.js';
import { log } from './_shared/logger.js';
import { extractGeminiTokens } from '@boriskulakhmetov-aidigital/design-system/utils';
import { repairJson } from './_shared/repairJson.js';
import { trackTokens, trackUsage } from './_shared/access.js';
import type { GeneratedQuery, EngineId, EngineSynthesis, CrossEngineReview, AIOReportData, QueryLogEntry } from './_shared/types.js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  const supabase = getSupabase();

  // Claim one pending task atomically
  const { data: tasks, error } = await supabase.rpc('claim_task');
  if (error || !tasks?.length) {
    return Response.json({ status: 'idle', message: 'No pending tasks' });
  }

  const task = tasks[0];
  const { id: taskId, scan_id: scanId, task_type: taskType, payload } = task;
  console.log(`[task-worker] Claimed task ${taskId}: ${taskType} for scan ${scanId}`);

  try {
    switch (taskType) {
      case 'generate_queries':
        await handleGenerateQueries(supabase, scanId, payload);
        break;
      case 'dispatch_engines':
        await handleDispatchEngines(supabase, scanId, payload);
        break;
      case 'check_engines_done':
        await handleCheckEnginesDone(supabase, scanId, payload);
        break;
      case 'synthesize_engine':
        await handleSynthesizeEngine(supabase, scanId, payload);
        break;
      case 'check_synthesis_done':
        await handleCheckSynthesisDone(supabase, scanId, payload);
        break;
      case 'review':
        await handleReview(supabase, scanId, payload);
        break;
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }

    // Mark task complete
    await supabase.from('pipeline_tasks').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);

    return Response.json({ status: 'ok', taskType, scanId });

  } catch (err: any) {
    console.error(`[task-worker] Task ${taskId} (${taskType}) failed:`, err.message);

    // Mark task as error (will be retried if attempts < max_attempts)
    const willRetry = task.attempts < task.max_attempts;
    await supabase.from('pipeline_tasks').update({
      status: willRetry ? 'pending' : 'failed',
      error: err.message?.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);

    // If all retries exhausted, mark scan as error
    if (!willRetry) {
      await writeJobStatus(scanId, {
        status: 'error',
        error: `Task ${taskType} failed after ${task.max_attempts} attempts: ${err.message?.slice(0, 200)}`,
      });
      log.error('task-worker.exhausted', {
        function_name: 'task-worker',
        entity_id: scanId,
        message: err.message,
        meta: { taskType, taskId, attempts: task.attempts },
      });
    }

    return Response.json({ status: 'error', taskType, error: err.message });
  }
};

// ── Task Handlers ─────────────────────────────────────────────────────────────

async function handleGenerateQueries(supabase: any, scanId: string, payload: any) {
  const { scanConfig, queryCount, userId } = payload;

  await writeJobStatus(scanId, { status: 'streaming', meta: { scan_id: scanId, phase: 'generating_queries' } });

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
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 4096, temperature: 0.9 + attempt * 0.05, responseMimeType: 'application/json' },
      });
      const responseText = result.text ?? '';
      try {
        queries = JSON.parse(responseText);
        if (!Array.isArray(queries)) throw new Error('not array');
      } catch {
        const match = responseText.match(/\[[\s\S]*\]/);
        if (match) queries = JSON.parse(match[0]);
        else { lastError = 'Failed to parse'; continue; }
      }
      break;
    } catch (err: any) {
      lastError = err.message;
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }

  queries = queries.filter(q => q.text && q.intent_type).map(q => ({
    text: q.text.trim(), intent_type: q.intent_type, intent_subtype: q.intent_subtype,
  }));

  if (queries.length === 0) throw new Error(`Query generation failed: ${lastError}`);

  log.info('task-worker.queries_generated', {
    function_name: 'task-worker', entity_id: scanId, user_id: userId,
    meta: { query_count: queries.length },
  });

  // Enqueue next task: dispatch engines
  await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    task_type: 'dispatch_engines',
    payload: { ...payload, queries },
  });
}

async function handleDispatchEngines(supabase: any, scanId: string, payload: any) {
  const { scanConfig, selectedEngines, queries, userId, userEmail } = payload;

  await writeJobStatus(scanId, { status: 'streaming', meta: { scan_id: scanId, phase: 'dispatching' } });

  // Create scan record
  await createScan({
    id: scanId, userId: userId || 'api:pipeline', userEmail: userEmail || '',
    config: { ...scanConfig, query_count: queries.length }, messages: [],
  });

  // Filter engines with API keys
  const availableEngines = (selectedEngines as EngineId[]).filter(eid => {
    const eng = getEngine(eid);
    return !!process.env[eng.apiKeyEnvVar];
  });

  if (availableEngines.length === 0) throw new Error('No engines have API keys configured');

  // Create engine jobs + insert queries
  const engineJobIds: Record<string, string> = {};
  for (const engineId of availableEngines) {
    const engineJobId = `${scanId}_${engineId}`;
    engineJobIds[engineId] = engineJobId;
    await createScanEngine({ id: engineJobId, scanId, engineId, queriesTotal: queries.length });
    await bulkInsertQueries(queries.map((q: any, idx: number) => ({
      id: `${engineJobId}_q${idx}`, scanEngineId: engineJobId, scanId,
      queryText: q.text, intentType: q.intent_type, intentSubtype: q.intent_subtype,
    })));
  }

  await writeJobStatus(scanId, {
    status: 'scanning',
    partial_text: JSON.stringify({
      scan_id: scanId, status: 'scanning',
      engines: availableEngines.map(eid => ({ engine_id: eid, status: 'pending', queries_total: queries.length, queries_done: 0 })),
    }),
  });
  await updateScanStatus(scanId, 'scanning');

  // Fire engine workers (these work fine — triggered from a regular function)
  const siteUrl = process.env.URL || 'https://aio-optimization.apps.aidigitallabs.com';
  await Promise.all(availableEngines.map(async (engineId) => {
    try {
      await fetch(`${siteUrl}/.netlify/functions/scan-engine-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId, engineId, engineJobId: engineJobIds[engineId],
          conceptName: scanConfig.concept_name, conceptType: scanConfig.concept_type,
          conceptCategory: scanConfig.concept_category, conceptContext: scanConfig.concept_context,
          userId,
        }),
      });
    } catch (err) {
      console.warn(`[task-worker] Engine trigger failed for ${engineId}:`, err);
    }
  }));

  if (userId) await incrementUserScanCount(userId).catch(() => {});

  await writeJobStatus(scanId, {
    status: 'streaming',
    meta: { scan_id: scanId, phase: 'scanning', query_count: queries.length, engines: availableEngines },
  });

  // Enqueue a "wait_for_engines" check — the worker will poll until engines complete
  // then enqueue synthesis tasks
  await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    task_type: 'check_engines_done',
    payload: { availableEngines, engineJobIds, userId, scanConfig },
  });

  log.info('task-worker.dispatched', {
    function_name: 'task-worker', entity_id: scanId, user_id: userId,
    meta: { engines: availableEngines, query_count: queries.length },
  });
}

async function handleCheckEnginesDone(supabase: any, scanId: string, payload: any) {
  const { data: engines } = await supabase
    .from('scan_engines')
    .select('engine_id, status')
    .eq('scan_id', scanId);

  if (!engines) throw new Error('Failed to read scan_engines');

  const allDone = engines.every((e: any) => e.status === 'complete' || e.status === 'error');

  if (!allDone) {
    // Not done yet — re-enqueue this check (will run again in ~5s)
    // Mark current task as complete so a new pending one is created
    await supabase.from('pipeline_tasks').insert({
      scan_id: scanId,
      task_type: 'check_engines_done',
      payload,
    });
    return;
  }

  // All engines done — enqueue synthesis for each engine
  await writeJobStatus(scanId, { status: 'streaming', meta: { scan_id: scanId, phase: 'synthesizing' } });
  await updateScanStatus(scanId, 'synthesizing');

  const { availableEngines, engineJobIds, userId, scanConfig } = payload;
  for (const engineId of availableEngines) {
    await supabase.from('pipeline_tasks').insert({
      scan_id: scanId,
      task_type: 'synthesize_engine',
      payload: { engineId, engineJobId: engineJobIds[engineId], userId, scanConfig },
    });
  }

  // Also enqueue a check for when all syntheses are done
  await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    task_type: 'check_synthesis_done',
    payload: { userId, scanConfig },
  });
}

async function handleCheckSynthesisDone(supabase: any, scanId: string, payload: any) {
  const { data: engines } = await supabase
    .from('scan_engines')
    .select('engine_id, status, synthesis_data')
    .eq('scan_id', scanId);

  if (!engines) throw new Error('Failed to read scan_engines');

  const allSynthesized = engines.every((e: any) => e.synthesis_data != null || e.status === 'error');

  if (!allSynthesized) {
    // Not done yet — re-enqueue
    await supabase.from('pipeline_tasks').insert({
      scan_id: scanId,
      task_type: 'check_synthesis_done',
      payload,
    });
    return;
  }

  // All synthesized — enqueue review
  await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    task_type: 'review',
    payload,
  });
}

async function handleSynthesizeEngine(supabase: any, scanId: string, payload: any) {
  const { engineId, engineJobId, userId, scanConfig } = payload;
  const engineName = getEngineName(engineId);

  await updateScanEngineStatus(engineJobId, 'synthesizing');
  await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'synthesizing', engine_id: engineId } });

  const scan = await getScanById(scanId);
  const queries = await getQueriesForEngine(engineJobId);
  const completedQueries = queries.filter(q => q.status === 'complete' || q.status === 'error');

  if (completedQueries.length === 0) {
    await updateScanEngineStatus(engineJobId, 'complete');
    return;
  }

  const systemPrompt = buildSynthesizerPrompt({
    engineName,
    conceptName: scan?.concept_name || scanConfig?.concept_name,
    conceptType: scan?.concept_type || scanConfig?.concept_type,
    conceptCategory: scan?.concept_category || scanConfig?.concept_category || '',
    queriesCount: completedQueries.length,
  });

  const queryData = formatQueriesForSynthesis(completedQueries);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const result = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [{ role: 'user', parts: [{ text: queryData }] }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 16384, temperature: 0.3, responseMimeType: 'application/json' },
  });

  const responseText = result.text ?? '';
  const synthTokens = extractGeminiTokens(result);
  if (userId) trackTokens(userId, 'aio-optimization', 'gemini', 'gemini-3.1-pro-preview', synthTokens.inputTokens, synthTokens.outputTokens, synthTokens.totalTokens).catch(() => {});

  let synthesis: EngineSynthesis & { per_query_scores?: any[] };
  try {
    synthesis = JSON.parse(responseText);
  } catch {
    try { synthesis = JSON.parse(repairJson(responseText)); } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) synthesis = JSON.parse(repairJson(match[0]));
      else throw new Error('Failed to parse synthesis JSON');
    }
  }

  synthesis.engine_id = engineId;
  synthesis.engine_name = engineName;
  synthesis.queries_total = queries.length;
  synthesis.queries_completed = completedQueries.filter(q => q.status === 'complete').length;
  synthesis.queries_failed = completedQueries.filter(q => q.status === 'error').length;

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

  log.info('task-worker.synthesis_complete', {
    function_name: 'task-worker', entity_id: engineJobId, user_id: userId,
    meta: { engine_id: engineId, ai_sov: synthesis.ai_sov },
  });
}

async function handleReview(supabase: any, scanId: string, payload: any) {
  const { userId, scanConfig } = payload;

  await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'reviewing' } });
  await updateScanStatus(scanId, 'reviewing');

  const scan = await getScanById(scanId);
  const engines = await getScanEngines(scanId);
  const synthesizedEngines = engines.filter(e => e.synthesis_data);

  if (synthesizedEngines.length === 0) throw new Error('No engine syntheses available for review');

  const synthesesForReview = synthesizedEngines.map(e => ({
    engine_id: e.engine_id,
    engine_name: getEngineName(e.engine_id as EngineId),
    synthesis_data: e.synthesis_data,
  }));

  const reviewPrompt = buildReviewerPrompt({
    conceptName: scan?.concept_name || scanConfig?.concept_name,
    conceptType: scan?.concept_type || scanConfig?.concept_type,
    conceptCategory: scan?.concept_category || scanConfig?.concept_category || '',
    conceptContext: scan?.concept_context || scanConfig?.concept_context,
    engineCount: synthesizedEngines.length,
  });

  const synthesisInput = formatSynthesesForReview(synthesesForReview);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  let reviewText = '';
  let reviewResult: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ role: 'user', parts: [{ text: synthesisInput }] }],
        config: { systemInstruction: reviewPrompt, maxOutputTokens: 16384, temperature: 0.3, responseMimeType: 'application/json' },
      });
      reviewText = result.text ?? '';
      reviewResult = result;
      break;
    } catch (retryErr: any) {
      if (attempt < 2 && (retryErr.message?.includes('502') || retryErr.message?.includes('503'))) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw retryErr;
    }
  }

  const reviewTokens = extractGeminiTokens(reviewResult ?? {});
  if (userId) trackTokens(userId, 'aio-optimization', 'gemini', 'gemini-3.1-pro-preview', reviewTokens.inputTokens, reviewTokens.outputTokens, reviewTokens.totalTokens).catch(() => {});

  let review: CrossEngineReview;
  try {
    review = JSON.parse(reviewText);
  } catch {
    try { review = JSON.parse(repairJson(reviewText)); } catch {
      const match = reviewText.match(/\{[\s\S]*\}/);
      if (match) review = JSON.parse(repairJson(match[0]));
      else throw new Error('Failed to parse review JSON');
    }
  }

  await saveScanReview(scanId, review);

  // Build report data
  const allQueries = await getQueriesForScan(scanId);
  const queryLog: QueryLogEntry[] = allQueries.map(q => ({
    engine_id: q.engine_id as EngineId, query_text: q.query_text, intent_type: q.intent_type,
    mentioned: q.mentioned ?? false, rank: q.mention_position ?? null,
    sentiment: q.sentiment ?? null, response_excerpt: (q.response_text ?? '').slice(0, 300),
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
      concept_type: scan?.concept_type, concept_name: scan?.concept_name,
      concept_category: scan?.concept_category,
      engines_tested: synthesizedEngines.map(e => e.engine_id as EngineId),
      total_queries: engines.reduce((sum, e) => sum + (e.queries_total ?? 0), 0),
      scan_date: new Date().toISOString(),
      scan_duration_seconds: Math.round((Date.now() - new Date(scan?.created_at || Date.now()).getTime()) / 1000),
    },
    executive_summary: review.executive_summary,
    overall_kpis: {
      ai_sov: review.overall_ai_sov, first_position_rate: review.overall_first_position_rate,
      top3_rate: computeAvg('top3_rate'), net_sentiment: review.overall_net_sentiment,
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

  if (userId) await trackUsage(userId, 'aio-optimization').catch(() => {});

  log.info('task-worker.review_complete', {
    function_name: 'task-worker', entity_id: scanId, user_id: userId,
    meta: { ai_sov: review.overall_ai_sov, engines: synthesizedEngines.length },
  });
}
