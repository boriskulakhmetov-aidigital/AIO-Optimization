import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, streaming, error, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {isEmpty && (
          <div className="chat-welcome">
            <div className="chat-welcome__icon">&#128269;</div>
            <h2 className="chat-welcome__title">AI Search Optimization</h2>
            <p className="chat-welcome__sub">
              Tell me about a product, brand, or concept and I'll analyze how it's recommended
              across consumer AI engines like ChatGPT, Gemini, Claude, Grok, and more.
            </p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && (
          <div className="msg-assistant">
            <div className="msg-avatar">AI</div>
            <div className="msg-bubble msg-bubble--assistant msg-bubble--typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {error && <p className="chat-error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            className="chat-textarea"
            placeholder="Describe what you'd like to analyze (e.g., 'How is Tesla recommended by AI assistants?')"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={streaming}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={streaming || !input.trim()}
          >
            {streaming ? '...' : '\u2191'}
          </button>
        </div>
      </div>
    </div>
  );
}