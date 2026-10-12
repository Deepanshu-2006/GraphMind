import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import {
  createRevisionSession,
  navigateOrAppendToRevisionSession,
  saveRevisionSession,
  loadRevisionSession,
  clearRevisionSession
} from '../src/services/revisionSession';
import { saveStoredExplanation, clearStoredExplanations } from '../src/services/conceptExplanation';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };
}

const mockGraph: KnowledgeGraph = {
  id: 'graph-distributed-db',
  name: 'Distributed Database Systems',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  nodes: [
    {
      id: 'c-raft-consensus',
      name: 'Raft Consensus Protocol',
      type: 'protocol',
      description: 'Leader-based distributed consensus algorithm providing fault-tolerant replicated state machines.',
      sourceIds: ['src-raft-paper']
    },
    {
      id: 'c-leader-election',
      name: 'Leader Election',
      type: 'mechanism',
      description: 'Randomized election timeout protocol to establish a unique leader per term.',
      sourceIds: ['src-raft-paper']
    },
    {
      id: 'c-log-replication',
      name: 'Log Replication',
      type: 'mechanism',
      description: 'Two-phase log entry commitment across majority of follower nodes.',
      sourceIds: ['src-raft-paper']
    },
    {
      id: 'c-isolated-node',
      name: 'Isolated Concept',
      type: 'foundation',
      description: 'Stand-alone topic with zero connections.',
      sourceIds: []
    }
  ],
  relationships: [
    {
      id: 'rel-raft-election',
      source: 'c-raft-consensus',
      target: 'c-leader-election',
      type: 'initiates',
      description: 'Triggers when heartbeat timer elapses.'
    },
    {
      id: 'rel-raft-log',
      source: 'c-raft-consensus',
      target: 'c-log-replication',
      type: 'coordinates',
      description: 'Ensures entries committed in strict index order.'
    }
  ],
  sources: []
};

describe('GraphMind Feature: Deep Revision Workspace (Phase 2 — Task 08: Related Concepts & Knowledge Graph Connections)', () => {
  beforeEach(() => {
    clearRevisionSession();
    clearStoredExplanations();
  });

  describe('1. Identify Related Concepts from Real Graph Data (Section 1)', () => {
    test('resolves directly connected concepts from graph relationships without inventing fake links', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-raft-consensus',
          onBackToGraph: () => {}
        })
      );

      // Section heading and related items
      assert.ok(html.includes('Related concepts'), 'Must render Section 06: Related concepts heading');
      assert.ok(html.includes('Leader Election'), 'Must render outgoing related concept: Leader Election');
      assert.ok(html.includes('Log Replication'), 'Must render outgoing related concept: Log Replication');
      assert.ok(!html.includes('Isolated Concept'), 'Must NOT invent relationships to unrelated nodes');

      // Relationship types and directions
      assert.ok(html.includes('initiates'), 'Must render explicit relationship type: initiates');
      assert.ok(html.includes('coordinates'), 'Must render explicit relationship type: coordinates');
      assert.ok(html.includes('→ Outgoing'), 'Must identify outgoing relationship direction');
    });

    test('resolves incoming relationships when viewing target concepts', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-leader-election',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Related concepts'), 'Must render Related concepts section for target node');
      assert.ok(html.includes('Raft Consensus Protocol'), 'Must render incoming related concept name');
      assert.ok(html.includes('← Incoming'), 'Must identify incoming relationship direction');
    });

    test('omits Related Concepts section cleanly when concept has zero graph relationships', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-isolated-node',
          onBackToGraph: () => {}
        })
      );

      assert.ok(!html.includes('Related concepts'), 'Must omit section when node has no connections');
      assert.ok(!html.includes('revision-related-list'), 'Must not render empty list containers');
    });

    test('strictly isolates graphs and never mixes related concepts from different knowledge graphs', () => {
      const anotherGraph: KnowledgeGraph = {
        id: 'graph-quantum-computing',
        name: 'Quantum Computing',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
        nodes: [
          {
            id: 'c-qubit',
            name: 'Quantum Bit (Qubit)',
            type: 'foundation',
            description: 'Fundamental two-state quantum superposition unit.'
          }
        ],
        relationships: [],
        sources: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: anotherGraph,
          graphName: 'Quantum Computing',
          initialConceptId: 'c-qubit',
          onBackToGraph: () => {}
        })
      );

      assert.ok(!html.includes('Leader Election'), 'Must never leak nodes from another graph');
      assert.ok(!html.includes('Raft Consensus Protocol'), 'Must never leak nodes from another graph');
      assert.ok(!html.includes('Related concepts'), 'Must not display related section for unlinked qubit');
    });
  });

  describe('2. Editorial Layout & Concept Details (Section 2)', () => {
    test('renders minimal editorial layout with spacing and separators rather than bulky cards', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-raft-consensus',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-related-list'), 'Renders structured editorial list');
      assert.ok(html.includes('revision-related-item-wrapper'), 'Renders minimal item wrapper with separator');
      assert.ok(html.includes('revision-related-name'), 'Renders styled concept name element');
      assert.ok(html.includes('revision-related-relation'), 'Renders relationship type badge');
      assert.ok(html.includes('revision-related-desc'), 'Renders available concept description excerpt');
    });

    test('displays available concept descriptions and gracefully handles missing descriptions', () => {
      const graphWithNoDesc: KnowledgeGraph = {
        id: 'graph-minimal',
        name: 'Minimal Graph',
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
        nodes: [
          { id: 'c-node-a', name: 'Concept Alpha', type: 'core' },
          { id: 'c-node-b', name: 'Concept Beta', type: 'core' }
        ],
        relationships: [
          { id: 'rel-ab', source: 'c-node-a', target: 'c-node-b', type: 'leads-to' }
        ],
        sources: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: graphWithNoDesc,
          graphName: 'Minimal Graph',
          initialConceptId: 'c-node-a',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Concept Beta'), 'Renders target concept name');
      assert.ok(html.includes('leads to'), 'Renders relationship type');
      // Graceful without throwing or empty broken p tags
      assert.ok(!html.includes('<p class="revision-related-desc"></p>'), 'No empty description paragraphs');
    });
  });

  describe('3. Quick Exploration & Contextual Inspection (Section 3)', () => {
    test('renders Inspect button for each related concept with accessibility attributes', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-raft-consensus',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-related-inspect-btn'), 'Must render inspect button');
      assert.ok(html.includes('aria-label="Inspect Leader Election"'), 'Must have accessible label');
      assert.ok(html.includes('aria-expanded="false"'), 'Must indicate collapsed inspection state by default');
    });

    test('renders Explore in graph button for direct canvas navigation', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          initialConceptId: 'c-raft-consensus',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-related-graph-btn'), 'Must render explore in graph button');
      assert.ok(html.includes('Explore in graph'), 'Must display text label for exploration');
      assert.ok(html.includes('aria-label="Explore Leader Election in graph"'), 'Must have descriptive aria label');
    });
  });

  describe('4. Navigation Logic & Session Integrity (Section 4 & 5)', () => {
    test('navigateOrAppendToRevisionSession jumps to existing index when concept is already in session', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['c-raft-consensus', 'c-leader-election', 'c-log-replication'],
        currentIndex: 0,
        currentConceptId: 'c-raft-consensus'
      });

      // Target already exists at index 1
      const updated = navigateOrAppendToRevisionSession(session, 'c-leader-election');

      assert.strictEqual(updated.conceptIds.length, 3, 'Must NOT duplicate or change session length');
      assert.strictEqual(updated.currentIndex, 1, 'Must jump to existing concept index');
      assert.strictEqual(updated.currentConceptId, 'c-leader-election', 'Must update currentConceptId');
      assert.ok(updated.reviewedConceptIds.includes('c-raft-consensus'), 'Must mark departed concept as reviewed');
    });

    test('navigateOrAppendToRevisionSession deliberately appends new concept when not in session', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['c-raft-consensus'],
        currentIndex: 0,
        currentConceptId: 'c-raft-consensus'
      });

      // Target c-leader-election is not in session
      const updated = navigateOrAppendToRevisionSession(session, 'c-leader-election');

      assert.strictEqual(updated.conceptIds.length, 2, 'Must append target concept to session');
      assert.deepStrictEqual(updated.conceptIds, ['c-raft-consensus', 'c-leader-election']);
      assert.strictEqual(updated.currentIndex, 1, 'Must jump to new appended index');
      assert.strictEqual(updated.currentConceptId, 'c-leader-election');
      assert.strictEqual(updated.totalConcepts, 2);
    });

    test('preserves session state and current concept when exploring graph', () => {
      let savedSessionTarget: string | null = null;
      let onViewGraphTarget: string | undefined = undefined;

      const initialSession = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['c-raft-consensus', 'c-leader-election'],
        currentIndex: 0,
        currentConceptId: 'c-raft-consensus'
      });

      saveRevisionSession(initialSession, mockGraph.id);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Database Systems',
          controlledSession: initialSession,
          onViewGraph: (targetId) => {
            onViewGraphTarget = targetId;
          },
          onBackToGraph: () => {}
        })
      );

      // Verify stored session still intact
      const loaded = loadRevisionSession(mockGraph.id);
      assert.ok(loaded, 'Must have saved revision session');
      assert.strictEqual(loaded.currentConceptId, 'c-raft-consensus', 'Must preserve current concept');
      assert.strictEqual(loaded.currentIndex, 0, 'Must preserve current index');
    });
  });

  describe('5. Visual Design & Swiss-Editorial CSS Tokens (Section 2 & 8)', () => {
    test('enforces strict Swiss-editorial styling tokens without linear gradients or blur', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      // Zero banned visual clutter
      assert.ok(!css.includes('linear-gradient'), 'Must never use linear-gradient in revision.css');
      assert.ok(!css.includes('backdrop-filter: blur'), 'Must never use blur glassmorphism in revision.css');

      // Required related concepts classes
      assert.ok(css.includes('.revision-related-list'), 'Must define .revision-related-list');
      assert.ok(css.includes('.revision-related-item-wrapper'), 'Must define .revision-related-item-wrapper');
      assert.ok(css.includes('.revision-related-item'), 'Must define .revision-related-item');
      assert.ok(css.includes('.revision-related-name'), 'Must define .revision-related-name');
      assert.ok(css.includes('.revision-related-relation'), 'Must define .revision-related-relation');
      assert.ok(css.includes('.revision-related-dir-badge'), 'Must define .revision-related-dir-badge');
      assert.ok(css.includes('.revision-related-inspect-btn'), 'Must define .revision-related-inspect-btn');
      assert.ok(css.includes('.revision-related-graph-btn'), 'Must define .revision-related-graph-btn');
      assert.ok(css.includes('.revision-related-inspect-box'), 'Must define .revision-related-inspect-box');
      assert.ok(css.includes('.revision-inspect-open-btn'), 'Must define .revision-inspect-open-btn');
      assert.ok(css.includes('.revision-inspect-graph-btn'), 'Must define .revision-inspect-graph-btn');
    });

    test('defines focus-visible outlines and accessibility states for keyboard navigation', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      assert.ok(css.includes('.revision-related-inspect-btn:focus-visible'), 'Inspect button must have focus-visible');
      assert.ok(css.includes('.revision-related-graph-btn:focus-visible'), 'Graph button must have focus-visible');
      assert.ok(css.includes('.revision-inspect-open-btn:focus-visible'), 'Revise button must have focus-visible');
      assert.ok(css.includes('.revision-inspect-graph-btn:focus-visible'), 'Inspect graph button must have focus-visible');
    });
  });
});
