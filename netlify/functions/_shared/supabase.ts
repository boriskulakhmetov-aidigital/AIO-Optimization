import { createClient } from '@supabase/supabase-js';
import type {
  ScanConfig, EngineId, ScanStatus, EngineJobStatus,
  EngineSynthesis, CrossEngineReview, AIOReportData,
} from './types.js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://njwzbptrhgznozpndcxf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(supabaseUrl, supabaseKey);
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});

// ── User Management ──────────────────────────────────────────────────────────

export async function getUserStatus(userId: string) {
  const sb = getSupabase();
  const { data } = await sb.from('app_users').select('*').eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function incrementUserScanCount(userId: string) {
  const sb = getSupabase();
  const { data: row } = await sb
    .from('app_users')
    .select('scan_count, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (!row) return;

  const newCount = (row.scan_count ?? 0) + 1;
  let newStatus = row.status;
  if (row.status === 'trial' && newCount >= 10) {
    newStatus = 'pending';
  }

  await sb
    .from('app_users')
    .update({ scan_count: newCount, status: newStatus, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

// ── Scan Management ──────────────────────────────────────────────────────────

export async function createScan(params: {
  id: string;
  userId: string;
  userEmail?: string | null;
  config: ScanConfig;
  messages?: Array<{ role: string; content: string }>;
}) {
  const sb = getSupabase();
  await sb.from('scans').upsert(
    {
      id: params.id,
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      concept_type: params.config.concept_type,
      concept_name: params.config.concept_name,
      concept_category: params.config.concept_category ?? null,
      concept_context: params.config.concept_context ?? null,
      engines: params.config.engines as string[],
      query_count: params.config.query_count,
      intake_summary: params.config,
      messages: params.messages ?? [],
      status: 'intake',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

export async function updateScanStatus(id: string, status: ScanStatus, error?: string) {
  const sb = getSupabase();
  const update: Record<string, unknown> = { status };
  if (status === 'complete') {
    update.completed_at = new Date().toISOString();
  }
  if (error) {
    update.error = error;
  }
  await sb.from('scans').update(update).eq('id', id);
}

export async function updateScanMessages(id: string, messages: Array<{ role: string; content: string }>) {
  const sb = getSupabase();
  await sb.from('scans').update({ messages }).eq('id', id);
}

export async function saveScanReportData(id: string, reportData: AIOReportData) {
  const sb = getSupabase();
  await sb
    .from('scans')
    .update({
      report_data: reportData,
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function getScanById(id: string) {
  const sb = getSupabase();
  const { data } = await sb.from('scans').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

// ── Scan Engine Jobs ─────────────────────────────────────────────────────────

export async function createScanEngine(params: {
  id: string;
  scanId: string;
  engineId: EngineId;
  queriesTotal: number;
}) {
  const sb = getSupabase();
  await sb.from('scan_engines').upsert(
    {
      id: params.id,
      scan_id: params.scanId,
      engine_id: params.engineId,
      queries_total: params.queriesTotal,
      status: 'pending',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

export async function updateScanEngineStatus(id: string, status: EngineJobStatus, error?: string) {
  const sb = getSupabase();
  const update: Record<string, unknown> = { status };
  if (status === 'querying') {
    update.started_at = new Date().toISOString();
  } else if (status === 'complete') {
    update.completed_at = new Date().toISOString();
  }
  if (error) {
    update.error = error;
  }
  await sb.from('scan_engines').update(update).eq('id', id);
}

export async function incrementScanEngineProgress(id: string) {
  const sb = getSupabase();
  const { data } = await sb.rpc('increment_engine_progress', { p_engine_id: id });
  return data ?? 0;
}

export async function saveScanEngineSynthesis(id: string, synthesis: EngineSynthesis) {
  const sb = getSupabase();
  await sb
    .from('scan_engines')
    .update({
      synthesis_data: synthesis,
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function getScanEngines(scanId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scan_engines')
    .select('*')
    .eq('scan_id', scanId)
    .order('engine_id');
  return data ?? [];
}

export async function getScanEngine(id: string) {
  const sb = getSupabase();
  const { data } = await sb.from('scan_engines').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

/** Check if all engines for a scan are synthesized (errored engines count as done) */
export async function areAllEnginesSynthesized(scanId: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from('scan_engines')
    .select('status, synthesis_data')
    .eq('scan_id', scanId);

  if (!data || data.length === 0) return false;
  return data.every((e: any) => e.synthesis_data != null || e.status === 'error');
}

// ── Scan Queries ─────────────────────────────────────────────────────────────

export async function bulkInsertQueries(queries: Array<{
  id: string;
  scanEngineId: string;
  scanId: string;
  queryText: string;
  intentType: string;
  intentSubtype?: string;
}>) {
  if (queries.length === 0) return;
  const sb = getSupabase();

  // Supabase supports bulk upsert — insert in batches of 500
  const rows = queries.map(q => ({
    id: q.id,
    scan_engine_id: q.scanEngineId,
    scan_id: q.scanId,
    query_text: q.queryText,
    intent_type: q.intentType,
    intent_subtype: q.intentSubtype ?? null,
  }));

  // Insert in chunks to avoid payload limits
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await sb.from('scan_queries').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
  }
}

export async function updateQueryResult(id: string, result: {
  status: string;
  responseText?: string;
  retryCount?: number;
  mentioned?: boolean;
  mentionPosition?: number | null;
  sentiment?: string;
  sentimentScore?: number;
  recommendationStrength?: string;
  contextType?: string;
}) {
  const sb = getSupabase();
  const update: Record<string, unknown> = {
    status: result.status,
    mentioned: result.mentioned ?? null,
    mention_position: result.mentionPosition ?? null,
    sentiment: result.sentiment ?? null,
    sentiment_score: result.sentimentScore ?? null,
    recommendation_strength: result.recommendationStrength ?? null,
    context_type: result.contextType ?? null,
  };
  // Only update response_text when explicitly provided (don't wipe on score-only updates)
  if (result.responseText !== undefined) {
    update.response_text = result.responseText || null;
  }
  if (result.retryCount !== undefined) {
    update.retry_count = result.retryCount;
  }
  if (result.status === 'complete' || result.status === 'error') {
    update.completed_at = new Date().toISOString();
  }
  await sb.from('scan_queries').update(update).eq('id', id);
}

export async function getQueriesForEngine(scanEngineId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scan_queries')
    .select('*')
    .eq('scan_engine_id', scanEngineId)
    .order('created_at');
  return data ?? [];
}

export async function getQueriesForScan(scanId: string) {
  const sb = getSupabase();
  // Join with scan_engines to get engine_id
  const { data } = await sb
    .from('scan_queries')
    .select('*, scan_engines!inner(engine_id)')
    .eq('scan_id', scanId)
    .order('scan_engine_id')
    .order('intent_type');

  // Flatten the join result
  return (data ?? []).map((q: any) => ({
    ...q,
    engine_id: q.scan_engines?.engine_id ?? null,
    scan_engines: undefined,
  }));
}

// ── Scan Review ──────────────────────────────────────────────────────────────

export async function createScanReview(id: string, scanId: string) {
  const sb = getSupabase();
  await sb.from('scan_review').upsert(
    { id, scan_id: scanId, status: 'pending' },
    { onConflict: 'scan_id', ignoreDuplicates: true }
  );
}

export async function saveScanReview(scanId: string, reviewData: CrossEngineReview) {
  const sb = getSupabase();
  await sb
    .from('scan_review')
    .update({
      review_data: reviewData,
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('scan_id', scanId);
}

export async function getScanReview(scanId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scan_review')
    .select('*')
    .eq('scan_id', scanId)
    .maybeSingle();
  return data ?? null;
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export async function setScanShare(id: string, userId: string, isPublic: boolean) {
  const sb = getSupabase();

  // Ensure a share_token exists
  const { data: existing } = await sb
    .from('scans')
    .select('share_token')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  const shareToken = existing?.share_token || crypto.randomUUID();

  await sb
    .from('scans')
    .update({ share_token: shareToken, is_public: isPublic })
    .eq('id', id)
    .eq('user_id', userId);

  return { share_token: shareToken, is_public: isPublic };
}

export async function getScanByShareToken(token: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scans')
    .select('id, concept_name, concept_type, report_data, is_public, intake_summary')
    .eq('share_token', token)
    .maybeSingle();
  return data ?? null;
}

// ── Job Status (replaces Netlify Blobs) ──────────────────────────────────────

export async function writeJobStatus(jobId: string, payload: Record<string, unknown>) {
  const sb = getSupabase();
  await sb.from('job_status').upsert(
    {
      id: jobId,
      app: 'aio-optimization',
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function readJobStatus(jobId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('job_status')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  return data ?? null;
}
