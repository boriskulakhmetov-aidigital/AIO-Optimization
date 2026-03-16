import type { ReportData } from '../../lib/reportTypes';
import { BrandMark } from '../../design-system/BrandMark';

type PageId = 'exec' | 'section-1' | 'section-2' | 'section-3' | 'math' | 'creatives' | 'brief';

interface Props {
  data: ReportData;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isPublic?: boolean;
}

function ScorePill({ score }: { score: number }) {
  const cls = score >= 7 ? 'pill--good' : score >= 5 ? 'pill--mid' : 'pill--bad';
  return <span className={`mr-score-pill ${cls}`}>{score.toFixed(1)}</span>;
}

export function ReportSidebar({ data, activePage, onNavigate, isPublic }: Props) {
  const { meta, sections } = data;

  const navItems: { id: PageId; label: string; sub?: string }[] = [
    { id: 'exec', label: 'Executive Summary', sub: `Score: ${meta.overall_score.toFixed(1)}` },
    { id: 'section-1', label: sections[0].name, sub: `Avg: ${sections[0].section_average.toFixed(1)}` },
    { id: 'section-2', label: sections[1].name, sub: `Avg: ${sections[1].section_average.toFixed(1)}` },
    { id: 'section-3', label: sections[2].name, sub: `Avg: ${sections[2].section_average.toFixed(1)}` },
    { id: 'math', label: 'Math & Logic' },
    { id: 'creatives', label: 'Creatives' },
    { id: 'brief', label: 'User Brief' },
  ];

  return (
    <nav className="mr-sidebar">
      <div className="mr-sidebar__brand">
        <BrandMark size={18} />
        <span className="mr-sidebar__brand-text">Neuromarketing Audit</span>
      </div>

      <div className="mr-sidebar__report-title">
        <div className="mr-sidebar__brand-name">{meta.brand_name}</div>
        <div className="mr-sidebar__asset-type">{meta.asset_type_label}</div>
        <div className="mr-sidebar__score-row">
          <ScorePill score={meta.overall_score} />
          <span className="mr-sidebar__score-label">Overall</span>
        </div>
      </div>

      <div className="mr-sidebar__nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`mr-sidebar__nav-item${activePage === item.id ? ' mr-sidebar__nav-item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="mr-sidebar__nav-label">{item.label}</span>
            {item.sub && <span className="mr-sidebar__nav-sub">{item.sub}</span>}
          </button>
        ))}
      </div>

      <div className="mr-sidebar__footer">
        <span>{meta.audit_date}</span>
        <span>Rubric v{meta.rubric_version}</span>
      </div>
    </nav>
  );
}
