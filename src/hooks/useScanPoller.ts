import { useState, useEffect, useRef } from 'react';
import type { EngineId } from '../lib/types';

export interface EngineProgress {
  engine_id: EngineId;
  status: 'pending' | 'querying' | 'complete' | 'error';
  queries_total: number;
  queries_done: number;
  latest_snippet?: {
    engine_id: string;
    query: string;
    response: string;
    ts: number;
  } | null;
}

export interface FeedSnippet {
  engine_id: string;
  query: string;
  response: string;
  ts: number;
}

export interface ScanProgress {
  scan_id: string;
  status: 'scanning' | 'synthesizing' | 'error';
  engines: EngineProgress[];
  feed: FeedSnippet[];
}

/**
 * Polls /scan-status every 2s while scanId is non-null.
 * Returns live engine progress with response snippets.
 */
export function useScanPoller(scanId: string | null) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!scanId) {
      setProgress(null);
      setError(null);
      return;
    }

    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/.netlify/functions/scan-status?id=${encodeURIComponent(scanId!)}`);
        if (!res.ok) return;
        const data = await res.json() as ScanProgress;
        if (stopped) return;

        // Ensure feed array exists
        if (!data.feed) data.feed = [];

        setProgress(data);
        setError(null);

        // Stop polling when scanning phase is over
        if (data.status === 'synthesizing' || data.status === 'error') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err) {
        if (!stopped) setError(String(err));
      }
    }

    // Poll immediately, then every 2s
    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      stopped = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [scanId]);

  return { progress, error };
}