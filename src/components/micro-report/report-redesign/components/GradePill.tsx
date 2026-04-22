import type { Grade, KlassStatus } from '../types';

type Props = {
  grade: Grade | null | undefined;
  klass: KlassStatus;
};

/**
 * Letter-grade chip (A+/B/C…). Color is driven by `klass`, not the grade itself,
 * so the same palette ladder stays consistent with SOV / sentiment / mention bars.
 *
 * @example
 *   <GradePill grade={engine.grade} klass={engine.gradeKlass} />
 */
export function GradePill({ grade, klass }: Props) {
  return (
    <span className={`aio-grade-pill grade-${klass}`}>{grade || '—'}</span>
  );
}
