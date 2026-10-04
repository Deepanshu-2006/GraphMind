import type { KnowledgeSource, KnowledgeGraph } from '../types/knowledgeGraph';

const STORAGE_KEYS = {
  USER_SOURCES: 'graphmind_user_sources_v1',
  USER_GRAPH: 'graphmind_user_graph_v1',
  GRAPH_SOURCE_TYPE: 'graphmind_graph_source_type_v1',
  USER_COMPLETED_CONCEPTS: 'graphmind_user_completed_concepts_v1',
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
 * Load user-uploaded sources from persistence
 */
export function loadUserSources(): KnowledgeSource[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SOURCES);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any mock fixtures and validate structure
    return parsed.filter((s): s is KnowledgeSource => {
      return (
        s &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        !DEMO_FIXTURE_IDS.has(s.id) &&
        (typeof s.fileName === 'string' || typeof s.name === 'string')
      );
    });
  } catch (err) {
    console.warn('[Storage] Failed to read user sources from localStorage:', err);
    return [];
  }
}

/**
 * Save user-uploaded sources to persistence
 */
export function saveUserSources(sources: KnowledgeSource[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // Only persist non-demo sources
    const cleanSources = sources.filter(s => !DEMO_FIXTURE_IDS.has(s.id));
    localStorage.setItem(STORAGE_KEYS.USER_SOURCES, JSON.stringify(cleanSources));
  } catch (err) {
    console.warn('[Storage] Failed to persist user sources to localStorage:', err);
  }
}

/**
 * Load user-constructed KnowledgeGraph from persistence
 */
export function loadUserGraph(): KnowledgeGraph | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_GRAPH);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.relationships)) {
      return parsed as KnowledgeGraph;
    }
    return null;
  } catch (err) {
    console.warn('[Storage] Failed to read user graph from localStorage:', err);
    return null;
  }
}

/**
 * Save user-constructed KnowledgeGraph to persistence
 */
export function saveUserGraph(graph: KnowledgeGraph | null): void {
  if (typeof localStorage === 'undefined') return;

  try {
    if (graph) {
      localStorage.setItem(STORAGE_KEYS.USER_GRAPH, JSON.stringify(graph));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_GRAPH);
    }
  } catch (err) {
    console.warn('[Storage] Failed to persist user graph to localStorage:', err);
  }
}

/**
 * Load active graph source type ('user' | 'demo')
 */
export function loadGraphSourceType(): 'user' | 'demo' {
  if (typeof localStorage === 'undefined') return 'demo';

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE);
    if (raw === 'user' || raw === 'demo') {
      return raw;
    }
    // If user has uploaded sources, default to user mode
    const sources = loadUserSources();
    return sources.length > 0 ? 'user' : 'demo';
  } catch {
    return 'demo';
  }
}

/**
 * Save active graph source type
 */
export function saveGraphSourceType(type: 'user' | 'demo'): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE, type);
  } catch (err) {
    console.warn('[Storage] Failed to save graph source type:', err);
  }
}

/**
 * Load user's completed concept IDs from persistence
 */
export function loadCompletedConceptIds(): string[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_COMPLETED_CONCEPTS);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is string => typeof id === 'string');
  } catch (err) {
    console.warn('[Storage] Failed to read completed concepts from localStorage:', err);
    return [];
  }
}

/**
 * Save user's completed concept IDs to persistence
 */
export function saveCompletedConceptIds(conceptIds: string[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const uniqueIds = Array.from(new Set(conceptIds.filter(id => typeof id === 'string')));
    localStorage.setItem(STORAGE_KEYS.USER_COMPLETED_CONCEPTS, JSON.stringify(uniqueIds));
  } catch (err) {
    console.warn('[Storage] Failed to persist completed concepts to localStorage:', err);
  }
}

/**
 * Toggle a single concept's completed status and return updated array
 */
export function toggleCompletedConceptId(conceptId: string): string[] {
  const current = loadCompletedConceptIds();
  const set = new Set(current);
  if (set.has(conceptId)) {
    set.delete(conceptId);
  } else {
    set.add(conceptId);
  }
  const updated = Array.from(set);
  saveCompletedConceptIds(updated);
  return updated;
}

/**
 * Clear all user data (for testing or reset)
 */
export function clearAllUserData(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.USER_SOURCES);
    localStorage.removeItem(STORAGE_KEYS.USER_GRAPH);
    localStorage.removeItem(STORAGE_KEYS.GRAPH_SOURCE_TYPE);
    localStorage.removeItem(STORAGE_KEYS.USER_COMPLETED_CONCEPTS);
  } catch (err) {
    console.warn('[Storage] Failed to clear user data:', err);
  }
}
