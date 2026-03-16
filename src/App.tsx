import { useState, useEffect } from 'react';
import { BrandMark } from './design-system/BrandMark';
import { ThemeToggle } from './design-system/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { SignIn, UserButton, useAuth } from '@clerk/react';
import type { AppPhase } from './lib/types';
import { useOrchestrator } from './hooks/useOrchestrator';
import type { ScanDispatchConfig } from './hooks/useOrchestrator';
import { useScanPoller } from './hooks/useScanPoller';
import { useSynthesisPoller } from './hooks/useSynthesisPoller';
import { ChatPanel } from './components/ChatPanel';
import { ScanDashboard } from './components/ScanDashboard';
import { ScanSidebar } from './components/ScanSidebar';
import { AdminPanel } from './components/AdminPanel';
import { AIOReport } from './components/report/AIOReport';
import type { AIOReportData } from './lib/types';

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();

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
        setScanCount(data.audit_count ?? 0);
      })
      .catch(() => setUserStatus('active'));
  }, []);

  // ── Scan dispatch handler (called by orchestrator when user confirms) ──
  async function handleScanDispatch(config: ScanDispatchConfig, sessionId: string) {
    setConceptName(config.concept_name);
    setScanId(sessionId);
    setPhase('scanning');
    setSidebarRefreshKey(k => k + 1);

    // Call dispatch-scan to create scan + fire background engines
    try {
      const res = await authFetch('/.netlify/functions/dispatch-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          conceptType: config.concept_type,
          conceptName: config.concept_name,
          conceptCategory: config.concept_category,
          conceptContext: config.concept_context,
          engines: config.engines,
          queryCount: config.query_count,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Dispatch scan failed:', errText);
        setPhase('error');
      }
    } catch (err) {
      console.error('Dispatch scan error:', err);
      setPhase('error');
    }
  }

  const { messages, streaming, error: chatError, sendMessage, reset: resetOrchestrator } =
    useOrchestrator(handleScanDispatch, authFetch);

  // ── Polling ──
  const { progress: scanProgress } = useScanPoller(
    phase === 'scanning' ? scanId : null,
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
                />
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
