import { useState } from 'react';
import type { ReportData, PrioritizedAction, SeverityLevel } from '../../lib/reportTypes';

interface Props { data: ReportData; }

function severityClass(s: SeverityLevel) {
  return s === 'CRITICAL' ? 'sev--critical' : s === 'SIGNIFICANT' ? 'sev--significant' : s === 'MODERATE' ? 'sev--moderate' : 'sev--improvement';
}

function ActionCard({ action }: { action: PrioritizedAction }) {
  return (
    <div className={`mr-action-card ${severityClass(action.severity)}`}>
      <div className="mr-action-card__header">
        <span className="mr-action-card__id">{action.criterion_id}</span>
        <span className="mr-action-card__name">{action.criterion_name}</span>
        <span className={`mr-sev-badge ${severityClass(action.severity)}`}>{action.severity}</span>
        {action.score !== null && <span className="mr-action-card__score">{action.score}/10</span>}
      </div>
      <p className="mr-action-card__text">{action.action_text}</p>
    </div>
  );
}

function AssetPreview({ meta }: { meta: ReportData['meta'] }) {
  const [imgError, setImgError] = useState(false);

  if (meta.asset_thumbnail_uri && !imgError) {
    return (
      <div className="mr-asset-preview">
        <img
          src={meta.asset_thumbnail_uri}
          alt="Analyzed creative"
          className="mr-asset-preview__img"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  if (meta.asset_thumbnail_uri && imgError) {
    return (
      <div className="mr-asset-preview mr-asset-preview--placeholder">
        <span className="mr-asset-preview__icon">🖼</span>
        <span className="mr-asset-preview__label">Uploaded creative<br /><small>Preview unavailable</small></span>
      </div>
    );
  }
  if (meta.asset_url) {
    let domain = meta.asset_url;
    try { domain = new URL(meta.asset_url).hostname.replace('www.', ''); } catch {}
    return (
      <div className="mr-asset-preview mr-asset-preview--url">
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(meta.asset_url)}`}
          alt=""
          className="mr-asset-preview__favicon"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="mr-asset-preview__domain">{domain}</span>
        <a href={meta.asset_url} target="_blank" rel="noopener noreferrer" className="mr-asset-preview__visit">↗</a>
      </div>
    );
  }
  return null;
}

export function ExecSummaryPage({ data }: Props) {
  const { executive_summary: es, meta } = data;
  const allActions = [...es.critical_actions, ...es.high_value_actions];

  return (
    <div className="mr-page">
      <div className="mr-page__header">
        <div className="mr-page__header-top">
          <div className="mr-page__header-text">
            <h1 className="mr-page__title">Executive Summary</h1>
            <div className="mr-page__meta">
              <span className="mr-overall-score">{meta.overall_score.toFixed(1)}<span className="mr-overall-score__denom">/10</span></span>
              <div className="mr-page__meta-details">
                <span>{meta.scored_criteria_count} criteria scored</span>
                <span>{meta.na_criteria_count} N/A</span>
              </div>
            </div>
          </div>
          <AssetPreview meta={meta} />
        </div>
      </div>

      <div className="mr-exec-body">
        {es.text}
      </div>

      <div className="mr-section-divider">
        <span>Action Roadmap ({allActions.length} items)</span>
      </div>

      <div className="mr-actions-grid">
        {es.critical_actions.length > 0 && (
          <>
            <h3 className="mr-actions-heading sev--critical">Critical — Fix Before Launch</h3>
            {es.critical_actions.map(a => <ActionCard key={a.criterion_id} action={a} />)}
          </>
        )}
        {es.high_value_actions.length > 0 && (
          <>
            <h3 className="mr-actions-heading sev--significant">High-Value Actions</h3>
            {es.high_value_actions.map(a => <ActionCard key={a.criterion_id} action={a} />)}
          </>
        )}
      </div>
    </div>
  );
}
