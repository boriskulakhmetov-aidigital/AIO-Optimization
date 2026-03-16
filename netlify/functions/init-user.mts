import { requireAuth } from './_shared/auth.js';
import { upsertUser, getUserStatus } from './_shared/db.js';

function orgDomainFromEmail(email: string | null): string | null {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase();
  // Treat common personal email providers as null (no org)
  const personal = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  return personal.includes(domain) ? null : domain;
}

export default async (req: Request) => {
  try {
    const { userId, email } = await requireAuth(req);
    const orgDomain = orgDomainFromEmail(email);

    await upsertUser(userId, email, orgDomain);
    const userRow = await getUserStatus(userId);

    // Determine effective status — admin emails get admin regardless of DB status
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = email ? adminEmails.includes(email.toLowerCase()) : false;
    const effectiveStatus = isAdmin ? 'admin' : (userRow?.status ?? 'trial');

    return Response.json({
      status: effectiveStatus,
      scan_count: userRow?.scan_count ?? 0,
      org_domain: orgDomain,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};
