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

  const scanProgress = useScanProgress(
    supabase,
    phase === 'scanning' || phase === 'synthesizing' || phase === 'querying' || phase === 'generating_queries'
      ? scanId : null,
  );

  const dashPhase =
    phase === 'reviewing' ? 'reviewing' :
    phase === 'synthesizing' ? 'synthesizing' :
    phase === 'complete' ? 'complete' :
    phase === 'error' ? 'error' :
    'scanning';

  const synthesisStatus = jobStatus?.meta ? {
    phase: jobStatus.meta.phase,
    steps_done: jobStatus.meta.steps_done,
    total_steps: jobStatus.meta.total_steps,
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
