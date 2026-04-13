/**
 * POST /.netlify/functions/mobile-save-lead
 * Save lead info (email) after mobile scan completes.
 * No auth required.
 *
 * Body: { scanId, email, orgName, brandName, productName? }
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

  const { scanId, email, orgName, brandName, productName } = body as {
    scanId: string;
    email: string;
    orgName: string;
    brandName: string;
    productName?: string;
  };

  if (!scanId || !email || !orgName || !brandName) {
    return Response.json({ error: 'scanId, email, orgName, brandName required' }, { status: 400 });
  }

  // Save lead
  const { error } = await supabase.from('aio_leads').insert({
    scan_id: scanId,
    email,
    org_name: orgName,
    brand_name: brandName,
    product_name: productName || null,
  });

  if (error) {
    console.error('[mobile-save-lead] DB error:', error);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }

  // Get the share_token so we can show the full report
  const { data: scan } = await supabase
    .from('scans')
    .select('share_token')
    .eq('id', scanId)
    .maybeSingle();

  const shareUrl = scan?.share_token
    ? `https://aiooptimization.apps.aidigitallabs.com/r/${scan.share_token}`
    : null;

  // Update lead with report URL
  if (shareUrl) {
    await supabase.from('aio_leads')
      .update({ report_url: shareUrl, report_sent: true })
      .eq('scan_id', scanId);
  }

  console.log(`[mobile-save-lead] Lead saved: ${email} (${orgName}) → scan ${scanId}`);

  return Response.json({ saved: true, shareUrl }, { status: 200 });
};
