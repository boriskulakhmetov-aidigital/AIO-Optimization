import { GoogleGenAI } from '@google/genai';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './_shared/orchestratorPrompt.js';

const DISPATCH_AUDIT_TOOL = {
  name: 'dispatch_audit',
  description: 'Dispatch the neuromarketing audit once all intake information has been collected.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      asset_type: {
        type: 'STRING' as const,
        description: 'Asset type: C1_STATIC, C2_ANIMATED, C3_VIDEO, C4_SOCIAL_POST, C5_CAROUSEL, LANDING_PAGE, FULL_WEBSITE, or EMAIL',
      },
      asset_tier: {
        type: 'STRING' as const,
        description: 'CREATIVE or PAGE_DESTINATION',
      },
      brand_name: { type: 'STRING' as const },
      offer: { type: 'STRING' as const, description: 'What does this asset ask the user to do?' },
      target_audience: { type: 'STRING' as const },
      reading_direction: { type: 'STRING' as const },
      awareness_stage: { type: 'STRING' as const },
      campaign_context: { type: 'STRING' as const },
      multi_campaign_confirmed: { type: 'BOOLEAN' as const },
      traffic_source: { type: 'STRING' as const },
      brand_voice: { type: 'STRING' as const },
      brand_hex_primary: { type: 'STRING' as const },
      brand_hex_secondary: { type: 'STRING' as const },
      brand_hex_accent: { type: 'STRING' as const },
      device: { type: 'STRING' as const },
      competitors: { type: 'STRING' as const },
      additional_context: { type: 'STRING' as const },
    },
    required: ['asset_type', 'asset_tier', 'brand_name', 'offer'],
  },
};

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { messages = [], fileUri, mimeType, assetUrl } = body;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Build Gemini contents array
  const contents: Array<{ role: string; parts: unknown[] }> = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  );

  // Attach asset to the last user message if provided
  if ((fileUri || assetUrl) && contents.length > 0) {
    const lastUserIdx = contents.map(c => c.role).lastIndexOf('user');
    if (lastUserIdx !== -1) {
      if (fileUri) {
        contents[lastUserIdx].parts.push({
          fileData: { fileUri, mimeType: mimeType || 'image/jpeg' },
        });
      }
      if (assetUrl) {
        contents[lastUserIdx].parts.push({
          text: `\n\nAsset URL to audit: ${assetUrl}`,
        });
      }
    }
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const keepAliveInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15_000);

      try {
        const stream = await ai.models.generateContentStream({
          model: 'gemini-3.1-pro-preview',
          contents,
          config: {
            systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [DISPATCH_AUDIT_TOOL] }],
            maxOutputTokens: 2048,
          },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            emit({ type: 'text_delta', text: chunk.text });
          }
          const fcs = chunk.functionCalls;
          if (fcs && fcs.length > 0) {
            for (const fc of fcs) {
              if (fc.name === 'dispatch_audit') {
                emit({ type: 'audit_dispatch', intakeSummary: fc.args });
              }
            }
          }
        }

        emit({ type: 'done' });
      } catch (err) {
        console.error('Orchestrator error:', err);
        emit({ type: 'error', message: String(err) });
      } finally {
        clearInterval(keepAliveInterval);
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
