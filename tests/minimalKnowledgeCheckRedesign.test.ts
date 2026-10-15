/**
 * tests/minimalKnowledgeCheckRedesign.test.ts
 *
 * Acceptance tests for:
 * GRAPHMIND — MINIMAL KNOWLEDGE CHECK REDESIGN
 *
 * Verifies:
 * - Test A: Initial state (clean unselected options, submit button state)
 * - Test B: Option selection styling (restrained thin lime border, no bright green fills)
 * - Test C: Incorrect answer feedback (cohesive region, unboxed explanation, distinction note, editorial quote, action row)
 * - Test D: Correct answer feedback (distinct lime status, next-step action)
 * - Test E: Progression & retry (clean reset, sequence stability, isolated feedback)
 * - Test F: Layout, responsive clearance, and Swiss editorial CSS integrity
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
import { KnowledgeCheckSection } from '../src/components/revision/KnowledgeCheckSection';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import type { ConceptKnowledgeCheckState } from '../src/types/knowledgeCheck';
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

describe('GRAPHMIND — MINIMAL KNOWLEDGE CHECK REDESIGN', () => {
  const cssPath = path.resolve(__dirname, '../src/styles/revision.css');
  let cssContent: string;

  beforeEach(() => {
    storageMap.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  const mockNode1: KnowledgeNode = {
    id: 'node-fcfs',
    name: 'First-Come, First-Served',
    type: 'algorithm',
    description: 'First-Come, First-Served assigns CPU time non-preemptively based strictly on process arrival order.',
    sourceIds: ['src-os-book'],
    isCoreConcept: true,
    evidence: 'FCFS executes processes strictly in arrival order.',
    evidenceItems: [
      {
        sourceId: 'src-os-book',
        page: 268,
        chunkId: 'chunk-fcfs-01',
        text: 'Processes are dispatched in strict FIFO sequence according to arrival time in the ready queue.'
      }
    ]
  };

  const mockNode2: KnowledgeNode = {
    id: 'node-priority',
    name: 'Priority Scheduling',
    type: 'algorithm',
    description: 'Priority Scheduling allocates CPU resources based on priority ranks assigned to processes.',
    sourceIds: ['src-os-book'],
    isCoreConcept: true,
    evidence: 'Processes with higher priority preempt lower priority jobs.',
    evidenceItems: [
      {
        sourceId: 'src-os-book',
        page: 272,
        chunkId: 'chunk-prio-01',
        text: 'The CPU is allocated to the process with the highest priority.'
      }
    ]
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-os-scheduling',
    name: 'CPU Scheduling Algorithms',
    nodes: [mockNode1, mockNode2],
    sources: [
      {
        id: 'src-os-book',
        name: 'Operating System Concepts (Silberschatz)',
        fileName: 'OS_Concepts.pdf',
        type: 'pdf',
        text: 'Processes are dispatched in strict FIFO sequence according to arrival time in the ready queue.',
        createdAt: '2026-09-01T00:00:00Z',
        status: 'Indexed'
      }
    ],
    relationships: [
      {
        id: 'rel-fcfs-prio',
        source: 'node-fcfs',
        target: 'node-priority',
        type: 'contrasts-with',
        description: 'FCFS follows arrival order whereas Priority Scheduling follows priority metrics.'
      }
    ]
  };

  const mockExplanationFCFS: ConceptExplanation = {
    graphId: 'graph-os-scheduling',
    conceptId: 'node-fcfs',
    conceptName: 'First-Come, First-Served',
    category: 'algorithm',
    overview: 'First-Come, First-Served assigns CPU time non-preemptively based strictly on process arrival order.',
    howItWorks: [
      'Processes enter the ready queue in chronological sequence.',
      'The CPU executes the head of the queue until completion or I/O request.'
    ],
    keyTerminology: [
      { term: 'FIFO Queue', definition: 'First-in, first-out data structure maintaining order.' }
    ],
    importantDetails: [
      'Suffers from the convoy effect when lengthy CPU-bound jobs arrive before short I/O-bound jobs.'
    ],
    relatedConceptReferences: [
      {
        conceptId: 'node-priority',
        conceptName: 'Priority Scheduling',
        relationshipType: 'contrasts-with',
        context: 'Unlike Priority Scheduling, FCFS ignores priority.'
      }
    ],
    sourceReferences: [
      {
        sourceId: 'src-os-book',
        sourceTitle: 'Operating System Concepts (Silberschatz)',
        page: 268,
        chunkId: 'chunk-fcfs-01',
        excerpt: 'Processes are dispatched in strict FIFO sequence according to arrival time in the ready queue.'
      }
    ],
    isSourceGrounded: true,
    groundingConfidence: 'high',
    generatedAt: '2026-10-14T00:00:00.000Z'
  };

  // =========================================================================
  // Test A: Initial State
  // =========================================================================
  describe('Test A: Initial State', () => {
    test('renders consistent options with unselected neutral badges and proper semantics', () => {
      const html = renderToString(
        React.createElement(KnowledgeCheckSection, {
          graph: mockGraph,
          conceptId: 'node-fcfs',
          conceptName: 'First-Come, First-Served',
          explanation: mockExplanationFCFS
        })
      );

      assert.ok(html.includes('role="radiogroup"'), 'Options container must have radiogroup role');
      assert.ok(html.includes('role="radio"'), 'Each option must be a radio button');
      assert.ok(html.includes('aria-checked="false"'), 'Options must be unselected by default');
      assert.ok(!html.includes('selected'), 'No option button has selected class initially');
      assert.ok(html.includes('Check understanding'), 'Submit button must be rendered');
      assert.ok(html.includes('disabled=""'), 'Submit button must be disabled when no option selected');
    });

    test('prohibits large bright green fills in unselected option CSS', () => {
      const optMatch = cssContent.match(/\.revision-kc-option\s*\{([^}]*)\}/);
      assert.ok(optMatch, 'CSS must define .revision-kc-option');
      const body = optMatch[1];
      assert.ok(
        body.includes('background: rgba(255, 255, 255, 0.02)') || body.includes('background: transparent'),
        'Unselected option must use near-black or transparent background'
      );
      assert.ok(!body.includes('#A3FF12'), 'Unselected option must not have lime background');
    });
  });

  // =========================================================================
  // Test B: Selection Styling & Keyboard Semantics
  // =========================================================================
  describe('Test B: Selection Styling & Keyboard Semantics', () => {
    test('enforces restrained selected state: bold left border, no green background tint, and transparent outer border', () => {
      const selectedMatch = cssContent.match(/\.revision-kc-option\.selected\s*\{([^}]*)\}/);
      assert.ok(selectedMatch, 'CSS must define .revision-kc-option.selected');
      const body = selectedMatch[1];

      assert.ok(
        body.includes('border-left: 3px solid var(--accent, #A3FF12)') || body.includes('border-left: 3px solid'),
        'Selected state must have bold left accent border'
      );
      assert.ok(!body.includes('background: rgba(163, 255, 18'), 'Selected state must not have green background tint');
      assert.ok(body.includes('border-color: transparent'), 'Selected state must remove outer borders except left');

      // Check slot badge in selected state: text lime, NOT solid green block (#A3FF12 as background)
      const slotSelectedMatch = cssContent.match(/\.revision-kc-option\.selected\s+\.revision-kc-option-slot\s*\{([^}]*)\}/);
      assert.ok(slotSelectedMatch, 'CSS must define selected option slot');
      const slotBody = slotSelectedMatch[1];
      assert.ok(slotBody.includes('color: var(--accent, #A3FF12)'), 'Selected slot text must turn lime');
      assert.ok(!slotBody.includes('background: var(--accent, #A3FF12); color: #0A0A0A'), 'Must not make slot a heavy solid green block');
    });

    test('defines distinct hover and keyboard-focus states without scale bounce', () => {
      const hoverMatch = cssContent.match(/\.revision-kc-option:hover[^\{]*\{([^}]*)\}/);
      assert.ok(hoverMatch, 'CSS must define option hover state');
      assert.ok(!hoverMatch[1].includes('transform: scale'), 'Hover must not use scale bounce');

      assert.ok(cssContent.includes('.revision-kc-option:focus-visible'), 'CSS must define focus-visible');
    });
  });

  // =========================================================================
  // Test C: Incorrect Answer Feedback & Cohesive Consolidation
  // =========================================================================
  describe('Test C: Incorrect Answer Feedback & Cohesive Consolidation', () => {
    test('reorganizes incorrect answer into ONE cohesive feedback region without nested cards', () => {
      // Simulate stored incorrect attempt
      const attemptState: ConceptKnowledgeCheckState = {
        graphId: 'graph-os-scheduling',
        conceptId: 'node-fcfs',
        status: 'ready',
        questions: [
          {
            id: 'kc-fcfs-01',
            graphId: 'graph-os-scheduling',
            conceptId: 'node-fcfs',
            conceptName: 'First-Come, First-Served',
            type: 'multiple-choice',
            prompt: 'How does First-Come, First-Served allocate CPU time?',
            options: [
              { id: 'opt-01', text: 'Based strictly on process arrival order in FIFO sequence.' },
              { id: 'opt-02', text: 'Allocates CPU resources based on priority ranks assigned to processes.' }
            ],
            correctOptionId: 'opt-01',
            correctAnswer: 'Based strictly on process arrival order in FIFO sequence.',
            explanation: 'FCFS executes processes strictly in arrival order according to your material.',
            sourcePassage: 'Processes are dispatched in strict FIFO sequence according to arrival time.',
            sourceTitle: 'Operating System Concepts',
            page: 268,
            sectionId: 'section-how-it-works',
            sectionTitle: 'How it works'
          }
        ],
        activeQuestionIndex: 0,
        attempts: {
          'kc-fcfs-01': {
            questionId: 'kc-fcfs-01',
            submittedAnswer: 'opt-02',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Not quite. Review the explanation below.',
              explanation: 'FCFS executes processes strictly in arrival order according to your material.',
              misconceptionGuidance: 'Your selected answer describes Priority Scheduling, whereas First-Come, First-Served follows arrival order.',
              correctAnswer: 'Based strictly on process arrival order in FIFO sequence.',
              reviewSectionId: 'section-how-it-works',
              reviewSectionTitle: 'How it works'
            },
            attemptedAt: '2026-10-14T01:00:00Z'
          }
        },
        updatedAt: '2026-10-14T01:00:00Z'
      };
      saveStoredKnowledgeCheck(attemptState);

      const html = renderToString(
        React.createElement(KnowledgeCheckSection, {
          graph: mockGraph,
          conceptId: 'node-fcfs',
          conceptName: 'First-Come, First-Served',
          explanation: mockExplanationFCFS
        })
      );

      // 1. Result Header: Restrained amber indicator
      assert.ok(html.includes('revision-kc-feedback incorrect'), 'Feedback region must have incorrect status');
      assert.ok(html.includes('REVIEW RECOMMENDED') || html.includes('NOT QUITE'), 'Result header shows compact status');

      // 2. Explanation displayed directly without nested bordered cards
      assert.ok(html.includes('FCFS executes processes strictly in arrival order'), 'Explanation must be rendered directly');
      assert.ok(!html.includes('revision-kc-correct-answer-box'), 'Must remove redundant nested correct-answer box');

      // 3. Misconception Note (Key Distinction) rendered inline with subtle label
      assert.ok(html.includes('KEY DISTINCTION'), 'Must render KEY DISTINCTION subhead');
      assert.ok(html.includes('Your selected answer describes Priority Scheduling'), 'Must display misconception rationale');

      // 4. Source Evidence rendered as quotation with citation
      assert.ok(html.includes('revision-kc-quote'), 'Must render editorial quotation');
      assert.ok(html.includes('Processes are dispatched in strict FIFO sequence'), 'Must include authentic passage');
      assert.ok(html.includes('Operating System Concepts'), 'Must include source title');
      assert.ok(html.includes('Page 268'), 'Must include page citation');

      // 5. Consolidated Action Row
      assert.ok(html.includes('revision-kc-action-row'), 'Must contain unified action row');
      assert.ok(html.includes('Review concept ↗') || html.includes('Review in'), 'Must provide primary review action');
      assert.ok(html.includes('revision-kc-review-link'), 'Must keep revision-kc-review-link class for review action');
      assert.ok(html.includes('Try again'), 'Must provide secondary Try again action');

      // 6. User selected option remains clearly identifiable in submitted state
      assert.ok(html.includes('submitted-incorrect'), 'Submitted option must be marked submitted-incorrect');
      assert.ok(html.includes('Selected'), 'Submitted option shows Selected status marker');

      // 7. No duplicate adaptive panel
      assert.ok(!html.includes('revision-adaptive-container'), 'Must not render separate duplicate adaptive panel');
    });
  });

  // =========================================================================
  // Test D: Correct Answer Feedback
  // =========================================================================
  describe('Test D: Correct Answer Feedback', () => {
    test('renders distinct lime result header without unnecessary misconception panel', () => {
      const correctState: ConceptKnowledgeCheckState = {
        graphId: 'graph-os-scheduling',
        conceptId: 'node-fcfs',
        status: 'ready',
        questions: [
          {
            id: 'kc-fcfs-01',
            graphId: 'graph-os-scheduling',
            conceptId: 'node-fcfs',
            conceptName: 'First-Come, First-Served',
            type: 'multiple-choice',
            prompt: 'How does First-Come, First-Served allocate CPU time?',
            options: [
              { id: 'opt-01', text: 'Based strictly on process arrival order in FIFO sequence.' },
              { id: 'opt-02', text: 'Allocates CPU resources based on priority ranks assigned to processes.' }
            ],
            correctOptionId: 'opt-01',
            correctAnswer: 'Based strictly on process arrival order in FIFO sequence.',
            explanation: 'FCFS executes processes strictly in arrival order according to your material.',
            sourcePassage: 'Processes are dispatched in strict FIFO sequence according to arrival time.',
            sourceTitle: 'Operating System Concepts',
            page: 268,
            sectionId: 'section-how-it-works',
            sectionTitle: 'How it works'
          }
        ],
        activeQuestionIndex: 0,
        attempts: {
          'kc-fcfs-01': {
            questionId: 'kc-fcfs-01',
            submittedAnswer: 'opt-01',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Correct.',
              explanation: 'FCFS executes processes strictly in arrival order according to your material.',
              correctAnswer: 'Based strictly on process arrival order in FIFO sequence.',
              reviewSectionId: 'section-how-it-works',
              reviewSectionTitle: 'How it works'
            },
            attemptedAt: '2026-10-14T01:00:00Z'
          }
        },
        updatedAt: '2026-10-14T01:00:00Z'
      };
      saveStoredKnowledgeCheck(correctState);

      const html = renderToString(
        React.createElement(KnowledgeCheckSection, {
          graph: mockGraph,
          conceptId: 'node-fcfs',
          conceptName: 'First-Come, First-Served',
          explanation: mockExplanationFCFS
        })
      );

      assert.ok(html.includes('revision-kc-feedback correct'), 'Must have correct status');
      assert.ok(html.includes('CORRECT'), 'Status header must show CORRECT');
      assert.ok(!html.includes('KEY DISTINCTION'), 'Must not render misconception panel on correct answer');
      assert.ok(html.includes('submitted-correct'), 'Submitted option has submitted-correct treatment');
    });
  });

  // =========================================================================
  // Test E: Progression & Retry Stability
  // =========================================================================
  describe('Test E: Progression & Retry Stability', () => {
    test('isolates question attempts and does not bleed stale feedback into adjacent questions', () => {
      const multiQState: ConceptKnowledgeCheckState = {
        graphId: 'graph-os-scheduling',
        conceptId: 'node-fcfs',
        status: 'ready',
        questions: [
          {
            id: 'kc-fcfs-01',
            graphId: 'graph-os-scheduling',
            conceptId: 'node-fcfs',
            conceptName: 'First-Come, First-Served',
            type: 'multiple-choice',
            prompt: 'Question 1: Arrival order?',
            options: [{ id: 'opt-1', text: 'Yes' }, { id: 'opt-2', text: 'No' }],
            correctOptionId: 'opt-1',
            correctAnswer: 'Yes',
            explanation: 'Grounded in arrival order.'
          },
          {
            id: 'kc-fcfs-02',
            graphId: 'graph-os-scheduling',
            conceptId: 'node-fcfs',
            conceptName: 'First-Come, First-Served',
            type: 'multiple-choice',
            prompt: 'Question 2: Convoy effect risk?',
            options: [{ id: 'opt-3', text: 'Yes' }, { id: 'opt-4', text: 'No' }],
            correctOptionId: 'opt-3',
            correctAnswer: 'Yes',
            explanation: 'Grounded in convoy effect.'
          }
        ],
        activeQuestionIndex: 1, // On question 2 (unanswered)
        attempts: {
          'kc-fcfs-01': {
            questionId: 'kc-fcfs-01',
            submittedAnswer: 'opt-1',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Correct.',
              explanation: 'Grounded in arrival order.',
              correctAnswer: 'Yes'
            },
            attemptedAt: '2026-10-14T01:00:00Z'
          }
        },
        updatedAt: '2026-10-14T01:00:00Z'
      };
      saveStoredKnowledgeCheck(multiQState);

      const html = renderToString(
        React.createElement(KnowledgeCheckSection, {
          graph: mockGraph,
          conceptId: 'node-fcfs',
          conceptName: 'First-Come, First-Served',
          explanation: mockExplanationFCFS
        })
      );

      // Question 2 is active and unanswered: must show interactive area, not question 1's feedback
      assert.ok(html.includes('Question 2: Convoy effect risk?'), 'Active prompt is question 2');
      assert.ok(html.includes('Check understanding'), 'Submit button rendered for unanswered question 2');
      assert.ok(!html.includes('Grounded in arrival order'), 'Stale feedback from question 1 must not appear');
    });
  });

  // =========================================================================
  // Test F: Visual Architecture, Swiss Editorial Tokens, and Mobile Responsiveness
  // =========================================================================
  describe('Test F: Visual Architecture & Swiss Editorial Tokens', () => {
    test('strictly enforces zero linear gradients, zero backdrop-filter blur, and dark surfaces', () => {
      assert.ok(!cssContent.includes('linear-gradient'), 'Must prohibit linear gradients in revision.css');
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'Must prohibit blur filters in revision.css');
    });

    test('defines consolidated feedback and action styling tokens', () => {
      const requiredSelectors = [
        '.revision-kc-feedback',
        '.revision-kc-feedback-header',
        '.revision-kc-status-tag',
        '.revision-kc-status-dot',
        '.revision-kc-feedback-message',
        '.revision-kc-distinction',
        '.revision-kc-distinction-label',
        '.revision-kc-quote',
        '.revision-kc-quote-text',
        '.revision-kc-action-row',
        '.revision-kc-action-primary',
        '.revision-kc-action-secondary',
        '.revision-kc-review-link'
      ];

      for (const sel of requiredSelectors) {
        assert.ok(cssContent.includes(sel), `CSS must define ${sel}`);
      }
    });

    test('includes feedback and actions in prefers-reduced-motion block', () => {
      const reducedMotionIdx = cssContent.lastIndexOf('@media (prefers-reduced-motion: reduce)');
      assert.ok(reducedMotionIdx !== -1, 'prefers-reduced-motion block must exist');
      const reducedBlock = cssContent.slice(reducedMotionIdx, reducedMotionIdx + 1200);
      assert.ok(reducedBlock.includes('.revision-kc-feedback'), 'Feedback container must be covered');
      assert.ok(reducedBlock.includes('.revision-kc-action-primary'), 'Primary action button must be covered');
    });
  });
});
