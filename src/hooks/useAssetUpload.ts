import { useState } from 'react';
import type { AssetState } from '../lib/types';

interface UploadState {
  asset: AssetState | null;
  uploading: boolean;
  error: string | null;
}

export function useAssetUpload() {
  const [state, setState] = useState<UploadState>({
    asset: null,
    uploading: false,
    error: null,
  });

  async function uploadFile(file: File): Promise<AssetState | null> {
    setState({ asset: null, uploading: true, error: null });

    const previewUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/.netlify/functions/upload-asset', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ asset: null, uploading: false, error: data.error ?? 'Upload failed' });
        URL.revokeObjectURL(previewUrl);
        return null;
      }

      const asset: AssetState = {
        fileUri: data.fileUri,
        mimeType: data.mimeType,
        fileName: data.fileName,
        previewUrl,
      };
      setState({ asset, uploading: false, error: null });
      return asset;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setState({ asset: null, uploading: false, error: msg });
      URL.revokeObjectURL(previewUrl);
      return null;
    }
  }

  function setUrl(url: string) {
    const asset: AssetState = { assetUrl: url };
    setState({ asset, uploading: false, error: null });
    return asset;
  }

  function clear() {
    if (state.asset?.previewUrl) URL.revokeObjectURL(state.asset.previewUrl);
    setState({ asset: null, uploading: false, error: null });
  }

  return { ...state, uploadFile, setUrl, clear };
}
