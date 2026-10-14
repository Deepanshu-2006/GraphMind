import React from 'react';
import type { AdaptiveRecommendation, AdaptiveAction } from '../../types/adaptiveRevision';

// Preserve React in scope for tsx runner environments
void React;

export interface AdaptiveNextStepProps {
  recommendation: AdaptiveRecommendation;
  onNavigateToSection?: (sectionId: string) => void;
  onNavigateToConcept?: (conceptId: string) => void;
  onContinuePlanned?: (targetIndex?: number) => void;
  onRetryKnowledgeCheck?: () => void;
}

export const AdaptiveNextStep: React.FC<AdaptiveNextStepProps> = ({
  recommendation,
  onNavigateToSection,
  onNavigateToConcept,
  onContinuePlanned,
  onRetryKnowledgeCheck
}) => {
  const { performanceState, rationale, primaryAction, secondaryActions } = recommendation;

  const handleActionClick = (action: AdaptiveAction) => {
    switch (action.type) {
      case 'continue-planned-path':
        onContinuePlanned?.(action.targetIndex);
        break;
      case 'review-explanation-section':
      case 'review-worked-example':
        if (action.targetSectionId) {
          onNavigateToSection?.(action.targetSectionId);
        }
        break;
      case 'retry-knowledge-check':
        onRetryKnowledgeCheck?.();
        break;
      case 'explore-prerequisite-concept':
      case 'explore-related-concept':
        if (action.targetConceptId) {
          onNavigateToConcept?.(action.targetConceptId);
        }
        break;
      default:
        break;
    }
  };

  const getStatusLabel = () => {
    if (performanceState.isUncertain) return 'EVALUATION UNCERTAIN';
    switch (performanceState.status) {
      case 'needs-review':
        return 'NEEDS REVIEW';
      case 'showing-understanding':
        return 'SHOWING UNDERSTANDING';
      case 'demonstrated-understanding':
        return 'DEMONSTRATED UNDERSTANDING';
      case 'studied-unassessed':
        return 'STUDIED / UNASSESSED';
      case 'not-studied':
      default:
        return 'PLANNED SEQUENCE';
    }
  };

  const getStatusClass = () => {
    if (performanceState.isUncertain) return 'uncertain';
    switch (performanceState.status) {
      case 'needs-review':
        return 'needs-review';
      case 'showing-understanding':
      case 'demonstrated-understanding':
        return 'understood';
      case 'studied-unassessed':
      default:
        return 'neutral';
    }
  };

  return (
    <section
      className="revision-adaptive-container"
      role="region"
      aria-label="Adaptive next-step recommendations"
      id="section-adaptive-guidance"
    >
      <div className="revision-adaptive-header">
        <div className="revision-adaptive-kicker">
          <span className="revision-adaptive-dot" aria-hidden="true" />
          <span>ADAPTIVE GUIDANCE</span>
        </div>
        <div className={`revision-adaptive-status-pill ${getStatusClass()}`}>
          {getStatusLabel()}
        </div>
      </div>

      <div className="revision-adaptive-body">
        <p className="revision-adaptive-rationale">{rationale}</p>

        <div className="revision-adaptive-actions">
          {/* Primary Suggested Action */}
          {primaryAction && (
            <button
              type="button"
              className="revision-adaptive-btn-primary"
              onClick={() => handleActionClick(primaryAction)}
              title={primaryAction.description || primaryAction.label}
            >
              <span>{primaryAction.label}</span>
            </button>
          )}

          {/* Secondary Actions (always preserves student control) */}
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="revision-adaptive-btn-secondary"
              onClick={() => handleActionClick(action)}
              title={action.description || action.label}
            >
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
