import { useState } from 'react';
import { downloadMarkdown, downloadPDF } from '../lib/reportDownload';

interface Props {
  reportText: string;
  brandName: string;
  onNewAudit: () => void;
}

export function DownloadBar({ reportText, brandName, onNewAudit }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePDF() {
    setPdfLoading(true);
    try {
      await downloadPDF(reportText, brandName);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="download-bar">
      <span className="download-bar__label">Export report:</span>
      <button
        className="download-btn download-btn--md"
        onClick={() => downloadMarkdown(reportText, brandName)}
      >
        ↓ Markdown
      </button>
      <button
        className="download-btn download-btn--pdf"
        onClick={handlePDF}
        disabled={pdfLoading}
      >
        {pdfLoading ? 'Generating…' : '↓ PDF'}
      </button>
      <button className="download-btn download-btn--new" onClick={onNewAudit}>
        + New Audit
      </button>
    </div>
  );
}
