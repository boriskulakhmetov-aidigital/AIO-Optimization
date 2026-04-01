import { useState } from 'react';
import type { AIOReportData } from '../../lib/types';
import type { SupabaseClient } from '@AiDigital-com/design-system';
import { FeedbackWidget } from '@AiDigital-com/design-system';
import { useAuth } from '@clerk/react';
import { ReportHeader } from './ReportHeader';
import { KPIOverview } from './KPIOverview';
import { EngineAwareness } from './EngineAwareness';
import { CompetitiveIntel } from './CompetitiveIntel';
import { ActionItems } from './ActionItems';
import { EngineDeepDive } from './EngineDeepDive';

type ReportPage = 'overview' | 'engines' | 'competitive' | 'actions' | 'deep-dive';

/** Map page ID to feedback context for FeedbackWidget */
function getPageFeedbackConfig(
  pageId: ReportPage,
  data: AIOReportData,
): { label: string; prompt: string; summary: string } | null {
  if (pageId === 'overview') {
    return {
      label: 'KPI Overview',
      prompt: 'Was this assessment accurate?',
      summary: data.executive_summary?.slice(0, 500) ?? '',
    };
  }
  if (pageId === 'engines') {
    return {
      label: 'Engine Awareness',
      prompt: 'Were the engine analyses insightful?',
      summary: data.cross_engine_review?.executive_summary?.slice(0, 500) ?? '',
    };
  }
  if (pageId === 'actions') {
    return {
      label: 'Action Items',
      prompt: 'Were these recommendations actionable?',
      summary: data.cross_engine_review?.action_items?.map(a => a.action_text).join(', ').slice(0, 500) ?? '',
    };
  }
  // competitive and deep-dive are not scorable
  return null;
}

interface AIOReportProps {
  data: AIOReportData;
  conceptName: string;
  onNewScan: () => void;
  scanId?: string | null;
  supabase?: SupabaseClient | null;
  isPrintMode?: boolean;
}

<<<<<<< HEAD
export function AIOReport({ data, conceptName, onNewScan, scanId, supabase }: AIOReportProps) {
  const { getToken } = useAuth();
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

  if (isPrintMode) {
    return (
      <div className="aio-report mr-layout--print">
        <ReportHeader data={data} conceptName={conceptName} onNewScan={onNewScan} scanId={scanId ?? null} supabase={supabase ?? null} />
        <div className="mr-content">
          <div className="mr-print-page"><KPIOverview data={data} onEngineClick={() => {}} /></div>
          <div className="mr-print-page"><EngineAwareness review={data.cross_engine_review} onEngineClick={() => {}} /></div>
          <div className="mr-print-page"><CompetitiveIntel review={data.cross_engine_review} /></div>
          <div className="mr-print-page"><ActionItems items={data.cross_engine_review.action_items} /></div>
          <div className="mr-print-page"><EngineDeepDive syntheses={data.engine_syntheses} selectedEngine={null} onSelect={() => {}} /></div>
        </div>
      </div>
    );
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

        {scanId && (() => {
          const config = getPageFeedbackConfig(activePage, data);
          if (!config) return null;
          return (
            <div className="aio-report__feedback-zone">
              <FeedbackWidget
                key={activePage}
                variant="card"
                outputId={scanId}
                app="aio-optimization"
                sectionId={activePage}
                label={config.label}
                prompt={config.prompt}
                outputText={config.summary}
                inputSnapshot={{
                  concept_name: conceptName,
                  engines_tested: data.meta.engines_tested?.length,
                }}
                onSubmit={async (score, feedbackText, meta) => {
                  try {
                    const token = await getToken();
                    fetch('/.netlify/functions/save-feedback', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        sessionId: scanId,
                        app: 'aio-optimization',
                        jobId: scanId,
                        score,
                        feedbackText,
                        outputText: config.summary,
                        inputSnapshot: {
                          concept_name: conceptName,
                          engines_tested: data.meta.engines_tested?.length,
                          section: meta.sectionId,
                        },
                      }),
                    }).catch(console.error);
                  } catch { /* non-fatal */ }
                }}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}