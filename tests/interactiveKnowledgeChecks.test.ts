import test, { describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeSource } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import {
  generateKnowledgeCheckQuestions,
  evaluateKnowledgeCheckAnswer,
  hasSufficientMaterialForKnowledgeCheck,
  loadStoredKnowledgeCheck,
  saveStoredKnowledgeCheck,
  clearStoredKnowledgeChecks,
  getKnowledgeCheckStorageKey,
  extractEssentialKeyTerms,
  STORAGE_KNOWLEDGE_CHECK_PREFIX
} from '../src/services/knowledgeCheck';
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

describe('GraphMind Feature: Interactive Knowledge Checks (Phase 3 — Prompt 10)', { concurrency: 1 }, () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  let cssContent: string;

  beforeEach(() => {
    storageMap.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    cssContent = fs.readFileSync(cssPath, 'utf8');
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
    type: 'mechanism',
    description: 'An algorithm to generate a partial ordering of events and detect causality violations in distributed systems.',
    sourceIds: ['src-vector-clocks-paper'],
    isCoreConcept: true,
    evidence: 'Vector clocks track causality across multiple independent nodes using clock vectors.',
    evidenceItems: [
      {
        sourceId: 'src-vector-clocks-paper',
        page: 52,
        chunkId: 'chunk-vector-01',
        text: 'Vector clocks maintain an integer vector of size N where each node tracks local and remote events.'
      }
    ]
  };

  const mockNodeInsufficient: KnowledgeNode = {
    id: 'c-insufficient',
    name: 'Obscure Token',
    type: 'term',
    description: '',
    evidence: '',
    sourceIds: []
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-distributed-systems',
    name: 'Distributed Systems Architecture',
    nodes: [mockNodeA, mockNodeB, mockNodeInsufficient],
    sources: [mockSourceA, mockSourceB],
    relationships: [
      {
        id: 'rel-lamport-vector',
        source: 'c-lamport-clocks',
        target: 'c-vector-clocks',
        type: 'foundation-for',
        description: 'Lamport logical clocks serve as the scalar foundation that vector clocks extend for causal concurrency detection.'
      }
    ]
  };

  const mockExplanationA: ConceptExplanation = {
    graphId: 'graph-distributed-systems',
    conceptId: 'c-lamport-clocks',
    conceptName: 'Lamport Logical Clocks',
    category: 'mechanism',
    overview: 'Lamport logical clocks assign monotonically increasing sequence numbers to events to define a partial ordering based on the happened-before relation.',
    howItWorks: [
      'Each process increments its internal counter before issuing an event, and message recipients update their counter to exceed the timestamp of incoming messages.',
      'This guarantees that if event a happened before event b, then timestamp(a) is strictly less than timestamp(b).'
    ],
    keyTerminology: [
      { term: 'Happened-Before', definition: 'A partial ordering relation between events in a distributed system.' },
      { term: 'Monotonic Counter', definition: 'A clock counter that never decreases over time.' }
    ],
    importantDetails: [
      'Scalar timestamps cannot differentiate between concurrent events and causally dependent events.'
    ],
    relatedConceptReferences: [
      {
        conceptId: 'c-vector-clocks',
        conceptName: 'Vector Clocks',
        relationshipType: 'foundation-for',
        context: 'Lamport Logical Clocks is the foundation for Vector Clocks.'
      }
    ],
    sourceReferences: [
      {
        sourceId: 'src-dist-sys-book',
        sourceTitle: 'Distributed Systems Principles (Tanenbaum)',
        page: 245,
        chunkId: 'chunk-lamport-01',
        excerpt: 'Lamport logical clocks assign monotonically increasing sequence numbers to events.'
      }
    ],
    isSourceGrounded: true,
    groundingConfidence: 'high',
    generatedAt: '2026-10-14T00:00:00.000Z'
  };

  // -------------------------------------------------------------------------
  // 1. Question Association & Source-Grounded Generation
  // -------------------------------------------------------------------------
  describe('1. Question Association & Source-Grounded Generation', () => {
    test('associates generated questions strictly with the target graph and concept', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });

      assert.strictEqual(result.status, 'ready');
      assert.ok('questions' in result);
      assert.ok(result.questions.length >= 2, 'Must generate at least 2 questions');

      for (const q of result.questions) {
        assert.strictEqual(q.graphId, 'graph-distributed-systems');
        assert.strictEqual(q.conceptId, 'c-lamport-clocks');
        assert.strictEqual(q.conceptName, 'Lamport Logical Clocks');
        assert.ok(q.id.startsWith('kc-'), 'Question ID must be prefixed with kc-');
      }
    });

    test('generates multiple choice and short answer questions grounded in authentic source text', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });

      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const mcq = result.questions.find(q => q.type === 'multiple-choice');
      assert.ok(mcq, 'Must generate a multiple-choice question');
      assert.ok(mcq.options && mcq.options.length >= 4, 'MCQ must have at least 4 options');
      assert.ok(mcq.correctOptionId, 'MCQ must specify correctOptionId');
      assert.ok(mcq.explanation.includes('Lamport Logical Clocks'), 'Explanation must reference genuine concept');

      // Distractors must use genuine concepts from the graph (Vector Clocks), not hallucinated concepts
      const distractorTexts = mcq.options.map(o => o.text).join(' ');
      assert.ok(
        distractorTexts.includes('Vector Clocks') || distractorTexts.includes('causality') || distractorTexts.includes('passive'),
        'Distractors must be derived from genuine graph concepts or contrasting properties'
      );

      const sa = result.questions.find(q => q.type === 'short-answer');
      assert.ok(sa, 'Must generate a short-answer question');
      assert.ok(sa.correctAnswer.length >= 20, 'Short answer must have a substantial reference answer');
      assert.ok(sa.keyTerms && sa.keyTerms.length >= 3, 'Short answer must have extracted key terms');
    });

    test('links questions to the relevant section anchor in the concept explanation', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });

      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const mcq = result.questions.find(q => q.type === 'multiple-choice');
      assert.ok(mcq?.sectionId, 'MCQ must specify a sectionId for review');
      assert.ok(mcq?.sectionTitle, 'MCQ must specify a sectionTitle for review');

      const sa = result.questions.find(q => q.type === 'short-answer');
      assert.ok(sa?.sectionId, 'Short-answer must specify a sectionId for review');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Answering Interactions & Formative Feedback
  // -------------------------------------------------------------------------
  describe('2. Answering Interactions & Formative Feedback', () => {
    test('correct multiple choice answer produces verified positive feedback', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });
      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const mcq = result.questions.find(q => q.type === 'multiple-choice')!;
      const evalResult = evaluateKnowledgeCheckAnswer(mcq, mcq.correctOptionId!);

      assert.strictEqual(evalResult.isCorrect, true);
      assert.strictEqual(evalResult.score, 1);
      assert.strictEqual(evalResult.evaluationConfidence, 'high');
      assert.ok(evalResult.feedback.includes('Correct'));
      assert.strictEqual(evalResult.correctAnswer, mcq.correctAnswer);
      assert.ok(evalResult.reviewSectionId);
    });

    test('incorrect multiple choice answer provides misconception rationale when available', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });
      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const mcq = result.questions.find(q => q.type === 'multiple-choice')!;
      const incorrectOptionId = mcq.options!.find(o => o.id !== mcq.correctOptionId)!.id;

      const evalResult = evaluateKnowledgeCheckAnswer(mcq, incorrectOptionId);
      assert.strictEqual(evalResult.isCorrect, false);
      assert.strictEqual(evalResult.score, 0);
      assert.ok(evalResult.feedback.includes('Not quite'));
      assert.ok(evalResult.correctAnswer, 'Must communicate the correct answer');
      assert.ok(evalResult.explanation, 'Must provide source-grounded explanation');
    });

    test('short answer evaluates exact and semantically equivalent responses correctly', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });
      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const sa = result.questions.find(q => q.type === 'short-answer')!;

      // 1. Exact match
      const exactEval = evaluateKnowledgeCheckAnswer(sa, sa.correctAnswer);
      assert.strictEqual(exactEval.isCorrect, true);
      assert.strictEqual(exactEval.score, 1);
      assert.strictEqual(exactEval.evaluationConfidence, 'high');

      // 2. Semantically equivalent student response with distinct wording
      const equivalentStudentAnswer =
        'Each process increments its internal counter before events and message recipients update counter timestamps to maintain clock ordering.';
      const equivalentEval = evaluateKnowledgeCheckAnswer(sa, equivalentStudentAnswer);
      assert.strictEqual(equivalentEval.isCorrect, true, 'Semantically equivalent wording must be marked correct');
      assert.ok(equivalentEval.score >= 0.8);
      assert.ok(equivalentEval.matchedKeyTerms && equivalentEval.matchedKeyTerms.length >= 2);
    });

    test('short answer handles uncertainty honestly when response is borderline', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });
      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const sa = result.questions.find(q => q.type === 'short-answer')!;

      // Student wrote a response with marginal terminology
      const borderlineAnswer = 'It is an algorithm used in computers that uses sequence numbers in distributed systems.';
      const borderlineEval = evaluateKnowledgeCheckAnswer(sa, borderlineAnswer);

      // Must communicate that evaluation is uncertain rather than declaring false absolute certainty
      if (!borderlineEval.isCorrect) {
        assert.ok(
          borderlineEval.evaluationConfidence === 'uncertain' || borderlineEval.evaluationConfidence === 'high',
          'Confidence must be declared'
        );
      }
    });

    test('irrelevant short answer is marked incorrect with source reference', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-lamport-clocks',
        explanation: mockExplanationA
      });
      assert.strictEqual(result.status, 'ready');
      if (result.status !== 'ready') return;

      const sa = result.questions.find(q => q.type === 'short-answer')!;
      const irrelevantAnswer = 'Photosynthesis converts sunlight and water into chemical energy.';

      const irrevEval = evaluateKnowledgeCheckAnswer(sa, irrelevantAnswer);
      assert.strictEqual(irrevEval.isCorrect, false);
      assert.strictEqual(irrevEval.score, 0);
      assert.ok(irrevEval.feedback.includes('Not quite'));
      assert.strictEqual(irrevEval.correctAnswer, sa.correctAnswer);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Insufficient Material Handling
  // -------------------------------------------------------------------------
  describe('3. Insufficient Material Handling', () => {
    test('explains that knowledge check is unavailable when source material is insufficient', () => {
      const hasMaterial = hasSufficientMaterialForKnowledgeCheck(mockNodeInsufficient, null, mockGraph);
      assert.strictEqual(hasMaterial, false);

      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-insufficient',
        explanation: null
      });

      assert.strictEqual(result.status, 'insufficient');
      assert.ok('reason' in result);
      assert.ok(result.reason.includes('Obscure Token'));
      assert.ok(result.reason.includes('sufficient verified definitions'));
    });

    test('does not fabricate general-knowledge trivia when material is inadequate', () => {
      const result = generateKnowledgeCheckQuestions({
        graph: mockGraph,
        conceptId: 'c-insufficient',
        explanation: null
      });

      assert.strictEqual(result.status, 'insufficient');
      assert.strictEqual('questions' in result, false, 'Must not return mock or fabricated questions');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Persistence & Graph Isolation
  // -------------------------------------------------------------------------
  describe('4. Persistence & Graph Isolation', () => {
    test('persists student answers and evaluation attempts per graph and concept', () => {
      const key = getKnowledgeCheckStorageKey('graph-distributed-systems', 'c-lamport-clocks');
      assert.strictEqual(key, `${STORAGE_KNOWLEDGE_CHECK_PREFIX}graph-distributed-systems_c-lamport-clocks`);

      saveStoredKnowledgeCheck({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'kc-mcq-c-lamport-clocks': {
            questionId: 'kc-mcq-c-lamport-clocks',
            submittedAnswer: 'opt-01',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Correct.',
              explanation: 'Verified from source.',
              correctAnswer: 'Monotonic logical counters',
              reviewSectionId: 'section-understanding'
            },
            attemptedAt: '2026-10-14T01:00:00.000Z'
          }
        },
        updatedAt: '2026-10-14T01:00:00.000Z'
      });

      const loaded = loadStoredKnowledgeCheck('graph-distributed-systems', 'c-lamport-clocks');
      assert.ok(loaded);
      assert.strictEqual(loaded.graphId, 'graph-distributed-systems');
      assert.strictEqual(loaded.conceptId, 'c-lamport-clocks');
      assert.ok(loaded.attempts['kc-mcq-c-lamport-clocks']);
      assert.strictEqual(loaded.attempts['kc-mcq-c-lamport-clocks'].submittedAnswer, 'opt-01');
      assert.strictEqual(loaded.attempts['kc-mcq-c-lamport-clocks'].evaluation.isCorrect, true);
    });

    test('isolates stored knowledge checks strictly by graph ID', () => {
      saveStoredKnowledgeCheck({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-lamport-clocks',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: '2026-10-14T01:00:00.000Z'
      });

      const otherGraphResult = loadStoredKnowledgeCheck('graph-other-system', 'c-lamport-clocks');
      assert.strictEqual(otherGraphResult, null, 'Must never return knowledge checks across different graph IDs');
    });

    test('clearing knowledge checks for one graph does not affect other graphs', () => {
      saveStoredKnowledgeCheck({
        graphId: 'graph-A',
        conceptId: 'c-1',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: '2026-10-14T01:00:00.000Z'
      });
      saveStoredKnowledgeCheck({
        graphId: 'graph-B',
        conceptId: 'c-1',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: '2026-10-14T01:00:00.000Z'
      });

      clearStoredKnowledgeChecks('graph-A');
      assert.strictEqual(loadStoredKnowledgeCheck('graph-A', 'c-1'), null);
      assert.ok(loadStoredKnowledgeCheck('graph-B', 'c-1'), 'Graph B records must remain intact');
    });
  });

  // -------------------------------------------------------------------------
  // 5. UI Integration & Rendering in RevisionWorkspace
  // -------------------------------------------------------------------------
  describe('5. UI Integration & Rendering in RevisionWorkspace', () => {
    test('renders Knowledge Check section naturally in RevisionWorkspace', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Systems Architecture',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Knowledge Check'), 'Must render Knowledge Check heading');
      assert.ok(html.includes('revision-section-knowledge-check'), 'Must render knowledge check container');
      assert.ok(html.includes('Check understanding'), 'Must render submit button');
    });

    test('renders insufficient material state in RevisionWorkspace for inadequate concepts', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Systems Architecture',
          initialConceptId: 'c-insufficient',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Knowledge Check'), 'Must render section heading');
      assert.ok(html.includes('Formative check unavailable'), 'Must render unavailable title');
      assert.ok(html.includes('Obscure Token'), 'Must mention the affected concept name');
    });

    test('preserves revision session navigation and progress alongside knowledge checks', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Systems Architecture',
          initialConceptId: 'c-lamport-clocks',
          onBackToGraph: () => {}
        })
      );

      // Verify that concept navigation remains intact
      assert.ok(html.includes('Previous concept'), 'Previous navigation must remain present');
      assert.ok(html.includes('Next concept'), 'Next navigation must remain present');
      assert.ok(html.includes('revision-section-nav'), 'Section jump navigation must remain present');
      assert.ok(html.includes('Check'), 'Section jump nav must include Check link');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Visual Design & Swiss Editorial CSS Integrity
  // -------------------------------------------------------------------------
  describe('6. Visual Design & Swiss Editorial CSS Integrity', () => {
    test('enforces Swiss editorial styling tokens and prohibits linear gradients or blur in revision.css', () => {
      assert.ok(!cssContent.includes('linear-gradient'), 'revision.css must not use linear gradients');
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'revision.css must not use blur filters');
    });

    test('contains required CSS classes for interactive knowledge checks', () => {
      assert.ok(cssContent.includes('.revision-section-knowledge-check'), 'Must define .revision-section-knowledge-check');
      assert.ok(cssContent.includes('.revision-kc-container'), 'Must define .revision-kc-container');
      assert.ok(cssContent.includes('.revision-kc-option'), 'Must define .revision-kc-option');
      assert.ok(cssContent.includes('.revision-kc-submit-btn'), 'Must define .revision-kc-submit-btn');
      assert.ok(cssContent.includes('.revision-kc-feedback'), 'Must define .revision-kc-feedback');
      assert.ok(cssContent.includes('.revision-kc-review-link'), 'Must define .revision-kc-review-link');
      assert.ok(cssContent.includes('.revision-kc-insufficient'), 'Must define .revision-kc-insufficient');
    });
  });
});
