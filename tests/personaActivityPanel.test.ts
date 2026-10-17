import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatRelativeTime,
  formatTabularCount
} from '../src/components/persona/PersonaActivityPanel';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import { saveGraphData, updateConceptPracticeState } from '../src/services/storage';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
  get length() { return storageMap.size; }
};

describe('GRAPHMIND — PERSONA ACTIVITY PANEL (Step 12)', () => {
  // =========================================================================
  // 1. RELATIVE TIME & TABULAR FORMATTERS
  // =========================================================================
  describe('1. Pure Formatters', () => {
    it('formats tabular numbers with leading zeroes for single digits', () => {
      assert.strictEqual(formatTabularCount(0), '00');
      assert.strictEqual(formatTabularCount(-5), '00');
      assert.strictEqual(formatTabularCount(1), '01');
      assert.strictEqual(formatTabularCount(8), '08');
      assert.strictEqual(formatTabularCount(10), '10');
      assert.strictEqual(formatTabularCount(42), '42');
    });

    it('formats concise relative time from real ISO timestamps', () => {
      const now = Date.now();
      assert.strictEqual(formatRelativeTime(new Date(now - 10 * 1000).toISOString()), 'Just now');
      assert.strictEqual(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString()), '5m ago');
      assert.strictEqual(formatRelativeTime(new Date(now - 3 * 3600 * 1000).toISOString()), '3h ago');
      assert.strictEqual(formatRelativeTime(new Date(now - 25 * 3600 * 1000).toISOString()), 'Yesterday');
      assert.strictEqual(formatRelativeTime(new Date(now - 4 * 86400 * 1000).toISOString()), '4d ago');
      assert.strictEqual(formatRelativeTime(undefined), 'Recently');
      assert.strictEqual(formatRelativeTime('invalid-date'), 'Recently');
    });
  });

  // =========================================================================
  // 2. DATA LAYER BINDINGS & EMPTY STATES
  // =========================================================================
  describe('2. Data Layer Bindings & Empty State Handling', () => {
    it('reflects empty state when user has 0 graphs', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.activity.totalGraphs, 0);
      assert.strictEqual(formatTabularCount(stats.activity.totalGraphs), '00');
      assert.strictEqual(stats.activity.totalConcepts, 0);
      assert.strictEqual(stats.activity.demonstratedPercentage, 0);
      assert.strictEqual(stats.activity.recentGraph, null);
      assert.deepStrictEqual(stats.activity.recentGraphs, []);
    });

    it('displays verified learning progress without fabricating 0% or streaks', () => {
      storageMap.clear();
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-algo',
        name: 'Algorithms & Data Structures',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        nodes: [
          { id: 'c1', name: 'Binary Search', summary: 'Search in sorted arrays' },
          { id: 'c2', name: 'Quick Sort', summary: 'Divide and conquer sorting' },
          { id: 'c3', name: 'Graph Traversal', summary: 'BFS and DFS' },
          { id: 'c4', name: 'Dynamic Programming', summary: 'Optimal substructure' }
        ],
        relationships: []
      };

      saveGraphData('graph-algo', graphData);

      // Mark 3 of 4 concepts as 'understood' in practice state
      updateConceptPracticeState('c1', 'understood', 'graph-algo');
      updateConceptPracticeState('c2', 'understood', 'graph-algo');
      updateConceptPracticeState('c3', 'understood', 'graph-algo');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.strictEqual(stats.activity.totalGraphs, 1);
      assert.strictEqual(formatTabularCount(stats.activity.totalGraphs), '01');
      assert.strictEqual(stats.activity.totalConcepts, 4);
      assert.strictEqual(stats.activity.demonstratedConcepts, 3);
      assert.strictEqual(stats.activity.demonstratedPercentage, 75); // 3 / 4 = 75%
    });

    it('orders recent activity by real update timestamps and caps at 3', () => {
      storageMap.clear();

      const g1: KnowledgeGraphMeta = {
        id: 'g-1',
        name: 'Distributed Systems',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-16T12:00:00.000Z'
      };
      const g2: KnowledgeGraphMeta = {
        id: 'g-2',
        name: 'Quantum Computing',
        createdAt: '2026-10-12T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z' // newest
      };
      const g3: KnowledgeGraphMeta = {
        id: 'g-3',
        name: 'Machine Learning',
        createdAt: '2026-10-11T10:00:00.000Z',
        updatedAt: '2026-10-15T15:00:00.000Z'
      };
      const g4: KnowledgeGraphMeta = {
        id: 'g-4',
        name: 'Compiler Design',
        createdAt: '2026-10-09T10:00:00.000Z',
        updatedAt: '2026-10-14T09:00:00.000Z'
      };

      const stats = calculatePersonaStats({ graphs: [g1, g2, g3, g4] });

      assert.strictEqual(stats.activity.totalGraphs, 4);
      assert.strictEqual(formatTabularCount(stats.activity.totalGraphs), '04');
      assert.strictEqual(stats.activity.recentGraphs.length, 3); // capped at 3
      assert.strictEqual(stats.activity.recentGraphs[0].graphId, 'g-2'); // Quantum Computing (newest)
      assert.strictEqual(stats.activity.recentGraphs[1].graphId, 'g-1'); // Distributed Systems
      assert.strictEqual(stats.activity.recentGraphs[2].graphId, 'g-3'); // Machine Learning
    });
  });
});
