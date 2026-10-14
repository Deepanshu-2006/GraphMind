import React from 'react';
import type { GraphMasteryOverview, ConceptMasterySummary } from '../../types/mastery';

// Preserve React in scope for tsx runner environments
void React;

export interface RevisionConceptOverviewProps {
  overview: GraphMasteryOverview;
  conceptList: Array<{ id: string; name: string }>;
  currentConceptId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelectConcept: (conceptId: string, index: number) => void;
}

export const RevisionConceptOverview: React.FC<RevisionConceptOverviewProps> = ({
  overview,
  conceptList,
  currentConceptId,
  isOpen,
  onToggle,
  onSelectConcept
}) => {
  const { needsReviewCount, understandingDemonstratedCount, inProgressCount, totalConcepts } = overview;

  return (
    <div className="revision-overview-drawer" role="region" aria-label="Concept revision overview">
      <div className="revision-overview-toggle-bar">
        <button
          type="button"
          className="revision-overview-toggle-btn"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="revision-overview-content"
        >
          <div className="revision-overview-toggle-left">
            <span className="revision-overview-toggle-kicker">CONCEPTS OVERVIEW</span>
            <span className="revision-overview-toggle-stats">
              {`${understandingDemonstratedCount} / ${totalConcepts} demonstrated`}
              {needsReviewCount > 0 && (
                <span className="revision-overview-badge-review">
                  {` • ${needsReviewCount} need review`}
                </span>
              )}
            </span>
          </div>
          <span className="revision-overview-toggle-arrow" aria-hidden="true">
            {isOpen ? '▲ Collapse' : '▼ View concepts'}
          </span>
        </button>
      </div>

      {isOpen && (
        <div id="revision-overview-content" className="revision-overview-content">
          <div className="revision-overview-summary-strip">
            <div className="revision-overview-stat-item">
              <span className="revision-overview-stat-label">DEMONSTRATED</span>
              <span className="revision-overview-stat-val demonstrated">{understandingDemonstratedCount}</span>
            </div>
            <div className="revision-overview-stat-item">
              <span className="revision-overview-stat-label">NEEDS REVIEW</span>
              <span className="revision-overview-stat-val needs-review">{needsReviewCount}</span>
            </div>
            <div className="revision-overview-stat-item">
              <span className="revision-overview-stat-label">IN PROGRESS</span>
              <span className="revision-overview-stat-val in-progress">{inProgressCount}</span>
            </div>
          </div>

          <div className="revision-overview-list" role="list">
            {conceptList.map((item, idx) => {
              const summary: ConceptMasterySummary | undefined = overview.concepts[item.id];
              const status = summary?.status || 'not-started';
              const label = summary?.statusLabel || 'Not started';
              const isCurrent = item.id === currentConceptId;

              const getPillClass = () => {
                switch (status) {
                  case 'needs-review':
                    return 'needs-review';
                  case 'understanding-demonstrated':
                    return 'demonstrated';
                  case 'in-progress':
                    return 'in-progress';
                  case 'not-started':
                  default:
                    return 'not-started';
                }
              };

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`revision-overview-row ${isCurrent ? 'active' : ''}`}
                  onClick={() => onSelectConcept(item.id, idx)}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="revision-overview-index">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="revision-overview-name">
                    {item.name}
                    {isCurrent && <span className="revision-overview-current-tag">Current</span>}
                  </span>
                  <span className={`revision-overview-status-pill ${getPillClass()}`}>
                    <span className="revision-overview-status-dot" aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
