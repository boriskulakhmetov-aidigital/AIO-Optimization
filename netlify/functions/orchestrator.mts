import { GoogleGenAI } from '@google/genai';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './_shared/orchestratorPrompt.js';
import { requireAuthOrEmbed } from './_shared/auth.js';
import { log } from './_shared/logger.js';
import { trackTokens } from './_shared/access.js';
import { extractGeminiTokens } from '@boriskulakhmetov-aidigital/design-system/utils';

const DISPATCH_SCAN_TOOL = {
  name: 'dispatch_scan',
  description: 'Dispatch the AI search optimization scan once all intake information has been collected from the user.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      concept_type: {
        type: 'STRING' as const,
        description: 'Type of concept: product, offering, or concept',
        enum: ['product', 'offering', 'concept'],
      },
      concept_name: {
        type: 'STRING' as const,
        description: 'The specific product, offering, or concept to audit (e.g., "Toyota RAV4")',
      },
      concept_category: {
        type: 'STRING' as const,
        description: 'Broader category (e.g., "SUV", "Italian Restaurant", "Luxury Watches")',
      },
      concept_context: {
        type: 'STRING' as const,
        description: 'Additional context: target market, geography, price range, competitors, goals',
      },
      engines: {
        type: 'ARRAY' as const,
        items: { type: 'STRING' as const },
        description: 'AI engines to test. Valid IDs: chatgpt_free, gemini_free, claude_free, perplexity, copilot, grok_free, meta_ai. Default to ["chatgpt_free","gemini_free","claude_free","perplexity","copilot"] if user does not specify.',
      },
      query_count: {
        type: 'INTEGER' as const,
        description: 'Number of queries per engine. Default 100.',
      },
    },
    required: ['concept_type', 'concept_name', 'concept_category', 'engines'],
  },
};

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await requireAuthOrEmbed(req);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { messages = [], userId } = body;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Build Gemini contents array from conversation history
  const contents: Array<{ role: string; parts: unknown[] }> = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  );

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
        log.info('orchestrator.start', { function_name: 'orchestrator', user_id: userId });
        const timer = log.time('gemini.call', { function_name: 'orchestrator', user_id: userId, ai_provider: 'gemini', ai_model: 'gemini-3-flash-preview' });

        const stream = await ai.models.generateContentStream({
          model: 'gemini-3-flash-preview',
          contents,
          config: {
            systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [DISPATCH_SCAN_TOOL] }],
            maxOutputTokens: 2048,
          },
        });

        let lastChunk: any = null;
        for await (const chunk of stream) {
          lastChunk = chunk;
          if (chunk.text) {
            emit({ type: 'text_delta', text: chunk.text });
          }
          const fcs = chunk.functionCalls;
          if (fcs && fcs.length > 0) {
            for (const fc of fcs) {
              if (fc.name === 'dispatch_scan') {
                emit({ type: 'scan_dispatch', scanConfig: fc.args });
              }
            }
          }
        }

        const tokens = extractGeminiTokens(lastChunk ?? {});
        timer.end({ ai_input_tokens: tokens.inputTokens, ai_output_tokens: tokens.outputTokens, ai_total_tokens: tokens.totalTokens });
        trackTokens(userId, 'aio-optimization', 'gemini', 'gemini-3-flash-preview', tokens.inputTokens, tokens.outputTokens, tokens.totalTokens);
        emit({ type: 'done' });
      } catch (err) {
        console.error('Orchestrator error:', err);
        log.error('orchestrator.error', { function_name: 'orchestrator', user_id: userId, error: err, error_category: 'gemini_api' });
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