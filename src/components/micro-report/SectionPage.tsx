import { useState } from 'react';
import type { ReportSection, CriterionBlock, SeverityLevel } from '../../lib/reportTypes';

interface Props { section: ReportSection; }

function severityClass(s: SeverityLevel | null) {
  if (!s) return '';
  return s === 'CRITICAL' ? 'sev--critical' : s === 'SIGNIFICANT' ? 'sev--significant' : s === 'MODERATE' ? 'sev--moderate' : 'sev--improvement';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'score--na';
  if (score <= 3) return 'score--critical';
  if (score <= 5) return 'score--significant';
  if (score <= 7) return 'score--moderate';
  return 'score--good';
}

function CriterionRow({ criterion, isOpen, onToggle }: {
  criterion: CriterionBlock;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`mr-criterion${isOpen ? ' mr-criterion--open' : ''}`}>
      <button className="mr-criterion__header" onClick={onToggle}>
        <span className="mr-criterion__id">{criterion.id}</span>
        <span className="mr-criterion__name">{criterion.name}</span>
        <div className="mr-criterion__badges">
          {criterion.hard_floor_triggered && <span className="mr-badge mr-badge--floor">FLOOR</span>}
          <span className={`mr-badge mr-badge--type`}>{criterion.type}</span>
          {criterion.cultural_deduction_code !== 'C0' && (
            <span className="mr-badge mr-badge--cultural">{criterion.cultural_deduction_code}</span>
          )}
          {criterion.severity && (
            <span className={`mr-sev-badge ${severityClass(criterion.severity)}`}>{criterion.severity}</span>
          )}
        </div>
        <span className={`mr-criterion__score ${scoreColor(criterion.score)}`}>
          {criterion.is_na ? 'N/A' : `${criterion.score}/10`}
        </span>
        <span className="mr-criterion__chevron">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mr-criterion__body">
          {criterion.observation && (
            <div className="mr-criterion__block">
              <div className="mr-criterion__block-label">Observation</div>
              <div className="mr-criterion__block-text">{criterion.observation}</div>
            </div>
          )}
          {criterion.rubric_grounding && (
            <div className="mr-criterion__block">
              <div className="mr-criterion__block-label">Rubric Grounding</div>
              <div className="mr-criterion__block-text">{criterion.rubric_grounding}</div>
            </div>
          )}
          {criterion.cultural_deduction_evidence && (
            <div className="mr-criterion__block">
              <div className="mr-criterion__block-label">Cultural Deduction ({criterion.cultural_deduction_code})</div>
              <div className="mr-criterion__block-text">{criterion.cultural_deduction_evidence}</div>
            </div>
          )}
          {criterion.improvement_path && (
            <div className={`mr-criterion__block mr-criterion__block--action ${severityClass(criterion.severity)}`}>
              <div className="mr-criterion__block-label">Improvement Path</div>
              <div className="mr-criterion__block-text">{criterion.improvement_path}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SectionPage({ section }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  const scored = section.criteria.filter(c => !c.is_na);
  const na = section.criteria.filter(c => c.is_na);

  return (
    <div className="mr-page">
      <div className="mr-page__header">
        <h1 className="mr-page__title">Section {section.id} — {section.name}</h1>
        <div className="mr-page__meta">
          <span className="mr-overall-score">{section.section_average.toFixed(1)}<span className="mr-overall-score__denom">/10</span></span>
          <div className="mr-page__meta-details">
            <span>{scored.length} scored</span>
            {na.length > 0 && <span>{na.length} N/A</span>}
          </div>
        </div>
      </div>

      {section.summary && (
        <div className="mr-section-summary">{section.summary}</div>
      )}

      {section.prioritized_actions.length > 0 && (
        <div className="mr-section-actions">
          <div className="mr-section-divider"><span>Prioritized Actions</span></div>
          <div className="mr-actions-compact">
            {section.prioritized_actions.map(a => (
              <div key={a.criterion_id} className={`mr-action-compact ${severityClass(a.severity)}`}>
                <span className="mr-action-compact__id">{a.criterion_id}</span>
                <span className={`mr-sev-badge ${severityClass(a.severity)}`}>{a.severity}</span>
                {a.score !== null && <span className="mr-action-compact__score">{a.score}/10</span>}
                <span className="mr-action-compact__text">{a.action_text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mr-section-divider"><span>Criteria Detail ({section.criteria.length})</span></div>

      <div className="mr-criteria-list">
        {section.criteria.map(c => (
          <CriterionRow
            key={c.id}
            criterion={c}
            isOpen={openId === c.id}
            onToggle={() => toggle(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
