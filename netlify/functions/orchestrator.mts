import { createLLMProvider, registerUrlAssets, type ToolDefinition, type ToolCall } from '@AiDigital-com/design-system/server';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './_shared/orchestratorPrompt.js';
import { requireAuthOrEmbed } from './_shared/auth.js';
import { log } from './_shared/logger.js';
import { supabase } from './_shared/supabase.js';

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
  const { messages = [], sessionId, userId: bodyUserId } = body;
  const effectiveUserId: string | null = bodyUserId ?? userId ?? null;

  const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'fast', { supabase });

  // Server-side URL detection: scan user messages for URLs, create canonical
  // type='url' asset rows (idempotent). AIO is concept-based but users may
  // reference competitor/landing URLs.
  if (effectiveUserId) {
    try {
      const registered = await registerUrlAssets({
        messages,
        userId: effectiveUserId,
        app: 'aio',
        sessionId: sessionId ?? null,
        supabase: supabase as any,
        onLog: (stage, data) => log.info(`orchestrator.${stage}`, {
          function_name: 'orchestrator', entity_id: sessionId ?? null, user_id: effectiveUserId, meta: data,
        }),
      });
      if (registered.length > 0) {
        log.info('orchestrator.url_assets_registered', {
          function_name: 'orchestrator', entity_id: sessionId ?? null, user_id: effectiveUserId,
          meta: { count: registered.length, created: registered.filter(r => r.created).length },
        });
      }
    } catch (err: any) {
      log.warn('orchestrator.url_registration_failed', {
        function_name: 'orchestrator', entity_id: sessionId ?? null, user_id: effectiveUserId, message: err?.message || String(err),
      });
    }
  }

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
          app: 'aio-optimization:orchestrator',
          userId,
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
