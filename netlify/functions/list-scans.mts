import { requireAuth } from './_shared/auth.js';
import { listUserScans } from './_shared/supabase.js';

export default async (req: Request) => {
  try {
    const { userId } = await requireAuth(req);
    const scans = await listUserScans(userId);
    return Response.json({ scans }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};