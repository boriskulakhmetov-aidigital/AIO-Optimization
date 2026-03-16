import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, AssetState } from '../lib/types';
import { MessageBubble } from './MessageBubble';
import { UploadZone } from './UploadZone';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  asset: AssetState | null;
  uploading: boolean;
  uploadError: string | null;
  onSend: (text: string, asset?: AssetState | null) => void;
  onFile: (file: File) => Promise<void>;
  onUrl: (url: string) => void;
  onClearAsset: () => void;
}

export function ChatPanel({
  messages,
  streaming,
  error,
  asset,
  uploading,
  uploadError,
  onSend,
  onFile,
  onUrl,
  onClearAsset,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    onSend(text, asset);
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
            <div className="chat-welcome__icon">🧠</div>
            <h2 className="chat-welcome__title">Neuromarketing Audit</h2>
            <p className="chat-welcome__sub">
              Upload a creative or paste a URL, then describe your brand and goal. I'll run a
              full 41-criterion neuromarketing and color psychology audit.
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
        <UploadZone
          onFile={onFile}
          onUrl={onUrl}
          asset={asset}
          uploading={uploading}
          uploadError={uploadError}
          onClear={onClearAsset}
        />
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Describe your brand, audience, or type 'default' for standard settings…"
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
            {streaming ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
