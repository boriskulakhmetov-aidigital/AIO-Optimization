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
import { createClient } from '@supabase/supabase-js';
import { createLLMProvider } from '@AiDigital-com/design-system/server';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
} from './_shared/supabase.js';
import { getEngine } from './_shared/engineRegistry.js';
import { log } from './_shared/logger.js';
import { trackTokens } from './_shared/access.js';
import { getAppUrl } from '@AiDigital-com/design-system/utils';
import type { GeneratedQuery, EngineId } from './_shared/types.js';
import { QUERY_COUNT_MIN, QUERY_COUNT_MAX, QUERY_COUNT_DEFAULT } from './_shared/constants.js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Streaming function — returns heartbeats to keep alive past 26s.
 * Synthesis and review tasks need 30-120s (Gemini Pro calls).
 */
export default async (req: Request) => {
  // EMERGENCY: Return no-op if called by webhook (X-Task-Id header from pg_net)
  // This breaks the webhook→task-worker→re-enqueue→webhook feedback loop
  const isWebhook = req.headers.get('x-task-id') || req.headers.get('x-webhook');
  if (isWebhook) {
    return Response.json({ status: 'idle', message: 'Webhook calls disabled — use poller only' });
  }

  const supabase = getSupabase();

  // Reset stale tasks: if a task has been 'running' for > 5 min, it crashed — reset to pending
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase.from('pipeline_tasks')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('updated_at', staleThreshold)
    .eq('app', 'aio-optimization');

  // Claim one pending task atomically
  const { data: tasks, error } = await supabase.rpc('claim_task', { p_app: 'aio-optimization' });
  if (error || !tasks?.length) {
    return Response.json({ status: 'idle', message: 'No pending tasks' });
  }

  const task = tasks[0];
  const { id: taskId, scan_id: scanId, task_type: taskType, payload } = task;
  console.log(`[task-worker] Claimed task ${taskId}: ${taskType} for scan ${scanId}`);

  // Quick tasks: dispatch to background functions or create records — return JSON
  const quickTasks = ['dispatch_engines', 'synthesize_engine', 'review'];
  if (quickTasks.includes(taskType)) {
    try {
      await executeTask(supabase, task);
      await supabase.from('pipeline_tasks').update({
        status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', taskId);
      return Response.json({ status: 'ok', taskType, scanId });
    } catch (err: any) {
      await handleTaskError(supabase, task, err);
      return Response.json({ status: 'error', taskType, error: err.message });
    }
  }

  // For long tasks (generate, synthesize, review), use streaming to stay alive
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (msg: string) => { try { controller.enqueue(encoder.encode(`data: ${msg}\n\n`)); } catch {} };
      const heartbeat = setInterval(() => send('heartbeat'), 10_000);

      try {
        send(`running ${taskType}`);
        await executeTask(supabase, task);
        await supabase.from('pipeline_tasks').update({
          status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', taskId);
        send(`done ${taskType}`);
      } catch (err: any) {
        send(`error ${err.message}`);
        await handleTaskError(supabase, task, err);
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

async function executeTask(supabase: any, task: any) {
  const { scan_id: scanId, task_type: taskType, payload } = task;
  switch (taskType) {
    case 'generate_queries': return handleGenerateQueries(supabase, scanId, payload);
    case 'dispatch_engines': return handleDispatchEngines(supabase, scanId, payload);
    case 'synthesize_engine': return dispatchToBackground(scanId, payload, 'synthesize-engine-background');
    case 'review': return dispatchToBackground(scanId, payload, 'review-background');
    case 'run_auto_eval': {
      const { executeAutoEval } = await import('@AiDigital-com/design-system/learning');
      const { createLLMProvider } = await import('@AiDigital-com/design-system/server');
      const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'analysis');
      const result = await executeAutoEval(supabase, llm, { apiKey: process.env.GEMINI_API_KEY! }, payload);
      if (!result.success) throw new Error(result.error || 'Auto-eval failed');
      return;
    }
    default: throw new Error(`Unknown task type: ${taskType}`);
  }
}

async function handleTaskError(supabase: any, task: any, err: any) {
  const { id: taskId, scan_id: scanId, task_type: taskType } = task;
  console.error(`[task-worker] Task ${taskId} (${taskType}) failed:`, err.message);

  const willRetry = task.attempts < task.max_attempts;
  await supabase.from('pipeline_tasks').update({
    status: willRetry ? 'pending' : 'failed',
    error: err.message?.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  if (!willRetry) {
    await writeJobStatus(scanId, {
      status: 'error',
      error: `Task ${taskType} failed after ${task.max_attempts} attempts: ${err.message?.slice(0, 200)}`,
    });
    log.error('task-worker.exhausted', {
      function_name: 'task-worker', entity_id: scanId,
      user_id: task.payload?.userId, user_email: task.payload?.userEmail,
      message: err.message, meta: { taskType, taskId, attempts: task.attempts },
    });
  }
}

// ── Dispatch to background functions (long Gemini calls need >26s) ────────────

async function dispatchToBackground(scanId: string, payload: any, functionName: string) {
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  const body: Record<string, unknown> = { scanId, userId: payload.userId, userEmail: payload.userEmail || null };

  // synthesize-engine-background needs engineJobId
  if (payload.engineJobId) body.engineJobId = payload.engineJobId;

  const res = await fetch(`${siteUrl}/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 202) {
    throw new Error(`Failed to dispatch ${functionName}: ${res.status}`);
  }
  console.log(`[task-worker] Dispatched ${functionName} for scan ${scanId}: ${res.status}`);
}

// ── Task Handlers ─────────────────────────────────────────────────────────────

async function handleGenerateQueries(supabase: any, scanId: string, payload: any) {
  const { scanConfig, queryCount, userId, userEmail } = payload;

  await writeJobStatus(scanId, { status: 'streaming', meta: { scan_id: scanId, phase: 'generating_queries' } });

  const clampedCount = Math.max(QUERY_COUNT_MIN, Math.min(QUERY_COUNT_MAX, queryCount || QUERY_COUNT_DEFAULT));
  const prompt = buildQueryGeneratorPrompt({
    conceptType: scanConfig.concept_type,
    conceptName: scanConfig.concept_name,
    conceptCategory: scanConfig.concept_category,
    conceptContext: scanConfig.concept_context || '',
    queryCount: clampedCount,
  });

  const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'fast');
  let queries: GeneratedQuery[] = [];
  let lastError = '';
  const startTime = Date.now();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { text, usage } = await Promise.race([
        llm.generateContent({
          system: 'Generate search queries as a JSON array.',
          userParts: [{ text: prompt }],
          maxTokens: 4096,
          jsonMode: true,
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                intent_type: { type: 'string' },
                intent_subtype: { type: 'string' },
              },
              required: ['text', 'intent_type'],
            },
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('generateContent timed out after 60s')), 60_000)),
      ]);

      console.log(`[generate-queries] Attempt ${attempt + 1}: ${text.length} chars, ${usage.totalTokens} tokens (thinking: ${usage.thinkingTokens || 0})`);

      // Track tokens
      trackTokens(userId, 'aio-optimization:query-gen', llm.provider, llm.model,
        usage.inputTokens, usage.outputTokens, usage.totalTokens);

      let responseText = text;
      // Strip markdown fences
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
          else throw new Error('not array');
        }
      } catch {
        const match = responseText.match(/\[[\s\S]*\]/);
        if (match) {
          try { queries = JSON.parse(match[0]); } catch { lastError = 'Failed to parse extracted array'; continue; }
        } else { lastError = 'No JSON array found in response'; continue; }
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
    function_name: 'task-worker', entity_id: scanId, user_id: userId, user_email: userEmail,
    meta: { query_count: queries.length },
  });

  // Enqueue next task: dispatch engines
  await supabase.from('pipeline_tasks').insert({
    app: 'aio-optimization',
    scan_id: scanId,
    task_type: 'dispatch_engines',
    payload: { ...payload, queries },
  });

  // Immediately notify task-worker (fire-and-forget — poller is backup)
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  fetch(`${siteUrl}/.netlify/functions/task-worker`, { method: 'POST' }).catch(() => {});
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
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  await Promise.all(availableEngines.map(async (engineId) => {
    try {
      await fetch(`${siteUrl}/.netlify/functions/scan-engine-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId, engineId, engineJobId: engineJobIds[engineId],
          conceptName: scanConfig.concept_name, conceptType: scanConfig.concept_type,
          conceptCategory: scanConfig.concept_category, conceptContext: scanConfig.concept_context,
          userId, userEmail,
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

  // No check_engines_done task needed — scan-engine-background creates
  // synthesize_engine tasks when the last engine completes (event-driven).

  log.info('task-worker.dispatched', {
    function_name: 'task-worker', entity_id: scanId, user_id: userId, user_email: userEmail,
    meta: { engines: availableEngines, query_count: queries.length },
  });
}

// synthesize_engine and review tasks are dispatched to background functions
// via dispatchToBackground() — see executeTask(). The actual logic lives in
// synthesize-engine-background.mts and review-background.mts.
