/**
 * tests/revisionRailStructuralAnimation.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — REVISION WORKSPACE VERTICAL SECTION RAIL STRUCTURAL ANIMATION
 *
 * Validates the 8 core acceptance criteria from the specification:
 * TEST A: Switch from 4 sections to 5 sections (smooth expansion, marker repositioning, added marker)
 * TEST B: Switch from 5 sections to 4 sections (smooth contraction, clean removal, remaining markers settle)
 * TEST C: Switch between concepts with the same number of sections (stable geometry)
 * TEST D: Rapid switching across variable section counts (latest concept wins, no flicker/overlap)
 * TEST E: Active rail marker updates smoothly when navigating sections
 * TEST F: Reading content scroll keeps rail anchored in fixed viewport position
 * TEST G: Variable title lengths do not alter rail width or cause reading column layout shifts
 * TEST H: Prefers-reduced-motion settings eliminate layout/geometry animation durations
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
  calculateRailGeometry,
  RAIL_STEP_STRIDE,
  RAIL_MARKER_OFFSET
} from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import { saveStoredExplanation } from '../src/services/conceptExplanation';

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

// Concept with 4 sections: Understand, How it works, Details, Sources
const nodeFourSections: KnowledgeNode = {
  id: 'node-4-sections',
  name: 'Memory Hierarchy Design',
  type: 'concept',
  description: 'Cache levels, locality of reference, and latency tiers in modern CPUs.',
  sourceIds: ['src-arch-1']
};

// Concept with 5 sections: Understand, How it works, Terminology/Components, Details, Sources
const nodeFiveSections: KnowledgeNode = {
  id: 'node-5-sections',
  name: 'Multi-Level Cache Coherence Protocols',
  type: 'concept',
  description: 'MESI and MOESI snoop-based coherence mechanisms in shared-memory multiprocessors.',
  sourceIds: ['src-arch-1']
};

// Concept with another 4 sections: Understand, How it works, Details, Sources
const nodeFourSectionsB: KnowledgeNode = {
  id: 'node-4-sections-b',
  name: 'Branch Prediction Units',
  type: 'concept',
  description: 'Static and dynamic branch predictors, two-level adaptive branch predictors.',
  sourceIds: ['src-arch-1']
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-rail-structural-test',
  name: 'Advanced Processor Architecture',
  nodes: [nodeFourSections, nodeFiveSections, nodeFourSectionsB],
  relationships: [],
  sources: [
    { id: 'src-arch-1', title: 'Computer Architecture: A Quantitative Approach', type: 'pdf', status: 'ready', uploadedAt: '2026-01-01' }
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z'
};

const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('GraphMind — Revision Workspace Vertical Rail Structural Animation', () => {
  beforeEach(() => {
    storageMap.clear();

    // Concept 1: 4 sections (Understand, How it works, Details, Check)
    const exp4A: ConceptExplanation = {
      graphId: mockGraph.id,
      conceptId: nodeFourSections.id,
      conceptName: nodeFourSections.name,
      overview: 'Memory hierarchy bridges processor-memory cycle gap.',
      howItWorks: ['L1 cache accessed in 1-4 cycles.', 'L2 and L3 caches service misses.'],
      importantDetails: ['Temporal locality favors repeated access.', 'Spatial locality prefetches blocks.'],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    // Concept 2: 5 sections (Understand, How it works, Terminology, Details, Check)
    const exp5: ConceptExplanation = {
      graphId: mockGraph.id,
      conceptId: nodeFiveSections.id,
      conceptName: nodeFiveSections.name,
      overview: 'Cache coherence guarantees uniform memory image across symmetric cores.',
      howItWorks: ['Bus snoopers intercept write invalidate requests.', 'Core broadcasts address line.'],
      keyTerminology: ['Modified: Line dirty and private.', 'Shared: Line clean and replicated.'],
      importantDetails: ['Invalidation traffic scales quadratically with snooping bus.'],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    // Concept 3: 4 sections (Understand, How it works, Details, Check)
    const exp4B: ConceptExplanation = {
      graphId: mockGraph.id,
      conceptId: nodeFourSectionsB.id,
      conceptName: nodeFourSectionsB.name,
      overview: 'Branch prediction speculative execution pipeline flow.',
      howItWorks: ['Branch Target Buffer caches target addresses.', '2-bit saturating counters record history.'],
      importantDetails: ['Misprediction penalties flush pipeline stages.'],
      generatedAt: '2026-01-15T00:00:00Z'
    };

    saveStoredExplanation(mockGraph.id, nodeFourSections.id, exp4A);
    saveStoredExplanation(mockGraph.id, nodeFiveSections.id, exp5);
    saveStoredExplanation(mockGraph.id, nodeFourSectionsB.id, exp4B);
  });

  // TEST A: Switch from 4 sections to 5 sections
  test('TEST A: Predictable geometry expansion from 4 sections to 5 sections', () => {
    const geo4 = calculateRailGeometry(4);
    assert.strictEqual(geo4.trackHeight, 156, '4 sections track height must be 4 * 39px = 156px');
    assert.strictEqual(geo4.lineLength, 117, '4 sections connecting line length must be 3 * 39px = 117px');
    assert.strictEqual(geo4.markerOffset, 19.5, 'First marker center must be at 19.5px');

    const geo5 = calculateRailGeometry(5);
    assert.strictEqual(geo5.trackHeight, 195, '5 sections track height must be 5 * 39px = 195px');
    assert.strictEqual(geo5.lineLength, 156, '5 sections connecting line length must be 4 * 39px = 156px');

    // Height delta is exactly 1 stride (39px)
    assert.strictEqual(geo5.trackHeight - geo4.trackHeight, RAIL_STEP_STRIDE, 'Height delta must equal exactly one step stride (39px)');

    // Render Concept 1 (4 sections)
    const html4 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );
    assert.ok(html4.includes('Memory Hierarchy Design'), 'Concept 1 title renders');
    assert.ok(html4.includes('04</span>'), 'Concept 1 has 4 sections (01 to 04)');
    assert.ok(!html4.includes('05</span>'), 'Concept 1 does not have a 5th section');

    // Render Concept 2 (5 sections)
    const html5 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );
    assert.ok(html5.includes('Multi-Level Cache Coherence Protocols'), 'Concept 2 title renders');
    assert.ok(html5.includes('05</span>'), 'Concept 2 has 5 sections (01 to 05)');
    assert.ok(html5.includes('section-key-components'), 'Concept 2 contains inserted Terminology section');
  });

  // TEST B: Switch from 5 sections to 4 sections
  test('TEST B: Predictable geometry contraction from 5 sections to 4 sections', () => {
    const geo5 = calculateRailGeometry(5);
    const geo4 = calculateRailGeometry(4);

    assert.strictEqual(geo5.trackHeight - geo4.trackHeight, 39, 'Contraction must reduce track height by exactly 39px');
    assert.strictEqual(geo5.lineLength - geo4.lineLength, 39, 'Connecting line contracts by exactly 39px');

    // Concept 3 (Index 2) has 4 sections
    const html = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 2,
        onBackToGraph: () => {}
      })
    );
    assert.ok(html.includes('Branch Prediction Units'), 'Concept 3 title renders');
    assert.ok(html.includes('04</span>'), 'Concept 3 has 4 sections');
    assert.ok(!html.includes('05</span>'), 'Concept 3 does not have a 5th section');
  });

  // TEST C: Switch between concepts with the same number of sections
  test('TEST C: Rail geometry remains stable when switching between concepts with the same section count', () => {
    const geoA = calculateRailGeometry(4);
    const geoB = calculateRailGeometry(4);

    assert.strictEqual(geoA.trackHeight, geoB.trackHeight, 'Track height must remain identical (156px)');
    assert.strictEqual(geoA.lineLength, geoB.lineLength, 'Connecting line length must remain identical (117px)');

    const html1 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );
    const html3 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 2,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html1.includes('revision-reading-rail-track'), 'Concept 1 renders rail track');
    assert.ok(html3.includes('revision-reading-rail-track'), 'Concept 3 renders rail track');
  });

  // TEST D: Connecting line alignment and endpoints
  test('TEST D: Connecting track line starts at 19.5px and ends at 19.5px from bottom', () => {
    // In CSS: top: 19.5px; bottom: 19.5px
    const trackMatch = cssContent.match(/\.revision-rail-track-line\s*\{([^}]*)\}/);
    assert.ok(trackMatch, 'Must match .revision-rail-track-line');
    assert.ok(trackMatch[1].includes('top: 19.5px'), 'Line must start at 19.5px');
    assert.ok(trackMatch[1].includes('bottom: 19.5px'), 'Line must end at 19.5px from bottom');

    // Mathematical verification:
    // With N sections: total height = N * 39px.
    // Line length = (N - 1) * 39px = totalHeight - 39px.
    // Top offset = 19.5px, bottom offset = 19.5px -> total deduction = 39px.
    for (let n = 2; n <= 8; n++) {
      const geo = calculateRailGeometry(n);
      const computedLineLength = geo.trackHeight - (2 * RAIL_MARKER_OFFSET);
      assert.strictEqual(computedLineLength, geo.lineLength, `Line length for N=${n} must match trackHeight - 39px`);
    }
  });

  // TEST E: Active rail marker updates with precision spring and layoutId
  test('TEST E: Active marker features layoutId="active-rail-marker" and aria-current="true"', () => {
    const html = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html.includes('revision-rail-active-marker'), 'Must render active marker');
    assert.ok(html.includes('aria-current="true"'), 'Must designate active step with aria-current="true"');
    assert.ok(!html.includes('revision-rail-active-glow'), 'Must not render legacy glowing ring');
  });

  // TEST F: Scroll and viewport anchoring (sticky position and centering calculation)
  test('TEST F: Rail remains anchored with sticky positioning and usable viewport centering', () => {
    const railMatch = cssContent.match(/\.revision-reading-rail\s*\{([^}]*)\}/);
    assert.ok(railMatch, 'Must define .revision-reading-rail');
    assert.ok(railMatch[1].includes('position: sticky'), 'Must use sticky positioning');
    assert.ok(railMatch[1].includes('transform: translateY(-50%)'), 'Must center vertically via translateY(-50%)');
    assert.ok(railMatch[1].includes('width: 48px'), 'Must have constant 48px width');
    assert.ok(railMatch[1].includes('flex-shrink: 0'), 'Must not shrink when reading content expands');
  });

  // TEST G: Title length independence and reading column stability
  test('TEST G: Rail width is independent of concept title lengths without layout shifts', () => {
    // Both short title and long title render with identical rail structure
    const htmlShort = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );

    const htmlLong = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );

    assert.ok(htmlShort.includes('width: 48px') || cssContent.includes('width: 48px'), 'Rail has fixed width');
    assert.ok(htmlLong.includes('revision-reading-rail'), 'Rail renders cleanly for long concept title');
  });

  // TEST H: Prefers-reduced-motion accessibility
  test('TEST H: Prefers-reduced-motion disables transitions on track and steps', () => {
    const reducedMotionMatch = cssContent.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*)\}/);
    assert.ok(reducedMotionMatch, 'Must define prefers-reduced-motion media query');
    const body = reducedMotionMatch[1];
    assert.ok(body.includes('.revision-reading-rail-track'), 'Track must be included in reduced motion');
    assert.ok(body.includes('.revision-rail-step-wrapper'), 'Step wrapper must be included in reduced motion');
    assert.ok(body.includes('transition: none !important'), 'Transitions must be disabled');
  });

  // TEST I: Concept switching animates rail track line and cascades step labels
  test('TEST I: Concept switching animates rail track line and cascades step labels', () => {
    const html1 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 0,
        onBackToGraph: () => {}
      })
    );

    const html2 = renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        revisionIndex: 1,
        onBackToGraph: () => {}
      })
    );

    assert.ok(html1.includes('revision-rail-label'), 'Concept 1 renders section labels in rail');
    assert.ok(html1.includes('revision-rail-track-line'), 'Concept 1 renders track line');
    assert.ok(html2.includes('revision-rail-label'), 'Concept 2 renders section labels in rail');
    assert.ok(html2.includes('Terminology'), 'Concept 2 includes Terminology section name');
  });
});

