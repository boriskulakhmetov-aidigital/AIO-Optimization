import { useState, useEffect, useRef } from 'react';
import { ENGINE_META, getEngineColor } from '../lib/engineMeta';
import type { ScanProgress, EngineProgress, FeedSnippet, SynthesisStatus, EngineId } from '../lib/types';

interface ScanDashboardProps {
  conceptName: string;
  scanProgress: ScanProgress | null;
  synthesisStatus: SynthesisStatus | null;
  phase: 'scanning' | 'synthesizing' | 'reviewing' | 'complete' | 'error';
}

export function ScanDashboard({ conceptName, scanProgress, synthesisStatus, phase }: ScanDashboardProps) {
  const engines = scanProgress?.engines ?? [];
  const feed = scanProgress?.feed ?? [];
  const skippedEngines = scanProgress?.skipped_engines ?? [];

  // Calculate overall progress
  const totalQueries = engines.reduce((s, e) => s + e.queries_total, 0);
  const doneQueries = engines.reduce((s, e) => s + e.queries_done, 0);
  const overallPct = totalQueries > 0 ? Math.round((doneQueries / totalQueries) * 100) : 0;

  // Phase labels
  const phaseLabel = phase === 'scanning' ? 'Querying AI Engines'
    : phase === 'synthesizing' ? 'Synthesizing Results'
    : phase === 'reviewing' ? 'Cross-Engine Review'
    : phase === 'complete' ? 'Analysis Complete'
    : 'Error';

  const phaseSubtext = phase === 'scanning'
    ? `Asking ${totalQueries} questions across ${engines.length} AI engine${engines.length !== 1 ? 's' : ''} about "${conceptName}"${skippedEngines.length ? ` (${skippedEngines.length} unavailable)` : ''}`
    : phase === 'synthesizing'
    ? 'Each engine is analyzing its responses to compute KPIs'
    : phase === 'reviewing'
    ? 'Comparing results across all engines to build your report'
    : phase === 'complete'
    ? 'Your AI Search Optimization report is ready'
    : 'Something went wrong during analysis';

  return (
    <div className="scan-dash">
      {/* ── Phase Header ── */}
      <div className="scan-dash__header">
        <div className="scan-dash__phase-row">
          {phase !== 'complete' && phase !== 'error' && (
            <div className="scan-dash__spinner" />
          )}
          {phase === 'complete' && <span className="scan-dash__check">&#10003;</span>}
          <div>
            <h2 className="scan-dash__title">{phaseLabel}</h2>
            <p className="scan-dash__sub">{phaseSubtext}</p>
          </div>
        </div>

        {/* Overall progress bar */}
        {phase === 'scanning' && (
          <div className="scan-dash__overall">
            <div className="scan-dash__bar-track">
              <div className="scan-dash__bar-fill" style={{ width: `${overallPct}%` }} />
            </div>
            <span className="scan-dash__bar-label">
              {doneQueries}/{totalQueries} queries &middot; {overallPct}%
            </span>
          </div>
        )}

        {/* Synthesis progress */}
        {(phase === 'synthesizing' || phase === 'reviewing') && synthesisStatus && (
          <SynthesisProgress status={synthesisStatus} phase={phase} />
        )}
      </div>

      {/* ── Engine Cards Grid ── */}
      <div className="scan-dash__grid">
        {engines.map(engine => (
          <EngineCard key={engine.engine_id} engine={engine} phase={phase} />
        ))}
        {skippedEngines.map(eid => (
          <SkippedEngineCard key={eid} engineId={eid as EngineId} />
        ))}
      </div>

      {/* ── Live Feed ── */}
      {feed.length > 0 && phase === 'scanning' && (
        <LiveFeed feed={feed} />
      )}
    </div>
  );
}

// ── Engine Card ────────────────────────────────────────────────────────────────

function EngineCard({ engine, phase }: { engine: EngineProgress; phase: string }) {
  const meta = ENGINE_META[engine.engine_id as EngineId];
  const color = getEngineColor(engine.engine_id as EngineId);
  const pct = engine.queries_total > 0
    ? Math.round((engine.queries_done / engine.queries_total) * 100)
    : 0;

  const isActive = engine.status === 'querying';
  const isDone = engine.status === 'complete';
  const isError = engine.status === 'error';
  const isPending = engine.status === 'pending';

  const statusLabel = isActive ? `${engine.queries_done}/${engine.queries_total}`
    : isDone ? 'Complete'
    : isError ? 'Error'
    : 'Waiting...';

  // Snippet text
  const snippet = engine.latest_snippet;
  const snippetPreview = snippet?.response
    ? snippet.response.replace(/\[PLACEHOLDER[^\]]*\]/g, '').trim().slice(0, 140)
    : null;

  return (
    <div
      className={`engine-card ${isActive ? 'engine-card--active' : ''} ${isDone ? 'engine-card--done' : ''} ${isError ? 'engine-card--error' : ''} ${isPending ? 'engine-card--pending' : ''}`}
    >
      {/* Color accent bar */}
      <div className="engine-card__accent" style={{ background: color }} />

      <div className="engine-card__body">
        <div className="engine-card__top">
          <div className="engine-card__dot" style={{ background: color, boxShadow: isActive ? `0 0 8px ${color}` : 'none' }} />
          <div className="engine-card__info">
            <span className="engine-card__name">{meta?.shortName ?? engine.engine_id}</span>
            <span className="engine-card__provider">{meta?.provider ?? ''}</span>
          </div>
          <span className={`engine-card__status ${isActive ? 'engine-card__status--active' : ''}`}>
            {statusLabel}
          </span>
        </div>

        {/* Progress bar */}
        {(isActive || isDone) && (
          <div className="engine-card__bar-track">
            <div
              className="engine-card__bar-fill"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        )}

        {/* Live snippet */}
        {snippetPreview && isActive && (
          <div className="engine-card__snippet">
            {snippet?.query && (
              <div className="engine-card__query">
                &ldquo;{snippet.query.slice(0, 80)}{snippet.query.length > 80 ? '...' : ''}&rdquo;
              </div>
            )}
            <div className="engine-card__response">
              {snippetPreview}{snippetPreview.length >= 140 ? '...' : ''}
            </div>
          </div>
        )}

        {/* Done checkmark */}
        {isDone && !isActive && (
          <div className="engine-card__done-badge">&#10003; All queries complete</div>
        )}
      </div>
    </div>
  );
}

// ── Skipped Engine Card ───────────────────────────────────────────────────────

function SkippedEngineCard({ engineId }: { engineId: EngineId }) {
  const meta = ENGINE_META[engineId];
  const color = getEngineColor(engineId);

  return (
    <div className="engine-card engine-card--skipped">
      <div className="engine-card__accent" style={{ background: color, opacity: 0.3 }} />
      <div className="engine-card__body">
        <div className="engine-card__top">
          <div className="engine-card__dot" style={{ background: color, opacity: 0.3 }} />
          <div className="engine-card__info">
            <span className="engine-card__name" style={{ opacity: 0.5 }}>{meta?.shortName ?? engineId}</span>
            <span className="engine-card__provider" style={{ opacity: 0.4 }}>{meta?.provider ?? ''}</span>
          </div>
          <span className="engine-card__status engine-card__status--skipped">
            Unavailable
          </span>
        </div>
        <div className="engine-card__skipped-msg">
          API key not configured
        </div>
      </div>
    </div>
  );
}

// ── Synthesis Progress ─────────────────────────────────────────────────────────

function SynthesisProgress({ status, phase }: { status: SynthesisStatus; phase: string }) {
  const synthesized = status.engines.filter(e => e.has_synthesis).length;
  const total = status.engines.length;

  return (
    <div className="scan-dash__synthesis">
      <div className="scan-dash__synth-steps">
        <SynthStep
          label={`Engine synthesis (${synthesized}/${total})`}
          done={synthesized === total}
          active={phase === 'synthesizing'}
        />
        <SynthStep
          label="Cross-engine review"
          done={status.review_status === 'complete'}
          active={phase === 'reviewing' || status.review_status === 'processing'}
        />
        <SynthStep
          label="Building report"
          done={status.has_report}
          active={status.review_status === 'complete' && !status.has_report}
        />
      </div>
    </div>
  );
}

function SynthStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const icon = done ? '✓' : active ? '●' : '○';
  const cls = done ? 'synth-step--done' : active ? 'synth-step--active' : 'synth-step--pending';
  return (
    <div className={`synth-step ${cls}`}>
      <span className="synth-step__icon">{icon}</span>
      <span className="synth-step__label">{label}</span>
    </div>
  );
}

// ── Live Feed ──────────────────────────────────────────────────────────────────

function LiveFeed({ feed }: { feed: FeedSnippet[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [seenCount, setSeenCount] = useState(0);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (feed.length > seenCount) {
      setSeenCount(feed.length);
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }
  }, [feed.length, seenCount]);

  // Show last 10 items
  const visibleFeed = feed.slice(-10);

  return (
    <div className="live-feed">
      <div className="live-feed__header">
        <span className="live-feed__pulse" />
        <span className="live-feed__title">Live Response Feed</span>
        <span className="live-feed__count">{feed.length} responses</span>
      </div>
      <div className="live-feed__scroll" ref={feedRef}>
        {visibleFeed.map((item, i) => {
          const meta = ENGINE_META[item.engine_id as EngineId];
          const color = getEngineColor(item.engine_id as EngineId);
          const isNew = i === visibleFeed.length - 1;
          const responseText = item.response.replace(/\[PLACEHOLDER[^\]]*\]/g, '').trim();

          return (
            <div
              key={`${item.engine_id}-${item.ts}`}
              className={`feed-item ${isNew ? 'feed-item--new' : ''}`}
            >
              <div className="feed-item__engine">
                <span className="feed-item__dot" style={{ background: color }} />
                <span className="feed-item__name">{meta?.shortName ?? item.engine_id}</span>
              </div>
              <div className="feed-item__query">&ldquo;{item.query}&rdquo;</div>
              <div className="feed-item__response">
                {responseText.slice(0, 180)}{responseText.length > 180 ? '...' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}