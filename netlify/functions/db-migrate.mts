import { migrateDb } from './_shared/db.js';

/**
 * POST /db-migrate
 *
 * Runs the schema migration. Idempotent (CREATE TABLE IF NOT EXISTS).
 * TODO: re-add auth after bootstrap
 */
export default async (_req: Request) => {
  try {
    await migrateDb();
    return Response.json({ ok: true, message: 'AIO Optimization migration complete' });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};