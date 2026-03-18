import { GoogleGenAI } from '@google/genai';
import {
  getScanById, getScanEngines, getScanReview,
  saveScanReview, saveScanReportData, updateScanStatus,
  getQueriesForScan,
} from './_shared/supabase.js';
import { getEngineName } from './_shared/engineRegistry.js';
import { buildReviewerPrompt, formatSynthesesForReview } from './_shared/reviewerPrompt.js';
import type {
  EngineId, CrossEngineReview, AIOReportData,
  EngineSynthesis, QueryLogEntry,
} from './_shared/types.js';

/**
 * POST /review-background  (background function)
 *
 * Cross-engine review. Triggered by synthesize-engine-background
 * when ALL engines have completed synthesis.
 *
 * 1. Loads all per-engine syntheses
 * 2. Sends them to Gemini with the reviewer prompt
 * 3. Parses the CrossEngineReview JSON
 * 4. Assembles the final AIOReportData
 * 5. Saves everything and marks the scan as complete
 */
export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.scanId) {
    return new Response('Missing scanId', { status: 400 });
  }

  const { scanId } = body as { scanId: string };

  try {
    // Load scan and engine data
    const scan = await getScanById(scanId);
    if (!scan) throw new Error(`Scan not found: ${scanId}`);

    const engines = await getScanEngines(scanId);
    const synthesizedEngines = engines.filter(e => e.synthesis_data);

    if (synthesizedEngines.length === 0) {
      throw new Error('No engine syntheses available for review');
    }

    // Prepare synthesis data for the reviewer
    const synthesesForReview = synthesizedEngines.map(e => ({
      engine_id: e.engine_id,
      engine_name: getEngineName(e.engine_id as EngineId),
      synthesis_data: e.synthesis_data,
    }));

    const systemPrompt = buildReviewerPrompt({
      conceptName: scan.concept_name,
      conceptType: scan.concept_type,
      conceptCategory: scan.concept_category ?? '',
      conceptContext: scan.concept_context,
      engineCount: synthesizedEngines.length,
    });

    const synthesisInput = formatSynthesesForReview(synthesesForReview);

    // Call Gemini for cross-engine review
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: synthesisInput }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 16384,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.text ?? '';

    // Parse the review JSON
    let review: CrossEngineReview;
    try {
      review = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        review = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse review response as JSON');
      }
    }

    // Save review
    await saveScanReview(scanId, review);

    // Build the query log for the report
    const allQueries = await getQueriesForScan(scanId);
    const queryLog: QueryLogEntry[] = allQueries.map(q => ({
      engine_id: q.engine_id as EngineId,
      query_text: q.query_text,
      intent_type: q.intent_type,
      mentioned: q.mentioned ?? false,
      rank: q.mention_position ?? null,
      sentiment: q.sentiment ?? null,
      response_excerpt: truncate(q.response_text ?? '', 300),
    }));

    // Assemble the final AIOReportData
    const engineSyntheses: EngineSynthesis[] = synthesizedEngines.map(e => {
      const data = typeof e.synthesis_data === 'string'
        ? JSON.parse(e.synthesis_data)
        : e.synthesis_data;
      return data as EngineSynthesis;
    });

    const scanStarted = new Date(scan.created_at).getTime();
    const scanDuration = Math.round((Date.now() - scanStarted) / 1000);

    const totalQueries = engines.reduce((sum, e) => sum + (e.queries_total ?? 0), 0);

    const reportData: AIOReportData = {
      schema_version: '2.0',
      meta: {
        concept_type: scan.concept_type,
        concept_name: scan.concept_name,
        concept_category: scan.concept_category,
        engines_tested: synthesizedEngines.map(e => e.engine_id as EngineId),
        total_queries: totalQueries,
        scan_date: new Date().toISOString(),
        scan_duration_seconds: scanDuration,
      },
      executive_summary: review.executive_summary,
      overall_kpis: {
        ai_sov: review.overall_ai_sov,
        first_position_rate: review.overall_first_position_rate,
        top3_rate: computeWeightedAvg(engineSyntheses, 'top3_rate'),
        net_sentiment: review.overall_net_sentiment,
        rsi: computeWeightedAvg(engineSyntheses, 'recommendation_strength_index'),
        discovery_capture_rate: computeWeightedAvg(engineSyntheses, 'discovery_capture_rate'),
        competitive_win_rate: computeWeightedAvg(engineSyntheses, 'competitive_win_rate'),
        engine_consistency: review.engine_consistency,
      },
      engine_syntheses: engineSyntheses,
      cross_engine_review: review,
      query_log: queryLog,
    };

    // Save the final report and mark scan as complete
    await saveScanReportData(scanId, reportData);
    // saveScanReportData already sets status to 'complete'

    console.log(`Review complete for scan ${scanId}: AI-SOV=${review.overall_ai_sov}%, ${review.action_items?.length ?? 0} action items`);

  } catch (err) {
    console.error(`review-background error (${scanId}):`, err);
    await updateScanStatus(scanId, 'error', `Review failed: ${err}`);
  }

  return new Response('Accepted', { status: 202 });
};

// Background function: Netlify v2 detects this from the `-background` filename suffix.

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function computeWeightedAvg(
  syntheses: EngineSynthesis[],
  field: keyof EngineSynthesis,
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of syntheses) {
    const value = s[field];
    if (typeof value !== 'number') continue;
    const weight = s.queries_completed || 1;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}