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

/** Checks if user is admin (by DB status or ADMIN_EMAILS env var). */
export async function isAdminUser(userId: string): Promise<boolean> {
  const row = await getUserStatus(userId);
  if (row?.status === 'admin') return true;
  // Also check ADMIN_EMAILS env var by email
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const userEmail = row?.user_email?.toLowerCase();
  return userEmail ? adminEmails.includes(userEmail) : false;
}
