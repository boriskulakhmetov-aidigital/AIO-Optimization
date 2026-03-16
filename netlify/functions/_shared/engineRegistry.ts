// ── AI Engine Registry ───────────────────────────────────────────────────────
// Configuration for each AI engine: display info, API config, rate limits

import type { EngineId } from './types.js';

export interface EngineConfig {
  id: EngineId;
  name: string;
  shortName: string;
  provider: string;              // API provider name
  tier: 'free' | 'pro';
  model: string;                 // model ID to use
  color: string;                 // hex color for charts
  icon: string;                  // emoji or icon identifier
  maxConcurrency: number;        // max parallel queries
  rateLimitPerMin: number;       // requests per minute cap
  apiKeyEnvVar: string;          // env var name holding the API key
  enabled: boolean;              // whether this engine is currently available
}

// Each engine gets its own env var so we control availability per-version.
// To add a key: netlify env:set CHATGPT_FREE_API_KEY sk-...
export const ENGINE_REGISTRY: Record<EngineId, EngineConfig> = {
  chatgpt_free: {
    id: 'chatgpt_free',
    name: 'ChatGPT (Free)',
    shortName: 'GPT Free',
    provider: 'openai',
    tier: 'free',
    model: 'gpt-4o-mini',
    color: '#10A37F',
    icon: 'openai',
    maxConcurrency: 3,
    rateLimitPerMin: 60,
    apiKeyEnvVar: 'CHATGPT_FREE_API_KEY',
    enabled: true,
  },
  chatgpt_pro: {
    id: 'chatgpt_pro',
    name: 'ChatGPT (Pro)',
    shortName: 'GPT Pro',
    provider: 'openai',
    tier: 'pro',
    model: 'gpt-4o',
    color: '#0D8C6D',
    icon: 'openai',
    maxConcurrency: 3,
    rateLimitPerMin: 40,
    apiKeyEnvVar: 'CHATGPT_PRO_API_KEY',
    enabled: true,
  },
  gemini_free: {
    id: 'gemini_free',
    name: 'Gemini (Free)',
    shortName: 'Gemini Free',
    provider: 'google',
    tier: 'free',
    model: 'gemini-3-flash-preview',
    color: '#4285F4',
    icon: 'gemini',
    maxConcurrency: 5,
    rateLimitPerMin: 60,
    apiKeyEnvVar: 'GEMINI_FREE_API_KEY',
    enabled: true,
  },
  gemini_pro: {
    id: 'gemini_pro',
    name: 'Gemini (Pro)',
    shortName: 'Gemini Pro',
    provider: 'google',
    tier: 'pro',
    model: 'gemini-3.1-pro-preview',
    color: '#1A73E8',
    icon: 'gemini',
    maxConcurrency: 3,
    rateLimitPerMin: 30,
    apiKeyEnvVar: 'GEMINI_PRO_API_KEY',
    enabled: true,
  },
  claude_free: {
    id: 'claude_free',
    name: 'Claude (Free)',
    shortName: 'Claude Free',
    provider: 'anthropic',
    tier: 'free',
    model: 'claude-haiku-4-5-20251001',
    color: '#D4A574',
    icon: 'claude',
    maxConcurrency: 3,
    rateLimitPerMin: 50,
    apiKeyEnvVar: 'CLAUDE_FREE_API_KEY',
    enabled: true,
  },
  claude_pro: {
    id: 'claude_pro',
    name: 'Claude (Pro)',
    shortName: 'Claude Pro',
    provider: 'anthropic',
    tier: 'pro',
    model: 'claude-sonnet-4-6',
    color: '#B8956A',
    icon: 'claude',
    maxConcurrency: 3,
    rateLimitPerMin: 30,
    apiKeyEnvVar: 'CLAUDE_PRO_API_KEY',
    enabled: true,
  },
  grok_free: {
    id: 'grok_free',
    name: 'Grok (Free)',
    shortName: 'Grok Free',
    provider: 'xai',
    tier: 'free',
    model: 'grok-3-mini-fast',
    color: '#1DA1F2',
    icon: 'grok',
    maxConcurrency: 3,
    rateLimitPerMin: 30,
    apiKeyEnvVar: 'GROK_FREE_API_KEY',
    enabled: true,
  },
  grok_pro: {
    id: 'grok_pro',
    name: 'Grok (Pro)',
    shortName: 'Grok Pro',
    provider: 'xai',
    tier: 'pro',
    model: 'grok-3',
    color: '#0D7EC4',
    icon: 'grok',
    maxConcurrency: 3,
    rateLimitPerMin: 20,
    apiKeyEnvVar: 'GROK_PRO_API_KEY',
    enabled: true,
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    shortName: 'Perplexity',
    provider: 'perplexity',
    tier: 'pro',
    model: 'sonar-pro',
    color: '#20B2AA',
    icon: 'perplexity',
    maxConcurrency: 3,
    rateLimitPerMin: 20,
    apiKeyEnvVar: 'PERPLEXITY_API_KEY',
    enabled: true,
  },
  copilot: {
    id: 'copilot',
    name: 'Microsoft Copilot',
    shortName: 'Copilot',
    provider: 'openai',
    tier: 'pro',
    model: 'gpt-4o',
    color: '#7B83EB',
    icon: 'copilot',
    maxConcurrency: 3,
    rateLimitPerMin: 30,
    apiKeyEnvVar: 'COPILOT_API_KEY',
    enabled: false,
  },
  meta_ai: {
    id: 'meta_ai',
    name: 'Meta AI (Llama)',
    shortName: 'Meta AI',
    provider: 'together',
    tier: 'free',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    color: '#0668E1',
    icon: 'meta',
    maxConcurrency: 3,
    rateLimitPerMin: 30,
    apiKeyEnvVar: 'META_AI_API_KEY',
    enabled: true,
  },
  google_sge: {
    id: 'google_sge',
    name: 'Google AI Search',
    shortName: 'Google SGE',
    provider: 'google_search',
    tier: 'pro',
    model: 'gemini-3-flash-preview',
    color: '#EA4335',
    icon: 'google',
    maxConcurrency: 2,
    rateLimitPerMin: 15,
    apiKeyEnvVar: 'GOOGLE_SGE_API_KEY',
    enabled: true,
  },
};

/** Get all enabled engines */
export function getEnabledEngines(): EngineConfig[] {
  return Object.values(ENGINE_REGISTRY).filter(e => e.enabled);
}

/** Get engine config by ID */
export function getEngine(id: EngineId): EngineConfig {
  const engine = ENGINE_REGISTRY[id];
  if (!engine) throw new Error(`Unknown engine: ${id}`);
  return engine;
}

/** Get engine display name */
export function getEngineName(id: EngineId): string {
  return ENGINE_REGISTRY[id]?.name ?? id;
}

/** Group engines by provider */
export function getEnginesByProvider(): Record<string, EngineConfig[]> {
  const result: Record<string, EngineConfig[]> = {};
  for (const engine of Object.values(ENGINE_REGISTRY)) {
    if (!result[engine.provider]) result[engine.provider] = [];
    result[engine.provider].push(engine);
  }
  return result;
}