import { useState } from 'react';
import type { ReportData } from '../../lib/reportTypes';
import { ReportSidebar } from './ReportSidebar';
import { ExecSummaryPage } from './ExecSummaryPage';
import { SectionPage } from './SectionPage';
import { MathLogicPage } from './MathLogicPage';
import { CreativesPage } from './CreativesPage';
import { UserBriefPage } from './UserBriefPage';
import { ShareBar } from './ShareBar';

type PageId = 'exec' | 'section-1' | 'section-2' | 'section-3' | 'math' | 'creatives' | 'brief';

interface Props {
  data: ReportData;
  jobId: string;
  onBack?: () => void;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  isPublic?: boolean;   // true when viewing via share link (no auth)
  isEmbedded?: boolean; // true when rendered inside the app widget (topbar handled by parent)
}

export function MicroReport({ data, jobId, onBack, authFetch, isPublic = false, isEmbedded = false }: Props) {
  const [activePage, setActivePage] = useState<PageId>('exec');

  function renderPage() {
    switch (activePage) {
      case 'exec':      return <ExecSummaryPage data={data} />;
      case 'section-1': return <SectionPage section={data.sections[0]} />;
      case 'section-2': return <SectionPage section={data.sections[1]} />;
      case 'section-3': return <SectionPage section={data.sections[2]} />;
      case 'math':      return <MathLogicPage data={data} />;
      case 'creatives': return <CreativesPage data={data} />;
      case 'brief':     return <UserBriefPage data={data} />;
    }
  }

  const layoutClass = `mr-layout${isEmbedded ? ' mr-layout--embedded' : ''}`;

  return (
    <div className={layoutClass}>
      <ReportSidebar
        data={data}
        activePage={activePage}
        onNavigate={setActivePage}
        isPublic={isPublic}
      />

      <div className="mr-content">
        {!isPublic && !isEmbedded && (
          <div className="mr-topbar">
            {onBack && (
              <button className="btn-ghost btn-sm" onClick={onBack}>← Back</button>
            )}
            {authFetch && (
              <ShareBar jobId={jobId} authFetch={authFetch} />
            )}
          </div>
        )}

        <div className="mr-page-container">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
