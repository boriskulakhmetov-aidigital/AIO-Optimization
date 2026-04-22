import type {
  RawReport,
  AIOData,
  EngineRow,
  EngineIdentity,
  MatrixRow,
  IntentType,
  IntentAggregate,
  KlassStatus,
  Grade,
} from './types';

// Engine identity — product/provider tuple + DS slug for rendering real brand icons.
const ENGINE_META: Record<string, EngineIdentity> = {
  chatgpt_free: { slug: 'chatgpt',    short: 'ChatGPT',    brand: 'OpenAI',     mark: 'GP', hue: 158, glyph: '◎' },
  chatgpt_pro:  { slug: 'chatgpt',    short: 'ChatGPT',    brand: 'OpenAI',     mark: 'GP', hue: 158, glyph: '◎' },
  claude_free:  { slug: 'claude',     short: 'Claude',     brand: 'Anthropic',  mark: 'CL', hue: 22,  glyph: '✦' },
  claude_pro:   { slug: 'claude',     short: 'Claude',     brand: 'Anthropic',  mark: 'CL', hue: 22,  glyph: '✦' },
  claude:       { slug: 'claude',     short: 'Claude',     brand: 'Anthropic',  mark: 'CL', hue: 22,  glyph: '✦' },
  gemini_free:  { slug: 'gemini',     short: 'Gemini',     brand: 'Google',     mark: 'GM', hue: 230, glyph: '◇' },
  gemini_pro:   { slug: 'gemini',     short: 'Gemini',     brand: 'Google',     mark: 'GM', hue: 230, glyph: '◇' },
  google_sge:   { slug: 'google',     short: 'Google AI',  brand: 'Google',     mark: 'GA', hue: 210, glyph: '◉' },
  grok_free:    { slug: 'grok',       short: 'Grok',       brand: 'xAI',        mark: 'GR', hue: 0,   glyph: '✕' },
  grok_pro:     { slug: 'grok',       short: 'Grok',       brand: 'xAI',        mark: 'GR', hue: 0,   glyph: '✕' },
  perplexity:   { slug: 'perplexity', short: 'Perplexity', brand: 'Perplexity', mark: 'PX', hue: 185, glyph: '◐' },
  meta_ai:      { slug: 'meta',       short: 'Meta AI',    brand: 'Meta',       mark: 'MA', hue: 213, glyph: '∞' },
  copilot:      { slug: 'copilot',    short: 'Copilot',    brand: 'Microsoft',  mark: 'MC', hue: 230, glyph: '❖' },
};

export function engineMeta(id: string): EngineIdentity {
  return (
    ENGINE_META[id] || {
      slug: 'openai',
      short: id,
      brand: '',
      mark: id.slice(0, 2).toUpperCase(),
      hue: 200,
      glyph: '◯',
    }
  );
}

// --- Intent order + labels ---
export const INTENT_ORDER: IntentType[] = [
  'direct',
  'comparative',
  'ranked',
  'discovery',
  'sentiment',
  'contextual',
  'negative',
];

export const INTENT_LABEL: Record<IntentType, string> = {
  direct:      'Direct',
  comparative: 'Comparative',
  ranked:      'Ranked',
  discovery:   'Discovery',
  sentiment:   'Sentiment',
  contextual:  'Contextual',
  negative:    'Negative',
};

export const INTENT_DESC: Record<IntentType, string> = {
  direct:      'Buyer wants a specific pick.',
  comparative: 'Brand vs. another brand.',
  ranked:      '“Top N …” style queries.',
  discovery:   'Open-ended exploration.',
  sentiment:   'Reputation + trust checks.',
  contextual:  'Scoped by region / need.',
  negative:    'Downsides + deflection.',
};

// --- Status class helpers ---

/**
 * Generic score → status class. Thresholds are `[good, mid, low]` in descending order.
 * Anything below `low` maps to 'bad'; null/undefined → 'na'.
 */
export function klassFromScore(
  v: number | null | undefined,
  thresholds: [number, number, number] = [70, 50, 30]
): KlassStatus {
  if (v == null) return 'na';
  if (v >= thresholds[0]) return 'good';
  if (v >= thresholds[1]) return 'mid';
  if (v >= thresholds[2]) return 'low';
  return 'bad';
}

export function klassFromGrade(g: Grade | null | undefined): KlassStatus {
  if (!g) return 'na';
  if (g === 'A' || g === 'A+' || g === 'A-') return 'good';
  if (g === 'B' || g === 'B+' || g === 'B-') return 'good-mid';
  if (g === 'C' || g === 'C+' || g === 'C-') return 'mid';
  if (g === 'D' || g === 'D+' || g === 'D-') return 'low';
  return 'bad';
}

export function klassSentiment(v: number | null | undefined): KlassStatus {
  if (v == null) return 'na';
  if (v >= 50) return 'good';
  if (v >= 20) return 'mid';
  if (v >= 0) return 'low';
  return 'bad';
}

export function klassMention(v: number | null | undefined): KlassStatus {
  if (v == null) return 'na';
  if (v >= 70) return 'good';
  if (v >= 40) return 'mid';
  if (v > 0) return 'low';
  return 'bad';
}

// --- Priority rank for sorting action items ---
const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Normalize the raw AIO scan payload into the shape used by the UI.
 * Mirrors the vanilla prototype's data.js 1:1.
 */
export function normalizeReport(raw: RawReport): AIOData {
  const session = raw.session;
  const rd = session.report_data;
  const meta = rd.meta;
  const kpis = rd.overall_kpis;
  const cer = rd.cross_engine_review;
  const syntheses = rd.engine_syntheses || [];
  const queryLog = rd.query_log || [];

  // --- Engine rows ---
  const engineRankings = cer.engine_rankings || [];
  const engines: EngineRow[] = syntheses
    .map((s) => {
      const rank = engineRankings.find((r) => r.engine_id === s.engine_id);
      const em = engineMeta(s.engine_id);
      return {
        id: s.engine_id,
        name: s.engine_name,
        slug: em.slug,
        short: em.short,
        brand: em.brand,
        mark: em.mark,
        hue: em.hue,
        glyph: em.glyph,
        aiSov: s.ai_sov,
        top3Rate: s.top3_rate,
        firstPositionRate: s.first_position_rate,
        netSentiment: s.net_sentiment_score,
        rsi: s.recommendation_strength_index,
        rsiPct: Math.round((s.recommendation_strength_index || 0) * 100),
        competitiveWinRate: s.competitive_win_rate,
        discoveryCaptureRate: s.discovery_capture_rate,
        avgRankPosition: s.avg_rank_position,
        queriesTotal: s.queries_total,
        queriesCompleted: s.queries_completed,
        queriesFailed: s.queries_failed,
        grade: rank?.overall_grade ?? null,
        gradeKlass: klassFromGrade(rank?.overall_grade),
        awarenessLabel: rank?.awareness_label || '—',
        investmentLevel: rank?.investment_level || '—',
        summaryText: s.summary_text || '',
        intentBreakdown: (s.intent_breakdown || [])
          .slice()
          .sort(
            (a, b) =>
              INTENT_ORDER.indexOf(a.intent_type) -
              INTENT_ORDER.indexOf(b.intent_type)
          ),
        topPositive: s.top_positive_responses || [],
        topNegative: s.top_negative_responses || [],
        sovKlass: klassFromScore(s.ai_sov, [50, 30, 15]),
        sentimentKlass: klassSentiment(s.net_sentiment_score),
      };
    })
    .sort((a, b) => (b.aiSov || 0) - (a.aiSov || 0));

  // --- Strongest / weakest engine ---
  const bestEngine = engines
    .slice()
    .sort(
      (a, b) =>
        b.aiSov + b.netSentiment / 2 - (a.aiSov + a.netSentiment / 2)
    )[0];
  const worstEngine = engines
    .slice()
    .sort(
      (a, b) =>
        a.aiSov + a.netSentiment / 2 - (b.aiSov + b.netSentiment / 2)
    )[0];
  const highSovEngine = engines
    .slice()
    .sort((a, b) => b.aiSov - a.aiSov)[0];

  // --- Intent aggregates across all engines ---
  const intentAgg: IntentAggregate[] = INTENT_ORDER.map((it) => {
    const rows = engines.flatMap((e) =>
      e.intentBreakdown.filter((x) => x.intent_type === it)
    );
    if (!rows.length) return null;
    const mention_rate =
      rows.reduce((a, r) => a + (r.mention_rate || 0), 0) / rows.length;
    const avg_sentiment =
      rows.reduce((a, r) => a + (r.avg_sentiment || 0), 0) / rows.length;
    const query_count = rows[0]?.query_count || 0;
    return {
      intent_type: it,
      label: INTENT_LABEL[it],
      desc: INTENT_DESC[it],
      mention_rate,
      avg_sentiment,
      query_count,
    };
  }).filter((x): x is IntentAggregate => x != null);

  // --- Engine × Intent matrix ---
  const matrix: MatrixRow[] = engines.map((e) => ({
    engine: e,
    cells: INTENT_ORDER.map((it) => {
      const row = e.intentBreakdown.find((x) => x.intent_type === it);
      if (!row) return { intent: it, empty: true };
      return {
        intent: it,
        mentionRate: row.mention_rate,
        mentionKlass: klassMention(row.mention_rate),
        sentiment: row.avg_sentiment,
        queryCount: row.query_count,
        avgRank: row.avg_rank ?? null,
      };
    }),
  }));

  // --- Priority actions ---
  const actions = (cer.action_items || [])
    .slice()
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    );

  // --- Sentiment + mention distribution ---
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  const mentionCounts = { mentioned: 0, missed: 0 };
  queryLog.forEach((q) => {
    if (q.sentiment && sentimentCounts[q.sentiment] != null) {
      sentimentCounts[q.sentiment]++;
    }
    if (q.mentioned) mentionCounts.mentioned++;
    else mentionCounts.missed++;
  });
  const totalQ = queryLog.length;

  // --- Top queries ---
  const bestQueries = queryLog
    .filter((q) => q.mentioned && q.sentiment === 'positive')
    .slice(0, 6);
  const missedQueries = queryLog.filter((q) => !q.mentioned).slice(0, 6);
  const negativeQueries = queryLog
    .filter((q) => q.sentiment === 'negative')
    .slice(0, 6);

  // --- Brand + date ---
  const brand = meta.concept_name || session.concept_name || 'Brand';
  const brandPretty = brand.replace(/\b\w/g, (c) => c.toUpperCase());
  const scanDate = meta.scan_date ? new Date(meta.scan_date) : null;
  const scanDateLabel = scanDate
    ? scanDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const overall = {
    aiSov: kpis.ai_sov ?? cer.overall_ai_sov ?? 0,
    firstPositionRate: kpis.first_position_rate ?? cer.overall_first_position_rate ?? 0,
    netSentiment: kpis.net_sentiment ?? cer.overall_net_sentiment ?? 0,
    top3Rate: kpis.top3_rate ?? 0,
    rsi: kpis.rsi ?? 0,
    competitiveWinRate: kpis.competitive_win_rate ?? 0,
    discoveryCaptureRate: kpis.discovery_capture_rate ?? 0,
    engineConsistency: kpis.engine_consistency ?? cer.engine_consistency ?? 0,
    totalQueries: meta.total_queries || queryLog.length,
    enginesTested:
      (meta.engines_tested || []).length || engines.length,
    scanDurationSeconds: meta.scan_duration_seconds || null,
  };

  const execSummary = cer.executive_summary || rd.executive_summary || '';
  const biggestGap = cer.biggest_gap || '';
  const competitiveLandscape = cer.competitive_landscape || '';
  const mostAwareEngine =
    engines.find((e) => e.id === cer.most_aware_engine) || highSovEngine;
  const highestInvestmentEngine =
    engines.find((e) => e.id === cer.highest_investment_engine) || worstEngine;

  return {
    brand,
    brandPretty,
    scanDateLabel,
    concept: {
      name: session.concept_name,
      type: session.concept_type,
      category: session.concept_category,
      context: session.concept_context,
    },
    overall,
    execSummary,
    biggestGap,
    competitiveLandscape,
    engines,
    matrix,
    intentAgg,
    bestEngine,
    worstEngine,
    highSovEngine,
    mostAwareEngine,
    highestInvestmentEngine,
    actions,
    sentimentCounts,
    mentionCounts,
    totalQ,
    bestQueries,
    missedQueries,
    negativeQueries,
    queryLog,
    INTENT_ORDER,
    INTENT_LABEL,
    INTENT_DESC,
  };
}

// --- Small display utilities used across views ---
export const stripMd = (s: string | null | undefined): string =>
  String(s || '')
    .replace(/\*\*/g, '')
    .replace(/[#_`]/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function firstSentences(s: string, n = 2): string {
  const clean = stripMd(s);
  const parts = clean.split(/(?<=[.!?])\s+/).slice(0, n);
  return parts.join(' ').trim();
}
