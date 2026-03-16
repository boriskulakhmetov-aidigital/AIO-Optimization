import { requireAuth } from './_shared/auth.js';
import { getVisualizerStatus } from './_shared/db.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) return Response.json({ error: 'Missing jobId' }, { status: 400 });

  try {
    const { userId } = await requireAuth(req);
    const row = await getVisualizerStatus(jobId, userId);
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({
      visualizer_status: row.visualizer_status ?? 'pending',
      report_data: row.visualizer_status === 'complete' ? row.report_data : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};
