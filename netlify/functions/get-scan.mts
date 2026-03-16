import { requireAuth, isAdminUser } from './_shared/auth.js';
import { getScan, adminGetScan, getScanEngines, getScanReview } from './_shared/db.js';

/**
 * GET /get-scan?id=<scanId>
 *
 * Returns full scan data including engine jobs and review status.
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { userId } = await requireAuth(req);
    const isAdmin = await isAdminUser(userId);
    const scan = isAdmin
      ? await adminGetScan(id)
      : await getScan(id, userId);

    if (!scan) return Response.json({ error: 'Not found' }, { status: 404 });

    // Include engine-level data
    const engines = await getScanEngines(id);
    const review = await getScanReview(id);

    return Response.json({
      scan,
      engines,
      review,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};