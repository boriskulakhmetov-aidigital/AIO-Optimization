import { useCallback, useEffect, useRef, useState } from 'react';

type Saved = {
  rating?: number;
  note?: string;
  submittedAt?: number;
};

type Props = {
  /** Stable per-page key used for localStorage persistence. */
  pageKey: string;
  /** Eyebrow label shown at top-left. */
  pageLabel: string;
};

const storageKey = (pageKey: string) => `aio-review:${pageKey}`;

function loadSaved(pageKey: string): Saved {
  try {
    return JSON.parse(localStorage.getItem(storageKey(pageKey)) || 'null') || {};
  } catch {
    return {};
  }
}

function saveSaved(pageKey: string, value: Saved) {
  try {
    localStorage.setItem(storageKey(pageKey), JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

/**
 * Per-page feedback strip: 5-star rating + optional one-line note + submit.
 * Persists to localStorage under `aio-review:<pageKey>`.
 *
 * Suppressed automatically when `window.AIO_MODE !== 'interactive'` — render
 * the widget inside the variant view and the mode check is the caller's job.
 *
 * Mirrors `reviewWidget()` + `wireReviewWidgets()` in render.js.
 */
export function FeedbackWidget({ pageKey, pageLabel }: Props) {
  const initial = useRef(loadSaved(pageKey)).current;
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [note, setNote] = useState(initial.note ?? '');
  const [submitted, setSubmitted] = useState(!!initial.submittedAt);

  // If pageKey changes, reload state (e.g. engine changes on V3)
  useEffect(() => {
    const s = loadSaved(pageKey);
    setRating(s.rating ?? 0);
    setNote(s.note ?? '');
    setSubmitted(!!s.submittedAt);
  }, [pageKey]);

  const onStar = useCallback(
    (n: number) => {
      setRating(n);
      saveSaved(pageKey, { ...loadSaved(pageKey), rating: n });
    },
    [pageKey]
  );

  const onNoteChange = useCallback(
    (v: string) => {
      setNote(v);
      saveSaved(pageKey, { ...loadSaved(pageKey), note: v });
    },
    [pageKey]
  );

  const onSubmit = useCallback(() => {
    saveSaved(pageKey, {
      ...loadSaved(pageKey),
      note,
      submittedAt: Date.now(),
    });
    setSubmitted(true);
  }, [note, pageKey]);

  return (
    <aside
      className={`rv ${submitted ? 'submitted' : ''}`}
      data-rv-page={pageKey}
    >
      <div className="rv-left">
        <div className="rv-eyebrow">Feedback · {pageLabel}</div>
        <div className="rv-prompt">
          {submitted ? 'Thanks — noted.' : 'Was this view useful?'}
        </div>
      </div>
      <div className="rv-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`rv-star ${rating >= n ? 'filled' : ''}`}
            data-rv-star={n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onStar(n)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 2.5l2.94 6.32 6.56.86-4.85 4.55 1.27 6.77L12 17.85l-5.92 3.15 1.27-6.77L2.5 9.68l6.56-.86z"
                fill={rating >= n ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      <div className="rv-input-row">
        <input
          type="text"
          className="rv-input"
          placeholder={
            submitted
              ? 'Edit your note…'
              : 'Optional: one line on what to change…'
          }
          value={note}
          maxLength={240}
          onChange={(e) => onNoteChange(e.target.value)}
        />
        <button
          type="button"
          className="rv-submit"
          disabled={rating === 0}
          onClick={onSubmit}
        >
          {submitted ? 'Update' : 'Send'}
        </button>
      </div>
    </aside>
  );
}
