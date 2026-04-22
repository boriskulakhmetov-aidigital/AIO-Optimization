import { useState, useEffect, useRef, useCallback } from 'react'
import {
  EmbedLayout, ChatPanel,
  applyTheme, resolveTheme, aiLabsTheme,
  useScanProgress, useJobStatus,
} from '@AiDigital-com/design-system'
import type { SupabaseClient } from '@AiDigital-com/design-system'
import '@AiDigital-com/design-system/style.css'
import { createClient } from '@supabase/supabase-js'
import { parseSSEStream } from '@AiDigital-com/design-system'
import type { AppPhase, AIOReportData } from '../lib/types'
import { ScanDashboard } from '../components/ScanDashboard'
import { MicroReport } from '../components/micro-report/MicroReport'

const APP_NAME = 'aio-optimization'
const APP_TITLE = 'AIO Optimization'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

interface ScanDispatchConfig {
  concept_type: string
  concept_name: string
  concept_category: string
  concept_context?: string
  engines: string[]
  query_count: number
}

interface Props { token: string; theme?: string }

export default function EmbedPage({ token, theme }: Props) {
  const [validated, setValidated] = useState<boolean | null>(null)
  const [error, setError] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const sessionIdRef = useRef(crypto.randomUUID())
  const messagesRef = useRef<ChatMessage[]>([])

  const [phase, setPhase] = useState<AppPhase>('chat')
  const [scanId, setScanId] = useState<string | null>(null)
  const [conceptName, setConceptName] = useState('')
  const [reportData, setReportData] = useState<AIOReportData | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const supabaseRef = useRef<SupabaseClient>(createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as any)

  // Embed-compatible authFetch that uses X-Embed-Token instead of Clerk JWT
  const embedFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const headers = new Headers(options?.headers)
    headers.set('X-Embed-Token', token)
    return fetch(url, { ...options, headers })
  }, [token])

  // Realtime subscriptions (replace polling)
  const engineProgress = useScanProgress(
    supabaseRef.current,
    phase === 'scanning' || phase === 'synthesizing' ? scanId : null,
  )
  const jobStatus = useJobStatus(
    supabaseRef.current,
    phase === 'scanning' || phase === 'synthesizing' || phase === 'reviewing' ? scanId : null,
  )

  useEffect(() => {
    if (theme) {
      const resolved = resolveTheme({ slug: theme })
      applyTheme(resolved || aiLabsTheme)
    } else {
      applyTheme(aiLabsTheme)
    }

    supabaseRef.current.rpc('validate_embed_token', {
      p_token: token,
      p_app: APP_NAME,
      p_origin: window.location.origin,
    }).then(({ data, error: err }: any) => {
      if (err || !data?.valid) {
        setError(data?.reason || err?.message || 'Invalid embed token')
        setValidated(false)
      } else {
        setValidated(true)
      }
    })
  }, [token, theme])

  // Scan dispatch handler — writes to pipeline_tasks via embed-submit
  const handleScanDispatch = useCallback(async (config: ScanDispatchConfig, sid: string, msgs: ChatMessage[]) => {
    if (!config.engines?.length) {
      setErrorDetail('No engines selected. Please select at least one AI engine.')
      setPhase('error')
      return
    }

    setConceptName(config.concept_name)
    setScanId(sid)
    setPhase('scanning')
    setErrorDetail(null)

    try {
      const res = await embedFetch('/.netlify/functions/embed-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: sid,
          config: {
            concept_type: config.concept_type,
            concept_name: config.concept_name,
            concept_category: config.concept_category,
            concept_context: config.concept_context,
            engines: config.engines,
            query_count: config.query_count,
          },
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        setErrorDetail(`Submit failed (${res.status}): ${errText}`)
        setPhase('error')
      }
    } catch (err) {
      setErrorDetail(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setPhase('error')
    }
  }, [embedFetch])

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (streaming) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    messagesRef.current = [...messagesRef.current, userMsg]
    setMessages([...messagesRef.current])
    setStreaming(true)
    setChatError(null)

    try {
      const res = await fetch('/.netlify/functions/orchestrator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Embed-Token': token,
        },
        body: JSON.stringify({
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error(`Server error: ${res.status}`)

      const asstId = crypto.randomUUID()
      let assistantText = ''

      for await (const event of parseSSEStream(res.body)) {
        if (event.type === 'text_delta') {
          assistantText += event.text
          setMessages(prev => {
            const existing = prev.find(m => m.id === asstId)
            if (existing) return prev.map(m => m.id === asstId ? { ...m, content: assistantText } : m)
            return [...prev, { id: asstId, role: 'assistant', content: assistantText }]
          })
          messagesRef.current = messagesRef.current.find(m => m.id === asstId)
            ? messagesRef.current.map(m => m.id === asstId ? { ...m, content: assistantText } : m)
            : [...messagesRef.current, { id: asstId, role: 'assistant', content: assistantText }]
        } else if (event.type === 'scan_dispatch') {
          const config = (event as any).scanConfig as unknown as ScanDispatchConfig
          handleScanDispatch(config, sessionIdRef.current, messagesRef.current)
        } else if (event.type === 'error') {
          throw new Error((event as any).message)
        }
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setStreaming(false)
    }
  }, [streaming, token, handleScanDispatch])

  // Phase transitions via jobStatus (Realtime)
  const jobMeta = (jobStatus as any)?.meta as { phase?: string } | undefined
  useEffect(() => {
    if (!jobStatus) return
    const metaPhase = jobMeta?.phase

    if (jobStatus.status === 'error') {
      setPhase('error')
      setErrorDetail(jobStatus.error || 'Unknown error')
      return
    }

    if (jobStatus.status === 'complete' && (phase === 'synthesizing' || phase === 'reviewing')) {
      if (scanId && supabaseRef.current) {
        (supabaseRef.current as any)
          .from('scans')
          .select('report_data')
          .eq('id', scanId)
          .single()
          .then(({ data }: any) => {
            if (data?.report_data) setReportData(data.report_data as AIOReportData)
          })
          .catch(console.warn)
      }
      setPhase('report_ready')
      return
    }

    if (metaPhase === 'synthesizing' && phase === 'scanning') setPhase('synthesizing')
    if (metaPhase === 'reviewing' && phase === 'synthesizing') setPhase('reviewing')
  }, [jobStatus?.status, jobMeta?.phase, phase])

  // Build ScanDashboard-compatible props from Realtime data
  const scanProgress = scanId ? {
    scan_id: scanId,
    status: phase === 'scanning' ? 'scanning' as const : 'synthesizing' as const,
    engines: Object.values(engineProgress).map((e: any) => ({
      engine_id: e.engine_id,
      status: e.status,
      queries_total: e.queries_total,
      queries_done: e.queries_done,
    })),
    feed: [] as any[],
  } : null

  // Build synthesisStatus-compatible object
  const synthesisStatus = scanId ? {
    scan_id: scanId,
    scan_status: phase,
    phase: phase as any,
    engines: Object.values(engineProgress).map((e: any) => ({
      engine_id: e.engine_id,
      status: e.status,
      has_synthesis: !!e.synthesis_data,
    })),
    review_status: phase === 'reviewing' ? 'processing' : null,
    has_report: phase === 'report_ready',
  } : null

  const dashPhase = phase === 'scanning' ? 'scanning'
    : phase === 'synthesizing' ? 'synthesizing'
    : phase === 'reviewing' ? 'reviewing'
    : 'scanning'

  function handleNewScan() {
    setPhase('chat')
    setScanId(null)
    setConceptName('')
    setReportData(null)
    setErrorDetail(null)
    messagesRef.current = []
    setMessages([])
    setChatError(null)
    sessionIdRef.current = crypto.randomUUID()
  }

  if (validated === null) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  if (!validated) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>

  return (
    <EmbedLayout appTitle={APP_TITLE} theme={theme}>
      {phase === 'chat' && (
        <ChatPanel
          messages={messages}
          streaming={streaming}
          error={chatError}
          onSend={sendMessage}
          welcomeIcon="&#128269;"
          welcomeTitle="AI Search Optimization"
          welcomeDescription="Tell me about a product, brand, or concept and I'll analyze how it's recommended across consumer AI engines like ChatGPT, Gemini, Claude, Grok, and more."
          placeholder="Describe what you'd like to analyze (e.g., 'How is Tesla recommended by AI assistants?')"
        />
      )}

      {phase === 'generating' && (
        <div className="generating-state">
          <div className="generating-state__spinner" />
          <h2 className="generating-state__title">Generating Queries&hellip;</h2>
          <p className="generating-state__sub">
            Building a diverse set of search queries to test how AI engines perceive
            &ldquo;{conceptName}&rdquo;. This takes 10&ndash;20 seconds.
          </p>
        </div>
      )}

      {(phase === 'scanning' || phase === 'synthesizing' || phase === 'reviewing') && (
        <ScanDashboard
          conceptName={conceptName}
          scanProgress={scanProgress}
          synthesisStatus={synthesisStatus}
          phase={dashPhase as 'scanning' | 'synthesizing' | 'reviewing'}
        />
      )}

      {phase === 'report_ready' && reportData && (
        <MicroReport
          data={reportData}
          scanId={scanId ?? ''}
          supabase={supabaseRef.current}
          isEmbedded
          downloadTitle={conceptName || undefined}
          onNewScan={handleNewScan}
        />
      )}

      {phase === 'report_ready' && !reportData && (
        <div className="report-ready">
          <div className="report-ready__header">
            <div className="scan-dash__spinner" />
            <div>
              <h2 className="report-ready__title">Loading Report...</h2>
              <p className="report-ready__sub">Fetching analysis for &ldquo;{conceptName}&rdquo;</p>
            </div>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="error-page">
          <p className="error-page__msg">Something went wrong during analysis.</p>
          {errorDetail && <pre className="error-page__detail">{errorDetail}</pre>}
          {chatError && !errorDetail && <pre className="error-page__detail">{chatError}</pre>}
          <button className="btn-primary" onClick={handleNewScan}>Try Again</button>
        </div>
      )}
    </EmbedLayout>
  )
}
