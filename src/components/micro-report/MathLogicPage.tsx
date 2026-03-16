import type { ReportData } from '../../lib/reportTypes';

interface Props { data: ReportData; }

function Block({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <div className="mr-math-block">
      <h3 className="mr-math-block__title">{title}</h3>
      <pre className="mr-math-block__content">{content}</pre>
    </div>
  );
}

export function MathLogicPage({ data }: Props) {
  const m = data.math_and_logic;
  return (
    <div className="mr-page">
      <div className="mr-page__header">
        <h1 className="mr-page__title">Math & Logic Dashboard</h1>
        <p className="mr-page__subtitle">Anti-drift protocol outputs and all arithmetic</p>
      </div>

      <Block title="Score Anchoring (Protocol 8)" content={m.score_anchoring} />
      <Block title="Hard Floor Pre-Scan (Protocol 11)" content={m.hard_floor_prescan} />
      <Block title="Multi-Campaign Cascade (Protocol 12)" content={m.multi_campaign_cascade} />
      <Block title="Master Scoring Summary" content={m.master_scoring_table} />
      <Block title="Consistency Verification (Protocol 6)" content={m.consistency_verification} />
      <Block title="Arithmetic Verification (Protocol 9)" content={m.arithmetic_verification} />
    </div>
  );
}
