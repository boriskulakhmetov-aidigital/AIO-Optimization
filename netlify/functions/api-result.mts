/**
 * GET /api/v1/result/:job_id
 * Get the completed AIO optimization report.
 *
 * Headers: X-API-Key: aidl_xxx
 * Query: ?format=both|markdown|visual (default: both)
 * Returns: Report data in requested format (markdown, visual/structured, or both)
 */
import { createClient } from '@supabase/supabase-js';
import { validateApiKey, logApiRequest, apiKeyErrorResponse } from '@boriskulakhmetov-aidigital/design-system/server';

const APP_NAME = 'aio-optimization';

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export default async (req: Request) => {
  const start = Date.now();

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabase = getSupabase();

  // Validate API key
  const auth = await validateApiKey(req, APP_NAME, supabase as any);
  if (!auth.valid) {
    return apiKeyErrorResponse(auth);
  }

  // Extract params
  const url = new URL(req.url);
  const jobId = url.searchParams.get('job_id');
  const format = url.searchParams.get('format') || 'both';

  if (!jobId) {
    return Response.json({ error: 'job_id is required' }, { status: 400 });
  }

  // Check job status first (also grab report from job_status as fallback)
  const { data: job } = await supabase
    .from('job_status')
    .select('id, status, meta, report')
    .eq('id', jobId)
    .eq('app', APP_NAME)
    .maybeSingle();

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'complete') {
    return Response.json(
      { error: 'Report not ready', status: job.status },
      { status: 202 },
    );
  }

  // AIO uses scanId = jobId (they are the same)
  const scanId = jobId;

  const { data: scan } = await supabase
    .from('scans')
    .select('id, concept_name, concept_type, concept_category, report_data, intake_summary, completed_at, share_token, is_public')
    .eq('id', scanId)
    .maybeSingle();

  if (!scan) {
    return Response.json({ error: 'Scan not found' }, { status: 404 });
  }

  // AIO stores report in scan_review table, not in scans.report
  const { data: review } = await supabase
    .from('scan_review')
    .select('review_data')
    .eq('scan_id', scanId)
    .maybeSingle();

  // Build markdown from review_data
  const reviewData = review?.review_data as Record<string, unknown> | null;
  const markdownReport = reviewData
    ? `# AIO Optimization Report: ${scan.concept_name}\n\n${reviewData.executive_summary || ''}\n\n${reviewData.biggest_gap || ''}`
    : '';
  const visualReport = scan.report_data || reviewData || null;

  // Auto-generate share link for API consumers
  let shareToken = scan.share_token;
  if (!shareToken) {
    shareToken = crypto.randomUUID();
    await supabase.from('scans')
      .update({ share_token: shareToken, is_public: true })
      .eq('id', scanId);
  } else if (!scan.is_public) {
    await supabase.from('scans')
      .update({ is_public: true })
      .eq('id', scanId);
  }

  // Get org theme slug for branded report URL
  let themeSlug = '';
  if (auth.orgId) {
    const { data: org } = await supabase.from('organizations')
      .select('theme_slug')
      .eq('id', auth.orgId)
      .single();
    themeSlug = org?.theme_slug || '';
  }

  const baseUrl = 'https://aio-optimization.apps.aidigitallabs.com';
  const reportUrl = `${baseUrl}/r/${shareToken}${themeSlug ? '?theme=' + themeSlug : ''}`;

  // Log the API request
  await logApiRequest(supabase as any, {
    keyId: auth.keyId!,
    app: APP_NAME,
    endpoint: 'result',
    statusCode: 200,
    durationMs: Date.now() - start,
  });

  if (format === 'markdown') {
    return Response.json({
      job_id: jobId,
      markdown_report: markdownReport,
      report_url: reportUrl,
    });
  }

  if (format === 'visual') {
    return Response.json({
      job_id: jobId,
      visual_report: visualReport,
      report_url: reportUrl,
    });
  }

  // Default: return both
  return Response.json({
    job_id: jobId,
    status: 'complete',
    concept_name: scan.concept_name,
    concept_type: scan.concept_type,
    concept_category: scan.concept_category,
    intake_summary: scan.intake_summary,
    has_visual_report: !!visualReport,
    markdown_report: markdownReport,
    visual_report: visualReport || null,
    completed_at: scan.completed_at,
    report_url: reportUrl,
  });
};
