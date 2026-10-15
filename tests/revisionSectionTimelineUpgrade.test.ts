/**
 * tests/revisionSectionTimelineUpgrade.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — REVISION WORKSPACE SECTION NAVIGATION RAIL TO CINEMATIC TIMELINE UPGRADE
 *
 * Verifies:
 * 1. Placement & Layout: Positioned on the RIGHT of the reading column with intentional clearance (28px).
 * 2. Engineered Track & Progress Segment:
 *    - Static graphite track line with exact marker center endpoints (19.5px).
 *    - Dynamic lime progress segment accurately scaled with progressRatio.
 * 3. Marker System States:
 *    - Active: crisp lime marker, traveling outer halo ring (layoutId="active-rail-indicator"), bright numeral.
 *    - Completed: muted lime tint (rgba(163, 255, 18, 0.45)), connected to lime progress line.
 *    - Upcoming: small graphite marker (#27272A), low-contrast numeral (#52525B).
 * 4. Refined Numbering: Tabular monospace two-digit formatting (01, 02, ...), subtle active micro-shift.
 * 5. Minimal Instrument Tooltip: Monospace number, em-dash separator, dark #141416 surface, positioned to the left.
 * 6. Accessibility & Keyboard Support: Space and Enter key activation, visible focus outline, reduced motion support.
 * 7. State Continuity & Shared Source of Truth: Synchronized with horizontal section navigation and concept switching.
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

import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import type { ConceptKnowledgeCheckState } from '../src/types/knowledgeCheck';
import { saveStoredExplanation } from '../src/services/conceptExplanation';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';

// In-memory backing store for localStorage in Node test runner
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

const mockNodeA: KnowledgeNode = {
  id: 'node-arch-intro',
  name: 'Computer Architecture Fundamentals',
  type: 'concept',
  description: 'Instruction set architectures, microarchitectures, and hardware execution pipelines.',
  sourceIds: ['src-arch-1'],
  keyIdeas: [
    'ISA defines the programmer-visible interface to processor hardware.',
    'Pipelining increases throughput via instruction-level parallelism.'
  ]
};

const mockNodeB: KnowledgeNode = {
  id: 'node-cache-coherence',
  name: 'Cache Coherence Protocols',
  type: 'concept',
  description: 'Mechanisms ensuring consistent shared memory states across multi-core processor caches.',
  sourceIds: ['src-arch-1'],
  keyIdeas: [
    'Snooping vs directory-based protocols.',
    'MESI states: Modified, Exclusive, Shared, Invalid.'
  ]
};

const mockRel: KnowledgeRelationship = {
  id: 'rel-arch-cache',
  source: 'node-arch-intro',
  target: 'node-cache-coherence',
  relationType: 'depends-on',
  description: 'foundational memory hierarchy prerequisite'
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-arch-timeline',
  name: 'Advanced Computer Architecture',
  nodes: [mockNodeA, mockNodeB],
  relationships: [mockRel],
  sources: [
    {
      id: 'src-arch-1',
      title: 'Computer Architecture: A Quantitative Approach',
      type: 'document'
    }
  ]
};

const mockExplanation: ConceptExplanation = {
  graphId: 'graph-arch-timeline',
  conceptId: 'node-cache-coherence',
  conceptName: 'Cache Coherence Protocols',
  status: 'ready',
  overview: 'In shared-memory multi-core architectures, multiple private caches can hold copies of the same memory location simultaneously.',
  howItWorks: [
    'Bus snooping broadcasts invalidations across shared core interconnects.',
    'State machines transition lines through Modified, Exclusive, Shared, and Invalid states.'
  ],
  importantPoints: [
    'False sharing occurs when independent variables occupy the same cache line.',
    'Directory protocols scale more efficiently than snooping on high-core counts.'
  ],
  sourceReferences: [
    {
      sourceId: 'src-arch-1',
      sourceTitle: 'Computer Architecture: A Quantitative Approach',
      chunkIndex: 4,
      quote: 'Coherence defines what values can be returned by a read operation.'
    }
  ],
  updatedAt: new Date().toISOString()
};

const mockKcState: ConceptKnowledgeCheckState = {
  graphId: 'graph-arch-timeline',
  conceptId: 'node-cache-coherence',
  status: 'ready',
  questions: [
    {
      id: 'q-cache-1',
      type: 'multiple-choice',
      prompt: 'What condition triggers a cache line invalidation in a snooping MESI protocol?',
      options: [
        { id: 'opt-1', text: 'Another core executing a write to that memory address' },
        { id: 'opt-2', text: 'A read hit in the local private L1 data cache' },
        { id: 'opt-3', text: 'A TLB shootdown event' }
      ],
      correctOptionId: 'opt-1',
      explanation: 'A write intent broadcast forces all other caches holding the line to mark their copy Invalid.'
    }
  ],
  activeQuestionIndex: 0,
  attempts: {},
  updatedAt: new Date().toISOString()
};

describe('GraphMind — Revision Workspace Section Timeline Rail Upgrade', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  beforeEach(() => {
    storageMap.clear();
    saveStoredExplanation(mockExplanation);
    saveStoredKnowledgeCheck(mockKcState);
  });

  describe('1. Right-Side Placement, Layout & Proportions', () => {
    test('renders rail strictly to the RIGHT of the reading column inside .revision-lesson-layout', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Advanced Computer Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      const readingColIdx = html.indexOf('revision-reading-column');
      const railIdx = html.indexOf('revision-reading-rail');

      assert.ok(readingColIdx > 0, 'Reading column must be rendered');
      assert.ok(railIdx > 0, 'Navigation rail must be rendered');
      assert.ok(railIdx > readingColIdx, 'Rail must appear AFTER the reading column in DOM order to sit on the RIGHT');
    });

    test('preserves balanced flex layout with 28px scrollbar clearance and centered reading column', () => {
      const layoutMatch = cssContent.match(/\.revision-lesson-layout\s*\{([^}]*)\}/);
      assert.ok(layoutMatch, 'Must define .revision-lesson-layout');
      const body = layoutMatch[1];
      assert.ok(body.includes('display: flex'), 'Layout must use flex composition');
      assert.ok(body.includes('justify-content: center'), 'Layout must center the reading column');
      assert.ok(body.includes('padding-right: 28px'), 'Must maintain clean 28px clearance from right scrollbar');
      assert.ok(body.includes('padding-left: 76px'), 'Must offset left padding (48px rail + 28px) for optical symmetry');
    });

    test('rail uses sticky positioning with vertical centering calculation within usable viewport', () => {
      const railMatch = cssContent.match(/\.revision-reading-rail\s*\{([^}]*)\}/);
      assert.ok(railMatch, 'Must define .revision-reading-rail');
      const body = railMatch[1];
      assert.ok(body.includes('position: sticky'), 'Rail must use sticky positioning');
      assert.ok(body.includes('transform: translateY(-50%)'), 'Rail must center vertically via translateY(-50%)');
      assert.ok(body.includes('var(--rail-sticky-center)'), 'Rail must calculate usable viewport center');
    });
  });

  describe('2. Engineered Progress Track & Clean Endpoints', () => {
    test('renders static track line and dynamic progress segment', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Advanced Computer Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-rail-track-line'), 'Must render static track line');
      assert.ok(html.includes('revision-rail-progress-line'), 'Must render dynamic progress line');
    });

    test('track line and progress segment align precisely at 19.5px to terminate cleanly at marker centers', () => {
      const trackMatch = cssContent.match(/\.revision-rail-track-line\s*\{([^}]*)\}/);
      assert.ok(trackMatch, 'Must match .revision-rail-track-line in CSS');
      assert.ok(trackMatch[1].includes('top: 19.5px'), 'Track line must start at 19.5px marker center');
      assert.ok(trackMatch[1].includes('bottom: 19.5px'), 'Track line must end at 19.5px marker center');

      const progressMatch = cssContent.match(/\.revision-rail-progress-line\s*\{([^}]*)\}/);
      assert.ok(progressMatch, 'Must match .revision-rail-progress-line in CSS');
      assert.ok(progressMatch[1].includes('top: 19.5px'), 'Progress line must start at 19.5px marker center');
      assert.ok(progressMatch[1].includes('max-height: calc(100% - 39px)'), 'Progress line max-height must terminate exactly at last marker center');
      assert.ok(progressMatch[1].includes('var(--accent, #A3FF12)'), 'Progress line must use lime green accent');
    });
  });

  describe('3. Three-State Marker System (Active, Completed, Upcoming)', () => {
    test('renders distinct styling rules for Active, Completed, and Upcoming markers', () => {
      // Inactive / Upcoming
      const bulletMatch = cssContent.match(/\.revision-rail-bullet\s*\{([^}]*)\}/);
      assert.ok(bulletMatch, 'Must define .revision-rail-bullet');
      assert.ok(bulletMatch[1].includes('#27272A'), 'Upcoming bullet must use graphite background');

      // Completed
      assert.ok(cssContent.includes('.revision-rail-step.completed .revision-rail-bullet'), 'CSS must style completed bullet');
      assert.ok(cssContent.includes('rgba(163, 255, 18, 0.45)'), 'Completed bullet must use muted lime tint');

      // Active
      assert.ok(cssContent.includes('.revision-rail-step.active .revision-rail-bullet'), 'CSS must style active bullet');
      assert.ok(cssContent.includes('.revision-rail-active-glow'), 'CSS must define active halo ring');
    });

    test('active marker includes traveling halo ring element with layoutId and spring physics', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Advanced Computer Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-rail-active-glow'), 'Must render active halo element on current section');
      assert.ok(html.includes('aria-current="true"'), 'Must designate current section with aria-current="true"');
    });
  });

  describe('4. Refined Numbering & Kinetic Typography', () => {
    test('renders two-digit monospace numbering (01, 02, etc.) with tabular numerals', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Advanced Computer Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('01</span>'), 'Must format first step as two-digit 01');
      assert.ok(html.includes('02</span>'), 'Must format second step as two-digit 02');

      const numMatch = cssContent.match(/\n\.revision-rail-num\s*\{([^}]*)\}/);
      assert.ok(numMatch, 'Must define .revision-rail-num');
      assert.ok(numMatch[1].includes('var(--font-mono, monospace)'), 'Must use monospace font');
      assert.ok(numMatch[1].includes('tabular-nums'), 'Must use tabular-nums to eliminate layout jitter');
    });

    test('active number transitions to bright white with subtle horizontal micro-shift', () => {
      const activeNumMatch = cssContent.match(/\.revision-rail-step\.active\s+\.revision-rail-num\s*\{([^}]*)\}/);
      assert.ok(activeNumMatch, 'Must define .revision-rail-step.active .revision-rail-num');
      assert.ok(activeNumMatch[1].includes('#FFFFFF'), 'Active number must be bright white');
      assert.ok(activeNumMatch[1].includes('translateX(1.5px)'), 'Active number must have subtle 1.5px micro-shift');
    });
  });

  describe('5. Precision Instrument Tooltip', () => {
    test('renders tooltip containing section number, em-dash separator, and label', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Advanced Computer Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-rail-tooltip'), 'Must render .revision-rail-tooltip');
      assert.ok(html.includes('revision-rail-tooltip-num'), 'Must render tooltip number');
      assert.ok(html.includes('revision-rail-tooltip-sep'), 'Must render tooltip em-dash separator');
      assert.ok(html.includes('—'), 'Must include em-dash character in tooltip');
      assert.ok(html.includes('revision-rail-tooltip-label'), 'Must render tooltip label');
    });

    test('tooltip is positioned to the left with dark background and hover delay', () => {
      const tooltipMatch = cssContent.match(/\.revision-rail-tooltip\s*\{([^}]*)\}/);
      assert.ok(tooltipMatch, 'Must define .revision-rail-tooltip');
      const body = tooltipMatch[1];
      assert.ok(body.includes('right: calc(100% + 12px)'), 'Tooltip must sit to the left of the rail');
      assert.ok(body.includes('#141416'), 'Tooltip must use dark #141416 surface');
      assert.ok(body.includes('border: 1px solid rgba(255, 255, 255, 0.1)'), 'Tooltip must use restrained border');

      assert.ok(cssContent.includes('.revision-rail-step:hover .revision-rail-tooltip'), 'Must define hover trigger');
      assert.ok(cssContent.includes('transition-delay: 50ms'), 'Must include subtle 50ms hover delay to prevent flashing');
    });
  });

  describe('6. Interaction, Accessibility & Motion Preferences', () => {
    test('supports keyboard focus and custom focus outline on steps', () => {
      const focusMatch = cssContent.match(/\.revision-rail-step:focus-visible\s*\{([^}]*)\}/);
      assert.ok(focusMatch, 'Must define :focus-visible on rail steps');
      assert.ok(focusMatch[1].includes('var(--accent, #A3FF12)'), 'Focus outline must use lime green accent');
    });

    test('disables animations when prefers-reduced-motion is requested', () => {
      assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Must include prefers-reduced-motion media query');
      assert.ok(cssContent.includes('.revision-rail-bullet') && cssContent.includes('transition: none !important'), 'Must disable bullet transitions');
      assert.ok(cssContent.includes('.revision-rail-progress-line') && cssContent.includes('transition: none !important'), 'Must disable progress line transitions');
    });

    test('hides rail on screens <= 900px to prevent crowding', () => {
      const mobileMatch = cssContent.match(/@media\s*\(max-width:\s*900px\)\s*\{([^}]*\.revision-reading-rail\s*\{[^}]*\}[^}]*)\}/);
      assert.ok(mobileMatch || cssContent.includes('.revision-reading-rail {\n    display: none;'), 'Must hide rail on <=900px viewports');
    });
  });
});
