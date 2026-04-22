type Props = {
  /**
   * Sentiment score. By default expects a -100..100 range.
   * Pass `scale="unit"` for -1..1 data (intent breakdown rows).
   */
  score: number;
  scale?: 'pct' | 'unit';
};

/**
 * Horizontal mini-scale: axis line with a dot positioned -100 (left) → 100 (right).
 * Dot color uses the same `k-*` ladder as the rest of the system.
 *
 * Mirrors `sentimentMeter(score, opts)` in render.js.
 */
export function SentimentMeter({ score, scale = 'pct' }: Props) {
  const v = scale === 'unit' ? score * 100 : score;
  const clamped = Math.max(-100, Math.min(100, v || 0));
  const left = 50 + clamped / 2;
  const klass =
    clamped >= 50 ? 'good' :
    clamped >= 20 ? 'mid'  :
    clamped >= 0  ? 'low'  : 'bad';

  return (
    <div
      className="aio-sentiment-meter"
      title={`Sentiment ${Math.round(clamped)}`}
    >
      <div className="aio-sentiment-track">
        <div className="aio-sentiment-axis" />
        <div
          className={`aio-sentiment-dot k-${klass}`}
          style={{ left: `${left}%` }}
        />
      </div>
    </div>
  );
}
