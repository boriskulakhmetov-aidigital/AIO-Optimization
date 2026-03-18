# AIDigital Labs — AIO Optimization

> Auto-loaded by Claude Code. Provides full context for this app.

## What This App Does

AI search optimization tool that analyzes how a product, brand, or concept is recommended across consumer AI engines (ChatGPT, Gemini, Claude, Grok, Perplexity, Copilot, Meta AI, Google SGE). Generates diverse search queries, runs them against selected engines, synthesizes per-engine results, and produces a cross-engine competitive intelligence report with KPIs, rankings, and action items.

## URLs

- **Live:** https://aio-optimization.apps.aidigitallabs.com
- **Netlify site ID:** `2c8e3afc-303f-4716-ad1b-8198cd30a4ec`
- **GitHub:** `boriskulakhmetov-aidigital/AIO-Optimization`
- **Deploy:** `npx netlify-cli deploy --prod --dir=dist --site=2c8e3afc-303f-4716-ad1b-8198cd30a4ec`

## Tech Stack

- React 19 + Vite 6 + TypeScript
- `@boriskulakhmetov-aidigital/design-system` (shared components + theme)
- Clerk authentication (`@clerk/react`)
- Google Gemini AI (`@google/genai`) — `gemini-2.0-flash` for orchestrator and agents
- Neon serverless PostgreSQL (`@neondatabase/serverless`)
- Netlify Blobs for async job storage
- Netlify Functions (serverless backend, `.mts` ESM with esbuild)
- `marked` for Markdown rendering, `html2pdf.js` for PDF export

## Key Patterns

- Background function config: `export const config: Config = { background: true }`
- Rubric/prompts are TypeScript string constants (not file reads) for reliable esbuild bundling
- Multi-phase pipeline: generating → scanning → synthesizing → reviewing → report_ready
- Per-engine parallelism: scan-engine-background runs independently per engine
- Frontend polls `scan-status` and `synthesis-status` using `useScanPoller` and `useSynthesisPoller`

## Design System Integration

```typescript
// main.tsx
import { applyTheme, aiLabsTheme } from '@boriskulakhmetov-aidigital/design-system'
import '@boriskulakhmetov-aidigital/design-system/style.css'
applyTheme(aiLabsTheme)
```

Components used from design system: `AppShell`, `ChatPanel`, `BrandMark`, `ThemeToggle`, `useTheme`

AppShell props: `activityLabel="Scan"`, `detailEndpoint="get-scan"`

## Project Structure

```
src/
  main.tsx              — Entry point, Clerk auth provider, theme setup
  App.tsx               — AppShell + multi-phase UI (chat → generating → scanning → synthesizing → reviewing → report)
  index.css             — CSS variable definitions
  lib/
    types.ts            — Re-exports shared types from backend _shared/types.ts
    engineMeta.ts       — Engine display names, icons, and metadata
    sseParser.ts        — SSE stream parser utility
  hooks/
    useOrchestrator.ts  — Chat intake flow, dispatches scan config
    useScanPoller.ts    — Polls scan-status for engine query progress
    useSynthesisPoller.ts — Polls synthesis-status for synthesis/review progress
  components/
    EngineSelector.tsx  — Engine multi-select + query count input (shown in chat input area)
    ScanDashboard.tsx   — Live scan progress dashboard (per-engine progress bars)
    ScanSidebar.tsx     — Past scans list with load/delete
    report/
      AIOReport.tsx     — Main report wrapper
      ReportHeader.tsx  — Report header with concept name and share button
      KPIOverview.tsx   — Overall KPI cards (mention rate, sentiment, rank)
      EngineAwareness.tsx — Cross-engine awareness comparison
      EngineDeepDive.tsx — Per-engine detailed breakdown
      CompetitiveIntel.tsx — Competitive landscape analysis
      ActionItems.tsx   — Prioritized action roadmap
  pages/
    PublicReportPage.tsx — Public shareable report (no auth)
netlify/functions/
  _shared/              — Shared utilities (DB client, auth helpers, types.ts)
  orchestrator.mts      — Chat intake SSE endpoint (streaming)
  generate-queries.mts  — Generates diverse search queries for a concept
  dispatch-scan.mts     — Creates scan job and dispatches per-engine background functions
  scan-engine-background.mts — Background: runs queries against a single AI engine
  synthesize-engine-background.mts — Background: synthesizes results for one engine
  review-background.mts — Background: cross-engine review and final report generation
  scan-status.mts       — Poll scan progress (per-engine query completion)
  synthesis-status.mts  — Poll synthesis/review progress
  get-scan.mts          — Fetch single scan by ID (includes report_data)
  list-scans.mts        — List user's past scans
  save-scan.mts         — Create/update/delete scans
  engine-availability.mts — Check which AI engines are currently available
  report-share.mts      — Generate/manage public share links
  public-report.mts     — Fetch public report data (no auth)
  init-user.mts         — Initialize user record on first login
  admin-accounts.mts    — Admin account management
  db-migrate.mts        — Database migration utility
```

## Data Model

```typescript
type AppPhase = 'chat' | 'generating' | 'scanning' | 'synthesizing' | 'reviewing' | 'report_ready' | 'error';

type ConceptType = 'product' | 'offering' | 'concept';

type EngineId = 'chatgpt_free' | 'chatgpt_pro' | 'gemini_free' | 'gemini_pro'
  | 'claude_free' | 'claude_pro' | 'grok_free' | 'grok_pro'
  | 'perplexity' | 'copilot' | 'meta_ai' | 'google_sge';

type QueryIntentType = 'direct' | 'comparative' | 'ranked' | 'discovery' | 'sentiment' | 'contextual' | 'negative';

interface ScanConfig {
  concept_type: ConceptType; concept_name: string;
  concept_category?: string; concept_context?: string;
  engines: EngineId[]; query_count: number;
}

interface GeneratedQuery { text: string; intent_type: QueryIntentType; intent_subtype?: string; }

// AIOReportData contains: OverallKPIs, per-engine EngineSynthesis[], CrossEngineReview, ActionItem[]
```

## API Endpoints (Netlify Functions)

| Endpoint | Method | Description |
|---|---|---|
| `orchestrator` | POST (SSE) | Chat intake — streams assistant messages, dispatches scan config |
| `generate-queries` | POST | Generates diverse search queries for the concept |
| `dispatch-scan` | POST | Creates scan job, dispatches per-engine background functions |
| `scan-engine-background` | POST | Background: runs queries against one AI engine |
| `synthesize-engine-background` | POST | Background: synthesizes results for one engine |
| `review-background` | POST | Background: cross-engine review and final report |
| `scan-status` | GET | Poll scan progress (per-engine query completion) |
| `synthesis-status` | GET | Poll synthesis/review phase progress |
| `get-scan` | GET | Fetch single scan by `?id=` (includes report_data) |
| `list-scans` | GET | List all scans for authenticated user |
| `save-scan` | POST | Create, update, or delete scans |
| `engine-availability` | GET | Check which AI engines are currently available |
| `report-share` | POST | Generate or manage public share link |
| `public-report` | GET | Fetch public report (no auth required) |
| `init-user` | POST | Initialize user record on first sign-in |
| `admin-accounts` | GET/POST | Admin-only account management |
| `db-migrate` | POST | Run database migrations |

## CSS Notes

- `index.css` defines theme variables consistent with other AIDigital Labs apps
- Theme is applied via `applyTheme(aiLabsTheme)` from design system
- Public report route uses hash-based routing: `#/share/TOKEN`

## NPM Authentication

`.npmrc` at repo root:
```
@boriskulakhmetov-aidigital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

For local dev: set `NPM_TOKEN` env var to the GitHub PAT (see design system CLAUDE.md for the token).

## Architecture Reference

This app is part of the AIDigital Labs portfolio. For the full architecture (all apps, design system, theme system, conventions), see `CLAUDE.md` in the design system repo: `AIDigital-Labs-Design-System`.
