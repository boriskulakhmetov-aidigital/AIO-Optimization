import { useState, useEffect, useRef, useCallback } from 'react'
import {
  EmbedLayout, ChatPanel,
  applyTheme, resolveTheme, aiLabsTheme,
} from '@boriskulakhmetov-aidigital/design-system'
import type { SupabaseClient } from '@boriskulakhmetov-aidigital/design-system'
import '@boriskulakhmetov-aidigital/design-system/style.css'
import { createClient } from '@supabase/supabase-js'
import { parseSSEStream } from '../lib/sseParser'
import type { AppPhase, AIOReportData, EngineId } from '../lib/types'
import { useScanPoller } from '../hooks/useScanPoller'
import { useSynthesisPoller } from '../hooks/useSynthesisPoller'
import { ScanDashboard } from '../components/ScanDashboard'
import { AIOReport } from '../components/report/AIOReport'

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

  // Polling
  const { progress: scanProgress } = useScanPoller(
    phase === 'scanning' ? scanId : null,
    embedFetch,
  )
  const { status: synthesisStatus } = useSynthesisPoller(
    phase === 'synthesizing' || phase === 'reviewing' ? scanId : null,
    embedFetch,
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

  // Scan dispatch handler
  const handleScanDispatch = useCallback(async (config: ScanDispatchConfig, sid: string, msgs: ChatMessage[]) => {
    if (!config.engines?.length) {
      setErrorDetail('No engines selected. Please select at least one AI engine.')
      setPhase('error')
      return
    }

    setConceptName(config.concept_name)
    setScanId(sid)
    setPhase('generating')
    setErrorDetail(null)

    try {
      // Step 1: Generate queries
      const genRes = await embedFetch('/.netlify/functions/generate-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept_type: config.concept_type,
          concept_name: config.concept_name,
          concept_category: config.concept_category,
          concept_context: config.concept_context,
          engines: config.engines,
          query_count: config.query_count,
        }),
      })
      if (!genRes.ok) {
        const errText = await genRes.text()
        setErrorDetail(`Generate queries failed (${genRes.status}): ${errText}`)
        setPhase('error')
        return
      }
      const genData = await genRes.json()

      // Step 2: Dispatch scan
      setPhase('scanning')
      const dispatchRes = await embedFetch('/.netlify/functions/dispatch-scan', {
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
          queries: genData.queries,
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!dispatchRes.ok) {
        const errText = await dispatchRes.text()
        setErrorDetail(`Dispatch scan failed (${dispatchRes.status}): ${errText}`)
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

  // Phase transitions
  useEffect(() => {
    if (scanProgress?.status === 'synthesizing' && phase === 'scanning') {
      setPhase('synthesizing')
    } else if (scanProgress?.status === 'error' && phase === 'scanning') {
      setPhase('error')
    }
  }, [scanProgress?.status, phase])

  useEffect(() => {
    if (!synthesisStatus) return
    if (synthesisStatus.phase === 'reviewing' && phase === 'synthesizing') {
      setPhase('reviewing')
    } else if (synthesisStatus.phase === 'complete' && (phase === 'synthesizing' || phase === 'reviewing')) {
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
    } else if (synthesisStatus.phase === 'error') {
      setPhase('error')
    }
  }, [synthesisStatus?.phase, phase])

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
        <AIOReport
          data={reportData}
          conceptName={conceptName}
          onNewScan={handleNewScan}
          scanId={scanId}
          supabase={supabaseRef.current}
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
