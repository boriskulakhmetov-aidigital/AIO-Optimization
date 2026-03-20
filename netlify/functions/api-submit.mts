/**
 * POST /api/v1/submit
 * Submit a new AIO optimization scan via API key.
 *
 * Headers: X-API-Key: aidl_xxx
 * Body: { concept_name, concept_type, concept_category, concept_context?, query_count?, engines?, instructions? }
 * Returns: { job_id, status: 'pending' }
 */
import { createClient } from '@supabase/supabase-js';
import { validateApiKey, logApiRequest, apiKeyErrorResponse } from '@boriskulakhmetov-aidigital/design-system/server';

const APP_NAME = 'aio-optimization';

const DEFAULT_ENGINES = ['chatgpt_free', 'gemini_free', 'claude_free', 'perplexity', 'copilot'];

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export default async (req: Request) => {
  const start = Date.now();

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabase = getSupabase();

  // Validate API key
  const auth = await validateApiKey(req, APP_NAME, supabase as any);
  if (!auth.valid) {
    return apiKeyErrorResponse(auth);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    concept_name,
    concept_type,
    concept_category,
    concept_context,
    query_count,
    engines,
    instructions,
  } = body as {
    concept_name?: string;
    concept_type?: string;
    concept_category?: string;
    concept_context?: string;
    query_count?: number;
    engines?: string[];
    instructions?: string;
  };

  if (!concept_name) {
    return Response.json({ error: 'concept_name is required' }, { status: 400 });
  }
  if (!concept_type || !['product', 'offering', 'concept'].includes(concept_type)) {
    return Response.json({ error: 'concept_type is required (product | offering | concept)' }, { status: 400 });
  }
  if (!concept_category) {
    return Response.json({ error: 'concept_category is required' }, { status: 400 });
  }

  const scanId = crypto.randomUUID();
  const jobId = scanId; // AIO uses scanId as jobId

  const selectedEngines = engines || DEFAULT_ENGINES;
  const clampedQueryCount = Math.max(20, Math.min(80, query_count || 50));

  const scanConfig = {
    concept_type,
    concept_name,
    concept_category,
    ...(concept_context && { concept_context }),
    ...(instructions && { concept_context: (concept_context || '') + (concept_context ? '\n' : '') + instructions }),
    engines: selectedEngines,
    query_count: clampedQueryCount,
  };

  // Create job_status
  await supabase.from('job_status').upsert({
    id: jobId,
    app: APP_NAME,
    status: 'pending',
    meta: { scan_id: scanId, source: 'api', key_id: auth.keyId },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Dispatch the full pipeline (generate queries → scan engines) to a background function.
  // The pipeline takes 10-60s for query generation alone, way beyond the 26s function timeout.
  const siteUrl = process.env.URL || new URL(req.url).origin;
  const apiKey = req.headers.get('X-API-Key') || '';

  try {
    await fetch(`${siteUrl}/.netlify/functions/dispatch-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        scanId,
        jobId,
        config: scanConfig,
        generateQueries: true,
        queryParams: {
          concept_type,
          concept_name,
          concept_category,
          concept_context: concept_context || '',
          engines: selectedEngines,
          query_count: clampedQueryCount,
        },
        messages: [],
      }),
    });
  } catch { /* Non-fatal — background function handles its own errors */ }

  // Log the API request
  await logApiRequest(supabase as any, {
    keyId: auth.keyId!,
    app: APP_NAME,
    endpoint: 'submit',
    statusCode: 202,
    durationMs: Date.now() - start,
  });

  return Response.json(
    { job_id: jobId, scan_id: scanId, status: 'pending' },
    { status: 202 },
  );
};
