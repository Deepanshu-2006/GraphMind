import type { KnowledgeGraph } from '../types/knowledgeGraph';
import type { RevisionSessionState, RevisionPathStep } from '../types/practice';
import {
  loadRevisionSession as loadStoredSession,
  saveRevisionSession as saveStoredSession,
  clearRevisionSession as clearStoredSession
} from './storage';

export interface CreateRevisionSessionParams {
  graphId: string;
  conceptIds: string[];
  currentConceptId?: string | null;
  currentIndex?: number;
  path?: RevisionPathStep[];
  reviewedConceptIds?: string[];
  markedForReviewIds?: string[];
  entryAnimationPlayed?: boolean;
}

/**
 * Creates a clean, deterministic revision session.
 * Stores only stable concept IDs and references without duplicating graph nodes.
 */
export function createRevisionSession({
  graphId,
  conceptIds,
  currentConceptId = null,
  currentIndex = 0,
  path,
  reviewedConceptIds = [],
  markedForReviewIds = [],
  entryAnimationPlayed = false
}: CreateRevisionSessionParams): RevisionSessionState {
  if (!graphId) {
    throw new Error('graphId is required to create a revision session.');
  }

  // Deduplicate and filter concept IDs
  const uniqueConceptIds = Array.from(new Set(conceptIds || [])).filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  );
  const total = uniqueConceptIds.length;

  let initialIndex = 0;
  if (currentConceptId && uniqueConceptIds.includes(currentConceptId)) {
    initialIndex = uniqueConceptIds.indexOf(currentConceptId);
  } else if (typeof currentIndex === 'number' && !isNaN(currentIndex)) {
    initialIndex = total > 0 ? Math.min(Math.max(0, Math.floor(currentIndex)), total - 1) : 0;
  }

  const resolvedConceptId = uniqueConceptIds[initialIndex] || (total > 0 ? uniqueConceptIds[0] : undefined);
  const now = new Date().toISOString();

  return {
    isActive: true,
    graphId,
    conceptIds: uniqueConceptIds,
    currentIndex: initialIndex,
    currentConceptId: resolvedConceptId,
    totalConcepts: total,
    createdAt: now,
    updatedAt: now,
    reviewedConceptIds: [...reviewedConceptIds],
    markedForReviewIds: [...markedForReviewIds],
    path,
    entryAnimationPlayed
  };
}

/**
 * Validates and synchronizes a revision session against a knowledge graph.
 * 
 * Rules:
 * 1. The session must remain strictly associated with the active graph (no cross-graph contamination).
 * 2. Purges any concept IDs that were deleted from the graph.
 * 3. Restores a valid concept index if the current concept was deleted or index is out of bounds.
 * 4. Gracefully recovers if all session concepts were deleted but graph has nodes.
 * 5. Returns null if graph is missing, graph has 0 concepts, or session is malformed.
 * 6. Never throws on invalid JSON or corrupt state.
 */
export function validateRevisionSession(
  session: unknown,
  graph: KnowledgeGraph | null | undefined
): RevisionSessionState | null {
  if (!session || typeof session !== 'object' || !graph || !graph.id) {
    return null;
  }

  const raw = session as Record<string, unknown>;

  // Graph ID must strictly match the active graph
  if (raw.graphId !== graph.id) {
    return null;
  }

  if (!Array.isArray(raw.conceptIds)) {
    return null;
  }

  // Check against active graph nodes
  const graphNodeIds = new Set((graph.nodes || []).map(n => n.id));
  const validConceptIds = raw.conceptIds.filter(
    (id: unknown): id is string => typeof id === 'string' && graphNodeIds.has(id)
  );

  // If no concepts from session remain in graph:
  if (validConceptIds.length === 0) {
    if (graph.nodes && graph.nodes.length > 0) {
      // Gracefully recover: reconstruct session using current graph nodes
      const recoveredIds = graph.nodes.map(n => n.id);
      return createRevisionSession({
        graphId: graph.id,
        conceptIds: recoveredIds,
        currentIndex: 0
      });
    }
    // Graph itself has no concepts
    return null;
  }

  // Determine valid current index
  let validIndex = 0;
  const rawCurrentConceptId = typeof raw.currentConceptId === 'string' ? raw.currentConceptId : undefined;

  if (rawCurrentConceptId && validConceptIds.includes(rawCurrentConceptId)) {
    validIndex = validConceptIds.indexOf(rawCurrentConceptId);
  } else if (typeof raw.currentIndex === 'number' && !isNaN(raw.currentIndex)) {
    validIndex = Math.min(Math.max(0, Math.floor(raw.currentIndex)), validConceptIds.length - 1);
  }

  const currentConceptId = validConceptIds[validIndex];
  const reviewedConceptIds = Array.isArray(raw.reviewedConceptIds)
    ? raw.reviewedConceptIds.filter((id: unknown): id is string => typeof id === 'string' && graphNodeIds.has(id))
    : [];

  const markedForReviewIds = Array.isArray(raw.markedForReviewIds)
    ? raw.markedForReviewIds.filter((id: unknown): id is string => typeof id === 'string' && graphNodeIds.has(id))
    : [];

  return {
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    graphId: graph.id,
    conceptIds: validConceptIds,
    currentIndex: validIndex,
    currentConceptId,
    totalConcepts: validConceptIds.length,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedConceptIds,
    markedForReviewIds,
    path: Array.isArray(raw.path)
      ? (raw.path as RevisionPathStep[]).filter(s => s && graphNodeIds.has(s.conceptId))
      : undefined,
    entryAnimationPlayed: typeof raw.entryAnimationPlayed === 'boolean' ? raw.entryAnimationPlayed : true
  };
}

/**
 * Marks the entry animation as played for a revision session.
 */
export function markEntryAnimationPlayed(session: RevisionSessionState): RevisionSessionState {
  return {
    ...session,
    entryAnimationPlayed: true
  };
}

/**
 * Checks whether backward navigation is allowed.
 * Disabled on the first concept (index <= 0) or single-concept/empty session.
 */
export function canNavigatePrev(session: RevisionSessionState | null | undefined): boolean {
  if (!session || session.totalConcepts <= 1) return false;
  return session.currentIndex > 0;
}

/**
 * Checks whether forward navigation is allowed.
 * Disabled on the final concept (index >= total - 1) or single-concept/empty session.
 */
export function canNavigateNext(session: RevisionSessionState | null | undefined): boolean {
  if (!session || session.totalConcepts <= 1) return false;
  return session.currentIndex < session.totalConcepts - 1;
}

/**
 * Navigates to the next concept in the session.
 * Enforces boundaries: never exceeds session length.
 */
export function navigateNext(session: RevisionSessionState): RevisionSessionState {
  if (!canNavigateNext(session)) return session;

  const nextIndex = Math.min(session.totalConcepts - 1, session.currentIndex + 1);
  const currentConceptId = session.conceptIds[nextIndex];

  // Track the previous concept in reviewedConceptIds if not already present
  const prevConceptId = session.conceptIds[session.currentIndex];
  const nextReviewed = [...session.reviewedConceptIds];
  if (prevConceptId && !nextReviewed.includes(prevConceptId)) {
    nextReviewed.push(prevConceptId);
  }

  return {
    ...session,
    currentIndex: nextIndex,
    currentConceptId,
    reviewedConceptIds: nextReviewed,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Navigates to the previous concept in the session.
 * Enforces boundaries: never becomes negative.
 */
export function navigatePrev(session: RevisionSessionState): RevisionSessionState {
  if (!canNavigatePrev(session)) return session;

  const prevIndex = Math.max(0, session.currentIndex - 1);
  const currentConceptId = session.conceptIds[prevIndex];

  return {
    ...session,
    currentIndex: prevIndex,
    currentConceptId,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Jumps to a specific concept index in the session.
 * Enforces index clamping [0, totalConcepts - 1].
 */
export function jumpToIndex(session: RevisionSessionState, index: number): RevisionSessionState {
  if (session.totalConcepts === 0) return session;
  const clampedIndex = Math.min(Math.max(0, Math.floor(index)), session.totalConcepts - 1);
  const currentConceptId = session.conceptIds[clampedIndex];

  return {
    ...session,
    currentIndex: clampedIndex,
    currentConceptId,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Jumps to a specific concept ID if present in the session.
 */
export function jumpToConceptId(session: RevisionSessionState, conceptId: string): RevisionSessionState {
  const foundIdx = session.conceptIds.indexOf(conceptId);
  if (foundIdx < 0) return session;
  return jumpToIndex(session, foundIdx);
}

/**
 * Deliberately navigates to a concept in the revision session (Task 08).
 * If the concept is already in the session sequence, jumps to its existing position.
 * If not present, appends it without silently mutating past review order.
 */
export function navigateOrAppendToRevisionSession(
  session: RevisionSessionState,
  conceptId: string
): RevisionSessionState {
  const currentDepartingId = session.currentConceptId || session.conceptIds[session.currentIndex];
  const reviewed = currentDepartingId && !session.reviewedConceptIds.includes(currentDepartingId)
    ? [...session.reviewedConceptIds, currentDepartingId]
    : [...session.reviewedConceptIds];

  const existingIdx = session.conceptIds.indexOf(conceptId);
  if (existingIdx >= 0) {
    return {
      ...jumpToIndex(session, existingIdx),
      reviewedConceptIds: reviewed
    };
  }

  const updatedIds = [...session.conceptIds, conceptId];
  return {
    ...session,
    conceptIds: updatedIds,
    totalConcepts: updatedIds.length,
    currentIndex: updatedIds.length - 1,
    currentConceptId: conceptId,
    reviewedConceptIds: reviewed,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Helper to get or initialize an active revision session for a graph.
 */
export function getOrCreateRevisionSession(
  graph: KnowledgeGraph | null | undefined,
  options?: {
    preferredConceptId?: string | null;
    preferredIndex?: number;
    orderedConceptIds?: string[];
    path?: RevisionPathStep[];
  }
): RevisionSessionState | null {
  if (!graph || !graph.id) return null;

  // 1. Try to load existing persisted session
  const stored = loadStoredSession(graph.id);
  const validated = validateRevisionSession(stored, graph);

  if (validated) {
    if (options?.preferredConceptId && validated.conceptIds.includes(options.preferredConceptId)) {
      return jumpToConceptId(validated, options.preferredConceptId);
    }
    if (typeof options?.preferredIndex === 'number' && !isNaN(options.preferredIndex)) {
      return jumpToIndex(validated, options.preferredIndex);
    }
    return validated;
  }

  // 2. Otherwise create a fresh session from graph nodes
  const sourceNodes = graph.nodes || [];
  if (sourceNodes.length === 0) return null;

  const conceptIds = options?.orderedConceptIds && options.orderedConceptIds.length > 0
    ? options.orderedConceptIds.filter(id => sourceNodes.some(n => n.id === id))
    : sourceNodes.map(n => n.id);

  if (conceptIds.length === 0) return null;

  const newSession = createRevisionSession({
    graphId: graph.id,
    conceptIds,
    currentConceptId: options?.preferredConceptId || null,
    currentIndex: options?.preferredIndex ?? 0,
    path: options?.path
  });

  saveStoredSession(newSession, graph.id);
  return newSession;
}

export {
  loadStoredSession as loadRevisionSession,
  saveStoredSession as saveRevisionSession,
  clearStoredSession as clearRevisionSession
};
