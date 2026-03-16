import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../lib/types';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || message.role !== 'assistant') return;
    // Simple markdown-like rendering for assistant messages
    ref.current.innerHTML = renderMarkdown(message.content);
  }, [message.content, message.role]);

  if (message.role === 'user') {
    return (
      <div className="msg-user">
        <div className="msg-bubble msg-bubble--user">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="msg-assistant">
      <div className="msg-avatar">AI</div>
      <div ref={ref} className="msg-bubble msg-bubble--assistant" />
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}
