import test, { describe, beforeEach, after } from 'node:test';
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
  computeStringHash,
  computeConceptSourceFingerprint,
  STORAGE_EXPLANATION_PREFIX,
  clearInFlightRequests
} from '../src/services/conceptExplanation';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (index: number) => Array.from(storageMap.keys())[index] || null
};

describe('GraphMind Feature: Deep Revision Workspace (Phase 2 — Task 09: Explanation Caching and Source Attribution)', { concurrency: 1 }, () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  let cssContent: string;
  const originalViteKey = process.env.VITE_GEMINI_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    storageMap.clear();
    clearInFlightRequests();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    delete process.env.VITE_GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  after(() => {
    if (originalViteKey !== undefined) process.env.VITE_GEMINI_API_KEY = originalViteKey;
    if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  const mockSourceA: KnowledgeSource = {
    id: 'src-dist-sys-book',
    name: 'Distributed Systems Principles (Tanenbaum)',
    fileName: 'Dist_Systems_Tanenbaum.pdf',
    type: 'pdf',
    text: 'Lamport logical clocks assign monotonically increasing sequence numbers to events to define a partial ordering based on the happened-before relation.',
    createdAt: '2026-09-01T00:00:00Z',
    status: 'Indexed'
  };

  const mockSourceB: KnowledgeSource = {
    id: 'src-vector-clocks-paper',
    name: 'Vector Clocks & Distributed Ordering (Mattern)',
    fileName: 'Vector_Clocks_Mattern.pdf',
    type: 'pdf',
    text: 'Vector clocks generalize scalar logical clocks by maintaining an array of logical clocks at each node to detect causal concurrency.',
    createdAt: '2026-09-02T00:00:00Z',
    status: 'Indexed'
  };

  const mockSourceC: KnowledgeSource = {
    id: 'src-consensus-notes',
    name: 'Raft & Paxos Consensus Lecture Notes',
    fileName: 'Consensus_Notes.pdf',
    type: 'pdf',
    text: 'State machine replication requires consistent log ordering across replicas through quorum consensus protocols.',
    createdAt: '2026-09-03T00:00:00Z',
    status: 'Indexed'
  };

  const mockNodeA: KnowledgeNode = {
    id: 'c-lamport-clocks',
    name: 'Lamport Logical Clocks',
    type: 'mechanism',
    description: 'A mechanism to order events in distributed systems without synchronized physical clocks.',
    sourceIds: ['src-dist-sys-book'],
    isCoreConcept: true,
    evidence: 'Lamport logical clocks define a partial ordering using monotonic counters.',
    evidenceItems: [
      {
        sourceId: 'src-dist-sys-book',
        page: 245,
        chunkId: 'chunk-lamport-01',
        text: 'Lamport logical clocks assign monotonically increasing sequence numbers to events.'
      }
    ]
  };

  const mockNodeB: KnowledgeNode = {
    id: 'c-vector-clocks',
    name: 'Vector Clocks',
    type: 'algorithm',
    description: 'An algorithm for tracking causal relationships and concurrency across distributed processes.',
    sourceIds: ['src-vector-clocks-paper'],
    isCoreConcept: true,
    evidence: 'Vector clocks maintain an integer vector of size N to detect concurrent events.',
    evidenceItems: [
      {
        sourceId: 'src-vector-clocks-paper',
        page: 54,
        chunkId: 'chunk-vector-01',
        text: 'Vector clocks generalize scalar logical clocks by maintaining an array of logical clocks.'
      }
    ]
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-distributed-systems',
    name: 'Distributed Systems Architecture',
    sources: [mockSourceA, mockSourceB, mockSourceC],
    nodes: [mockNodeA, mockNodeB],
    relationships: [
      {
        id: 'rel-1',
        source: 'c-lamport-clocks',
        target: 'c-vector-clocks',
        type: 'foundation-for',
        description: 'Lamport clocks provide the scalar foundation extended by vector clocks.'
      }
    ]
  };

  describe('1. Explanation Storage & Cache Strategy', () => {
    test('stores explanations with stable graphId and conceptId association', async () => {
      const state = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });

      assert.strictEqual(state.status, 'ready');
      assert.ok(state.explanation);

      const raw = storageMap.get(`${STORAGE_EXPLANATION_PREFIX}graph-distributed-systems_c-lamport-clocks`);
      assert.ok(raw, 'Explanation must be persisted in localStorage');

      const parsed = JSON.parse(raw!);
      assert.strictEqual(parsed.graphId, 'graph-distributed-systems');
      assert.strictEqual(parsed.conceptId, 'c-lamport-clocks');
      assert.ok(parsed.sourceFingerprint, 'Explanation must be tagged with a sourceFingerprint');
    });

    test('reuses cached explanation when underlying source material has not changed', async () => {
      // First generation
      const firstResult = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });
      assert.strictEqual(firstResult.status, 'ready');
      const firstTimestamp = firstResult.explanation?.generatedAt;

      // Second request without forceRegenerate must hit cache directly
      const secondResult = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });

      assert.strictEqual(secondResult.status, 'ready');
      assert.strictEqual(secondResult.explanation?.generatedAt, firstTimestamp, 'Must reuse identical cached record');
      assert.strictEqual(secondResult.explanation?.sourceFingerprint, firstResult.explanation?.sourceFingerprint);
    });

    test('isolates stored explanations strictly by graphId to prevent cross-graph leakage', async () => {
      await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });

      const otherGraph: KnowledgeGraph = {
        ...mockGraph,
        id: 'graph-advanced-os'
      };

      const fromOtherGraph = loadStoredExplanation('graph-advanced-os', 'c-lamport-clocks');
      assert.strictEqual(fromOtherGraph, null, 'Must not return cached explanations across different graph IDs');
    });
  });

  describe('2. Source Versioning & Granular Invalidation', () => {
    test('detects when relevant source material changes and returns outdated status', async () => {
      const init = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });
      assert.strictEqual(init.status, 'ready');

      // Modify the text of mockSourceA (which c-lamport-clocks is linked to)
      const updatedSourceA: KnowledgeSource = {
        ...mockSourceA,
        text: 'REVISED TEXT: Lamport logical clocks assign monotonically increasing logical timestamps under strict partial ordering with Byzantine extensions.'
      };

      const updatedGraph: KnowledgeGraph = {
        ...mockGraph,
        sources: [updatedSourceA, mockSourceB, mockSourceC]
      };

      // Subsequent query must detect stale fingerprint
      const staleCheck = await getOrGenerateConceptExplanation({
        graph: updatedGraph,
        conceptId: 'c-lamport-clocks'
      });

      assert.strictEqual(staleCheck.status, 'outdated');
      assert.ok(staleCheck.explanation);
      assert.strictEqual(staleCheck.explanation.isOutdated, true);
      assert.ok(staleCheck.outdatedReason, 'Must provide reason for outdated status');
    });

    test('granular invalidation: does NOT invalidate explanations when an unrelated source changes', async () => {
      // Generate explanations for both concepts
      await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });
      await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-vector-clocks'
      });

      // Modify mockSourceC (Consensus Notes), which neither c-lamport-clocks nor c-vector-clocks uses
      const updatedSourceC: KnowledgeSource = {
        ...mockSourceC,
        text: 'NEW CONSENSUS RESEARCH: Paxos variants now utilize generalized consensus mechanisms.'
      };

      const graphWithSourceCUpdated: KnowledgeGraph = {
        ...mockGraph,
        sources: [mockSourceA, mockSourceB, updatedSourceC]
      };

      // Both c-lamport-clocks and c-vector-clocks should remain valid and ready!
      const lamportCheck = await getOrGenerateConceptExplanation({
        graph: graphWithSourceCUpdated,
        conceptId: 'c-lamport-clocks'
      });
      const vectorCheck = await getOrGenerateConceptExplanation({
        graph: graphWithSourceCUpdated,
        conceptId: 'c-vector-clocks'
      });

      assert.strictEqual(lamportCheck.status, 'ready', 'Lamport clocks explanation must remain valid when unrelated source changes');
      assert.strictEqual(vectorCheck.status, 'ready', 'Vector clocks explanation must remain valid when unrelated source changes');
    });

    test('invalidates only the specific concept affected by its relevant source change', async () => {
      await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });
      await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-vector-clocks'
      });

      // Modify mockSourceB (only used by c-vector-clocks)
      const updatedSourceB: KnowledgeSource = {
        ...mockSourceB,
        text: 'VECTOR CLOCK UPDATE: Modern implementations optimize sparse vectors using dynamic hash maps.'
      };

      const graphWithBUpdated: KnowledgeGraph = {
        ...mockGraph,
        sources: [mockSourceA, updatedSourceB, mockSourceC]
      };

      const lamportCheck = await getOrGenerateConceptExplanation({
        graph: graphWithBUpdated,
        conceptId: 'c-lamport-clocks'
      });
      const vectorCheck = await getOrGenerateConceptExplanation({
        graph: graphWithBUpdated,
        conceptId: 'c-vector-clocks'
      });

      assert.strictEqual(lamportCheck.status, 'ready', 'Lamport clocks must remain ready');
      assert.strictEqual(vectorCheck.status, 'outdated', 'Vector clocks must be marked outdated');
    });

    test('regenerates explanation on demand when forceRegenerate is true', async () => {
      // Modify source
      const updatedSourceA: KnowledgeSource = {
        ...mockSourceA,
        text: 'REVISED TEXT: Monotonic counter logic.'
      };
      const updatedGraph: KnowledgeGraph = {
        ...mockGraph,
        sources: [updatedSourceA, mockSourceB, mockSourceC]
      };

      // Force regenerate
      const regenerated = await getOrGenerateConceptExplanation({
        graph: updatedGraph,
        conceptId: 'c-lamport-clocks',
        forceRegenerate: true
      });

      assert.strictEqual(regenerated.status, 'ready');
      assert.strictEqual(regenerated.explanation?.isOutdated, undefined);
      assert.strictEqual(
        regenerated.explanation?.sourceFingerprint,
        computeConceptSourceFingerprint(updatedGraph, 'c-lamport-clocks')
      );
    });
  });

  describe('3. Source Attribution & Citation Accuracy', () => {
    test('preserves genuine sourceId, sourceTitle, page, chunkId, and excerpt', () => {
      const context = extractConceptSourceContext(mockGraph, 'c-lamport-clocks');
      assert.strictEqual(context.status, 'found');

      const explanation = synthesizeGroundedExplanation(context.context);
      assert.ok(explanation.sourceReferences.length > 0);

      const ref = explanation.sourceReferences[0];
      assert.strictEqual(ref.sourceId, 'src-dist-sys-book');
      assert.strictEqual(ref.sourceTitle, 'Distributed Systems Principles (Tanenbaum)');
      assert.strictEqual(ref.page, 245);
      assert.strictEqual(ref.chunkId, 'chunk-lamport-01');
      assert.strictEqual(ref.excerpt, 'Lamport logical clocks assign monotonically increasing sequence numbers to events.');
    });

    test('does NOT invent page numbers when page is not present in extracted evidence', () => {
      const nodeWithoutPage: KnowledgeNode = {
        id: 'c-no-page',
        name: 'Unpaged Concept',
        type: 'foundation',
        description: 'A concept where extracted source evidence lacks page numbering.',
        sourceIds: ['src-dist-sys-book'],
        evidenceItems: [
          {
            sourceId: 'src-dist-sys-book',
            text: 'Passage extracted from web page or text without pagination.'
          }
        ]
      };

      const testGraph: KnowledgeGraph = {
        ...mockGraph,
        nodes: [nodeWithoutPage]
      };

      const context = extractConceptSourceContext(testGraph, 'c-no-page');
      assert.strictEqual(context.status, 'found');

      const explanation = synthesizeGroundedExplanation(context.context);
      const ref = explanation.sourceReferences[0];

      assert.strictEqual(ref.page, undefined, 'Must not fabricate a page number');
    });

    test('preserves section metadata when provided in evidence items', () => {
      const nodeWithSection: KnowledgeNode = {
        id: 'c-section-concept',
        name: 'Sectioned Concept',
        type: 'foundation',
        description: 'Concept with explicit section metadata in evidence.',
        sourceIds: ['src-dist-sys-book'],
        evidenceItems: [
          {
            sourceId: 'src-dist-sys-book',
            section: 'Chapter 6.2 Clock Synchronization',
            text: 'Clock synchronization algorithms ensure nodes agree on time values.'
          } as any
        ]
      };

      const testGraph: KnowledgeGraph = {
        ...mockGraph,
        nodes: [nodeWithSection]
      };

      const context = extractConceptSourceContext(testGraph, 'c-section-concept');
      assert.strictEqual(context.status, 'found');

      const explanation = synthesizeGroundedExplanation(context.context);
      assert.strictEqual(explanation.sourceReferences[0].section, 'Chapter 6.2 Clock Synchronization');
    });
  });

  describe('4. Request Deduplication', () => {
    test('deduplicates concurrent in-flight requests for the same graph, concept, and source fingerprint', async () => {
      // Fire two concurrent generation requests
      const promise1 = getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });
      const promise2 = getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });

      // Both should resolve to the exact same promise instance or identical object
      const [res1, res2] = await Promise.all([promise1, promise2]);
      assert.strictEqual(res1.status, 'ready');
      assert.strictEqual(res2.status, 'ready');
      assert.strictEqual(res1.explanation, res2.explanation);
    });
  });

  describe('5. Backward Compatibility & Historical Data', () => {
    test('handles legacy explanations stored without sourceFingerprint gracefully', async () => {
      // Manually simulate a legacy stored explanation from Task 05/06/07/08
      const legacyExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Legacy explanation generated before Task 09.',
        sourceReferences: [
          {
            sourceId: 'src-dist-sys-book',
            sourceTitle: 'Distributed Systems Principles (Tanenbaum)',
            excerpt: 'Lamport clocks assign timestamps.'
          }
        ],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: '2026-10-01T00:00:00Z'
      };

      saveStoredExplanation(legacyExplanation);

      // Loading should succeed without crash and backfill current fingerprint
      const result = await getOrGenerateConceptExplanation({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks'
      });

      assert.strictEqual(result.status, 'ready');
      assert.strictEqual(result.explanation?.overview, 'Legacy explanation generated before Task 09.');
      assert.ok(result.explanation?.sourceFingerprint, 'Should backfill current fingerprint');
    });

    test('handles concepts with missing source metadata gracefully without breaking', () => {
      const minimalNode: KnowledgeNode = {
        id: 'c-minimal',
        name: 'Minimal Node',
        type: 'concept',
        description: 'Node with no source IDs or evidence items at all.',
        sourceIds: []
      };

      const minimalGraph: KnowledgeGraph = {
        id: 'graph-min',
        nodes: [minimalNode],
        sources: [],
        relationships: []
      };

      const fp = computeConceptSourceFingerprint(minimalGraph, 'c-minimal');
      assert.ok(fp.startsWith('fp_'), 'Fingerprint should still generate deterministically');

      const result = extractConceptSourceContext(minimalGraph, 'c-minimal');
      // Even if insufficient, system handles it safely
      assert.ok(result.status === 'insufficient' || result.status === 'found');
    });
  });

  describe('6. Source Inspection UI & Status Presentation', () => {
    test('renders outdated banner when explanation status is outdated with regenerate button', () => {
      const outdatedExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview of Lamport clocks.',
        sourceReferences: [
          {
            sourceId: 'src-dist-sys-book',
            sourceTitle: 'Distributed Systems Principles (Tanenbaum)',
            page: 245,
            excerpt: 'Monotonic timestamps.'
          }
        ],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        isOutdated: true,
        sourceFingerprint: 'fp_old_mismatched_hash',
        generatedAt: '2026-09-01T00:00:00Z'
      };

      saveStoredExplanation(outdatedExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-outdated-banner'), 'Must render outdated banner');
      assert.ok(html.includes('SOURCE MATERIAL UPDATED'), 'Must show prominent outdated kicker');
      assert.ok(html.includes('Regenerate explanation'), 'Must provide a regenerate action');
      assert.ok(html.includes('OUTDATED SOURCE RECORD'), 'Must flag source badge as outdated record');
    });

    test('renders restrained "View sources" interaction link in concept header', () => {
      const readyExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview of Lamport clocks.',
        sourceReferences: [
          {
            sourceId: 'src-dist-sys-book',
            sourceTitle: 'Distributed Systems Principles (Tanenbaum)',
            page: 245,
            excerpt: 'Monotonic timestamps.'
          }
        ],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: '2026-09-01T00:00:00Z',
        sourceFingerprint: computeConceptSourceFingerprint(mockGraph, 'c-lamport-clocks')
      };

      saveStoredExplanation(readyExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-source-inspect-link'), 'Must render View sources link');
      assert.ok(html.includes('View sources (1)'), 'Must indicate source count');
    });

    test('renders Open in Library action when onOpenSource prop is provided', () => {
      const readyExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview of Lamport clocks.',
        sourceReferences: [
          {
            sourceId: 'src-dist-sys-book',
            sourceTitle: 'Distributed Systems Principles (Tanenbaum)',
            page: 245,
            chunkId: 'chunk-lamport-01',
            excerpt: 'Monotonic timestamps.'
          }
        ],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: '2026-09-01T00:00:00Z',
        sourceFingerprint: computeConceptSourceFingerprint(mockGraph, 'c-lamport-clocks')
      };

      saveStoredExplanation(readyExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {},
          onOpenSource: () => {}
        })
      );

      assert.ok(html.includes('revision-source-open-btn'), 'Must render Open in Library button');
      assert.ok(html.includes('Open in Library'), 'Button text must match library viewer action');
      assert.ok(html.includes('PASSAGE chunk-lamport-01'), 'Must render passage chunk ID tag');
    });
  });

  describe('7. Visual Design & Swiss Editorial CSS Integrity', () => {
    test('enforces solid design tokens and prohibits linear gradients or blur filters in revision.css', () => {
      assert.strictEqual(
        cssContent.includes('linear-gradient'),
        false,
        'revision.css must not use linear gradients'
      );
      assert.strictEqual(
        cssContent.includes('backdrop-filter: blur'),
        false,
        'revision.css must not use blurred glassmorphism'
      );
    });

    test('contains required CSS classes for outdated banner and source inspection', () => {
      assert.ok(cssContent.includes('.revision-outdated-banner'));
      assert.ok(cssContent.includes('.revision-outdated-kicker'));
      assert.ok(cssContent.includes('.revision-outdated-action-btn'));
      assert.ok(cssContent.includes('.revision-source-open-btn'));
      assert.ok(cssContent.includes('.revision-source-inspect-link'));
    });
  });
});
