import { requireAuth } from './_shared/auth.js';
import { migrateDb } from './_shared/db.js';

/**
 * POST /db-migrate
 *
 * Runs the schema migration. Requires Clerk auth.
 * Idempotent (CREATE TABLE IF NOT EXISTS).
 */
export default async (req: Request) => {
  try {
    await requireAuth(req);
    await migrateDb();
    return Response.json({ ok: true, message: 'AIO Optimization migration complete' });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};