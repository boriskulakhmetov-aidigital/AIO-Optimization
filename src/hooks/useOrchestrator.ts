import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import type { ChatMessage } from '../lib/types';
import { parseSSEStream } from '@boriskulakhmetov-aidigital/design-system';
import type { UseSessionPersistenceReturn } from '@boriskulakhmetov-aidigital/design-system';

export interface ScanDispatchConfig {
  concept_type: string;
  concept_name: string;
  concept_category: string;
  concept_context?: string;
  engines: string[];
  query_count: number;
}

export function useOrchestrator(
  onScanDispatch: (config: ScanDispatchConfig, sessionId: string, messages: ChatMessage[]) => void,
  session: UseSessionPersistenceReturn | null,
) {
  const { getToken } = useAuth();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local ref for real-time streaming — React batches updates in async loops
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync when session messages change externally (e.g. loadSession)
  const lastSyncedRef = useRef<ChatMessage[]>([]);
  if (session && session.messages !== lastSyncedRef.current) {
    messagesRef.current = session.messages;
    lastSyncedRef.current = session.messages;
  }

  const reset = useCallback(() => {
    messagesRef.current = [];
    setStreaming(false);
    setError(null);
  }, []);

  /** Restore messages from a loaded scan (called by App.tsx after loadSession) */
  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    messagesRef.current = msgs;
    if (session) {
      session.setMessages(msgs);
    }
  }, [session]);

  async function sendMessage(userText: string) {
    if (streaming || !session) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText };
    messagesRef.current = [...messagesRef.current, userMsg];
    session.addMessage(userMsg);
    setStreaming(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch('/.netlify/functions/orchestrator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error: ${res.status}`);

      for await (const event of parseSSEStream(res.body)) {
        if (event.type === 'text_delta') {
          // Update local ref for real-time streaming
          const msgs = messagesRef.current;
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            messagesRef.current = [...msgs.slice(0, -1), { ...last, content: last.content + event.text }];
          } else {
            messagesRef.current = [...msgs, { id: crypto.randomUUID(), role: 'assistant', content: event.text }];
          }
          // Update session state for React rendering
          session.updateLastAssistant(event.text);
        } else if (event.type === 'scan_dispatch') {
          console.log('[AIO] Orchestrator emitted scan_dispatch:', event.scanConfig);
          onScanDispatch(
            event.scanConfig as unknown as ScanDispatchConfig,
            session.sessionId!,
            messagesRef.current,
          );
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      // Sync final messages to session and flush
      session.setMessages(messagesRef.current);
      await session.flush();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setStreaming(false);
    }
  }

  return {
    messages: session?.messages ?? [],
    streaming,
    error,
    sendMessage,
    reset,
    loadMessages,
  };
}
