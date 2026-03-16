import { verifyToken, createClerkClient } from '@clerk/backend';
import { getUserStatus } from './db.js';

/** Extract and verify the Clerk session token from the Authorization header.
 *  Returns { userId, email } or throws on failure. */
export async function requireAuth(req: Request): Promise<{ userId: string; email: string | null }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY not configured');

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) throw new Error('Unauthorized');

  // verifyToken is a standalone function in @clerk/backend Core 3
  const payload = await verifyToken(token, { secretKey });
  const userId = payload.sub;

  // Fetch primary email via the client
  let email: string | null = null;
  try {
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(userId);
    const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
    email = primary?.emailAddress ?? null;
  } catch {
    // non-fatal — email used only for grouping
  }

  return { userId, email };
}

/** Checks DB status === 'admin'. Use after requireAuth. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const row = await getUserStatus(userId);
  return row?.status === 'admin';
}
