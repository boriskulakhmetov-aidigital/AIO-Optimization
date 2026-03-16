import { getScanByShareToken } from './_shared/db.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  try {
    const row = await getScanByShareToken(token);
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
    if (!row.is_public) return Response.json({ error: 'This report is private' }, { status: 403 });
    if (!row.report_data) {
      return Response.json({ error: 'Report not ready yet' }, { status: 404 });
    }

    return Response.json({
      report_data: row.report_data,
      concept_name: row.concept_name,
      concept_type: row.concept_type,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};