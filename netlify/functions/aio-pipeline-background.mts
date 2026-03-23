/**
 * Background function: AIO scan pipeline
 *
 * Handles the full flow that was previously done synchronously in api-submit:
 * 1. Generate queries via Gemini
 * 2. Dispatch scan with pre-generated queries
 *
 * Runs as a Netlify Background Function (15-min timeout).
 *
 * Access control: validated at API key level in api-submit.mts
 * No enforceAccess needed — this function is only called internally
 */
import { createClient } from '@supabase/supabase-js';
import { log } from './_shared/logger.js';

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

    // Step 1: Generate queries via Gemini
    const queryResp = await fetch(`${siteUrl}/.netlify/functions/generate-queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        concept_type: scanConfig.concept_type,
        concept_name: scanConfig.concept_name,
        concept_category: scanConfig.concept_category,
        concept_context: scanConfig.concept_context || '',
        engines: selectedEngines,
        query_count: queryCount,
      }),
    });

    if (!queryResp.ok) {
      const errText = await queryResp.text().catch(() => 'Unknown error');
      await supabase.from('job_status').update({
        status: 'error',
        error: `Failed to generate queries: ${queryResp.status} ${errText.slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      }).eq('id', scanId);
      return;
    }

    const { queries } = await queryResp.json();

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
