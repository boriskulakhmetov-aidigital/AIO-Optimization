import { useState, useEffect, useRef } from 'react';

export interface SynthesisStatus {
  scan_id: string;
  scan_status: string;
  phase: 'scanning' | 'synthesizing' | 'reviewing' | 'complete' | 'error';
  engines: Array<{
    engine_id: string;
    status: string;
    has_synthesis: boolean;
  }>;
  review_status: string | null;
  has_report: boolean;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Polls /synthesis-status every 3s while scanId is non-null.
 * Tracks synthesis and review progress after scanning completes.
 */
export function useSynthesisPoller(scanId: string | null, authFetch: AuthFetch) {
  const [status, setStatus] = useState<SynthesisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!scanId) {
      setStatus(null);
      setError(null);
      return;
    }

    let stopped = false;

    async function poll() {
      try {
        const res = await authFetch(`/.netlify/functions/synthesis-status?id=${encodeURIComponent(scanId!)}`);
        if (!res.ok) return;
        const data = await res.json() as SynthesisStatus;
        if (stopped) return;

        setStatus(data);
        setError(null);

        // Stop polling when phase reaches terminal state
        if (data.phase === 'complete' || data.phase === 'error') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err) {
        if (!stopped) setError(String(err));
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      stopped = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [scanId]);

  return { status, error };
}