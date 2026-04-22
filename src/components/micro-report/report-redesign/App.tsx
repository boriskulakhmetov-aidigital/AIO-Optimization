import { useCallback, useState } from 'react';
import { Rail, ReportTopbar } from '@AiDigital-com/design-system';
import type {
  ReportTopbarSharingConfig,
  ReportTopbarDownloadConfig,
} from '@AiDigital-com/design-system';
import type { AIOData, Variant, Mode, Theme, FX } from './types';
import { useHtmlAttributes, useLocalStorage, useVariantSweep } from './hooks';
import { Sidebar } from './components/Sidebar';
import { ExecutiveSummary } from './views/ExecutiveSummary';
import { EngineIntentMatrix } from './views/EngineIntentMatrix';
import { EngineDeepDive } from './views/EngineDeepDive';
import { PriorityActions } from './views/PriorityActions';
import { Methodology } from './views/Methodology';

export type FeedbackSubmitPayload = {
  pageKey: string;
  pageLabel: string;
  rating: number;
  note: string;
  submittedAt: number;
};

const VARIANT_ORDER: readonly Variant[] = ['v1', 'v2', 'v3', 'pa', 'method'] as const;

type Props = {
  data: AIOData;
  mode: Mode;
  /** Optional topbar chip (e.g. "Draft"). public mode renders its own pill. */
  chip?: string;
  format?: 'visual' | 'markdown';
  onFormatChange?: (f: 'visual' | 'markdown') => void;
  download?: ReportTopbarDownloadConfig;
  onNewSession?: () => void;
  newSessionLabel?: string;
  sharing?: ReportTopbarSharingConfig;
  sharedViewHref?: string;
  printHref?: string;
  onFeedbackSubmit?: (payload: FeedbackSubmitPayload) => void;
};

/**
 * Top-level AIO report app. Mirrors the NM/SFG shell pattern:
 *   rail (parked) · sidebar · main { topbar · active variant }
 */
export function App({
  data,
  mode,
  chip,
  format,
  onFormatChange,
  download,
  onNewSession,
  newSessionLabel = '+ New scan',
  sharing,
  sharedViewHref,
  printHref,
}: Props) {
  const [variant, setVariant] = useLocalStorage<Variant>('aio-variant', 'v1');
  const [activeEngineId, setActiveEngineId] = useState<string>(
    () =>
      (typeof window !== 'undefined' && localStorage.getItem('aio-engine')) ||
      data.engines[0]?.id ||
      '',
  );
  const [theme, setTheme] = useLocalStorage<Theme>('aio-theme', 'dark');
  const [fx] = useLocalStorage<FX>('aio-fx', 'showcase');

  useHtmlAttributes(theme, fx);

  const { containerRef, sectionRefs, exitingVariant, getSectionSweepClass } =
    useVariantSweep(variant, VARIANT_ORDER);

  const selectEngine = useCallback((id: string) => {
    setActiveEngineId(id);
    try {
      localStorage.setItem('aio-engine', id);
    } catch {
      /* ignore */
    }
  }, []);

  const onNavigate = useCallback(
    (target: Variant | { variant: Variant; engineId?: string }) => {
      if (typeof target === 'string') {
        setVariant(target);
      } else {
        if (target.engineId) selectEngine(target.engineId);
        setVariant(target.variant);
      }
    },
    [selectEngine, setVariant],
  );

  const isActive = (v: Variant) => variant === v || exitingVariant === v;

  return (
    <div className="shell">
      <Rail hidden />
      <Sidebar
        data={data}
        variant={variant}
        activeEngineId={activeEngineId}
        onNavigate={onNavigate}
      />
      <main
        className="report-main"
        ref={(el) => {
          containerRef.current = el;
        }}
      >
        <ReportTopbar
          breadcrumbs={
            <>
              <span>AIO Optimization</span>
              <span>›</span>
              <b>{data.brandPretty}</b>
            </>
          }
          chip={chip}
          mode={mode}
          theme={theme}
          onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          format={format}
          onFormatChange={onFormatChange}
          download={download}
          onNewSession={onNewSession}
          newSessionLabel={newSessionLabel}
          sharing={sharing}
          sharedViewHref={sharedViewHref}
          printHref={printHref}
        />

        <section
          className={`variant ${isActive('v1') ? 'active' : ''} ${getSectionSweepClass('v1')}`}
          data-variant="v1"
          ref={(el) => {
            sectionRefs.current.v1 = el;
          }}
        >
          <div className="v1-body">
            {isActive('v1') && (
              <ExecutiveSummary data={data} mode={mode} onNavigate={onNavigate} />
            )}
          </div>
        </section>
        <section
          className={`variant ${isActive('v2') ? 'active' : ''} ${getSectionSweepClass('v2')}`}
          data-variant="v2"
          ref={(el) => {
            sectionRefs.current.v2 = el;
          }}
        >
          <div className="v2-body">
            {isActive('v2') && (
              <EngineIntentMatrix data={data} mode={mode} onNavigate={onNavigate} />
            )}
          </div>
        </section>
        <section
          className={`variant ${isActive('v3') ? 'active' : ''} ${getSectionSweepClass('v3')}`}
          data-variant="v3"
          ref={(el) => {
            sectionRefs.current.v3 = el;
          }}
        >
          <div className="v3-body">
            {isActive('v3') && (
              <EngineDeepDive
                data={data}
                mode={mode}
                activeEngineId={activeEngineId}
                onEngineChange={selectEngine}
              />
            )}
          </div>
        </section>
        <section
          className={`variant ${isActive('pa') ? 'active' : ''} ${getSectionSweepClass('pa')}`}
          data-variant="pa"
          ref={(el) => {
            sectionRefs.current.pa = el;
          }}
        >
          <div className="pa-body">
            {isActive('pa') && (
              <PriorityActions data={data} mode={mode} onNavigate={onNavigate} />
            )}
          </div>
        </section>
        <section
          className={`variant ${isActive('method') ? 'active' : ''} ${getSectionSweepClass('method')}`}
          data-variant="method"
          ref={(el) => {
            sectionRefs.current.method = el;
          }}
        >
          <div className="mth-body">
            {isActive('method') && <Methodology data={data} />}
          </div>
        </section>
      </main>
    </div>
  );
}
