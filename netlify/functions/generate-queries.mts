import { createLLMProvider } from '@AiDigital-com/design-system/server';
import { requireAuthOrEmbed } from './_shared/auth.js';
import { buildQueryGeneratorPrompt } from './_shared/queryGeneratorPrompt.js';
import { log } from './_shared/logger.js';
import type { ConceptType, GeneratedQuery, EngineId } from './_shared/types.js';
import { QUERY_COUNT_MIN, QUERY_COUNT_MAX, QUERY_COUNT_DEFAULT } from './_shared/constants.js';

/**
 * POST /generate-queries
 *
 * Takes the scan config from the orchestrator and generates ~N queries
 * using Gemini. Returns the queries grouped by engine (same queries for
 * all engines, since we're testing how each engine responds to the same prompts).
 */
export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let userId: string | undefined;
  let email: string | null = null;
  try {
    const auth = await requireAuthOrEmbed(req);
    userId = auth.userId;
    email = auth.email;

    const body = await req.json();
    const {
      concept_type,
      concept_name,
      concept_category,
      concept_context,
      engines,
      query_count = QUERY_COUNT_DEFAULT,
    } = body as {
      concept_type: ConceptType;
      concept_name: string;
      concept_category: string;
      concept_context?: string;
      engines: EngineId[];
      query_count?: number;
    };

    if (!concept_type || !concept_name || !concept_category) {
      return Response.json({ error: 'Missing required fields: concept_type, concept_name, concept_category' }, { status: 400 });
    }
    if (!engines || engines.length === 0) {
      return Response.json({ error: 'At least one engine must be selected' }, { status: 400 });
    }

    const clampedCount = Math.max(QUERY_COUNT_MIN, Math.min(QUERY_COUNT_MAX, query_count));

    log.info('generate-queries.start', {
      function_name: 'generate-queries',
      user_id: userId,
      user_email: email,
      ai_provider: 'gemini',
      ai_model: 'gemini-3-flash-preview',
      meta: { concept_name, concept_type, concept_category, engines: engines.length, query_count: clampedCount },
    });

    // Generate queries using Gemini
    const prompt = buildQueryGeneratorPrompt({
      conceptType: concept_type,
      conceptName: concept_name,
      conceptCategory: concept_category,
      conceptContext: concept_context,
      queryCount: clampedCount,
    });

    const llm = createLLMProvider('gemini', process.env.GEMINI_API_KEY!, 'fast');

    // Retry up to 2 times on parse failures or transient errors
    let queries: GeneratedQuery[] = [];
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { text: responseText } = await llm.generateContent({
          system: 'Generate search queries as a JSON array.',
          userParts: [{ text: prompt }],
          maxTokens: 4096,
          jsonMode: true,
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                intent_type: { type: 'string' },
                intent_subtype: { type: 'string' },
              },
              required: ['text', 'intent_type'],
            },
          },
        });

        // Parse the JSON array of queries
        try {
          queries = JSON.parse(responseText);
          if (!Array.isArray(queries)) throw new Error('Response is not an array');
        } catch {
          // Try to extract JSON array from the response
          const match = responseText.match(/\[[\s\S]*\]/);
          if (match) {
            queries = JSON.parse(match[0]);
          } else {
            lastError = 'Failed to parse query generation response';
            continue; // retry
          }
        }
        break; // success
      } catch (err: any) {
        lastError = err.message || String(err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000)); // wait before retry
      }
    }

    if (queries.length === 0) {
      return Response.json({ error: lastError || 'Failed to generate queries after 3 attempts' }, { status: 500 });
    }

    // Validate and clean queries
    queries = queries
      .filter(q => q.text && q.intent_type)
      .map(q => ({
        text: q.text.trim(),
        intent_type: q.intent_type,
        intent_subtype: q.intent_subtype,
      }));

    // Same queries sent to all engines (we test how each engine responds)
    const queriesByEngine: Record<string, GeneratedQuery[]> = {};
    for (const engineId of engines) {
      queriesByEngine[engineId] = queries;
    }

    log.info('generate-queries.complete', {
      function_name: 'generate-queries',
      user_id: userId,
      user_email: email,
      meta: { query_count: queries.length, engines: engines.length, total_api_calls: queries.length * engines.length },
    });

    return Response.json({
      queries,
      queries_by_engine: queriesByEngine,
      total_queries: queries.length,
      engines_count: engines.length,
      total_api_calls: queries.length * engines.length,
    });
  } catch (err) {
    log.error('generate-queries.error', {
      function_name: 'generate-queries',
      user_id: userId,
      user_email: email,
      message: err instanceof Error ? err.message : String(err),
    });
    console.error('generate-queries error:', err);
    const status = String(err).includes('Unauthorized') ? 401 : 500;
    return Response.json({ error: String(err) }, { status });
  }
};