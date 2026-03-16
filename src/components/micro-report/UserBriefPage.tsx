import type { ReportData } from '../../lib/reportTypes';

interface Props { data: ReportData; }

function BriefRow({ label, value }: { label: string; value: string | boolean | undefined }) {
  const display = typeof value === 'boolean'
    ? (value ? 'Yes' : 'No')
    : (value || '—');
  return (
    <div className="mr-brief-row">
      <div className="mr-brief-row__label">{label}</div>
      <div className={`mr-brief-row__value${!value && value !== false ? ' mr-brief-row__value--empty' : ''}`}>{display}</div>
    </div>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mr-brief-section">
      <h3 className="mr-brief-section__title">{title}</h3>
      {children}
    </div>
  );
}

export function UserBriefPage({ data }: Props) {
  const b = data.user_brief;

  return (
    <div className="mr-page">
      <div className="mr-page__header">
        <h1 className="mr-page__title">User Brief & Inputs</h1>
        <p className="mr-page__subtitle">Full structured breakdown of all inputs provided at intake</p>
      </div>

      <div className="mr-brief-grid">
        <BriefSection title="Asset Identity">
          <BriefRow label="Brand / Product" value={b.brand_name} />
          <BriefRow label="Asset Type" value={b.asset_type} />
          <BriefRow label="Asset Tier" value={b.asset_tier} />
          <BriefRow label="Offer / Product Description" value={b.offer} />
        </BriefSection>

        <BriefSection title="Audience & Awareness">
          <BriefRow label="Target Audience" value={b.target_audience} />
          <BriefRow label="Awareness Stage" value={b.awareness_stage} />
          <BriefRow label="Traffic Source" value={b.traffic_source} />
          <BriefRow label="Device Context" value={b.device} />
          <BriefRow label="Reading Direction" value={b.reading_direction} />
        </BriefSection>

        <BriefSection title="Campaign Context">
          <BriefRow label="Campaign Context" value={b.campaign_context} />
          <BriefRow label="Multi-Campaign" value={b.multi_campaign_confirmed} />
          <BriefRow label="Markets" value={b.markets} />
          <BriefRow label="Competitors" value={b.competitors} />
        </BriefSection>

        <BriefSection title="Brand Identity">
          <BriefRow label="Brand Voice" value={b.brand_voice} />
          <BriefRow label="Primary Brand Hex" value={b.brand_hex_primary} />
          <BriefRow label="Secondary Brand Hex" value={b.brand_hex_secondary} />
          <BriefRow label="Accent Brand Hex" value={b.brand_hex_accent} />
        </BriefSection>

        {b.additional_context && (
          <BriefSection title="Additional Context">
            <div className="mr-brief-freetext">{b.additional_context}</div>
          </BriefSection>
        )}
      </div>
    </div>
  );
}
