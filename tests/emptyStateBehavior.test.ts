import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  migrateExistingDataIfNeeded,
  loadGraphs,
  loadActiveGraphId,
  saveActiveGraphId,
  createGraph,
  deleteGraph,
  loadUserGraph,
  saveUserGraph,
  loadUserSources,
  saveUserSources,
  STORAGE_KEYS
} from '../src/services/storage';
import { getPersonaNextStepRecommendation } from '../src/services/personaRecommendation';
import { getContextualObservations } from '../src/services/personaObservations';
import type { PersonaStatsData } from '../src/types/personaStats';

// Mock localStorage for Node environment
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = mockStorage;
(globalThis as unknown as { window: Record<string, unknown> }).window = {
  localStorage: mockStorage
};

describe('GRAPHMIND — EMPTY-STATE BEHAVIOR ON OVERVIEW & PERSONA', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  // =========================================================================
  // SCENARIO 1: Fresh session with NO graphs
  // =========================================================================
  describe('Scenario 1: Fresh browser session (0 graphs)', () => {
    it('initializes graphs as empty array and activeGraphId as null without creating placeholder', () => {
      const initialGraphs = migrateExistingDataIfNeeded();
      assert.strictEqual(initialGraphs.length, 0, 'Must have 0 graphs on fresh session');
      assert.strictEqual(loadGraphs().length, 0, 'Storage meta must contain 0 graphs');
      assert.strictEqual(loadActiveGraphId(), null, 'Active graph ID must be null');
      assert.strictEqual(loadUserGraph(), null, 'loadUserGraph must return null');
      assert.deepStrictEqual(loadUserSources(), [], 'loadUserSources must return empty array');
    });

    it('produces persona observations welcoming user to create their first graph', () => {
      const stats: any = {
        activity: {
          totalGraphs: 0,
          totalConcepts: 0,
          demonstratedPercentage: 0,
          demonstratedConcepts: 0,
          recentGraph: null
        },
        performance: {
          averageScore: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: [],
          activeRevisionProgress: null,
          recentAssessments: []
        }
      };

      const obs = getContextualObservations(stats);
      assert.strictEqual(obs.category, 'getting-started');
      assert.ok(
        obs.cycle1.includes("Hey! Let's create your first knowledge graph."),
        'Cycle 1 must welcome user to create their first graph'
      );
      assert.ok(
        obs.cycle2.includes("Upload your notes and I'll help you turn them into connected concepts."),
        'Cycle 2 must explain uploading notes'
      );
    });

    it('produces persona recommendation guiding user to create first graph', () => {
      const stats: any = {
        activity: {
          totalGraphs: 0,
          totalConcepts: 0,
          demonstratedPercentage: 0,
          demonstratedConcepts: 0,
          recentGraph: null
        },
        performance: {
          averageScore: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: [],
          activeRevisionProgress: null,
          recentAssessments: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats, { graphs: [] });
      assert.ok(recommendation);
      assert.strictEqual(recommendation.title, 'Create your first knowledge graph');
      assert.strictEqual(
        recommendation.description,
        'Upload your notes and I’ll help you turn them into connected concepts.'
      );
      assert.strictEqual(recommendation.actionLabel, 'Create a graph');
    });
  });

  // =========================================================================
  // SCENARIO 2: Real graph containing concepts
  // =========================================================================
  describe('Scenario 2: Real graph containing concepts', () => {
    it('persists real graph and updates active graph correctly', () => {
      const graphMeta = createGraph('Operating Systems', 'Core systems concepts');
      assert.strictEqual(graphMeta.name, 'Operating Systems');
      assert.strictEqual(loadActiveGraphId(), graphMeta.id);

      saveUserGraph({
        id: graphMeta.id,
        nodes: [
          { id: 'c1', name: 'Deadlock', graphId: graphMeta.id },
          { id: 'c2', name: 'Semaphore', graphId: graphMeta.id }
        ],
        relationships: [
          { id: 'r1', source: 'c1', target: 'c2', label: 'prevents', graphId: graphMeta.id }
        ],
        sources: []
      }, graphMeta.id);

      const loaded = loadUserGraph(graphMeta.id);
      assert.ok(loaded);
      assert.strictEqual(loaded.nodes.length, 2);
      assert.strictEqual(loaded.relationships.length, 1);
    });
  });

  // =========================================================================
  // SCENARIO 3: Real graph containing NO concepts (empty-content state)
  // =========================================================================
  describe('Scenario 3: Real graph containing no concepts', () => {
    it('preserves the graph as an existing real graph without treating it as nonexistent', () => {
      const emptyGraphMeta = createGraph('Quantum Computing');
      assert.strictEqual(loadGraphs().length, 1);
      assert.strictEqual(loadActiveGraphId(), emptyGraphMeta.id);

      const loaded = loadUserGraph(emptyGraphMeta.id);
      assert.strictEqual(loaded, null); // No nodes persisted yet

      const graphs = loadGraphs();
      assert.strictEqual(graphs.length, 1);
      assert.strictEqual(graphs[0].name, 'Quantum Computing');
    });
  });

  // =========================================================================
  // SCENARIO 4: Switching graphs
  // =========================================================================
  describe('Scenario 4: Switching between multiple graphs', () => {
    it('switches active graph cleanly and isolates data', () => {
      const g1 = createGraph('Distributed Systems');
      saveUserGraph({
        id: g1.id,
        nodes: [{ id: 'ds1', name: 'Raft', graphId: g1.id }],
        relationships: [],
        sources: []
      }, g1.id);

      const g2 = createGraph('Computer Networks');
      saveUserGraph({
        id: g2.id,
        nodes: [{ id: 'cn1', name: 'TCP', graphId: g2.id }, { id: 'cn2', name: 'UDP', graphId: g2.id }],
        relationships: [],
        sources: []
      }, g2.id);

      assert.strictEqual(loadActiveGraphId(), g2.id);
      assert.strictEqual(loadUserGraph(g2.id)?.nodes.length, 2);

      // Switch back to g1
      saveActiveGraphId(g1.id);
      assert.strictEqual(loadActiveGraphId(), g1.id);
      assert.strictEqual(loadUserGraph(g1.id)?.nodes.length, 1);
    });
  });

  // =========================================================================
  // SCENARIO 5: Deleting the final graph
  // =========================================================================
  describe('Scenario 5: Deleting the final graph', () => {
    it('returns to empty state with activeGraphId null when final graph is deleted', () => {
      const g1 = createGraph('Temporary Graph');
      assert.strictEqual(loadGraphs().length, 1);
      assert.strictEqual(loadActiveGraphId(), g1.id);

      const { remainingGraphs, nextActiveId } = deleteGraph(g1.id);
      assert.strictEqual(remainingGraphs.length, 0);
      assert.strictEqual(nextActiveId, null);
      assert.strictEqual(loadGraphs().length, 0);
      assert.strictEqual(loadActiveGraphId(), null, 'activeGraphId must reset to null upon deleting final graph');
    });
  });
});
