import { createLLMProvider, type ToolDefinition, type ToolCall } from '@AiDigital-com/design-system/server';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './_shared/orchestratorPrompt.js';
import { requireAuthOrEmbed } from './_shared/auth.js';
import { log } from './_shared/logger.js';
import { trackTokens } from './_shared/access.js';

const DISPATCH_SCAN_TOOL: ToolDefinition = {
  name: 'dispatch_scan',
  description: 'Dispatch the AI search optimization scan once all intake information has been collected from the user.',
  parameters: {
    type: 'object',
    properties: {
      concept_type: {
        type: 'string',
        description: 'Type of concept: product, offering, or concept',
        enum: ['product', 'offering', 'concept'],
      },
      concept_name: {
        type: 'string',
        description: 'The specific product, offering, or concept to audit (e.g., "Toyota RAV4")',
      },
      concept_category: {
        type: 'string',
        description: 'Broader category (e.g., "SUV", "Italian Restaurant", "Luxury Watches")',
      },
      concept_context: {
        type: 'string',
        description: 'Additional context: target market, geography, price range, competitors, goals',
      },
      engines: {
        type: 'array',
        items: { type: 'string' },
        description: 'AI engines to test. Valid IDs: chatgpt_free, gemini_free, claude, perplexity, copilot, grok_free, meta_ai. Default to ["chatgpt_free","gemini_free","claude","perplexity","copilot"] if user does not specify.',
      },
      query_count: {
        type: 'integer',
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

  let userId: string | undefined;
  let email: string | null = null;
  try {
    const auth = await requireAuthOrEmbed(req);
    userId = auth.userId;
    email = auth.email;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { messages = [] } = body;

  const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'fast');

  const chatMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

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
        log.info('orchestrator.start', { function_name: 'orchestrator', user_id: userId, user_email: email, ai_provider: llm.provider, ai_model: llm.model, meta: { messageCount: messages?.length } });
        const startTime = Date.now();

        const result = await llm.streamChat({
          system: ORCHESTRATOR_SYSTEM_PROMPT,
          messages: chatMessages,
          tools: [DISPATCH_SCAN_TOOL],
          callbacks: {
            onText: (text) => emit({ type: 'text_delta', text }),
            onToolCalls: (calls: ToolCall[]) => {
              for (const call of calls) {
                if (call.name === 'dispatch_scan') {
                  emit({ type: 'scan_dispatch', scanConfig: call.args });
                }
              }
            },
          },
        });

        log.info('orchestrator.complete', {
          function_name: 'orchestrator', user_id: userId, user_email: email,
          duration_ms: Date.now() - startTime,
          ai_provider: llm.provider, ai_model: llm.model,
          ai_input_tokens: result.usage.inputTokens,
          ai_output_tokens: result.usage.outputTokens,
          ai_total_tokens: result.usage.totalTokens,
          ai_thinking_tokens: result.usage.thinkingTokens,
        });
        trackTokens(userId, 'aio-optimization:orchestrator', llm.provider, llm.model,
          result.usage.inputTokens, result.usage.outputTokens, result.usage.totalTokens);
        emit({ type: 'done' });
      } catch (err) {
        console.error('Orchestrator error:', err);
        log.error('orchestrator.error', { function_name: 'orchestrator', user_id: userId, user_email: email, error: err, error_category: 'ai_api' });
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
