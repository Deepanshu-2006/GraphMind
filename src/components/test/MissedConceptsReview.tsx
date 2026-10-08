import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { MissedConceptItem } from '../../types/test';

interface MissedConceptsReviewProps {
  missedConcepts: MissedConceptItem[];
  onBackToResults: () => void;
  onReviewConceptInGraph: (conceptId: string) => void;
}

export function MissedConceptsReview({
  missedConcepts,
  onBackToResults,
  onReviewConceptInGraph
}: MissedConceptsReviewProps) {
  // Deduplicate missed items by conceptId so each unique concept is listed once
  const uniqueConcepts = Array.from(
    new Map(missedConcepts.map(item => [item.conceptId, item])).values()
  );

  return (
    <div className="missed-concepts-container">
      <div className="review-header-bar">
        <button
          type="button"
          className="test-editorial-action-btn action-ghost"
          onClick={onBackToResults}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>BACK TO RESULTS</span>
        </button>
        <div className="review-header-title">REVIEW RECOMMENDED</div>
      </div>

      <div className="missed-concepts-hero">
        <h1 className="missed-concepts-title">Missed Concepts</h1>
        <p className="missed-concepts-subtitle">
          Select any concept below to exit the test and focus on its connections and source material within your knowledge graph.
        </p>
      </div>

      <div className="missed-concepts-list">
        {uniqueConcepts.map(item => (
          <div key={item.conceptId} className="missed-concept-card">
            <div className="missed-card-left">
              <span className="missed-dot" aria-hidden="true" />
              <div className="missed-card-info">
                <h3 className="missed-concept-name">{item.conceptName}</h3>
                <p className="missed-concept-why">{item.explanation}</p>
                {item.sourceName && (
                  <span className="missed-concept-source">
                    Source: {item.sourceName}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="missed-concept-review-btn"
              onClick={() => onReviewConceptInGraph(item.conceptId)}
              title={`Focus ${item.conceptName} in knowledge graph`}
            >
              <span>REVIEW</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
