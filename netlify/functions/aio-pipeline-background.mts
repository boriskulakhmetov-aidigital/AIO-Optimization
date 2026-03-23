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
import { log } from './_shared/logger.js';
import type { GeneratedQuery } from './_shared/types.js';

const APP_NAME = 'aio-optimization';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  const body = await req.json();
  const { scanId, scanConfig, selectedEngines, queryCount } = body;
  const apiKey = req.headers.get('X-API-Key') || '';
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

    // Update status
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'dispatching', query_count: queries?.length },
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);

    // Step 2: Dispatch scan with pre-generated queries
    const dispatchResp = await fetch(`${siteUrl}/.netlify/functions/dispatch-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        scanId,
        config: scanConfig,
        queries,
        messages: [],
      }),
    });

    if (!dispatchResp.ok) {
      const errText = await dispatchResp.text().catch(() => 'Unknown error');
      await supabase.from('job_status').update({
        status: 'error',
        error: `Failed to dispatch scan: ${dispatchResp.status} ${errText.slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      }).eq('id', scanId);
      return;
    }

    log.info('aio-pipeline.dispatched', {
      function_name: 'aio-pipeline-background',
      entity_type: 'scan',
      entity_id: scanId,
      meta: { query_count: queries?.length, engines: selectedEngines },
    });

    // Scan is now running — engine workers will update progress via scan_engines table
    // The review-background function will set job_status to 'complete' when done
    await supabase.from('job_status').update({
      status: 'streaming',
      meta: { scan_id: scanId, phase: 'scanning', query_count: queries?.length, engines: selectedEngines },
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
