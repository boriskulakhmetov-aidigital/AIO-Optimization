import { getStore } from '@netlify/blobs';
import { requireAuth } from './_shared/auth.js';
import {
  createScan, updateScanStatus, createScanEngine,
  bulkInsertQueries, incrementUserScanCount,
} from './_shared/db.js';
import type { ConceptType, EngineId, GeneratedQuery } from './_shared/types.js';

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
    const { userId, email } = await requireAuth(req);
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

    // 2. Create engine jobs and queries
    const engineJobIds: Record<string, string> = {};

    for (const engineId of config.engines) {
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

    // 3. Set initial progress in Blobs for fast polling
    const store = getStore('scan-progress');
    const initialProgress = {
      scan_id: scanId,
      status: 'scanning',
      engines: config.engines.map(eid => ({
        engine_id: eid,
        status: 'pending',
        queries_total: queries.length,
        queries_done: 0,
      })),
    };
    await store.set(scanId, JSON.stringify(initialProgress));

    // 4. Update scan status to scanning
    await updateScanStatus(scanId, 'scanning');

    // 5. Fire off background functions — one per engine
    //    MUST await the fetch calls so the request is sent before this function exits.
    //    Background functions are fire-and-forget (we don't read the response body),
    //    but we need to ensure the HTTP request actually leaves.
    const baseUrl = new URL(req.url);
    const origin = `${baseUrl.protocol}//${baseUrl.host}`;
    console.log(`[dispatch-scan] Firing ${config.engines.length} background functions from origin: ${origin}`);

    const triggerPromises = config.engines.map(async (engineId) => {
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
          }),
        });
        console.log(`[dispatch-scan] ${engineId} trigger response: ${resp.status}`);
      } catch (err) {
        console.warn(`[dispatch-scan] Failed to trigger engine ${engineId}:`, err);
      }
    });

    await Promise.all(triggerPromises);

    // 6. Increment user scan count
    await incrementUserScanCount(userId).catch(err =>
      console.warn('incrementUserScanCount failed:', err)
    );

    return Response.json({
      ok: true,
      scanId,
      engineJobIds,
      enginesCount: config.engines.length,
      queriesPerEngine: queries.length,
      totalApiCalls: queries.length * config.engines.length,
    });
  } catch (err) {
    console.error('dispatch-scan error:', err);
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};