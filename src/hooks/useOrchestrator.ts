import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, AssetState, IntakeSummary } from '../lib/types';
import { parseSSEStream } from '../lib/sseParser';

interface OrchestratorState {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function useOrchestrator(
  onAuditDispatch: (intakeSummary: IntakeSummary, sessionId: string, messages: ChatMessage[]) => void,
  authFetch: AuthFetch
) {
  const [state, setState] = useState<OrchestratorState>({
    messages: [],
    streaming: false,
    error: null,
  });

  const messagesRef      = useRef<ChatMessage[]>([]);
  const sessionIdRef     = useRef<string>(crypto.randomUUID());
  const sessionSavedRef  = useRef(false);

  /** Reset the hook for a new audit session */
  const reset = useCallback(() => {
    messagesRef.current    = [];
    sessionIdRef.current   = crypto.randomUUID();
    sessionSavedRef.current = false;
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

  async function sendMessage(userText: string, asset?: AssetState | null) {
    if (state.streaming) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText };
    addMessage(userMsg);
    setState(s => ({ ...s, streaming: true, error: null }));

    // Save session to DB on first message
    if (!sessionSavedRef.current) {
      sessionSavedRef.current = true;
      authFetch('/.netlify/functions/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', id: sessionIdRef.current, status: 'chatting' }),
      }).catch(console.warn);
    }

    try {
      const res = await fetch('/.netlify/functions/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
          fileUri:  asset?.fileUri,
          mimeType: asset?.mimeType,
          assetUrl: asset?.assetUrl,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error: ${res.status}`);

      for await (const event of parseSSEStream(res.body)) {
        if (event.type === 'text_delta') {
          updateLastAssistant(event.text);
        } else if (event.type === 'audit_dispatch') {
          onAuditDispatch(
            event.intakeSummary as IntakeSummary,
            sessionIdRef.current,
            messagesRef.current
          );
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      // Persist messages after each exchange
      authFetch('/.netlify/functions/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_messages',
          id: sessionIdRef.current,
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
        }),
      }).catch(console.warn);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setState(s => ({ ...s, error: msg }));
    } finally {
      setState(s => ({ ...s, streaming: false }));
    }
  }

  return { ...state, sendMessage, sessionId: sessionIdRef.current, reset };
}
