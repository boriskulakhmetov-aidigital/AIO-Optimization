/**
 * POST /.netlify/functions/embed-submit
 * Submit a new AIO optimization scan via embed token.
 * Replaces direct calls to generate-queries + dispatch-scan from EmbedPage.
 *
 * Headers: X-Embed-Token: <token>
 * Body: { scanId, config: { concept_type, concept_name, concept_category, concept_context?, engines, query_count }, messages }
 * Returns: { job_id, status: 'pending' }
 */
import { createClient } from '@supabase/supabase-js';
import { getAppUrl } from '@AiDigital-com/design-system/utils';

const APP_NAME = 'aio-optimization';
const DEFAULT_ENGINES = ['gemini_free', 'gemini_pro', 'google_sge', 'chatgpt_free', 'chatgpt_pro'];

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabase = getSupabase();

  // Validate embed token
  const embedToken = req.headers.get('X-Embed-Token');
  if (!embedToken) {
    return Response.json({ error: 'Missing embed token' }, { status: 401 });
  }

  const { data: tokenData } = await supabase.rpc('validate_embed_token', {
    p_token: embedToken,
    p_app: APP_NAME,
    p_origin: req.headers.get('Origin') || null,
  });
  if (!tokenData?.valid) {
    return Response.json({ error: tokenData?.reason || 'Invalid embed token' }, { status: 401 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scanId, config, messages } = body as {
    scanId: string;
    config: {
      concept_type: string;
      concept_name: string;
      concept_category: string;
      concept_context?: string;
      engines: string[];
      query_count: number;
    };
    messages?: Array<{ role: string; content: string }>;
  };

  if (!scanId || !config?.concept_name) {
    return Response.json({ error: 'scanId and config.concept_name are required' }, { status: 400 });
  }

  const selectedEngines = config.engines || DEFAULT_ENGINES;
  const clampedQueryCount = Math.max(20, Math.min(80, config.query_count || 50));

  const scanConfig = {
    concept_type: config.concept_type,
    concept_name: config.concept_name,
    concept_category: config.concept_category,
    ...(config.concept_context && { concept_context: config.concept_context }),
    engines: selectedEngines,
    query_count: clampedQueryCount,
  };

  // Create job_status
  await supabase.from('job_status').upsert({
    id: scanId,
    app: APP_NAME,
    status: 'pending',
    meta: { scan_id: scanId, source: 'embed' },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Write pipeline task (generate_queries — same as api-submit)
  const { error: taskError } = await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    app: APP_NAME,
    task_type: 'generate_queries',
    payload: {
      scanId,
      scanConfig,
      selectedEngines,
      queryCount: clampedQueryCount,
      userId: 'embed:anonymous',
    },
  });

  if (taskError) {
    console.error('[embed-submit] Failed to enqueue task:', taskError);
    await supabase.from('job_status').update({
      status: 'error',
      error: 'Failed to enqueue scan pipeline task.',
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
    return Response.json({ error: 'Failed to enqueue task' }, { status: 500 });
  }

  // Immediately notify task-worker (fire-and-forget — poller is backup)
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  fetch(`${siteUrl}/.netlify/functions/task-worker`, { method: 'POST' }).catch(() => {});

  console.log(`[embed-submit] Task enqueued: generate_queries for scan ${scanId}`);

  return Response.json({ job_id: scanId, scan_id: scanId, status: 'pending' }, { status: 202 });
};
