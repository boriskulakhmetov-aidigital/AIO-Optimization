import type { Mode, Theme } from '../types';

type Props = {
  brand: string;
  scanDateLabel: string;
  theme: Theme;
  onThemeToggle: () => void;
  mode: Mode;
  /** Optional right-side tag (e.g. "Public view"). */
  chip?: string;
};

/**
 * Slim top bar: breadcrumb · right-side actions.
 * The PDF button and public-mode chip are wired by the containing page —
 * Topbar itself just renders what the consumer passes in.
 */
export function Topbar({
  brand,
  scanDateLabel,
  theme,
  onThemeToggle,
  mode,
  chip,
}: Props) {
  return (
    <header className="report-topbar">
      <div className="rt-crumbs">
        <span className="rt-crumb">AIO Report</span>
        <span className="rt-crumb-sep">›</span>
        <span className="rt-crumb strong" data-crumb-brand>
          {brand}
        </span>
        <span className="rt-crumb-sep">·</span>
        <span className="rt-crumb muted">{scanDateLabel}</span>
      </div>

      <div className="rt-actions">
        {chip && <span className="rt-tag">{chip}</span>}

        {mode === 'interactive' && (
          <a className="rt-action" href="AIO Report - Print.html" target="_blank" rel="noopener">
            Export PDF
          </a>
        )}

        {mode !== 'print' && (
          <button
            type="button"
            className="rt-action"
            onClick={onThemeToggle}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
        )}
      </div>
    </header>
  );
}
