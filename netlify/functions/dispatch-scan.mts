import { requireAuthOrEmbed } from './_shared/auth.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount, writeJobStatus,
} from './_shared/supabase.js';
import { enforceAccess } from './_shared/access.js';
import { getEngine } from './_shared/engineRegistry.js';
import type { ConceptType, EngineId, GeneratedQuery } from './_shared/types.js';
import { log } from './_shared/logger.js';

/**
 * POST /dispatch-scan
 *
 * Creates the scan record and all child records (scan_engines, scan_queries),
 * then fires off one background function per engine to execute the queries.
 *
 * Expects:
 * - scanId: string
 * - config: { concept_type, concept_name, concept_category, concept_context, engines, query_count }
 * - queries: GeneratedQuery[]  (same queries for all engines)
 * - messages: conversation history from orchestrator
 */
export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { userId, email } = await requireAuthOrEmbed(req);
    const body = await req.json();

    const {
      scanId,
      config,
      queries,
      messages = [],
    } = body as {
      scanId: string;
      config: {
        concept_type: ConceptType;
        concept_name: string;
        concept_category: string;
        concept_context?: string;
        engines: EngineId[];
        query_count: number;
      };
      queries: GeneratedQuery[];
      messages: Array<{ role: string; content: string }>;
    };

    if (!scanId || !config || !queries?.length) {
      return Response.json({ error: 'Missing scanId, config, or queries' }, { status: 400 });
    }

    // ── Tier-based access control (skip for API/internal users) ────────────
    if (!userId.startsWith('api:') && !userId.startsWith('embed:')) {
      const access = await enforceAccess(userId, 'aio-optimization');
      if (!access.allowed) {
        return Response.json({ error: access.reason ?? 'Access denied' }, { status: 403 });
      }
    }

    log.info('scan.dispatch', { function_name: 'dispatch-scan', entity_type: 'scan', entity_id: scanId, user_id: userId, user_email: email, correlation_id: scanId, meta: { engines: config.engines, query_count: queries.length } });

    // 1. Create the scan record
    await createScan({
      id: scanId,
      userId,
      userEmail: email,
      config: {
        ...config,
        query_count: queries.length,
      },
      messages,
    });

    // 2. Filter out engines without API keys
    const availableEngines = config.engines.filter(eid => {
      const eng = getEngine(eid);
      const hasKey = !!process.env[eng.apiKeyEnvVar];
      if (!hasKey) console.log(`[dispatch-scan] Skipping ${eid}: ${eng.apiKeyEnvVar} not set`);
      return hasKey;
    });
    const skippedEngines = config.engines.filter(eid => !availableEngines.includes(eid));

    if (availableEngines.length === 0) {
      return Response.json({ error: 'No engines have API keys configured. Please add API keys to Netlify env vars.' }, { status: 400 });
    }

    // 3. Create engine jobs and queries
    const engineJobIds: Record<string, string> = {};

    for (const engineId of availableEngines) {
      const engineJobId = `${scanId}_${engineId}`;
      engineJobIds[engineId] = engineJobId;

      await createScanEngine({
        id: engineJobId,
        scanId,
        engineId,
        queriesTotal: queries.length,
      });

      // Insert queries for this engine
      const queryRecords = queries.map((q, idx) => ({
        id: `${engineJobId}_q${idx}`,
        scanEngineId: engineJobId,
        scanId,
        queryText: q.text,
        intentType: q.intent_type,
        intentSubtype: q.intent_subtype,
      }));

      await bulkInsertQueries(queryRecords);
    }

    // 4. Set initial progress in job_status for fast polling
    const initialProgress = {
      status: 'scanning' as const,
      partial_text: JSON.stringify({
        scan_id: scanId,
        status: 'scanning',
        engines: availableEngines.map(eid => ({
          engine_id: eid,
          status: 'pending',
          queries_total: queries.length,
          queries_done: 0,
        })),
        skipped_engines: skippedEngines,
      }),
    };
    await writeJobStatus(scanId, initialProgress);

    // 5. Update scan status to scanning
    await updateScanStatus(scanId, 'scanning');

    // 6. Fire off background functions — one per engine
    const baseUrl = new URL(req.url);
    const origin = `${baseUrl.protocol}//${baseUrl.host}`;
    console.log(`[dispatch-scan] Firing ${availableEngines.length} background functions (skipped: ${skippedEngines.join(', ')})`);

    const triggerPromises = availableEngines.map(async (engineId) => {
      try {
        const url = `${origin}/.netlify/functions/scan-engine-background`;
        console.log(`[dispatch-scan] Triggering ${engineId} → ${url}`);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanId,
            engineId,
            engineJobId: engineJobIds[engineId],
            conceptName: config.concept_name,
            conceptType: config.concept_type,
            conceptCategory: config.concept_category,
            conceptContext: config.concept_context,
            userId,
            userEmail: email,
          }),
        });
        console.log(`[dispatch-scan] ${engineId} trigger response: ${resp.status}`);
      } catch (err) {
        console.warn(`[dispatch-scan] Failed to trigger engine ${engineId}:`, err);
      }
    });

    await Promise.all(triggerPromises);

    // 7. Increment user scan count
    await incrementUserScanCount(userId).catch(err =>
      console.warn('incrementUserScanCount failed:', err)
    );

    return Response.json({
      ok: true,
      scanId,
      engineJobIds,
      enginesCount: availableEngines.length,
      queriesPerEngine: queries.length,
      totalApiCalls: queries.length * availableEngines.length,
      skippedEngines,
    });
  } catch (err) {
    console.error('dispatch-scan error:', err);
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};
