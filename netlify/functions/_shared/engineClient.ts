// ── Unified Engine Client ────────────────────────────────────────────────────
// Routes queries to the correct AI provider based on engine ID.
// Uses the DS LLM wrapper (`createLLMProvider`) for all providers.
//
// google_search (Gemini + search grounding) uses GeminiProvider directly
// because the generic LLM interface doesn't expose search tool config.

import {
  createLLMProvider,
  GeminiProvider,
  OpenAIProvider,
} from '@AiDigital-com/design-system/server';
import { getEngine } from './engineRegistry.js';
import type { EngineId } from './types.js';

export interface EngineResponse {
  text: string;
  ok: boolean;
  error?: string;
  /** Provider name (e.g., 'gemini', 'openai', 'claude') */
  provider?: string;
  /** Model name used for the query */
  model?: string;
  /** Token usage from the LLM call */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number; thinkingTokens?: number };
}

// ── Provider base URL map for OpenAI-compatible providers ────────────────────

const OPENAI_BASE_URLS: Record<string, string> = {
  perplexity: 'https://api.perplexity.ai',
  together: 'https://api.together.xyz/v1',
};

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Send a query to a specific AI engine and get the text response.
 * If the engine's API key is not configured, returns a structured placeholder.
 */
export async function queryEngine(
  engineId: EngineId,
  queryText: string,
): Promise<EngineResponse> {
  const engine = getEngine(engineId);
  const apiKey = process.env[engine.apiKeyEnvVar];

  // If no API key is configured, return a placeholder response
  if (!apiKey) {
    return placeholderResponse(engineId, engine.apiKeyEnvVar, queryText);
  }

  try {
    switch (engine.provider) {
      case 'google': {
        if (engine.searchEnabled) {
          return queryGeminiWithSearch(apiKey, engine.model, queryText);
        }
        const llm = createLLMProvider('gemini', apiKey, engine.model);
        const { text, usage } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true, provider: llm.provider, model: llm.model, usage };
      }

      case 'anthropic': {
        if (engine.searchEnabled) {
          return queryClaudeWithSearch(apiKey, engine.model, queryText);
        }
        const llm = createLLMProvider('claude', apiKey, engine.model);
        const { text, usage } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true, provider: llm.provider, model: llm.model, usage };
      }

      case 'xai': {
        if (engine.searchEnabled) {
          return queryGrokWithSearch(apiKey, engine.model, queryText);
        }
        const llm = createLLMProvider('xai', apiKey, engine.model);
        const { text, usage } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true, provider: llm.provider, model: llm.model, usage };
      }

      case 'google_search': {
        return queryGeminiWithSearch(apiKey, engine.model, queryText);
      }

      case 'openai': {
        const baseUrl = engine.id === 'copilot'
          ? (process.env.AZURE_OPENAI_ENDPOINT ?? 'https://api.openai.com/v1')
          : 'https://api.openai.com/v1';
        const llm = new OpenAIProvider(apiKey, engine.model, baseUrl);
        const { text, usage } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true, provider: 'openai', model: engine.model, usage };
      }

      case 'perplexity':
      case 'together': {
        const baseUrl = OPENAI_BASE_URLS[engine.provider];
        const llm = new OpenAIProvider(apiKey, engine.model, baseUrl);
        const { text, usage } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true, provider: engine.provider, model: engine.model, usage };
      }

      default:
        return { text: '', ok: false, error: `Unknown provider: ${engine.provider}` };
    }
  } catch (err) {
    return { text: '', ok: false, error: `${engineId} error: ${err}` };
  }
}

// ── Google Gemini with Search Grounding ──────────────────────────────────────
// Uses GeminiProvider's underlying SDK for search tool config, which the
// generic generateContent interface doesn't support.

async function queryGeminiWithSearch(
  apiKey: string,
  model: string,
  queryText: string,
): Promise<EngineResponse> {
  try {
    // Use the GoogleGenAI SDK directly via GeminiProvider's internal pattern
    // because search grounding requires the `tools` config parameter
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: queryText }] }],
      config: {
        maxOutputTokens: 2048,
        tools: [{ googleSearch: {} }],
      },
    });
    return { text: result.text ?? '', ok: true };
  } catch (err) {
    return { text: '', ok: false, error: `Google SGE error: ${err}` };
  }
}

// ── Anthropic Claude with Web Search ─────────────────────────────────────────
// Uses the web_search_20250305 server-side tool. Returns text content blocks only.

async function queryClaudeWithSearch(
  apiKey: string,
  model: string,
  queryText: string,
): Promise<EngineResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: 'You are a helpful AI assistant. Answer the query directly.',
        messages: [{ role: 'user', content: queryText }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { text: '', ok: false, error: `Claude search error: ${response.status} ${err}` };
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string };
    const text = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('\n');

    const usage = data.usage ? {
      inputTokens: data.usage.input_tokens ?? 0,
      outputTokens: data.usage.output_tokens ?? 0,
      totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
    } : undefined;

    // If no text blocks came back, surface a diagnostic error so retries work
    if (!text) {
      const blockTypes = (data.content ?? []).map(b => b.type).join(', ');
      return { text: '', ok: false, error: `Claude search returned no text blocks (stop_reason=${data.stop_reason}, blocks=[${blockTypes}])` };
    }

    return { text, ok: true, provider: 'anthropic', model, usage };
  } catch (err) {
    return { text: '', ok: false, error: `Claude search error: ${err}` };
  }
}

// ── xAI Grok with Web Search ──────────────────────────────────────────────────
// Uses standard chat completions with search_parameters: { mode: "auto" }.

async function queryGrokWithSearch(
  apiKey: string,
  model: string,
  queryText: string,
): Promise<EngineResponse> {
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. Answer the query directly.' },
          { role: 'user', content: queryText },
        ],
        max_tokens: 2048,
        search_parameters: { mode: 'auto' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { text: '', ok: false, error: `Grok search error: ${response.status} ${err}` };
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    const text = data.choices?.[0]?.message?.content ?? '';

    const usage = data.usage ? {
      inputTokens: data.usage.prompt_tokens ?? 0,
      outputTokens: data.usage.completion_tokens ?? 0,
      totalTokens: data.usage.total_tokens ?? 0,
    } : undefined;

    return { text, ok: true, provider: 'xai', model, usage };
  } catch (err) {
    return { text: '', ok: false, error: `Grok search error: ${err}` };
  }
}

// ── Placeholder Response ─────────────────────────────────────────────────────
// Returns a structured response when the API key is not yet configured.
// This allows the full pipeline to run end-to-end for testing.

function placeholderResponse(
  engineId: EngineId,
  envVar: string,
  queryText: string,
): EngineResponse {
  return {
    text: [
      `[PLACEHOLDER — ${engineId}]`,
      `This engine requires the ${envVar} environment variable to be set.`,
      ``,
      `Query: "${queryText}"`,
      ``,
      `To enable this engine:`,
      `1. Obtain an API key from the provider`,
      `2. Add ${envVar} to your Netlify environment variables`,
      `3. Re-run the scan — no code changes needed`,
      ``,
      `The scan pipeline will process this placeholder response through synthesis`,
      `and it will be excluded from scoring metrics.`,
    ].join('\n'),
    ok: false,
    error: `API key not configured: ${envVar}`,
  };
}