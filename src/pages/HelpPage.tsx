import { useEffect } from 'react';
import { HelpPage, applyTheme, resolveTheme } from '@boriskulakhmetov-aidigital/design-system';
import '@boriskulakhmetov-aidigital/design-system/style.css';

const GUIDE = `# AIO Optimization — User Guide

**Tool:** [AIO Optimization](https://aio-optimization.apps.aidigitallabs.com)

AIO (AI Optimization) audits how AI search engines perceive your brand. It queries tools like ChatGPT, Gemini, Perplexity, and others to see what they say about you — and gives you a clear plan to improve your AI search visibility.

---

## Getting Started

### 1. Sign In

Open the app and sign in with your AIDigital Labs account.

### 2. Enter Your Brand and Domain

Tell the AI what brand or product you want to scan:

- "Scan how AI engines see Acme Corp at acme.com"
- "Check what ChatGPT and Gemini say about our SaaS product"
- "Audit AI visibility for our brand in the project management space"

### 3. Select AI Engines

Choose which AI search engines to include in the scan:

- **ChatGPT** (OpenAI)
- **Gemini** (Google)
- **Perplexity**
- **Claude** (Anthropic)
- And others as available

> **Tip:** Select all engines for a comprehensive view. Each AI has different training data and will surface different information about your brand.

### 4. Set the Number of Queries

Choose how many queries to run. More queries give a broader picture but take longer:

- **Quick scan** — 5–10 queries (2–3 minutes)
- **Standard scan** — 15–25 queries (5–8 minutes)
- **Deep scan** — 30+ queries (10–15 minutes)

### 5. Wait for the Multi-Engine Scan

The AI runs your queries across all selected engines simultaneously. A progress indicator shows you which engines have completed.

### 6. Review the Synthesis Report

The report includes:

- **Visibility Score** — how well AI engines know and represent your brand
- **Engine-by-Engine Breakdown** — what each AI says about you
- **Sentiment Analysis** — positive, neutral, or negative mentions
- **Competitor Comparison** — how your brand stacks up against competitors in AI responses
- **Recommendations** — specific actions to improve your AI search presence

### 7. Download or Share

Export the report as PDF or share it via link.

---

## What to Expect

| Step | Time |
|------|------|
| Enter brand info and select engines | 1–2 minutes |
| Configure scan parameters | 1 minute |
| Multi-engine scan | 2–15 minutes (varies by scope) |
| **Total** | **4–18 minutes** |

---

## Tips

- **Run scans regularly.** AI models update frequently. A monthly scan helps you track whether your visibility is improving.

- **Include competitor names.** Mention key competitors so the AI can compare how engines position you relative to them.

- **Focus on your core topics.** If you're a CRM company, make sure the scan queries include terms your customers would use when asking AI for CRM recommendations.

- **Act on the recommendations.** The most common improvements include updating your website's structured data, publishing authoritative content, and getting mentioned on trusted third-party sites.

- **Use dark mode** for a more comfortable viewing experience. Toggle it in the top-right corner.

---

## Your Past Scans

All scans are saved automatically. Use the sidebar to browse previous scans and track changes over time.
`;

export default function AppHelpPage() {
  useEffect(() => { applyTheme(resolveTheme()); }, []);
  return <HelpPage markdown={GUIDE} />;
}
