import { useState } from 'react';
import type { AIOReportData } from '../../lib/types';
import type { SupabaseClient } from '@AiDigital-com/design-system';
import { PageHeader, ConnectedShareBar, downloadVisualPDF } from '@AiDigital-com/design-system';

interface ReportHeaderProps {
  data: AIOReportData;
  conceptName: string;
  onNewScan: () => void;
  scanId: string | null;
  supabase: SupabaseClient | null;
}

export function ReportHeader({ data, conceptName, onNewScan, scanId, supabase }: ReportHeaderProps) {
  const [exporting, setExporting] = useState(false);

  const meta = data.meta;
  const scanDate = new Date(meta.scan_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const duration = meta.scan_duration_seconds;
  const durationStr = duration > 60
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : `${duration}s`;

  async function handleExportPDF() {
    setExporting(true);
    try {
      await downloadVisualPDF('.aio-report__content', `AIO Report — ${conceptName}`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI Search Optimization Report"
        subtitle={conceptName}
        meta={
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
        }
      />
      <div className="report-header__actions">
        <button
          className="btn-ghost btn-sm"
          onClick={handleExportPDF}
          disabled={exporting}
          title="Export as PDF"
        >
          {exporting ? 'Exporting...' : 'PDF'}
        </button>
        <button className="btn-primary btn-sm" onClick={onNewScan}>New Scan</button>
      </div>

      {scanId && (
        <ConnectedShareBar
          jobId={scanId}
          supabase={supabase}
          tableName="scans"
          shareBaseUrl={`${window.location.origin}/r/`}
        />
      )}
    </>
  );
}
