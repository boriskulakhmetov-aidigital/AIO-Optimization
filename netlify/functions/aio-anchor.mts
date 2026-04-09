/**
 * AIO Anchor — Phase 1 of the N-Lambda pipeline.
 *
 * 1. Generate search queries via Gemini Flash
 * 2. Create scan record + engine jobs + queries
 * 3. Fire scan-engine-background workers (one per engine)
 *
 * Replaces inline handleGenerateQueries + handleDispatchEngines from task-worker.
 */
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createLLMProvider } from '@AiDigital-com/design-system/server';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
} from './_shared/supabase.js';
import { getEngine } from './_shared/engineRegistry.js';
import { log } from './_shared/logger.js';
import type { GeneratedQuery, EngineId } from './_shared/types.js';
import { QUERY_COUNT_MIN, QUERY_COUNT_MAX, QUERY_COUNT_DEFAULT } from './_shared/constants.js';

export const config: Config = { background: true };

function repairJson(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*\n?/gim, '').replace(/\n?```\s*$/gim, '').trim();
  const first = s.indexOf('[');
  if (first > 0 && first < 200) s = s.slice(first);
  const last = s.lastIndexOf(']');
  if (last > 0 && last < s.length - 1) s = s.slice(0, last + 1);
  return s;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!process.env.GEMINI_API_KEY) return new Response('Missing GEMINI_API_KEY', { status: 500 });

  const taskId = req.headers.get('X-Task-Id');
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let body: any;
  if (taskId) {
    const { data: task } = await supabase.from('pipeline_tasks').select('payload').eq('id', taskId).single();
    if (!task?.payload) return new Response('Task not found', { status: 404 });
    body = task.payload;
    await supabase.from('pipeline_tasks').update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId);
  } else {
    body = await req.json();
  }

  const { jobId, intakeSummary, userId, userEmail } = body;
  const scanConfig = intakeSummary;
  const selectedEngines: EngineId[] = scanConfig.engines || [];
  const queryCount = scanConfig.query_count || QUERY_COUNT_DEFAULT;

  try {
    // ── Phase 1: Generate queries ──────────────────────────────────
    await writeJobStatus(jobId, { status: 'streaming', meta: { scan_id: jobId, phase: 'generating_queries' } });

    const clampedCount = Math.max(QUERY_COUNT_MIN, Math.min(QUERY_COUNT_MAX, queryCount));
    const prompt = buildQueryGeneratorPrompt({
      conceptType: scanConfig.concept_type,
      conceptName: scanConfig.concept_name,
      conceptCategory: scanConfig.concept_category,
      conceptContext: scanConfig.concept_context || '',
      queryCount: clampedCount,
    });

    const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'fast', { supabase });
    let queries: GeneratedQuery[] = [];
    let lastError = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { text } = await llm.generateContent({
          system: 'Generate search queries as a JSON array.',
          userParts: [{ text: prompt }],
          maxTokens: 4096, jsonMode: true,
          app: 'aio-optimization:query-gen', userId,
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' }, intent_type: { type: 'string' }, intent_subtype: { type: 'string' } },
              required: ['text', 'intent_type'],
            },
          },
        });

        const cleaned = repairJson(text);
        try {
          queries = JSON.parse(cleaned);
          if (!Array.isArray(queries)) {
            if (Array.isArray((queries as any).queries)) queries = (queries as any).queries;
            else throw new Error('not array');
          }
        } catch {
          const match = cleaned.match(/\[[\s\S]*\]/);
          if (match) queries = JSON.parse(match[0]);
          else { lastError = 'No JSON array found'; continue; }
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

    log.info('aio-anchor.queries', { function_name: 'aio-anchor', entity_id: jobId, user_id: userId, meta: { count: queries.length } });

    // ── Phase 2: Create scan + dispatch engines ────────────────────
    await writeJobStatus(jobId, { status: 'streaming', meta: { scan_id: jobId, phase: 'dispatching' } });

    await createScan({
      id: jobId, userId: userId || 'api:pipeline', userEmail: userEmail || '',
      config: { ...scanConfig, query_count: queries.length }, messages: [],
    });

    const availableEngines = selectedEngines.filter(eid => {
      const eng = getEngine(eid);
      return !!process.env[eng.apiKeyEnvVar];
    });
    if (availableEngines.length === 0) throw new Error('No engines have API keys configured');

    const engineJobIds: Record<string, string> = {};
    for (const engineId of availableEngines) {
      const engineJobId = `${jobId}_${engineId}`;
      engineJobIds[engineId] = engineJobId;
      await createScanEngine({ id: engineJobId, scanId: jobId, engineId, queriesTotal: queries.length });
      await bulkInsertQueries(queries.map((q, idx) => ({
        id: `${engineJobId}_q${idx}`, scanEngineId: engineJobId, scanId: jobId,
        queryText: q.text, intentType: q.intent_type, intentSubtype: q.intent_subtype,
      })));
    }

    await updateScanStatus(jobId, 'scanning');
    await writeJobStatus(jobId, {
      status: 'scanning',
      partial_text: JSON.stringify({
        scan_id: jobId, status: 'scanning',
        engines: availableEngines.map(eid => ({ engine_id: eid, status: 'pending', queries_total: queries.length, queries_done: 0 })),
      }),
    });

    // Fire engine workers
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
    await Promise.all(availableEngines.map(async (engineId) => {
      try {
        await fetch(`${siteUrl}/.netlify/functions/scan-engine-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanId: jobId, engineId, engineJobId: engineJobIds[engineId],
            conceptName: scanConfig.concept_name, conceptType: scanConfig.concept_type,
            conceptCategory: scanConfig.concept_category, conceptContext: scanConfig.concept_context,
            userId, userEmail,
          }),
        });
      } catch (err) {
        console.warn(`[aio-anchor] Engine trigger failed for ${engineId}:`, err);
      }
    }));

    if (userId) await incrementUserScanCount(userId).catch(() => {});

    log.info('aio-anchor.complete', {
      function_name: 'aio-anchor', entity_id: jobId, user_id: userId,
      meta: { engines: availableEngines, query_count: queries.length },
    });

    // Mark task complete
    if (taskId) {
      await supabase.from('pipeline_tasks').update({
        status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', taskId);
    }

  } catch (err) {
    console.error('[aio-anchor] Error:', err);
    await writeJobStatus(jobId, { status: 'error', error: String(err).slice(0, 500) });
    if (taskId) {
      await supabase.from('pipeline_tasks').update({
        status: 'failed', error: String(err).slice(0, 500), updated_at: new Date().toISOString(),
      }).eq('id', taskId);
    }
  }

  return new Response('Accepted', { status: 202 });
};
