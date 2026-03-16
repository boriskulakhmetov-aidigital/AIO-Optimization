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

      if (scan.report_data) {
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

              {phase === 'report_ready' && (
                <ReportReadyPlaceholder
                  conceptName={conceptName}
                  scanId={scanId}
                  onNewScan={handleNewScan}
                  authFetch={authFetch}
                />
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

// ── Report Ready (placeholder — Phase 6 will build the full report viewer) ───

function ReportReadyPlaceholder({ conceptName, scanId, onNewScan, authFetch }: {
  conceptName: string;
  scanId: string | null;
  onNewScan: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!scanId) return;
    authFetch(`/.netlify/functions/get-scan?id=${encodeURIComponent(scanId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.scan?.report_data) setReport(data.scan.report_data);
      })
      .catch(console.warn);
  }, [scanId]);

  return (
    <div className="report-ready">
      <div className="report-ready__header">
        <span className="report-ready__check">&#10003;</span>
        <div>
          <h2 className="report-ready__title">Analysis Complete</h2>
          <p className="report-ready__sub">
            AI Search Optimization report for &ldquo;{conceptName}&rdquo; is ready.
          </p>
        </div>
      </div>

      {report && (
        <div className="report-ready__summary">
          <ReportKPICards report={report} />
          {(report as { executive_summary?: string }).executive_summary && (
            <div className="report-ready__exec">
              <h3>Executive Summary</h3>
              <p>{(report as { executive_summary?: string }).executive_summary}</p>
            </div>
          )}
        </div>
      )}

      <div className="report-ready__actions">
        <button className="btn-primary" onClick={onNewScan}>New Scan</button>
      </div>
    </div>
  );
}

function ReportKPICards({ report }: { report: Record<string, unknown> }) {
  const kpis = report.overall_kpis as Record<string, number> | undefined;
  const review = report.cross_engine_review as Record<string, unknown> | undefined;
  if (!kpis && !review) return null;

  const cards = [
    { label: 'AI Share of Voice', value: kpis?.overall_ai_sov ?? (review as Record<string, number> | undefined)?.overall_ai_sov, suffix: '%' },
    { label: 'First Position Rate', value: kpis?.overall_first_position_rate ?? (review as Record<string, number> | undefined)?.overall_first_position_rate, suffix: '%' },
    { label: 'Net Sentiment', value: kpis?.overall_net_sentiment ?? (review as Record<string, number> | undefined)?.overall_net_sentiment, suffix: '' },
    { label: 'Engine Consistency', value: (review as Record<string, number> | undefined)?.engine_consistency, suffix: '' },
  ].filter(c => c.value != null);

  return (
    <div className="kpi-cards">
      {cards.map(card => (
        <div key={card.label} className="kpi-card">
          <span className="kpi-card__value">
            {typeof card.value === 'number' ? card.value.toFixed(1) : card.value}{card.suffix}
          </span>
          <span className="kpi-card__label">{card.label}</span>
        </div>
      ))}
    </div>
  );
}