import type { EngineRow } from '../types';
import { EngineMark } from './EngineMark';

type Size = 'sm' | 'md';

type Props = {
  engine: EngineRow;
  size?: Size;
};

/**
 * Engine identity lockup — mark + short name (+ brand on md).
 * Used inline in rows, tabs, matrix headers, and quote cards.
 *
 * Matches the vanilla `engineChip(e, size)` helper exactly.
 */
export function EngineChip({ engine, size = 'sm' }: Props) {
  return (
    <span className={`aio-engine-chip size-${size}`} title={engine.name}>
      <EngineMark engine={engine} size={size} />
      <span className="aio-engine-chip-text">
        <span className="aio-engine-name">{engine.short}</span>
        {size === 'md' && (
          <span className="aio-engine-sub">{engine.brand}</span>
        )}
      </span>
    </span>
  );
}
