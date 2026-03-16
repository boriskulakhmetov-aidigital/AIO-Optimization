import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '../lib/types';
import { parseSSEStream } from '../lib/sseParser';

export interface ScanDispatchConfig {
  concept_type: string;
  concept_name: string;
  concept_category: string;
  concept_context?: string;
  engines: string[];
  query_count: number;
}

interface OrchestratorState {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
}

export function useOrchestrator(
  onScanDispatch: (config: ScanDispatchConfig, sessionId: string, messages: ChatMessage[]) => void,
) {
  const [state, setState] = useState<OrchestratorState>({
    messages: [],
    streaming: false,
    error: null,
  });

  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const reset = useCallback(() => {
    messagesRef.current = [];
    sessionIdRef.current = crypto.randomUUID();
    setState({ messages: [], streaming: false, error: null });
  }, []);

  function addMessage(msg: ChatMessage) {
    messagesRef.current = [...messagesRef.current, msg];
    setState(s => ({ ...s, messages: messagesRef.current }));
  }

  function updateLastAssistant(text: string) {
    const msgs = messagesRef.current;
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') {
      const updated = [...msgs.slice(0, -1), { ...last, content: last.content + text }];
      messagesRef.current = updated;
      setState(s => ({ ...s, messages: updated }));
    } else {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', content: text });
    }
  }

  async function sendMessage(userText: string) {
    if (state.streaming) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText };
    addMessage(userMsg);
    setState(s => ({ ...s, streaming: true, error: null }));

    try {
      const res = await fetch('/.netlify/functions/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error: ${res.status}`);

      for await (const event of parseSSEStream(res.body)) {
        if (event.type === 'text_delta') {
          updateLastAssistant(event.text);
        } else if (event.type === 'scan_dispatch') {
          console.log('[AIO] Orchestrator emitted scan_dispatch:', event.scanConfig);
          // Call dispatch handler but don't let its errors kill the orchestrator
          onScanDispatch(
            event.scanConfig as unknown as ScanDispatchConfig,
            sessionIdRef.current,
            messagesRef.current,
          );
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      // Messages are passed to dispatch-scan when scan starts — no need to persist during chat

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setState(s => ({ ...s, error: msg }));
    } finally {
      setState(s => ({ ...s, streaming: false }));
    }
  }

  return { ...state, sendMessage, sessionId: sessionIdRef.current, reset };
}