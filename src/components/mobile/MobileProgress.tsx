import { useScanProgress } from '@AiDigital-com/design-system';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ScanDashboard } from '../ScanDashboard';

interface Props {
  brandName: string;
  jobStatus: any;
  supabase: SupabaseClient | null;
  scanId: string | null;
}

export function MobileProgress({ brandName, jobStatus, supabase, scanId }: Props) {
  const phase = jobStatus?.meta?.phase || jobStatus?.status || 'scanning';

  const engineProgress = useScanProgress(
    supabase,
    phase !== 'complete' && phase !== 'error' ? scanId : null,
  );

  const dashPhase =
    phase === 'reviewing' ? 'reviewing' :
    phase === 'synthesizing' ? 'synthesizing' :
    phase === 'complete' ? 'complete' :
    phase === 'error' ? 'error' :
    'scanning';

  // Transform useScanProgress output (engine map) → ScanProgress format for ScanDashboard
  const scanProgress = scanId ? {
    scan_id: scanId,
    status: dashPhase === 'scanning' ? 'scanning' as const : 'synthesizing' as const,
    engines: Object.values(engineProgress).map((e: any) => ({
      engine_id: e.engine_id,
      status: e.status,
      queries_total: e.queries_total,
      queries_done: e.queries_done,
    })),
    feed: [] as any[],
  } : null;

  const synthesisStatus = scanId ? {
    scan_id: scanId,
    scan_status: dashPhase,
    phase: dashPhase as any,
    engines: Object.values(engineProgress).map((e: any) => ({
      engine_id: e.engine_id,
      status: e.status,
      has_synthesis: !!e.synthesis_data,
    })),
    review_status: dashPhase === 'reviewing' ? 'processing' : null,
    has_report: false,
  } : null;

  return (
    <div className="m-progress">
      <ScanDashboard
        conceptName={brandName}
        scanProgress={scanProgress}
        synthesisStatus={synthesisStatus}
        phase={dashPhase as any}
      />
    </div>
  );
}
