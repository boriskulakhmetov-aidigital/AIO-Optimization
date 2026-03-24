import { useState } from 'react';
import type { AIOReportData } from '../../lib/types';
import type { SupabaseClient } from '@boriskulakhmetov-aidigital/design-system';
import { PageHeader } from '@boriskulakhmetov-aidigital/design-system';

interface ReportHeaderProps {
  data: AIOReportData;
  conceptName: string;
  onNewScan: () => void;
  scanId: string | null;
  supabase: SupabaseClient | null;
}

export function ReportHeader({ data, conceptName, onNewScan, scanId, supabase }: ReportHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareState, setShareState] = useState<{ token: string; isPublic: boolean } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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
      const el = document.querySelector('.aio-report') as HTMLElement | null;
      if (!el) return;

      // Temporarily remove overflow/height constraints so html2canvas captures ALL content
      const scrollables = [
        el,
        el.closest('.app-layout') as HTMLElement | null,
        el.closest('.app-layout')?.querySelector(':scope > *:last-child') as HTMLElement | null,
        el.querySelector('.aio-report__content') as HTMLElement | null,
      ].filter(Boolean) as HTMLElement[];

      const saved = scrollables.map(s => s.style.cssText);
      scrollables.forEach(s => {
        s.style.overflow = 'visible';
        s.style.maxHeight = 'none';
        s.style.height = 'auto';
      });

      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `AIO-Report-${conceptName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }).from(el).save();

      // Restore original styles
      scrollables.forEach((s, i) => { s.style.cssText = saved[i]; });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!scanId || !supabase) return;
    setShowShareModal(true);
    setShareLoading(true);
    try {
      // Get existing share state
      const { data: row } = await (supabase as any)
        .from('scans')
        .select('share_token, is_public')
        .eq('id', scanId)
        .single();

      const isPublic = shareState?.isPublic ?? row?.is_public ?? false;
      const shareToken = row?.share_token || crypto.randomUUID();

      // Update with share token
      await (supabase as any)
        .from('scans')
        .update({ share_token: shareToken, is_public: isPublic })
        .eq('id', scanId);

      setShareState({ token: shareToken, isPublic });
    } catch (err) {
      console.warn('Share failed:', err);
    } finally {
      setShareLoading(false);
    }
  }

  async function togglePublic(isPublic: boolean) {
    if (!scanId || !supabase) return;
    setShareLoading(true);
    try {
      const shareToken = shareState?.token || crypto.randomUUID();

      await (supabase as any)
        .from('scans')
        .update({ share_token: shareToken, is_public: isPublic })
        .eq('id', scanId);

      setShareState({ token: shareToken, isPublic });
    } catch (err) {
      console.warn('Toggle share failed:', err);
    } finally {
      setShareLoading(false);
    }
  }

  function getShareUrl() {
    if (!shareState?.token) return '';
    return `${window.location.origin}/#/share/${shareState.token}`;
  }

  function copyLink() {
    const url = getShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        <button
          className="btn-ghost btn-sm"
          onClick={handleShare}
          title="Share report"
        >
          {'Share'}
        </button>
        <button className="btn-primary btn-sm" onClick={onNewScan}>New Scan</button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <div className="share-modal__header">
              <h3 className="share-modal__title">Share Report</h3>
              <button className="share-modal__close" onClick={() => setShowShareModal(false)}>&times;</button>
            </div>

            {shareLoading ? (
              <div className="share-modal__loading">Generating link...</div>
            ) : shareState ? (
              <div className="share-modal__body">
                <div className="share-modal__toggle-row">
                  <label className="share-modal__toggle-label">
                    <input
                      type="checkbox"
                      checked={shareState.isPublic}
                      onChange={e => togglePublic(e.target.checked)}
                    />
                    <span>Public link (anyone with the link can view)</span>
                  </label>
                </div>

                <div className="share-modal__link-row">
                  <input
                    className="share-modal__link-input"
                    value={getShareUrl()}
                    readOnly
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button className="btn-primary btn-sm" onClick={copyLink}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {!shareState.isPublic && (
                  <p className="share-modal__hint">
                    Currently private — only you can see this report. Toggle public to share.
                  </p>
                )}
                {shareState.isPublic && (
                  <p className="share-modal__hint share-modal__hint--public">
                    Anyone with this link can view the report (no login required).
                  </p>
                )}
              </div>
            ) : (
              <div className="share-modal__loading">Failed to generate link</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
