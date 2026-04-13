/**
 * POST /.netlify/functions/mobile-save-lead
 * Save lead after mobile scan completes.
 * Called twice per session:
 *   1. At intake (no email) — creates the record with org/brand data
 *   2. At email gate — updates the existing record with the user's email
 * No auth required.
 *
 * Body: { scanId, orgName, brandName, productName?, campaignSlug?, email? }
 * Returns: { saved: true, shareUrl }
 */
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const supabase = getSupabase();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scanId, email, orgName, brandName, productName, campaignSlug } = body as {
    scanId: string;
    email?: string;
    orgName: string;
    brandName: string;
    productName?: string;
    campaignSlug?: string;
  };

  if (!scanId || !orgName || !brandName) {
    return Response.json({ error: 'scanId, orgName, brandName required' }, { status: 400 });
  }

  // Resolve campaign_id from slug (if provided)
  let campaignId: string | null = null;
  if (campaignSlug) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('slug', campaignSlug)
      .maybeSingle();
    campaignId = campaign?.id ?? null;
  }

  // Get share_token for the redirect URL
  const { data: scan } = await supabase
    .from('scans')
    .select('share_token')
    .eq('id', scanId)
    .maybeSingle();

  const shareUrl = scan?.share_token
    ? `https://aiooptimization.apps.aidigitallabs.com/r/${scan.share_token}`
    : null;

  // If email is provided, try to update an existing record for this session first
  if (email) {
    const { data: existing } = await supabase
      .from('campaign_leads')
      .select('id')
      .eq('session_id', scanId)
      .eq('app', 'aio')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('campaign_leads')
        .update({ email, share_url: shareUrl })
        .eq('id', existing.id);

      console.log(`[mobile-save-lead] Email saved to existing lead: ${email} → scan ${scanId}`);
      return Response.json({ saved: true, shareUrl }, { status: 200 });
    }
  }

  // Insert new record (email may be null at intake time)
  const { error } = await supabase.from('campaign_leads').insert({
    campaign_id: campaignId,
    app: 'aio',
    session_id: scanId,
    email: email ?? null,
    org_name: orgName,
    brand_name: brandName,
    product_name: productName || null,
    share_url: shareUrl,
  });

  if (error) {
    console.error('[mobile-save-lead] DB error:', error);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }

  console.log(`[mobile-save-lead] Lead saved: ${email ? email : '(no email)'} (${orgName}) → scan ${scanId}${campaignId ? ` campaign ${campaignSlug}` : ''}`);

  return Response.json({ saved: true, shareUrl }, { status: 200 });
};
