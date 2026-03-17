import { useState, useEffect } from 'react';
import { BrandMark, ChatPanel, ThemeToggle, useTheme } from '@boriskulakhmetov-aidigital/design-system';
import { SignIn, UserButton, useAuth } from '@clerk/react';
import type { AppPhase } from './lib/types';
import { useOrchestrator } from './hooks/useOrchestrator';
import type { ScanDispatchConfig } from './hooks/useOrchestrator';
import { useScanPoller } from './hooks/useScanPoller';
import { useSynthesisPoller } from './hooks/useSynthesisPoller';
import { EngineSelector } from './components/EngineSelector';
import { ScanDashboard } from './components/ScanDashboard';
import { ScanSidebar } from './components/ScanSidebar';
import { AdminPanel } from './components/AdminPanel';
import { AIOReport } from './components/report/AIOReport';
import type { AIOReportData, EngineId } from './lib/types';

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();

  // Check for public shared report route: #/share/TOKEN
  const hash = window.location.hash;
  const shareMatch = hash.match(/^#\/share\/(.+)$/);
  if (shareMatch) {
    return <PublicReport token={shareMatch[1]} />;
  }

  if (!isLoaded) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — AIO Optimization
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — AIO Optimization
        </div>
        <SignIn routing="hash" />
      </div>
    );
  }

  return <AuthenticatedApp />;
}

// ── Public Shared Report (no auth required) ──────────────────────────────────

function PublicReport({ token }: { token: string }) {
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [conceptName, setConceptName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    fetch(`/.netlify/functions/public-report?token=${encodeURIComponent(token)}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'This report is private' : 'Report not found');
        return r.json();
      })
      .then(data => {
        setReportData(data.report_data as AIOReportData);
        setConceptName(data.concept_name ?? '');
      })
      .catch(err => setError(String(err)));
  }, [token]);

  return (
    <div className="app-layout app-layout--public">
      <div className="app-content">
        <header className="app-header">
          <div className="app-header__left">
            <div className="app-header__logo">
              <BrandMark size={20} />
              AI Labs
            </div>
            <span className="app-header__title">AIO Optimization — Shared Report</span>
          </div>
          <div className="app-header__right">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>
        <main className="app-main">
          {error && (
            <div className="error-page">
              <p className="error-page__msg">{error}</p>
              <a href="/" className="btn-primary">Go to AIO Optimization</a>
            </div>
          )}
          {!error && !reportData && (
            <div className="generating-state">
              <div className="generating-state__spinner" />
              <h2 className="generating-state__title">Loading Report...</h2>
            </div>
          )}
          {reportData && (
            <AIOReport
              data={reportData}
              conceptName={conceptName}
              onNewScan={() => { window.location.hash = ''; window.location.reload(); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

type UserStatus = 'loading' | 'active' | 'admin' | 'trial' | 'pending' | 'blocked';

function AuthenticatedApp() {
  const { getToken } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const [userStatus, setUserStatus] = useState<UserStatus>('loading');
  const [scanCount, setScanCount] = useState(0);
  const [phase, setPhase] = useState<AppPhase>('chat');
  const [scanId, setScanId] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState('');
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loadingScanId, setLoadingScanId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<AIOReportData | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [selectedEngines, setSelectedEngines] = useState<EngineId[]>([]);
  const [queryCount, setQueryCount] = useState(50);

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...(options.headers ?? {}), Authorization: 'Bearer ' + token },
    });
  }

  // Init user status
  useEffect(() => {
    authFetch('/.netlify/functions/init-user')
      .then(r => r.json())
      .then(data => {
        setUserStatus(data.status ?? 'active');
        setScanCount(data.scan_count ?? 0);
      })
      .catch(() => setUserStatus('active'));
  }, []);

  // queryCount comes from the EngineSelector slider

  // ── Scan dispatch handler (called by orchestrator when user confirms) ──
  async function handleScanDispatch(config: ScanDispatchConfig, sessionId: string, messages: { role: string; content: string }[]) {
    // Use user-selected engines from the EngineSelector widget
    const resolvedConfig: ScanDispatchConfig = {
      ...config,
      engines: selectedEngines.length > 0 ? selectedEngines : (config.engines?.length ? config.engines : []),
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

    try {
      // Step 1: Generate queries via Gemini
      console.log('[AIO] Step 1: Generating queries…', { concept_name: resolvedConfig.concept_name, engines: resolvedConfig.engines, query_count: resolvedConfig.query_count });
      const genRes = await authFetch('/.netlify/functions/generate-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept_type: resolvedConfig.concept_type,
          concept_name: resolvedConfig.concept_name,
          concept_category: resolvedConfig.concept_category,
          concept_context: resolvedConfig.concept_context,
          engines: resolvedConfig.engines,
          query_count: resolvedConfig.query_count,
        }),
      });
      if (!genRes.ok) {
        const errText = await genRes.text();
        console.error('[AIO] generate-queries failed:', genRes.status, errText);
        setErrorDetail(`Generate queries failed (${genRes.status}): ${errText}`);
        setPhase('error');
        return;
      }
      const genData = await genRes.json();
      console.log('[AIO] Step 1 complete:', genData.total_queries, 'queries generated');

      // Step 2: Dispatch scan with generated queries
      console.log('[AIO] Step 2: Dispatching scan…', { scanId: sessionId, engines: resolvedConfig.engines.length, queries: genData.queries?.length });
      setPhase('scanning');

      const dispatchRes = await authFetch('/.netlify/functions/dispatch-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: sessionId,
          config: {
            concept_type: resolvedConfig.concept_type,
            concept_name: resolvedConfig.concept_name,
            concept_category: resolvedConfig.concept_category,
            concept_context: resolvedConfig.concept_context,
            engines: resolvedConfig.engines,
            query_count: resolvedConfig.query_count,
          },
          queries: genData.queries,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!dispatchRes.ok) {
        const errText = await dispatchRes.text();
        console.error('[AIO] dispatch-scan failed:', dispatchRes.status, errText);
        setErrorDetail(`Dispatch scan failed (${dispatchRes.status}): ${errText}`);
        setPhase('error');
        return;
      }
      const dispatchData = await dispatchRes.json();
      console.log('[AIO] Step 2 complete:', dispatchData);
      // Scan record now exists in DB — refresh sidebar
      setSidebarRefreshKey(k => k + 1);
    } catch (err) {
      console.error('[AIO] Dispatch error:', err);
      setErrorDetail(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setPhase('error');
    }
  }

  const { messages, streaming, error: chatError, sendMessage, reset: resetOrchestrator } =
    useOrchestrator(handleScanDispatch);

  // ── Polling ──
  const { progress: scanProgress } = useScanPoller(
    phase === 'scanning' ? scanId : null,
    authFetch,
  );
  const { status: synthesisStatus } = useSynthesisPoller(
    phase === 'synthesizing' || phase === 'reviewing' ? scanId : null,
    authFetch,
  );

  // Transition: scanning → synthesizing
  useEffect(() => {
    if (scanProgress?.status === 'synthesizing' && phase === 'scanning') {
      setPhase('synthesizing');
    } else if (scanProgress?.status === 'error' && phase === 'scanning') {
      setPhase('error');
    }
  }, [scanProgress?.status, phase]);

  // Transition: synthesizing → reviewing → complete
  useEffect(() => {
    if (!synthesisStatus) return;
    if (synthesisStatus.phase === 'reviewing' && phase === 'synthesizing') {
      setPhase('reviewing');
    } else if (synthesisStatus.phase === 'complete' && (phase === 'synthesizing' || phase === 'reviewing')) {
      // Fetch the full report data
      if (scanId) {
        authFetch(`/.netlify/functions/get-scan?id=${encodeURIComponent(scanId)}`)
          .then(r => r.json())
          .then(data => {
            if (data.scan?.report_data) setReportData(data.scan.report_data as AIOReportData);
          })
          .catch(console.warn);
      }
      setPhase('report_ready');
      setScanCount(c => c + 1);
      setSidebarRefreshKey(k => k + 1);
    } else if (synthesisStatus.phase === 'error') {
      setPhase('error');
    }
  }, [synthesisStatus?.phase, phase]);

  // ── Determine dashboard phase for display ──
  const dashPhase = phase === 'scanning' ? 'scanning'
    : phase === 'synthesizing' ? 'synthesizing'
    : phase === 'reviewing' ? 'reviewing'
    : phase === 'report_ready' ? 'complete'
    : phase === 'error' ? 'error'
    : 'scanning';

  // ── Actions ──
  function handleNewScan() {
    setPhase('chat');
    setScanId(null);
    setConceptName('');
    setReportData(null);
    resetOrchestrator();
  }

  async function handleLoadScan(id: string) {
    setLoadingScanId(id);
    try {
      const res = await authFetch(`/.netlify/functions/get-scan?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      const scan = data.scan;
      if (!scan) return;

      setScanId(scan.id);
      setConceptName(scan.concept_name ?? '');
      setReportData(null);

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
    authFetch('/.netlify/functions/save-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(console.warn);
    if (scanId === id) handleNewScan();
    setSidebarRefreshKey(k => k + 1);
  }

  // Status gates
  if (userStatus === 'loading') {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — AIO Optimization
        </div>
      </div>
    );
  }
  if (userStatus === 'pending') {
    return (
      <div className="status-page">
        <div className="status-page__icon">&#9203;</div>
        <h2>Access Pending Approval</h2>
        <p>Your account is awaiting administrator approval.</p>
      </div>
    );
  }
  if (userStatus === 'blocked') {
    return (
      <div className="status-page">
        <div className="status-page__icon">&#128683;</div>
        <h2>Account Suspended</h2>
        <p>Please contact support@aidigital.com</p>
      </div>
    );
  }

  const trialRemaining = userStatus === 'trial' ? Math.max(0, 10 - scanCount) : null;

  return (
    <div className="app-layout">
      <ScanSidebar
        refreshKey={sidebarRefreshKey}
        currentScanId={scanId}
        loadingScanId={loadingScanId}
        onSelectScan={handleLoadScan}
        onNewScan={handleNewScan}
        onDeleteScan={handleDeleteScan}
        authFetch={authFetch}
      />

      <div className="app-content">
        {trialRemaining !== null && (
          <div className="trial-banner">
            Trial account &mdash; <strong>{trialRemaining}</strong> scan{trialRemaining !== 1 ? 's' : ''} remaining
          </div>
        )}

        <header className="app-header">
          <div className="app-header__left">
            <div className="app-header__logo">
              <BrandMark size={20} />
              AI Labs
            </div>
            <span className="app-header__title">AIO Optimization</span>
          </div>
          <div className="app-header__right">
            {userStatus === 'admin' && (
              <button className="btn-ghost btn-sm" onClick={() => setShowAdmin(!showAdmin)}>
                {showAdmin ? 'Close Admin' : 'Admin Console'}
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <UserButton />
          </div>
        </header>

        <main className="app-main">
          {showAdmin ? (
            <AdminPanel authFetch={authFetch} />
          ) : (
            <>
              {phase === 'chat' && (
                <ChatPanel
                  messages={messages}
                  streaming={streaming}
                  error={chatError}
                  onSend={sendMessage}
                  inputPrefix={
                    <EngineSelector
                      authFetch={authFetch}
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
                <AIOReport
                  data={reportData}
                  conceptName={conceptName}
                  onNewScan={handleNewScan}
                  scanId={scanId}
                  authFetch={authFetch}
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
          )}
        </main>
      </div>
    </div>
  );
}
