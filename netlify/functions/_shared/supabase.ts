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

// ── Migrations ────────────────────────────────────────────────────────────────
// Tables are managed via Supabase dashboard / migrations. This is a no-op kept
// for backward compatibility so callers that call migrateDb() don't break.

export async function migrateDb() {
  // No-op — schema is managed in Supabase directly.
}

// ── User Management ──────────────────────────────────────────────────────────

export async function upsertUser(userId: string, email: string | null, orgDomain: string | null) {
  const sb = getSupabase();

  // Claim a pre-registered row if one exists for this email
  if (email) {
    const { data: pre } = await sb
      .from('app_users')
      .select('user_id')
      .eq('user_email', email)
      .eq('user_id', 'pre:' + email);

    if (pre && pre.length > 0) {
      await sb
        .from('app_users')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('user_id', 'pre:' + email);
      return;
    }
  }

  const isAiDigital = email?.toLowerCase().endsWith('@aidigital.com') ?? false;
  const initialStatus = isAiDigital ? 'active' : 'trial';

  await sb.from('app_users').upsert(
    {
      user_id: userId,
      user_email: email,
      org_domain: orgDomain,
      status: initialStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  // Preserve existing org_domain if already set
  if (orgDomain === null) {
    await sb
      .from('app_users')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .not('org_domain', 'is', null);
  }
}

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

export async function adminSetUserStatus(userId: string, status: string) {
  const sb = getSupabase();
  if (status === 'admin') {
    await sb
      .from('app_users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .ilike('user_email', '%@aidigital.com');
  } else {
    await sb
      .from('app_users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
}

export async function adminSetOrgStatus(orgDomain: string, status: string) {
  const sb = getSupabase();
  await sb
    .from('app_users')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('org_domain', orgDomain);
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

export async function softDeleteScan(id: string, userId: string) {
  const sb = getSupabase();
  await sb
    .from('scans')
    .update({ deleted_by_user: true })
    .eq('id', id)
    .eq('user_id', userId);
}

export async function listUserScans(userId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scans')
    .select('id, concept_name, concept_type, status, created_at, completed_at')
    .eq('user_id', userId)
    .or('deleted_by_user.is.null,deleted_by_user.eq.false')
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getScan(id: string, userId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scans')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
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
  // Fetch current value, increment, and update
  const { data: row } = await sb
    .from('scan_engines')
    .select('queries_done')
    .eq('id', id)
    .maybeSingle();

  const newCount = (row?.queries_done ?? 0) + 1;
  await sb.from('scan_engines').update({ queries_done: newCount }).eq('id', id);
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

/** Check if all engines for a scan are synthesized */
export async function areAllEnginesSynthesized(scanId: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from('scan_engines')
    .select('status')
    .eq('scan_id', scanId);

  if (!data || data.length === 0) return false;
  return data.every(e => e.status === 'complete');
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
    response_text: result.responseText ?? null,
    mentioned: result.mentioned ?? null,
    mention_position: result.mentionPosition ?? null,
    sentiment: result.sentiment ?? null,
    sentiment_score: result.sentimentScore ?? null,
    recommendation_strength: result.recommendationStrength ?? null,
    context_type: result.contextType ?? null,
  };
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

// ── Admin Queries ────────────────────────────────────────────────────────────

export async function adminListAccounts() {
  const sb = getSupabase();
  const { data } = await sb.rpc('admin_list_accounts');
  if (data) return data;
  return [];
}

export async function adminListUsers(domain?: string) {
  const sb = getSupabase();
  if (domain) {
    const { data } = await sb.rpc('admin_list_users_by_domain', { p_domain: domain });
    return data ?? [];
  }
  const { data } = await sb.rpc('admin_list_users');
  return data ?? [];
}

export async function adminGetUserScans(userId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scans')
    .select('id, concept_name, concept_type, status, created_at, completed_at, deleted_by_user')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function adminGetScan(id: string) {
  const sb = getSupabase();
  const { data } = await sb.from('scans').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

export async function adminGetScanShare(id: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from('scans')
    .select('share_token, is_public')
    .eq('id', id)
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
