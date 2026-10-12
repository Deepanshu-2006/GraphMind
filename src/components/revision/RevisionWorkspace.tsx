import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { GraphConceptData, ConceptRelationship } from '../../types/graph';
import type { RevisionPathStep, RevisionSessionState } from '../../types/practice';
import {
  createRevisionSession,
  validateRevisionSession,
  loadRevisionSession,
  saveRevisionSession,
  jumpToIndex,
  jumpToConceptId
} from '../../services/revisionSession';

export interface RevisionConceptItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  relationships?: ConceptRelationship[];
  keyIdeas?: string[];
  evidence?: string;
  isCore?: boolean;
}

export interface RevisionWorkspaceProps {
  graph?: KnowledgeGraph | null;
  graphName?: string;
  revisionPath?: RevisionPathStep[];
  revisionIndex?: number;
  allNodes?: Array<any>;
  allEdges?: Array<any>;
  conceptDetails?: Record<string, GraphConceptData>;
  initialConceptId?: string | null;
  session?: RevisionSessionState | null;
  onSessionChange?: (session: RevisionSessionState) => void;
  onPrevConcept?: () => void;
  onNextConcept?: () => void;
  onSelectConceptIndex?: (index: number) => void;
  onBackToGraph: () => void;
  onViewGraph?: (conceptId?: string) => void;
  onSelectGraph?: () => void;
  isLoading?: boolean;
}

/**
 * Dedicated Deep Revision Workspace (Phase 1 — Foundation)
 * 
 * Minimal, editorial technical publication layout for deep, focused concept revision.
 * Occupies the main content area of GraphMind while preserving sidebar and top navigation.
 */
export const RevisionWorkspace: React.FC<RevisionWorkspaceProps> = ({
  graph,
  graphName,
  revisionPath,
  revisionIndex: controlledIndex,
  allNodes = [],
  allEdges = [],
  conceptDetails = {},
  initialConceptId = null,
  session: controlledSession,
  onSessionChange,
  onPrevConcept,
  onNextConcept,
  onSelectConceptIndex,
  onBackToGraph,
  onViewGraph,
  onSelectGraph,
  isLoading = false
}) => {
  // 1. Resolve deterministic concept sequence from revisionPath or graph data
  const concepts: RevisionConceptItem[] = useMemo(() => {
    // If a revisionPath sequence is provided and non-empty, follow it
    if (revisionPath && revisionPath.length > 0) {
      return revisionPath.map((step) => {
        const detail = conceptDetails[step.conceptId];
        const rawNode = allNodes.find((n) => n.id === step.conceptId) ||
          graph?.nodes.find((n) => n.id === step.conceptId);

        return {
          id: step.conceptId,
          name: step.conceptName || detail?.label || detail?.name || rawNode?.name || rawNode?.data?.label || step.conceptId,
          category: step.category || detail?.category || rawNode?.category || rawNode?.data?.category || rawNode?.type,
          description: detail?.description || rawNode?.description || rawNode?.data?.description || '',
          relationships: detail?.relationships || (rawNode?.relationships as ConceptRelationship[]) || [],
          keyIdeas: detail?.keyIdeas || rawNode?.keyIdeas || rawNode?.data?.keyIdeas,
          evidence: detail?.evidence || rawNode?.evidence || rawNode?.data?.evidence,
          isCore: rawNode?.isCore || rawNode?.data?.isCore
        };
      });
    }

    // Otherwise, derive concepts deterministically from the selected graph's actual nodes
    const sourceNodes = (graph?.nodes && graph.nodes.length > 0) ? graph.nodes : (allNodes.length > 0 ? allNodes : []);
    if (sourceNodes.length === 0) return [];

    // Deterministically build relationships from graph.relationships or allEdges if needed
    const relMap = new Map<string, ConceptRelationship[]>();
    const effectiveRels = graph?.relationships || [];
    effectiveRels.forEach((rel) => {
      const source = rel.source;
      const target = rel.target;
      if (!source || !target) return;

      const targetNode = sourceNodes.find((n: any) => n.id === target);
      const targetName = targetNode?.name || (targetNode as any)?.data?.label || target;

      if (!relMap.has(source)) relMap.set(source, []);
      relMap.get(source)!.push({
        id: rel.id,
        type: rel.type || rel.label || 'related-to',
        targetId: target,
        targetName,
        direction: 'outgoing',
        description: rel.description
      });
    });

    return sourceNodes.map((n: any) => {
      const id = n.id;
      const detail = conceptDetails[id];
      const rels = detail?.relationships || relMap.get(id) || [];
      return {
        id,
        name: detail?.label || detail?.name || n.name || n.data?.label || id,
        category: detail?.category || n.category || n.data?.category || n.type,
        description: detail?.description || n.description || n.data?.description || '',
        relationships: rels,
        keyIdeas: detail?.keyIdeas || n.keyIdeas || n.data?.keyIdeas,
        evidence: detail?.evidence || n.evidence || n.data?.evidence,
        isCore: n.isCore || n.data?.isCore
      };
    });
  }, [revisionPath, conceptDetails, allNodes, graph?.nodes, graph?.relationships]);

  // 2. Manage revision session state (restores previous session when available)
  const [internalSession, setInternalSession] = useState<RevisionSessionState>(() => {
    if (controlledSession && graph) {
      const valid = validateRevisionSession(controlledSession, graph);
      if (valid) return valid;
    }
    if (graph?.id) {
      const stored = loadRevisionSession(graph.id);
      const validated = validateRevisionSession(stored, graph);
      if (validated) {
        if (initialConceptId && validated.conceptIds.includes(initialConceptId)) {
          return jumpToConceptId(validated, initialConceptId);
        }
        if (controlledIndex !== undefined) {
          return jumpToIndex(validated, controlledIndex);
        }
        return validated;
      }
    }

    const ids = (revisionPath && revisionPath.length > 0)
      ? revisionPath.map(p => p.conceptId)
      : ((graph?.nodes && graph.nodes.length > 0) ? graph.nodes.map(n => n.id) : (allNodes.map((n: any) => n.id) || []));

    const initIdx = initialConceptId && ids.includes(initialConceptId)
      ? ids.indexOf(initialConceptId)
      : (controlledIndex !== undefined ? controlledIndex : 0);

    const fresh = createRevisionSession({
      graphId: graph?.id || 'default_graph',
      conceptIds: ids,
      currentIndex: initIdx,
      currentConceptId: ids[initIdx] || null,
      path: revisionPath
    });

    if (graph?.id && ids.length > 0) {
      saveRevisionSession(fresh, graph.id);
    }
    return fresh;
  });

  const activeSession = controlledSession || internalSession;
  const totalConcepts = concepts.length;

  // Resolve active index: controlledIndex takes precedence if provided, otherwise activeSession.currentIndex
  const rawIndex = controlledIndex !== undefined ? controlledIndex : activeSession.currentIndex;
  const currentIndex = totalConcepts > 0
    ? Math.min(Math.max(0, rawIndex), totalConcepts - 1)
    : 0;

  const isFirst = totalConcepts <= 1 || currentIndex <= 0;
  const isLast = totalConcepts <= 1 || currentIndex >= totalConcepts - 1;

  // Sync session when graph selection changes or graph nodes update
  useEffect(() => {
    if (!graph?.id) return;

    if (internalSession.graphId !== graph.id) {
      // Switched graph: strictly load this graph's session or create fresh
      const stored = loadRevisionSession(graph.id);
      const validated = validateRevisionSession(stored, graph);
      if (validated) {
        setInternalSession(validated);
        onSessionChange?.(validated);
      } else {
        const ids = (revisionPath && revisionPath.length > 0)
          ? revisionPath.map(p => p.conceptId)
          : (graph.nodes?.map(n => n.id) || allNodes.map((n: any) => n.id) || []);
        const fresh = createRevisionSession({
          graphId: graph.id,
          conceptIds: ids,
          currentIndex: controlledIndex ?? 0,
          path: revisionPath
        });
        setInternalSession(fresh);
        if (ids.length > 0) saveRevisionSession(fresh, graph.id);
        onSessionChange?.(fresh);
      }
    } else {
      // Same graph: sanitize against deleted concepts or node changes
      const validated = validateRevisionSession(internalSession, graph);
      if (validated && (
        validated.conceptIds.length !== internalSession.conceptIds.length ||
        validated.currentIndex !== internalSession.currentIndex
      )) {
        setInternalSession(validated);
        saveRevisionSession(validated, graph.id);
        onSessionChange?.(validated);
      }
    }
  }, [graph?.id, graph?.nodes, controlledIndex, revisionPath, onSessionChange]);

  // Sync when controlledSession changes
  useEffect(() => {
    if (controlledSession && graph) {
      const validated = validateRevisionSession(controlledSession, graph);
      if (validated) {
        setInternalSession(validated);
      }
    }
  }, [controlledSession, graph]);

  // Sync when initialConceptId changes (when not controlled by revisionIndex)
  useEffect(() => {
    if (controlledIndex === undefined && initialConceptId && concepts.length > 0) {
      const foundIdx = concepts.findIndex((c) => c.id === initialConceptId);
      if (foundIdx >= 0 && foundIdx !== activeSession.currentIndex) {
        const nextSession = jumpToIndex(activeSession, foundIdx);
        setInternalSession(nextSession);
        if (graph?.id) saveRevisionSession(nextSession, graph.id);
        onSessionChange?.(nextSession);
      }
    }
  }, [controlledIndex, initialConceptId, concepts, graph?.id, onSessionChange]);

  // Concept navigation step handlers
  const handlePrev = useCallback(() => {
    if (isFirst) return;
    const prevIdx = Math.max(0, currentIndex - 1);
    const nextSession = jumpToIndex(activeSession, prevIdx);
    setInternalSession(nextSession);
    if (graph?.id) saveRevisionSession(nextSession, graph.id);
    onSessionChange?.(nextSession);
    onSelectConceptIndex?.(prevIdx);
    onPrevConcept?.();
  }, [isFirst, currentIndex, activeSession, graph?.id, onSessionChange, onSelectConceptIndex, onPrevConcept]);

  const handleNext = useCallback(() => {
    if (isLast) return;
    const nextIdx = Math.min(totalConcepts - 1, currentIndex + 1);
    const nextSession = jumpToIndex(activeSession, nextIdx);
    const currentConceptId = concepts[currentIndex]?.id;
    if (currentConceptId && !nextSession.reviewedConceptIds.includes(currentConceptId)) {
      nextSession.reviewedConceptIds.push(currentConceptId);
    }
    setInternalSession(nextSession);
    if (graph?.id) saveRevisionSession(nextSession, graph.id);
    onSessionChange?.(nextSession);
    onSelectConceptIndex?.(nextIdx);
    onNextConcept?.();
  }, [isLast, currentIndex, totalConcepts, activeSession, concepts, graph?.id, onSessionChange, onSelectConceptIndex, onNextConcept]);

  // Keyboard navigation hotkeys (Left / Right arrow, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' && !isFirst) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' && !isLast) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onBackToGraph();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFirst, isLast, handlePrev, handleNext, onBackToGraph]);

  // Resolve current concept
  const currentConcept: RevisionConceptItem | null = concepts[currentIndex] || null;

  // View graph action
  const handleViewGraph = useCallback(() => {
    if (onViewGraph) {
      onViewGraph(currentConcept?.id);
    } else {
      onBackToGraph();
    }
  }, [onViewGraph, currentConcept?.id, onBackToGraph]);

  // Resolved graph name for header
  const resolvedGraphName = graphName || graph?.name || 'Knowledge Graph';

  // Formatting helpers
  const formattedIndex = String(currentIndex + 1).padStart(2, '0');
  const formattedTotal = String(Math.max(totalConcepts, 1)).padStart(2, '0');
  const progressPercentage = totalConcepts > 0 ? ((currentIndex + 1) / totalConcepts) * 100 : 0;

  const prevConcept = currentIndex > 0 ? concepts[currentIndex - 1] : null;
  const nextConcept = currentIndex < totalConcepts - 1 ? concepts[currentIndex + 1] : null;

  // Check existing concept data for content structure sections
  const conceptTitle = currentConcept?.name || '';
  const conceptDescription = currentConcept?.description || '';
  const relatedConcepts = currentConcept?.relationships || [];

  // Understanding section only renders if there are extra key ideas or evidence
  const hasExtraKeyIdeas = Boolean(currentConcept?.keyIdeas && currentConcept.keyIdeas.length > 0);
  const hasEvidence = Boolean(currentConcept?.evidence && currentConcept.evidence.trim().length > 0);
  const hasUnderstandingData = hasExtraKeyIdeas || hasEvidence;
  const hasRelatedConcepts = relatedConcepts.length > 0;

  // Phase 2 placeholders remain hidden when no data is present
  const hasHowItWorksData = false;
  const hasImportantDetailsData = false;
  const hasExamplesData = false;
  const hasKnowledgeChecksData = false;

  return (
    <div
      className="revision-workspace-root"
      role="region"
      aria-label="GraphMind Dedicated Revision Workspace"
    >
      {/* --------------------------------------------------------------------
          TOP WORKSPACE HEADER (Section 2 & 7)
          Left: Back to graph | Center: Current graph name | Right: View graph action
          -------------------------------------------------------------------- */}
      <header className="revision-workspace-header" role="banner">
        <div className="revision-header-left">
          <button
            type="button"
            className="revision-header-action revision-back-action"
            onClick={onBackToGraph}
            title="Return to knowledge graph view (Escape)"
            aria-label="Back to graph"
          >
            <span className="revision-arrow" aria-hidden="true">←</span>
            <span>Back to graph</span>
          </button>
        </div>

        <div className="revision-header-center">
          <span className="revision-graph-name" title={resolvedGraphName}>
            {resolvedGraphName}
          </span>
        </div>

        <div className="revision-header-right">
          <button
            type="button"
            className="revision-header-action revision-view-graph-action"
            onClick={handleViewGraph}
            title="View this concept in the interactive knowledge graph"
            aria-label="View graph"
          >
            <span>View graph</span>
            <span className="revision-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      {/* Subtle horizontal hairline divider */}
      <div className="revision-header-divider" aria-hidden="true" />

      {/* --------------------------------------------------------------------
          MAIN CONTENT AREA (Section 2)
          Centered reading column (760–820px max-width, generous margins)
          -------------------------------------------------------------------- */}
      <main className="revision-reading-area" id="revision-content" tabIndex={-1}>
        <div className="revision-reading-column">
          {/* State 1: Loading state */}
          {isLoading && (
            <div className="revision-loading-state" role="status" aria-live="polite">
              <span className="revision-empty-kicker">REVISION SESSION</span>
              <h2 className="revision-empty-title">Loading revision material…</h2>
              <p className="revision-empty-desc">Preparing structured concepts from this knowledge graph.</p>
            </div>
          )}

          {/* State 2: No graph or empty concepts */}
          {!isLoading && (!graph || totalConcepts === 0) && (
            <div className="revision-empty-state" role="status">
              <span className="revision-empty-kicker">REVISION WORKSPACE</span>
              <h2 className="revision-empty-title">
                {!graph ? 'No graph selected' : 'No concepts available for revision'}
              </h2>
              <p className="revision-empty-desc">
                {!graph
                  ? 'Please select a knowledge graph to begin a deep revision session.'
                  : 'This knowledge graph contains no extracted concepts yet. Add materials or create concepts to begin studying.'}
              </p>
              <div className="revision-empty-actions">
                {onSelectGraph && (
                  <button
                    type="button"
                    className="revision-empty-action"
                    onClick={onSelectGraph}
                  >
                    Select knowledge graph
                  </button>
                )}
                <button
                  type="button"
                  className={onSelectGraph ? 'revision-empty-action-secondary' : 'revision-empty-action'}
                  onClick={onBackToGraph}
                >
                  Return to knowledge graph
                </button>
              </div>
            </div>
          )}

          {/* State 3: Active revision concept presentation */}
          {!isLoading && totalConcepts > 0 && currentConcept && (
            <>
              {/* --------------------------------------------------------------
                  REVISION PROGRESS HEADER (Section 3)
                  "REVISION SESSION" on left | "01 / 18" on right | Thin lime-green progress
                  -------------------------------------------------------------- */}
              <div className="revision-progress-header">
                <div className="revision-progress-meta">
                  <span className="revision-progress-kicker">REVISION SESSION</span>
                  <span
                    className="revision-progress-counter"
                    aria-label={`Concept ${currentIndex + 1} of ${totalConcepts}`}
                  >
                    {`${formattedIndex} / ${formattedTotal}`}
                  </span>
                </div>
                <div
                  className="revision-progress-track"
                  role="progressbar"
                  aria-valuenow={currentIndex + 1}
                  aria-valuemin={1}
                  aria-valuemax={totalConcepts}
                  aria-label="Revision session progress"
                >
                  <div
                    className="revision-progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* --------------------------------------------------------------
                  CONCEPT INTRODUCTION (Section 4)
                  Small label "CONCEPT 01" | Large bold title | Short description
                  -------------------------------------------------------------- */}
              <section className="revision-concept-intro" aria-labelledby="revision-concept-title">
                <div className="revision-concept-badge">
                  <span className="revision-concept-badge-dot" aria-hidden="true" />
                  <span className="revision-concept-badge-text">{`CONCEPT ${formattedIndex}`}</span>
                </div>
                <h1 id="revision-concept-title" className="revision-concept-title">
                  {conceptTitle}
                </h1>
                {conceptDescription ? (
                  <p className="revision-concept-description">
                    {conceptDescription}
                  </p>
                ) : null}
              </section>

              {/* --------------------------------------------------------------
                  CONTENT PLACEHOLDER / STRUCTURE (Section 5)
                  Prepared sections:
                  - Understanding the concept
                  - How it works
                  - Important details
                  - Examples
                  - Related concepts
                  - Knowledge checks
                  Only existing concept data is rendered.
                  Unavailable sections are kept hidden until Phase 2 implementation.
                  -------------------------------------------------------------- */}
              <section className="revision-content-structure" aria-label="Concept sections">
                {/* 1. Understanding the concept (Renders real key ideas/evidence if present) */}
                {hasUnderstandingData && (
                  <div className="revision-section revision-section-understanding">
                    <h2 className="revision-section-heading">Understanding the concept</h2>
                    <div className="revision-section-body">
                      {hasExtraKeyIdeas && (
                        <ul className="revision-key-ideas-list" style={{ margin: 0, paddingLeft: '20px' }}>
                          {currentConcept.keyIdeas!.map((idea, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{idea}</li>
                          ))}
                        </ul>
                      )}
                      {hasEvidence && (
                        <p style={{ margin: hasExtraKeyIdeas ? '12px 0 0 0' : 0 }}>
                          {currentConcept.evidence}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. How it works (Phase 2 Slot — hidden when unavailable) */}
                {hasHowItWorksData && (
                  <div className="revision-section revision-section-how-it-works">
                    <h2 className="revision-section-heading">How it works</h2>
                  </div>
                )}

                {/* 3. Important details (Phase 2 Slot — hidden when unavailable) */}
                {hasImportantDetailsData && (
                  <div className="revision-section revision-section-details">
                    <h2 className="revision-section-heading">Important details</h2>
                  </div>
                )}

                {/* 4. Examples (Phase 2 Slot — hidden when unavailable) */}
                {hasExamplesData && (
                  <div className="revision-section revision-section-examples">
                    <h2 className="revision-section-heading">Examples</h2>
                  </div>
                )}

                {/* 5. Related concepts (Renders real relationships from graph) */}
                {hasRelatedConcepts && (
                  <div className="revision-section revision-section-related">
                    <h2 className="revision-section-heading">Related concepts</h2>
                    <div className="revision-related-list">
                      {relatedConcepts.map((rel, idx) => (
                        <div key={rel.id || `${rel.targetId}-${idx}`} className="revision-related-item">
                          <span className="revision-related-relation">
                            {rel.type ? rel.type.replace(/-/g, ' ') : 'Related to'}
                          </span>
                          <span className="revision-related-name">
                            {rel.targetName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Knowledge checks (Phase 2 Slot — hidden when unavailable) */}
                {hasKnowledgeChecksData && (
                  <div className="revision-section revision-section-checks">
                    <h2 className="revision-section-heading">Knowledge checks</h2>
                  </div>
                )}
              </section>

              {/* --------------------------------------------------------------
                  CONCEPT NAVIGATION (Section 6)
                  Text-based navigation | On hover subtle green / underline
                  Disabled on first and last concepts
                  -------------------------------------------------------------- */}
              <nav className="revision-concept-navigation" aria-label="Concept navigation">
                <button
                  type="button"
                  className={`revision-nav-link revision-nav-prev ${isFirst ? 'disabled' : ''}`}
                  onClick={handlePrev}
                  disabled={isFirst}
                  aria-disabled={isFirst}
                  title={isFirst ? undefined : (prevConcept ? `Previous: ${prevConcept.name} (←)` : 'Previous concept (←)')}
                >
                  <span className="revision-nav-arrow" aria-hidden="true">←</span>
                  <span>Previous concept</span>
                </button>

                <button
                  type="button"
                  className={`revision-nav-link revision-nav-next ${isLast ? 'disabled' : ''}`}
                  onClick={handleNext}
                  disabled={isLast}
                  aria-disabled={isLast}
                  title={isLast ? undefined : (nextConcept ? `Next: ${nextConcept.name} (→)` : 'Next concept (→)')}
                >
                  <span>Next concept</span>
                  <span className="revision-nav-arrow" aria-hidden="true">→</span>
                </button>
              </nav>
            </>
          )}

          {/* Missing Concept Fallback */}
          {!isLoading && totalConcepts > 0 && !currentConcept && (
            <div className="revision-empty-state" role="status">
              <span className="revision-empty-kicker">REVISION SESSION</span>
              <h2 className="revision-empty-title">Concept not found</h2>
              <p className="revision-empty-desc">The requested concept could not be located in this revision session.</p>
              <button
                type="button"
                className="revision-empty-action"
                onClick={() => {
                  const resetSession = jumpToIndex(activeSession, 0);
                  setInternalSession(resetSession);
                  if (graph?.id) saveRevisionSession(resetSession, graph.id);
                  onSessionChange?.(resetSession);
                  onSelectConceptIndex?.(0);
                }}
              >
                Return to first concept
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
