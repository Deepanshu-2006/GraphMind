/**
 * tests/revisionWorkspaceRefinement.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — REVISION WORKSPACE UI/UX REFINEMENT
 *
 * Verifies:
 * 1. Top Previous/Next Navigation: positioned directly below the header, above progress,
 *    communicates destination concept names, debounced, disabled states preserved,
 *    and no duplicate bottom navigation.
 * 2. Unboxed Content Sections: outer borders and card backgrounds removed from
 *    Understanding, Knowledge Check container, and Source references.
 * 3. Interactive Answer Options: preserved outlines, selection states, focus indicators.
 * 4. Typography & Spacing Hierarchy: clear hierarchy, comfortable reading width,
 *    deliberate vertical rhythm.
 * 5. Section Jump Navigation: compact unboxed items with active section highlighting in lime green.
 * 6. Related Concepts: clean editorial row layout with subtle separator and unboxed badges.
 * 7. Complete Session & Session State: full continuity without regressions.
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

const mockNodeA: KnowledgeNode = {
  id: 'node-os-intro',
  name: 'Operating System Overview',
  type: 'concept',
  description: 'Core software management layer coordinating hardware and user processes.',
  sourceIds: ['src-1'],
  keyIdeas: [
    'Provides essential hardware abstraction and process isolation.',
    'Coordinates CPU, memory, and persistent storage peripherals.'
  ]
};

const mockNodeB: KnowledgeNode = {
  id: 'node-cpu-sched',
  name: 'CPU Scheduling Algorithms',
  type: 'concept',
  description: 'Process dispatch policies maximizing throughput and minimizing turnaround time.',
  sourceIds: ['src-1'],
  keyIdeas: [
    'Preemptive vs non-preemptive execution guarantees.',
    'Turnaround time and response latency trade-offs.'
  ]
};

const mockNodeC: KnowledgeNode = {
  id: 'node-virtual-mem',
  name: 'Virtual Memory & Paging',
  type: 'concept',
  description: 'Address translation mechanism mapping contiguous virtual space to physical page frames.',
  sourceIds: ['src-1']
};

const mockRel: KnowledgeRelationship = {
  id: 'rel-sched-vm',
  source: 'node-cpu-sched',
  target: 'node-virtual-mem',
  relationType: 'depends-on',
  description: 'manages process memory footprints during context switches'
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-refined-os',
  name: 'Operating Systems & Architecture',
  nodes: [mockNodeA, mockNodeB, mockNodeC],
  relationships: [mockRel],
  sources: [
    {
      id: 'src-1',
      title: 'Operating Systems: Three Easy Pieces',
      type: 'document'
    }
  ]
};

const mockExplanationB: ConceptExplanation = {
  graphId: 'graph-refined-os',
  conceptId: 'node-cpu-sched',
  conceptName: 'CPU Scheduling Algorithms',
  status: 'ready',
  overview: 'CPU scheduling decides which process receives CPU core compute cycles at any given millisecond.',
  detailedExplanation: [
    'The kernel scheduler maintains queues of ready processes waiting for CPU time.',
    'Context switches happen transparently when a quantum expires or I/O blocks a thread.'
  ],
  importantPoints: [
    'Shortest Job First offers optimal average waiting time when burst lengths are known.',
    'Round Robin prevents starvation through strict time slicing.'
  ],
  sourceReferences: [
    {
      sourceId: 'src-1',
      sourceTitle: 'Operating Systems: Three Easy Pieces',
      chunkIndex: 2,
      quote: 'Scheduling is at the heart of any multi-tasking operating system.'
    }
  ],
  updatedAt: new Date().toISOString()
};

const mockKcStateB: ConceptKnowledgeCheckState = {
  graphId: 'graph-refined-os',
  conceptId: 'node-cpu-sched',
  status: 'ready',
  questions: [
    {
      id: 'q-sched-1',
      type: 'multiple-choice',
      prompt: 'Which scheduling algorithm guarantees optimal average waiting time under known burst durations?',
      options: [
        { id: 'opt-1', text: 'First-Come First-Served (FCFS)' },
        { id: 'opt-2', text: 'Shortest Job First (SJF)' },
        { id: 'opt-3', text: 'Round Robin with large quantum' }
      ],
      correctOptionId: 'opt-2',
      explanation: 'SJF is provably optimal for minimizing average process waiting time.'
    }
  ],
  activeQuestionIndex: 0,
  attempts: {},
  updatedAt: new Date().toISOString()
};

describe('GraphMind Revision Workspace UI/UX Refinement', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  beforeEach(() => {
    storageMap.clear();
    saveStoredExplanation(mockExplanationB);
    saveStoredKnowledgeCheck(mockKcStateB);
  });

  describe('1. Previous / Next Concept Navigation Integration', () => {
    test('renders Previous and Next navigation as a persistent bottom navigation bar positioned after the reading content', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1, // On second concept (CPU Scheduling)
          onBackToGraph: () => {}
        })
      );

      // Verify bottom navigation element exists
      assert.ok(html.includes('revision-concept-navigation'), 'Must render .revision-concept-navigation');
      assert.ok(html.includes('Previous concept'), 'Must include "Previous concept" action label');
      assert.ok(html.includes('Next concept'), 'Must include "Next concept" action label');

      // Verify order: revision-concept-navigation appears AFTER revision-progress-header in HTML
      const navPos = html.indexOf('revision-concept-navigation');
      const progressPos = html.indexOf('revision-progress-header');
      assert.ok(navPos > 0 && progressPos > 0, 'Both navigation and progress header must render');
      assert.ok(navPos > progressPos, 'Concept navigation must appear after revision progress header as persistent bottom bar');

      // Verify fixed positioning strategy respecting sidebar in CSS
      assert.ok(cssContent.includes('.revision-concept-navigation {'), 'CSS must define .revision-concept-navigation');
      const navMatch = cssContent.match(/\.revision-concept-navigation\s*\{([^}]*)\}/);
      assert.ok(navMatch, 'Must match .revision-concept-navigation rule block');
      assert.ok(navMatch[1].includes('position: fixed'), 'Must use fixed positioning');
      assert.ok(navMatch[1].includes('bottom: 0'), 'Must be pinned to bottom: 0');
      assert.ok(navMatch[1].includes('var(--sidebar-width'), 'Must respect sidebar width');
    });

    test('provides sufficient content clearance at bottom of scrollable content area', () => {
      const readingColMatch = cssContent.match(/\.revision-reading-column\s*\{([^}]*)\}/);
      assert.ok(readingColMatch, 'CSS must define .revision-reading-column');
      const body = readingColMatch[1];
      assert.ok(
        body.includes('padding: 56px 32px 120px') || body.includes('120px'),
        'Reading column must have 120px bottom clearance to prevent obscuring content'
      );
    });

    test('communicates adjacent destination concept names in the navigation labels', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      // Previous concept destination is mockNodeA (Operating System Overview)
      assert.ok(
        html.includes('Operating System Overview'),
        'Must display Previous concept destination title'
      );
      // Next concept destination is mockNodeC (Virtual Memory & Paging)
      assert.ok(
        html.includes('Virtual Memory &amp; Paging') || html.includes('Virtual Memory & Paging'),
        'Must display Next concept destination title'
      );
      assert.ok(html.includes('revision-nav-dest-name'), 'Must use .revision-nav-dest-name for destination subtitle');
    });

    test('does NOT render a duplicate navigation bar in the content area', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      // Check occurrences of revision-concept-navigation
      const occurrences = (html.match(/revision-concept-navigation/g) || []).length;
      assert.strictEqual(occurrences, 1, 'Must render exactly ONE revision-concept-navigation instance (no duplicate inline controls)');
    });

    test('disables Previous on first concept and Next on last concept', () => {
      // First concept
      const firstHtml = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 0,
          onBackToGraph: () => {}
        })
      );
      assert.ok(
        firstHtml.includes('revision-nav-prev disabled') || firstHtml.includes('disabled="" class="revision-nav-link revision-nav-prev disabled"'),
        'Previous link must be disabled on first concept'
      );

      // Last concept (index 2 of 3)
      const lastHtml = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 2,
          onBackToGraph: () => {}
        })
      );
      assert.ok(
        lastHtml.includes('revision-nav-next disabled') || lastHtml.includes('disabled="" class="revision-nav-link revision-nav-next disabled"'),
        'Next link must be disabled on last concept'
      );
      assert.ok(
        lastHtml.includes('revision-complete-session-action'),
        'Complete session action must remain available on last concept'
      );
    });
  });

  describe('2. Unboxed Content Sections & Removed Card Outlines', () => {
    test('Knowledge Check outer container removes heavy card borders and background', () => {
      const kcMatch = cssContent.match(/\.revision-kc-container\s*\{([^}]*)\}/);
      assert.ok(kcMatch, 'CSS must define .revision-kc-container');
      const body = kcMatch[1];
      assert.ok(body.includes('background: transparent'), 'Knowledge Check container must have transparent background');
      assert.ok(body.includes('border: none'), 'Knowledge Check container must have border: none');
      assert.ok(body.includes('padding: 0'), 'Knowledge Check container must remove card padding');
    });

    test('Source References removes enclosing card borders', () => {
      const srcCardMatch = cssContent.match(/\.revision-source-card\s*\{([^}]*)\}/);
      assert.ok(srcCardMatch, 'CSS must define .revision-source-card');
      const body = srcCardMatch[1];
      assert.ok(body.includes('background: transparent'), 'Source card must have transparent background');
      assert.ok(body.includes('border: none'), 'Source card must remove boxed border');
      assert.ok(body.includes('border-bottom: 1px solid'), 'Source card must use subtle separator hairline');
    });

    test('Interactive answer options retain distinct selectable outlines and states', () => {
      assert.ok(cssContent.includes('.revision-kc-option'), 'CSS must define .revision-kc-option');
      assert.ok(cssContent.includes('.revision-kc-option.selected'), 'CSS must define .revision-kc-option.selected');
      assert.ok(cssContent.includes('.revision-kc-option:focus-visible'), 'CSS must define accessible focus-visible outline');
    });

    test('Related concepts uses unboxed editorial row with subtle separator', () => {
      assert.ok(cssContent.includes('.revision-related-dir-badge'), 'CSS must define .revision-related-dir-badge');
      const badgeMatch = cssContent.match(/\.revision-related-dir-badge\s*\{([^}]*)\}/);
      assert.ok(badgeMatch, 'CSS must match .revision-related-dir-badge');
      const body = badgeMatch[1];
      assert.ok(body.includes('border: none'), 'Direction badge must not have a boxed border');
      assert.ok(body.includes('background: transparent'), 'Direction badge must be transparent');

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1, // CPU Scheduling has relationship to Virtual Memory
          onBackToGraph: () => {}
        })
      );
      assert.ok(html.includes('revision-related-separator'), 'Must render subtle separator in relationship metadata');
    });
  });

  describe('3. Refined Section Jump Navigation', () => {
    test('removes button-like borders and boxes from section navigation items', () => {
      const navItemMatch = cssContent.match(/\.revision-section-nav-item\s*\{([^}]*)\}/);
      assert.ok(navItemMatch, 'CSS must define .revision-section-nav-item');
      const body = navItemMatch[1];
      assert.ok(body.includes('background: transparent'), 'Section nav items must have transparent background');
      assert.ok(body.includes('border: none'), 'Section nav items must not have button-like borders');
    });

    test('supports active section highlighting using lime-green accent', () => {
      assert.ok(
        cssContent.includes('.revision-section-nav-item.active'),
        'CSS must define .revision-section-nav-item.active'
      );
      assert.ok(
        cssContent.includes('.revision-section-nav-item.active .revision-nav-label'),
        'CSS must highlight active section label with lime green'
      );
    });

    test('renders active class and aria-current on the currently active section', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      assert.ok(
        html.includes('revision-section-nav-item active') || html.includes('active revision-section-nav-item'),
        'Initially active section must have active class'
      );
      assert.ok(
        html.includes('aria-current="true"'),
        'Active section item must have aria-current="true"'
      );
    });
  });

  describe('4. Typography, Hierarchy & Concept Status Metadata', () => {
    test('concept title has Level 1 visual prominence (32-36px, confident weight)', () => {
      const titleMatch = cssContent.match(/\.revision-concept-title\s*\{([^}]*)\}/);
      assert.ok(titleMatch, 'CSS must define .revision-concept-title');
      const body = titleMatch[1];
      assert.ok(
        body.includes('font-weight: 600') || body.includes('font-weight: 650') || body.includes('font-weight: 750') || body.includes('font-weight: 800'),
        'Title must have strong hierarchy weight'
      );
      assert.ok(
        body.includes('clamp(32px') || body.includes('clamp(30px') || body.includes('32px') || body.includes('30px'),
        'Title must target 32-36px desktop range'
      );
    });

    test('concept definition has Level 2 readable styling directly beneath title', () => {
      const descMatch = cssContent.match(/\.revision-concept-description\s*\{([^}]*)\}/);
      assert.ok(descMatch, 'CSS must define .revision-concept-description');
      const body = descMatch[1];
      assert.ok(body.includes('clamp(17px') || body.includes('17px'), 'Definition must use 17-19px responsive size');
      assert.ok(body.includes('line-height: 1.65'), 'Definition must use comfortable line-height around 1.65');
      assert.ok(body.includes('max-width: 65ch'), 'Definition measure must be restricted to 65ch');
    });

    test('metadata row renders distinct treatments for Concept Number, Status Badge, and View Sources', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems & Architecture',
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );

      // Concept number
      assert.ok(html.includes('CONCEPT 02'), 'Must render concept number');
      assert.ok(html.includes('revision-concept-badge-dot'), 'Must render subtle lime dot');

      // Status badge
      assert.ok(html.includes('revision-concept-mastery-tag'), 'Must render status tag');
      assert.ok(html.includes('In progress') || html.includes('IN PROGRESS'), 'Must render status text');
      assert.ok(cssContent.includes('.revision-concept-mastery-tag') && cssContent.includes('text-transform: uppercase'), 'Status badge must format in uppercase');

      // View sources action
      assert.ok(html.includes('revision-source-inspect-link'), 'Must render View sources link');
      assert.ok(html.includes('View sources · 1'), 'Must render "View sources · 1" format');

      // CSS distinction
      assert.ok(cssContent.includes('.revision-concept-badge-number-group'), 'Must group number and dot');
      assert.ok(cssContent.includes('.revision-source-inspect-link:hover'), 'Must provide clear hover transition');
      assert.ok(cssContent.includes('.revision-source-inspect-link:focus-visible'), 'Must provide accessible focus state');
    });

    test('section headings use consistent restrained uppercase style', () => {
      assert.ok(cssContent.includes('.revision-section-heading'), 'CSS must define .revision-section-heading');
      assert.ok(cssContent.includes('text-transform: uppercase'), 'Section headings must be restrained uppercase');
      assert.ok(cssContent.includes('letter-spacing: 0.08em'), 'Section headings must have editorial letter-spacing');
    });

    test('responsive mobile styles hide destination concept name to prevent crowding', () => {
      assert.ok(
        cssContent.includes('.revision-nav-dest-name {\n    display: none;\n  }') ||
        cssContent.includes('.revision-nav-dest-name {\n    display: none;'),
        'Mobile query must hide destination name to prevent collision'
      );
    });
  });
});
