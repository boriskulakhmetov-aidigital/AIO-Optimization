// ── Rate Limiter & Retry ─────────────────────────────────────────────────────
// Simple in-memory rate limiter (per background function invocation) and
// retry logic with exponential backoff for transient API failures.

import { getEngine } from './engineRegistry.js';
import type { EngineId } from './types.js';

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simple sliding-window rate limiter for one engine within a single
 * function invocation. Tracks timestamps of recent calls and waits
 * if the limit would be exceeded.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;

  constructor(engineId: EngineId) {
    this.maxPerMinute = getEngine(engineId).rateLimitPerMin;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 60 seconds
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);

    if (this.timestamps.length >= this.maxPerMinute) {
      // Wait until the oldest timestamp falls out of the window
      const oldest = this.timestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100; // +100ms buffer
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      // Clean up again after waiting
      const afterWait = Date.now();
      this.timestamps = this.timestamps.filter(t => afterWait - t < 60_000);
    }

    this.timestamps.push(Date.now());
  }
}

/**
 * Execute an async function with retry logic.
 * Uses exponential backoff: 1s, 4s, 16s.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<{ result: T; retries: number } | { error: string; retries: number }> {
  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retries: attempt };
    } catch (err) {
      lastError = String(err);

      // Don't retry on non-retryable errors
      if (isNonRetryable(lastError)) {
        return { error: lastError, retries: attempt };
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(4, attempt) * 1000; // 1s, 4s, 16s
        await sleep(backoffMs);
      }
    }
  }

  return { error: lastError, retries: maxRetries };
}

/**
 * Check if an error is non-retryable (auth errors, invalid requests, etc.)
 */
function isNonRetryable(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid_api_key') ||
    lower.includes('authentication') ||
    lower.includes('not configured')
  );
}

/**
 * Run queries in controlled parallel batches.
 * Returns results in the same order as inputs.
 */
export async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((item, batchIdx) => fn(item, i + batchIdx))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled') {
        results[i + j] = r.value;
      } else {
        // For rejected promises, the caller's fn should handle errors internally
        // This is a safety net
        results[i + j] = undefined as unknown as R;
      }
    }
  }

  return results;
}