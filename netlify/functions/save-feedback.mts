/**
 * POST /.netlify/functions/save-feedback
 *
 * Save user feedback for AIO report sections.
 * Uses DS ./learning module for storage, computes embedding locally via @google/genai.
 */
import { requireAuth } from './_shared/auth.ts'
import { log } from './_shared/logger.ts'
import { logFeedback, buildEmbeddingText } from '@AiDigital-com/design-system/learning'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function computeEmbedding(text: string): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: { outputDimensionality: 768 },
  })
  return result.embeddings?.[0]?.values ?? []
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const { userId } = await requireAuth(req)
    const body = await req.json()

    const { sessionId, app, jobId, score, feedbackText, outputText, inputSnapshot } = body

    if (!sessionId || !app || score == null || !outputText) {
      return Response.json({ error: 'sessionId, app, score, and outputText are required' }, { status: 400 })
    }

    if (score < 0 || score > 5) {
      return Response.json({ error: 'score must be 0-5' }, { status: 400 })
    }

    const outputSummary = outputText.slice(0, 500)
    const embeddingText = buildEmbeddingText({ app, inputSnapshot, outputSummary, score, feedbackText })

    let embedding: number[] = []
    try {
      embedding = await computeEmbedding(embeddingText)
    } catch (err: any) {
      log.warn('embedding.failed', {
        function_name: 'save-feedback',
        message: err?.message ?? String(err),
        meta: { embeddingTextLength: embeddingText.length },
      })
    }

    const supabase = getSupabase()
    await logFeedback(supabase, {
      sessionId,
      userId,
      app,
      jobId,
      score,
      feedbackText,
      outputSummary,
      inputSnapshot,
      embedding: embedding.length > 0 ? embedding : undefined,
    })

    log.info('feedback.saved', {
      function_name: 'save-feedback',
      user_id: userId,
      meta: { app, score, jobId, section: inputSnapshot?.section, hasEmbedding: embedding.length > 0 },
    })

    return Response.json({ ok: true })
  } catch (err: any) {
    log.error('feedback.error', { function_name: 'save-feedback', message: err.message })
    return Response.json({ error: err.message }, { status: 500 })
  }
}
