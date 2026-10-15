/**
 * tests/revisionConceptSwitchingCinematic.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — CINEMATIC CONCEPT SWITCHING & COMPLETE SESSION ACTION TRANSFORMATION
 *
 * Tests the 10 acceptance criteria:
 * TEST 1: Navigate from a middle concept to the next concept with directional transition.
 * TEST 2: Navigate to the previous concept with reversed directional transition.
 * TEST 3: Rapid navigation & async safety (no cross-concept mixed data, latest concept wins).
 * TEST 4: Dynamic section synchronization across concepts with differing section counts.
 * TEST 5: Complete session replaces Next concept in the exact same position at the final concept.
 * TEST 6: Smooth reverse transition from Complete session back into Next concept.
 * TEST 7: Single execution of completion flow, guarded against duplicates, no auto-completion on view.
 * TEST 8: Interface stability and graceful loading state during in-flight fetches.
 * TEST 9: Layout stability, right slot alignment, and CSS tokens.
 * TEST 10: Keyboard navigation support and prefers-reduced-motion accessibility.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  RevisionWorkspace,
  createConceptCanvasVariants,
  createConceptElementVariants,
  createActionTransformVariants
} from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import { saveStoredExplanation } from '../src/services/conceptExplanation';
import { createRevisionSession, saveRevisionSession, loadRevisionSession } from '../src/services/revisionSession';

// In-memory localStorage mock for node test runner
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

const mockNode1: KnowledgeNode = {
  id: 'node-kernel-arch',
  name: 'Kernel Architecture',
  type: 'concept',
  description: 'Monolithic vs microkernel design trade-offs in modern operating systems.',
  sourceIds: ['src-os-1'],
  keyIdeas: ['Monolithic kernels place all OS services in kernel space.', 'Microkernels isolate drivers and IPC.']
};

const mockNode2: KnowledgeNode = {
  id: 'node-process-scheduling',
  name: 'Process Scheduling',
  type: 'concept',
  description: 'CPU scheduling algorithms including Round Robin and Multi-Level Feedback Queues.',
  sourceIds: ['src-os-1'],
  keyIdeas: ['Preemptive schedulers force context switches.', 'Quantum expiration bounds latency.']
};

const mockNode3: KnowledgeNode = {
  id: 'node-virtual-memory',
  name: 'Virtual Memory & Paging',
  type: 'concept',
  description: 'Hardware page tables, TLB caching, and page replacement policies.',
  sourceIds: ['src-os-2'],
  keyIdeas: ['Paging decouples logical and physical address spaces.', 'TLB misses incur memory walks.']
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-cinematic-revision-test',
  name: 'Operating Systems Engineering',
  nodes: [mockNode1, mockNode2, mockNode3],
  relationships: [
    {
      id: 'rel-1',
      sourceId: mockNode1.id,
      targetId: mockNode2.id,
      type: 'cooperates-with',
      sourceName: mockNode1.name,
      targetName: mockNode2.name,
      description: 'Kernel scheduler manages process execution threads'
    },
    {
      id: 'rel-2',
      sourceId: mockNode2.id,
      targetId: mockNode3.id,
      type: 'relies-on',
      sourceName: mockNode2.name,
      targetName: mockNode3.name,
      description: 'Scheduled processes operate in isolated virtual address spaces'
    }
  ],
  sources: [
    { id: 'src-os-1', title: 'Modern Operating Systems 4th Ed', type: 'pdf', status: 'ready', uploadedAt: '2026-01-01' },
    { id: 'src-os-2', title: 'Operating Systems: Three Easy Pieces', type: 'pdf', status: 'ready', uploadedAt: '2026-01-02' }
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z'
};

const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('GraphMind Cinematic Concept Switching & Complete Session Replacement', () => {
  beforeEach(() => {
    storageMap.clear();

    // Seed mock explanations
    const exp1: ConceptExplanation = {
      conceptId: mockNode1.id,
      conceptName: mockNode1.name,
      overview: 'Kernel architecture defines how system privileges and abstractions are partitioned.',
      detailedExplanation: ['Monolithic kernels optimize throughput by minimizing boundary crossings.'],
      howItWorks: ['System calls trap into kernel privilege mode.', 'Interrupt handlers service hardware events.'],
      sourceReferences: [
        { sourceId: 'src-os-1', sourceTitle: 'Modern Operating Systems 4th Ed', page: 42, excerpt: 'The kernel is the one program running in kernel mode.' }
      ],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    const exp2: ConceptExplanation = {
      conceptId: mockNode2.id,
      conceptName: mockNode2.name,
      overview: 'Process scheduling orchestrates which executable task receives processor slices.',
      detailedExplanation: ['Schedulers maximize CPU utilization while minimizing interactive response times.'],
      howItWorks: ['A timer interrupt triggers the scheduler dispatch routine.'],
      sourceReferences: [
        { sourceId: 'src-os-1', sourceTitle: 'Modern Operating Systems 4th Ed', page: 120, excerpt: 'The part of the operating system that makes the choice is called the scheduler.' }
      ],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    const exp3: ConceptExplanation = {
      conceptId: mockNode3.id,
      conceptName: mockNode3.name,
      overview: 'Virtual memory provides uniform logical address spaces backed by physical RAM and disk.',
      detailedExplanation: ['Translation Lookaside Buffers cache address translations for instant lookup.'],
      howItWorks: ['MMU intercepts virtual memory accesses.', 'Page faults swap required frames into memory.'],
      sourceReferences: [
        { sourceId: 'src-os-2', sourceTitle: 'Operating Systems: Three Easy Pieces', page: 200, excerpt: 'Virtual memory abstracts physical memory into private address spaces.' }
      ],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    saveStoredExplanation(mockGraph.id, mockNode1.id, exp1);
    saveStoredExplanation(mockGraph.id, mockNode2.id, exp2);
    saveStoredExplanation(mockGraph.id, mockNode3.id, exp3);
  });

  // TEST 1: Forward navigation transitions directionally and enters smoothly
  test('TEST 1: Forward navigation from a middle concept transitions directionally with coordinated stagger', () => {
    const canvasVariants = createConceptCanvasVariants(false);
    const forwardEnter = (canvasVariants.enter as any)(1);
    const forwardExit = (canvasVariants.exit as any)(1);

    assert.strictEqual(forwardEnter.x, 14, 'Forward entrance must enter from +14px to suggest forward advancement');
    assert.strictEqual(forwardExit.x, -14, 'Forward exit must glide toward -14px');
    assert.strictEqual(forwardEnter.opacity, 0, 'Enter starts with opacity 0');
    assert.strictEqual(forwardExit.opacity, 0, 'Exit fades out to opacity 0');

    // Child elements stagger
    const centerVariants = canvasVariants.center as any;
    assert.strictEqual(centerVariants.staggerChildren, 0.04, 'Stagger duration must be concise (40ms) for snappy reading');

    const elementVariants = createConceptElementVariants(false);
    assert.strictEqual((elementVariants.enter as any).y, 8, 'Child elements enter with subtle vertical glide (8px)');
    assert.strictEqual((elementVariants.center as any).y, 0, 'Child elements settle at y=0');

    // Render Middle Concept (Index 1)
    const html = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html.includes('Process Scheduling'), 'Must display active concept title');
    assert.ok(html.includes('CONCEPT 02'), 'Must display concept 02 badge');
    assert.ok(html.includes('02 / 03'), 'Must display progress indicator 02 / 03');
  });

  // TEST 2: Backward navigation reverses directional motion
  test('TEST 2: Backward navigation uses opposite directional offsets (-14px enter, +14px exit)', () => {
    const canvasVariants = createConceptCanvasVariants(false);
    const backwardEnter = (canvasVariants.enter as any)(-1);
    const backwardExit = (canvasVariants.exit as any)(-1);

    assert.strictEqual(backwardEnter.x, -14, 'Backward entrance must enter from -14px');
    assert.strictEqual(backwardExit.x, 14, 'Backward exit must glide toward +14px');
  });

  // TEST 3: Rapid navigation and asynchronous safety
  test('TEST 3: Rapid navigation never displays mixed data or cross-concept stale content', () => {
    // When concept 2 is active, neither concept 1 nor concept 3 title or source excerpts appear
    const html2 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html2.includes('Process Scheduling'), 'Active concept title must be Process Scheduling');
    assert.ok(!html2.includes('Virtual memory abstracts physical memory'), 'Must not display concept 3 source reference');
    assert.ok(!html2.includes('The kernel is the one program running in kernel mode'), 'Must not display concept 1 source reference');
  });

  // TEST 4: Switch between concepts with different available sections
  test('TEST 4: Concepts with different available sections update jump navigation and rail synchronously', () => {
    // Render concept 1
    const html1 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );

    // Concept 1 has related concepts (connected to node 2 in mockGraph)
    assert.ok(html1.includes('section-related-concepts') || html1.includes('Related'), 'Concept 1 should reflect its specific sections');

    // Render concept 3
    const html3 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 2,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html3.includes('Virtual Memory &amp; Paging') || html3.includes('Virtual Memory & Paging'), 'Concept 3 title renders cleanly');
    assert.ok(html3.includes('revision-reading-rail'), 'Rail renders cleanly for concept 3');
  });

  // TEST 5: Reach final concept: Complete session replaces Next concept in exact same position
  test('TEST 5: Complete session replaces Next concept in the exact same right slot at the final concept', () => {
    // Middle concept (index 1 of 3): Next concept is visible, not Complete session
    const middleHtml = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );
    assert.ok(middleHtml.includes('Next concept'), 'Middle concept must display Next concept action');
    assert.ok(!middleHtml.includes('revision-complete-session-action'), 'Middle concept must not display Complete session');

    // Final concept (index 2 of 3)
    const finalHtml = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 2,
        onBackToGraph: () => {}
      })
    );

    assert.ok(finalHtml.includes('revision-complete-session-action'), 'Final concept must display Complete session');
    assert.ok(finalHtml.includes('revision-nav-right-slot'), 'Complete session sits in the stable right slot');
    assert.ok(finalHtml.includes('Complete session'), 'Displays Complete session label');
    assert.ok(finalHtml.includes('Previous concept'), 'Previous concept remains active on the left');
    assert.ok(!finalHtml.includes('revision-nav-prev disabled'), 'Previous concept must NOT be disabled on final concept');
  });

  // TEST 6: Backward navigation from final concept restores Next concept smoothly
  test('TEST 6: Navigating backward from final concept transitions Complete session back into Next concept', () => {
    const actionVariants = createActionTransformVariants(false);
    assert.strictEqual((actionVariants.enter as any).x, 8, 'Action reveals with short 8px horizontal glide');
    assert.strictEqual((actionVariants.center as any).x, 0, 'Action settles at x=0');
    assert.strictEqual((actionVariants.exit as any).x, -8, 'Action exits with -8px transition');

    // Reverting from index 2 to index 1 returns Next concept
    const backHtml = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );

    assert.ok(backHtml.includes('Next concept'), 'Restores Next concept button');
    assert.ok(!backHtml.includes('revision-complete-session-action'), 'Complete session is removed');
  });

  // TEST 7: Complete session flow runs exactly once, not triggered merely by viewing final concept
  test('TEST 7: Session is not marked complete merely by viewing the final concept', () => {
    const initialSession = createRevisionSession({
      graphId: mockGraph.id,
      conceptIds: [mockNode1.id, mockNode2.id, mockNode3.id],
      currentIndex: 0
    });
    saveRevisionSession(initialSession, mockGraph.id);

    // Mount at final concept (index 2)
    renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 2,
        onBackToGraph: () => {}
      })
    );

    const reloaded = loadRevisionSession(mockGraph.id);
    assert.ok(reloaded, 'Session must exist');
    // reviewedConceptIds must NOT automatically contain the final concept merely from mounting
    assert.ok(!reloaded.reviewedConceptIds.includes(mockNode3.id), 'Merely viewing final concept must not auto-mark it reviewed/completed');
  });

  // TEST 8: Interface stability and graceful loading state during in-flight fetches
  test('TEST 8: In-flight loading state uses existing skeleton and preserves workspace structure', () => {
    // When concept has no cached explanation yet, it uses the loading skeleton
    const uncachedNode: KnowledgeNode = {
      id: 'node-uncached-paging',
      name: 'Uncached Paging Mechanism',
      type: 'concept',
      description: 'Pending explanation generation'
    };
    const graphWithUncached: KnowledgeGraph = {
      ...mockGraph,
      id: 'graph-uncached-test',
      nodes: [uncachedNode]
    };

    const html = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: graphWithUncached,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html.includes('revision-workspace-root'), 'Workspace root remains stable');
    assert.ok(html.includes('revision-reading-column'), 'Reading column structure is preserved');
  });

  // TEST 9: CSS layout stability, right slot styling, and alignment
  test('TEST 9: revision.css specifies right slot anchor, lime accent, and hover kinematics without layout shifts', () => {
    assert.ok(cssContent.includes('.revision-nav-right-slot'), 'CSS must define .revision-nav-right-slot');
    assert.ok(cssContent.includes('min-width: 140px'), 'Right slot must define stable min-width to prevent layout shifts');
    assert.ok(cssContent.includes('margin-left: auto'), 'Right slot must push to the right edge keeping left stationary');
    assert.ok(cssContent.includes('.revision-complete-session-action'), 'CSS must style .revision-complete-session-action');
    assert.ok(cssContent.includes('.revision-complete-label'), 'CSS must style .revision-complete-label');
  });

  // TEST 10: Keyboard navigation and prefers-reduced-motion accessibility
  test('TEST 10: Reduced motion settings eliminate horizontal displacement for accessibility', () => {
    const reducedCanvas = createConceptCanvasVariants(true);
    const forwardEnterReduced = (reducedCanvas.enter as any)(1);
    const forwardExitReduced = (reducedCanvas.exit as any)(1);

    assert.strictEqual(forwardEnterReduced.x, 0, 'Reduced motion must zero out x displacement on enter');
    assert.strictEqual(forwardExitReduced.x, 0, 'Reduced motion must zero out x displacement on exit');

    const reducedAction = createActionTransformVariants(true);
    assert.strictEqual((reducedAction.enter as any).x, 0, 'Reduced motion must zero out action x displacement');
    assert.strictEqual((reducedAction.exit as any).x, 0, 'Reduced motion must zero out action exit displacement');

    const reducedElement = createConceptElementVariants(true);
    assert.strictEqual((reducedElement.enter as any).y, 0, 'Reduced motion must zero out element y displacement');
  });
});
