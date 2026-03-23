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
    .select('id, concept_name, concept_type, concept_category, report_data, report, intake_summary, completed_at, share_token, is_public')
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

  // Build markdown from review_data (or use pre-built scans.report)
  const reviewData = review?.review_data as Record<string, any> | null;
  let markdownReport = (scan as any).report as string || '';
  if (!markdownReport && reviewData) {
    const lines: string[] = [];
    lines.push(`# AIO Optimization Report: ${scan.concept_name}`);
    lines.push('');
    if (reviewData.executive_summary) { lines.push('## Executive Summary'); lines.push(reviewData.executive_summary); lines.push(''); }
    if (reviewData.biggest_gap) { lines.push('## Key Finding'); lines.push(reviewData.biggest_gap); lines.push(''); }
    if (reviewData.overall_ai_sov !== undefined) { lines.push(`## Overall AI Share of Voice: ${reviewData.overall_ai_sov}%`); lines.push(''); }
    if (reviewData.engine_rankings?.length > 0) {
      lines.push('## Engine Rankings');
      for (const eng of reviewData.engine_rankings) {
        lines.push(`- **${eng.engine_name}:** Grade ${eng.overall_grade} — AI-SOV ${eng.ai_sov}%, Sentiment ${eng.net_sentiment >= 0 ? '+' : ''}${eng.net_sentiment}`);
      }
      lines.push('');
    }
    if (reviewData.competitive_landscape) { lines.push('## Competitive Landscape'); lines.push(reviewData.competitive_landscape); lines.push(''); }
    if (reviewData.action_items?.length > 0) {
      lines.push('## Action Items');
      for (const item of reviewData.action_items) {
        lines.push(`### ${item.action_text || 'Action'}`);
        if (item.rationale) lines.push(item.rationale);
        lines.push(`**Priority:** ${item.priority}`);
        if (item.kpi_target) lines.push(`**KPI Target:** ${item.kpi_target}`);
        if (item.estimated_impact) lines.push(`**Estimated Impact:** ${item.estimated_impact}`);
        lines.push('');
      }
    }
    markdownReport = lines.join('\n');

    // Backfill scans.report so future share links work without re-assembly
    // (combined with share_token update below to reduce round trips)
  }
  const visualReport = scan.report_data || reviewData || null;

  // Auto-generate share link + backfill report in a single UPDATE
  let shareToken = scan.share_token;
  const updatePayload: Record<string, unknown> = {};

  if (!shareToken) {
    shareToken = crypto.randomUUID();
    updatePayload.share_token = shareToken;
    updatePayload.is_public = true;
  } else if (!scan.is_public) {
    updatePayload.is_public = true;
  }

  if (markdownReport && !(scan as any).report) {
    updatePayload.report = markdownReport;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateErr } = await supabase.from('scans')
      .update(updatePayload)
      .eq('id', scanId);
    if (updateErr) {
      console.error('api-result: failed to update scan', scanId, updateErr.message);
    }
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
