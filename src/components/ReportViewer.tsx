import { useEffect, useRef } from 'react';
import { marked } from 'marked';

interface Props {
  reportText: string;
}

export function ReportViewer({ reportText }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const html = marked.parse(reportText) as string;
    ref.current.innerHTML = html;
  }, [reportText]);

  return (
    <div className="report-viewer">
      <div ref={ref} className="report-content" />
    </div>
  );
}
