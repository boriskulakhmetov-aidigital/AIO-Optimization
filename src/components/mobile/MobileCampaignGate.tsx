interface Props {
  reason: 'limit_reached' | 'campaign_ended' | 'campaign_inactive' | 'campaign_not_found' | 'not_started' | 'no_campaign';
  endedMessage?: string | null;
  onEmailSubmit?: (email: string) => void;
}

const REASON_COPY: Record<string, { title: string; subtitle: string }> = {
  limit_reached:      { title: 'All scans claimed',        subtitle: 'This campaign has reached its limit. Leave your email and we\'ll reach out when the next one launches.' },
  campaign_ended:     { title: 'This campaign has ended',  subtitle: 'Thanks for your interest. Leave your email and we\'ll keep you in the loop.' },
  campaign_inactive:  { title: 'Campaign paused',          subtitle: 'This campaign is temporarily paused. Leave your email and we\'ll notify you when it resumes.' },
  campaign_not_found: { title: 'Link not recognised',      subtitle: 'This campaign link is no longer active. Reach out to your AI Digital Labs contact for a new link.' },
  not_started:        { title: 'Coming soon',              subtitle: 'This campaign hasn\'t started yet. Leave your email and we\'ll notify you when it goes live.' },
  no_campaign:        { title: 'Invite only',              subtitle: 'This tool is only available through a campaign link. Contact your AI Digital Labs representative for access.' },
};

export function MobileCampaignGate({ reason, endedMessage, onEmailSubmit }: Props) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.campaign_ended;
  const subtitle = endedMessage || copy.subtitle;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim();
    if (email && onEmailSubmit) onEmailSubmit(email);
  }

  return (
    <div className="mcg">
      <div className="mcg__icon">
        <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
          <circle cx="24" cy="24" r="22" stroke="var(--border)" strokeWidth="2"/>
          <path d="M24 14v12" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="24" cy="33" r="1.5" fill="var(--text-muted)"/>
        </svg>
      </div>

      <h2 className="mcg__title">{copy.title}</h2>
      <p className="mcg__subtitle">{subtitle}</p>

      {onEmailSubmit && reason !== 'campaign_not_found' && reason !== 'no_campaign' && (
        <form className="mcg__form" onSubmit={handleSubmit}>
          <div className="m-field">
            <input
              className="m-field__input"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className="m-btn m-btn--primary m-btn--full">
            Notify Me
          </button>
          <p className="mcg__privacy">No spam. Unsubscribe anytime.</p>
        </form>
      )}

      <a className="mcg__link" href="https://aidigitallabs.com" target="_blank" rel="noopener noreferrer">
        Learn about AI Digital Labs &rarr;
      </a>
    </div>
  );
}
