import { requireAuth } from './_shared/auth.js';
import { getUserStatus } from './_shared/db.js';
import { ENGINE_REGISTRY } from './_shared/engineRegistry.js';

/**
 * GET /engine-availability
 *
 * Returns which engines are enabled, have API keys, and are allowed for
 * the user's account tier (trial users only get free engines).
 */
export default async (req: Request) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let userId: string;
  try {
    const auth = await requireAuth(req);
    userId = auth.userId;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check user status to enforce trial restrictions
  let isTrial = false;
  try {
    const user = await getUserStatus(userId);
    isTrial = user?.status === 'trial';
  } catch {
    // If DB lookup fails, default to no restriction
  }

  const engines = Object.values(ENGINE_REGISTRY)
    .filter(e => e.enabled)
    .map(e => {
      const hasKey = !!process.env[e.apiKeyEnvVar];
      const tierAllowed = !isTrial || e.tier === 'free';
      return {
        id: e.id,
        name: e.name,
        shortName: e.shortName,
        provider: e.provider,
        tier: e.tier,
        color: e.color,
        icon: e.icon,
        available: hasKey && tierAllowed,
        reason: !hasKey ? 'no_key' : !tierAllowed ? 'pro_only' : undefined,
      };
    });

  return Response.json({ engines, isTrial });
};
