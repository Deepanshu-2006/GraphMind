/**
 * GraphMind Unified Learning Overview Component
 * Phase 4 — Prompt 19
 * 
 * Coherent Study Space learning overview integrating:
 * - Real-time progress ledger (distinguishing activity from demonstrated understanding)
 * - Clear primary recommended next action (from revision recommendations engine)
 * - Compact list of concepts needing attention (grounded difficulties & knowledge gaps)
 * - Unfinished revision session indicator
 * - Graph-specific scope respecting selected graph
 * - Swiss-editorial minimalist aesthetics
 */

import React, { useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  GitBranch,
  HelpCircle,
  Compass,
  Sparkles,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { RevisionSessionState } from '../../types/practice';
import type {
  UnifiedLearningOverviewData,
  ConceptAttentionItem
} from '../../types/learningOverview';
import type { RecommendationCategory } from '../../types/recommendations';
import { computeUnifiedLearningOverview } from '../../services/unifiedLearningOverview';

export interface UnifiedLearningOverviewProps {
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
      return <RotateCcw size={13} className="overview-rec-icon" aria-hidden="true" />;
    case 'review-difficulty':
      return <AlertTriangle size={13} className="overview-rec-icon warning" aria-hidden="true" />;
    case 'review-foundation':
      return <GitBranch size={13} className="overview-rec-icon foundation" aria-hidden="true" />;
    case 'practice-concept':
      return <HelpCircle size={13} className="overview-rec-icon practice" aria-hidden="true" />;
    case 'explore-connection':
      return <Compass size={13} className="overview-rec-icon explore" aria-hidden="true" />;
    case 'start-new':
      return <Sparkles size={13} className="overview-rec-icon new" aria-hidden="true" />;
    default:
      return <BookOpen size={13} className="overview-rec-icon" aria-hidden="true" />;
  }
}

export const UnifiedLearningOverview: React.FC<UnifiedLearningOverviewProps> = ({
  graph,
  activeSession,
  onNavigateToRevision,
  onNavigateToConcept,
  onNavigateToGraph,
  userId
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Compute overview data deterministically
  const overview: UnifiedLearningOverviewData = useMemo(() => {
    return computeUnifiedLearningOverview({
      graph,
      activeSession,
      userId
    });
  }, [graph, activeSession, userId]);

  const handleActionClick = useCallback((actionType: string, conceptId: string, targetSectionId?: string) => {
    switch (actionType) {
      case 'continue-revision':
        onNavigateToRevision?.(conceptId, 'continue-session');
        break;
      case 'review-concept':
        onNavigateToRevision?.(conceptId, 'review-concept');
        break;
      case 'open-foundation':
        onNavigateToRevision?.(conceptId, 'open-foundation');
        break;
      case 'practice-concept':
        onNavigateToRevision?.(conceptId, 'practice', targetSectionId || 'section-knowledge-check');
        break;
      case 'explore-graph':
        if (conceptId) {
          onNavigateToConcept?.(conceptId);
        } else {
          onNavigateToGraph?.();
        }
        break;
      case 'start-concept':
        onNavigateToRevision?.(conceptId, 'start-concept');
        break;
      default:
        if (conceptId) {
          onNavigateToRevision?.(conceptId);
        } else {
          onNavigateToGraph?.();
        }
        break;
    }
  }, [onNavigateToRevision, onNavigateToConcept, onNavigateToGraph]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return null;
  }

  const primary = overview.primaryRecommendation;
  const secondary = overview.secondaryRecommendations;
  const attentionItems = overview.conceptsNeedingAttention;

  return (
    <motion.section
      className="unified-overview-section"
      aria-label={`Learning overview for ${overview.graphName}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EDITORIAL_EASE }}
    >
      {/* 1. Overview Header Block */}
      <div className="unified-overview-header">
        <div className="unified-overview-eyebrow-row">
          <span className="unified-overview-eyebrow">
            <span className="unified-overview-dot" aria-hidden="true" />
            LEARNING OVERVIEW · {overview.graphName.toUpperCase()}
          </span>
          {overview.hasUnfinishedSession && overview.unfinishedSession && (
            <span className="unified-overview-session-pill">
              Session paused: {overview.unfinishedSession.currentConceptName} ({overview.unfinishedSession.remainingCount} remaining)
            </span>
          )}
        </div>
        <h2 className="unified-overview-heading">
          Your active learning state
        </h2>
        <p className="unified-overview-subheading">
          Overview of demonstrated understanding, concepts needing attention, and recommended next steps for this graph.
        </p>
      </div>

      {/* 2. Concept Progress Ledger Strip */}
      <div className="unified-overview-ledger" role="region" aria-label="Concept understanding ledger">
        <div className="ledger-metric demonstrated">
          <span className="ledger-num">{overview.demonstratedCount}</span>
          <span className="ledger-label">Demonstrated</span>
        </div>
        <div className="ledger-divider" aria-hidden="true" />
        <div className="ledger-metric review">
          <span className="ledger-num">{overview.needsReviewCount}</span>
          <span className="ledger-label">Need Review</span>
        </div>
        <div className="ledger-divider" aria-hidden="true" />
        <div className="ledger-metric progress">
          <span className="ledger-num">{overview.inProgressCount}</span>
          <span className="ledger-label">In Progress</span>
        </div>
        <div className="ledger-divider" aria-hidden="true" />
        <div className="ledger-metric unstudied">
          <span className="ledger-num">{overview.notStartedCount}</span>
          <span className="ledger-label">Unstudied</span>
        </div>
        <div className="ledger-summary">
          <span className="ledger-summary-ratio">
            {overview.demonstratedCount} of {overview.totalConcepts} concepts demonstrated ({overview.demonstratedPercentage}%)
          </span>
          <span className="ledger-summary-sub">
            Activity: {overview.activityCount} concepts studied
          </span>
        </div>
      </div>

      {/* 3. Primary Next Recommended Action (Clear Visual Priority) */}
      {primary && (
        <div className="unified-overview-hero-wrap">
          <div className="unified-overview-section-label">RECOMMENDED NEXT STEP</div>
          <div className={`unified-overview-hero-card ${primary.category}`}>
            <div className="overview-hero-top">
              <span className="overview-category-badge">
                {getCategoryIcon(primary.category)}
                <span>{primary.categoryLabel}</span>
              </span>
              {primary.priority === 1 && (
                <span className="overview-priority-tag">TOP PRIORITY</span>
              )}
            </div>

            <div className="overview-hero-main">
              <h3 className="overview-concept-title">{primary.conceptName}</h3>
              {primary.targetConceptName && (
                <span className="overview-target-context">
                  Target: {primary.targetConceptName}
                </span>
              )}
              <p className="overview-explanation">{primary.explanation}</p>
              {primary.evidenceSnippet && (
                <div className="overview-evidence-pill">
                  <span className="evidence-pill-label">RECORDED EVIDENCE:</span>
                  <span className="evidence-pill-value">{primary.evidenceSnippet}</span>
                </div>
              )}
            </div>

            <div className="overview-hero-action-row">
              <button
                type="button"
                className="study-editorial-btn overview-action-btn primary"
                onClick={() => handleActionClick(primary.actionType, primary.conceptId, primary.targetSectionId)}
                aria-label={`${primary.actionLabel}: ${primary.conceptName}`}
              >
                <span className="study-btn-content">
                  <span>{primary.actionLabel.toUpperCase()}</span>
                  <ArrowRight size={13} className="study-btn-arrow" aria-hidden="true" />
                </span>
                <span className="study-btn-underline" aria-hidden="true" />
              </button>
              <span className="overview-action-hint">{primary.actionDescription}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Secondary Recommendations (Compact) */}
      {secondary.length > 0 && (
        <div className="unified-overview-secondary-wrap">
          <div className="unified-overview-section-label">SECONDARY ACTIONS</div>
          <div className="unified-overview-secondary-grid">
            {secondary.map(item => (
              <div key={item.id} className={`overview-secondary-card ${item.category}`}>
                <div className="overview-sec-header">
                  <span className="overview-sec-badge">
                    {getCategoryIcon(item.category)}
                    <span>{item.categoryLabel}</span>
                  </span>
                </div>
                <h4 className="overview-sec-title">{item.conceptName}</h4>
                <p className="overview-sec-desc">{item.explanation}</p>
                <button
                  type="button"
                  className="study-editorial-btn overview-sec-btn"
                  onClick={() => handleActionClick(item.actionType, item.conceptId, item.targetSectionId)}
                  aria-label={`${item.actionLabel} for ${item.conceptName}`}
                >
                  <span className="study-btn-content">
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={12} className="study-btn-arrow" aria-hidden="true" />
                  </span>
                  <span className="study-btn-underline" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Concepts Needing Attention (Compact Knowledge Gaps) */}
      <div className="unified-overview-attention-wrap">
        <div className="unified-overview-section-label">
          CONCEPTS REQUIRING ATTENTION {attentionItems.length > 0 ? `(${attentionItems.length})` : ''}
        </div>

        {attentionItems.length > 0 ? (
          <div className="overview-attention-list">
            {attentionItems.slice(0, 4).map((item: ConceptAttentionItem) => (
              <div key={item.conceptId} className="overview-attention-row">
                <div className="overview-attention-left">
                  <div className="attention-name-row">
                    <span className="attention-concept-name">{item.conceptName}</span>
                    <span className={`attention-status-pill ${item.status}`}>
                      {item.statusLabel}
                    </span>
                    {item.isPrerequisiteIssue && (
                      <span className="attention-prereq-pill">Foundational Prerequisite</span>
                    )}
                  </div>
                  <p className="attention-reason">{item.reason}</p>
                  {item.evidenceSnippet && (
                    <span className="attention-evidence">{item.evidenceSnippet}</span>
                  )}
                </div>

                <div className="overview-attention-right">
                  <button
                    type="button"
                    className="study-editorial-btn attention-action-btn"
                    onClick={() => handleActionClick(item.actionType, item.conceptId)}
                    aria-label={`${item.actionLabel} for ${item.conceptName}`}
                  >
                    <span className="study-btn-content">
                      <span>{item.actionLabel.toUpperCase()}</span>
                      <ArrowRight size={12} className="study-btn-arrow" aria-hidden="true" />
                    </span>
                    <span className="study-btn-underline" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overview-attention-clean">
            <CheckCircle2 size={16} className="overview-clean-icon" aria-hidden="true" />
            <span className="overview-clean-text">
              {overview.demonstratedCount > 0
                ? 'All studied concepts have demonstrated understanding. No active knowledge gaps.'
                : 'No concepts flagged for review. Start studying to build understanding.'}
            </span>
          </div>
        )}
      </div>
    </motion.section>
  );
};
