import { requireAuthOrEmbed } from './_shared/auth.js';
import { getScanEngines, readJobStatus } from './_shared/supabase.js';

/**
 * GET /scan-status?id=<scanId>
 *
 * Returns current progress of a scan. Reads from job_status first for speed,
 * falls back to DB if job_status is stale or missing.
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const scanId = url.searchParams.get('id');
  if (!scanId) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    await requireAuthOrEmbed(req);

    // Try job_status first (fast path)
    const jobRow = await readJobStatus(scanId);

    if (jobRow?.partial_text) {
      try {
        const progress = JSON.parse(jobRow.partial_text);
        return Response.json(progress, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        // Fall through to DB
      }
    }

    // Fall back to DB
    const engines = await getScanEngines(scanId);
    if (!engines.length) {
      return Response.json({ error: 'Scan not found' }, { status: 404 });
    }

    const allComplete = engines.every(e => e.status === 'complete');
    const anyError = engines.some(e => e.status === 'error');

    const progress = {
      scan_id: scanId,
      status: allComplete ? 'synthesizing' : anyError ? 'error' : 'scanning',
      engines: engines.map(e => ({
        engine_id: e.engine_id,
        status: e.status,
        queries_total: e.queries_total,
        queries_done: e.queries_done,
      })),
    };

    return Response.json(progress, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};
