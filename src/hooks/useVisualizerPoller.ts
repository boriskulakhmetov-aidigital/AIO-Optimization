import { useState, useEffect, useRef } from 'react';
import type { ReportData } from '../lib/reportTypes';

interface PollState {
  status: 'idle' | 'pending' | 'complete' | 'error';
  reportData: ReportData | null;
  error: string | null;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const MAX_POLLS = 180; // 6 minutes at 2s intervals

export function useVisualizerPoller(jobId: string | null, authFetch: AuthFetch) {
  const [state, setState] = useState<PollState>({ status: 'idle', reportData: null, error: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    setState({ status: 'pending', reportData: null, error: null });
    pollCountRef.current = 0;

    intervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Timeout guard — stop after MAX_POLLS
      if (pollCountRef.current > MAX_POLLS) {
        setState({ status: 'error', reportData: null, error: 'Visual report timed out' });
        clearInterval(intervalRef.current!);
        return;
      }

      try {
        const res = await authFetch(
          `/.netlify/functions/report-data-status?jobId=${encodeURIComponent(jobId)}`
        );
        const data = await res.json();

        if (data.visualizer_status === 'complete' && data.report_data) {
          setState({ status: 'complete', reportData: data.report_data as ReportData, error: null });
          clearInterval(intervalRef.current!);
        } else if (data.visualizer_status === 'error') {
          setState({ status: 'error', reportData: null, error: 'Visual report generation failed' });
          clearInterval(intervalRef.current!);
        }
        // pending — keep polling
      } catch {
        // transient error — keep polling
      }
    }, 2_000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

  return state;
}
