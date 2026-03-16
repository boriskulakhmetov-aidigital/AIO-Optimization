// ── Engine Display Metadata (frontend) ───────────────────────────────────────
// Lightweight engine info for UI rendering — no API keys or server config

import type { EngineId } from './types';

export interface EngineMeta {
  id: EngineId;
  name: string;
  shortName: string;
  tier: 'free' | 'pro';
  color: string;
  provider: string;
}

export const ENGINE_META: Record<EngineId, EngineMeta> = {
  chatgpt_free:  { id: 'chatgpt_free',  name: 'ChatGPT (Free)',    shortName: 'GPT Free',    tier: 'free', color: '#10A37F', provider: 'OpenAI' },
  chatgpt_pro:   { id: 'chatgpt_pro',   name: 'ChatGPT (Pro)',     shortName: 'GPT Pro',     tier: 'pro',  color: '#0D8C6D', provider: 'OpenAI' },
  gemini_free:   { id: 'gemini_free',    name: 'Gemini (Free)',     shortName: 'Gemini Free', tier: 'free', color: '#4285F4', provider: 'Google' },
  gemini_pro:    { id: 'gemini_pro',     name: 'Gemini (Pro)',      shortName: 'Gemini Pro',  tier: 'pro',  color: '#1A73E8', provider: 'Google' },
  claude_free:   { id: 'claude_free',    name: 'Claude (Free)',     shortName: 'Claude Free', tier: 'free', color: '#D4A574', provider: 'Anthropic' },
  claude_pro:    { id: 'claude_pro',     name: 'Claude (Pro)',      shortName: 'Claude Pro',  tier: 'pro',  color: '#B8956A', provider: 'Anthropic' },
  grok_free:     { id: 'grok_free',      name: 'Grok (Free)',       shortName: 'Grok Free',   tier: 'free', color: '#1DA1F2', provider: 'xAI' },
  grok_pro:      { id: 'grok_pro',       name: 'Grok (Pro)',        shortName: 'Grok Pro',    tier: 'pro',  color: '#0D7EC4', provider: 'xAI' },
  perplexity:    { id: 'perplexity',     name: 'Perplexity',        shortName: 'Perplexity',  tier: 'pro',  color: '#20B2AA', provider: 'Perplexity' },
  copilot:       { id: 'copilot',        name: 'Microsoft Copilot', shortName: 'Copilot',     tier: 'pro',  color: '#7B83EB', provider: 'Microsoft' },
  meta_ai:       { id: 'meta_ai',        name: 'Meta AI (Llama)',   shortName: 'Meta AI',     tier: 'free', color: '#0668E1', provider: 'Meta' },
  google_sge:    { id: 'google_sge',     name: 'Google AI Search',  shortName: 'Google SGE',  tier: 'pro',  color: '#EA4335', provider: 'Google' },
};

/** All engine IDs in display order */
export const ALL_ENGINE_IDS: EngineId[] = [
  'chatgpt_free', 'chatgpt_pro',
  'gemini_free', 'gemini_pro',
  'claude_free', 'claude_pro',
  'grok_free', 'grok_pro',
  'perplexity', 'copilot',
  'meta_ai', 'google_sge',
];

/** Default engines for a new scan */
export const DEFAULT_ENGINES: EngineId[] = [
  'chatgpt_free', 'chatgpt_pro',
  'gemini_free', 'gemini_pro',
  'claude_free', 'claude_pro',
  'grok_free',
  'perplexity',
  'meta_ai',
];

export function getEngineMeta(id: EngineId): EngineMeta {
  return ENGINE_META[id];
}

export function getEngineColor(id: EngineId): string {
  return ENGINE_META[id]?.color ?? '#888888';
}