import type { ReactNode } from 'react';
import type { KlassStatus } from '../types';
import { SovBar } from './SovBar';

type Props = {
  /** Numeric value shown in the big numeral (e.g. 72). */
  value: number;
  /** Label line (e.g. "AI Share of Voice"). */
  label: string;
  /** Dek beneath the label (e.g. "Positive − negative"). */
  sub?: string;
  klass: KlassStatus;
  /** Fill percentage for the bottom bar (0..100). Defaults to `value`. */
  barPct?: number;
  /**
   * Format for the big numeral. '%' appends a percent sign, 'raw' takes a
   * pre-rendered string (used for RSI "0.7/1.0" and ranks "#3").
   */
  format?: '%' | 'raw';
  /** When `format === 'raw'`, the node/string to render for the numeric. */
  rawDisplay?: ReactNode;
};

/**
 * Engine deep-dive KPI tile (value + label + sub + fill bar).
 * Used in V3's KPI grid; one flat tile per metric.
 *
 * Mirrors the `.aio-kpi-tile` structure in render.js.
 */
export function KpiTile({
  value,
  label,
  sub,
  klass,
  barPct,
  format = '%',
  rawDisplay,
}: Props) {
  return (
    <div className={`aio-kpi-tile k-${klass}`}>
      <div className="aio-kpi-tile-v">
        {format === 'raw' ? (
          rawDisplay
        ) : (
          <>
            {Math.round(value)}
            <span>%</span>
          </>
        )}
      </div>
      <div className="aio-kpi-tile-l">{label}</div>
      {sub && <div className="aio-kpi-tile-sub">{sub}</div>}
      <div className="aio-kpi-tile-bar">
        <SovBar pct={barPct ?? value} klass={klass} />
      </div>
    </div>
  );
}
