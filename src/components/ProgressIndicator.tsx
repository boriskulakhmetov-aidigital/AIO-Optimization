interface Props {
  brandName?: string;
  partial?: string | null;
}

const S1_TOTAL = 13; // 1.1 – 1.13
const S2_TOTAL = 17; // 2.1 – 2.17
const S3_TOTAL = 11; // 3.1 – 3.11
const GRAND_TOTAL = S1_TOTAL + S2_TOTAL + S3_TOTAL;

function maxCriterionIn(text: string, section: number, max: number): number {
  let highest = 0;
  const re = new RegExp(`\\b${section}\\.(\\d{1,2})\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= max) highest = Math.max(highest, n);
  }
  return highest;
}

// Find the earliest position matching any of the supplied patterns (-1 if none)
function firstMatch(text: string, patterns: RegExp[]): number {
  let earliest = -1;
  for (const p of patterns) {
    const idx = text.search(p);
    if (idx >= 0 && (earliest < 0 || idx < earliest)) earliest = idx;
  }
  return earliest;
}

function parseProgress(partial: string | null) {
  if (!partial) return { s1: 0, s2: 0, s3: 0, overall: 0 };

  // Multiple patterns to catch however Gemini formats section headings.
  // Criterion-first patterns (e.g. "## 1.1 —") are the most reliable fallback.
  const s1Start = firstMatch(partial, [
    /SECTION\s+1\b/i,
    /BEHAVIORAL\s+ANALYTICS/i,
    /\b1\.1\s*[-—–]/,
  ]);
  const s2Start = firstMatch(partial, [
    /SECTION\s+2\b/i,
    /CONGRUENCY\s*[&+]\s*USER\s+STRAIN/i,
    /\b2\.1\s*[-—–]/,
  ]);
  const s3Start = firstMatch(partial, [
    /SECTION\s+3\b/i,
    /COLOR\s*[&+]\s*COLOR\s+PSYCH/i,
    /\b3\.1\s*[-—–]/,
  ]);

  const s1Text = s1Start >= 0 ? partial.slice(s1Start, s2Start > 0 ? s2Start : undefined) : '';
  const s2Text = s2Start >= 0 ? partial.slice(s2Start, s3Start > 0 ? s3Start : undefined) : '';
  const s3Text = s3Start >= 0 ? partial.slice(s3Start) : '';

  const s1Done = maxCriterionIn(s1Text, 1, S1_TOTAL);
  const s2Done = maxCriterionIn(s2Text, 2, S2_TOTAL);
  const s3Done = maxCriterionIn(s3Text, 3, S3_TOTAL);

  return {
    s1: s1Done / S1_TOTAL,
    s2: s2Done / S2_TOTAL,
    s3: s3Done / S3_TOTAL,
    overall: (s1Done + s2Done + s3Done) / GRAND_TOTAL,
  };
}

// ── SVG Ring ──────────────────────────────────────────────────────────────

interface RingProps {
  value: number;       // 0–1
  label: string;
  sublabel?: string;
  size: 'lg' | 'sm';
}

function Ring({ value, label, sublabel, size }: RingProps) {
  const r = size === 'lg' ? 46 : 38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 1));
  const pct = Math.round(value * 100);

  return (
    <div className={`ring ring--${size}`}>
      <svg viewBox="0 0 100 100" className="ring__svg">
        {/* track */}
        <circle cx="50" cy="50" r={r} className="ring__track" />
        {/* fill */}
        <circle
          cx="50" cy="50" r={r}
          className="ring__fill"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ring__center">
        <span className="ring__pct">{pct}<span className="ring__unit">%</span></span>
        {sublabel && <span className="ring__sub">{sublabel}</span>}
      </div>
      <span className="ring__label">{label}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function ProgressIndicator({ brandName, partial }: Props) {
  const prog = parseProgress(partial ?? null);
  const hasStarted = partial != null;

  return (
    <div className="progress">
      <div className="progress__header">
        <div className="progress__spinner" />
        <div className="progress__title-group">
          <h2 className="progress__title">
            {hasStarted ? 'Generating Report…' : 'Running Audit'}
          </h2>
          <p className="progress__sub">
            Evaluating {brandName ? <strong>{brandName}</strong> : 'your asset'} across 41 criteria.
          </p>
        </div>
      </div>

      <div className="progress__rings">
        <Ring
          value={prog.overall}
          label="Overall Progress"
          sublabel={`${Math.round(prog.overall * GRAND_TOTAL)} / ${GRAND_TOTAL} criteria`}
          size="lg"
        />

        <div className="progress__section-rings">
          <Ring value={prog.s1} label="Behavioral Analytics" size="sm" />
          <Ring value={prog.s2} label="Congruency & User Strain" size="sm" />
          <Ring value={prog.s3} label="Color Psychology" size="sm" />
        </div>
      </div>
    </div>
  );
}
