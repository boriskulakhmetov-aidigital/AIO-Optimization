import { GoogleGenAI } from '@google/genai';
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { AUDIT_AGENT_SYSTEM_PROMPT } from './_shared/auditAgentPrompt.js';
import { RUBRIC_TEXT } from './_shared/rubric.js';
import type { AuditJobRequest, AuditJobStatus } from './_shared/types.js';
import { updateSessionReport, updateSessionIntake, incrementUserAuditCount } from './_shared/db.js';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return new Response('GEMINI_API_KEY not configured', { status: 500 });
  }

  let body: AuditJobRequest;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { intakeSummary, fileUri, mimeType, assetUrl, jobId, userId, messages } = body;
  if (!jobId || !intakeSummary) {
    return new Response('Missing jobId or intakeSummary', { status: 400 });
  }

  const store = getStore('audit-reports');
  const pending: AuditJobStatus = { status: 'pending', startedAt: Date.now() };
  await store.set(jobId, JSON.stringify(pending));

  // Transition session chatting→pending and save chat transcript
  await updateSessionIntake(
    jobId, intakeSummary, intakeSummary.brand_name, intakeSummary.asset_type, messages ?? []
  ).catch(err => console.warn('updateSessionIntake failed:', err));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const userParts: unknown[] = [
      {
        text: `## NEUROMARKETING & COLOR PSYCHOLOGY RUBRIC v2.0\n\n${RUBRIC_TEXT}\n\n---\n\n## INTAKE SUMMARY\n\n\`\`\`json\n${JSON.stringify(intakeSummary, null, 2)}\n\`\`\`\n\n---\n\nPlease audit the asset against the full rubric above. Apply all protocols P1–P16. Return the complete Markdown report.`,
      },
    ];

    if (fileUri) userParts.push({ fileData: { fileUri, mimeType: mimeType || 'image/jpeg' } });
    if (assetUrl) userParts.push({ text: `\n\nAsset URL: ${assetUrl}` });

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: userParts }],
      config: { systemInstruction: AUDIT_AGENT_SYSTEM_PROMPT, maxOutputTokens: 65536 },
    });

    let accumulated = '';
    let lastWrite = Date.now();

    for await (const chunk of stream) {
      accumulated += chunk.text ?? '';
      if (Date.now() - lastWrite > 2000) {
        lastWrite = Date.now();
        const streaming: AuditJobStatus = { status: 'streaming', partial: accumulated };
        store.set(jobId, JSON.stringify(streaming)).catch(() => {});
      }
    }

    const reportText = accumulated || '(No report generated)';
    await store.set(jobId, JSON.stringify({ status: 'complete', report: reportText, completedAt: Date.now() }));

    await updateSessionReport(jobId, reportText, 'complete').catch(err =>
      console.warn('Neon persist failed:', err)
    );
    if (userId) {
      await incrementUserAuditCount(userId).catch(err =>
        console.warn('incrementUserAuditCount failed:', err)
      );
    }

    // Trigger visualizer agent to structure the report into micro-app data
    const vizUrl = new URL(req.url);
    const baseUrl = `${vizUrl.protocol}//${vizUrl.host}`;
    await fetch(`${baseUrl}/.netlify/functions/visualizer-agent-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, markdownReport: reportText, intakeSummary, assetUrl, fileUri, mimeType }),
    }).catch(err => console.warn('Failed to trigger visualizer:', err));

  } catch (err) {
    console.error('Audit agent error:', err);
    await store.set(jobId, JSON.stringify({ status: 'error', error: String(err), failedAt: Date.now() }));
    await updateSessionReport(jobId, '', 'error', String(err)).catch(() => {});
  }

  return new Response('Accepted', { status: 202 });
};

export const config: Config = { background: true };
