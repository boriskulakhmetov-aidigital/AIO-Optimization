import type { AIOReportData } from '../../lib/types';

interface ReportHeaderProps {
  data: AIOReportData;
  conceptName: string;
  onNewScan: () => void;
}

export function ReportHeader({ data, conceptName, onNewScan }: ReportHeaderProps) {
  const meta = data.meta;
  const scanDate = new Date(meta.scan_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const duration = meta.scan_duration_seconds;
  const durationStr = duration > 60
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : `${duration}s`;

  return (
    <div className="report-header">
      <div className="report-header__left">
        <h1 className="report-header__title">
          AI Search Optimization Report
        </h1>
        <p className="report-header__concept">{conceptName}</p>
        <div className="report-header__meta">
          <span>{meta.concept_type}</span>
          <span className="report-header__sep">&middot;</span>
          <span>{meta.engines_tested.length} engines</span>
          <span className="report-header__sep">&middot;</span>
          <span>{meta.total_queries} queries</span>
          <span className="report-header__sep">&middot;</span>
          <span>{scanDate}</span>
          <span className="report-header__sep">&middot;</span>
          <span>{durationStr}</span>
        </div>
      </div>
      <div className="report-header__right">
        <button className="btn-primary btn-sm" onClick={onNewScan}>New Scan</button>
      </div>
    </div>
  );
}