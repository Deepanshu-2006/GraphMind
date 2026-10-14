/**
 * GraphMind Personalized Revision Recommendations UI Component
 * Phase 4 — Prompt 18
 * 
 * Editorial layout presenting evidence-grounded recommendations:
 * - 1 Primary Hero "Next Best Step"
 * - Compact Secondary Recommendations (max 2-3)
 * - Transparent "Why" explanations grounded in real learning data
 * - Functional action triggers (Continue, Review, Foundation, Practice, Explore)
 * - User control: Dismiss (✕) and Defer actions with persistence
 * - Minimalist Swiss-editorial dark aesthetics with restrained accents
 */

import React, { useMemo, useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  RotateCcw,
  BookOpen,
  AlertTriangle,
  GitBranch,
  HelpCircle,
  Compass,
  Sparkles,
  X,
  CheckCircle2
} from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { RevisionSessionState } from '../../types/practice';
import type {
  RevisionRecommendationItem,
  RevisionRecommendationsReport,
  RecommendationCategory
} from '../../types/recommendations';
import {
  generateRevisionRecommendations,
  dismissRecommendation,
  clearRecommendationPreferences
} from '../../services/revisionRecommendations';

export interface RevisionRecommendationsSectionProps {
  graph: KnowledgeGraph;
  activeSession?: RevisionSessionState | null;
  onNavigateToRevision?: (conceptId: string, actionType?: string, targetSectionId?: string) => void;
  onNavigateToConcept?: (conceptId: string) => void;
  onNavigateToGraph?: () => void;
  userId?: string | null;
}

const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;

function getCategoryIcon(category: RecommendationCategory) {
  switch (category) {
    case 'continue-learning':
      return <RotateCcw size={13} className="study-rec-icon" aria-hidden="true" />;
    case 'review-difficulty':
      return <AlertTriangle size={13} className="study-rec-icon warning" aria-hidden="true" />;
    case 'review-foundation':
      return <GitBranch size={13} className="study-rec-icon foundation" aria-hidden="true" />;
    case 'practice-concept':
      return <HelpCircle size={13} className="study-rec-icon practice" aria-hidden="true" />;
    case 'explore-connection':
      return <Compass size={13} className="study-rec-icon explore" aria-hidden="true" />;
    case 'start-new':
      return <Sparkles size={13} className="study-rec-icon new" aria-hidden="true" />;
    default:
      return <BookOpen size={13} className="study-rec-icon" aria-hidden="true" />;
  }
}

export const RevisionRecommendationsSection: React.FC<RevisionRecommendationsSectionProps> = ({
  graph,
  activeSession,
  onNavigateToRevision,
  onNavigateToConcept,
  onNavigateToGraph,
  userId
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Generate recommendations report
  const report: RevisionRecommendationsReport = useMemo(() => {
    void refreshTrigger;
    return generateRevisionRecommendations({
      graph,
      activeSession,
      userId,
      forceRefresh: refreshTrigger > 0
    });
  }, [graph, activeSession, userId, refreshTrigger]);

  const handleDismiss = useCallback((recId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    dismissRecommendation(graph.id, recId);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const handleRestoreAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    clearRecommendationPreferences(graph.id);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const handleActionClick = useCallback((rec: RevisionRecommendationItem) => {
    switch (rec.actionType) {
      case 'continue-revision':
        onNavigateToRevision?.(rec.conceptId, 'continue-session');
        break;
      case 'review-concept':
        onNavigateToRevision?.(rec.conceptId, 'review-concept');
        break;
      case 'open-foundation':
        onNavigateToRevision?.(rec.conceptId, 'open-foundation');
        break;
      case 'practice-concept':
        onNavigateToRevision?.(rec.conceptId, 'practice', rec.targetSectionId || 'section-knowledge-check');
        break;
      case 'explore-graph':
        onNavigateToConcept?.(rec.conceptId);
        break;
      case 'start-concept':
        onNavigateToRevision?.(rec.conceptId, 'start-concept');
        break;
      default:
        onNavigateToRevision?.(rec.conceptId);
        break;
    }
  }, [onNavigateToRevision, onNavigateToConcept]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return null;
  }

  const primary = report.primaryRecommendation;
  const secondary = report.secondaryRecommendations;

  return (
    <motion.section
      className="study-recommendations-section"
      aria-label="Personalized study recommendations"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
    >
      {/* Editorial Section Header */}
      <div className="study-rec-header-block">
        <div className="study-rec-eyebrow-row">
          <span className="study-rec-eyebrow">
            <span className="study-rec-dot" aria-hidden="true" />
            RECOMMENDED NEXT STEP
          </span>
          {report.dismissedCount > 0 && (
            <button
              type="button"
              className="study-rec-restore-all-btn"
              onClick={handleRestoreAll}
              aria-label={`Restore ${report.dismissedCount} dismissed recommendations`}
            >
              Restore {report.dismissedCount} dismissed
            </button>
          )}
        </div>
        <h2 className="study-rec-heading">
          What to study next
        </h2>
        <p className="study-rec-subheading">
          Evidence-grounded recommendations prioritized from your active revision session, mastery records, and graph structure.
        </p>
      </div>

      {/* Main Content Area */}
      {primary ? (
        <div className="study-rec-content-grid">
          {/* Hero Primary Recommendation */}
          <div className={`study-rec-hero-card ${primary.category}`}>
            <div className="study-rec-hero-top">
              <div className="study-rec-category-badge">
                {getCategoryIcon(primary.category)}
                <span>{primary.categoryLabel}</span>
              </div>
              <button
                type="button"
                className="study-rec-dismiss-btn"
                onClick={(e) => handleDismiss(primary.id, e)}
                title="Dismiss this recommendation"
                aria-label={`Dismiss recommendation for ${primary.conceptName}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="study-rec-hero-body">
              <h3 className="study-rec-concept-title">
                {primary.conceptName}
              </h3>
              {primary.targetConceptName && (
                <div className="study-rec-target-context">
                  Target: {primary.targetConceptName}
                </div>
              )}
              <p className="study-rec-explanation">
                {primary.explanation}
              </p>

              {primary.evidenceSnippet && (
                <div className="study-rec-evidence-pill">
                  <span className="study-rec-evidence-label">EVIDENCE:</span>
                  <span className="study-rec-evidence-val">{primary.evidenceSnippet}</span>
                </div>
              )}
            </div>

            <div className="study-rec-hero-action-row">
              <button
                type="button"
                className="study-editorial-btn study-rec-action-btn primary"
                onClick={() => handleActionClick(primary)}
                aria-label={`${primary.actionLabel}: ${primary.conceptName}`}
              >
                <span className="study-btn-content">
                  <span>{primary.actionLabel.toUpperCase()}</span>
                  <ArrowRight size={14} className="study-btn-arrow" aria-hidden="true" />
                </span>
                <span className="study-btn-underline" aria-hidden="true" />
              </button>
              <span className="study-rec-action-hint">
                {primary.actionDescription}
              </span>
            </div>
          </div>

          {/* Secondary Recommendations (Max 3 items) */}
          {secondary.length > 0 && (
            <div className="study-rec-secondary-list">
              <span className="study-rec-secondary-heading">OTHER USEFUL ACTIONS</span>
              <div className="study-rec-secondary-grid">
                {secondary.map((item) => (
                  <div key={item.id} className={`study-rec-secondary-card ${item.category}`}>
                    <div className="study-rec-card-header">
                      <span className="study-rec-card-badge">
                        {getCategoryIcon(item.category)}
                        <span>{item.categoryLabel}</span>
                      </span>
                      <button
                        type="button"
                        className="study-rec-card-dismiss"
                        onClick={(e) => handleDismiss(item.id, e)}
                        title="Dismiss recommendation"
                        aria-label={`Dismiss ${item.conceptName}`}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="study-rec-card-main">
                      <h4 className="study-rec-card-title">{item.conceptName}</h4>
                      <p className="study-rec-card-explanation">{item.explanation}</p>
                    </div>

                    <div className="study-rec-card-footer">
                      <button
                        type="button"
                        className="study-editorial-btn study-rec-card-action"
                        onClick={() => handleActionClick(item)}
                        aria-label={`${item.actionLabel} for ${item.conceptName}`}
                      >
                        <span className="study-btn-content">
                          <span>{item.actionLabel}</span>
                          <ArrowRight size={12} className="study-btn-arrow" aria-hidden="true" />
                        </span>
                        <span className="study-btn-underline" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Fallback State: All Demonstrated or Dismissed */
        <div className="study-rec-empty-card">
          <div className="study-rec-empty-icon-wrap">
            <CheckCircle2 size={24} className="study-rec-empty-icon" aria-hidden="true" />
          </div>
          <div className="study-rec-empty-info">
            <h3 className="study-rec-empty-title">All concepts up to date</h3>
            <p className="study-rec-empty-desc">
              No urgent revision recommendations detected for this knowledge graph. You have demonstrated understanding across studied concepts, or all recommendations have been addressed.
            </p>
          </div>
          <button
            type="button"
            className="study-editorial-btn study-rec-empty-btn"
            onClick={onNavigateToGraph}
            aria-label="Explore knowledge graph"
          >
            <span className="study-btn-content">
              <span>EXPLORE GRAPH</span>
              <ArrowRight size={13} className="study-btn-arrow" aria-hidden="true" />
            </span>
            <span className="study-btn-underline" aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.section>
  );
};
