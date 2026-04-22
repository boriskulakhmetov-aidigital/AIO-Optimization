import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { AppShell, ChatPanel, useScanProgress, useJobStatus, useSessionPersistence } from '@AiDigital-com/design-system';
import type { AppShellContext, SupabaseClient, UseSessionPersistenceReturn } from '@AiDigital-com/design-system';
import { createClient } from '@supabase/supabase-js';
import { SignIn, UserButton, useAuth } from '@clerk/react';
import type { AppPhase } from './lib/types';
import { useOrchestrator } from './hooks/useOrchestrator';
import type { ScanDispatchConfig } from './hooks/useOrchestrator';
import { EngineSelector } from './components/EngineSelector';
import { ScanDashboard } from './components/ScanDashboard';
import { ScanSidebar } from './components/ScanSidebar';
import { MicroReport } from './components/micro-report/MicroReport';
import type { AIOReportData, EngineId } from './lib/types';

const supabaseConfig = import.meta.env.VITE_SUPABASE_URL ? {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  createClient: createClient as any,
} : undefined;

// ── Bridge context so the sidebar (rendered by AppShell) can access domain state ──
interface ScanBridge {
  scanId: string | null;
  loadingScanId: string | null;
  session: UseSessionPersistenceReturn | null;
  supabase: SupabaseClient | null;
  onSelectScan: (id: string) => void;
  onNewScan: () => void;
  onDeleteScan: (id: string) => void;
}
const ScanBridgeCtx = createContext<ScanBridge | null>(null);

// ── Root component ──────────────────────────────────────────────────────────
export default function App() {
  return <ScanBridgeProvider />;
}

// ── Provider wraps AppShell so both sidebar and children share domain state ──
function ScanBridgeProvider() {
  const [phase, setPhase] = useState<AppPhase>('chat');
  const [scanId, setScanId] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState('');
  const [loadingScanId, setLoadingScanId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [selectedEngines, setSelectedEngines] = useState<EngineId[]>([]);
  const [queryCount, setQueryCount] = useState(50);

  // authFetch will be injected by AppShell via children callback.
  // We store it in a ref so the sidebar (and dispatch handler) can use it.
  const authFetchRef = useRef<(url: string, options?: RequestInit) => Promise<Response>>(
    () => Promise.reject(new Error('authFetch not ready')),
  );

  // supabase client ref — injected by AppShell via children callback
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  // userId from Clerk
  const { userId } = useAuth();

  // Stable wrapper that always delegates to the latest ref
  const authFetch = useCallback(
    (url: string, options?: RequestInit) => authFetchRef.current(url, options),
    [],
  );

  // ── Session persistence ──
  const session = useSessionPersistence(supabase, authFetch, userId ?? null, {
    table: 'scans',
    app: 'aio-optimization',
    titleField: 'concept_name',
    mergeConfig: {},
    defaultFields: { status: 'chatting' },
    mergeEndpoint: '/.netlify/functions/save-session',
    sessionsEndpoint: '/.netlify/functions/get-sessions',
  });

  // Keep scanId in sync with session
  useEffect(() => {
    if (session.sessionId && session.sessionId !== scanId && phase === 'chat') {
      setScanId(session.sessionId);
    }
  }, [session.sessionId]);

  // ── Scan dispatch handler ──
  const DEFAULT_ENGINES: EngineId[] = ['google_sge', 'chatgpt_free', 'claude', 'grok_free', 'gemini_free'];

  async function handleScanDispatch(config: ScanDispatchConfig, sessionId: string, messages: { role: string; content: string }[]) {
    const resolvedConfig: ScanDispatchConfig = {
      ...config,
      engines: selectedEngines.length > 0 ? selectedEngines : (config.engines?.length ? config.engines : DEFAULT_ENGINES),
      query_count: queryCount || 50,
    };

    if (!resolvedConfig.engines?.length) {
      setErrorDetail('No engines selected. Please select at least one AI engine.');
      setPhase('error');
      return;
    }

    setConceptName(resolvedConfig.concept_name);
    setScanId(sessionId);
    setPhase('generating');
    setErrorDetail(null);

    // Persist scan metadata via session
    session.mergeFields({
      status: 'scanning',
      concept_name: resolvedConfig.concept_name,
      concept_type: resolvedConfig.concept_type,
      concept_category: resolvedConfig.concept_category,
    });

    try {
      console.log('[AIO] Dispatching via standard pipeline...', { concept_name: resolvedConfig.concept_name, engines: resolvedConfig.engines, query_count: resolvedConfig.query_count });
      setPhase('scanning');

      const dispatchRes = await authFetch('/.netlify/functions/dispatch-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: sessionId,
          intakeSummary: {
            concept_type: resolvedConfig.concept_type,
            concept_name: resolvedConfig.concept_name,
            concept_category: resolvedConfig.concept_category,
            concept_context: resolvedConfig.concept_context,
            engines: resolvedConfig.engines,
            query_count: resolvedConfig.query_count,
          },
        }),
      });
      if (!dispatchRes.ok) {
        const errText = await dispatchRes.text();
        console.error('[AIO] dispatch-audit failed:', dispatchRes.status, errText);
        setErrorDetail(`Dispatch failed (${dispatchRes.status}): ${errText}`);
        setPhase('error');
        return;
      }
      console.log('[AIO] Dispatch complete — pipeline running');
      session.refreshSessions();
    } catch (err) {
      console.error('[AIO] Dispatch error:', err);
      setErrorDetail(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setPhase('error');
    }
  }

  const { messages, streaming, error: chatError, sendMessage, reset: resetOrchestrator, loadMessages } =
    useOrchestrator(handleScanDispatch, session);

  // ── Realtime subscriptions (replace polling) ──

  // Engine-level progress (queries_done/total per engine)
  const engineProgress = useScanProgress(
    supabase,
    phase === 'scanning' || phase === 'synthesizing' ? scanId : null,
  );

  // Overall job status (phase transitions via meta.phase)
  const jobStatus = useJobStatus(
    supabase,
    phase === 'scanning' || phase === 'synthesizing' || phase === 'reviewing' ? scanId : null,
  );

  // Phase transitions via jobStatus
  const jobMeta = (jobStatus as any)?.meta as { phase?: string } | undefined;
  useEffect(() => {
    if (!jobStatus) return;
    const phase_ = jobMeta?.phase;

    if (jobStatus.status === 'error') {
      setPhase('error');
      setErrorDetail(jobStatus.error || 'Unknown error');
      return;
    }

    if (jobStatus.status === 'complete' && (phase === 'synthesizing' || phase === 'reviewing')) {
      // Report is ready — fetch it
      if (scanId && supabaseRef.current) {
        supabaseRef.current
          .from('scans')
          .select('report_data')
          .eq('id', scanId)
          .single()
          .then(({ data }: any) => {
            if (data?.report_data) setReportData(data.report_data as AIOReportData);
          })
          .catch(console.warn);
      }
      setPhase('report_ready');
      session.refreshSessions();
      return;
    }

    if (phase_ === 'synthesizing' && phase === 'scanning') {
      setPhase('synthesizing');
    } else if (phase_ === 'reviewing' && phase === 'synthesizing') {
      setPhase('reviewing');
    }
  }, [jobStatus?.status, jobMeta?.phase, phase]);

  const dashPhase = phase === 'scanning' ? 'scanning'
    : phase === 'synthesizing' ? 'synthesizing'
    : phase === 'reviewing' ? 'reviewing'
    : phase === 'report_ready' ? 'complete'
    : phase === 'error' ? 'error'
    : 'scanning';

  // Build scanProgress-compatible object from Realtime engine data
  const scanProgress = scanId ? {
    scan_id: scanId,
    status: phase === 'scanning' ? 'scanning' as const : 'synthesizing' as const,
    engines: Object.values(engineProgress).map((e: any) => ({
      engine_id: e.engine_id,
      status: e.status,
      queries_total: e.queries_total,
      queries_done: e.queries_done,
    })),
    feed: [] as any[], // Feed snippets not available via Realtime (non-critical)
  } : null;

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
  } : null;

  // ── Actions ──
  function handleNewScan() {
    setPhase('chat');
    setScanId(null);
    setConceptName('');
    setReportData(null);
    resetOrchestrator();
    session.newSession();
    session.refreshSessions();
  }

  async function handleLoadScan(id: string) {
    if (!supabaseRef.current) return;
    setLoadingScanId(id);
    try {
      // Load session via persistence hook
      await session.loadSession(id);

      // Direct DB read for immediate field access (loadSession is async)
      const { data: scan } = await (supabaseRef.current as any)
        .from('scans')
        .select('*')
        .eq('id', id)
        .single();
      if (!scan) return;

      setScanId(scan.id);
      setConceptName(scan.concept_name ?? '');
      setReportData(null);

      // Restore orchestrator messages
      if (scan.messages) {
        loadMessages(scan.messages);
      }

      if (scan.report_data) {
        setReportData(scan.report_data as AIOReportData);
        setPhase('report_ready');
      } else if (scan.status === 'complete' || scan.status === 'reviewing') {
        setPhase('reviewing');
      } else if (scan.status === 'synthesizing') {
        setPhase('synthesizing');
      } else if (scan.status === 'scanning') {
        setPhase('scanning');
      } else {
        setPhase('chat');
      }
    } catch (err) {
      console.warn('Load scan failed:', err);
    } finally {
      setLoadingScanId(null);
    }
  }

  async function handleDeleteScan(id: string) {
    await session.deleteSession(id);
    if (scanId === id) handleNewScan();
    session.refreshSessions();
  }

  const bridge: ScanBridge = {
    scanId,
    loadingScanId,
    session,
    supabase,
    onSelectScan: handleLoadScan,
    onNewScan: handleNewScan,
    onDeleteScan: handleDeleteScan,
  };

  return (
    <ScanBridgeCtx.Provider value={bridge}>
      <AppShell
        appTitle="AIO Optimization"
        activityLabel="Scan"
        detailEndpoint="get-scan"
        auth={{ SignIn: SignIn as any, UserButton, useAuth: useAuth as any }}
        supabaseConfig={supabaseConfig}
        helpUrl="/help"
        sidebar={<ConnectedSidebar />}
      >
        {(ctx) => {
          // Keep the refs in sync so the stable wrappers work
          authFetchRef.current = ctx.authFetch;
          if (ctx.supabase && ctx.supabase !== supabaseRef.current) {
            supabaseRef.current = ctx.supabase;
            setSupabase(ctx.supabase);
          }

          return (
            <>
              {phase === 'chat' && (
                <ChatPanel
                  messages={messages}
                  streaming={streaming}
                  error={chatError}
                  onSend={sendMessage}
                  inputPrefix={
                    <EngineSelector
                      authFetch={ctx.authFetch}
                      selectedEngines={selectedEngines}
                      onSelectionChange={setSelectedEngines}
                      queryCount={queryCount}
                      onQueryCountChange={setQueryCount}
                    />
                  }
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
                  supabase={ctx.supabase}
                  isEmbedded
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
                  {errorDetail && (
                    <pre className="error-page__detail">{errorDetail}</pre>
                  )}
                  {chatError && !errorDetail && (
                    <pre className="error-page__detail">{chatError}</pre>
                  )}
                  <button className="btn-primary" onClick={handleNewScan}>Try Again</button>
                </div>
              )}
            </>
          );
        }}
      </AppShell>
    </ScanBridgeCtx.Provider>
  );
}

// ── Sidebar reads shared state from bridge context ──────────────────────────
function ConnectedSidebar() {
  const bridge = useContext(ScanBridgeCtx);
  if (!bridge) return null;
  return (
    <ScanSidebar
      session={bridge.session}
      currentScanId={bridge.scanId}
      loadingScanId={bridge.loadingScanId}
      onSelectScan={bridge.onSelectScan}
      onNewScan={bridge.onNewScan}
      onDeleteScan={bridge.onDeleteScan}
      supabase={bridge.supabase}
    />
  );
}
