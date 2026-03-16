import { useState } from 'react';
import type { ReportData } from '../../lib/reportTypes';

interface Props { data: ReportData; }

function WebsiteCard({ url }: { url: string }) {
  let domain = url;
  try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
  return (
    <div className="mr-creative-card mr-creative-card--website">
      <div className="mr-creative-card__label">Analyzed Website</div>
      <div className="mr-creative-card__website-body">
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`}
          alt=""
          className="mr-creative-card__favicon"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="mr-creative-card__domain">{domain}</span>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mr-creative-card__visit-btn">
        Open Website ↗
      </a>
    </div>
  );
}

function UploadedImageCard({ uri, brandName }: { uri: string; brandName: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="mr-creative-card mr-creative-card--primary mr-creative-card--placeholder">
        <div className="mr-creative-card__label">Analyzed Asset</div>
        <div className="mr-creative-card__placeholder-body">
          <span className="mr-creative-card__placeholder-icon">🖼</span>
          <p>Creative was uploaded directly for analysis.<br />Permanent preview not available.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mr-creative-card mr-creative-card--primary">
      <div className="mr-creative-card__label">Analyzed Asset</div>
      <img
        src={uri}
        alt={`${brandName} creative asset`}
        className="mr-creative-card__image"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

export function CreativesPage({ data }: Props) {
  const { creatives, meta } = data;

  return (
    <div className="mr-page">
      <div className="mr-page__header">
        <h1 className="mr-page__title">Creatives</h1>
        <p className="mr-page__subtitle">{meta.asset_type_label} · {meta.brand_name}</p>
      </div>

      {creatives.synthesis && (
        <div className="mr-section-summary">{creatives.synthesis}</div>
      )}

      <div className={`mr-creatives-grid mr-creatives-grid--${creatives.layout}`}>
        {meta.asset_thumbnail_uri && (
          <UploadedImageCard uri={meta.asset_thumbnail_uri} brandName={meta.brand_name} />
        )}

        {meta.asset_url && (
          <WebsiteCard url={meta.asset_url} />
        )}

        {creatives.assets.filter(a => a.url && a.url !== meta.asset_url).map((asset, i) => (
          <div key={i} className="mr-creative-card">
            <div className="mr-creative-card__label">{asset.label}</div>
            <a href={asset.url} target="_blank" rel="noopener noreferrer" className="mr-creative-card__url-link">
              {asset.url}
            </a>
            {asset.description && (
              <p className="mr-creative-card__desc">{asset.description}</p>
            )}
          </div>
        ))}

        {!meta.asset_thumbnail_uri && !meta.asset_url && creatives.assets.length === 0 && (
          <div className="mr-creatives-empty">
            No asset preview available. The audit was conducted on a provided asset.
          </div>
        )}
      </div>
    </div>
  );
}
