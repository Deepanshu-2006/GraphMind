import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
  getKnowledgeState, 
  updateKnowledgeState, 
  recordConceptStudy, 
  getConceptsByKnowledgeState,
  loadConceptPracticeStates,
  saveConceptPracticeStates
} from '../src/services/storage';
import { getConceptReviewPriority } from '../src/types/practice';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import type { Node, Edge } from '@xyflow/react';
import type { GraphConceptData } from '../src/types/graph';

// In-memory mock for localStorage in Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('GraphMind Phase 3: Knowledge State & Living Revision Map', () => {

  describe('1. Four Semantic Knowledge States (Section 1)', () => {
    test('returns unseen for a concept that has not been studied', () => {
      storageMap.clear();
      const state = getKnowledgeState('test-graph', 'concept-cpu');
      assert.equal(state.status, 'unseen');
      assert.equal(state.practiceCount, 0);
    });

    test('transitions unseen -> learning on meaningful study interaction (Section 7 & 8)', () => {
      storageMap.clear();
      const initial = getKnowledgeState('test-graph', 'concept-process');
      assert.equal(initial.status, 'unseen');

      const learned = recordConceptStudy('test-graph', 'concept-process');
      assert.equal(learned.status, 'learning');
      assert.ok(learned.firstStudiedAt, 'firstStudiedAt must be recorded');
      assert.ok(learned.lastStudiedAt, 'lastStudiedAt must be recorded');
      assert.equal(learned.firstStudiedAt, learned.lastStudiedAt);
    });

    test('opening an already learning, needs-review, or understood concept does not demote it (Section 7 & 28)', () => {
      storageMap.clear();
      // Set to understood
      updateKnowledgeState('test-graph', 'concept-rr', 'understood');
      assert.equal(getKnowledgeState('test-graph', 'concept-rr').status, 'understood');

      // Attempt to study again
      const reopened = recordConceptStudy('test-graph', 'concept-rr');
      assert.equal(reopened.status, 'understood', 'Must NOT demote understood concept upon reopening');

      // Set to needs-review
      updateKnowledgeState('test-graph', 'concept-sjf', 'needs-review');
      const reopenedReview = recordConceptStudy('test-graph', 'concept-sjf');
      assert.equal(reopenedReview.status, 'needs-review', 'Must NOT demote needs-review concept upon reopening');
    });

    test('self-assessing AGAIN transitions learning -> needs-review and understood -> needs-review', () => {
      storageMap.clear();
      // 1. learning -> needs-review
      recordConceptStudy('test-graph', 'concept-fcfs');
      assert.equal(getKnowledgeState('test-graph', 'concept-fcfs').status, 'learning');

      const reviewState = updateKnowledgeState('test-graph', 'concept-fcfs', 'needs-review');
      assert.equal(reviewState.status, 'needs-review');
      assert.equal(reviewState.practiceCount, 1);
      assert.ok(reviewState.lastPracticedAt);

      // 2. understood -> needs-review
      updateKnowledgeState('test-graph', 'concept-fcfs', 'understood');
      assert.equal(getKnowledgeState('test-graph', 'concept-fcfs').status, 'understood');

      const reReview = updateKnowledgeState('test-graph', 'concept-fcfs', 'needs-review');
      assert.equal(reReview.status, 'needs-review');
      assert.equal(reReview.practiceCount, 3);
    });

    test('self-assessing GOT IT transitions learning/needs-review -> understood', () => {
      storageMap.clear();
      updateKnowledgeState('test-graph', 'concept-aging', 'needs-review');
      const understood = updateKnowledgeState('test-graph', 'concept-aging', 'understood');
      assert.equal(understood.status, 'understood');
      assert.equal(understood.practiceCount, 2);
    });
  });

  describe('2. Multi-Graph Isolation & Persistence (Section 5 & 24)', () => {
    test('concept states are strictly scoped to graphId and do not leak between graphs', () => {
      storageMap.clear();
      // Graph A: CPU Scheduling is understood
      updateKnowledgeState('graph-operating-systems', 'concept-cpu', 'understood');

      // Graph B: CPU Scheduling is unseen
      const graphBState = getKnowledgeState('graph-computer-networks', 'concept-cpu');
      assert.equal(graphBState.status, 'unseen', 'State must NOT leak between graphs');

      // Graph A must retain understood
      const graphAState = getKnowledgeState('graph-operating-systems', 'concept-cpu');
      assert.equal(graphAState.status, 'understood');
    });

    test('querying concepts by knowledge state filters accurately per graph (Section 31)', () => {
      storageMap.clear();
      updateKnowledgeState('graph-os', 'fcfs', 'understood');
      updateKnowledgeState('graph-os', 'sjf', 'needs-review');
      updateKnowledgeState('graph-os', 'rr', 'needs-review');
      recordConceptStudy('graph-os', 'aging');

      const reviewConcepts = getConceptsByKnowledgeState('graph-os', 'needs-review');
      assert.deepEqual(reviewConcepts.sort(), ['rr', 'sjf']);

      const understoodConcepts = getConceptsByKnowledgeState('graph-os', 'understood');
      assert.deepEqual(understoodConcepts, ['fcfs']);

      const learningConcepts = getConceptsByKnowledgeState('graph-os', 'learning');
      assert.deepEqual(learningConcepts, ['aging']);
    });
  });

  describe('3. Lightweight Review Priority Scoring (Section 11)', () => {
    test('calculates correct review priorities without numerical gamification', () => {
      assert.equal(getConceptReviewPriority('needs-review'), 2);
      assert.equal(getConceptReviewPriority('learning'), 1);
      assert.equal(getConceptReviewPriority('understood'), 0);
      assert.equal(getConceptReviewPriority('unseen'), 0);
    });
  });

  describe('4. "NEEDS REVIEW" Graph View & Dimming Filter (Section 12, 13, 14, 26)', () => {
    const sampleNodes: Node<GraphConceptData>[] = [
      {
        id: 'cpu',
        position: { x: 0, y: 0 },
        data: {
          id: 'cpu',
          label: 'CPU Scheduling',
          code: 'cpu',
          category: 'Foundation',
          description: 'CPU allocation.',
          prerequisites: [],
          relationships: [],
          confidence: 90,
          source: 'OS.pdf',
          synapseCount: 3
        }
      },
      {
        id: 'fcfs',
        position: { x: 100, y: 100 },
        data: {
          id: 'fcfs',
          label: 'FCFS',
          code: 'fcfs',
          category: 'Method',
          description: 'First come first served.',
          prerequisites: [],
          relationships: [],
          confidence: 85,
          source: 'OS.pdf',
          synapseCount: 1
        }
      },
      {
        id: 'sjf',
        position: { x: 200, y: 100 },
        data: {
          id: 'sjf',
          label: 'SJF',
          code: 'sjf',
          category: 'Method',
          description: 'Shortest job first.',
          prerequisites: [],
          relationships: [],
          confidence: 85,
          source: 'OS.pdf',
          synapseCount: 1
        }
      },
      {
        id: 'unrelated',
        position: { x: 400, y: 400 },
        data: {
          id: 'unrelated',
          label: 'Disk Scheduling',
          code: 'disk',
          category: 'Architecture',
          description: 'Secondary storage allocation.',
          prerequisites: [],
          relationships: [],
          confidence: 80,
          source: 'OS.pdf',
          synapseCount: 0
        }
      }
    ];

    const sampleEdges: Edge[] = [
      { id: 'e1', source: 'cpu', target: 'fcfs' },
      { id: 'e2', source: 'cpu', target: 'sjf' }
    ];

    test('dims unrelated nodes and highlights review concepts and connected neighbors in NEEDS REVIEW mode (Section 12 & 14)', () => {
      // Setup practice states: SJF needs review, FCFS understood, Disk Scheduling unseen
      const practiceStates = {
        sjf: { conceptId: 'sjf', status: 'needs-review' as const, practiceCount: 1 },
        fcfs: { conceptId: 'fcfs', status: 'understood' as const, practiceCount: 1 },
        unrelated: { conceptId: 'unrelated', status: 'unseen' as const, practiceCount: 0 }
      };

      const result = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'needs-review',
        practiceStates
      });

      // SJF is the review node: must be fully visible and focused
      const sjfNode = result.visibleNodes.find(n => n.id === 'sjf');
      assert.ok(sjfNode);
      assert.equal(sjfNode.data.dimmed, false);
      assert.equal(sjfNode.data.visibilityState, 'focused');

      // CPU is a direct neighbor of SJF: must remain contextually visible (not dimmed)
      const cpuNode = result.visibleNodes.find(n => n.id === 'cpu');
      assert.ok(cpuNode);
      assert.equal(cpuNode.data.dimmed, false);
      assert.equal(cpuNode.data.highlighted, true);

      // Unrelated Disk Scheduling node: must be dimmed
      const unrelatedNode = result.visibleNodes.find(n => n.id === 'unrelated');
      assert.ok(unrelatedNode);
      assert.equal(unrelatedNode.data.dimmed, true);

      // Connected edge (cpu -> sjf) must remain highlighted
      const sjfEdge = result.visibleEdges.find(e => e.id === 'e2');
      assert.ok(sjfEdge);
      assert.equal(sjfEdge.className, 'highlighted');
    });

    test('restores full graph smoothly in ALL mode (Section 13)', () => {
      const practiceStates = {
        sjf: { conceptId: 'sjf', status: 'needs-review' as const, practiceCount: 1 }
      };

      const result = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'all',
        practiceStates
      });

      // In ALL mode without selection, no node should be artificially dimmed
      for (const node of result.visibleNodes) {
        assert.equal(node.data.dimmed, false);
      }
    });

    test('handles empty review state gracefully without breaking the graph (Section 26)', () => {
      // 0 concepts marked for review
      const practiceStates = {
        fcfs: { conceptId: 'fcfs', status: 'understood' as const, practiceCount: 1 }
      };

      const result = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'needs-review',
        practiceStates
      });

      assert.equal(result.contextualHint, 'Nothing needs review yet');
      // No nodes should be dimmed out when none need review
      for (const node of result.visibleNodes) {
        assert.equal(node.data.dimmed, false);
      }
    });
  });
});
