import type { KnowledgeSource, KnowledgeGraph, KnowledgeGraphMeta } from '../types/knowledgeGraph';
import type { ConceptPracticeState, PracticeStatus } from '../types/practice';
import type {
  KnowledgeTest,
  TestResultsSummary,
  MissedConceptItem,
  AssessmentAttempt,
  AssessmentCompletionReason
} from '../types/test';
import {
  saveAssessmentAttempt,
  ASSESSMENT_HISTORY_STORAGE_KEY
} from './assessmentHistory';
import { getCurrentUserId } from './auth';

export const DEFAULT_MIGRATION_GRAPH_ID = 'graph-neural-cognitive-default';
export const DEFAULT_MIGRATION_GRAPH_NAME = 'Neural & Cognitive Architectures';

const STORAGE_KEYS = {
  GRAPHS: 'graphmind_graphs_v1',
  ACTIVE_GRAPH_ID: 'graphmind_active_graph_id_v1',
  GRAPH_DATA_PREFIX: 'graphmind_graph_data_v1_',
  COMPLETED_CONCEPTS_PREFIX: 'graphmind_completed_concepts_v1_',
  PRACTICE_STATE_PREFIX: 'graphmind_practice_state_v1_',
  GRAPH_SOURCE_TYPE_PREFIX: 'graphmind_graph_source_type_v1_',
  TEST_HISTORY_PREFIX: 'graphmind_test_history_v1_',
  ASSESSMENT_ATTEMPTS: ASSESSMENT_HISTORY_STORAGE_KEY,
  // Canonical user sources collection (contains sources for all graphs, keyed by graphId)
  USER_SOURCES: 'graphmind_user_sources_v1',
  // Legacy keys for backward compatibility and migration
  LEGACY_USER_GRAPH: 'graphmind_user_graph_v1',
  LEGACY_GRAPH_SOURCE_TYPE: 'graphmind_graph_source_type_v1',
  LEGACY_USER_COMPLETED_CONCEPTS: 'graphmind_user_completed_concepts_v1',
} as const;

// Known mock/demo fixture IDs to never treat as user sources
const DEMO_FIXTURE_IDS = new Set([
  'src-stanford-cs229',
  'src-lecture-04',
  'src-mit-6s191',
  'src-stanford-cs231n',
  'src-stanford-cs224n',
  'src-bahdanau-2014',
  'rm-1',
  'rm-2',
  'rm-3',
  'rm-4',
  'rm-5'
]);

/**
 * Ensures legacy data is migrated into the initial default graph.
 * Preserves user's current work without duplication.
 */
export function migrateExistingDataIfNeeded(): KnowledgeGraphMeta[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const rawGraphs = localStorage.getItem(STORAGE_KEYS.GRAPHS);
    // If graphs key already exists (even if empty array), do not re-migrate
    if (rawGraphs !== null) {
      const parsed = JSON.parse(rawGraphs);
      if (Array.isArray(parsed)) return parsed as KnowledgeGraphMeta[];
    }

    // First time or legacy data present: construct default migration graph
    const defaultGraph: KnowledgeGraphMeta = {
      id: DEFAULT_MIGRATION_GRAPH_ID,
      name: DEFAULT_MIGRATION_GRAPH_NAME,
      description: 'Neural & Cognitive Architectures knowledge graph',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Migrate legacy sources if present without graphId
    const rawSources = localStorage.getItem(STORAGE_KEYS.USER_SOURCES);
    if (rawSources) {
      try {
        const parsedSources = JSON.parse(rawSources);
        if (Array.isArray(parsedSources)) {
          const migratedSources = parsedSources.map((s: KnowledgeSource) => ({
            ...s,
            graphId: s.graphId || DEFAULT_MIGRATION_GRAPH_ID
          }));
          localStorage.setItem(STORAGE_KEYS.USER_SOURCES, JSON.stringify(migratedSources));
        }
      } catch (e) {
        console.warn('[Storage] Error migrating legacy sources:', e);
      }
    }

    // Migrate legacy graph if present
    const rawLegacyGraph = localStorage.getItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
    if (rawLegacyGraph) {
      try {
        const parsedGraph = JSON.parse(rawLegacyGraph) as KnowledgeGraph;
        if (parsedGraph && Array.isArray(parsedGraph.nodes)) {
          const migratedGraph: KnowledgeGraph = {
            ...parsedGraph,
            id: DEFAULT_MIGRATION_GRAPH_ID,
            name: DEFAULT_MIGRATION_GRAPH_NAME,
            nodes: (parsedGraph.nodes || []).map(n => ({ ...n, graphId: n.graphId || DEFAULT_MIGRATION_GRAPH_ID })),
            relationships: (parsedGraph.relationships || []).map(r => ({ ...r, graphId: r.graphId || DEFAULT_MIGRATION_GRAPH_ID })),
            sources: (parsedGraph.sources || []).map(s => ({ ...s, graphId: s.graphId || DEFAULT_MIGRATION_GRAPH_ID }))
          };
          localStorage.setItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + DEFAULT_MIGRATION_GRAPH_ID, JSON.stringify(migratedGraph));
        }
      } catch (e) {
        console.warn('[Storage] Error migrating legacy graph:', e);
      }
    }

    // Migrate legacy completed concepts
    const rawCompleted = localStorage.getItem(STORAGE_KEYS.LEGACY_USER_COMPLETED_CONCEPTS);
    if (rawCompleted) {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_CONCEPTS_PREFIX + DEFAULT_MIGRATION_GRAPH_ID, rawCompleted);
    }

    // Persist default graph list and active graph
    const initialGraphs = [defaultGraph];
    localStorage.setItem(STORAGE_KEYS.GRAPHS, JSON.stringify(initialGraphs));
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_GRAPH_ID)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_GRAPH_ID, DEFAULT_MIGRATION_GRAPH_ID);
    }

    return initialGraphs;
  } catch (err) {
    console.warn('[Storage] Migration failed:', err);
    return [];
  }
}

/**
 * Load all knowledge graphs/workspaces from persistence
 */
export function loadGraphs(): KnowledgeGraphMeta[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GRAPHS);
    if (raw === null) {
      return migrateExistingDataIfNeeded();
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      let hasMutated = false;
      const healed = (parsed as KnowledgeGraphMeta[]).map(g => {
        // Auto-heal graphs where description was a default/previous "... knowledge graph" that drifted from graph name
        if (g.description && g.description.toLowerCase().endsWith('knowledge graph') && g.description !== `${g.name} knowledge graph`) {
          hasMutated = true;
          return { ...g, description: `${g.name} knowledge graph` };
        }
        return g;
      });
      if (hasMutated) {
        saveGraphs(healed);
      }
      return healed;
    }
    return [];
  } catch (err) {
    console.warn('[Storage] Failed to read graphs:', err);
    return [];
  }
}

/**
 * Save knowledge graphs list to persistence
 */
export function saveGraphs(graphs: KnowledgeGraphMeta[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.GRAPHS, JSON.stringify(graphs));
  } catch (err) {
    console.warn('[Storage] Failed to persist graphs:', err);
  }
}

/**
 * Load active graph ID from persistence
 */
export function loadActiveGraphId(): string | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
    const graphs = loadGraphs();
    if (graphs.length === 0) return null;

    if (stored && graphs.some(g => g.id === stored)) {
      return stored;
    }

    // Fall back to first available graph
    const fallbackId = graphs[0].id;
    saveActiveGraphId(fallbackId);
    return fallbackId;
  } catch {
    return null;
  }
}

/**
 * Save active graph ID to persistence
 */
export function saveActiveGraphId(graphId: string | null): void {
  if (typeof localStorage === 'undefined') return;

  try {
    if (graphId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_GRAPH_ID, graphId);
      // Sync legacy graph for backwards-compatible readers
      const graph = loadGraphData(graphId);
      if (graph) {
        localStorage.setItem(STORAGE_KEYS.LEGACY_USER_GRAPH, JSON.stringify(graph));
      } else {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
    }
  } catch (err) {
    console.warn('[Storage] Failed to save active graph ID:', err);
  }
}

/**
 * Create a new knowledge graph and make it active
 */
export function createGraph(name: string, description?: string): KnowledgeGraphMeta {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Graph name is required.');
  }
  if (trimmedName.length > 100) {
    throw new Error('Graph name must be 100 characters or less.');
  }

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'graph';

  const id = `graph-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newGraph: KnowledgeGraphMeta = {
    id,
    name: trimmedName,
    description: description?.trim() || `${trimmedName} knowledge graph`,
    createdAt: now,
    updatedAt: now
  };

  const currentGraphs = loadGraphs();
  const updatedGraphs = [...currentGraphs, newGraph];
  saveGraphs(updatedGraphs);
  saveActiveGraphId(newGraph.id);

  // Initialize empty graph data for this new graph
  saveGraphData(newGraph.id, null);

  return newGraph;
}

/**
 * Rename an existing knowledge graph
 */
export function renameGraph(graphId: string, newName: string): KnowledgeGraphMeta | null {
  const trimmed = (newName || '').trim();
  if (!trimmed) {
    throw new Error('Graph name cannot be empty.');
  }
  if (trimmed.length > 100) {
    throw new Error('Graph name must be 100 characters or less.');
  }

  const currentGraphs = loadGraphs();
  let updatedMeta: KnowledgeGraphMeta | null = null;
  const nextGraphs = currentGraphs.map(g => {
    if (g.id === graphId) {
      let updatedDesc = g.description;
      // If description was empty, was default, or was "... knowledge graph", update to match new name
      if (!updatedDesc || updatedDesc.toLowerCase().endsWith('knowledge graph') || updatedDesc === `${g.name} knowledge graph`) {
        updatedDesc = `${trimmed} knowledge graph`;
      }
      updatedMeta = { ...g, name: trimmed, description: updatedDesc, updatedAt: new Date().toISOString() };
      return updatedMeta;
    }
    return g;
  });

  if (updatedMeta) {
    saveGraphs(nextGraphs);
    const existingData = loadGraphData(graphId);
    if (existingData) {
      saveGraphData(graphId, { ...existingData, name: trimmed });
    }
  }

  return updatedMeta;
}

/**
 * Delete a knowledge graph and all of its associated sources, concepts, relationships, and progress.
 * Does not affect other graphs.
 */
export function deleteGraph(graphId: string): { remainingGraphs: KnowledgeGraphMeta[]; nextActiveId: string | null } {
  if (typeof localStorage === 'undefined') {
    return { remainingGraphs: [], nextActiveId: null };
  }

  const currentGraphs = loadGraphs();
  const nextGraphs = currentGraphs.filter(g => g.id !== graphId);
  saveGraphs(nextGraphs);

  // Delete all sources belonging to this graph
  try {
    const rawSources = localStorage.getItem(STORAGE_KEYS.USER_SOURCES);
    if (rawSources) {
      const parsed = JSON.parse(rawSources);
      if (Array.isArray(parsed)) {
        const remainingSources = parsed.filter((s: KnowledgeSource) => s.graphId !== graphId);
        localStorage.setItem(STORAGE_KEYS.USER_SOURCES, JSON.stringify(remainingSources));
      }
    }
  } catch (err) {
    console.warn('[Storage] Error cleaning sources for deleted graph:', err);
  }

  // Remove graph data and progress
  try {
    localStorage.removeItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + graphId);
    localStorage.removeItem(STORAGE_KEYS.COMPLETED_CONCEPTS_PREFIX + graphId);
    localStorage.removeItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE_PREFIX + graphId);
  } catch (err) {
    console.warn('[Storage] Error removing graph records for deleted graph:', err);
  }

  // If this was the active graph, fall back safely
  const currentActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
  let nextActiveId: string | null = currentActive;

  if (currentActive === graphId) {
    nextActiveId = nextGraphs.length > 0 ? nextGraphs[0].id : null;
    saveActiveGraphId(nextActiveId);
  }

  return { remainingGraphs: nextGraphs, nextActiveId };
}

/**
 * Load user-constructed KnowledgeGraph for a specific graph from persistence
 */
export function loadGraphData(graphId: string): KnowledgeGraph | null {
  if (typeof localStorage === 'undefined' || !graphId) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + graphId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.relationships)) {
        return parsed as KnowledgeGraph;
      }
    }

    // Fallback for default migrated graph
    if (graphId === DEFAULT_MIGRATION_GRAPH_ID) {
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.relationships)) {
          return parsed as KnowledgeGraph;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[Storage] Failed to read graph data:', err);
    return null;
  }
}

/**
 * Save user-constructed KnowledgeGraph for a specific graph to persistence
 */
export function saveGraphData(graphId: string, graph: KnowledgeGraph | null): void {
  if (typeof localStorage === 'undefined' || !graphId) return;

  try {
    if (graph) {
      const scopedGraph: KnowledgeGraph = {
        ...graph,
        id: graphId,
        nodes: (graph.nodes || []).map(n => ({ ...n, graphId })),
        relationships: (graph.relationships || []).map(r => ({ ...r, graphId })),
        sources: (graph.sources || []).map(s => ({ ...s, graphId }))
      };
      localStorage.setItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + graphId, JSON.stringify(scopedGraph));

      // Keep legacy key in sync if this is the active graph
      const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
      if (activeId === graphId) {
        localStorage.setItem(STORAGE_KEYS.LEGACY_USER_GRAPH, JSON.stringify(scopedGraph));
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + graphId);
      const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
      if (activeId === graphId) {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
      }
    }
  } catch (err) {
    console.warn('[Storage] Failed to persist graph data:', err);
  }
}

/**
 * Load user-uploaded sources from persistence, optionally scoped to a graphId.
 */
export function loadUserSources(graphId?: string): KnowledgeSource[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SOURCES);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any mock fixtures and validate structure
    const validSources = parsed.filter((s): s is KnowledgeSource => {
      return (
        s &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        !DEMO_FIXTURE_IDS.has(s.id) &&
        (typeof s.fileName === 'string' || typeof s.name === 'string')
      );
    });

    if (graphId) {
      return validSources.filter(s => {
        if (s.graphId) return s.graphId === graphId;
        // Unscoped sources belong to default migration graph
        return graphId === DEFAULT_MIGRATION_GRAPH_ID;
      });
    }

    return validSources;
  } catch (err) {
    console.warn('[Storage] Failed to read user sources:', err);
    return [];
  }
}

/**
 * Save user-uploaded sources to persistence, scoped to a graphId when provided.
 */
export function saveUserSources(sources: KnowledgeSource[], graphId?: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const cleanSources = sources.filter(s => !DEMO_FIXTURE_IDS.has(s.id));

    if (graphId) {
      // Scoped save: preserve other graphs' sources
      const raw = localStorage.getItem(STORAGE_KEYS.USER_SOURCES);
      const allExisting: KnowledgeSource[] = raw ? JSON.parse(raw) : [];
      const otherSources = allExisting.filter(s => {
        if (s.graphId) return s.graphId !== graphId;
        return graphId !== DEFAULT_MIGRATION_GRAPH_ID;
      });

      const taggedSources = cleanSources.map(s => ({ ...s, graphId }));
      const merged = [...taggedSources, ...otherSources].filter(s => !DEMO_FIXTURE_IDS.has(s.id));
      localStorage.setItem(STORAGE_KEYS.USER_SOURCES, JSON.stringify(merged));
    } else {
      localStorage.setItem(STORAGE_KEYS.USER_SOURCES, JSON.stringify(cleanSources));
    }
  } catch (err) {
    console.warn('[Storage] Failed to persist user sources:', err);
  }
}

/**
 * Load user-constructed KnowledgeGraph (defaults to active graph)
 */
export function loadUserGraph(graphId?: string): KnowledgeGraph | null {
  const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
  return loadGraphData(targetId);
}

/**
 * Save user-constructed KnowledgeGraph (defaults to active graph)
 */
export function saveUserGraph(graph: KnowledgeGraph | null, graphId?: string): void {
  const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
  saveGraphData(targetId, graph);
}

/**
 * Load active graph source type ('user' | 'demo')
 */
export function loadGraphSourceType(graphId?: string): 'user' | 'demo' {
  if (typeof localStorage === 'undefined') return 'demo';

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const scopedKey = STORAGE_KEYS.GRAPH_SOURCE_TYPE_PREFIX + targetId;
    const raw = localStorage.getItem(scopedKey) || localStorage.getItem(STORAGE_KEYS.LEGACY_GRAPH_SOURCE_TYPE);
    if (raw === 'user' || raw === 'demo') {
      return raw;
    }
    const sources = loadUserSources(targetId);
    return sources.length > 0 ? 'user' : 'demo';
  } catch {
    return 'demo';
  }
}

/**
 * Save active graph source type
 */
export function saveGraphSourceType(type: 'user' | 'demo', graphId?: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    localStorage.setItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE_PREFIX + targetId, type);
    localStorage.setItem(STORAGE_KEYS.LEGACY_GRAPH_SOURCE_TYPE, type);
  } catch (err) {
    console.warn('[Storage] Failed to save graph source type:', err);
  }
}

/**
 * Load user's completed concept IDs from persistence for a specific graph
 */
export function loadCompletedConceptIds(graphId?: string): string[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const raw = localStorage.getItem(STORAGE_KEYS.COMPLETED_CONCEPTS_PREFIX + targetId) 
      || (targetId === DEFAULT_MIGRATION_GRAPH_ID ? localStorage.getItem(STORAGE_KEYS.LEGACY_USER_COMPLETED_CONCEPTS) : null);
    
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is string => typeof id === 'string');
  } catch (err) {
    console.warn('[Storage] Failed to read completed concepts:', err);
    return [];
  }
}

/**
 * Save user's completed concept IDs to persistence for a specific graph
 */
export function saveCompletedConceptIds(conceptIds: string[], graphId?: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const uniqueIds = Array.from(new Set(conceptIds.filter(id => typeof id === 'string')));
    localStorage.setItem(STORAGE_KEYS.COMPLETED_CONCEPTS_PREFIX + targetId, JSON.stringify(uniqueIds));
    if (targetId === DEFAULT_MIGRATION_GRAPH_ID) {
      localStorage.setItem(STORAGE_KEYS.LEGACY_USER_COMPLETED_CONCEPTS, JSON.stringify(uniqueIds));
    }
  } catch (err) {
    console.warn('[Storage] Failed to persist completed concepts:', err);
  }
}

/**
 * Toggle a single concept's completed status and return updated array
 */
export function toggleCompletedConceptId(conceptId: string, graphId?: string): string[] {
  const current = loadCompletedConceptIds(graphId);
  const set = new Set(current);
  if (set.has(conceptId)) {
    set.delete(conceptId);
  } else {
    set.add(conceptId);
  }
  const updated = Array.from(set);
  saveCompletedConceptIds(updated, graphId);
  return updated;
}

/**
 * Load practice states for all concepts in a specific graph
 */
export function loadConceptPracticeStates(graphId?: string): Record<string, ConceptPracticeState> {
  if (typeof localStorage === 'undefined') return {};

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const raw = localStorage.getItem(STORAGE_KEYS.PRACTICE_STATE_PREFIX + targetId);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, ConceptPracticeState>;
  } catch (err) {
    console.warn('[Storage] Failed to read concept practice states:', err);
    return {};
  }
}

/**
 * Save practice states for concepts in a specific graph
 */
export function saveConceptPracticeStates(
  states: Record<string, ConceptPracticeState>,
  graphId?: string
): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    localStorage.setItem(STORAGE_KEYS.PRACTICE_STATE_PREFIX + targetId, JSON.stringify(states));
  } catch (err) {
    console.warn('[Storage] Failed to persist concept practice states:', err);
  }
}

/**
 * Get knowledge/practice state for a single concept in a graph
 */
export function getKnowledgeState(
  graphId: string | undefined,
  conceptId: string
): ConceptPracticeState {
  const states = loadConceptPracticeStates(graphId);
  return states[conceptId] || {
    conceptId,
    status: 'unseen',
    practiceCount: 0
  };
}

/**
 * Get practice state for a single concept (backwards compatible wrapper)
 */
export function getConceptPracticeState(
  conceptId: string,
  graphId?: string
): ConceptPracticeState {
  return getKnowledgeState(graphId, conceptId);
}

/**
 * Update knowledge status for a concept and persist (Phase 3 Section 9)
 */
export function updateKnowledgeState(
  graphId: string | undefined,
  conceptId: string,
  status: PracticeStatus
): ConceptPracticeState {
  const states = loadConceptPracticeStates(graphId);
  const prev = states[conceptId] || { conceptId, status: 'unseen', practiceCount: 0 };
  const now = new Date().toISOString();
  
  const updated: ConceptPracticeState = {
    ...prev,
    conceptId,
    status,
    firstStudiedAt: prev.firstStudiedAt || (status !== 'unseen' ? now : undefined),
    lastStudiedAt: now,
    lastPracticedAt: now,
    practiceCount: (prev.practiceCount || 0) + 1
  };

  states[conceptId] = updated;
  saveConceptPracticeStates(states, graphId);
  return updated;
}

/**
 * Record meaningful study of a concept (Phase 3 Section 8)
 * Transitions unseen -> learning, sets firstStudiedAt and lastStudiedAt.
 * If already learning/needs-review/understood, does not alter status.
 */
export function recordConceptStudy(
  graphId: string | undefined,
  conceptId: string
): ConceptPracticeState {
  const states = loadConceptPracticeStates(graphId);
  const prev = states[conceptId] || { conceptId, status: 'unseen', practiceCount: 0 };
  const now = new Date().toISOString();

  if (prev.status && prev.status !== 'unseen') {
    const updated: ConceptPracticeState = {
      ...prev,
      lastStudiedAt: now
    };
    states[conceptId] = updated;
    saveConceptPracticeStates(states, graphId);
    return updated;
  }

  const updated: ConceptPracticeState = {
    ...prev,
    conceptId,
    status: 'learning',
    firstStudiedAt: prev.firstStudiedAt || now,
    lastStudiedAt: now,
    practiceCount: prev.practiceCount || 0
  };
  states[conceptId] = updated;
  saveConceptPracticeStates(states, graphId);
  return updated;
}

/**
 * Get all concept IDs in a graph matching a specific knowledge state (Phase 3 Section 31)
 */
export function getConceptsByKnowledgeState(
  graphId: string | undefined,
  status: PracticeStatus
): string[] {
  const states = loadConceptPracticeStates(graphId);
  return Object.values(states)
    .filter(s => s.status === status)
    .map(s => s.conceptId);
}

/**
 * Update practice status for a concept and persist (backwards compatible wrapper)
 */
export function updateConceptPracticeState(
  conceptId: string,
  status: PracticeStatus,
  graphId?: string
): ConceptPracticeState {
  return updateKnowledgeState(graphId, conceptId, status);
}

/**
 * Load completed tests history for a specific knowledge graph
 */
export function loadKnowledgeTests(graphId?: string): KnowledgeTest[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const targetId = graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const raw = localStorage.getItem(STORAGE_KEYS.TEST_HISTORY_PREFIX + targetId);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as KnowledgeTest[];
    }
    return [];
  } catch (err) {
    console.warn('[Storage] Failed to load knowledge tests:', err);
    return [];
  }
}

/**
 * Save completed knowledge test to graph test history
 */
export function saveKnowledgeTest(test: KnowledgeTest): void {
  if (typeof localStorage === 'undefined' || !test || !test.id) return;

  try {
    const targetId = test.graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;
    const existing = loadKnowledgeTests(targetId);
    // Replace if exists, else append to front
    const updated = [test, ...existing.filter(t => t.id !== test.id)];
    localStorage.setItem(STORAGE_KEYS.TEST_HISTORY_PREFIX + targetId, JSON.stringify(updated));
  } catch (err) {
    console.warn('[Storage] Failed to save knowledge test:', err);
  }
}

/**
 * Load the most recent completed knowledge test for a graph
 */
export function loadLatestKnowledgeTest(graphId?: string): KnowledgeTest | null {
  const tests = loadKnowledgeTests(graphId);
  return tests.length > 0 ? tests[0] : null;
}

export interface RecordTestCompletionOptions {
  completionReason?: AssessmentCompletionReason;
  userId?: string | null;
  graphName?: string;
  attemptId?: string;
}

/**
 * Finalize a test submission: calculate score, analyze concepts, update practice states, and persist attempt history.
 */
export function recordKnowledgeTestCompletion(
  test: KnowledgeTest,
  userAnswers: Record<string, string>,
  timeSpentSeconds: number,
  options?: RecordTestCompletionOptions
): TestResultsSummary {
  const questions = test.questions || [];
  let score = 0;
  const missedItems: MissedConceptItem[] = [];
  const strongConceptNamesSet = new Set<string>();
  const graphId = test.graphId || loadActiveGraphId() || DEFAULT_MIGRATION_GRAPH_ID;

  for (const q of questions) {
    const selectedId = userAnswers[q.id];
    const isCorrect = selectedId === q.correctOptionId;

    const selectedOption = q.options.find(o => o.id === selectedId);
    const correctOption = q.options.find(o => o.id === q.correctOptionId);

    if (isCorrect) {
      score += 1;
      for (const name of q.conceptNames) {
        strongConceptNamesSet.add(name);
      }
      // Update each concept state: increment practice count & mark understood/learning
      for (const cId of q.conceptIds) {
        const current = getConceptPracticeState(cId, graphId);
        const nextStatus: PracticeStatus = current.status === 'unseen' ? 'learning' : current.status === 'needs-review' ? 'learning' : 'understood';
        updateConceptPracticeState(cId, nextStatus, graphId);
        recordConceptStudy(graphId, cId);
      }
    } else {
      const primaryConceptId = q.conceptIds[0] || '';
      const primaryConceptName = q.conceptNames[0] || 'Concept';

      missedItems.push({
        conceptId: primaryConceptId,
        conceptName: primaryConceptName,
        questionId: q.id,
        questionText: q.question,
        selectedOptionText: selectedOption?.text || 'Unanswered',
        correctOptionText: correctOption?.text || '',
        explanation: q.explanation,
        sourceName: q.sourceName,
        sourceEvidence: q.sourceEvidence,
        page: q.page
      });

      // Mark missed concept as needs-review
      for (const cId of q.conceptIds) {
        updateConceptPracticeState(cId, 'needs-review', graphId);
        recordConceptStudy(graphId, cId);
      }
    }
  }

  // Remove concepts that had any missed question from the strong list to prevent contradiction
  for (const missed of missedItems) {
    strongConceptNamesSet.delete(missed.conceptName);
  }

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const attemptId = options?.attemptId || `attempt-${graphId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const summary: TestResultsSummary = {
    testId: test.id,
    attemptId,
    score,
    totalQuestions: questions.length,
    percentage,
    timeSpentSeconds,
    strongConceptNames: Array.from(strongConceptNamesSet),
    reviewRecommendedConcepts: missedItems,
    persistenceStatus: 'saved'
  };

  // Collect aggregated metadata for permanent attempt record
  const allConceptIdsSet = new Set<string>();
  const allConceptNamesSet = new Set<string>();
  const allSourceIdsSet = new Set<string>();
  for (const q of questions) {
    for (const cId of q.conceptIds || []) allConceptIdsSet.add(cId);
    for (const cName of q.conceptNames || []) allConceptNamesSet.add(cName);
    for (const sId of q.sourceIds || []) allSourceIdsSet.add(sId);
  }

  // Build immutable historical attempt snapshot
  const attemptRecord: AssessmentAttempt = {
    id: attemptId,
    testId: test.id,
    userId: options?.userId !== undefined ? options.userId : getCurrentUserId(),
    graphId,
    graphName: options?.graphName || test.title || DEFAULT_MIGRATION_GRAPH_NAME,
    createdAt: test.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    correctAnswers: score,
    scorePercentage: percentage,
    timeSpentSeconds,
    questions: test.questions,
    userAnswers,
    conceptIds: Array.from(allConceptIdsSet),
    conceptNames: Array.from(allConceptNamesSet),
    sourceIds: Array.from(allSourceIdsSet),
    completionReason: options?.completionReason || (timeSpentSeconds >= (test.timeLimitSeconds || 0) && (test.timeLimitSeconds || 0) > 0 ? 'time_expired' : 'submission'),
    resultsSummary: summary
  };

  // Save attempt to history
  try {
    saveAssessmentAttempt(attemptRecord);
    summary.persistenceStatus = 'saved';
  } catch (err) {
    console.error('[Storage] Failed to persist assessment attempt:', err);
    summary.persistenceStatus = 'failed';
    summary.persistenceError = err instanceof Error ? err.message : String(err);
  }

  const completedTest: KnowledgeTest = {
    ...test,
    submittedAt: new Date().toISOString(),
    answers: userAnswers,
    score,
    timeSpentSeconds
  };

  saveKnowledgeTest(completedTest);

  return summary;
}

/**
 * Clear all user data (for testing or reset)
 */
export function clearAllUserData(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // Clear graphs and active graph
    const graphs = loadGraphs();
    for (const g of graphs) {
      localStorage.removeItem(STORAGE_KEYS.GRAPH_DATA_PREFIX + g.id);
      localStorage.removeItem(STORAGE_KEYS.COMPLETED_CONCEPTS_PREFIX + g.id);
      localStorage.removeItem(STORAGE_KEYS.PRACTICE_STATE_PREFIX + g.id);
      localStorage.removeItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE_PREFIX + g.id);
      localStorage.removeItem(STORAGE_KEYS.TEST_HISTORY_PREFIX + g.id);
    }
    localStorage.removeItem(STORAGE_KEYS.GRAPHS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_GRAPH_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_SOURCES);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_USER_GRAPH);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_GRAPH_SOURCE_TYPE);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_USER_COMPLETED_CONCEPTS);
    localStorage.removeItem(STORAGE_KEYS.ASSESSMENT_ATTEMPTS);
  } catch (err) {
    console.warn('[Storage] Failed to clear user data:', err);
  }
}

// Re-export assessment history and auth utilities
export {
  saveAssessmentAttempt,
  getAssessmentAttempts,
  getAssessmentAttemptById,
  deleteAssessmentAttempt,
  clearAssessmentHistory,
  AssessmentPersistenceError,
  AssessmentAccessDeniedError,
  ASSESSMENT_HISTORY_STORAGE_KEY
} from './assessmentHistory';
export {
  getCurrentUser,
  getCurrentUserId,
  setCurrentUser,
  clearCurrentUser,
  DEFAULT_LOCAL_USER_ID
} from './auth';
export type { AuthUser } from './auth';
