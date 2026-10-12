import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { ConceptExplanation, WorkedExample } from '../src/types/explanation';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import {
  saveStoredExplanation,
  validateWorkedExample,
  synthesizeGroundedExplanation,
  extractConceptSourceContext
} from '../src/services/conceptExplanation';

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

describe('GraphMind Feature: Deep Revision Workspace (Phase 2 — Task 07: Worked Examples & Step-by-Step Learning)', () => {
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
        name: 'Time, Clocks, and Ordering in Distributed Systems',
        fileName: 'Lamport78.pdf',
        type: 'pdf',
        text: 'A system of logical clocks orders events: Process P1 with clock 3 sends message to P2 with clock 1. Calculate clock update.',
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
      },
      {
        id: 'c-consensus',
        name: 'Distributed Consensus',
        type: 'theory',
        description: 'High-level conceptual agreement guarantees across independent processes.',
        sourceIds: ['src-lamport']
      }
    ],
    relationships: [
      {
        id: 'rel-clock-causality',
        source: 'c-lamport-clocks',
        target: 'c-consensus',
        type: 'supports',
        description: 'Provides event ordering for consensus protocols.'
      }
    ]
  };

  const sampleWorkedExample: WorkedExample = {
    title: 'Lamport Logical Clock Update Scenario',
    problemStatement: 'Process P1 with clock C(P1) = 3 sends a message to Process P2 with clock C(P2) = 1. Calculate P2\'s updated timestamp upon receiving the message.',
    givenInfo: [
      'Sender Clock: C(P1) = 3',
      'Receiver Clock: C(P2) = 1',
      'Message Timestamp: T = 3'
    ],
    requiredResult: 'Compute updated timestamp C(P2) after receive event.',
    steps: [
      {
        stepNumber: 1,
        title: 'Timestamp Attachment at Sender',
        action: 'P1 increments its local counter and embeds timestamp T = 3 into the message payload.',
        reasoning: 'Every transmitted message must carry the sender\'s current logical clock value.',
        calculation: 'T = C(P1) = 3',
        intermediateResult: 'Message payload contains T = 3'
      },
      {
        stepNumber: 2,
        title: 'Receive Event Evaluation',
        action: 'P2 receives the message and compares its local clock (1) against incoming timestamp (3).',
        reasoning: 'The receive event must causally succeed the send event.',
        calculation: 'max(C(P2), T) = max(1, 3) = 3',
        intermediateResult: 'Baseline = 3'
      },
      {
        stepNumber: 3,
        title: 'Monotonic Clock Advance',
        action: 'P2 increments the maximum timestamp by 1 to record the receive event.',
        reasoning: 'Guarantees that C(receive) > C(send) holds strictly.',
        calculation: 'C(P2) = 3 + 1 = 4',
        intermediateResult: 'C(P2) = 4'
      }
    ],
    finalAnswer: 'The updated clock at Process P2 is C(P2) = 4.',
    importantObservation: 'P2\'s clock jumps forward from 1 to 4, preserving causal ordering without synchronized physical clocks.',
    isSourceDerived: true,
    sourceLabel: 'SOURCE-DERIVED EXAMPLE'
  };

  describe('1. Structured Worked Example Presentation (Section 2 & 3)', () => {
    test('renders complete structured worked example with steps, given info, and calculations', () => {
      const explanationWithExample: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Logical clocks assign monotonically increasing timestamps to establish event ordering.',
        workedExample: sampleWorkedExample,
        sourceReferences: [],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanationWithExample);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // Section Heading
      assert.ok(html.includes('Worked Example'), 'Must render Worked Example section title');

      // Title & Provenance Badge
      assert.ok(html.includes('Lamport Logical Clock Update Scenario'), 'Must render example title');
      assert.ok(html.includes('SOURCE-DERIVED EXAMPLE'), 'Must render source-derived badge');

      // Problem Statement
      assert.ok(html.includes('PROBLEM STATEMENT'), 'Must render problem statement kicker');
      assert.ok(html.includes('Process P1 with clock C(P1) = 3'), 'Must render problem statement text');

      // Given Info & Required Result
      assert.ok(html.includes('GIVEN INFORMATION'), 'Must render given info kicker');
      assert.ok(html.includes('Sender Clock: C(P1) = 3'), 'Must render given info item');
      assert.ok(html.includes('REQUIRED RESULT'), 'Must render required result kicker');
      assert.ok(html.includes('Compute updated timestamp C(P2)'), 'Must render required result text');

      // Steps sequence
      assert.ok(html.includes('SOLUTION STEPS'), 'Must render solution steps header');
      assert.ok(html.includes('STEP 01'), 'Must render Step 1 badge');
      assert.ok(html.includes('Timestamp Attachment at Sender'), 'Must render Step 1 title');
      assert.ok(html.includes('Why:'), 'Must render step reasoning prefix');
      assert.ok(html.includes('Every transmitted message must carry'), 'Must render step reasoning text');
      assert.ok(html.includes('T = C(P1) = 3'), 'Must render step calculation');
    });

    test('omits worked example cleanly when concept does not support an example', () => {
      const explanationWithoutExample: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        overview: 'A theoretical agreement framework across distributed nodes.',
        sourceReferences: [],
        isSourceGrounded: true,
        groundingConfidence: 'moderate',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanationWithoutExample);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-consensus',
          onBackToGraph: () => {}
        })
      );

      // Omit Section 05 entirely when no example is supported
      assert.ok(!html.includes('revision-worked-example'), 'Must not render worked example container');
      assert.ok(!html.includes('revision-example-box'), 'Must not render example box');
      assert.ok(!html.includes('PROBLEM STATEMENT'), 'Must not render problem statement kicker');
    });
  });

  describe('2. Interactive Reveal Controls (Section 4)', () => {
    test('renders interactive step reveal controls with problem statement always visible', () => {
      const explanationWithExample: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview content.',
        workedExample: sampleWorkedExample,
        sourceReferences: [],
        isSourceGrounded: true,
        groundingConfidence: 'high',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanationWithExample);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // Controls must be present
      assert.ok(html.includes('Show next step'), 'Must render "Show next step" button');
      assert.ok(html.includes('Show all steps'), 'Must render "Show all steps" button');
      assert.ok(html.includes('SOLUTION STEPS (1 OF 3 REVEALED)'), 'Must indicate 1 of 3 revealed initially');

      // Problem statement remains visible even while steps are progressively revealed
      assert.ok(html.includes('PROBLEM STATEMENT'), 'Problem statement must remain persistently visible');
    });

    test('renders final answer and key takeaway when all steps are completed', () => {
      const singleStepExample: WorkedExample = {
        title: 'Immediate Invariant Check',
        problemStatement: 'Evaluate base invariant C(a) < C(b).',
        steps: [
          {
            stepNumber: 1,
            title: 'Base Invariant Verification',
            action: 'Verify that clock counter is strictly monotonic.'
          }
        ],
        finalAnswer: 'Invariant holds strictly for all observed events.',
        importantObservation: 'Monotonicity prevents backward time travel in event traces.',
        isSourceDerived: false
      };

      const explanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview.',
        workedExample: singleStepExample,
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // When all steps are shown (1 of 1), final answer and takeaway are visible
      assert.ok(html.includes('FINAL ANSWER'), 'Must render final answer kicker');
      assert.ok(html.includes('Invariant holds strictly for all observed events'), 'Must render final answer text');
      assert.ok(html.includes('KEY TAKEAWAY'), 'Must render observation kicker');
      assert.ok(html.includes('Monotonicity prevents backward time travel'), 'Must render observation text');
    });
  });

  describe('3. Technical Accuracy & Provenance Labeling (Section 5)', () => {
    test('distinguishes source-derived from illustrative examples with explicit badges', () => {
      const illustrativeExample: WorkedExample = {
        ...sampleWorkedExample,
        isSourceDerived: false,
        sourceLabel: 'ILLUSTRATIVE APPLICATION'
      };

      const explanation: ConceptExplanation = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        conceptName: 'Lamport Logical Clocks',
        overview: 'Overview text.',
        workedExample: illustrativeExample,
        sourceReferences: [],
        isSourceGrounded: false,
        groundingConfidence: 'limited',
        generatedAt: new Date().toISOString()
      };

      saveStoredExplanation(explanation);

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: baseGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('ILLUSTRATIVE APPLICATION'), 'Must display illustrative badge');
      assert.ok(html.includes('revision-provenance-illustrative'), 'Must use illustrative badge styling');
      assert.ok(!html.includes('SOURCE-DERIVED EXAMPLE'), 'Must not claim source-derived for illustrative example');
    });

    test('validateWorkedExample sanitizes malformed steps and rejects empty or invalid input', () => {
      // Missing title
      assert.equal(validateWorkedExample({ problemStatement: 'Foo', steps: [] }), undefined);

      // Empty steps array
      assert.equal(validateWorkedExample({ title: 'Bar', problemStatement: 'Foo', steps: [] }), undefined);

      // Malformed steps with missing action
      const result = validateWorkedExample({
        title: 'Valid Title',
        problemStatement: 'Valid Statement',
        steps: [
          { title: 'Step 1', action: '' }, // invalid
          { title: 'Step 2', action: 'Perform local clock increment', calculation: 'C + 1' }
        ]
      });

      assert.ok(result !== undefined);
      assert.equal(result!.steps.length, 1, 'Must keep only valid steps');
      assert.equal(result!.steps[0].action, 'Perform local clock increment');
      assert.equal(result!.steps[0].stepNumber, 1, 'Must renumber valid steps consecutively');
    });

    test('deterministic synthesis produces structured worked example for procedural concepts with evidence', () => {
      const contextResult = extractConceptSourceContext(baseGraph, 'c-lamport-clocks');
      assert.equal(contextResult.status, 'found');
      if (contextResult.status !== 'found') return;

      const synthesized = synthesizeGroundedExplanation(contextResult.context);
      assert.ok(synthesized.workedExample !== undefined, 'Must produce worked example for algorithmic clock concept with evidence');
      assert.ok(synthesized.workedExample!.steps.length >= 2, 'Must have intermediate steps');
      assert.ok(synthesized.workedExample!.finalAnswer !== undefined, 'Must compute final answer');
    });
  });

  describe('4. Visual Design & Editorial CSS Tokens (Section 6)', () => {
    test('enforces Swiss-editorial styling tokens without linear gradients or glassmorphism', () => {
      assert.ok(cssContent.includes('.revision-worked-example'), 'CSS must define worked example container');
      assert.ok(cssContent.includes('.revision-provenance-badge'), 'CSS must define provenance badge');
      assert.ok(cssContent.includes('.revision-step-action-btn'), 'CSS must define step action button');
      assert.ok(cssContent.includes('.revision-worked-step-active'), 'CSS must define active step accent');
      assert.ok(cssContent.includes('.revision-step-calc-box'), 'CSS must define intermediate calculation box');
      assert.ok(cssContent.includes('.revision-final-answer-box'), 'CSS must define final answer box');

      // Strict project-wide aesthetic constraints
      assert.ok(!cssContent.includes('linear-gradient'), 'Must strictly maintain zero linear gradients');
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'Must strictly avoid glassmorphism blur');
    });
  });
});
