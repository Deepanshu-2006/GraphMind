import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeSource } from '../src/types/knowledgeGraph';
import type { ConceptExplanation, ExplanationState } from '../src/types/explanation';
import {
  extractConceptSourceContext,
  synthesizeGroundedExplanation,
  getOrGenerateConceptExplanation,
  loadStoredExplanation,
  saveStoredExplanation,
  clearStoredExplanations,
  getExplanationStorageKey,
  STORAGE_EXPLANATION_PREFIX
} from '../src/services/conceptExplanation';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; },
    key: (index: number) => Array.from(storageMap.keys())[index] || null
  };
}

describe('GraphMind Feature: Deep Revision Workspace (Phase 2 — Task 05: Source-Grounded Concept Explanations)', () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  let cssContent: string;

  beforeEach(() => {
    storageMap.clear();
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  const mockSource1: KnowledgeSource = {
    id: 'src-os-textbook',
    name: 'Operating System Concepts (Silberschatz et al.)',
    fileName: 'OS_Concepts_10th.pdf',
    type: 'pdf',
    text: 'CPU scheduling algorithms allocate processing cycles to ready tasks. Preemptive scheduling allows interruption of active jobs.',
    createdAt: '2026-09-01T00:00:00Z',
    status: 'Indexed'
  };

  const mockSource2: KnowledgeSource = {
    id: 'src-kernel-internals',
    name: 'UNIX Kernel Architecture Guide',
    fileName: 'Unix_Kernel.pdf',
    type: 'pdf',
    text: 'Process dispatching selects the highest-priority runnable thread from the system runqueue using context switching.',
    createdAt: '2026-09-05T00:00:00Z',
    status: 'Indexed'
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-os-core',
    name: 'Operating Systems Architecture',
    sources: [mockSource1, mockSource2],
    nodes: [
      {
        id: 'c-cpu-sched',
        name: 'CPU Scheduling',
        type: 'foundation',
        description: 'Methods and policies determining which process in the ready queue is allocated the CPU.',
        sourceIds: ['src-os-textbook'],
        prerequisites: ['Process State', 'Context Switch'],
        isCoreConcept: true,
        evidence: 'CPU scheduling is the basis of multiprogrammed operating systems, maximizing CPU utilization through multiplexing.',
        evidenceItems: [
          {
            sourceId: 'src-os-textbook',
            page: 182,
            text: 'CPU scheduling is the basis of multiprogrammed operating systems, maximizing CPU utilization through multiplexing.'
          }
        ]
      },
      {
        id: 'c-preemption',
        name: 'Preemptive Scheduling',
        type: 'method',
        description: 'Mechanism allowing the operating system to interrupt a currently running process when higher priority tasks arrive.',
        sourceIds: ['src-os-textbook', 'src-kernel-internals'],
        prerequisites: ['CPU Scheduling'],
        evidence: 'Preemptive scheduling incurs context switch overhead but guarantees bounded responsiveness for interactive workloads.',
        evidenceItems: [
          {
            sourceId: 'src-os-textbook',
            page: 188,
            text: 'Preemptive scheduling incurs context switch overhead but guarantees bounded responsiveness for interactive workloads.'
          },
          {
            sourceId: 'src-kernel-internals',
            page: 44,
            text: 'The dispatcher forces context switches on timer tick expiration or asynchronous hardware interrupt.'
          }
        ]
      },
      {
        id: 'c-insufficient',
        name: 'Obscure Token',
        type: 'concept',
        description: '', // Empty description
        sourceIds: [],
        evidence: '' // No evidence
      }
    ],
    relationships: [
      {
        id: 'rel-1',
        source: 'c-cpu-sched',
        target: 'c-preemption',
        type: 'enables',
        description: 'CPU scheduling framework supports preemptive policies.',
        sourceChunkIds: []
      }
    ]
  };

  describe('1. Explanation Structure & Schema Definition (Section 2)', () => {
    test('synthesizes a valid structured explanation containing all mandatory fields', () => {
      const result = extractConceptSourceContext(mockGraph, 'c-cpu-sched');
      assert.equal(result.status, 'found');
      if (result.status !== 'found') return;

      const explanation = synthesizeGroundedExplanation(result.context);

      assert.equal(explanation.graphId, 'graph-os-core');
      assert.equal(explanation.conceptId, 'c-cpu-sched');
      assert.equal(explanation.conceptName, 'CPU Scheduling');
      assert.ok(explanation.overview.length >= 20, 'Overview must provide a clear conceptual summary');
      assert.ok(Array.isArray(explanation.detailedExplanation), 'Detailed explanation must be an array of paragraphs');
      assert.ok(explanation.detailedExplanation.length >= 1, 'Must have at least one detailed explanation paragraph');
      assert.ok(explanation.sourceReferences.length > 0, 'Must contain source references');
      assert.equal(explanation.isSourceGrounded, true, 'Must be marked as source-grounded');
      assert.ok(explanation.generatedAt, 'Must have generation timestamp');
    });

    test('omits unsupported optional sections when source text contains no examples', () => {
      const result = extractConceptSourceContext(mockGraph, 'c-cpu-sched');
      assert.equal(result.status, 'found');
      if (result.status !== 'found') return;

      const explanation = synthesizeGroundedExplanation(result.context);
      // Because the mock evidence has no "for example" phrasing, examples is undefined rather than fabricated
      assert.equal(explanation.examples, undefined, 'Must not invent examples when unsupported by source');
    });
  });

  describe('2. Grounding in Real Sources & Integrity (Section 3)', () => {
    test('prioritizes direct source passages and real document titles from knowledge graph', () => {
      const result = extractConceptSourceContext(mockGraph, 'c-preemption');
      assert.equal(result.status, 'found');
      if (result.status !== 'found') return;

      const explanation = synthesizeGroundedExplanation(result.context);

      // Verify source titles match actual graph sources
      assert.equal(explanation.sourceReferences.length, 2, 'Must include both evidence passages');
      assert.equal(explanation.sourceReferences[0].sourceTitle, 'Operating System Concepts (Silberschatz et al.)');
      assert.equal(explanation.sourceReferences[0].page, 188);
      assert.ok(explanation.sourceReferences[0].excerpt.includes('Preemptive scheduling incurs context switch overhead'));

      assert.equal(explanation.sourceReferences[1].sourceTitle, 'UNIX Kernel Architecture Guide');
      assert.equal(explanation.sourceReferences[1].page, 44);
      assert.ok(explanation.sourceReferences[1].excerpt.includes('dispatcher forces context switches'));

      assert.equal(explanation.groundingConfidence, 'high', 'Multi-evidence items yield high confidence');
    });

    test('grounds related concepts strictly in verified graph relationships', () => {
      const result = extractConceptSourceContext(mockGraph, 'c-cpu-sched');
      assert.equal(result.status, 'found');
      if (result.status !== 'found') return;

      const explanation = synthesizeGroundedExplanation(result.context);
      assert.ok(explanation.relatedConceptReferences, 'Must include verified relationships');
      assert.equal(explanation.relatedConceptReferences?.length, 1);
      assert.equal(explanation.relatedConceptReferences?.[0].conceptName, 'Preemptive Scheduling');
      assert.equal(explanation.relatedConceptReferences?.[0].relationshipType, 'enables');
    });
  });

  describe('3. Insufficient & Empty Material Handling (Section 3 & 6)', () => {
    test('returns status "insufficient" with missing reason when material is inadequate', () => {
      const result = extractConceptSourceContext(mockGraph, 'c-insufficient');
      assert.equal(result.status, 'insufficient');
      if (result.status !== 'insufficient') return;

      assert.ok(result.reason.includes('do not contain sufficient documented definitions'));
      assert.ok(result.reason.includes('Obscure Token'));
    });

    test('returns status "empty" when concept ID does not exist in graph', () => {
      const result = extractConceptSourceContext(mockGraph, 'non-existent-concept');
      assert.equal(result.status, 'empty');
    });

    test('getOrGenerateConceptExplanation returns insufficient state without fabricating content', async () => {
      const state = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-insufficient'
      });

      assert.equal(state.status, 'insufficient');
      assert.equal(state.conceptId, 'c-insufficient');
      assert.equal(state.graphId, 'graph-os-core');
      assert.ok(state.insufficientReason?.includes('do not contain sufficient'));
    });
  });

  describe('4. Concept ID & Knowledge Graph Isolation (Section 5)', () => {
    test('strictly scopes storage cache by both graphId and conceptId', () => {
      const key1 = getExplanationStorageKey('graph-A', 'concept-1');
      const key2 = getExplanationStorageKey('graph-B', 'concept-1');

      assert.notEqual(key1, key2, 'Keys for different graphs must never collide');
      assert.equal(key1, `${STORAGE_EXPLANATION_PREFIX}graph-A_concept-1`);
    });

    test('never returns an explanation from another graph even with identical concept IDs', () => {
      const explanationGraphA: ConceptExplanation = {
        graphId: 'graph-A',
        conceptId: 'shared-concept-id',
        conceptName: 'Deadlock',
        overview: 'Deadlock in Graph A context.',
        detailedExplanation: ['Paragraph 1'],
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanationGraphA);

      // Loading for graph A returns the explanation
      const loadedA = loadStoredExplanation('graph-A', 'shared-concept-id');
      assert.ok(loadedA);
      assert.equal(loadedA?.graphId, 'graph-A');

      // Loading for graph B with same concept ID returns null (strictly isolated)
      const loadedB = loadStoredExplanation('graph-B', 'shared-concept-id');
      assert.equal(loadedB, null, 'Cross-graph leakage must be blocked');
    });

    test('clearing explanations for one graph does not affect another graph', () => {
      const expA: ConceptExplanation = {
        graphId: 'graph-A',
        conceptId: 'concept-1',
        conceptName: 'Thread',
        overview: 'Overview A',
        detailedExplanation: ['A'],
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      const expB: ConceptExplanation = {
        graphId: 'graph-B',
        conceptId: 'concept-1',
        conceptName: 'Thread',
        overview: 'Overview B',
        detailedExplanation: ['B'],
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(expA);
      saveStoredExplanation(expB);

      clearStoredExplanations('graph-A');

      assert.equal(loadStoredExplanation('graph-A', 'concept-1'), null);
      assert.ok(loadStoredExplanation('graph-B', 'concept-1') !== null, 'Graph B must remain intact');
    });
  });

  describe('5. Generation Lifecycle & Request Deduplication (Section 6)', () => {
    test('deduplicates concurrent in-flight requests for the same concept', async () => {
      const promise1 = getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-cpu-sched'
      });

      const promise2 = getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-cpu-sched'
      });

      // Both should resolve to the exact same result
      const [res1, res2] = await Promise.all([promise1, promise2]);
      assert.equal(res1.status, 'ready');
      assert.equal(res2.status, 'ready');
      assert.equal(res1.explanation?.conceptId, res2.explanation?.conceptId);
    });

    test('respects forceRegenerate to bypass cache when retrying', async () => {
      const initial = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-cpu-sched'
      });
      assert.equal(initial.status, 'ready');

      const regenerated = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-cpu-sched',
        forceRegenerate: true
      });
      assert.equal(regenerated.status, 'ready');
      assert.equal(regenerated.explanation?.conceptId, 'c-cpu-sched');
    });
  });

  describe('6. UI Integration & Rendering States in RevisionWorkspace (Section 6 & 8)', () => {
    test('renders source-grounded explanation structure when ready', () => {
      // Pre-populate cache so SSR render has ready explanation
      const result = extractConceptSourceContext(mockGraph, 'c-cpu-sched');
      if (result.status === 'found') {
        const explanation = synthesizeGroundedExplanation(result.context);
        saveStoredExplanation(explanation);
      }

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems Architecture',
          initialConceptId: 'c-cpu-sched',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Understanding the concept'), 'Must render understanding heading');
      assert.ok(html.includes('revision-explanation-lead'), 'Must render conceptual overview lead');
      assert.ok(html.includes('Key Terminology'), 'Must render key terminology section');
      assert.ok(html.includes('Process State'), 'Must render prerequisite term from source');
      assert.ok(html.includes('Important Points'), 'Must render important points section');
      assert.ok(html.includes('Source References'), 'Must render source references section');
      assert.ok(html.includes('SOURCE GROUNDED'), 'Must render SOURCE GROUNDED badge');
      assert.ok(html.includes('Operating System Concepts'), 'Must render real source textbook name');
    });

    test('renders insufficient source material card without crashing or inventing facts', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems Architecture',
          initialConceptId: 'c-insufficient',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('SOURCE GROUNDING / INSUFFICIENT MATERIAL'), 'Must render insufficient kicker');
      assert.ok(html.includes('Detailed explanation unavailable'), 'Must render unavailable title');
      assert.ok(html.includes('Obscure Token'), 'Must mention the affected concept name');
    });

    test('preserves revision session progress and navigation during explanation display', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems Architecture',
          revisionIndex: 1, // At concept 2 (c-preemption)
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('02 / 03'), 'Must preserve 02 / 03 progress counter');
      assert.ok(html.includes('Preemptive Scheduling'), 'Must display active concept');
      assert.ok(html.includes('Previous concept'), 'Must maintain previous concept link');
      assert.ok(html.includes('Next concept'), 'Must maintain next concept link');
    });
  });

  describe('7. Editorial CSS & Typography Compliance', () => {
    test('enforces editorial styling tokens without gradients or glassmorphism', () => {
      assert.ok(cssContent.includes('.revision-explanation-lead'), 'CSS must define lead paragraph styling');
      assert.ok(cssContent.includes('.revision-source-badge'), 'CSS must define source grounded badge');
      assert.ok(cssContent.includes('.revision-insufficient-card'), 'CSS must define insufficient card');
      assert.ok(cssContent.includes('.revision-term-item'), 'CSS must define term items');
      assert.ok(!cssContent.includes('linear-gradient'), 'Must preserve zero decorative linear gradients in revision styles');
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'Must avoid glassmorphism');
    });
  });
});
