import { requireAuth } from './_shared/auth.js';
import { ENGINE_REGISTRY } from './_shared/engineRegistry.js';

/**
 * GET /engine-availability
 *
 * Returns which engines are enabled and have their API keys configured.
 * Used by the frontend to show engine availability before/during scans.
 */
export default async (req: Request) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await requireAuth(req);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const engines = Object.values(ENGINE_REGISTRY)
    .filter(e => e.enabled)
    .map(e => ({
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      provider: e.provider,
      tier: e.tier,
      color: e.color,
      icon: e.icon,
      available: !!process.env[e.apiKeyEnvVar],
    }));

  return Response.json({ engines });
};
