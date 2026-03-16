/**
 * AIDigital Labs — Pseudo-CMS Design System
 * ==========================================
 * Single source of truth for all brand design tokens.
 * Edit this file to retheme the entire application.
 *
 * Colors sourced directly from aidigital.com/ai-digital-labs
 */

// ── Brand Colors ─────────────────────────────────────────────────────────────
// These are fixed — same in both light and dark mode.

export const BRAND_COLORS = {
  blue:  '#0009e4',   // Electric blue — primary brand, logos, links, primary actions
  green: '#aef33e',   // Neon lime green — CTAs, hover states, active confirmations
  pink:  '#e771de',   // Vibrant pink — secondary accent, section highlights
  black: '#080808',   // Carbon black — dark mode background
  white: '#ffffff',
} as const;

// ── Dark Theme Tokens ────────────────────────────────────────────────────────
// Mirrors the dark sections of aidigital.com/ai-digital-labs

export const DARK_THEME = {
  bg:           '#080808',                    // Carbon black
  surface:      '#0f0f0f',                    // Card / panel background
  surface2:     '#1a1a1a',                    // Raised surfaces, code blocks
  border:       'rgba(255, 255, 255, 0.08)',  // Subtle dividers
  text:         '#ffffff',                    // Pure white body text
  textMuted:    '#888888',                    // Muted labels, metadata
  accent:       '#aef33e',                    // Neon green — active states, links
  accentHover:  '#95d932',
  accentDim:    'rgba(174, 243, 62, 0.08)',
  accentBorder: 'rgba(174, 243, 62, 0.2)',
  userMsgBg:    'rgba(0, 9, 228, 0.15)',      // Chat user bubble — blue tint
} as const;

// ── Light Theme Tokens ───────────────────────────────────────────────────────
// Mirrors the light sections of aidigital.com — #F1F1F1 gray backgrounds,
// dark text, same blue/green brand colors.

export const LIGHT_THEME = {
  bg:           '#f1f1f1',                    // Their exact light section bg
  surface:      '#ffffff',                    // Cards / panels on white
  surface2:     '#e8e8e8',                    // Raised surfaces, tags
  border:       'rgba(0, 0, 0, 0.1)',         // Subtle dividers
  text:         '#080808',                    // Their exact near-black
  textMuted:    '#666666',                    // Muted labels
  accent:       '#0009e4',                    // Blue as readable accent in light mode
  accentHover:  '#0007b5',
  accentDim:    'rgba(0, 9, 228, 0.06)',
  accentBorder: 'rgba(0, 9, 228, 0.2)',
  userMsgBg:    'rgba(0, 9, 228, 0.06)',      // Chat user bubble — light blue tint
} as const;

// ── Shared Semantic Colors (same in both themes) ──────────────────────────────

export const SEMANTIC = {
  error:   '#f56565',
  success: '#48bb78',
  warning: '#f6ad55',
} as const;

// ── Audit Severity Colors (DO NOT CHANGE — tied to rubric semantics) ─────────

export const SEVERITY = {
  critical:    { bg: 'rgba(245, 101, 101, 0.15)', text: '#f56565', border: '#f56565' },
  significant: { bg: 'rgba(246, 173,  85, 0.15)', text: '#f6ad55', border: '#f6ad55' },
  moderate:    { bg: 'rgba(104, 211, 145, 0.15)', text: '#68d391', border: '#68d391' },
  improvement: { bg: 'rgba( 99, 102, 241, 0.15)', text: '#818cf8', border: '#818cf8' },
} as const;

// ── Score Pill Colors (DO NOT CHANGE — tied to scoring semantics) ────────────

export const SCORE_PILLS = {
  good: { bg: 'rgba(72,  187, 120, 0.15)', text: '#48bb78' },  // ≥ 7
  mid:  { bg: 'rgba(246, 173,  85, 0.15)', text: '#f6ad55' },  // ≥ 5
  bad:  { bg: 'rgba(245, 101, 101, 0.15)', text: '#f56565' },  // < 5
} as const;

// ── Favicon ──────────────────────────────────────────────────────────────────
// Browser-tab icon: /public/favicon.svg
// Uses the 4-quadrant brand mark. To rebrand, update BRAND_COLORS above and
// regenerate favicon.svg to match (or use buildFaviconSvg() helper below).

export function buildFaviconSvg(): string {
  const { blue, green, pink, black } = BRAND_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none">
  <rect x="0" y="0" width="10" height="10" rx="2" fill="${blue}"/>
  <polygon points="3.5,3.5 3.5,6.5 7,5" fill="white"/>
  <rect x="12" y="0" width="10" height="10" rx="2" fill="${green}"/>
  <circle cx="17" cy="5" r="2.4" fill="${black}"/>
  <rect x="0" y="12" width="10" height="10" rx="2" fill="${pink}"/>
  <line x1="3.2" y1="15.2" x2="6.8" y2="18.8" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="6.8" y1="15.2" x2="3.2" y2="18.8" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="12" y="12" width="10" height="10" rx="2" fill="#e0e8ff"/>
  <rect x="15.5" y="15.5" width="3" height="3" rx="0.5" fill="${blue}"/>
</svg>`;
}

// ── Shape ────────────────────────────────────────────────────────────────────

export const RADIUS = {
  xs:   '4px',
  sm:   '8px',
  md:   '12px',
  full: '999px',
} as const;

// ── Shadows & Glows ──────────────────────────────────────────────────────────
// Blue glow is the AIDigital Labs signature hover effect on cards.

export const GLOWS = {
  blue:  '0 0 20px rgba(0, 9, 200, 0.2)',    // Their exact card hover shadow
  green: '0 0 16px rgba(174, 243, 62, 0.2)', // CTA glow
} as const;

// ── Transitions ──────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  fast:    '0.15s ease',
  default: '0.4s ease-in',  // AIDigital Labs general transition speed
  button:  '0.5s ease',     // Button color swap speed (AIDigital pattern)
  spring:  'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
} as const;

// ── Typography ───────────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  monoFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, monospace',
  baseSizePx: 15,
  lineHeight: 1.6,
} as const;
