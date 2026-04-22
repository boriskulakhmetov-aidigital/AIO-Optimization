import {
  EngineMark as DSEngineMark,
  type EngineSlug,
} from '@AiDigital-com/design-system';
import type { EngineIdentity } from '../types';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  engine: Pick<EngineIdentity, 'hue' | 'glyph' | 'short' | 'slug'>;
  size?: Size;
  title?: string;
};

/**
 * Thin adapter over DS `EngineMark`. Uses the engine's `slug` to pull the
 * real SVG brand mark; falls back to the hue-tinted disc + glyph if the
 * slug isn't known to DS (shouldn't happen — ENGINE_META maps every
 * supported scan engine to a DS slug).
 */
export function EngineMark({ engine, size = 'sm', title }: Props) {
  return (
    <DSEngineMark
      engine={(engine.slug || 'openai') as EngineSlug}
      size={size}
      hue={engine.hue}
      title={title ?? engine.short}
    />
  );
}
