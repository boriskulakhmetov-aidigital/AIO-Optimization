import { requireAuth, isAdminUser } from './_shared/auth.js';
import { setScanShare, adminGetScanShare } from './_shared/supabase.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { userId } = await requireAuth(req);

    if (req.method === 'GET') {
      const adminAccess = await isAdminUser(userId);
      if (!adminAccess) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const row = await adminGetScanShare(id);
      return Response.json(row ?? { share_token: null, is_public: false });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const isPublic = Boolean(body.is_public);
      const row = await setScanShare(id, userId, isPublic);
      if (!row) return Response.json({ error: 'Not found or not owner' }, { status: 404 });
      return Response.json(row);
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};