# Claude Code Project Instructions

## Autonomy
- Run all bash commands, git commits, and pushes without asking for confirmation.
- Auto-commit and push to GitHub after every meaningful change.
- Never ask "should I run this?" — just do it.

## Stack
- React + Vite SPA on Netlify (static site)
- Netlify Functions v2 (`.mts`, ESM, esbuild)
- `@google/genai` v0.7.0 — use `GoogleGenAI` class
- Gemini models: `gemini-2.0-flash` for both orchestrator and audit agent
- Netlify Blobs for async job storage
- SSE streaming for orchestrator responses

## Key Patterns
- Background function: `export const config: Config = { background: true }`
- Rubric/prompts are TypeScript string constants (not file reads) for reliable esbuild bundling
- Frontend polls `report-status` every 3s using `useAuditPoller`
