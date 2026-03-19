import { requireAuthOrEmbed } from './_shared/auth.js';
import { getScanById, getScanEngines, getScanReview } from './_shared/supabase.js';

/**
 * GET /synthesis-status?id=<scanId>
 *
 * Returns the current state of synthesis and review for a scan.
 * Frontend polls this after scanning completes.
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const scanId = url.searchParams.get('id');
  if (!scanId) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    await requireAuthOrEmbed(req);

    const scan = await getScanById(scanId);
    if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });

    const engines = await getScanEngines(scanId);
    const review = await getScanReview(scanId);

    // Determine overall phase
    const engineStatuses = engines.map(e => ({
      engine_id: e.engine_id,
      status: e.status,
      has_synthesis: !!e.synthesis_data,
    }));

    const allSynthesized = engines.length > 0 && engines.every(e => e.synthesis_data);
    const anySynthesizing = engines.some(e => e.status === 'synthesizing');
    const reviewComplete = review?.status === 'complete';
    const reviewError = review?.status === 'error';

    let phase: string;
    if (reviewComplete && scan.report_data) {
      phase = 'complete';
    } else if (reviewError) {
      phase = 'error';
    } else if (review?.status === 'processing' || (allSynthesized && !reviewComplete)) {
      phase = 'reviewing';
    } else if (anySynthesizing || engines.some(e => e.synthesis_data)) {
      phase = 'synthesizing';
    } else {
      phase = 'scanning';
    }

    return Response.json({
      scan_id: scanId,
      scan_status: scan.status,
      phase,
      engines: engineStatuses,
      review_status: review?.status ?? null,
      has_report: !!scan.report_data,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};