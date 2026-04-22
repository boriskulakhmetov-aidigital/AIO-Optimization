import type { IntentBreakdownRow, IntentType } from '../types';
import { klassMention } from '../data';
import { SovBar } from './SovBar';
import { SentimentMeter } from './SentimentMeter';

type Props = {
  row: IntentBreakdownRow;
  intentLabel: string;
  /** Large variant matches V3's full breakdown; compact matches V1 dense rows. */
  size?: 'lg' | 'md';
};

/**
 * One row in the intent breakdown table: dot · name · meta · bar · %, sentiment.
 *
 * Mirrors the `.aio-intent-row` markup used inside V3's full intent breakdown.
 */
export function IntentRow({ row, intentLabel, size = 'lg' }: Props) {
  const klass = klassMention(row.mention_rate);
  return (
    <div className={`aio-intent-row intent-row--${size}`}>
      <div className="aio-intent-label">
        <span className={`aio-intent-dot k-${klass}`} />
        <span className="aio-intent-name">{intentLabel}</span>
        <span className="aio-intent-desc">
          {row.query_count} {row.query_count === 1 ? 'query' : 'queries'}
          {row.avg_rank ? ` · avg rank #${row.avg_rank}` : ''}
        </span>
      </div>
      <div className="aio-intent-bar">
        <SovBar pct={row.mention_rate} klass={klass} />
      </div>
      <div className="aio-intent-nums">
        <b>{Math.round(row.mention_rate)}%</b>
        <SentimentMeter score={row.avg_sentiment} scale="unit" />
      </div>
    </div>
  );
}

/** Convenience for callers that only have the intent key string. */
export function intentKeyToLabel(key: IntentType, map: Record<IntentType, string>): string {
  return map[key] || key;
}
