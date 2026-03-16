export function downloadMarkdown(reportText: string, brandName: string): void {
  const slug = brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const filename = `neuromarketing-audit-${slug}-${Date.now()}.md`;
  const blob = new Blob([reportText], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPDF(reportText: string, brandName: string): Promise<void> {
  const slug = brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const filename = `neuromarketing-audit-${slug}-${Date.now()}.pdf`;

  const { marked } = await import('marked');
  const html = marked(reportText) as string;

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = [
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'padding: 48px',
    'max-width: 800px',
    'color: #1a1a1a',
    'line-height: 1.6',
  ].join('; ');
  document.body.appendChild(container);

  try {
    const { default: html2pdf } = await import('html2pdf.js');
    await html2pdf()
      .set({
        margin: [12, 16],
        filename,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
