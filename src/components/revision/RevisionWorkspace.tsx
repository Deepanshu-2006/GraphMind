import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { GraphConceptData, ConceptRelationship } from '../../types/graph';
import type { RevisionPathStep, RevisionSessionState } from '../../types/practice';
import type { ExplanationState } from '../../types/explanation';
import {
  createRevisionSession,
  validateRevisionSession,
  loadRevisionSession,
  saveRevisionSession,
  jumpToIndex,
  jumpToConceptId
} from '../../services/revisionSession';
import {
  getOrGenerateConceptExplanation,
  loadStoredExplanation,
  extractConceptSourceContext,
  synthesizeGroundedExplanation
} from '../../services/conceptExplanation';

export const WORKSPACE_EASING = [0.16, 1, 0.3, 1] as const;

/**
 * Stage 1: Workspace Arrival (Section 1)
 * The main reading area transitions from a slightly displaced position into its final position.
 * Subtle opacity transition without large scaling.
 */
export const createWorkspaceArrivalVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 12
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.32,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 2: Session Metadata (Section 1)
 * Reveal the revision label and progress indicator with a small, restrained delay.
 */
export const createSessionMetadataVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.28,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.08,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3A: Concept Identifier / Badge (Section 1)
 * Reveal the concept identifier first.
 */
export const createConceptBadgeVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 6
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.24,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.14,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3B: Concept Title (Section 1)
 * The concept title should receive the most visual attention with a deliberate reveal.
 */
export const createConceptTitleVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 10
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.36,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.20,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3C: Concept Description & Content Sections (Section 1)
 * Reveal concept description and learning sections after the title.
 */
export const createConceptDescriptionVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.30,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.28,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 4: Navigation (Section 1)
 * Reveal previous/next navigation after the main content has settled.
 */
export const createNavigationVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 6
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.26,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.36,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Full Workspace Root Backdrop Transition
 */
export const createWorkspaceRootVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0
  },
  settled: {
    opacity: 1,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.28,
      ease: WORKSPACE_EASING
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.2,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Direction-Aware Concept-to-Concept Transitions (Section 3)
 * Moving forward (Next): Content enters from +14px, exits to -14px.
 * Moving backward (Previous): Content enters from -14px, exits to +14px.
 */
export const createConceptCanvasVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.32,
      ease: WORKSPACE_EASING
    }
  },
  enter: (dir: number) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : (dir >= 0 ? 14 : -14),
    transition: {
      duration: shouldReduceMotion ? 0 : 0.22,
      ease: WORKSPACE_EASING
    }
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.24,
      ease: WORKSPACE_EASING
    }
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : (dir >= 0 ? -14 : 14),
    transition: {
      duration: shouldReduceMotion ? 0 : 0.16,
      ease: WORKSPACE_EASING
    }
  })
});

/**
 * Safely parses inline markdown tokens (bold, italic, code, math) into React nodes.
 * Zero use of dangerouslySetInnerHTML to guarantee safety against injection.
 */
export function parseInlineMarkup(text: string): React.ReactNode {
  if (!text) return null;

  // Match: bold (**...**), italic (*...*), inline code (`...`), math ($...$)
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[^$]+\$)/g;
  const parts = text.split(tokenRegex);

  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="revision-inline-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index} className="revision-inline-italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={index} className="revision-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      return <span key={index} className="revision-math-token">{part.slice(1, -1)}</span>;
    }
    return part;
  });
}

/**
 * Editorial formatted content renderer (Section 4).
 * Supports paragraphs, ordered lists, unordered lists, tables, and code blocks safely.
 */
export function EditorialFormattedContent({ content }: { content: string }) {
  if (!content) return null;

  const trimmed = content.trim();

  // 1. Markdown Table syntax check: lines containing pipes and a separator |---|
  const lines = trimmed.split(/\r?\n/);
  const tableSepIdx = lines.findIndex(l => /^\s*\|?\s*:?-+:?\s*\|/.test(l));
  if (tableSepIdx > 0 && lines.length >= 3) {
    const rawHeader = lines[tableSepIdx - 1];
    const headers = rawHeader.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - (rawHeader.trim().endsWith('|') ? 1 : 0));
    const dataLines = lines.slice(tableSepIdx + 1).filter(l => l.includes('|'));
    const rows = dataLines.map(l => l.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - (l.trim().endsWith('|') ? 1 : 0)));

    if (headers.length > 0 && rows.length > 0) {
      return (
        <div className="revision-table-wrapper" tabIndex={0} role="region" aria-label="Comparison Table">
          <table className="revision-editorial-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{parseInlineMarkup(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{parseInlineMarkup(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // 2. Fenced code block check: ```lang ... ```
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const firstLineEnd = trimmed.indexOf('\n');
    const lang = firstLineEnd > 3 ? trimmed.slice(3, firstLineEnd).trim() : '';
    const code = firstLineEnd > 3 ? trimmed.slice(firstLineEnd + 1, -3).trim() : trimmed.slice(3, -3).trim();
    return (
      <div className="revision-code-block-wrapper">
        {lang && <span className="revision-code-caption">{lang}</span>}
        <pre className="revision-code-block">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  // 3. Ordered list: all lines start with 1. 2. etc.
  if (lines.length > 1 && lines.every(l => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol className="revision-ordered-list">
        {lines.map((l, idx) => (
          <li key={idx}>
            {parseInlineMarkup(l.replace(/^\s*\d+\.\s+/, ''))}
          </li>
        ))}
      </ol>
    );
  }

  // 4. Unordered list: all lines start with - or * or •
  if (lines.length > 1 && lines.every(l => /^\s*[-*•]\s+/.test(l))) {
    return (
      <ul className="revision-unordered-list">
        {lines.map((l, idx) => (
          <li key={idx}>
            {parseInlineMarkup(l.replace(/^\s*[-*•]\s+/, ''))}
          </li>
        ))}
      </ul>
    );
  }

  // 5. Multi-line text with breaks
  if (lines.length > 1) {
    return (
      <>
        {lines.map((l, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {parseInlineMarkup(l)}
          </React.Fragment>
        ))}
      </>
    );
  }

  return <>{parseInlineMarkup(trimmed)}</>;
}

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
  isNewSession?: boolean;
  skipEntryAnimation?: boolean;
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
  isLoading = false,
  isNewSession: _isNewSession = false,
  skipEntryAnimation = false
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
    const effectiveRels = (graph?.relationships && graph.relationships.length > 0) ? graph.relationships : allEdges;
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

  // Reduced motion preference (Section 7)
  const shouldReduceMotion = useReducedMotion() ?? false;

  // Direction tracking for Section 3 concept transitions: 1 = forward (Next), -1 = backward (Previous)
  const [direction, setDirection] = useState<number>(1);
  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (currentIndex > prevIndexRef.current) {
      setDirection(1);
    } else if (currentIndex < prevIndexRef.current) {
      setDirection(-1);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Session entry animation tracking (Section 4: Avoid replaying everything)
  const [hasPlayedEntry, setHasPlayedEntry] = useState<boolean>(() => Boolean(skipEntryAnimation));

  useEffect(() => {
    if (skipEntryAnimation) {
      setHasPlayedEntry(true);
      return;
    }
    // Allow entry animation sequence (Stage 1-4, up to ~450ms) to complete smoothly
    const timer = setTimeout(() => {
      setHasPlayedEntry(true);
      if (activeSession && !activeSession.entryAnimationPlayed) {
        const updated = { ...activeSession, entryAnimationPlayed: true };
        setInternalSession(updated);
        if (graph?.id) saveRevisionSession(updated, graph.id);
        onSessionChange?.(updated);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [skipEntryAnimation, graph?.id, activeSession, onSessionChange]);

  // Framer Motion variants memoized to prevent re-creation on ordinary renders
  const workspaceRootVariants = useMemo(
    () => createWorkspaceRootVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const workspaceArrivalVariants = useMemo(
    () => createWorkspaceArrivalVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const sessionMetadataVariants = useMemo(
    () => createSessionMetadataVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptBadgeVariants = useMemo(
    () => createConceptBadgeVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptTitleVariants = useMemo(
    () => createConceptTitleVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptDescriptionVariants = useMemo(
    () => createConceptDescriptionVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const navigationVariants = useMemo(
    () => createNavigationVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptCanvasVariants = useMemo(
    () => createConceptCanvasVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  // Concept navigation step handlers
  const handlePrev = useCallback(() => {
    if (isFirst) return;
    setDirection(-1);
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
    setDirection(1);
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

  // Concept explanation lifecycle state (Phase 2 Task 05)
  const [explanationState, setExplanationState] = useState<ExplanationState>(() => {
    if (!graph || !currentConcept) return { status: 'empty' };
    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = currentConcept.id;
    const cached = loadStoredExplanation(currentGraphId, targetConceptId);
    if (cached) {
      return {
        status: 'ready',
        explanation: cached,
        conceptId: targetConceptId,
        graphId: currentGraphId
      };
    }
    const ctx = extractConceptSourceContext(graph, targetConceptId);
    if (ctx.status === 'insufficient') {
      return {
        status: 'insufficient',
        conceptId: targetConceptId,
        graphId: currentGraphId,
        insufficientReason: ctx.reason
      };
    }
    if (ctx.status === 'empty') {
      return { status: 'empty', conceptId: targetConceptId, graphId: currentGraphId };
    }
    const synthesized = synthesizeGroundedExplanation(ctx.context);
    return {
      status: 'ready',
      explanation: synthesized,
      conceptId: targetConceptId,
      graphId: currentGraphId
    };
  });
  const explanationAbortRef = useRef<AbortController | null>(null);

  // Sync explanation when current concept or graph changes
  useEffect(() => {
    if (!graph || !currentConcept) {
      setExplanationState({ status: 'empty' });
      return;
    }

    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = currentConcept.id;

    // Check persistent cache first for instant retrieval
    const cached = loadStoredExplanation(currentGraphId, targetConceptId);
    if (cached) {
      setExplanationState({
        status: 'ready',
        explanation: cached,
        conceptId: targetConceptId,
        graphId: currentGraphId
      });
      return;
    }

    // Cancel any previous in-flight request so navigation is never blocked
    if (explanationAbortRef.current) {
      explanationAbortRef.current.abort();
    }
    const controller = new AbortController();
    explanationAbortRef.current = controller;

    setExplanationState({
      status: 'loading',
      conceptId: targetConceptId,
      graphId: currentGraphId
    });

    getOrGenerateConceptExplanation({
      graph,
      conceptId: targetConceptId,
      signal: controller.signal
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setExplanationState(res);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setExplanationState({
            status: 'error',
            errorMessage: err?.message || 'Failed to load concept explanation.',
            conceptId: targetConceptId,
            graphId: currentGraphId
          });
        }
      });

    return () => {
      controller.abort();
    };
  }, [graph, currentConcept?.id]);

  const handleRetryExplanation = useCallback(() => {
    if (!graph || !currentConcept) return;
    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = currentConcept.id;

    if (explanationAbortRef.current) {
      explanationAbortRef.current.abort();
    }
    const controller = new AbortController();
    explanationAbortRef.current = controller;

    setExplanationState({
      status: 'loading',
      conceptId: targetConceptId,
      graphId: currentGraphId
    });

    getOrGenerateConceptExplanation({
      graph,
      conceptId: targetConceptId,
      forceRegenerate: true,
      signal: controller.signal
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setExplanationState(res);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setExplanationState({
            status: 'error',
            errorMessage: err?.message || 'Failed to generate concept explanation.',
            conceptId: targetConceptId,
            graphId: currentGraphId
          });
        }
      });
  }, [graph, currentConcept]);

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

  const workspaceRootRef = useRef<HTMLDivElement | null>(null);

  // Preserve scroll position across explanation loading; reset only on concept change
  useEffect(() => {
    if (workspaceRootRef.current) {
      workspaceRootRef.current.scrollTop = 0;
    }
  }, [currentConcept?.id]);

  // Active sections computation for Section Navigation (Task 06)
  const activeSections = useMemo(() => {
    if (explanationState.status !== 'ready' || !explanationState.explanation) {
      return [];
    }
    const exp = explanationState.explanation;
    const list: Array<{ id: string; num: string; label: string }> = [];
    let counter = 1;

    // 01. Understand
    if (exp.overview || hasUnderstandingData) {
      list.push({ id: 'section-understanding', num: String(counter++).padStart(2, '0'), label: 'Understand' });
    }
    // 02. How it works
    if (exp.howItWorks && exp.howItWorks.length > 0) {
      list.push({ id: 'section-how-it-works', num: String(counter++).padStart(2, '0'), label: 'How it works' });
    }
    // 03. Key components / terminology
    if ((exp.keyComponents && exp.keyComponents.length > 0) || (exp.keyTerminology && exp.keyTerminology.length > 0) || exp.comparisonTable) {
      const isTerminology = Boolean(exp.keyTerminology && exp.keyTerminology.length > 0);
      list.push({
        id: 'section-key-components',
        num: String(counter++).padStart(2, '0'),
        label: isTerminology ? 'Terminology' : 'Components'
      });
    }
    // 04. Important details / points
    if ((exp.importantDetails && exp.importantDetails.length > 0) || (exp.importantPoints && exp.importantPoints.length > 0)) {
      const isPoints = Boolean(exp.importantPoints && exp.importantPoints.length > 0 && (!exp.importantDetails || exp.importantDetails.length === 0));
      list.push({
        id: 'section-important-details',
        num: String(counter++).padStart(2, '0'),
        label: isPoints ? 'Points' : 'Details'
      });
    }
    // 05. Examples
    if (exp.examples && exp.examples.length > 0) {
      list.push({ id: 'section-examples', num: String(counter++).padStart(2, '0'), label: 'Example' });
    }
    // 06. Related concepts
    if ((exp.relatedConceptReferences && exp.relatedConceptReferences.length > 0) || hasRelatedConcepts) {
      list.push({ id: 'section-related-concepts', num: String(counter++).padStart(2, '0'), label: 'Related' });
    }
    // 07. Source references
    if (exp.sourceReferences && exp.sourceReferences.length > 0) {
      list.push({ id: 'section-sources', num: String(counter++).padStart(2, '0'), label: 'Sources' });
    }

    return list;
  }, [explanationState, hasUnderstandingData, hasRelatedConcepts]);

  const getSecNum = (id: string) => activeSections.find(s => s.id === id)?.num || '01';

  return (
    <motion.div
      ref={workspaceRootRef}
      className="revision-workspace-root"
      role="region"
      aria-label="GraphMind Dedicated Revision Workspace"
      variants={workspaceRootVariants}
      initial={hasPlayedEntry ? "settled" : "hidden"}
      animate="settled"
      exit="exit"
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
        <motion.div
          className="revision-reading-column"
          variants={workspaceArrivalVariants}
          initial={hasPlayedEntry ? "settled" : "hidden"}
          animate="settled"
        >
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
                  REVISION PROGRESS HEADER (Stage 2: Session Metadata)
                  "REVISION SESSION" on left | "01 / 18" on right | Thin lime-green progress
                  -------------------------------------------------------------- */}
              <motion.div
                className="revision-progress-header"
                variants={sessionMetadataVariants}
                initial={hasPlayedEntry ? "settled" : "hidden"}
                animate="settled"
              >
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
                  <motion.div
                    className="revision-progress-fill"
                    initial={false}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.3,
                      ease: WORKSPACE_EASING
                    }}
                  />
                </div>
              </motion.div>

              {/* --------------------------------------------------------------
                  DIRECTION-AWARE CONCEPT CANVAS (Stage 3 & Concept Transitions)
                  Forward: enters from +14px, exits to -14px
                  Backward: enters from -14px, exits to +14px
                  -------------------------------------------------------------- */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentConcept.id}
                  custom={direction}
                  variants={conceptCanvasVariants}
                  initial={hasPlayedEntry ? "enter" : "hidden"}
                  animate={hasPlayedEntry ? "center" : "settled"}
                  exit="exit"
                  className="revision-concept-canvas"
                >
                  {/* Concept Introduction (Stage 3: Identifier -> Title -> Description) */}
                  <section className="revision-concept-intro" aria-labelledby="revision-concept-title">
                    <motion.div
                      className="revision-concept-badge"
                      variants={conceptBadgeVariants}
                      initial={hasPlayedEntry ? "settled" : "hidden"}
                      animate="settled"
                    >
                      <span className="revision-concept-badge-dot" aria-hidden="true" />
                      <span className="revision-concept-badge-text">{`CONCEPT ${formattedIndex}`}</span>
                    </motion.div>
                    <motion.h1
                      id="revision-concept-title"
                      className="revision-concept-title"
                      variants={conceptTitleVariants}
                      initial={hasPlayedEntry ? "settled" : "hidden"}
                      animate="settled"
                    >
                      {conceptTitle}
                    </motion.h1>
                    {conceptDescription ? (
                      <motion.p
                        className="revision-concept-description"
                        variants={conceptDescriptionVariants}
                        initial={hasPlayedEntry ? "settled" : "hidden"}
                        animate="settled"
                      >
                        {conceptDescription}
                      </motion.p>
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
                  <motion.section
                    className="revision-content-structure"
                    aria-label="Concept sections"
                    variants={conceptDescriptionVariants}
                    initial={hasPlayedEntry ? "settled" : "hidden"}
                    animate="settled"
                  >
                    {/* State A: In-flight loading state */}
                    {explanationState.status === 'loading' && (
                      <div className="revision-section revision-section-loading" role="status" aria-live="polite">
                        <h2 className="revision-section-heading">Understanding the concept</h2>
                        <div className="revision-explanation-loading">
                          <div className="revision-skeleton-line" />
                          <div className="revision-skeleton-line medium" />
                          <div className="revision-skeleton-line short" />
                        </div>
                      </div>
                    )}

                    {/* State C: Insufficient source material */}
                    {explanationState.status === 'insufficient' && (
                      <div className="revision-section revision-section-insufficient">
                        <div className="revision-insufficient-card" role="region" aria-label="Source Grounding Notice">
                          <span className="revision-insufficient-kicker">SOURCE GROUNDING / INSUFFICIENT MATERIAL</span>
                          <h3 className="revision-insufficient-title">Detailed explanation unavailable</h3>
                          <p className="revision-insufficient-desc">
                            {explanationState.insufficientReason ||
                              `The learning materials associated with this knowledge graph do not contain enough documented passages or evidence for "${conceptTitle}". GraphMind avoids generating speculative explanations to ensure academic integrity.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* State D: Generation failure with retry */}
                    {explanationState.status === 'error' && (
                      <div className="revision-section revision-section-error">
                        <div className="revision-error-card" role="alert">
                          <p className="revision-error-text">
                            {explanationState.errorMessage || 'Unable to load or generate explanation for this concept.'}
                          </p>
                          <button
                            type="button"
                            className="revision-retry-action"
                            onClick={handleRetryExplanation}
                          >
                            Retry generation
                          </button>
                        </div>
                      </div>
                    )}

                    {/* State B: Explanation ready */}
                    {explanationState.status === 'ready' && explanationState.explanation && (
                      <>
                        {/* Compact Unobtrusive Section Jump Navigation (Task 06 Section 5) */}
                        {activeSections.length >= 2 && (
                          <nav className="revision-section-nav" aria-label="Section navigation">
                            <div className="revision-section-nav-inner">
                              <span className="revision-section-nav-kicker">SECTIONS</span>
                              <div className="revision-section-nav-items">
                                {activeSections.map((sec) => (
                                  <a
                                    key={sec.id}
                                    href={`#${sec.id}`}
                                    className="revision-section-nav-item"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const el = document.getElementById(sec.id);
                                      if (el) {
                                        el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
                                      }
                                    }}
                                  >
                                    <span className="revision-nav-num">{sec.num}</span>
                                    <span className="revision-nav-label">{sec.label}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </nav>
                        )}

                        {/* 01. Understanding the concept (Overview + Elaboration) */}
                        <div className="revision-section revision-section-understanding" id="section-understanding">
                          <h2 className="revision-section-heading">
                            <span className="revision-section-num">{getSecNum('section-understanding')}</span>
                            <span>Understanding the concept</span>
                          </h2>
                          <div className="revision-section-body">
                            {explanationState.explanation.overview && (
                              <p className="revision-explanation-lead">
                                <EditorialFormattedContent content={explanationState.explanation.overview} />
                              </p>
                            )}
                            {(!explanationState.explanation.howItWorks || explanationState.explanation.howItWorks.length === 0) &&
                              explanationState.explanation.detailedExplanation && explanationState.explanation.detailedExplanation.length > 0 && (
                              <div className="revision-explanation-paragraphs">
                                {explanationState.explanation.detailedExplanation.map((paragraph, idx) => (
                                  <p key={idx} className="revision-explanation-paragraph">
                                    <EditorialFormattedContent content={paragraph} />
                                  </p>
                                ))}
                              </div>
                            )}
                            {hasExtraKeyIdeas && (
                              <ul className="revision-key-ideas-list" style={{ margin: (explanationState.explanation.overview ? '16px 0 0 0' : 0), paddingLeft: '20px' }}>
                                {currentConcept.keyIdeas!.map((idea, idx) => (
                                  <li key={idx} style={{ marginBottom: '6px' }}>
                                    <EditorialFormattedContent content={idea} />
                                  </li>
                                ))}
                              </ul>
                            )}
                            {hasEvidence && (
                              <p style={{ margin: (hasExtraKeyIdeas || explanationState.explanation.overview) ? '12px 0 0 0' : 0 }}>
                                <EditorialFormattedContent content={currentConcept.evidence!} />
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 02. How it works (when operational mechanism or steps exist) */}
                        {explanationState.explanation.howItWorks && explanationState.explanation.howItWorks.length > 0 && (
                          <div className="revision-section revision-section-how-it-works" id="section-how-it-works">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-how-it-works')}</span>
                              <span>How it works</span>
                            </h2>
                            <div className="revision-section-body">
                              <div className="revision-how-it-works-list">
                                {explanationState.explanation.howItWorks.map((step, idx) => (
                                  <div key={idx} className="revision-how-it-works-step">
                                    <span className="revision-step-marker">{String(idx + 1).padStart(2, '0')}</span>
                                    <div className="revision-step-content">
                                      <EditorialFormattedContent content={step} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {explanationState.explanation.codeSnippet && (
                                <div className="revision-code-snippet-box">
                                  {explanationState.explanation.codeSnippet.caption && (
                                    <span className="revision-code-caption">{explanationState.explanation.codeSnippet.caption}</span>
                                  )}
                                  <pre className="revision-code-block">
                                    <code>{explanationState.explanation.codeSnippet.code}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 03. Key Components / Key Terminology */}
                        {((explanationState.explanation.keyComponents && explanationState.explanation.keyComponents.length > 0) ||
                          (explanationState.explanation.keyTerminology && explanationState.explanation.keyTerminology.length > 0) ||
                          explanationState.explanation.comparisonTable) && (
                          <div className="revision-section revision-section-terminology" id="section-key-components">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-key-components')}</span>
                              <span>
                                {explanationState.explanation.keyTerminology && explanationState.explanation.keyTerminology.length > 0
                                  ? 'Key Terminology'
                                  : 'Key components'}
                              </span>
                            </h2>
                            <div className="revision-section-body">
                              {explanationState.explanation.keyComponents && explanationState.explanation.keyComponents.length > 0 && (
                                <div className="revision-components-grid">
                                  {explanationState.explanation.keyComponents.map((comp, idx) => (
                                    <div key={idx} className="revision-component-card">
                                      <div className="revision-component-header">
                                        <span className="revision-component-name">{comp.name}</span>
                                        {comp.role && <span className="revision-component-role">{comp.role}</span>}
                                      </div>
                                      <p className="revision-component-desc">
                                        <EditorialFormattedContent content={comp.description} />
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {explanationState.explanation.keyTerminology && explanationState.explanation.keyTerminology.length > 0 && (
                                <div className="revision-terms-list">
                                  {explanationState.explanation.keyTerminology.map((item, idx) => (
                                    <div key={idx} className="revision-term-item">
                                      <span className="revision-term-name">{item.term}</span>
                                      <p className="revision-term-def">
                                        <EditorialFormattedContent content={item.definition} />
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {explanationState.explanation.comparisonTable && (
                                <div className="revision-table-wrapper" tabIndex={0} role="region" aria-label="Comparison Table">
                                  {explanationState.explanation.comparisonTable.caption && (
                                    <span className="revision-table-caption">{explanationState.explanation.comparisonTable.caption}</span>
                                  )}
                                  <table className="revision-editorial-table">
                                    <thead>
                                      <tr>
                                        {explanationState.explanation.comparisonTable.headers.map((h, i) => (
                                          <th key={i}>{parseInlineMarkup(h)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {explanationState.explanation.comparisonTable.rows.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                          {row.map((cell, cIdx) => (
                                            <td key={cIdx}>{parseInlineMarkup(cell)}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 04. Important Details / Important Points */}
                        {((explanationState.explanation.importantDetails && explanationState.explanation.importantDetails.length > 0) ||
                          (explanationState.explanation.importantPoints && explanationState.explanation.importantPoints.length > 0)) && (
                          <div className="revision-section revision-section-points" id="section-important-details">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-important-details')}</span>
                              <span>
                                {explanationState.explanation.importantDetails && explanationState.explanation.importantDetails.length > 0
                                  ? 'Important details'
                                  : 'Important Points'}
                              </span>
                            </h2>
                            <ul className="revision-points-list">
                              {(explanationState.explanation.importantDetails || explanationState.explanation.importantPoints!).map((point, idx) => (
                                <li key={idx} className="revision-point-item">
                                  <span className="revision-point-bullet" aria-hidden="true" />
                                  <span><EditorialFormattedContent content={point} /></span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 05. Examples (if present and supported) */}
                        {explanationState.explanation.examples && explanationState.explanation.examples.length > 0 && (
                          <div className="revision-section revision-section-examples" id="section-examples">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-examples')}</span>
                              <span>Examples</span>
                            </h2>
                            <div className="revision-example-box">
                              {explanationState.explanation.examples.map((ex, idx) => (
                                <div key={idx} style={{ marginTop: idx === 0 ? 0 : '8px' }}>
                                  <EditorialFormattedContent content={ex} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 06. Related Concepts */}
                        {((explanationState.explanation.relatedConceptReferences && explanationState.explanation.relatedConceptReferences.length > 0) || hasRelatedConcepts) && (
                          <div className="revision-section revision-section-related" id="section-related-concepts">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-related-concepts')}</span>
                              <span>Related concepts</span>
                            </h2>
                            <div className="revision-related-list">
                              {explanationState.explanation.relatedConceptReferences && explanationState.explanation.relatedConceptReferences.length > 0
                                ? explanationState.explanation.relatedConceptReferences.map((rel, idx) => (
                                    <div key={rel.conceptId || idx} className="revision-related-item">
                                      <span className="revision-related-relation">
                                        {rel.relationshipType ? rel.relationshipType.replace(/-/g, ' ') : 'Related to'}
                                      </span>
                                      <span className="revision-related-name">
                                        {rel.conceptName}
                                      </span>
                                    </div>
                                  ))
                                : relatedConcepts.map((rel, idx) => (
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

                        {/* 07. Source References */}
                        {explanationState.explanation.sourceReferences && explanationState.explanation.sourceReferences.length > 0 && (
                          <div className="revision-section revision-section-sources" id="section-sources">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-sources')}</span>
                              <span>Source References</span>
                            </h2>
                            <div className="revision-sources-container">
                              {explanationState.explanation.sourceReferences.map((ref, idx) => (
                                <div key={idx} className="revision-source-card">
                                  <div className="revision-source-card-header">
                                    <span className="revision-source-title">{ref.sourceTitle}</span>
                                    <span className="revision-source-badge">
                                      {ref.page ? `PAGE ${ref.page} • SOURCE GROUNDED` : 'SOURCE GROUNDED'}
                                    </span>
                                  </div>
                                  {ref.excerpt && (
                                    <blockquote className="revision-source-quote">
                                      "{ref.excerpt}"
                                    </blockquote>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Fallback when explanation state is idle or empty */}
                    {(explanationState.status === 'idle' || explanationState.status === 'empty') && (
                      <>
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
                      </>
                    )}
                  </motion.section>
                </motion.div>
              </AnimatePresence>

              {/* --------------------------------------------------------------
                  CONCEPT NAVIGATION (Stage 4: Navigation Reveal)
                  Text-based navigation | On hover subtle green / underline
                  Disabled on first and last concepts
                  -------------------------------------------------------------- */}
              <motion.nav
                className="revision-concept-navigation"
                aria-label="Concept navigation"
                variants={navigationVariants}
                initial={hasPlayedEntry ? "settled" : "hidden"}
                animate="settled"
              >
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
              </motion.nav>
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
        </motion.div>
      </main>
    </motion.div>
  );
};
