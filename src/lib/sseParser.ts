export type SSEEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'scan_dispatch'; scanConfig: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent;
          yield event;
        } catch {
          // ignore malformed lines
        }
      }
      // lines starting with ':' are SSE comments (keepalive) — skip
    }
  }
}