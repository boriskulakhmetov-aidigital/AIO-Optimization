import { useEffect } from 'react';
import { HelpPage, applyTheme, resolveTheme } from '@boriskulakhmetov-aidigital/design-system';
import { getAppUrl } from '@boriskulakhmetov-aidigital/design-system/utils';
import '@boriskulakhmetov-aidigital/design-system/style.css';

const GUIDE = `# AIO Optimization — User Guide

**Tool:** [AIO Optimization](${getAppUrl('aio-optimization')})

AIO (AI Optimization) audits how AI search engines perceive your brand. It queries tools like ChatGPT, Gemini, Perplexity, and others to see what they say about you — and gives you a clear plan to improve your AI search visibility.

---

## Getting Started

### 1. Sign In

Open the app and sign in with your AIDigital Labs account.

![Landing page after sign-in](/guide/aio-optimization-01-landing.png)

### 2. Enter Your Brand Details

Tell the AI what brand or product you want to scan. Provide:

- **Brand or product name**
- **Concept type** (e.g., company, product, service)
- **Category** (e.g., "project management software", "organic skincare")

For example: "Scan Acme Corp, a B2B SaaS company in the project management space."

### 3. Select AI Engines

Choose which AI search engines to include in the scan:

- **ChatGPT** (OpenAI)
- **Gemini** (Google)
- **Perplexity**
- **Claude** (Anthropic)
- And others as available

> **Tip:** Select all engines for a comprehensive view. Each AI has different training data and will surface different information about your brand.

![AI response with engine selection](/guide/aio-optimization-02-ai-response.png)

### 4. Set the Number of Queries

Choose how many queries to run. More queries give a broader picture but take longer:

- **Quick scan** — 5–10 queries (2–3 minutes)
- **Standard scan** — 15–25 queries (5–8 minutes)
- **Deep scan** — 30+ queries (10–15 minutes)

![Conversation with scan configuration](/guide/aio-optimization-02-conversation.png)

### 5. Wait for the Multi-Engine Scan

The AI runs your queries across all selected engines in parallel. A progress indicator shows which engines have completed.

This is the longest-running tool in the suite — a comprehensive multi-engine scan takes **10-15 minutes**. The parallel execution means you're getting results from multiple AI engines simultaneously.

![Scan dispatched and in progress](/guide/aio-optimization-03-dispatched.png)

![Engines scanning in parallel](/guide/aio-optimization-04-scanning.png)

### 6. Review the Synthesis Report

The report includes:

- **Visibility Score** — how well AI engines know and represent your brand
- **Engine-by-Engine Breakdown** — what each AI says about you
- **Sentiment Analysis** — positive, neutral, or negative mentions
- **Competitor Comparison** — how your brand stacks up against competitors in AI responses
- **Recommendations** — specific actions to improve your AI search presence

### 7. Download or Share

Export the report as Markdown, PDF, or share it via link.

---

## What to Expect

| Step | Time |
|------|------|
| Enter brand name, concept type, and category | 1 minute |
| Select engines and set query count | 1 minute |
| Multi-engine parallel scan | 10–15 minutes |
| **Total** | **12–17 minutes** |

> AIO scans take the longest of any tool because they query multiple external AI engines. The wait is worth it — you get a comprehensive view of your AI search presence across all major platforms.

---

## Tips

- **Run scans regularly.** AI models update frequently. A monthly scan helps you track whether your visibility is improving.

- **Include competitor names.** Mention key competitors so the AI can compare how engines position you relative to them.

- **Focus on your core topics.** If you're a CRM company, make sure the scan queries include terms your customers would use when asking AI for CRM recommendations.

- **Act on the recommendations.** The most common improvements include updating your website's structured data, publishing authoritative content, and getting mentioned on trusted third-party sites.

- **Use dark mode** for a more comfortable viewing experience. Toggle it in the top-right corner.

![Dark Mode](/guide/aio-optimization-dark.png)

---

## Your Past Scans

All scans are saved automatically. Use the sidebar to browse previous scans and track changes over time.

![Session History](/guide/aio-optimization-sidebar.png)
`;

export default function AppHelpPage() {
  useEffect(() => { applyTheme(resolveTheme()); }, []);
  return <HelpPage markdown={GUIDE} />;
}
