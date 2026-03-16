/**
 * AIDigital Labs — 4-Quadrant Brand Mark
 * ========================================
 * 2×2 grid: Blue (arrow) / Green (dot) / Pink (spark) / Light-Blue (square)
 * Works on both dark and light backgrounds.
 * Colors from tokens.ts — edit there to rebrand.
 */

import { BRAND_COLORS } from './tokens';

interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 22, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Top-left: Electric Blue — right-pointing arrow (forward motion) */}
      <rect x="0" y="0" width="10" height="10" rx="2" fill={BRAND_COLORS.blue} />
      <polygon points="3.5,3.5 3.5,6.5 7,5" fill="white" />

      {/* Top-right: Neon Green — filled circle (complete, confirmed) */}
      <rect x="12" y="0" width="10" height="10" rx="2" fill={BRAND_COLORS.green} />
      <circle cx="17" cy="5" r="2.4" fill={BRAND_COLORS.black} />

      {/* Bottom-left: Vibrant Pink — X mark (insight, analysis) */}
      <rect x="0" y="12" width="10" height="10" rx="2" fill={BRAND_COLORS.pink} />
      <line x1="3.2" y1="15.2" x2="6.8" y2="18.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6.8" y1="15.2" x2="3.2" y2="18.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />

      {/* Bottom-right: Light blue — blue square (data, precision)
          Using #e0e8ff so it's visible on both white and black backgrounds */}
      <rect x="12" y="12" width="10" height="10" rx="2" fill="#e0e8ff" />
      <rect x="15.5" y="15.5" width="3" height="3" rx="0.5" fill={BRAND_COLORS.blue} />
    </svg>
  );
}
