import { useState } from 'react';

interface Props {
  brandName: string;
  onSubmit: (email: string) => Promise<void>;
}

export function MobileEmailGate({ brandName, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(email.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="m-email-gate">
      <div className="m-email-gate__hero">
        <h2 className="m-email-gate__title">Your full report is ready</h2>
        <p className="m-email-gate__subtitle">
          The complete AI Search Optimization report for <strong>{brandName}</strong> includes
          engine-by-engine analysis, competitive intelligence, sentiment breakdown,
          and prioritized action items.
        </p>
      </div>

      <form className="m-email-gate__form" onSubmit={handleSubmit}>
        <div className="m-field">
          <label className="m-field__label" htmlFor="email">Your work email</label>
          <input
            id="email"
            className="m-field__input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="m-btn m-btn--primary m-btn--full"
          disabled={!email.trim() || submitting}
        >
          {submitting ? 'Loading…' : 'View Full Report'}
        </button>
      </form>

      <p className="m-email-gate__privacy">
        We'll only use your email to send you the report. No spam.
      </p>
    </div>
  );
}
