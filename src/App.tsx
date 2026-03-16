import { useState, useEffect } from 'react';
import { BrandMark } from './design-system/BrandMark';
import { ThemeToggle } from './design-system/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { SignIn, UserButton, useAuth, useUser } from '@clerk/react';
import type { AppPhase, AssetState, IntakeSummary } from './lib/types';
import type { ReportData } from './lib/reportTypes';
import { useOrchestrator } from './hooks/useOrchestrator';
import { useAssetUpload } from './hooks/useAssetUpload';
import { useAuditPoller } from './hooks/useAuditPoller';
import { useVisualizerPoller } from './hooks/useVisualizerPoller';
import { ChatPanel } from './components/ChatPanel';
import { ProgressIndicator } from './components/ProgressIndicator';
import { ReportViewer } from './components/ReportViewer';
import { DownloadBar } from './components/DownloadBar';
import { AuditSidebar } from './components/AuditSidebar';
import { AdminPanel } from './components/AdminPanel';
import { MicroReport } from './components/micro-report/MicroReport';
import { ShareBar } from './components/micro-report/ShareBar';

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — Neuromarketing Audit
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — Neuromarketing Audit
        </div>
        <SignIn routing="hash" />
      </div>
    );
  }

  return <AuthenticatedApp />;
}

type UserStatus = 'loading' | 'active' | 'admin' | 'trial' | 'pending' | 'blocked';

function AuthenticatedApp() {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const { theme, toggle: toggleTheme } = useTheme();

  const [userStatus, setUserStatus]       = useState<UserStatus>('loading');
  const [auditCount, setAuditCount]       = useState(0);
  const [phase, setPhase]                 = useState<AppPhase>('chat');
  const [jobId, setJobId]                 = useState<string | null>(null);
  const [vizJobId, setVizJobId]           = useState<string | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [showAdmin, setShowAdmin]         = useState(false);
  const [pastReport, setPastReport]       = useState<string | null>(null);
  const [pastBrandName, setPastBrandName] = useState<string>('');
  const [reportData, setReportData]       = useState<ReportData | null>(null);
  const [reportFormat, setReportFormat]   = useState<'visual' | 'markdown'>('visual');
  const [loadingAuditId, setLoadingAuditId] = useState<string | null>(null);

  const { asset, uploading, error: uploadError, uploadFile, setUrl, clear: clearAsset } =
    useAssetUpload();

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...(options.headers ?? {}), Authorization: 'Bearer ' + token },
    });
  }

  // Init user status on mount
  useEffect(() => {
    authFetch('/.netlify/functions/init-user')
      .then(r => r.json())
      .then(data => {
        setUserStatus(data.status ?? 'active');
        setAuditCount(data.audit_count ?? 0);
      })
      .catch(() => setUserStatus('active'));
  }, []);

  async function handleAuditDispatch(summary: IntakeSummary, sessionId: string, messages: ChatMessage[]) {
    setIntakeSummary(summary);
    setJobId(sessionId);
    setVizJobId(null);
    setPastReport(null);
    setReportData(null);
    setPhase('audit_running');
    setSidebarRefreshKey(k => k + 1);

    await fetch('/.netlify/functions/audit-agent-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intakeSummary: summary,
        fileUri: asset?.fileUri,
        mimeType: asset?.mimeType,
        assetUrl: asset?.assetUrl,
        jobId: sessionId,
        userId: userId ?? undefined,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
  }

  const { messages, streaming, error: chatError, sendMessage, reset: resetOrchestrator } =
    useOrchestrator(handleAuditDispatch, authFetch);

  const pollResult = useAuditPoller(phase === 'audit_running' ? jobId : null);

  // When audit completes → move to visualizing phase
  useEffect(() => {
    if (pollResult.status === 'complete' && phase === 'audit_running') {
      setPhase('visualizing');
      setVizJobId(jobId);
      setSidebarRefreshKey(k => k + 1);
      setAuditCount(c => c + 1);
    } else if (pollResult.status === 'error' && phase === 'audit_running') {
      setPhase('error');
    }
  }, [pollResult.status, phase]);

  const vizResult = useVisualizerPoller(phase === 'visualizing' ? vizJobId : null, authFetch);

  // When visualizer completes → show micro-report
  useEffect(() => {
    if (vizResult.status === 'complete' && vizResult.reportData && phase === 'visualizing') {
      setReportData(vizResult.reportData);
      setReportFormat('visual');
      setPhase('report_ready');
    } else if (vizResult.status === 'error' && phase === 'visualizing') {
      setReportFormat('markdown');
      setPhase('report_ready');
    }
  }, [vizResult.status, phase]);

  function handleNewAudit() {
    setPhase('chat');
    setJobId(null);
    setVizJobId(null);
    setIntakeSummary(null);
    setPastReport(null);
    setPastBrandName('');
    setReportData(null);
    setReportFormat('visual');
    clearAsset();
    resetOrchestrator();
  }

  async function handleFile(file: File) { await uploadFile(file); }
  function handleUrl(url: string) { setUrl(url); }
  function handleSend(text: string, currentAsset?: AssetState | null) {
    sendMessage(text, currentAsset ?? asset);
  }

  async function handleLoadAudit(id: string) {
    setLoadingAuditId(id);
    try {
      const token = await getToken();
      const res = await fetch('/.netlify/functions/get-audit?id=' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return;
      const data = await res.json();
      const session = data.session;
      if (!session) return;

      setJobId(session.id);
      setIntakeSummary(session.intake_summary ?? null);
      setPastBrandName(session.brand_name ?? '');
      setReportData(null);

      if (session.report_data) {
        // Fully structured micro-report available
        setReportData(session.report_data as ReportData);
        setPastReport(session.report ?? '');
        setReportFormat('visual');
        setPhase('report_ready');
      } else if (session.visualizer_status === 'pending' || session.visualizer_status === 'processing') {
        // Visualizer still running — show progress
        setVizJobId(session.id);
        setPhase('visualizing');
      } else if (session.status === 'complete' && session.report) {
        // Only plain markdown available — show fallback viewer
        setPastReport(session.report);
        setPhase('report_ready');
      } else if (session.status === 'pending' || session.status === 'streaming') {
        setPhase('audit_running');
      } else {
        setPhase('chat');
      }
    } catch (err) {
      console.warn('Load audit failed:', err);
    } finally {
      setLoadingAuditId(null);
    }
  }

  async function handleDeleteAudit(id: string) {
    authFetch('/.netlify/functions/save-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(console.warn);
    if (jobId === id) handleNewAudit();
    setSidebarRefreshKey(k => k + 1);
  }

  const displayReport = phase === 'report_ready'
    ? (pollResult.report ?? pastReport ?? '')
    : '';
  const displayBrand = intakeSummary?.brand_name ?? pastBrandName ?? 'audit';

  // Status gate
  if (userStatus === 'loading') {
    return (
      <div className="auth-gate">
        <div className="auth-gate__brand">
          <BrandMark size={28} />
          AI Labs — Neuromarketing Audit
        </div>
      </div>
    );
  }
  if (userStatus === 'pending') {
    return (
      <div className="status-page">
        <div className="status-page__icon">⏳</div>
        <h2>Access Pending Approval</h2>
        <p>Your account is awaiting administrator approval. You'll receive access shortly.</p>
        <p className="status-page__contact">Questions? Contact <a href="mailto:support@aidigital.com">support@aidigital.com</a></p>
      </div>
    );
  }
  if (userStatus === 'blocked') {
    return (
      <div className="status-page">
        <div className="status-page__icon">🚫</div>
        <h2>Account Suspended</h2>
        <p>Your account partnership has been suspended.</p>
        <p className="status-page__contact">Please contact <a href="mailto:support@aidigital.com">AIDigital Customer Support</a></p>
      </div>
    );
  }

  const trialRemaining = userStatus === 'trial' ? Math.max(0, 10 - auditCount) : null;

  return (
    <div className="app-layout">
      <AuditSidebar
        refreshKey={sidebarRefreshKey}
        currentJobId={jobId}
        loadingAuditId={loadingAuditId}
        onSelectAudit={handleLoadAudit}
        onNewAudit={handleNewAudit}
        onDeleteAudit={handleDeleteAudit}
        authFetch={authFetch}
      />

      <div className="app-content">
        {trialRemaining !== null && (
          <div className="trial-banner">
            Trial account — <strong>{trialRemaining}</strong> audit{trialRemaining !== 1 ? 's' : ''} remaining
          </div>
        )}

        <header className="app-header">
          <div className="app-header__left">
            <div className="app-header__logo">
              <BrandMark size={20} />
              AI Labs
            </div>
            <span className="app-header__title">Neuromarketing Audit</span>
          </div>
          <div className="app-header__right">
            <AdminTrigger isAdmin={userStatus === 'admin'} showAdmin={showAdmin} setShowAdmin={setShowAdmin} />
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
                  asset={asset}
                  uploading={uploading}
                  uploadError={uploadError}
                  onSend={handleSend}
                  onFile={handleFile}
                  onUrl={handleUrl}
                  onClearAsset={clearAsset}
                />
              )}
              {phase === 'audit_running' && (
                <ProgressIndicator
                  brandName={intakeSummary?.brand_name}
                  partial={pollResult.partial}
                />
              )}
              {phase === 'visualizing' && (
                <VisualizingIndicator brandName={displayBrand} />
              )}
              {phase === 'report_ready' && (reportData || displayReport) && (
                <div className="report-page">
                  <div className="report-bar">
                    {reportData && (
                      <div className="report-format-tabs">
                        <button
                          className={`format-tab${reportFormat === 'visual' ? ' format-tab--active' : ''}`}
                          onClick={() => setReportFormat('visual')}
                        >Visual Report</button>
                        <button
                          className={`format-tab${reportFormat === 'markdown' ? ' format-tab--active' : ''}`}
                          onClick={() => setReportFormat('markdown')}
                        >Markdown</button>
                      </div>
                    )}
                    <DownloadBar
                      reportText={displayReport}
                      brandName={displayBrand}
                      onNewAudit={handleNewAudit}
                    />
                    {reportData && reportFormat === 'visual' && (
                      <ShareBar jobId={jobId ?? ''} authFetch={authFetch} />
                    )}
                  </div>
                  {reportFormat === 'visual' && reportData ? (
                    <MicroReport
                      data={reportData}
                      jobId={jobId ?? ''}
                      authFetch={authFetch}
                      isEmbedded
                    />
                  ) : (
                    <ReportViewer reportText={displayReport} />
                  )}
                </div>
              )}
              {phase === 'error' && (
                <div className="error-page">
                  <p className="error-page__msg">
                    {pollResult.error ?? 'Something went wrong with the audit.'}
                  </p>
                  <button className="btn-primary" onClick={handleNewAudit}>Try Again</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Visualizing progress stage ─────────────────────────────────────────────

const VIZ_STEPS = [
  'Parsing 41-criteria markdown report',
  'Extracting scores and criterion blocks',
  'Synthesizing executive summary',
  'Building prioritized action roadmap',
  'Assembling interactive micro-report',
];
// Thresholds in seconds at which each step completes
const VIZ_STEP_THRESHOLDS = [15, 45, 90, 150, 270];

function VisualizingIndicator({ brandName }: { brandName: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // current step = first threshold not yet passed
  const doneCount = VIZ_STEP_THRESHOLDS.filter(t => elapsed >= t).length;

  return (
    <div className="progress">
      <div className="progress__header">
        <div className="progress__spinner" />
        <div className="progress__title-group">
          <h2 className="progress__title">Building Visual Report…</h2>
          <p className="progress__sub">
            Structuring <strong>{brandName}</strong> audit into your interactive micro-report.
            {elapsed > 60 && <> This takes 2–5 minutes.</>}
          </p>
        </div>
      </div>
      <div className="visualizing-steps">
        {VIZ_STEPS.map((label, i) => (
          <VisualizingStep
            key={i}
            label={label}
            done={i < doneCount}
            pulse={i === doneCount}
            pending={i > doneCount}
          />
        ))}
      </div>
    </div>
  );
}

function VisualizingStep({ label, done, pulse, pending }: {
  label: string;
  done?: boolean;
  pulse?: boolean;
  pending?: boolean;
}) {
  const icon = done ? '✓' : pulse ? '●' : '○';
  const cls = done ? 'viz-step--done' : pulse ? 'viz-step--pulse' : 'viz-step--pending';
  return (
    <div className={`viz-step ${cls}`}>
      <span className="viz-step__icon">{icon}</span>
      <span className="viz-step__label">{label}</span>
    </div>
  );
}

// ── Tiny type ──────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function AdminTrigger({ isAdmin, showAdmin, setShowAdmin }: {
  isAdmin: boolean;
  showAdmin: boolean;
  setShowAdmin: (v: boolean) => void;
}) {
  if (!isAdmin) return null;
  return (
    <button className="btn-ghost btn-sm" onClick={() => setShowAdmin(!showAdmin)}>
      {showAdmin ? 'Close Admin' : 'Admin Console'}
    </button>
  );
}
