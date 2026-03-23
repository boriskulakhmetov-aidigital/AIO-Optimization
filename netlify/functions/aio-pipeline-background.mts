/**
 * Background function: AIO scan pipeline
 *
 * Handles the full flow:
 * 1. Generate queries via Gemini (INLINE — not a function call, avoids 26s timeout)
 * 2. Dispatch scan with pre-generated queries
 *
 * Runs as a Netlify Background Function (15-min timeout).
 *
 * Access control: validated at API key level in api-submit.mts
 * No enforceAccess needed — this function is only called internally
 */
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
} from './_shared/supabase.js';
import { getEngine } from './_shared/engineRegistry.js';
import { log } from './_shared/logger.js';
import type { GeneratedQuery, EngineId } from './_shared/types.js';

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
    entity_type: 'scan',
    entity_id: scanId,
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
      function_name: 'aio-pipeline-background',
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
          }),
        });
      } catch (err) {
        log.warn('aio-pipeline.engine_trigger_failed', {
          function_name: 'aio-pipeline-background',
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
      entity_type: 'scan',
      entity_id: scanId,
      meta: { query_count: queries.length, engines: availableEngines, total_api_calls: queries.length * availableEngines.length },
    });

    // Scan is now running — engine workers update progress via scan_engines table (Realtime)
    // The review-background function sets job_status to 'complete' when all engines finish
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'scanning', query_count: queries.length, engines: availableEngines },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);

  } catch (err) {
    log.error('aio-pipeline.error', {
      function_name: 'aio-pipeline-background',
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
