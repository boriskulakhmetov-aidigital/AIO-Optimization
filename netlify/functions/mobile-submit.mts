/**
 * POST /.netlify/functions/mobile-submit
 * Submit a new AIO scan from the mobile lead-gen funnel.
 * No auth required — open access, email captured after results.
 *
 * Body: { scanId, brandName, orgName, productName? }
 * Returns: { scan_id, status: 'pending' }
 */
import { createClient } from '@supabase/supabase-js';
import { getAppUrl } from '@AiDigital-com/design-system/utils';

const APP_NAME = 'aio-optimization';
const ENGINES = ['gemini_free', 'gemini_pro', 'google_sge', 'chatgpt_free', 'chatgpt_pro'];
const QUERIES_PER_ENGINE = 10;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabase = getSupabase();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scanId, brandName, orgName, productName } = body as {
    scanId: string;
    brandName: string;
    orgName: string;
    productName?: string;
  };

  if (!scanId || !brandName || !orgName) {
    return Response.json({ error: 'scanId, brandName, and orgName are required' }, { status: 400 });
  }

  const scanConfig = {
    concept_type: 'brand',
    concept_name: brandName,
    concept_category: productName || brandName,
    concept_context: `Organization: ${orgName}. ${productName ? `Product: ${productName}.` : ''}`,
    engines: ENGINES,
    query_count: QUERIES_PER_ENGINE,
  };

  // Create job_status
  await supabase.from('job_status').upsert({
    id: scanId,
    app: APP_NAME,
    status: 'pending',
    meta: { scan_id: scanId, source: 'mobile' },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Write pipeline task
  const { error: taskError } = await supabase.from('pipeline_tasks').insert({
    scan_id: scanId,
    app: APP_NAME,
    task_type: 'generate_queries',
    payload: {
      scanId,
      scanConfig,
      selectedEngines: ENGINES,
      queryCount: QUERIES_PER_ENGINE,
      userId: 'mobile:anonymous',
    },
  });

  if (taskError) {
    console.error('[mobile-submit] Failed to enqueue task:', taskError);
    await supabase.from('job_status').update({
      status: 'error',
      error: 'Failed to start scan.',
      updated_at: new Date().toISOString(),
    }).eq('id', scanId);
    return Response.json({ error: 'Failed to start scan' }, { status: 500 });
  }

  // Fire task-worker
  const siteUrl = getAppUrl('aio-optimization', { serverUrl: process.env.URL });
  fetch(`${siteUrl}/.netlify/functions/task-worker`, { method: 'POST' }).catch(() => {});

  console.log(`[mobile-submit] Scan started: ${brandName} (${orgName}) → ${scanId}`);

  return Response.json({ scan_id: scanId, status: 'pending' }, { status: 202 });
};
