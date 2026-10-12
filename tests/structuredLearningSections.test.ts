import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import {
  RevisionWorkspace,
  parseInlineMarkup,
  EditorialFormattedContent
} from '../src/components/revision/RevisionWorkspace';
import { saveStoredExplanation } from '../src/services/conceptExplanation';

// In-memory backing store for localStorage simulation
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

describe('GraphMind Feature: Deep Revision Workspace (Phase 2 — Task 06: Structured Learning Sections)', () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  let cssContent: string;

  beforeEach(() => {
    storageMap.clear();
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  const baseGraph: KnowledgeGraph = {
    id: 'graph-distributed-systems',
    name: 'Distributed Systems',
    sources: [
      {
        id: 'src-lamport',
        name: 'Time, Clocks, and the Ordering of Events in a Distributed System',
        fileName: 'Lamport78.pdf',
        type: 'pdf',
        text: 'A system of logical clocks defines a partial ordering of events in distributed systems.',
        createdAt: '2026-09-01T00:00:00Z',
        status: 'Indexed'
      }
    ],
    nodes: [
      {
        id: 'c-lamport-clocks',
        name: 'Lamport Logical Clocks',
        type: 'mechanism',
        description: 'Monotonically increasing counter protocol to order events without synchronized physical clocks.',
        sourceIds: ['src-lamport'],
        isCoreConcept: true
      }
    ],
    relationships: [
      {
        id: 'rel-clock-causality',
        source: 'c-lamport-clocks',
        target: 'c-causal-order',
        type: 'guarantees',
        description: 'Ensures happen-before consistency.'
      }
    ]
  };

  describe('1. Structured Learning Sections Progression (Section 1)', () => {
    test('renders all supported sections when rich explanation data is provided', () => {
      const richExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Logical clocks assign monotonically increasing timestamps to establish event ordering in distributed environments.',
        howItWorks: [
          'Each process increments its internal counter before executing a local event.',
          'Processes attach their timestamp to every outgoing message.',
          'Receivers advance their local counter past the received timestamp upon receipt.'
        ],
        keyComponents: [
          { name: 'Local Counter C_i', description: 'Monotonic integer maintained per process node.', role: 'State' },
          { name: 'Piggybacked Timestamp', description: 'Tuple included in all network packets.', role: 'Transport' }
        ],
        importantDetails: [
          'If a -> b then C(a) < C(b), but C(a) < C(b) does not imply a -> b.',
          'Clock divergence is bounded by highest received timestamp increment.'
        ],
        examples: [
          'Consider Node A with clock 3 sending a message to Node B with clock 1. Node B updates clock to max(1, 3) + 1 = 4.'
        ],
        relatedConceptReferences: [
          { conceptId: 'c-causal-order', conceptName: 'Causal Consistency', relationshipType: 'guarantees', context: 'Guarantees causal precedence' }
        ],
        sourceReferences: [
          { sourceId: 'src-lamport', sourceTitle: 'Lamport Logical Clocks (1978)', page: 558, excerpt: 'The relation -> defines a partial ordering of events in the distributed system.' }
        ],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(richExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // Section 01
      assert.ok(html.includes('Understanding the concept'), 'Must render Section 01: Understand the concept');
      assert.ok(html.includes('Logical clocks assign monotonically increasing timestamps'), 'Must render overview lead');

      // Section 02
      assert.ok(html.includes('How it works'), 'Must render Section 02: How it works');
      assert.ok(html.includes('Each process increments its internal counter'), 'Must render operational steps');
      assert.ok(html.includes('revision-step-marker'), 'Must render step numbering badges');

      // Section 03
      assert.ok(html.includes('Key components'), 'Must render Section 03: Key components');
      assert.ok(html.includes('Local Counter C_i'), 'Must render component item');
      assert.ok(html.includes('Piggybacked Timestamp'), 'Must render component item');

      // Section 04
      assert.ok(html.includes('Important details'), 'Must render Section 04: Important details');
      assert.ok(html.includes('Clock divergence is bounded'), 'Must render detailed caveat');

      // Section 05
      assert.ok(html.includes('Example'), 'Must render Section 05: Example');
      assert.ok(html.includes('Consider Node A with clock 3'), 'Must render concrete example walkthrough');

      // Section 06
      assert.ok(html.includes('Related concepts'), 'Must render Section 06: Related concepts');
      assert.ok(html.includes('Causal Consistency'), 'Must render related concept target');

      // Section 07
      assert.ok(html.includes('Source References'), 'Must render Section 07: Source References');
      assert.ok(html.includes('PAGE 558'), 'Must render grounded page reference');
    });

    test('omits unsupported sections cleanly without artificial placeholders or empty space', () => {
      const minimalExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'A fundamental ordering protocol for distributed processes.',
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(minimalExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // Understand the concept is present
      assert.ok(html.includes('Understanding the concept'));

      // Unsupported sections are omitted
      assert.ok(!html.includes('How it works'), 'Must not render How it works when data is absent');
      assert.ok(!html.includes('Important details'), 'Must not render Important details when data is absent');
      assert.ok(!html.includes('revision-example-box'), 'Must not render example box when examples is absent');
    });
  });

  describe('2. Unobtrusive Section Jump Navigation (Section 5)', () => {
    test('renders compact jump navigation when multiple sections exist', () => {
      const multiSectionExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview content.',
        howItWorks: ['Step 1 execution mechanism.'],
        importantDetails: ['Incurred latency bound.'],
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(multiSectionExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-section-nav'), 'Must render section navigation jump bar');
      assert.ok(html.includes('SECTIONS'), 'Must render quiet uppercase kicker');
      assert.ok(html.includes('href="#section-understanding"'), 'Must link to understanding section id');
      assert.ok(html.includes('href="#section-how-it-works"'), 'Must link to how it works section id');
      assert.ok(html.includes('href="#section-important-details"'), 'Must link to details section id');
    });

    test('omits jump navigation when explanation has only a single section', () => {
      const singleSectionExplanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Brief overview only.',
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(singleSectionExplanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: {
            ...baseGraph,
            relationships: [] // No relationships so only Understand exists
          },
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(!html.includes('revision-section-nav'), 'Must omit navigation bar when only 1 section is present');
    });
  });

  describe('3. Safe Editorial Content & Rich Notation Rendering (Section 4)', () => {
    test('parses inline emphasis, code, and math tokens safely into React nodes', () => {
      const node = parseInlineMarkup('This is **critical** with `O(1)` complexity and $T_i$ value.');
      const html = renderToString(React.createElement('div', null, node));

      assert.ok(html.includes('<strong class="revision-inline-bold">critical</strong>'));
      assert.ok(html.includes('<code class="revision-inline-code">O(1)</code>'));
      assert.ok(html.includes('<span class="revision-math-token">T_i</span>'));
      assert.ok(!html.includes('<script>'), 'Zero dangerous script injection');
    });

    test('safely renders markdown comparison tables with horizontal scroll wrapper', () => {
      const tableMarkdown = `| Protocol | Synchrony | Ordering |
|---|---|---|
| Lamport Clocks | Asynchronous | Partial |
| Vector Clocks | Asynchronous | Causal |`;

      const html = renderToString(
        React.createElement(EditorialFormattedContent, { content: tableMarkdown })
      );

      assert.ok(html.includes('revision-table-wrapper'), 'Must wrap table in responsive overflow wrapper');
      assert.ok(html.includes('revision-editorial-table'), 'Must render editorial table element');
      assert.ok(html.includes('<th>Protocol</th>'));
      assert.ok(html.includes('<td>Lamport Clocks</td>'));
      assert.ok(html.includes('<td>Vector Clocks</td>'));
    });

    test('safely renders code blocks with monospace block styling', () => {
      const codeMarkdown = '```typescript\nconst clock = Math.max(local, msg) + 1;\n```';

      const html = renderToString(
        React.createElement(EditorialFormattedContent, { content: codeMarkdown })
      );

      assert.ok(html.includes('revision-code-block'), 'Must render code block container');
      assert.ok(html.includes('const clock = Math.max(local, msg) + 1;'));
    });
  });

  describe('4. Typography & Editorial CSS Compliance (Section 2 & 3)', () => {
    test('enforces strict Swiss-editorial styling tokens without linear gradients or glassmorphism', () => {
      assert.ok(cssContent.includes('.revision-section-num'), 'CSS must define section number styling');
      assert.ok(cssContent.includes('.revision-section-nav'), 'CSS must define section jump bar');
      assert.ok(cssContent.includes('.revision-how-it-works-step'), 'CSS must define how it works step');
      assert.ok(cssContent.includes('.revision-table-wrapper'), 'CSS must define responsive table wrapper');
      assert.ok(cssContent.includes('.revision-editorial-table'), 'CSS must define editorial table');
      assert.ok(cssContent.includes('.revision-code-block'), 'CSS must define code block');
      assert.ok(!cssContent.includes('linear-gradient'), 'Must strictly maintain zero linear gradients');
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'Must strictly avoid glassmorphism');
    });
  });
});
