// ── Unified Engine Client ────────────────────────────────────────────────────
// Routes queries to the correct AI provider based on engine ID.
// Each provider implements a simple interface: send a query, get a text response.
//
// KEY STATUS:
//   ✅ WORKING   — GEMINI_API_KEY available: gemini_free, gemini_pro, google_sge
//   🔑 NEEDS KEY — Placeholder client returns structured mock until key is added:
//        OPENAI_API_KEY      → chatgpt_free, chatgpt_pro
//        ANTHROPIC_API_KEY   → claude_free, claude_pro
//        XAI_API_KEY         → grok_free, grok_pro
//        PERPLEXITY_API_KEY  → perplexity
//        TOGETHER_API_KEY    → meta_ai
//        AZURE_OPENAI_API_KEY → copilot (disabled)

import { GoogleGenAI } from '@google/genai';
import { getEngine } from './engineRegistry.js';
import type { EngineId } from './types.js';

export interface EngineResponse {
  text: string;
  ok: boolean;
  error?: string;
}

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

  switch (engine.provider) {
    case 'google':
      return queryGemini(apiKey, engine.model, queryText);

    case 'google_search':
      return queryGeminiWithSearch(apiKey, engine.model, queryText);

    case 'openai':
      // OpenAI-compatible API (ChatGPT free/pro, Copilot via Azure)
      return queryOpenAICompatible({
        apiKey,
        baseUrl: engine.id === 'copilot'
          ? (process.env.AZURE_OPENAI_ENDPOINT ?? 'https://api.openai.com/v1')
          : 'https://api.openai.com/v1',
        model: engine.model,
        queryText,
        engineId,
      });

    case 'anthropic':
      return queryAnthropic(apiKey, engine.model, queryText);

    case 'xai':
      // xAI Grok uses OpenAI-compatible API
      return queryOpenAICompatible({
        apiKey,
        baseUrl: 'https://api.x.ai/v1',
        model: engine.model,
        queryText,
        engineId,
      });

    case 'perplexity':
      // Perplexity uses OpenAI-compatible API
      return queryOpenAICompatible({
        apiKey,
        baseUrl: 'https://api.perplexity.ai',
        model: engine.model,
        queryText,
        engineId,
      });

    case 'together':
      // Together AI (Meta Llama) uses OpenAI-compatible API
      return queryOpenAICompatible({
        apiKey,
        baseUrl: 'https://api.together.xyz/v1',
        model: engine.model,
        queryText,
        engineId,
      });

    default:
      return { text: '', ok: false, error: `Unknown provider: ${engine.provider}` };
  }
}

// ── Google Gemini (WORKING — uses existing GEMINI_API_KEY) ───────────────────

async function queryGemini(
  apiKey: string,
  model: string,
  queryText: string,
): Promise<EngineResponse> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: queryText }] }],
      config: { maxOutputTokens: 2048 },
    });
    return { text: result.text ?? '', ok: true };
  } catch (err) {
    return { text: '', ok: false, error: `Gemini error: ${err}` };
  }
}

// ── Google Gemini with Search Grounding (WORKING — uses GEMINI_API_KEY) ──────

async function queryGeminiWithSearch(
  apiKey: string,
  model: string,
  queryText: string,
): Promise<EngineResponse> {
  try {
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

// ── OpenAI-Compatible API ────────────────────────────────────────────────────
// Works for: ChatGPT, Grok (xAI), Perplexity, Together (Llama), Azure Copilot
//
// 🔑 NEEDS KEY for each provider. When key is added to Netlify env vars,
//    this client will work automatically — no code changes needed.
//
// Keys to add:
//   OPENAI_API_KEY      — https://platform.openai.com/api-keys
//   XAI_API_KEY         — https://console.x.ai/
//   PERPLEXITY_API_KEY  — https://www.perplexity.ai/settings/api
//   TOGETHER_API_KEY    — https://api.together.xyz/settings/api-keys
//   AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT — https://portal.azure.com

async function queryOpenAICompatible(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  queryText: string;
  engineId: EngineId;
}): Promise<EngineResponse> {
  const { apiKey, baseUrl, model, queryText, engineId } = params;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: queryText }],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return { text: '', ok: false, error: `${engineId} API ${response.status}: ${errBody}` };
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content ?? '';
    return { text, ok: true };
  } catch (err) {
    return { text: '', ok: false, error: `${engineId} error: ${err}` };
  }
}

// ── Anthropic Claude ─────────────────────────────────────────────────────────
// 🔑 NEEDS KEY: ANTHROPIC_API_KEY — https://console.anthropic.com/settings/keys
//
// Uses Anthropic's native Messages API (not OpenAI-compatible).

async function queryAnthropic(
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
        messages: [{ role: 'user', content: queryText }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return { text: '', ok: false, error: `Claude API ${response.status}: ${errBody}` };
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('') ?? '';

    return { text, ok: true };
  } catch (err) {
    return { text: '', ok: false, error: `Claude error: ${err}` };
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