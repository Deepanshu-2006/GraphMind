import React from 'react';
import type { ConceptFoundationsReport, FoundationalConceptRecommendation } from '../../types/prerequisites';

export interface FoundationsSectionProps {
  report: ConceptFoundationsReport | null | undefined;
  sectionNum?: string;
  sectionNumber?: string;
  onOpenFoundationalConcept: (conceptId: string) => void;
  onExploreInGraph?: (conceptId: string) => void;
  onViewInGraph?: (conceptId: string) => void;
}

export const FoundationsSection: React.FC<FoundationsSectionProps> = ({
  report,
  sectionNum,
  sectionNumber,
  onOpenFoundationalConcept,
  onExploreInGraph,
  onViewInGraph
}) => {
  const effectiveSectionNum = sectionNum || sectionNumber;
  const handleGraphExplore = onExploreInGraph || onViewInGraph;

  // Fallback Rule (Section 7): If no reliable prerequisite information exists, omit section cleanly.
  if (!report || !report.hasFoundations || !report.items || report.items.length === 0) {
    return null;
  }

  return (
    <div className="revision-section revision-section-foundations" id="section-foundations">
      <span className="revision-foundations-kicker">FOUNDATIONS / REQUISITE CONCEPTS</span>
      <h2 className="revision-section-heading">
        {effectiveSectionNum && <span className="revision-section-num">{effectiveSectionNum}</span>}
        <span>Foundations & Prerequisites</span>
      </h2>

      <p className="revision-section-intro">
        Foundational concepts and relationships from your knowledge graph that support this topic.
        When encountering difficulty, investigating underlying concepts is often more effective than repeatedly reading the same material.
      </p>

      <div className="revision-foundations-grid" role="list" aria-label="Foundational concepts list">
        {report.items.map((item: FoundationalConceptRecommendation) => {
          const isConfirmed = item.prerequisiteCategory === 'confirmed-prerequisite';
          const isSourceFoundation = item.prerequisiteCategory === 'source-foundation';
          const isNeedsReview = item.evidenceStatus === 'needs-review' || item.evidenceStatus === 'observed-difficulty';
          const categoryBadgeClass = isConfirmed
            ? 'category-confirmed-prerequisite cat-confirmed'
            : isSourceFoundation
              ? 'category-source-foundation cat-foundation'
              : 'category-related-concept cat-related';

          return (
            <div
              key={item.conceptId}
              className={`revision-foundation-card ${isConfirmed ? 'is-confirmed' : ''} ${isNeedsReview ? 'has-review-need' : ''}`}
              role="listitem"
            >
              <div className="revision-foundation-card-header">
                <div className="revision-foundation-title-group">
                  <h3 className="revision-foundation-name">{item.conceptName}</h3>
                  <div className="revision-foundation-badges">
                    <span className={`revision-foundation-cat-badge ${categoryBadgeClass}`}>
                      {item.categoryLabel}
                    </span>

                    <span
                      className={`revision-foundation-status-badge status-${item.evidenceStatus}`}
                      title={`Student learning status: ${item.evidenceStatusLabel}`}
                    >
                      <span className={`revision-foundation-status-dot ${item.evidenceStatus}`} aria-hidden="true" />
                      <span>{item.evidenceStatusLabel}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="revision-foundation-reason-box">
                <span className="revision-foundation-reason-kicker">WHY THIS HELPS</span>
                <p className="revision-foundation-reason-text">{item.whyItHelps}</p>
              </div>

              <div className="revision-foundation-actions">
                <button
                  type="button"
                  className="revision-foundation-open-btn"
                  onClick={() => onOpenFoundationalConcept(item.conceptId)}
                  aria-label={`Review foundational concept ${item.conceptName}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Review foundation</span>
                </button>

                {handleGraphExplore && (
                  <button
                    type="button"
                    className="revision-foundation-graph-btn"
                    onClick={() => handleGraphExplore(item.conceptId)}
                    aria-label={`Explore ${item.conceptName} in knowledge graph`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>Explore in graph</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
