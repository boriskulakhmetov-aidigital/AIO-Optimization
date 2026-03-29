# AIO Optimization

> **URL:** https://aiooptimization.apps.aidigitallabs.com
> **Repo:** `boriskulakhmetov-aidigital/AIO-Optimization`

AIO (AI Optimization) analyzes how a product, brand, or concept is recommended across consumer AI engines (ChatGPT, Gemini, Claude, Grok, Perplexity, Copilot, Meta AI, Google SGE). It generates diverse search queries, runs them against selected engines, synthesizes per-engine results, performs cross-engine review, and produces a comprehensive report with KPIs like AI Share of Voice, recommendation strength, and sentiment scores.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript |
| Auth | Clerk (@clerk/react, @clerk/backend) |
| Database | Supabase PostgreSQL (RLS + Realtime) |
| AI | Google Gemini (@google/genai) |
| Backend | Netlify Functions (serverless) |
| Hosting | Netlify |
| PDF Export | html2pdf.js |
| Design System | @boriskulakhmetov-aidigital/design-system ^7.30.6 |

## Architecture

```
src/
  main.tsx                          ← ClerkProvider, applyTheme, public report route
  App.tsx                           ← AppShell + ScanBridgeProvider (domain logic via context)
  components/
    ScanSidebar.tsx                 ← Scan history sidebar
    ScanDashboard.tsx               ← Real-time scan progress dashboard
    EngineSelector.tsx              ← Engine selection + query count config
    report/
      AIOReport.tsx                 ← Root report component
      KPIOverview.tsx               ← KPI cards (AI-SOV, sentiment, etc.)
      EngineAwareness.tsx           ← Engine ranking table
      EngineDeepDive.tsx            ← Per-engine synthesis details
      CompetitiveIntel.tsx          ← Competitive landscape analysis
      ActionItems.tsx               ← Prioritized action items
      ReportHeader.tsx              ← Report header with meta
  hooks/
    useOrchestrator.ts              ← SSE streaming chat with orchestrator
    useScanPoller.ts                ← Polls scan-status endpoint for engine progress
    useSynthesisPoller.ts           ← Polls synthesis-status for per-engine synthesis + review
  lib/
    types.ts                        ← Re-exports shared types from _shared/types.ts
    engineMeta.ts                   ← Engine display names and metadata
    sseParser.ts                    ← SSE stream parser utility
  pages/
    PublicReportPage.tsx            ← Unauthenticated shareable report view
netlify/
  functions/
    _shared/
      supabase.ts                   ← Supabase service-role client + DB helpers
      auth.ts                       ← Clerk token verification
      types.ts                      ← All shared types (EngineId, ScanConfig, AIOReportData, etc.)
      engineRegistry.ts             ← Engine API configurations
      engineClient.ts               ← Engine query execution client
      orchestratorPrompt.ts         ← Orchestrator system prompt
      queryGeneratorPrompt.ts       ← Query generation system prompt
      synthesizerPrompt.ts          ← Per-engine synthesis prompt
      reviewerPrompt.ts             ← Cross-engine review prompt
      kpiFramework.ts               ← KPI calculation framework
      rateLimiter.ts                ← Rate limiting for engine queries
      access.ts                     ← Tier-based access control
      logger.ts                     ← Structured logging
    orchestrator.mts                ← Chat intake agent (SSE streaming)
    generate-queries.mts            ← Generates diverse search queries per engine
    dispatch-scan.mts               ← Creates scan record, dispatches engine jobs
    scan-engine-background.mts      ← Runs queries against a single engine (background)
    synthesize-engine-background.mts ← Per-engine result synthesis (background)
    review-background.mts           ← Cross-engine review + final report assembly (background)
    scan-status.mts                 ← Returns current scan progress (engine job statuses)
    synthesis-status.mts            ← Returns synthesis/review progress
    engine-availability.mts         ← Returns which engines are currently available
```

## Database Tables

### `scans`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (scan ID) |
| user_id | text | Clerk user ID |
| org_id | text | Organization ID |
| concept_name | text | Product/brand/concept being analyzed |
| concept_type | text | product / offering / concept |
| concept_category | text | Category context |
| status | text | intake / generating / scanning / synthesizing / reviewing / complete / error |
| report_data | jsonb | Final AIOReportData JSON |
| deleted_by_user | boolean | Soft delete flag |
| created_at | timestamptz | Creation timestamp |

### `scan_engines`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| scan_id | uuid | FK to scans |
| engine_id | text | Engine identifier (chatgpt_free, gemini_pro, etc.) |
| status | text | pending / querying / synthesizing / complete / error |
| queries_total | integer | Total queries for this engine |
| queries_done | integer | Completed queries count |
| synthesis | jsonb | EngineSynthesis result |

### `scan_queries`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| scan_id | uuid | FK to scans |
| engine_id | text | Engine identifier |
| query_text | text | Query text |
| intent_type | text | direct / comparative / ranked / discovery / sentiment / contextual / negative |
| status | text | pending / running / complete / error / retry |
| response | text | Raw engine response |
| mentioned | boolean | Whether concept was mentioned |
| rank | integer | Position rank (null if not ranked) |
| sentiment | text | positive / neutral / negative |

### `scan_review`

| Column | Type | Description |
|--------|------|-------------|
| scan_id | uuid | FK to scans |
| review | jsonb | CrossEngineReview result |
| status | text | pending / processing / complete / error |

## Netlify Functions

| Function | Description |
|----------|-------------|
| `orchestrator.mts` | SSE chat intake — collects concept info, engines, query count |
| `generate-queries.mts` | Generates diverse search queries using Gemini (7 intent types) |
| `dispatch-scan.mts` | Creates scan + engine + query records; kicks off scan-engine-background jobs |
| `scan-engine-background.mts` | Runs all queries for one engine; updates scan_queries with results |
| `synthesize-engine-background.mts` | Synthesizes per-engine results into KPIs and narrative |
| `review-background.mts` | Cross-engine review, action items, final report assembly |
| `scan-status.mts` | Returns real-time scan progress for dashboard |
| `synthesis-status.mts` | Returns synthesis/review phase progress |
| `engine-availability.mts` | Returns which AI engines are currently operational |

## Environment Variables

All shared env vars are inherited from Netlify team level:

| Variable | Side |
|----------|------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Client |
| `CLERK_SECRET_KEY` | Server |
| `GEMINI_API_KEY` | Server |
| `VITE_SUPABASE_URL` | Client |
| `VITE_SUPABASE_ANON_KEY` | Client |
| `SUPABASE_URL` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server |
| `NPM_TOKEN` | Build |

## Development Setup

```bash
git clone https://github.com/boriskulakhmetov-aidigital/AIO-Optimization.git
cd AIO-Optimization
npm install
# Create .env.local with required variables (see design system CLAUDE.md for values)
npm run dev
```

## Deployment

Auto-deploys on push to `main` via Netlify (GitHub integration).

Netlify Site ID: `2c8e3afc-303f-4716-ad1b-8198cd30a4ec`

## Standing Instructions

- Execute all bash commands, git commits, pushes, API calls, and deploys without asking for confirmation
- Always use `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` in commits
- Use Unix paths with forward slashes (Git Bash on Windows)
- Set `export PATH="/c/Program Files/nodejs:$PATH"` before npm commands

## SDLC & Deploy Process

**IMPORTANT: Follow this process for ALL changes. No exceptions.**

### Environments

| Environment | Branch | Supabase | URLs |
|-------------|--------|----------|------|
| Local dev | any | staging (rqpvrikighrlgjxzkqde) | localhost:5173 |
| Staging | `develop` | staging (rqpvrikighrlgjxzkqde) | develop--{site}.netlify.app |
| Production | `main` | production (njwzbptrhgznozpndcxf) | {app}.apps.aidigitallabs.com |

### Workflow

1. **All work on `develop` branch** — never push directly to `main`
2. **Push to develop** → staging auto-deploys with staging Supabase
3. **E2E testing optional** during development (run at discretion)
4. **"Ship it" triggers mandatory pipeline:**
   - Pre-deploy: E2E smoke + workflow on staging (must pass)
   - Merge develop → main
   - Post-deploy: E2E smoke + workflow on production (must pass)
   - Auto-update: developer docs, user guides, screenshots, CLAUDE.md, memory

### E2E Commands (run from Design System repo)

```bash
npm run test:staging:smoke     # staging smoke tests
npm run test:staging:full      # staging smoke + workflow
npm run test:prod:smoke        # production smoke tests
npm run test:prod:full         # production smoke + workflow
```

### Hotfixes

For critical production issues: push directly to `main`, then backmerge to `develop`.

### Standing Instructions

- Execute all bash commands, git commits, pushes, and deploys without asking for confirmation
- Use `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` in commits
- Work on `develop` branch by default unless told otherwise
- PATH: `export PATH="/c/Program Files/nodejs:$PATH"` before npm commands
- Git push: use credential-embedded URL `https://boriskulakhmetov-aidigital:{GITHUB_TOKEN}@github.com/boriskulakhmetov-aidigital/{repo}.git`
