import { getStore } from '@netlify/blobs';
import {
  updateScanEngineStatus, incrementScanEngineProgress,
  getQueriesForEngine, updateQueryResult,
  getScanEngines, updateScanStatus,
} from './_shared/db.js';
import { queryEngine } from './_shared/engineClient.js';
import { getEngine } from './_shared/engineRegistry.js';
import { RateLimiter, withRetry, runInBatches } from './_shared/rateLimiter.js';
import type { EngineId } from './_shared/types.js';

/**
 * POST /scan-engine-background  (background function)
 *
 * Runs all queries for ONE engine. Called by dispatch-scan.mts,
 * one invocation per engine.
 *
 * Uses the unified engine client (engineClient.ts) which routes
 * to the correct provider API. Engines without configured API keys
 * will return structured placeholder responses.
 *
 * Features:
 * - Controlled concurrency (per engine maxConcurrency setting)
 * - Rate limiting (sliding window, per engine rateLimitPerMin)
 * - Retry with exponential backoff (1s, 4s, 16s — max 3 retries)
 * - Blob progress updates every 5 completed queries
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

  const { scanId, engineId, engineJobId } = body;
  const store = getStore('scan-progress');
  const engineConfig = getEngine(engineId);
  const rateLimiter = new RateLimiter(engineId);

  try {
    // Mark engine as querying
    await updateScanEngineStatus(engineJobId, 'querying');
    await updateBlobProgress(store, scanId, engineId, 'querying', 0, 0);

    // Get all queries for this engine
    const queries = await getQueriesForEngine(engineJobId);
    const totalQueries = queries.length;
    let completed = 0;
    let failed = 0;

    // Process queries in batches with controlled concurrency
    await runInBatches(
      queries,
      engineConfig.maxConcurrency,
      async (query) => {
        // Wait for rate limit slot
        await rateLimiter.waitForSlot();

        // Execute with retry
        const outcome = await withRetry(async () => {
          const response = await queryEngine(engineId, query.query_text);
          if (!response.ok && response.error && !response.error.includes('not configured')) {
            throw new Error(response.error);
          }
          return response;
        }, 3);

        let snippetText = '';

        if ('result' in outcome) {
          const response = outcome.result;
          snippetText = response.text;
          await updateQueryResult(query.id, {
            status: response.ok ? 'complete' : 'complete', // placeholder responses still count as complete
            responseText: response.text,
            retryCount: outcome.retries,
          });
        } else {
          // All retries exhausted
          failed++;
          snippetText = outcome.error;
          await updateQueryResult(query.id, {
            status: 'error',
            responseText: outcome.error,
            retryCount: outcome.retries,
          });
        }

        completed++;
        await incrementScanEngineProgress(engineJobId);

        // Build snippet for live feed
        const snippet = {
          engine_id: engineId,
          query: query.query_text.slice(0, 120),
          response: snippetText.slice(0, 200),
          ts: Date.now(),
        };

        // Update Blob progress every 3 queries or on last query (more frequent for live feel)
        if (completed % 3 === 0 || completed === totalQueries) {
          await updateBlobProgress(store, scanId, engineId, 'querying', completed, totalQueries, snippet);
        }
      },
    );

    // All queries done — mark engine as complete
    await updateScanEngineStatus(engineJobId, 'complete');
    await updateBlobProgress(store, scanId, engineId, 'complete', completed, totalQueries);

    console.log(
      `Engine ${engineId} complete: ${completed - failed}/${totalQueries} ok, ${failed} failed`
    );

    // Trigger synthesis for this engine
    const baseUrl = new URL(req.url);
    const origin = `${baseUrl.protocol}//${baseUrl.host}`;

    fetch(`${origin}/.netlify/functions/synthesize-engine-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId, engineJobId }),
    }).catch(err => console.warn(`Failed to trigger synthesis for ${engineId}:`, err));

    // Check if all engines are done to update scan status
    const allEngines = await getScanEngines(scanId);
    const allDone = allEngines.every(e => e.status === 'complete' || e.status === 'error');
    if (allDone) {
      console.log(`All engines complete for scan ${scanId} — synthesis triggered for each`);
      await updateScanStatus(scanId, 'synthesizing');
    }

  } catch (err) {
    console.error(`scan-engine-background fatal error (${engineId}):`, err);
    await updateScanEngineStatus(engineJobId, 'error', String(err));
    await updateBlobProgress(store, scanId, engineId, 'error', 0, 0);
  }

  return new Response('Accepted', { status: 202 });
};

// Background function: Netlify v2 detects this from the `-background` filename suffix.

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Snippet {
  engine_id: string;
  query: string;
  response: string;
  ts: number;
}

async function updateBlobProgress(
  store: ReturnType<typeof getStore>,
  scanId: string,
  engineId: string,
  engineStatus: string,
  done: number,
  total: number,
  snippet?: Snippet,
) {
  try {
    const raw = await store.get(scanId, { type: 'text' }).catch(() => null);
    const progress = raw ? JSON.parse(raw) : { scan_id: scanId, status: 'scanning', engines: [], feed: [] };

    const engineIdx = progress.engines.findIndex((e: { engine_id: string }) => e.engine_id === engineId);
    const engineData: Record<string, unknown> = {
      engine_id: engineId, status: engineStatus, queries_total: total, queries_done: done,
    };

    // Attach latest snippet to the engine card
    if (snippet) {
      engineData.latest_snippet = snippet;
    } else if (engineIdx >= 0 && progress.engines[engineIdx].latest_snippet) {
      // Preserve existing snippet if none provided
      engineData.latest_snippet = progress.engines[engineIdx].latest_snippet;
    }

    if (engineIdx >= 0) {
      progress.engines[engineIdx] = engineData;
    } else {
      progress.engines.push(engineData);
    }

    // Append to global feed (keep last 15 across all engines)
    if (snippet) {
      if (!progress.feed) progress.feed = [];
      progress.feed.push(snippet);
      if (progress.feed.length > 15) {
        progress.feed = progress.feed.slice(-15);
      }
    }

    // Update overall scan status
    const allComplete = progress.engines.every((e: { status: string }) => e.status === 'complete');
    const anyError = progress.engines.some((e: { status: string }) => e.status === 'error');
    if (allComplete) progress.status = 'synthesizing';
    else if (anyError && !progress.engines.some((e: { status: string }) => e.status === 'querying' || e.status === 'pending')) {
      progress.status = 'error';
    }

    await store.set(scanId, JSON.stringify(progress));
  } catch (err) {
    console.warn('Blob progress update failed:', err);
  }
}