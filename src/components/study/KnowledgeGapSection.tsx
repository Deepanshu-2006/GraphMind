import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Clock, 
  X, 
  ArrowRight,
  RotateCcw,
  EyeOff,
  Compass,
  FileText
} from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { 
  KnowledgeGapState, 
  DetectedKnowledgeGap,
  GraphKnowledgeGapsReport 
} from '../../types/knowledgeGap';
import {
  detectKnowledgeGaps,
  dismissKnowledgeGap,
  deferKnowledgeGap,
  restoreKnowledgeGap,
  clearGapPreferences
} from '../../services/knowledgeGapDetection';

export interface KnowledgeGapSectionProps {
  graph: KnowledgeGraph;
  onNavigateToConcept?: (conceptId: string) => void;
  onNavigateToRevision?: (conceptId: string, actionType?: string, targetSectionId?: string) => void;
  onNavigateToGraph?: () => void;
  userId?: string | null;
}

type GapFilterTab = 'active' | 'foundational' | 'review' | 'observed' | 'insufficient' | 'all';

const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;

export const KnowledgeGapSection: React.FC<KnowledgeGapSectionProps> = ({
  graph,
  onNavigateToConcept,
  onNavigateToRevision,
  onNavigateToGraph,
  userId
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [filterTab, setFilterTab] = useState<GapFilterTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<Set<string>>(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Derive knowledge gaps report
  const report: GraphKnowledgeGapsReport = useMemo(() => {
    // refreshTrigger forces a recalculation if user dismisses/defers
    void refreshTrigger;
    return detectKnowledgeGaps({
      graph,
      userId,
      forceRefresh: refreshTrigger > 0
    });
  }, [graph, userId, refreshTrigger]);

  const handleDismiss = useCallback((conceptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    dismissKnowledgeGap(graph.id, conceptId);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const handleDefer = useCallback((conceptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    deferKnowledgeGap(graph.id, conceptId, 24);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const handleRestore = useCallback((conceptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    restoreKnowledgeGap(graph.id, conceptId);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const handleResetPreferences = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!graph?.id) return;
    clearGapPreferences(graph.id);
    setRefreshTrigger(prev => prev + 1);
  }, [graph?.id]);

  const toggleEvidence = useCallback((conceptId: string) => {
    setExpandedEvidenceIds(prev => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  }, []);

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    let list = report.items;

    switch (filterTab) {
      case 'active':
        list = report.activeGaps;
        break;
      case 'foundational':
        list = report.items.filter(i => i.gapState === 'potential-foundational-gap' && !i.isDismissed && !i.isDeferred);
        break;
      case 'review':
        list = report.items.filter(i => i.gapState === 'review-recommended' && !i.isDismissed && !i.isDeferred);
        break;
      case 'observed':
        list = report.items.filter(i => i.gapState === 'observed-difficulty' && !i.isDismissed && !i.isDeferred);
        break;
      case 'insufficient':
        list = report.items.filter(i => i.gapState === 'insufficient-evidence');
        break;
      case 'all':
      default:
        list = report.items;
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        i =>
          i.conceptName.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.reason.toLowerCase().includes(q)
      );
    }

    return list;
  }, [report, filterTab, searchQuery]);

  // Execute primary action
  const handleExecuteAction = useCallback((gap: DetectedKnowledgeGap, action = gap.recommendedAction) => {
    switch (action.type) {
      case 'open-related-concept':
        if (action.targetConceptId) {
          onNavigateToConcept?.(action.targetConceptId);
        } else {
          onNavigateToConcept?.(gap.conceptId);
        }
        break;
      case 'reopen-explanation':
        if (onNavigateToRevision) {
          onNavigateToRevision(gap.conceptId, 'explanation');
        } else {
          onNavigateToConcept?.(gap.conceptId);
        }
        break;
      case 'review-worked-example':
        if (onNavigateToRevision) {
          onNavigateToRevision(gap.conceptId, 'worked-example', 'section-worked-example');
        } else {
          onNavigateToConcept?.(gap.conceptId);
        }
        break;
      case 'retry-knowledge-check':
        if (onNavigateToRevision) {
          onNavigateToRevision(gap.conceptId, 'knowledge-check', 'section-knowledge-check');
        } else {
          onNavigateToConcept?.(gap.conceptId);
        }
        break;
      default:
        onNavigateToConcept?.(gap.conceptId);
        break;
    }
  }, [onNavigateToConcept, onNavigateToRevision]);

  const getBadgeStyle = (state: KnowledgeGapState) => {
    switch (state) {
      case 'potential-foundational-gap':
        return 'gap-badge-foundational';
      case 'review-recommended':
        return 'gap-badge-review';
      case 'observed-difficulty':
        return 'gap-badge-observed';
      case 'insufficient-evidence':
        return 'gap-badge-insufficient';
      case 'understanding-demonstrated':
        return 'gap-badge-demonstrated';
    }
  };

  const hasHiddenPreferences = report.dismissedCount > 0 || report.deferredCount > 0;

  return (
    <section 
      className="study-gaps-section" 
      aria-label="Knowledge gap detection"
    >
      <div className="study-gaps-header-block">
        <div className="study-gaps-eyebrow-clip">
          <span className="study-eyebrow study-gaps-eyebrow">
            • KNOWLEDGE GAP DETECTION
          </span>
        </div>

        <div className="study-gaps-title-row">
          <div>
            <h2 className="study-section-title">
              Evidence-based knowledge gaps
            </h2>
            <p className="study-section-desc">
              Identified from your assessment attempts, formative checks, and graph relationships. Unassessed concepts are never diagnosed without evidence.
            </p>
          </div>

          {hasHiddenPreferences && (
            <button
              type="button"
              className="study-gaps-reset-btn"
              onClick={handleResetPreferences}
              aria-label="Restore all dismissed or deferred recommendations"
            >
              <RotateCcw size={12} className="study-btn-icon" aria-hidden="true" />
              <span>Reset dismissed & deferred ({report.dismissedCount + report.deferredCount})</span>
            </button>
          )}
        </div>

        {/* Metric Pills & Filter Tabs Toolbar */}
        <div className="study-gaps-toolbar">
          <div className="study-gaps-tabs" role="tablist" aria-label="Knowledge gap categories">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'active'}
              className={`study-gaps-tab ${filterTab === 'active' ? 'active' : ''}`}
              onClick={() => setFilterTab('active')}
            >
              <span className="study-gaps-tab-dot active-dot" aria-hidden="true" />
              <span>Active attention</span>
              <span className="study-gaps-tab-count">{report.activeGaps.length}</span>
            </button>

            {report.potentialFoundationalCount > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === 'foundational'}
                className={`study-gaps-tab ${filterTab === 'foundational' ? 'active' : ''}`}
                onClick={() => setFilterTab('foundational')}
              >
                <span className="study-gaps-tab-dot foundational-dot" aria-hidden="true" />
                <span>Foundational gaps</span>
                <span className="study-gaps-tab-count">{report.potentialFoundationalCount}</span>
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'review'}
              className={`study-gaps-tab ${filterTab === 'review' ? 'active' : ''}`}
              onClick={() => setFilterTab('review')}
            >
              <span className="study-gaps-tab-dot review-dot" aria-hidden="true" />
              <span>Review recommended</span>
              <span className="study-gaps-tab-count">{report.reviewRecommendedCount}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'observed'}
              className={`study-gaps-tab ${filterTab === 'observed' ? 'active' : ''}`}
              onClick={() => setFilterTab('observed')}
            >
              <span className="study-gaps-tab-dot observed-dot" aria-hidden="true" />
              <span>Observed difficulty</span>
              <span className="study-gaps-tab-count">{report.observedDifficultyCount}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'insufficient'}
              className={`study-gaps-tab ${filterTab === 'insufficient' ? 'active' : ''}`}
              onClick={() => setFilterTab('insufficient')}
            >
              <span className="study-gaps-tab-dot insufficient-dot" aria-hidden="true" />
              <span>Insufficient evidence</span>
              <span className="study-gaps-tab-count">{report.insufficientEvidenceCount}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'all'}
              className={`study-gaps-tab ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              <span>All concepts</span>
              <span className="study-gaps-tab-count">{report.totalConcepts}</span>
            </button>
          </div>

          {/* Quick search input */}
          <div className="study-gaps-search-wrap">
            <Search size={13} className="study-gaps-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="study-gaps-search-input"
              placeholder="Filter concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter knowledge gap concepts"
            />
            {searchQuery && (
              <button
                type="button"
                className="study-gaps-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="study-gaps-list" role="list">
        {filteredItems.length === 0 ? (
          <div className="study-gaps-empty">
            <CheckCircle2 size={24} className="study-gaps-empty-icon" aria-hidden="true" />
            <h3 className="study-gaps-empty-title">
              {filterTab === 'active' 
                ? 'No active knowledge gaps detected' 
                : filterTab === 'foundational'
                ? 'No foundational gaps detected'
                : filterTab === 'review'
                ? 'No concepts requiring review'
                : filterTab === 'insufficient'
                ? 'All concepts have assessment evidence'
                : 'No concepts match your filter'}
            </h3>
            <p className="study-gaps-empty-desc">
              {filterTab === 'active'
                ? 'All assessed concepts have verified understanding demonstrated or have not recorded persistent errors.'
                : 'Check another category or complete further assessments to evaluate your understanding.'}
            </p>
            {onNavigateToGraph && (
              <button
                type="button"
                className="study-editorial-btn study-gaps-empty-btn"
                onClick={onNavigateToGraph}
              >
                <span className="study-btn-content">
                  <span>Explore knowledge graph</span>
                  <span className="study-btn-arrow" aria-hidden="true">→</span>
                </span>
                <span className="study-btn-underline" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isEvidenceOpen = expandedEvidenceIds.has(item.conceptId);
            const hasEvidence = item.supportingEvidence.length > 0;
            const hasRelatedConcepts = item.relatedConcepts.length > 0;
            const foundationalRel = item.relatedConcepts.find(r => r.isPrerequisite && r.hasDifficulty);

            return (
              <motion.div
                key={item.conceptId}
                className={`study-gap-card ${item.isDismissed ? 'dismissed' : ''} ${item.isDeferred ? 'deferred' : ''}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.36, delay: idx * 0.04, ease: EDITORIAL_EASE }}
                role="listitem"
              >
                {/* Card Header */}
                <div className="study-gap-card-header">
                  <div className="study-gap-card-title-group">
                    <span className="study-gap-card-num" aria-hidden="true">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="study-gap-card-headings">
                      <div className="study-gap-card-meta-row">
                        <span className="study-gap-category-tag">{item.category || 'Concept'}</span>
                        <span className="study-gap-meta-dot" aria-hidden="true">•</span>
                        <span className={`study-gap-badge ${getBadgeStyle(item.gapState)}`}>
                          <span className="study-gap-badge-dot" aria-hidden="true" />
                          <span>{item.statusLabel}</span>
                        </span>
                        {item.isDismissed && (
                          <span className="study-gap-state-tag dismissed">Dismissed</span>
                        )}
                        {item.isDeferred && (
                          <span className="study-gap-state-tag deferred">Deferred 24h</span>
                        )}
                      </div>
                      <h3 className="study-gap-concept-title">
                        {item.conceptName}
                      </h3>
                    </div>
                  </div>

                  {/* Quick Graph Navigation */}
                  {onNavigateToConcept && (
                    <button
                      type="button"
                      className="study-gap-graph-link"
                      onClick={() => onNavigateToConcept(item.conceptId)}
                      title={`Open ${item.conceptName} in knowledge graph`}
                      aria-label={`Open ${item.conceptName} in knowledge graph`}
                    >
                      <Compass size={14} aria-hidden="true" />
                      <span>In Graph</span>
                    </button>
                  )}
                </div>

                {/* Performance Reason Banner */}
                <div className="study-gap-reason-box">
                  <p className="study-gap-reason-text">
                    {item.reason}
                  </p>
                </div>

                {/* Potential Foundational Link Box (Section 4) */}
                {item.gapState === 'potential-foundational-gap' && foundationalRel && (
                  <div className="study-gap-foundational-box">
                    <div className="study-gap-foundational-header">
                      <AlertCircle size={13} className="foundational-alert-icon" aria-hidden="true" />
                      <span className="foundational-header-title">FOUNDATIONAL PREREQUISITE GAP</span>
                    </div>
                    <p className="study-gap-foundational-desc">
                      Understanding of <strong>{item.conceptName}</strong> depends on prerequisite concept <strong>{foundationalRel.conceptName}</strong>, which also has recorded difficulty ({foundationalRel.evidenceSummary}). Reviewing the foundation first may clarify both concepts.
                    </p>
                    <button
                      type="button"
                      className="study-gap-prereq-btn"
                      onClick={() => onNavigateToConcept?.(foundationalRel.conceptId)}
                    >
                      <span>Review prerequisite ({foundationalRel.conceptName})</span>
                      <ArrowRight size={12} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Related Concepts (Section 4 — Described strictly as related, not prerequisite) */}
                {item.gapState !== 'potential-foundational-gap' && hasRelatedConcepts && (
                  <div className="study-gap-related-strip">
                    <span className="study-gap-related-label">RELATED CONCEPTS IN GRAPH:</span>
                    <div className="study-gap-related-tags">
                      {item.relatedConcepts.map(rel => (
                        <button
                          key={rel.conceptId}
                          type="button"
                          className={`study-gap-related-pill ${rel.hasDifficulty ? 'has-difficulty' : ''}`}
                          onClick={() => onNavigateToConcept?.(rel.conceptId)}
                          title={`${rel.relationshipLabel}: ${rel.evidenceSummary}`}
                        >
                          <span>{rel.conceptName}</span>
                          {rel.hasDifficulty && <span className="related-alert-dot" title="Difficulty observed" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supporting Evidence Accordion (Section 5) */}
                {hasEvidence && (
                  <div className="study-gap-evidence-accordion">
                    <button
                      type="button"
                      className="study-gap-evidence-toggle"
                      onClick={() => toggleEvidence(item.conceptId)}
                      aria-expanded={isEvidenceOpen}
                    >
                      <span className="evidence-toggle-left">
                        <FileText size={12} aria-hidden="true" />
                        <span>Supporting Evidence ({item.supportingEvidence.length})</span>
                      </span>
                      <span className="evidence-toggle-chevron" aria-hidden="true">
                        {isEvidenceOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isEvidenceOpen && (
                        <motion.div
                          className="study-gap-evidence-body"
                          initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: EDITORIAL_EASE }}
                        >
                          <ul className="study-gap-evidence-list">
                            {item.supportingEvidence.map(ev => (
                              <li key={ev.id} className="study-gap-evidence-item">
                                <span className={`evidence-type-badge ${ev.sourceType}`}>
                                  {ev.sourceType === 'summative-test' 
                                    ? 'Assessment' 
                                    : ev.sourceType === 'graph-prerequisite'
                                    ? 'Prerequisite'
                                    : 'Knowledge Check'}
                                </span>
                                <div className="evidence-text-content">
                                  <span className="evidence-desc">{ev.description}</span>
                                  {ev.details && (
                                    <span className="evidence-details">{ev.details}</span>
                                  )}
                                  {ev.timestamp && (
                                    <span className="evidence-time">
                                      {new Date(ev.timestamp).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Card Actions Footer (Section 6) */}
                <div className="study-gap-card-actions">
                  <div className="study-gap-primary-action-wrap">
                    <button
                      type="button"
                      className="study-editorial-btn study-gap-primary-btn"
                      onClick={() => handleExecuteAction(item, item.recommendedAction)}
                    >
                      <span className="study-btn-content">
                        <span>{item.recommendedAction.label}</span>
                        <span className="study-btn-arrow" aria-hidden="true">→</span>
                      </span>
                      <span className="study-btn-underline" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="study-gap-secondary-actions">
                    {/* Secondary Actions: Worked Example */}
                    {item.secondaryActions.find(a => a.type === 'review-worked-example') && (
                      <button
                        type="button"
                        className="study-gap-ghost-btn"
                        onClick={() => {
                          const action = item.secondaryActions.find(a => a.type === 'review-worked-example');
                          if (action) handleExecuteAction(item, action);
                        }}
                      >
                        <span>Worked Example</span>
                      </button>
                    )}

                    {/* Secondary Action: Retry check */}
                    {item.secondaryActions.find(a => a.type === 'retry-knowledge-check') && item.recommendedAction.type !== 'retry-knowledge-check' && (
                      <button
                        type="button"
                        className="study-gap-ghost-btn"
                        onClick={() => {
                          const action = item.secondaryActions.find(a => a.type === 'retry-knowledge-check');
                          if (action) handleExecuteAction(item, action);
                        }}
                      >
                        <span>Knowledge Check</span>
                      </button>
                    )}

                    {/* Defer */}
                    {!item.isDeferred && (
                      <button
                        type="button"
                        className="study-gap-icon-btn"
                        onClick={(e) => handleDefer(item.conceptId, e)}
                        title="Defer recommendation for 24 hours"
                        aria-label={`Defer ${item.conceptName} recommendation for 24 hours`}
                      >
                        <Clock size={12} aria-hidden="true" />
                        <span>Defer 24h</span>
                      </button>
                    )}

                    {/* Dismiss or Restore */}
                    {item.isDismissed || item.isDeferred ? (
                      <button
                        type="button"
                        className="study-gap-icon-btn restore"
                        onClick={(e) => handleRestore(item.conceptId, e)}
                        title="Restore recommendation"
                        aria-label={`Restore ${item.conceptName} recommendation`}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="study-gap-icon-btn dismiss"
                        onClick={(e) => handleDismiss(item.conceptId, e)}
                        title="Dismiss recommendation"
                        aria-label={`Dismiss ${item.conceptName} recommendation`}
                      >
                        <EyeOff size={12} aria-hidden="true" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
};
