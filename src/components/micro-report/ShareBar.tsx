import { useState } from 'react';

interface Props {
  jobId: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function ShareBar({ jobId, authFetch }: Props) {
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggleShare(makePublic: boolean) {
    setLoading(true);
    try {
      const res = await authFetch(`/.netlify/functions/report-share?id=${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: makePublic }),
      });
      const data = await res.json();
      setIsPublic(data.is_public);
      setShareToken(data.share_token);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/r/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mr-share-bar">
      <span className="mr-share-bar__label">Share</span>

      <div className="mr-share-bar__toggle">
        <button
          className={`mr-share-btn${isPublic === false ? ' mr-share-btn--active' : ''}`}
          onClick={() => toggleShare(false)}
          disabled={loading}
        >
          Private
        </button>
        <button
          className={`mr-share-btn${isPublic === true ? ' mr-share-btn--active' : ''}`}
          onClick={() => toggleShare(true)}
          disabled={loading}
        >
          Public
        </button>
      </div>

      {shareToken && (
        <button className="mr-share-copy" onClick={copyLink}>
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
      )}

      {isPublic === true && (
        <span className="mr-share-bar__hint">Anyone with the link can view</span>
      )}
      {isPublic === false && shareToken && (
        <span className="mr-share-bar__hint">Org + AIDigital only</span>
      )}
    </div>
  );
}
