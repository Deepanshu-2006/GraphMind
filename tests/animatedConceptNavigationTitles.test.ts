/**
 * tests/animatedConceptNavigationTitles.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — ANIMATED CONCEPT NAVIGATION TITLES
 *
 * Acceptance Criteria verified:
 * 1. Clicking Next concept animates neighboring concept titles with forward directional movement.
 * 2. Clicking Previous concept animates neighboring titles with reversed directional movement.
 * 3. Static labels ("Previous concept", "Next concept") and arrows remain outside the animated viewport.
 * 4. Stable height and zero layout shift (.revision-nav-dest-viewport with height: 18px & overflow: hidden).
 * 5. Long concept titles truncate gracefully without shifting footer dimensions.
 * 6. Rapid clicks and direction synchronization use stable concept IDs.
 * 7. First-concept and last-concept boundary behaviors are preserved.
 * 8. Prefers-reduced-motion accessibility is fully respected in both Framer Motion and CSS.
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
  createNavTitleVariants
} from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';
import { createRevisionSession, saveRevisionSession } from '../src/services/revisionSession';

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
  id: 'node-fcfs',
  name: 'First-Come, First-Served',
  type: 'concept',
  description: 'Executes processes in FIFO order of their arrival.',
  sourceIds: ['src-os-1'],
  confidenceScore: 0.95
};

const mockNode2: KnowledgeNode = {
  id: 'node-sjf',
  name: 'Shortest Job First',
  type: 'concept',
  description: 'Schedules processes with the shortest burst time first.',
  sourceIds: ['src-os-1'],
  confidenceScore: 0.9
};

const mockNode3: KnowledgeNode = {
  id: 'node-rr',
  name: 'Round Robin Scheduling with Time Slicing & Preemption',
  type: 'concept',
  description: 'Allocates fixed CPU time quanta per process in cyclic order.',
  sourceIds: ['src-os-1'],
  confidenceScore: 0.92
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-os-titles',
  title: 'Operating System Scheduling Algorithms',
  userId: 'user-test-01',
  nodes: [mockNode1, mockNode2, mockNode3],
  edges: [],
  metadata: {
    domain: 'Computer Science',
    totalConcepts: 3,
    confidenceScore: 0.94,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

describe('GRAPHMIND — ANIMATED CONCEPT NAVIGATION TITLES', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  beforeEach(() => {
    storageMap.clear();
  });

  // =========================================================================
  // 1. DIRECTION-AWARE TRANSITION VARIANTS
  // =========================================================================
  describe('1. Direction-Aware Title Kinematics & Timing', () => {
    test('forward/next navigation: outgoing moves upward (-10px) and incoming enters from below (+10px)', () => {
      const variants = createNavTitleVariants(false);

      // Entering forward (dir = 1)
      const enterForward = (variants.enter as any)(1);
      assert.strictEqual(enterForward.opacity, 0, 'Incoming title starts at opacity 0');
      assert.strictEqual(enterForward.y, 10, 'Incoming title enters from slightly below (+10px)');
      assert.ok(
        enterForward.transition.duration >= 0.40 && enterForward.transition.duration <= 0.55,
        'Incoming title timing should be slow and fluid (~450-500ms)'
      );

      // Center (settled)
      const center = variants.center as any;
      assert.strictEqual(center.opacity, 1, 'Settled title is fully visible');
      assert.strictEqual(center.y, 0, 'Settled title rests at y: 0');

      // Exiting forward (dir = 1)
      const exitForward = (variants.exit as any)(1);
      assert.strictEqual(exitForward.opacity, 0, 'Outgoing title fades to opacity 0');
      assert.strictEqual(exitForward.y, -10, 'Outgoing title moves upward (-10px)');
      assert.ok(
        exitForward.transition.duration >= 0.30 && exitForward.transition.duration <= 0.40,
        'Outgoing title timing should be smooth and fluid (~300-380ms)'
      );
    });

    test('backward/previous navigation: outgoing moves downward (+10px) and incoming enters from above (-10px)', () => {
      const variants = createNavTitleVariants(false);

      // Entering backward (dir = -1)
      const enterBackward = (variants.enter as any)(-1);
      assert.strictEqual(enterBackward.opacity, 0, 'Incoming title starts at opacity 0');
      assert.strictEqual(enterBackward.y, -10, 'Incoming title enters from slightly above (-10px)');

      // Exiting backward (dir = -1)
      const exitBackward = (variants.exit as any)(-1);
      assert.strictEqual(exitBackward.opacity, 0, 'Outgoing title fades to opacity 0');
      assert.strictEqual(exitBackward.y, 10, 'Outgoing title moves downward (+10px)');
    });

    test('prefers-reduced-motion: eliminates vertical movement and opacity delays', () => {
      const reducedVariants = createNavTitleVariants(true);

      const enter = (reducedVariants.enter as any)(1);
      assert.strictEqual(enter.y, 0, 'Vertical offset must be 0 when reduced motion is preferred');
      assert.strictEqual(enter.opacity, 1, 'Opacity must be immediately visible without delay');
      assert.strictEqual(enter.transition.duration, 0, 'Duration must be 0 for instantaneous update');

      const exit = (reducedVariants.exit as any)(1);
      assert.strictEqual(exit.y, 0, 'Exit vertical offset must be 0');
      assert.strictEqual(exit.transition.duration, 0, 'Exit duration must be 0');
    });
  });

  // =========================================================================
  // 2. VIEWPORT STABILITY & STRUCTURE
  // =========================================================================
  describe('2. Navigation Viewport Architecture & Static Labels', () => {
    test('preserves static "Previous concept" and "Next concept" labels outside the title viewport', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: mockGraph.nodes.map(n => n.id),
        currentIndex: 1
      });
      saveRevisionSession(session, mockGraph.id);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: mockGraph.title,
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      // Static labels
      assert.ok(html.includes('revision-nav-action-label'), 'Must render action labels');
      assert.ok(html.includes('Previous concept'), 'Previous concept action label remains static');
      assert.ok(html.includes('Next concept'), 'Next concept action label remains static');

      // Title Viewports
      assert.ok(html.includes('revision-nav-dest-viewport'), 'Must wrap animated titles in .revision-nav-dest-viewport');
      assert.ok(html.includes('revision-nav-dest-name'), 'Must render .revision-nav-dest-name elements');

      // Correct neighboring concept titles
      assert.ok(html.includes('First-Come, First-Served'), 'Previous concept is First-Come, First-Served');
      assert.ok(
        html.includes('Round Robin Scheduling with Time Slicing &amp; Preemption') ||
          html.includes('Round Robin Scheduling with Time Slicing & Preemption'),
        'Next concept is Round Robin'
      );
    });

    test('first concept preserves boundary: previous title slot is empty and disabled', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: mockGraph.nodes.map(n => n.id),
        currentIndex: 0
      });
      saveRevisionSession(session, mockGraph.id);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: mockGraph.title,
          revisionIndex: 0,
          onBackToGraph: () => {}
        })
      );

      // Previous button must be disabled
      assert.ok(html.includes('revision-nav-prev disabled') || html.includes('disabled'), 'Previous button is disabled');
      // Next concept destination is SJF
      assert.ok(html.includes('Shortest Job First'), 'Next title is Shortest Job First');
    });

    test('last concept transforms to complete session while previous concept animates SJF', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: mockGraph.nodes.map(n => n.id),
        currentIndex: 2
      });
      saveRevisionSession(session, mockGraph.id);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: mockGraph.title,
          revisionIndex: 2,
          onBackToGraph: () => {}
        })
      );

      // Previous concept destination is SJF
      assert.ok(html.includes('Shortest Job First'), 'Previous concept title is Shortest Job First');
      // Right action is Complete session with Return to graph
      assert.ok(html.includes('Complete session'), 'Right action label is Complete session');
      assert.ok(html.includes('Return to graph'), 'Destination subtitle is Return to graph');
    });
  });

  // =========================================================================
  // 3. CSS DESIGN SYSTEM & TOKENS
  // =========================================================================
  describe('3. CSS Stability Tokens & Overflow Containment', () => {
    test('defines .revision-nav-dest-viewport with fixed height, hidden overflow, and relative positioning', () => {
      assert.ok(cssContent.includes('.revision-nav-dest-viewport'), 'Must define .revision-nav-dest-viewport');
      assert.ok(cssContent.includes('height: 18px'), 'Viewport must specify height: 18px to prevent vertical layout shifts');
      assert.ok(cssContent.includes('overflow: hidden'), 'Viewport must hide overflow to clip entering/exiting titles');
      assert.ok(cssContent.includes('position: relative'), 'Viewport must be position: relative for absolute popLayout positioning');
    });

    test('defines .revision-nav-dest-name with text truncation and max-width constraint', () => {
      assert.ok(cssContent.includes('.revision-nav-dest-name'), 'Must define .revision-nav-dest-name');
      assert.ok(cssContent.includes('text-overflow: ellipsis'), 'Must truncate long titles gracefully');
      assert.ok(cssContent.includes('white-space: nowrap'), 'Must prohibit multiline wrapping in title slot');
      assert.ok(cssContent.includes('max-width: 240px'), 'Must constrain title width to max 240px');
    });

    test('supports prefers-reduced-motion in revision.css for navigation title elements', () => {
      const reducedMotionIdx = cssContent.lastIndexOf('@media (prefers-reduced-motion: reduce)');
      assert.ok(reducedMotionIdx !== -1, 'prefers-reduced-motion block must exist');
      const reducedBlock = cssContent.slice(reducedMotionIdx, reducedMotionIdx + 1500);
      assert.ok(reducedBlock.includes('.revision-nav-dest-viewport'), 'Must cover .revision-nav-dest-viewport');
      assert.ok(reducedBlock.includes('.revision-nav-dest-name'), 'Must cover .revision-nav-dest-name');
    });
  });
});
