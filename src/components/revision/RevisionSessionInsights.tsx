import React from 'react';
import type {
  RevisionSessionInsights as RevisionSessionInsightsType,
  SessionNextAction
} from '../../types/sessionInsights';

// Preserve React in scope for tsx runner environments
void React;

export interface RevisionSessionInsightsProps {
  insights: RevisionSessionInsightsType;
  onSelectConcept: (conceptId: string, index: number) => void;
  onResumeRevision?: () => void;
  onReturnToGraph: () => void;
  onFinishSession?: () => void;
}

export const RevisionSessionInsights: React.FC<RevisionSessionInsightsProps> = ({
  insights,
  onSelectConcept,
  onResumeRevision,
  onReturnToGraph,
  onFinishSession
}) => {
  const {
    graphName,
    isCompleted,
    totalSessionConcepts,
    visitedCount,
    demonstratedCount,
    needsReviewCount,
    assessedCount,
    reviewedConcepts,
    demonstratedConcepts,
    revisitConcepts,
    nextActions,
    notes
  } = insights;

  const handleActionClick = (action: SessionNextAction) => {
    switch (action.type) {
      case 'review-difficult':
        if (action.conceptId && action.conceptIndex !== undefined) {
          onSelectConcept(action.conceptId, action.conceptIndex);
        }
        break;
      case 'continue-sequence':
        if (action.conceptId && action.conceptIndex !== undefined) {
          onSelectConcept(action.conceptId, action.conceptIndex);
        }
        break;
      case 'return-graph':
        onReturnToGraph();
        break;
      case 'finish-session':
        if (onFinishSession) {
          onFinishSession();
        } else {
          onReturnToGraph();
        }
        break;
      case 'resume-current':
        if (onResumeRevision) {
          onResumeRevision();
        }
        break;
    }
  };

  return (
    <div className="revision-insights-container" role="region" aria-label="Revision session insights">
      {/* Editorial Header */}
      <header className="revision-insights-header">
        <div className="revision-insights-header-top">
          <div className="revision-insights-eyebrow">
            <span className="revision-insights-dot" aria-hidden="true" />
            <span>• REVISION / SESSION INSIGHTS</span>
          </div>
          {onResumeRevision && !isCompleted && (
            <button
              type="button"
              className="revision-insights-resume-btn"
              onClick={onResumeRevision}
              aria-label="Resume current revision session"
            >
              <span>Resume revision</span>
              <span className="revision-insights-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </div>

        <h1 className="revision-insights-title">
          {isCompleted ? 'Revision Session Complete.' : 'Revision Session Summary.'}
        </h1>
        <p className="revision-insights-subtitle">
          {`A factual record of concepts studied and evidence gathered in ${graphName}.`}
        </p>
      </header>

      {/* Metrics Row (Transparent, Non-Gamified) */}
      <section className="revision-insights-metrics-grid" aria-label="Session metrics">
        <div className="revision-insights-metric-card">
          <span className="revision-insights-metric-label">CONCEPTS VISITED</span>
          <div className="revision-insights-metric-val">
            <span className="val-main">{visitedCount}</span>
            <span className="val-total">{` / ${totalSessionConcepts}`}</span>
          </div>
          <span className="revision-insights-metric-sub">
            {isCompleted ? 'All concepts visited' : `${totalSessionConcepts - visitedCount} unvisited`}
          </span>
        </div>

        <div className="revision-insights-metric-card">
          <span className="revision-insights-metric-label">DEMONSTRATED</span>
          <div className="revision-insights-metric-val demonstrated">
            <span className="val-main">{demonstratedCount}</span>
          </div>
          <span className="revision-insights-metric-sub">Verified formative evidence</span>
        </div>

        <div className="revision-insights-metric-card">
          <span className="revision-insights-metric-label">NEEDS REVIEW</span>
          <div className={`revision-insights-metric-val ${needsReviewCount > 0 ? 'needs-review' : ''}`}>
            <span className="val-main">{needsReviewCount}</span>
          </div>
          <span className="revision-insights-metric-sub">
            {needsReviewCount === 0 ? 'No difficulty recorded' : 'Requires attention'}
          </span>
        </div>

        <div className="revision-insights-metric-card">
          <span className="revision-insights-metric-label">FORMALLY ASSESSED</span>
          <div className="revision-insights-metric-val">
            <span className="val-main">{assessedCount}</span>
          </div>
          <span className="revision-insights-metric-sub">Questions answered</span>
        </div>
      </section>

      {/* Honest Notes / Limitations Callout */}
      {notes && notes.length > 0 && (
        <aside className="revision-insights-notes" aria-label="Session notes">
          <span className="revision-insights-notes-kicker">OBSERVATION NOTE</span>
          <ul className="revision-insights-notes-list">
            {notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </aside>
      )}

      {/* Section A: Concepts to Revisit */}
      <section className="revision-insights-section" aria-labelledby="heading-revisit">
        <div className="revision-insights-section-header">
          <h2 id="heading-revisit" className="revision-insights-section-title">
            Concepts to Revisit
          </h2>
          <span className="revision-insights-section-count">
            {`${revisitConcepts.length} concept${revisitConcepts.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {revisitConcepts.length === 0 ? (
          <div className="revision-insights-empty-panel">
            <p>No concepts demonstrated difficulty or were flagged for review in this session.</p>
          </div>
        ) : (
          <div className="revision-insights-list" role="list">
            {revisitConcepts.map((item) => (
              <div key={item.conceptId} className="revision-insights-row needs-review" role="listitem">
                <div className="revision-insights-row-left">
                  <span className="revision-insights-row-index">
                    {String(item.conceptIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="revision-insights-row-info">
                    <span className="revision-insights-row-title">{item.conceptName}</span>
                    <span className="revision-insights-row-evidence">{item.evidenceNote}</span>
                  </div>
                </div>
                <div className="revision-insights-row-right">
                  <span className="revision-overview-status-pill needs-review">
                    <span className="revision-overview-status-dot" aria-hidden="true" />
                    <span>{item.masteryLabel}</span>
                  </span>
                  <button
                    type="button"
                    className="revision-insights-action-btn"
                    onClick={() => onSelectConcept(item.conceptId, item.conceptIndex)}
                    aria-label={`Review ${item.conceptName}`}
                  >
                    <span>Review</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section B: Understanding Demonstrated */}
      <section className="revision-insights-section" aria-labelledby="heading-demonstrated">
        <div className="revision-insights-section-header">
          <h2 id="heading-demonstrated" className="revision-insights-section-title">
            Understanding Demonstrated
          </h2>
          <span className="revision-insights-section-count">
            {`${demonstratedConcepts.length} concept${demonstratedConcepts.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {demonstratedConcepts.length === 0 ? (
          <div className="revision-insights-empty-panel">
            <p>
              {visitedCount > 0
                ? 'No concepts met the verified mastery criteria yet. Answer formative questions to demonstrate understanding.'
                : 'No concepts have been visited in this session.'}
            </p>
          </div>
        ) : (
          <div className="revision-insights-list" role="list">
            {demonstratedConcepts.map((item) => (
              <div key={item.conceptId} className="revision-insights-row demonstrated" role="listitem">
                <div className="revision-insights-row-left">
                  <span className="revision-insights-row-index">
                    {String(item.conceptIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="revision-insights-row-info">
                    <span className="revision-insights-row-title">{item.conceptName}</span>
                    <span className="revision-insights-row-evidence">{item.evidenceNote}</span>
                  </div>
                </div>
                <div className="revision-insights-row-right">
                  <span className="revision-overview-status-pill demonstrated">
                    <span className="revision-overview-status-dot" aria-hidden="true" />
                    <span>{item.masteryLabel}</span>
                  </span>
                  <button
                    type="button"
                    className="revision-insights-action-btn secondary"
                    onClick={() => onSelectConcept(item.conceptId, item.conceptIndex)}
                    aria-label={`Inspect ${item.conceptName}`}
                  >
                    <span>Inspect</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section C: Complete Session Log */}
      <section className="revision-insights-section" aria-labelledby="heading-reviewed">
        <div className="revision-insights-section-header">
          <h2 id="heading-reviewed" className="revision-insights-section-title">
            All Concepts Visited
          </h2>
          <span className="revision-insights-section-count">
            {`${reviewedConcepts.length} of ${totalSessionConcepts}`}
          </span>
        </div>

        {reviewedConcepts.length === 0 ? (
          <div className="revision-insights-empty-panel">
            <p>No concepts were opened or studied during this session.</p>
          </div>
        ) : (
          <div className="revision-insights-list" role="list">
            {reviewedConcepts.map((item) => {
              const pillClass =
                item.masteryStatus === 'understanding-demonstrated'
                  ? 'demonstrated'
                  : item.masteryStatus === 'needs-review'
                  ? 'needs-review'
                  : 'in-progress';

              return (
                <div key={item.conceptId} className="revision-insights-row" role="listitem">
                  <div className="revision-insights-row-left">
                    <span className="revision-insights-row-index">
                      {String(item.conceptIndex + 1).padStart(2, '0')}
                    </span>
                    <div className="revision-insights-row-info">
                      <span className="revision-insights-row-title">{item.conceptName}</span>
                      <span className="revision-insights-row-evidence">{item.evidenceNote}</span>
                    </div>
                  </div>
                  <div className="revision-insights-row-right">
                    <span className={`revision-overview-status-pill ${pillClass}`}>
                      <span className="revision-overview-status-dot" aria-hidden="true" />
                      <span>{item.masteryLabel}</span>
                    </span>
                    <button
                      type="button"
                      className="revision-insights-action-btn secondary"
                      onClick={() => onSelectConcept(item.conceptId, item.conceptIndex)}
                      aria-label={`Open ${item.conceptName}`}
                    >
                      <span>Open</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section D: Next Steps */}
      <section className="revision-insights-section next-actions" aria-labelledby="heading-actions">
        <div className="revision-insights-section-header">
          <h2 id="heading-actions" className="revision-insights-section-title">
            Suggested Next Steps
          </h2>
        </div>

        <div className="revision-insights-actions-grid">
          {nextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`revision-insights-action-card ${action.isPrimary ? 'primary' : ''}`}
              onClick={() => handleActionClick(action)}
            >
              <div className="revision-insights-action-card-header">
                <span className="revision-insights-action-label">{action.label}</span>
                <span className="revision-insights-action-arrow" aria-hidden="true">→</span>
              </div>
              <p className="revision-insights-action-desc">{action.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
