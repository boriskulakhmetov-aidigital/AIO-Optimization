import { createLLMProvider } from '@AiDigital-com/design-system/server';
import {
  getScanById, getScanEngines, getScanReview,
  saveScanReview, saveScanReportData, updateScanStatus,
  getQueriesForScan, writeJobStatus, supabase,
} from './_shared/supabase.js';
import { trackUsage, trackTokens } from './_shared/access.js';
import { repairJson } from './_shared/repairJson.js';
import { getEngineName } from './_shared/engineRegistry.js';
import { buildReviewerPrompt, formatSynthesesForReview } from './_shared/reviewerPrompt.js';
import type {
  EngineId, CrossEngineReview, AIOReportData,
  EngineSynthesis, QueryLogEntry,
} from './_shared/types.js';
import { log } from './_shared/logger.js';

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

  const { scanId, userId, userEmail } = body as { scanId: string; userId?: string; userEmail?: string | null };
  const startTime = Date.now();
  log.info('review.start', { function_name: 'review-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: scanId, correlation_id: scanId, ai_provider: 'gemini', ai_model: 'gemini-3.1-pro-preview' });

  try {
    // Write job status so frontend can track review phase via Realtime
    await writeJobStatus(scanId, { status: 'streaming', meta: { phase: 'reviewing' } });

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

    // Call Gemini Pro for cross-engine review (with retry for transient errors)
    const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'analysis');
    let responseText = '';
    let reviewTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0, thinkingTokens: 0 };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await llm.generateContent({
          system: systemPrompt,
          userParts: [{ text: synthesisInput }],
          maxTokens: 65536,
          jsonMode: true,
        });
        responseText = result.text;
        reviewTokens = { ...result.usage, thinkingTokens: result.usage.thinkingTokens || 0 };
        break;
      } catch (retryErr: any) {
        if (attempt < 2 && (retryErr.message?.includes('502') || retryErr.message?.includes('503') || retryErr.message?.includes('temporary'))) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        throw retryErr;
      }
    }

    // Track token usage
    if (scan.user_id) {
      trackTokens(scan.user_id, 'aio-optimization:review', llm.provider, llm.model, reviewTokens.inputTokens, reviewTokens.outputTokens, reviewTokens.totalTokens);
    }

    // Parse the review JSON (with repairJson fallback for Gemini malformed output)
    let review: CrossEngineReview;
    try {
      review = JSON.parse(responseText);
    } catch {
      try {
        review = JSON.parse(repairJson(responseText));
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            review = JSON.parse(repairJson(match[0]));
          } catch {
            throw new Error('Failed to parse review response as JSON');
          }
        } else {
          throw new Error('Failed to parse review response as JSON');
        }
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

    // Also write assembled markdown to scans.report for public report page fallback
    const markdownReport = assembleMarkdownReport(scan, review);
    await supabase.from('scans').update({ report: markdownReport }).eq('id', scanId);

    // Write job status for Realtime — signals frontend to fetch report
    await writeJobStatus(scanId, { status: 'complete', completed_at: new Date().toISOString() });

    // ── Track usage for tier billing ──────────────────────────────────────
    if (scan.user_id) {
      await trackUsage(scan.user_id, 'aio-optimization').catch(err =>
        console.warn('trackUsage failed:', err)
      );
    }

    // Enqueue auto-eval (non-blocking — fire and forget)
    try {
      const { enqueueAutoEval } = await import('@AiDigital-com/design-system/learning');
      await enqueueAutoEval(supabase, {
        jobId: scanId,
        app: 'aio-optimization',
        outputSummary: markdownReport.slice(0, 2000),
        inputSnapshot: { concept_name: scan.concept_name, concept_type: scan.concept_type },
        userId: scan.user_id,
      });
    } catch (evalErr: any) {
      console.warn('[review-background] enqueueAutoEval failed:', evalErr.message);
    }

    log.info('review.complete', { function_name: 'review-background', user_id: userId || scan.user_id, user_email: userEmail || scan.user_email, entity_type: 'scan', entity_id: scanId, correlation_id: scanId, ai_provider: 'gemini', ai_model: 'gemini-3.1-pro-preview', duration_ms: Date.now() - startTime, ai_input_tokens: reviewTokens.inputTokens, ai_output_tokens: reviewTokens.outputTokens, ai_total_tokens: reviewTokens.totalTokens, ai_thinking_tokens: reviewTokens.thinkingTokens, meta: { ai_sov: review.overall_ai_sov, action_items: review.action_items?.length ?? 0 } });
    console.log(`Review complete for scan ${scanId}: AI-SOV=${review.overall_ai_sov}%, ${review.action_items?.length ?? 0} action items`);

  } catch (err) {
    console.error(`review-background error (${scanId}):`, err);
    log.error('review.error', { function_name: 'review-background', user_id: userId, user_email: userEmail, entity_type: 'scan', entity_id: scanId, correlation_id: scanId, error: err, error_category: 'gemini_api', duration_ms: Date.now() - startTime });
    await updateScanStatus(scanId, 'error', `Review failed: ${err}`);
    await writeJobStatus(scanId, { status: 'error', error: `Review failed: ${err}` });
  }

  return new Response('Accepted', { status: 202 });
};

// Background function: Netlify v2 detects this from the `-background` filename suffix.

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function assembleMarkdownReport(scan: any, review: CrossEngineReview): string {
  const lines: string[] = [];
  lines.push(`# AIO Optimization Report: ${scan.concept_name || 'Unknown'}`);
  lines.push('');
  if (review.executive_summary) {
    lines.push('## Executive Summary');
    lines.push(review.executive_summary);
    lines.push('');
  }
  if (review.biggest_gap) {
    lines.push('## Key Finding');
    lines.push(review.biggest_gap);
    lines.push('');
  }
  if (review.overall_ai_sov !== undefined) {
    lines.push(`## Overall AI Share of Voice: ${review.overall_ai_sov}%`);
    lines.push('');
  }
  if (review.engine_rankings?.length > 0) {
    lines.push('## Engine Rankings');
    for (const eng of review.engine_rankings) {
      lines.push(`- **${eng.engine_name}:** Grade ${eng.overall_grade} — AI-SOV ${eng.ai_sov}%, Sentiment ${eng.net_sentiment >= 0 ? '+' : ''}${eng.net_sentiment}`);
    }
    lines.push('');
  }
  if (review.competitive_landscape) {
    lines.push('## Competitive Landscape');
    lines.push(review.competitive_landscape);
    lines.push('');
  }
  if (review.action_items?.length > 0) {
    lines.push('## Action Items');
    for (const item of review.action_items) {
      lines.push(`### ${item.action_text || 'Action'}`);
      if (item.rationale) lines.push(item.rationale);
      lines.push(`**Priority:** ${item.priority}`);
      if (item.kpi_target) lines.push(`**KPI Target:** ${item.kpi_target}`);
      if (item.estimated_impact) lines.push(`**Estimated Impact:** ${item.estimated_impact}`);
      lines.push('');
    }
  }
  return lines.join('\n');
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