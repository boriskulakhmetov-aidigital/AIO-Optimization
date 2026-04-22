import type { AIOData, Variant } from '../types';
import { GradePill } from './GradePill';
import { EngineMark } from './EngineMark';

type NavTarget = Variant | { variant: Variant; engineId?: string };

type Props = {
  data: AIOData;
  variant: Variant;
  activeEngineId: string;
  onNavigate: (target: NavTarget) => void;
};

type NavItem = {
  v: Variant;
  n: string;
  label: string;
  pill: string;
};

/**
 * Left report sidebar: brand head · 5-view nav · engine picker · scan metadata.
 * Mirrors the `.rs-*` and `.aio-engine-row` markup rendered by `renderSidebar()`.
 */
export function Sidebar({ data, variant, onNavigate }: Props) {
  const nav: NavItem[] = [
    { v: 'v1',     n: '01', label: 'Executive summary', pill: `${Math.round(data.overall.aiSov)}%` },
    { v: 'v2',     n: '02', label: 'Engine × intent',   pill: `${data.engines.length}×${data.INTENT_ORDER.length}` },
    { v: 'v3',     n: '03', label: 'Engine deep-dive',  pill: `${data.engines.length}` },
    { v: 'pa',     n: '04', label: 'Priority actions',  pill: `${data.actions.length}` },
    { v: 'method', n: '05', label: 'Methodology',       pill: `${data.overall.totalQueries}q` },
  ];

  const sortedEngines = data.engines
    .slice()
    .sort((a, b) => (b.aiSov || 0) - (a.aiSov || 0));

  return (
    <aside className="report-sidebar" data-sidebar>
      <div className="rs-head">
        <div className="rs-eyebrow">AIO · Brand Visibility</div>
        <h1 className="rs-brand">{data.brandPretty}</h1>
        <div className="rs-asset">
          {data.concept.type || 'brand'} scan · {data.scanDateLabel}
        </div>
      </div>

      <div className="rs-nav">
        <div className="rs-group-label">Views</div>
        {nav.map((it) => (
          <button
            key={it.v}
            type="button"
            className={`rs-item ${it.v === variant ? 'active' : ''}`}
            onClick={() => onNavigate(it.v)}
          >
            <span className="label">
              <span className="n">{it.n}</span>
              {it.label}
            </span>
            <span className="pill-mini">{it.pill}</span>
          </button>
        ))}

        <div className="rs-group-label">Engines</div>
        <div className="aio-engine-list">
          {sortedEngines.map((e) => (
            <button
              key={e.id}
              type="button"
              className="aio-engine-row"
              title={`Open ${e.name} deep-dive`}
              onClick={() =>
                onNavigate({ variant: 'v3', engineId: e.id })
              }
            >
              <EngineMark engine={e} />
              <span className="aio-engine-rowtext">
                <span className="aio-engine-name">{e.short}</span>
                <span className="aio-engine-sub">
                  {Math.round(e.aiSov)}% SOV
                </span>
              </span>
              <GradePill grade={e.grade} klass={e.gradeKlass} />
            </button>
          ))}
        </div>

        <div className="rs-group-label">Scan</div>
        <div className="aio-scanchip">
          <div className="aio-scanchip-row">
            <span>Queries</span>
            <b>{data.overall.totalQueries}</b>
          </div>
          <div className="aio-scanchip-row">
            <span>Engines</span>
            <b>{data.overall.enginesTested}</b>
          </div>
          <div className="aio-scanchip-row">
            <span>Consistency</span>
            <b>{data.overall.engineConsistency.toFixed(1)}</b>
          </div>
          <div className="aio-scanchip-row">
            <span>Duration</span>
            <b>
              {data.overall.scanDurationSeconds
                ? `${Math.round(data.overall.scanDurationSeconds)}s`
                : '—'}
            </b>
          </div>
        </div>
      </div>

      <div className="rs-meta">
        <div>Scan · {data.scanDateLabel}</div>
      </div>
    </aside>
  );
}
