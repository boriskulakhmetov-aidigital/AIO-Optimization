import { GoogleGenAI } from '@google/genai';
import type { Config } from '@netlify/functions';
import { VISUALIZER_SYSTEM_PROMPT } from './_shared/visualizerPrompt.js';
import type { VisualizerJobRequest } from './_shared/types.js';
import { setVisualizerPending, saveReportData, setVisualizerError } from './_shared/db.js';

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!process.env.GEMINI_API_KEY) return new Response('GEMINI_API_KEY not configured', { status: 500 });

  let body: VisualizerJobRequest;
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON body', { status: 400 }); }

  const { jobId, markdownReport, intakeSummary, assetUrl, fileUri, mimeType } = body;
  if (!jobId || !markdownReport || !intakeSummary) {
    return new Response('Missing required fields', { status: 400 });
  }

  await setVisualizerPending(jobId);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const userParts: unknown[] = [
      {
        text: `## INTAKE SUMMARY\n\`\`\`json\n${JSON.stringify(intakeSummary, null, 2)}\n\`\`\`\n\n## MARKDOWN AUDIT REPORT\n\n${markdownReport}`,
      },
    ];

    // Include the asset for visual context if available
    if (fileUri) userParts.push({ fileData: { fileUri, mimeType: mimeType || 'image/jpeg' } });
    if (assetUrl) userParts.push({ text: `\n\nAsset URL: ${assetUrl}` });

    // Use Flash for structured extraction — much faster, avoids background fn timeout
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: userParts }],
      config: {
        systemInstruction: VISUALIZER_SYSTEM_PROMPT,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
      },
    });

    const raw = result.text ?? '';
    let reportData: unknown;
    try {
      // Strip any accidental markdown fences if present
      const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      reportData = JSON.parse(clean);
    } catch (parseErr) {
      console.error('Visualizer JSON parse failed:', parseErr, '\nRaw (first 500):', raw.slice(0, 500));
      await setVisualizerError(jobId, `JSON parse failed: ${String(parseErr)}`);
      return new Response('Accepted', { status: 202 });
    }

    await saveReportData(jobId, reportData);
  } catch (err) {
    console.error('Visualizer agent error:', err);
    await setVisualizerError(jobId, String(err));
  }

  return new Response('Accepted', { status: 202 });
};

export const config: Config = { background: true };
