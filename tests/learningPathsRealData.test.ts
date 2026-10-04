import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateLearningPaths, 
  calculateEstimatedMinutes, 
  formatEstimatedDuration, 
  calculatePathProgress, 
  generatePathTitle 
} from '../src/services/learningPathGeneration';
import { 
  loadCompletedConceptIds, 
  saveCompletedConceptIds, 
  toggleCompletedConceptId,
  saveUserGraph,
  loadUserGraph
} from '../src/services/storage';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';

// Mock localStorage for node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('Learning Paths Real Data Layer', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  describe('TEST 1: No sources / empty graph', () => {
    it('returns empty state with 0 paths and no demo data', () => {
      const emptyResult = generateLearningPaths(null);
      assert.equal(emptyResult.paths.length, 0);
      assert.equal(emptyResult.totalConcepts, 0);
      assert.equal(emptyResult.state, 'empty');

      const emptyGraphResult = generateLearningPaths({ nodes: [], relationships: [], sources: [] });
      assert.equal(emptyGraphResult.paths.length, 0);
      assert.equal(emptyGraphResult.totalConcepts, 0);
      assert.equal(emptyGraphResult.state, 'empty');

      // Verify no hardcoded demo paths are present
      const allTitles = emptyGraphResult.paths.map(p => p.title.toLowerCase());
      assert.ok(!allTitles.some(t => t.includes('attention mechanisms')));
      assert.ok(!allTitles.some(t => t.includes('convnets')));
      assert.ok(!allTitles.some(t => t.includes('loss landscapes')));
    });
  });

  describe('TEST 2: Upload real document / graph with real concepts and relationships', () => {
    it('derives real deterministic learning paths from graph relationships', () => {
      const realGraph: KnowledgeGraph = {
        sources: [
          {
            id: 'src-dbms-unit-4',
            name: 'Database Recovery & Concurrency',
            type: 'pdf',
            createdAt: '2026-10-01T10:00:00Z',
            status: 'ready'
          }
        ],
        nodes: [
          {
            id: 'c-transactions',
            name: 'Transactions',
            type: 'foundation',
            description: 'Atomic units of program execution that access and potentially update various data items.',
            sourceIds: ['src-dbms-unit-4']
          },
          {
            id: 'c-acid',
            name: 'ACID Properties',
            type: 'paradigm',
            description: 'Atomicity, consistency, isolation, and durability guarantees for database transactions.',
            sourceIds: ['src-dbms-unit-4']
          },
          {
            id: 'c-concurrency',
            name: 'Concurrency Control',
            type: 'method',
            description: 'Mechanisms ensuring correct interleaved execution of concurrent database transactions.',
            sourceIds: ['src-dbms-unit-4']
          },
          {
            id: 'c-recovery',
            name: 'Crash Recovery',
            type: 'application',
            description: 'Log-based recovery algorithms guaranteeing atomicity and durability in the event of failure.',
            sourceIds: ['src-dbms-unit-4']
          }
        ],
        relationships: [
          {
            id: 'rel-1',
            source: 'c-transactions',
            target: 'c-acid',
            type: 'foundation-for',
            description: 'Transactions underpin ACID property enforcement.',
            sourceChunkIds: ['chunk-1']
          },
          {
            id: 'rel-2',
            source: 'c-acid',
            target: 'c-concurrency',
            type: 'foundation-for',
            description: 'ACID isolation requires concurrency control protocols.',
            sourceChunkIds: ['chunk-2']
          },
          {
            id: 'rel-3',
            source: 'c-concurrency',
            target: 'c-recovery',
            type: 'applied-to',
            description: 'Concurrency control logging integrates with crash recovery algorithms.',
            sourceChunkIds: ['chunk-3']
          }
        ]
      };

      const result = generateLearningPaths(realGraph);
      assert.equal(result.state, 'ready');
      assert.ok(result.paths.length >= 1, 'Should generate at least one learning path');

      const heroPath = result.paths[0];
      // Title must be derived from actual graph concepts
      assert.equal(heroPath.title, 'Transactions → Crash Recovery');
      // Concept count must match unique nodes in path
      assert.equal(heroPath.nodeCount, heroPath.concepts.length);
      assert.equal(heroPath.concepts[0].id, 'c-transactions');
      assert.equal(heroPath.concepts[heroPath.concepts.length - 1].id, 'c-recovery');

      // Original node IDs and sourceIds preserved
      for (const concept of heroPath.concepts) {
        assert.ok(concept.id.startsWith('c-'));
        assert.deepEqual(concept.sourceIds, ['src-dbms-unit-4']);
      }

      // Initial progress must be 0% and NOT STARTED
      assert.equal(heroPath.progress, 0);
      assert.equal(heroPath.status, 'NOT STARTED');
      assert.deepEqual(heroPath.completedConceptIds, []);
    });
  });

  describe('TEST 3: Browser refresh / persistence', () => {
    it('produces the exact same learning paths deterministically across reloads', () => {
      const graph: KnowledgeGraph = {
        sources: [{ id: 'src-1', name: 'Calculus.pdf', type: 'pdf', createdAt: 1000, status: 'ready' }],
        nodes: [
          { id: 'n-limits', name: 'Limits', type: 'foundation', description: 'Behavior of functions near points.', sourceIds: ['src-1'] },
          { id: 'n-derivatives', name: 'Derivatives', type: 'method', description: 'Instantaneous rates of change.', sourceIds: ['src-1'] },
          { id: 'n-integrals', name: 'Integrals', type: 'application', description: 'Accumulation of quantities.', sourceIds: ['src-1'] }
        ],
        relationships: [
          { id: 'r1', source: 'n-limits', target: 'n-derivatives', type: 'foundation-for', sourceChunkIds: [] },
          { id: 'r2', source: 'n-derivatives', target: 'n-integrals', type: 'foundation-for', sourceChunkIds: [] }
        ]
      };

      saveUserGraph(graph);
      const loadedGraph = loadUserGraph();
      assert.ok(loadedGraph);

      const run1 = generateLearningPaths(loadedGraph);
      const run2 = generateLearningPaths(loadedGraph);

      assert.equal(run1.paths.length, run2.paths.length);
      assert.deepEqual(run1.paths.map(p => p.id), run2.paths.map(p => p.id));
      assert.deepEqual(run1.paths.map(p => p.title), run2.paths.map(p => p.title));
      assert.deepEqual(run1.paths.map(p => p.conceptIds), run2.paths.map(p => p.conceptIds));
    });
  });

  describe('TEST 4: Upload another document / graph expansion', () => {
    it('updates learning paths based on the expanded graph', () => {
      const baseGraph: KnowledgeGraph = {
        sources: [{ id: 'src-1', name: 'Physics.pdf', type: 'pdf', createdAt: 1000, status: 'ready' }],
        nodes: [
          { id: 'n-force', name: 'Force', type: 'foundation', description: 'Mass times acceleration.', sourceIds: ['src-1'] },
          { id: 'n-work', name: 'Work', type: 'method', description: 'Force over distance.', sourceIds: ['src-1'] }
        ],
        relationships: [
          { id: 'r1', source: 'n-force', target: 'n-work', type: 'foundation-for', sourceChunkIds: [] }
        ]
      };

      const result1 = generateLearningPaths(baseGraph);
      assert.equal(result1.paths.length, 1);
      assert.equal(result1.paths[0].title, 'Force → Work');
      assert.equal(result1.paths[0].nodeCount, 2);

      // Expand graph with a second document
      const expandedGraph: KnowledgeGraph = {
        sources: [
          ...baseGraph.sources,
          { id: 'src-2', name: 'Thermodynamics.pdf', type: 'pdf', createdAt: 2000, status: 'ready' }
        ],
        nodes: [
          ...baseGraph.nodes,
          { id: 'n-energy', name: 'Kinetic Energy', type: 'architecture', description: 'Energy of motion.', sourceIds: ['src-2'] },
          { id: 'n-power', name: 'Power', type: 'application', description: 'Rate of doing work.', sourceIds: ['src-2'] }
        ],
        relationships: [
          ...baseGraph.relationships,
          { id: 'r2', source: 'n-work', target: 'n-energy', type: 'foundation-for', sourceChunkIds: [] },
          { id: 'r3', source: 'n-energy', target: 'n-power', type: 'applied-to', sourceChunkIds: [] }
        ]
      };

      const result2 = generateLearningPaths(expandedGraph);
      assert.ok(result2.paths.length >= 1);
      const topPath = result2.paths[0];
      assert.equal(topPath.title, 'Force → Power');
      assert.equal(topPath.nodeCount, 4);
      assert.deepEqual(topPath.conceptIds, ['n-force', 'n-work', 'n-energy', 'n-power']);
    });
  });

  describe('TEST 5: Delete a source / graph reduction', () => {
    it('updates learning paths based on the remaining graph', () => {
      const graphBeforeDeletion: KnowledgeGraph = {
        sources: [
          { id: 'src-1', name: 'Doc1.pdf', type: 'pdf', createdAt: 1000, status: 'ready' },
          { id: 'src-2', name: 'Doc2.pdf', type: 'pdf', createdAt: 2000, status: 'ready' }
        ],
        nodes: [
          { id: 'n-a', name: 'Alpha', type: 'foundation', description: 'Base concept', sourceIds: ['src-1'] },
          { id: 'n-b', name: 'Beta', type: 'architecture', description: 'Shared concept', sourceIds: ['src-1', 'src-2'] },
          { id: 'n-c', name: 'Gamma', type: 'application', description: 'Exclusive to Doc 2', sourceIds: ['src-2'] }
        ],
        relationships: [
          { id: 'r1', source: 'n-a', target: 'n-b', type: 'foundation-for', sourceChunkIds: [], sourceIds: ['src-1'] },
          { id: 'r2', source: 'n-b', target: 'n-c', type: 'foundation-for', sourceChunkIds: [], sourceIds: ['src-2'] }
        ]
      };

      // Delete source 2 (pruning exclusive node n-c and relationship r2)
      const graphAfterDeletion: KnowledgeGraph = {
        sources: [graphBeforeDeletion.sources[0]],
        nodes: graphBeforeDeletion.nodes.filter(n => n.id !== 'n-c'),
        relationships: graphBeforeDeletion.relationships.filter(r => r.id !== 'r2')
      };

      const result = generateLearningPaths(graphAfterDeletion);
      assert.equal(result.paths.length, 1);
      assert.equal(result.paths[0].title, 'Alpha → Beta');
      assert.deepEqual(result.paths[0].conceptIds, ['n-a', 'n-b']);
      assert.ok(!result.paths.some(p => p.conceptIds.includes('n-c')));
    });
  });

  describe('TEST 6: Graph with concepts but no meaningful relationships', () => {
    it('returns insufficient relationships state with exact real concept count', () => {
      const disconnectedGraph: KnowledgeGraph = {
        sources: [{ id: 'src-1', name: 'RawNotes.txt', type: 'text', createdAt: 1000, status: 'ready' }],
        nodes: [
          { id: 'c1', name: 'Isolated Term A', type: 'foundation', description: '', sourceIds: ['src-1'] },
          { id: 'c2', name: 'Isolated Term B', type: 'architecture', description: '', sourceIds: ['src-1'] },
          { id: 'c3', name: 'Isolated Term C', type: 'application', description: '', sourceIds: ['src-1'] },
          { id: 'c4', name: 'Isolated Term D', type: 'method', description: '', sourceIds: ['src-1'] }
        ],
        relationships: []
      };

      const result = generateLearningPaths(disconnectedGraph);
      assert.equal(result.paths.length, 0);
      assert.equal(result.state, 'insufficient');
      assert.equal(result.totalConcepts, 4, 'Must report exact real concept count');
      assert.equal(result.totalRelationships, 0);
    });
  });

  describe('TEST 7: Concept progress tracking updates', () => {
    it('calculates progress accurately and transitions statuses', () => {
      const concepts = ['c-1', 'c-2', 'c-3', 'c-4'];

      // 0% -> NOT STARTED
      const p0 = calculatePathProgress(concepts, []);
      assert.equal(p0.progress, 0);
      assert.equal(p0.status, 'NOT STARTED');

      // 50% -> IN PROGRESS
      const p50 = calculatePathProgress(concepts, ['c-1', 'c-2']);
      assert.equal(p50.progress, 50);
      assert.equal(p50.status, 'IN PROGRESS');

      // 75% -> IN PROGRESS
      const p75 = calculatePathProgress(concepts, ['c-1', 'c-2', 'c-3']);
      assert.equal(p75.progress, 75);
      assert.equal(p75.status, 'IN PROGRESS');

      // 100% -> COMPLETE
      const p100 = calculatePathProgress(concepts, ['c-1', 'c-2', 'c-3', 'c-4']);
      assert.equal(p100.progress, 100);
      assert.equal(p100.status, 'COMPLETE');
    });

    it('persists completed concepts and updates paths dynamically', () => {
      const graph: KnowledgeGraph = {
        sources: [{ id: 's1', name: 'Algorithms.pdf', type: 'pdf', createdAt: 1000, status: 'ready' }],
        nodes: [
          { id: 'c-arrays', name: 'Arrays', type: 'foundation', description: 'Contiguous memory', sourceIds: ['s1'] },
          { id: 'c-lists', name: 'Linked Lists', type: 'architecture', description: 'Node pointer chains', sourceIds: ['s1'] },
          { id: 'c-trees', name: 'Binary Trees', type: 'application', description: 'Hierarchical node branching', sourceIds: ['s1'] }
        ],
        relationships: [
          { id: 'r1', source: 'c-arrays', target: 'c-lists', type: 'foundation-for', sourceChunkIds: [] },
          { id: 'r2', source: 'c-lists', target: 'c-trees', type: 'foundation-for', sourceChunkIds: [] }
        ]
      };

      // Initially no completed concepts
      saveCompletedConceptIds([]);
      let result = generateLearningPaths(graph, loadCompletedConceptIds());
      assert.equal(result.paths[0].progress, 0);
      assert.equal(result.paths[0].status, 'NOT STARTED');

      // User completes first concept
      const updated = toggleCompletedConceptId('c-arrays');
      assert.deepEqual(updated, ['c-arrays']);

      result = generateLearningPaths(graph, loadCompletedConceptIds());
      assert.equal(result.paths[0].progress, 33);
      assert.equal(result.paths[0].status, 'IN PROGRESS');
      assert.deepEqual(result.paths[0].completedConceptIds, ['c-arrays']);

      // User completes remaining concepts
      toggleCompletedConceptId('c-lists');
      toggleCompletedConceptId('c-trees');
      result = generateLearningPaths(graph, loadCompletedConceptIds());
      assert.equal(result.paths[0].progress, 100);
      assert.equal(result.paths[0].status, 'COMPLETE');
      assert.equal(result.paths[0].completedConceptIds.length, 3);
    });
  });

  describe('TEST 8: No fake concept counts, fake durations, or fake percentages', () => {
    it('verifies calculations are purely functions of the input concepts', () => {
      const nodes: KnowledgeNode[] = [
        { id: '1', name: 'A', type: 'foundation', description: 'Short', sourceIds: [] },
        { id: '2', name: 'B', type: 'architecture', description: 'Short', sourceIds: [] },
        { id: '3', name: 'C', type: 'application', description: 'Short', sourceIds: [] }
      ];

      // Base 8 minutes * 3 concepts = 24 minutes
      const minutes = calculateEstimatedMinutes(nodes);
      assert.equal(minutes, 24);
      assert.equal(formatEstimatedDuration(minutes), '24 min');

      // Test format >= 60 minutes
      const longNodes: KnowledgeNode[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        name: `Node ${i}`,
        type: 'foundation',
        description: 'Short',
        sourceIds: []
      }));
      // 10 * 8 = 80 minutes = 1.3 hrs
      const longMin = calculateEstimatedMinutes(longNodes);
      assert.equal(longMin, 80);
      assert.equal(formatEstimatedDuration(longMin), '1.3 hrs');

      // Title derivation
      assert.equal(generatePathTitle(nodes), 'A → C');
    });
  });

  describe('Deduplication & Ranking', () => {
    it('does not duplicate identical concept sequences', () => {
      const graph: KnowledgeGraph = {
        sources: [{ id: 's1', name: 'AI.pdf', type: 'pdf', createdAt: 1000, status: 'ready' }],
        nodes: [
          { id: 'n1', name: 'Linear Regression', type: 'foundation', description: '', sourceIds: ['s1'] },
          { id: 'n2', name: 'Cost Function', type: 'method', description: '', sourceIds: ['s1'] },
          { id: 'n3', name: 'Gradient Descent', type: 'application', description: '', sourceIds: ['s1'] }
        ],
        relationships: [
          // Multiple relationships between the same pair
          { id: 'r1', source: 'n1', target: 'n2', type: 'foundation-for', sourceChunkIds: [] },
          { id: 'r1-dup', source: 'n1', target: 'n2', type: 'uses', sourceChunkIds: [] },
          { id: 'r2', source: 'n2', target: 'n3', type: 'foundation-for', sourceChunkIds: [] }
        ]
      };

      const result = generateLearningPaths(graph);
      const keys = result.paths.map(p => p.conceptIds.join('->'));
      const uniqueKeys = new Set(keys);
      assert.equal(keys.length, uniqueKeys.size, 'Every generated path sequence must be unique');
    });
  });
});
