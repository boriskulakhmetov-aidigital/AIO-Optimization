# Claude Code Project Instructions

## Autonomy
- Run all bash commands, git commits, and pushes without asking for confirmation.
- Auto-commit and push to GitHub after every meaningful change.
- Never ask "should I run this?" — just do it.

## Stack
- React + Vite SPA on Netlify (static site)
- Netlify Functions v2 (`.mts`, ESM, esbuild)
- `@google/genai` v0.7.0 — use `GoogleGenAI` class
- Gemini models: `gemini-2.0-flash` for both orchestrator and agents
- Netlify Blobs for async job storage
- SSE streaming for orchestrator responses
- Neon PostgreSQL for persistent data
- Clerk for auth (@clerk/react, @clerk/backend)

## Key Patterns
- Background function: `export const config: Config = { background: true }`
- Rubric/prompts are TypeScript string constants (not file reads) for reliable esbuild bundling
- Frontend polls `report-status` every 3s using `useAuditPoller`

## Infrastructure
- GitHub: boriskulakhmetov-aidigital/AIO-Optimization
- Netlify site: aio-optimization (ID: 2c8e3afc-303f-4716-ad1b-8198cd30a4ec)
- Netlify URL: https://aio-optimization.netlify.app
- Neon project: late-tree-85695096 (org: org-lively-morning-14832517)
- Neon host: ep-mute-cell-am39j60g-pooler.c-5.us-east-1.aws.neon.tech
- Clerk publishable key: pk_test_c3RyaWtpbmctc2hpbmVyLTguY2xlcmsuYWNjb3VudHMuZGV2JA