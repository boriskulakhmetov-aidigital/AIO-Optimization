import { useState, useEffect, useRef } from 'react';

interface PollState {
  status: 'idle' | 'pending' | 'streaming' | 'complete' | 'error';
  partial: string | null;
  report: string | null;
  error: string | null;
}

export function useAuditPoller(jobId: string | null) {
  const [state, setState] = useState<PollState>({
    status: 'idle',
    partial: null,
    report: null,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    setState({ status: 'pending', partial: null, report: null, error: null });

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/report-status?jobId=${encodeURIComponent(jobId)}`
        );
        const data = await res.json();

        if (data.status === 'complete') {
          setState({ status: 'complete', partial: null, report: data.report ?? null, error: null });
          clearInterval(intervalRef.current!);
        } else if (data.status === 'streaming') {
          setState(s => ({ ...s, status: 'streaming', partial: data.partial ?? null }));
        } else if (data.status === 'error') {
          setState({ status: 'error', partial: null, report: null, error: data.error ?? 'Audit failed' });
          clearInterval(intervalRef.current!);
        }
        // 'pending' — keep polling
      } catch (err) {
        // transient network error — keep polling
        console.warn('Poll error:', err);
      }
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return state;
}
