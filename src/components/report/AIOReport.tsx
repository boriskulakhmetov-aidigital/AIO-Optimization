import { useState } from 'react';
import type { AIOReportData } from '../../lib/types';
import type { SupabaseClient } from '@AiDigital-com/design-system';
import { ReportHeader } from './ReportHeader';
import { KPIOverview } from './KPIOverview';
import { EngineAwareness } from './EngineAwareness';
import { CompetitiveIntel } from './CompetitiveIntel';
import { ActionItems } from './ActionItems';
import { EngineDeepDive } from './EngineDeepDive';

type ReportPage = 'overview' | 'engines' | 'competitive' | 'actions' | 'deep-dive';

interface AIOReportProps {
  data: AIOReportData;
  conceptName: string;
  onNewScan: () => void;
  scanId?: string | null;
  supabase?: SupabaseClient | null;
}

export function AIOReport({ data, conceptName, onNewScan, scanId, supabase }: AIOReportProps) {
  const [activePage, setActivePage] = useState<ReportPage>('overview');
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);

  const pages: { id: ReportPage; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'engines', label: 'Engine Awareness' },
    { id: 'competitive', label: 'Competitive Intel' },
    { id: 'actions', label: 'Action Items' },
    { id: 'deep-dive', label: 'Engine Deep Dive' },
  ];

  function handleEngineClick(engineId: string) {
    setSelectedEngine(engineId);
    setActivePage('deep-dive');
  }

  return (
    <div className="aio-report">
      <ReportHeader
        data={data}
        conceptName={conceptName}
        onNewScan={onNewScan}
        scanId={scanId ?? null}
        supabase={supabase ?? null}
      />

      <nav className="aio-report__nav">
        {pages.map(p => (
          <button
            key={p.id}
            className={`aio-report__tab ${activePage === p.id ? 'aio-report__tab--active' : ''}`}
            onClick={() => setActivePage(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div className="aio-report__content">
        {activePage === 'overview' && (
          <KPIOverview
            data={data}
            onEngineClick={handleEngineClick}
          />
        )}
        {activePage === 'engines' && (
          <EngineAwareness
            review={data.cross_engine_review}
            onEngineClick={handleEngineClick}
          />
        )}
        {activePage === 'competitive' && (
          <CompetitiveIntel review={data.cross_engine_review} />
        )}
        {activePage === 'actions' && (
          <ActionItems items={data.cross_engine_review.action_items} />
        )}
        {activePage === 'deep-dive' && (
          <EngineDeepDive
            syntheses={data.engine_syntheses}
            selectedEngine={selectedEngine}
            onSelect={setSelectedEngine}
          />
        )}
      </div>
    </div>
  );
}