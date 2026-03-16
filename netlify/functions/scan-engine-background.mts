import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import {
  updateScanEngineStatus, incrementScanEngineProgress,
  getQueriesForEngine, updateQueryResult,
  getScanEngines,
} from './_shared/db.js';
import type { EngineId } from './_shared/types.js';

/**
 * POST /scan-engine-background  (background function)
 *
 * Runs all queries for ONE engine. Called by dispatch-scan.mts, one invocation per engine.
 * Queries the target AI engine with each query text, stores results.
 *
 * Phase 3 will implement the actual API clients per engine.
 * This is the scaffold with progress tracking and Blob updates.
 */
export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: {
    scanId: string;
    engineId: EngineId;
    engineJobId: string;
    conceptName: string;
    conceptType: string;
    conceptCategory: string;
    conceptContext?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { scanId, engineId, engineJobId, conceptName, conceptType, conceptCategory, conceptContext } = body;
  const store = getStore('scan-progress');

  try {
    // Mark engine as querying
    await updateScanEngineStatus(engineJobId, 'querying');
    await updateBlobProgress(store, scanId, engineId, 'querying', 0, 0);

    // Get all queries for this engine
    const queries = await getQueriesForEngine(engineJobId);
    const totalQueries = queries.length;

    // TODO (Phase 3): Replace this with actual API calls per engine
    // For now, mark queries as pending placeholders
    let completed = 0;

    for (const query of queries) {
      try {
        // Phase 3 will call the actual engine API here:
        // const response = await callEngine(engineId, query.query_text, conceptName, ...);

        // Placeholder: mark as complete with a stub response
        await updateQueryResult(query.id, {
          status: 'complete',
          responseText: `[Phase 3 placeholder] Engine ${engineId} response to: "${query.query_text}"`,
        });

        completed++;
        await incrementScanEngineProgress(engineJobId);

        // Update Blob progress every 5 queries
        if (completed % 5 === 0 || completed === totalQueries) {
          await updateBlobProgress(store, scanId, engineId, 'querying', completed, totalQueries);
        }
      } catch (queryErr) {
        console.warn(`Query error for ${query.id}:`, queryErr);
        await updateQueryResult(query.id, {
          status: 'error',
          responseText: String(queryErr),
          retryCount: 1,
        });
        completed++;
        await incrementScanEngineProgress(engineJobId);
      }
    }

    // All queries done — mark engine as complete
    await updateScanEngineStatus(engineJobId, 'complete');
    await updateBlobProgress(store, scanId, engineId, 'complete', completed, totalQueries);

    // TODO (Phase 4): Trigger synthesize-engine-background here
    // For now, check if all engines are done and log it
    const allEngines = await getScanEngines(scanId);
    const allDone = allEngines.every(e => e.status === 'complete' || e.status === 'error');
    if (allDone) {
      console.log(`All engines complete for scan ${scanId} — ready for synthesis`);
    }

  } catch (err) {
    console.error(`scan-engine-background error (${engineId}):`, err);
    await updateScanEngineStatus(engineJobId, 'error', String(err));
    await updateBlobProgress(store, scanId, engineId, 'error', 0, 0);
  }

  return new Response('Accepted', { status: 202 });
};

export const config: Config = { background: true };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function updateBlobProgress(
  store: ReturnType<typeof getStore>,
  scanId: string,
  engineId: string,
  engineStatus: string,
  done: number,
  total: number,
) {
  try {
    const raw = await store.get(scanId, { type: 'text' }).catch(() => null);
    const progress = raw ? JSON.parse(raw) : { scan_id: scanId, status: 'scanning', engines: [] };

    const engineIdx = progress.engines.findIndex((e: { engine_id: string }) => e.engine_id === engineId);
    const engineData = { engine_id: engineId, status: engineStatus, queries_total: total, queries_done: done };

    if (engineIdx >= 0) {
      progress.engines[engineIdx] = engineData;
    } else {
      progress.engines.push(engineData);
    }

    // Update overall status
    const allComplete = progress.engines.every((e: { status: string }) => e.status === 'complete');
    const anyError = progress.engines.some((e: { status: string }) => e.status === 'error');
    if (allComplete) progress.status = 'synthesizing';
    else if (anyError) progress.status = 'error';

    await store.set(scanId, JSON.stringify(progress));
  } catch (err) {
    console.warn('Blob progress update failed:', err);
  }
}