import { requireAuth } from './_shared/auth.js';
import { createScan, updateScanMessages, softDeleteScan } from './_shared/supabase.js';
import type { ConceptType } from './_shared/types.js';

/**
 * POST /save-scan
 *
 * CRUD actions for scan sessions:
 * - create: create a new scan record (during chat phase)
 * - update_messages: save conversation history
 * - delete: soft-delete a scan
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const { userId, email } = await requireAuth(req);
    const body = await req.json();

    if (body.action === 'create') {
      await createScan({
        id: body.id,
        userId,
        userEmail: email,
        config: {
          concept_type: (body.conceptType ?? 'product') as ConceptType,
          concept_name: body.conceptName ?? '',
          concept_category: body.conceptCategory ?? '',
          concept_context: body.conceptContext,
          engines: body.engines ?? [],
          query_count: body.queryCount ?? 100,
        },
        messages: body.messages ?? [],
      });
    } else if (body.action === 'update_messages') {
      await updateScanMessages(body.id, body.messages);
    } else if (body.action === 'delete') {
      await softDeleteScan(body.id, userId);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};