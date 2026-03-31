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
      case 'google':
      case 'anthropic':
      case 'xai': {
        // These map directly to DS provider names
        const providerName = engine.provider === 'google' ? 'gemini' : engine.provider === 'anthropic' ? 'claude' : engine.provider;
        const llm = createLLMProvider(providerName, apiKey, engine.model);
        const { text } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true };
      }

      case 'google_search': {
        // Gemini with search grounding — uses GeminiProvider directly
        // because the generic interface doesn't expose tools config
        return queryGeminiWithSearch(apiKey, engine.model, queryText);
      }

      case 'openai': {
        // OpenAI-native (ChatGPT, Copilot)
        const baseUrl = engine.id === 'copilot'
          ? (process.env.AZURE_OPENAI_ENDPOINT ?? 'https://api.openai.com/v1')
          : 'https://api.openai.com/v1';
        const llm = new OpenAIProvider(apiKey, engine.model, baseUrl);
        const { text } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true };
      }

      case 'perplexity':
      case 'together': {
        // OpenAI-compatible APIs with custom base URLs
        const baseUrl = OPENAI_BASE_URLS[engine.provider];
        const llm = new OpenAIProvider(apiKey, engine.model, baseUrl);
        const { text } = await llm.generateContent({
          system: 'You are a helpful AI assistant. Answer the query directly.',
          userParts: [{ text: queryText }],
          maxTokens: 2048,
        });
        return { text, ok: true };
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