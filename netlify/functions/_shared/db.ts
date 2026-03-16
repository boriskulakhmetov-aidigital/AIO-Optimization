import { neon } from '@neondatabase/serverless';
import type {
  ScanConfig, EngineId, ScanStatus, EngineJobStatus,
  EngineSynthesis, CrossEngineReview, AIOReportData,
} from './types.js';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured');
  return neon(url);
}

// ── Migrations ────────────────────────────────────────────────────────────────

export async function migrateDb() {
  const sql = getDb();

  // Users table (shared with Neuromarketing Audit)
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      user_id     TEXT PRIMARY KEY,
      user_email  TEXT,
      org_domain  TEXT,
      status      TEXT NOT NULL DEFAULT 'trial',
      scan_count  INTEGER NOT NULL DEFAULT 0,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Scans (top-level research projects)
  await sql`
    CREATE TABLE IF NOT EXISTS scans (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      user_email       TEXT,
      concept_type     TEXT NOT NULL,
      concept_name     TEXT NOT NULL,
      concept_category TEXT,
      concept_context  TEXT,
      engines          TEXT[] NOT NULL,
      query_count      INTEGER DEFAULT 100,
      intake_summary   JSONB,
      messages         JSONB DEFAULT '[]',
      status           TEXT DEFAULT 'intake',
      error            TEXT,
      report_data      JSONB,
      share_token      TEXT,
      is_public        BOOLEAN DEFAULT FALSE,
      deleted_by_user  BOOLEAN DEFAULT FALSE,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      completed_at     TIMESTAMPTZ
    )
  `;

  // Per-engine job tracking
  await sql`
    CREATE TABLE IF NOT EXISTS scan_engines (
      id              TEXT PRIMARY KEY,
      scan_id         TEXT NOT NULL REFERENCES scans(id),
      engine_id       TEXT NOT NULL,
      status          TEXT DEFAULT 'pending',
      queries_total   INTEGER DEFAULT 0,
      queries_done    INTEGER DEFAULT 0,
      error           TEXT,
      synthesis_data  JSONB,
      started_at      TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ
    )
  `;

  // Individual query results
  await sql`
    CREATE TABLE IF NOT EXISTS scan_queries (
      id                      TEXT PRIMARY KEY,
      scan_engine_id          TEXT NOT NULL REFERENCES scan_engines(id),
      scan_id                 TEXT NOT NULL,
      query_text              TEXT NOT NULL,
      intent_type             TEXT NOT NULL,
      intent_subtype          TEXT,
      status                  TEXT DEFAULT 'pending',
      response_text           TEXT,
      retry_count             INTEGER DEFAULT 0,
      mentioned               BOOLEAN,
      mention_position        INTEGER,
      sentiment               TEXT,
      sentiment_score         NUMERIC(3,2),
      recommendation_strength TEXT,
      context_type            TEXT,
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      completed_at            TIMESTAMPTZ
    )
  `;

  // Cross-engine review
  await sql`
    CREATE TABLE IF NOT EXISTS scan_review (
      id              TEXT PRIMARY KEY,
      scan_id         TEXT NOT NULL REFERENCES scans(id) UNIQUE,
      status          TEXT DEFAULT 'pending',
      review_data     JSONB,
      error           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS scans_user_id_idx ON scans(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans(created_at DESC)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS scans_share_token_idx ON scans(share_token) WHERE share_token IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS scan_engines_scan_id_idx ON scan_engines(scan_id)`;
  await sql`CREATE INDEX IF NOT EXISTS scan_queries_engine_idx ON scan_queries(scan_engine_id)`;
  await sql`CREATE INDEX IF NOT EXISTS scan_queries_scan_idx ON scan_queries(scan_id)`;
  await sql`CREATE INDEX IF NOT EXISTS app_users_org_domain_idx ON app_users(org_domain)`;
}

// ── User Management ──────────────────────────────────────────────────────────

export async function upsertUser(userId: string, email: string | null, orgDomain: string | null) {
  const sql = getDb();

  if (email) {
    const pre = await sql`
      SELECT user_id FROM app_users WHERE user_email = ${email} AND user_id = ${'pre:' + email}
    `;
    if (pre.length > 0) {
      await sql`
        UPDATE app_users SET user_id = ${userId}, updated_at = NOW()
        WHERE user_id = ${'pre:' + email}
      `;
      return;
    }
  }

  const isAiDigital = email?.toLowerCase().endsWith('@aidigital.com') ?? false;
  const initialStatus = isAiDigital ? 'active' : 'trial';
  await sql`
    INSERT INTO app_users (user_id, user_email, org_domain, status)
    VALUES (${userId}, ${email}, ${orgDomain}, ${initialStatus})
    ON CONFLICT (user_id) DO UPDATE
      SET user_email = EXCLUDED.user_email,
          org_domain = COALESCE(app_users.org_domain, EXCLUDED.org_domain),
          updated_at = NOW()
  `;
}

export async function getUserStatus(userId: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM app_users WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function incrementUserScanCount(userId: string) {
  const sql = getDb();
  await sql`
    UPDATE app_users
    SET scan_count = scan_count + 1,
        status = CASE
          WHEN status = 'trial' AND scan_count + 1 >= 10 THEN 'pending'
          ELSE status
        END,
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

export async function adminSetUserStatus(userId: string, status: string) {
  const sql = getDb();
  if (status === 'admin') {
    await sql`
      UPDATE app_users SET status = ${status}, updated_at = NOW()
      WHERE user_id = ${userId} AND user_email ILIKE '%@aidigital.com'
    `;
  } else {
    await sql`UPDATE app_users SET status = ${status}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
}

export async function adminSetOrgStatus(orgDomain: string, status: string) {
  const sql = getDb();
  await sql`UPDATE app_users SET status = ${status}, updated_at = NOW() WHERE org_domain = ${orgDomain}`;
}

// ── Scan Management ──────────────────────────────────────────────────────────

export async function createScan(params: {
  id: string;
  userId: string;
  userEmail?: string | null;
  config: ScanConfig;
  messages?: Array<{ role: string; content: string }>;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO scans (
      id, user_id, user_email,
      concept_type, concept_name, concept_category, concept_context,
      engines, query_count, intake_summary, messages, status
    ) VALUES (
      ${params.id}, ${params.userId}, ${params.userEmail ?? null},
      ${params.config.concept_type}, ${params.config.concept_name},
      ${params.config.concept_category ?? null}, ${params.config.concept_context ?? null},
      ${params.config.engines as string[]}, ${params.config.query_count},
      ${JSON.stringify(params.config)},
      ${JSON.stringify(params.messages ?? [])},
      'intake'
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function updateScanStatus(id: string, status: ScanStatus, error?: string) {
  const sql = getDb();
  if (status === 'complete') {
    await sql`UPDATE scans SET status = ${status}, completed_at = NOW() WHERE id = ${id}`;
  } else if (error) {
    await sql`UPDATE scans SET status = ${status}, error = ${error} WHERE id = ${id}`;
  } else {
    await sql`UPDATE scans SET status = ${status} WHERE id = ${id}`;
  }
}

export async function updateScanMessages(id: string, messages: Array<{ role: string; content: string }>) {
  const sql = getDb();
  await sql`UPDATE scans SET messages = ${JSON.stringify(messages)} WHERE id = ${id}`;
}

export async function saveScanReportData(id: string, reportData: AIOReportData) {
  const sql = getDb();
  await sql`
    UPDATE scans
    SET report_data = ${JSON.stringify(reportData)},
        status = 'complete',
        completed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function softDeleteScan(id: string, userId: string) {
  const sql = getDb();
  await sql`UPDATE scans SET deleted_by_user = TRUE WHERE id = ${id} AND user_id = ${userId}`;
}

export async function listUserScans(userId: string) {
  const sql = getDb();
  return await sql`
    SELECT id, concept_name, concept_type, status, created_at, completed_at
    FROM scans
    WHERE user_id = ${userId}
      AND (deleted_by_user IS NULL OR deleted_by_user = FALSE)
    ORDER BY created_at DESC
    LIMIT 100
  `;
}

export async function getScan(id: string, userId: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM scans WHERE id = ${id} AND user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function getScanById(id: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM scans WHERE id = ${id}`;
  return rows[0] ?? null;
}

// ── Scan Engine Jobs ─────────────────────────────────────────────────────────

export async function createScanEngine(params: {
  id: string;
  scanId: string;
  engineId: EngineId;
  queriesTotal: number;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO scan_engines (id, scan_id, engine_id, queries_total, status)
    VALUES (${params.id}, ${params.scanId}, ${params.engineId}, ${params.queriesTotal}, 'pending')
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function updateScanEngineStatus(id: string, status: EngineJobStatus, error?: string) {
  const sql = getDb();
  if (status === 'querying') {
    await sql`UPDATE scan_engines SET status = ${status}, started_at = NOW() WHERE id = ${id}`;
  } else if (status === 'complete') {
    await sql`UPDATE scan_engines SET status = ${status}, completed_at = NOW() WHERE id = ${id}`;
  } else if (error) {
    await sql`UPDATE scan_engines SET status = ${status}, error = ${error} WHERE id = ${id}`;
  } else {
    await sql`UPDATE scan_engines SET status = ${status} WHERE id = ${id}`;
  }
}

export async function incrementScanEngineProgress(id: string) {
  const sql = getDb();
  await sql`UPDATE scan_engines SET queries_done = queries_done + 1 WHERE id = ${id}`;
}

export async function saveScanEngineSynthesis(id: string, synthesis: EngineSynthesis) {
  const sql = getDb();
  await sql`
    UPDATE scan_engines
    SET synthesis_data = ${JSON.stringify(synthesis)},
        status = 'complete',
        completed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getScanEngines(scanId: string) {
  const sql = getDb();
  return await sql`
    SELECT * FROM scan_engines WHERE scan_id = ${scanId} ORDER BY engine_id
  `;
}

export async function getScanEngine(id: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM scan_engines WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** Check if all engines for a scan are synthesized */
export async function areAllEnginesSynthesized(scanId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'complete') as done
    FROM scan_engines WHERE scan_id = ${scanId}
  `;
  const { total, done } = rows[0];
  return Number(total) > 0 && Number(total) === Number(done);
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
  const sql = getDb();
  // Batch insert using unnest for efficiency
  for (const q of queries) {
    await sql`
      INSERT INTO scan_queries (id, scan_engine_id, scan_id, query_text, intent_type, intent_subtype)
      VALUES (${q.id}, ${q.scanEngineId}, ${q.scanId}, ${q.queryText}, ${q.intentType}, ${q.intentSubtype ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
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
  const sql = getDb();
  await sql`
    UPDATE scan_queries SET
      status = ${result.status},
      response_text = ${result.responseText ?? null},
      retry_count = COALESCE(${result.retryCount ?? null}, retry_count),
      mentioned = ${result.mentioned ?? null},
      mention_position = ${result.mentionPosition ?? null},
      sentiment = ${result.sentiment ?? null},
      sentiment_score = ${result.sentimentScore ?? null},
      recommendation_strength = ${result.recommendationStrength ?? null},
      context_type = ${result.contextType ?? null},
      completed_at = CASE WHEN ${result.status} IN ('complete', 'error') THEN NOW() ELSE completed_at END
    WHERE id = ${id}
  `;
}

export async function getQueriesForEngine(scanEngineId: string) {
  const sql = getDb();
  return await sql`
    SELECT * FROM scan_queries WHERE scan_engine_id = ${scanEngineId} ORDER BY created_at
  `;
}

export async function getQueriesForScan(scanId: string) {
  const sql = getDb();
  return await sql`
    SELECT q.*, se.engine_id
    FROM scan_queries q
    JOIN scan_engines se ON se.id = q.scan_engine_id
    WHERE q.scan_id = ${scanId}
    ORDER BY se.engine_id, q.intent_type
  `;
}

// ── Scan Review ──────────────────────────────────────────────────────────────

export async function createScanReview(id: string, scanId: string) {
  const sql = getDb();
  await sql`
    INSERT INTO scan_review (id, scan_id, status)
    VALUES (${id}, ${scanId}, 'pending')
    ON CONFLICT (scan_id) DO NOTHING
  `;
}

export async function saveScanReview(scanId: string, reviewData: CrossEngineReview) {
  const sql = getDb();
  await sql`
    UPDATE scan_review
    SET review_data = ${JSON.stringify(reviewData)},
        status = 'complete',
        completed_at = NOW()
    WHERE scan_id = ${scanId}
  `;
}

export async function getScanReview(scanId: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM scan_review WHERE scan_id = ${scanId}`;
  return rows[0] ?? null;
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export async function setScanShare(id: string, userId: string, isPublic: boolean) {
  const sql = getDb();
  await sql`
    UPDATE scans
    SET share_token = COALESCE(share_token, gen_random_uuid()::text),
        is_public   = ${isPublic}
    WHERE id = ${id} AND user_id = ${userId}
  `;
  const rows = await sql`SELECT share_token, is_public FROM scans WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getScanByShareToken(token: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT id, concept_name, concept_type, report_data, is_public, intake_summary
    FROM scans
    WHERE share_token = ${token}
  `;
  return rows[0] ?? null;
}

// ── Admin Queries ────────────────────────────────────────────────────────────

export async function adminListAccounts() {
  const sql = getDb();
  return await sql`
    SELECT
      u.org_domain                AS domain,
      COUNT(DISTINCT u.user_id)   AS user_count,
      COUNT(s.id)                 AS scan_count,
      MAX(s.created_at)           AS last_activity
    FROM app_users u
    LEFT JOIN scans s ON s.user_id = u.user_id
    WHERE u.org_domain IS NOT NULL
    GROUP BY u.org_domain
    ORDER BY last_activity DESC NULLS LAST
  `;
}

export async function adminListUsers(domain?: string) {
  const sql = getDb();
  if (domain) {
    return await sql`
      SELECT
        u.user_id, u.user_email, u.status, u.scan_count,
        MAX(s.created_at) AS last_activity,
        COUNT(s.id) AS session_count
      FROM app_users u
      LEFT JOIN scans s ON s.user_id = u.user_id
      WHERE u.org_domain = ${domain}
         OR u.user_email LIKE ${'%@' + domain}
      GROUP BY u.user_id, u.user_email, u.status, u.scan_count
      ORDER BY last_activity DESC NULLS LAST
    `;
  }
  return await sql`
    SELECT u.user_id, u.user_email, u.status, u.scan_count,
           MAX(s.created_at) AS last_activity
    FROM app_users u
    LEFT JOIN scans s ON s.user_id = u.user_id
    GROUP BY u.user_id, u.user_email, u.status, u.scan_count
    ORDER BY last_activity DESC NULLS LAST
    LIMIT 500
  `;
}

export async function adminGetUserScans(userId: string) {
  const sql = getDb();
  return await sql`
    SELECT id, concept_name, concept_type, status, created_at, completed_at, deleted_by_user
    FROM scans WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

export async function adminGetScan(id: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM scans WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function adminGetScanShare(id: string) {
  const sql = getDb();
  const rows = await sql`SELECT share_token, is_public FROM scans WHERE id = ${id}`;
  return rows[0] ?? null;
}