/**
 * Scheduled function: claims and executes pipeline tasks.
 *
 * Runs every 5 minutes via Netlify cron. Each invocation:
 * 1. Claims pending tasks from pipeline_tasks
 * 2. Calls task-worker to execute them
 * 3. Loops for up to 55s to process multiple tasks
 *
 * This is the ONLY entry point for pipeline task execution.
 * No background functions, no fetch triggers.
 */

export default async (req: Request) => {
  const siteUrl = process.env.URL || 'https://aio-optimization.apps.aidigitallabs.com';
  let processed = 0;
  const deadline = Date.now() + 55_000;

  while (Date.now() < deadline) {
    try {
      // Call task-worker — it handles claim + execute
      const res = await fetch(`${siteUrl}/.netlify/functions/task-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // task-worker streams responses for long tasks — read full body
      const contentType = res.headers.get('content-type') || '';
      let result: Record<string, unknown>;

      if (contentType.includes('text/event-stream')) {
        // Streaming response — read until done, extract final status
        const text = await res.text();
        const isDone = text.includes('done ');
        const isError = text.includes('error ');
        result = { status: isDone ? 'ok' : isError ? 'error' : 'streaming', taskType: 'streaming' };
      } else {
        result = await res.json() as Record<string, unknown>;
      }

      if (result.status === 'idle') {
        // No tasks — wait 10s before checking again
        await new Promise(r => setTimeout(r, 10_000));
      } else {
        processed++;
        console.log(`[task-poller] Processed: ${result.taskType} (${result.status})`);
        // Pause between tasks — 5s to prevent hammering DB
        await new Promise(r => setTimeout(r, 5_000));
      }
    } catch (err) {
      console.warn('[task-poller] Worker call failed:', err);
      await new Promise(r => setTimeout(r, 10_000));
    }
  }

  return Response.json({ processed });
};

export const config = {
  schedule: '*/5 * * * *',
};
