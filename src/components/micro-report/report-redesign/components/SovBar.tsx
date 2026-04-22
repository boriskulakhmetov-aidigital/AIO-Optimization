import type { KlassStatus } from '../types';

type Props = {
  /** Percent value, 0–100. Values outside the range are clamped. */
  pct: number;
  /** Palette ladder: good / good-mid / mid / low / bad / na. */
  klass?: KlassStatus;
};

/**
 * Horizontal fill bar used for SOV, mention rate, KPI tiles, intent rows…
 * Fill width is clamped to 2–100% so empty states still read as a sliver.
 *
 * Mirrors `sovBar(pct, klass)` in render.js.
 */
export function SovBar({ pct, klass = 'mid' }: Props) {
  const width = Math.max(2, Math.min(100, pct || 0));
  return (
    <div className="aio-sov-bar">
      <div
        className={`aio-sov-bar-fill k-${klass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
