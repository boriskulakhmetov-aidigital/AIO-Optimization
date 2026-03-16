import { useRef, useState } from 'react';
import type { AssetState } from '../lib/types';

interface Props {
  onFile: (file: File) => Promise<void>;
  onUrl: (url: string) => void;
  asset: AssetState | null;
  uploading: boolean;
  uploadError: string | null;
  onClear: () => void;
}

export function UploadZone({ onFile, onUrl, asset, uploading, uploadError, onClear }: Props) {
  const [mode, setMode] = useState<'image' | 'url'>('image');
  const [urlInput, setUrlInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  function handleUrlSubmit() {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onUrl(trimmed);
      setUrlInput('');
    }
  }

  // Show current asset preview
  if (asset) {
    return (
      <div className="upload-preview">
        {asset.previewUrl ? (
          <img src={asset.previewUrl} alt="Asset preview" className="upload-preview__img" />
        ) : (
          <div className="upload-preview__url">
            <span className="upload-preview__url-icon">🔗</span>
            <span className="upload-preview__url-text">{asset.assetUrl}</span>
          </div>
        )}
        <button className="upload-preview__clear" onClick={onClear} title="Remove asset">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="upload-zone">
      <div className="upload-zone__tabs">
        <button
          className={`upload-tab ${mode === 'image' ? 'upload-tab--active' : ''}`}
          onClick={() => setMode('image')}
        >
          Upload Image
        </button>
        <button
          className={`upload-tab ${mode === 'url' ? 'upload-tab--active' : ''}`}
          onClick={() => setMode('url')}
        >
          Enter URL
        </button>
      </div>

      {mode === 'image' ? (
        <div
          className={`upload-dropzone ${dragging ? 'upload-dropzone--active' : ''} ${uploading ? 'upload-dropzone--loading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {uploading ? (
            <span className="upload-dropzone__text">Uploading...</span>
          ) : (
            <>
              <span className="upload-dropzone__icon">📎</span>
              <span className="upload-dropzone__text">Drop image here or click to browse</span>
              <span className="upload-dropzone__hint">JPEG, PNG, GIF, WebP · max 8 MB</span>
            </>
          )}
        </div>
      ) : (
        <div className="upload-url">
          <input
            type="url"
            className="upload-url__input"
            placeholder="https://example.com/landing-page"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
          />
          <button className="upload-url__btn" onClick={handleUrlSubmit}>
            Set URL
          </button>
        </div>
      )}

      {uploadError && <p className="upload-zone__error">{uploadError}</p>}
    </div>
  );
}
