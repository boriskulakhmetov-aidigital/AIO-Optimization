import { useMemo } from 'react';
import type { AIOReportData } from '../../lib/types';
import { PrintLayout } from '@AiDigital-com/design-system';
import type { SupabaseClient } from '@AiDigital-com/design-system';
import { App as ReportApp } from './report-redesign/App';
import type { FeedbackSubmitPayload } from './report-redesign/App';
import { normalizeReport } from './report-redesign/data';
import type { RawReport } from './report-redesign/types';
import './report-redesign/styles/index.css';

interface Props {
  data: AIOReportData;
  scanId: string;
  supabase?: SupabaseClient | null;
  /** true when viewing via share link (no auth) */
  isPublic?: boolean;
  /** true when rendered inside the app's own chrome (owner view) */
  isEmbedded?: boolean;
  /** true when rendering for PDF — all variants stacked in PrintLayout */
  isPrintMode?: boolean;

  // Topbar controls — flat props the bridge assembles into ReportTopbar configs.
  format?: 'visual' | 'markdown';
  onFormatChange?: (f: 'visual' | 'markdown') => void;
  reportText?: string;
  downloadTitle?: string;
  onNewScan?: () => void;
}

/**
 * Bridge between AIO's ReportData surface and the Claude Design React port.
 * Assembles DS `ReportTopbar` structured configs so AIO's App.tsx doesn't
 * duplicate sharing / download / new-session controls in a second bar.
 */
export function MicroReport({
  data,
  scanId,
  supabase,
  isPublic = false,
  isEmbedded: _isEmbedded = false,
  isPrintMode = false,
  format,
  onFormatChange,
  reportText,
  downloadTitle,
  onNewScan,
}: Props) {
  const aioData = useMemo(() => {
    const raw = {
      session: { report_data: data },
    } as unknown as RawReport;
    return normalizeReport(raw);
  }, [data]);

  // Embedded (owner inside AIO chrome) is still `interactive` — only
  // share-link visitors get `public` mode + non-interactive pill.
  const mode: 'interactive' | 'public' | 'print' = isPrintMode
    ? 'print'
    : isPublic
    ? 'public'
    : 'interactive';

  function handleFeedbackSubmit(payload: FeedbackSubmitPayload) {
    fetch('/.netlify/functions/save-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: scanId,
        app: 'aio',
        jobId: scanId,
        score: payload.rating,
        feedbackText: payload.note,
        outputText: payload.pageLabel,
        inputSnapshot: {
          pageKey: payload.pageKey,
          brand_name: (data as { brand_name?: string }).brand_name ?? '',
        },
      }),
    }).catch(() => {
      /* non-fatal */
    });
  }

  if (isPrintMode) {
    return (
      <PrintLayout>
        <ReportApp data={aioData} mode="print" />
      </PrintLayout>
    );
  }

  const sharing =
    mode === 'interactive' && supabase
      ? { jobId: scanId, supabase, tableName: 'scans' }
      : undefined;

  const download =
    reportText && mode === 'interactive'
      ? {
          reportText,
          title: downloadTitle || (data as { brand_name?: string }).brand_name || 'AIO Scan',
        }
      : undefined;

  return (
    <ReportApp
      data={aioData}
      mode={mode}
      format={format}
      onFormatChange={onFormatChange}
      download={download}
      onNewSession={mode === 'interactive' ? onNewScan : undefined}
      newSessionLabel="+ New scan"
      sharing={sharing}
      onFeedbackSubmit={mode === 'interactive' ? handleFeedbackSubmit : undefined}
    />
  );
}
