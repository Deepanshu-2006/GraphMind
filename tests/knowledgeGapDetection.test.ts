import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import type { ConceptKnowledgeCheckState } from '../src/types/knowledgeCheck';
import type { AssessmentAttempt, TestQuestion } from '../src/types/test';
import {
  detectKnowledgeGaps,
  formatGapStateLabel,
  dismissKnowledgeGap,
  deferKnowledgeGap,
  restoreKnowledgeGap,
  clearGapPreferences,
  invalidateKnowledgeGapsCache
} from '../src/services/knowledgeGapDetection';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';
import { saveAssessmentAttempt, clearAssessmentHistory } from '../src/services/assessmentHistory';
import { updateConceptPracticeState } from '../src/services/storage';

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

describe('GraphMind Feature: Knowledge Gap Detection (Phase 4 — Prompt 16)', { concurrency: 1 }, () => {
  const testGraphId = 'graph-knowledge-gap-test';

  const mockNodeAttention: KnowledgeNode = {
    id: 'c-attention',
    name: 'Self-Attention Mechanism',
    type: 'architecture',
    description: 'Computes contextual representations using query-key-value products.',
    sourceIds: ['src-vaswani-2017'],
    prerequisites: ['c-dot-product'] // Confirmed prerequisite
  };

  const mockNodeDotProduct: KnowledgeNode = {
    id: 'c-dot-product',
    name: 'Dot-Product Matrix Multiplication',
    type: 'foundation',
    description: 'Fundamental linear algebraic projection operation.',
    sourceIds: ['src-vaswani-2017']
  };

  const mockNodeTransformer: KnowledgeNode = {
    id: 'c-transformer',
    name: 'Transformer Architecture',
    type: 'architecture',
    description: 'Encoder-decoder network with stacked self-attention layers.',
    sourceIds: ['src-vaswani-2017']
  };

  const mockNodePositional: KnowledgeNode = {
    id: 'c-positional',
    name: 'Positional Encoding',
    type: 'technique',
    description: 'Sinusoidal order representations injected into embeddings.',
    sourceIds: ['src-vaswani-2017']
  };

  const mockRelationships: KnowledgeRelationship[] = [
    {
      id: 'rel-dot-to-attn',
      source: 'c-dot-product',
      target: 'c-attention',
      type: 'foundation-for',
      sourceChunkIds: ['chk-1']
    },
    {
      id: 'rel-attn-to-trans',
      source: 'c-attention',
      target: 'c-transformer',
      type: 'part-of', // General relationship, NOT a prerequisite
      sourceChunkIds: ['chk-2']
    },
    {
      id: 'rel-pos-to-trans',
      source: 'c-positional',
      target: 'c-transformer',
      type: 'related-to', // General relationship
      sourceChunkIds: ['chk-3']
    }
  ];

  const testGraph: KnowledgeGraph = {
    id: testGraphId,
    name: 'Deep Learning & Attention Graph',
    nodes: [mockNodeAttention, mockNodeDotProduct, mockNodeTransformer, mockNodePositional],
    relationships: mockRelationships,
    sources: []
  };

  beforeEach(() => {
    storageMap.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    clearAssessmentHistory();
    clearGapPreferences(testGraphId);
    invalidateKnowledgeGapsCache();
  });

  // --------------------------------------------------------------------------
  // Rule 1: Repeated incorrect answers flag a concept
  // --------------------------------------------------------------------------
  test('Rule 1: Repeated incorrect answers flag a concept with review-recommended', () => {
    // Record two consecutive incorrect formative attempts on 'c-attention'
    const kcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-attention',
      status: 'ready',
      questions: [
        {
          id: 'q-att-1',
          graphId: testGraphId,
          conceptId: 'c-attention',
          conceptName: 'Self-Attention Mechanism',
          type: 'multiple-choice',
          prompt: 'How is attention weight calculated?',
          correctAnswer: 'Softmax of scaled dot products',
          explanation: 'Attention weights are computed via scaled dot products.'
        },
        {
          id: 'q-att-2',
          graphId: testGraphId,
          conceptId: 'c-attention',
          conceptName: 'Self-Attention Mechanism',
          type: 'multiple-choice',
          prompt: 'What are queries matched against?',
          correctAnswer: 'Keys',
          explanation: 'Queries compute dot products with keys.'
        }
      ],
      activeQuestionIndex: 1,
      attempts: {
        'q-att-1': {
          questionId: 'q-att-1',
          submittedAnswer: 'opt-incorrect-1',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Softmax is required for scaled dot-product attention.',
            explanation: 'Weights require normalization.',
            correctAnswer: 'Softmax of scaled dot products'
          },
          attemptedAt: '2026-10-10T10:00:00.000Z'
        },
        'q-att-2': {
          questionId: 'q-att-2',
          submittedAnswer: 'opt-incorrect-2',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Queries match with keys, not values directly.',
            explanation: 'Key vectors are target matrices.',
            correctAnswer: 'Keys'
          },
          attemptedAt: '2026-10-10T10:05:00.000Z'
        }
      },
      updatedAt: '2026-10-10T10:05:00.000Z'
    };

    saveStoredKnowledgeCheck(kcState);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    const attentionGap = report.items.find(i => i.conceptId === 'c-attention');

    assert.ok(attentionGap, 'Self-Attention should be analyzed in report');
    assert.strictEqual(
      attentionGap.gapState,
      'review-recommended',
      'Should classify repeated incorrect answers as review-recommended'
    );
    assert.strictEqual(attentionGap.statusLabel, 'Review recommended');
    assert.strictEqual(attentionGap.incorrectAnswersCount, 2);
    assert.strictEqual(attentionGap.consecutiveIncorrectCount, 2);
    assert.match(attentionGap.reason, /2 recent answers were incorrect/i);
    assert.strictEqual(attentionGap.supportingEvidence.length, 2);
  });

  // --------------------------------------------------------------------------
  // Rule 2: One isolated mistake is NOT automatically treated as a persistent gap
  // --------------------------------------------------------------------------
  test('Rule 2: One isolated mistake is classified as observed-difficulty, NOT review-recommended', () => {
    // Record only 1 single incorrect attempt
    const kcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-attention',
      status: 'ready',
      questions: [
        {
          id: 'q-att-1',
          graphId: testGraphId,
          conceptId: 'c-attention',
          conceptName: 'Self-Attention Mechanism',
          type: 'multiple-choice',
          prompt: 'How is attention weight calculated?',
          correctAnswer: 'Softmax of scaled dot products',
          explanation: 'Attention weights are computed via scaled dot products.'
        }
      ],
      activeQuestionIndex: 0,
      attempts: {
        'q-att-1': {
          questionId: 'q-att-1',
          submittedAnswer: 'opt-wrong',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Missing scaling factor in dot product.',
            explanation: 'Scaling prevents saturation.',
            correctAnswer: 'Softmax of scaled dot products'
          },
          attemptedAt: '2026-10-10T10:00:00.000Z'
        }
      },
      updatedAt: '2026-10-10T10:00:00.000Z'
    };

    saveStoredKnowledgeCheck(kcState);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    const attentionGap = report.items.find(i => i.conceptId === 'c-attention');

    assert.ok(attentionGap);
    assert.strictEqual(
      attentionGap.gapState,
      'observed-difficulty',
      'Single isolated mistake must be classified as observed-difficulty'
    );
    assert.strictEqual(attentionGap.statusLabel, 'Observed difficulty');
    assert.match(attentionGap.reason, /not yet evidence of a persistent gap/i);
  });

  // --------------------------------------------------------------------------
  // Rule 3: Unassessed concepts remain unassessed (insufficient-evidence)
  // --------------------------------------------------------------------------
  test('Rule 3: Unassessed concepts remain insufficient-evidence and are not labeled as knowledge gaps', () => {
    // Positional Encoding has no recorded attempts or assessments
    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    const posGap = report.items.find(i => i.conceptId === 'c-positional');

    assert.ok(posGap);
    assert.strictEqual(posGap.gapState, 'insufficient-evidence');
    assert.strictEqual(posGap.statusLabel, 'Insufficient evidence');
    assert.strictEqual(posGap.totalAssessedQuestions, 0);
    assert.match(posGap.reason, /insufficient assessment evidence/i);

    // It must NOT be included in activeGaps requiring review
    const inActive = report.activeGaps.some(g => g.conceptId === 'c-positional');
    assert.strictEqual(inActive, false, 'Unassessed concepts must not be placed in active gaps');
  });

  // --------------------------------------------------------------------------
  // Rule 4 & 5: Graph-aware analysis: Prerequisites vs General relationships
  // --------------------------------------------------------------------------
  test('Rule 4 & 5: Prerequisite failure triggers potential-foundational-gap; general relationships are not prerequisites', () => {
    // 1. Give 'c-dot-product' (a confirmed prerequisite to 'c-attention') recorded difficulty
    const dotKcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-dot-product',
      status: 'ready',
      questions: [{
        id: 'q-dot-1',
        graphId: testGraphId,
        conceptId: 'c-dot-product',
        conceptName: 'Dot-Product Matrix Multiplication',
        type: 'multiple-choice',
        prompt: 'What is matrix dot product dimension rule?',
        correctAnswer: 'Inner dimensions must match',
        explanation: 'K must match.'
      }],
      activeQuestionIndex: 0,
      attempts: {
        'q-dot-1': {
          questionId: 'q-dot-1',
          submittedAnswer: 'wrong-dim',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Inner dimensions must align.',
            explanation: 'Dimension mismatch.',
            correctAnswer: 'Inner dimensions must match'
          },
          attemptedAt: '2026-10-10T09:00:00.000Z'
        }
      },
      updatedAt: '2026-10-10T09:00:00.000Z'
    };
    saveStoredKnowledgeCheck(dotKcState);

    // 2. Give 'c-attention' difficulty as well
    const attnKcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-attention',
      status: 'ready',
      questions: [{
        id: 'q-att-1',
        graphId: testGraphId,
        conceptId: 'c-attention',
        conceptName: 'Self-Attention Mechanism',
        type: 'multiple-choice',
        prompt: 'How is attention weight calculated?',
        correctAnswer: 'Softmax of scaled dot products',
        explanation: 'Weights.'
      }],
      activeQuestionIndex: 0,
      attempts: {
        'q-att-1': {
          questionId: 'q-att-1',
          submittedAnswer: 'wrong-ans',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Incorrect softmax calculation.',
            explanation: 'Attention weights.',
            correctAnswer: 'Softmax of scaled dot products'
          },
          attemptedAt: '2026-10-10T10:00:00.000Z'
        }
      },
      updatedAt: '2026-10-10T10:00:00.000Z'
    };
    saveStoredKnowledgeCheck(attnKcState);

    // 3. Give 'c-transformer' difficulty
    // Note: 'c-transformer' is connected to 'c-attention' via 'part-of' and 'c-positional' via 'related-to' (general relationships)
    // Neither of these is declared in mockNodeTransformer.prerequisites!
    const transKcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-transformer',
      status: 'ready',
      questions: [{
        id: 'q-trans-1',
        graphId: testGraphId,
        conceptId: 'c-transformer',
        conceptName: 'Transformer Architecture',
        type: 'multiple-choice',
        prompt: 'What does a transformer layer contain?',
        correctAnswer: 'Multi-head attention and feedforward network',
        explanation: 'Layer architecture.'
      }],
      activeQuestionIndex: 0,
      attempts: {
        'q-trans-1': {
          questionId: 'q-trans-1',
          submittedAnswer: 'wrong-layer',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Missing feedforward block.',
            explanation: 'Architecture definition.',
            correctAnswer: 'Multi-head attention and feedforward network'
          },
          attemptedAt: '2026-10-10T11:00:00.000Z'
        }
      },
      updatedAt: '2026-10-10T11:00:00.000Z'
    };
    saveStoredKnowledgeCheck(transKcState);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });

    // A. Self-Attention struggles, AND its confirmed prerequisite Dot-Product also struggles
    const attentionGap = report.items.find(i => i.conceptId === 'c-attention')!;
    assert.strictEqual(
      attentionGap.gapState,
      'potential-foundational-gap',
      'Should be potential-foundational-gap because confirmed prerequisite Dot-Product has difficulty'
    );
    assert.match(
      attentionGap.reason,
      /foundational prerequisite 'Dot-Product Matrix Multiplication'/i,
      'Reason must cite the exact foundational prerequisite name'
    );
    assert.strictEqual(
      attentionGap.recommendedAction.type,
      'open-related-concept',
      'Recommended action should be to open/review foundational concept'
    );

    // B. Transformer struggles, but its connected concepts are only general relationships ('part-of', 'related-to')
    const transGap = report.items.find(i => i.conceptId === 'c-transformer')!;
    assert.notStrictEqual(
      transGap.gapState,
      'potential-foundational-gap',
      'Transformer should NOT be upgraded to potential-foundational-gap since no prerequisite was declared'
    );
    assert.strictEqual(
      transGap.gapState,
      'observed-difficulty',
      'Should remain observed-difficulty for single error'
    );

    // Verify general relationships are labeled as 'Related concept in graph', NOT prerequisite
    const relatedAttention = transGap.relatedConcepts.find(r => r.conceptId === 'c-attention')!;
    assert.strictEqual(relatedAttention.isPrerequisite, false);
    assert.strictEqual(relatedAttention.relationshipLabel, 'Related concept in graph');
  });

  // --------------------------------------------------------------------------
  // Rule 6: Recommendations cite real supporting evidence
  // --------------------------------------------------------------------------
  test('Rule 6: Recommendations cite real supporting evidence from formative and summative history', () => {
    // Create a summative assessment attempt
    const mockAttempt: AssessmentAttempt = {
      id: 'att-test-01',
      testId: 'test-01',
      userId: 'test-user',
      graphId: testGraphId,
      graphName: testGraph.name,
      createdAt: '2026-10-11T12:00:00.000Z',
      completedAt: '2026-10-11T12:10:00.000Z',
      totalQuestions: 1,
      correctAnswers: 0,
      scorePercentage: 0,
      timeSpentSeconds: 120,
      completionReason: 'submission',
      questions: [
        {
          id: 'q-sum-1',
          type: 'concept',
          question: 'What is the role of softmax in attention?',
          options: [
            { id: 'opt-a', text: 'Linear scaling' },
            { id: 'opt-b', text: 'Probability distribution over values' },
            { id: 'opt-c', text: 'Dropout regularizer' },
            { id: 'opt-d', text: 'Layer normalization' }
          ],
          correctOptionId: 'opt-b',
          explanation: 'Softmax turns unnormalized dot products into valid probability weights.',
          conceptIds: ['c-attention'],
          conceptNames: ['Self-Attention Mechanism'],
          sourceIds: ['src-vaswani-2017']
        }
      ],
      userAnswers: {
        'q-sum-1': 'opt-a' // Incorrect choice
      },
      conceptIds: ['c-attention'],
      conceptNames: ['Self-Attention Mechanism'],
      sourceIds: ['src-vaswani-2017'],
      resultsSummary: {
        testId: 'test-01',
        attemptId: 'att-test-01',
        score: 0,
        totalQuestions: 1,
        percentage: 0,
        timeSpentSeconds: 120,
        strongConceptNames: [],
        reviewRecommendedConcepts: [
          {
            conceptId: 'c-attention',
            conceptName: 'Self-Attention Mechanism',
            questionId: 'q-sum-1',
            questionText: 'What is the role of softmax in attention?',
            selectedOptionText: 'Linear scaling',
            correctOptionText: 'Probability distribution over values',
            explanation: 'Softmax turns unnormalized dot products into valid probability weights.'
          }
        ]
      }
    };

    saveAssessmentAttempt(mockAttempt);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    const attentionGap = report.items.find(i => i.conceptId === 'c-attention')!;

    assert.ok(attentionGap.supportingEvidence.length > 0);
    const summativeEv = attentionGap.supportingEvidence.find(e => e.sourceType === 'summative-test');
    assert.ok(summativeEv, 'Should include summative evidence item');
    assert.match(summativeEv.description, /What is the role of softmax in attention\?/i);
    assert.strictEqual(summativeEv.attemptId, 'att-test-01');
    assert.strictEqual(summativeEv.questionId, 'q-sum-1');
  });

  // --------------------------------------------------------------------------
  // Rule 7: Unanswered questions are NOT interpreted as incorrect answers
  // --------------------------------------------------------------------------
  test('Rule 7: Unanswered questions in assessments are not treated as incorrect answers', () => {
    const mockAttempt: AssessmentAttempt = {
      id: 'att-test-unanswered',
      testId: 'test-unanswered',
      userId: 'test-user',
      graphId: testGraphId,
      graphName: testGraph.name,
      createdAt: '2026-10-11T12:00:00.000Z',
      completedAt: '2026-10-11T12:10:00.000Z',
      totalQuestions: 1,
      correctAnswers: 0,
      scorePercentage: 0,
      timeSpentSeconds: 120,
      completionReason: 'submission',
      questions: [
        {
          id: 'q-pos-unanswered',
          type: 'concept',
          question: 'Why are sinusoidal encodings used?',
          options: [
            { id: 'opt-1', text: 'Fixed relative distances' },
            { id: 'opt-2', text: 'Memory reduction' },
            { id: 'opt-3', text: 'Faster training' },
            { id: 'opt-4', text: 'Smaller parameters' }
          ],
          correctOptionId: 'opt-1',
          explanation: 'Allows attending by relative position.',
          conceptIds: ['c-positional'],
          conceptNames: ['Positional Encoding'],
          sourceIds: ['src-vaswani-2017']
        }
      ],
      userAnswers: {}, // Student left question UNANSWERED
      conceptIds: ['c-positional'],
      conceptNames: ['Positional Encoding'],
      sourceIds: ['src-vaswani-2017'],
      resultsSummary: {
        testId: 'test-unanswered',
        score: 0,
        totalQuestions: 1,
        percentage: 0,
        timeSpentSeconds: 120,
        strongConceptNames: [],
        reviewRecommendedConcepts: []
      }
    };

    saveAssessmentAttempt(mockAttempt);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    const posGap = report.items.find(i => i.conceptId === 'c-positional')!;

    // Unanswered question must NOT count as an incorrect answer
    assert.strictEqual(posGap.incorrectAnswersCount, 0);
    assert.strictEqual(posGap.totalAssessedQuestions, 0);
    assert.strictEqual(posGap.gapState, 'insufficient-evidence');
  });

  // --------------------------------------------------------------------------
  // Rule 8: Data remains scoped to the correct user and graph
  // --------------------------------------------------------------------------
  test('Rule 8: Data remains scoped strictly to the specified user and graph', () => {
    // Attempt for another user
    const otherUserAttempt: AssessmentAttempt = {
      id: 'att-other-user',
      testId: 'test-other',
      userId: 'other-user-999',
      graphId: testGraphId,
      graphName: testGraph.name,
      createdAt: '2026-10-11T12:00:00.000Z',
      completedAt: '2026-10-11T12:10:00.000Z',
      totalQuestions: 2,
      correctAnswers: 0,
      scorePercentage: 0,
      timeSpentSeconds: 120,
      completionReason: 'submission',
      questions: [
        {
          id: 'q-att-other',
          type: 'concept',
          question: 'Attention question for other user',
          options: [{ id: 'opt-1', text: 'A' }, { id: 'opt-2', text: 'B' }],
          correctOptionId: 'opt-1',
          explanation: 'Exp',
          conceptIds: ['c-attention'],
          conceptNames: ['Self-Attention Mechanism'],
          sourceIds: ['src-vaswani-2017']
        }
      ],
      userAnswers: { 'q-att-other': 'opt-2' }, // incorrect
      conceptIds: ['c-attention'],
      conceptNames: ['Self-Attention Mechanism'],
      sourceIds: ['src-vaswani-2017'],
      resultsSummary: {
        testId: 'test-other',
        score: 0,
        totalQuestions: 1,
        percentage: 0,
        timeSpentSeconds: 120,
        strongConceptNames: [],
        reviewRecommendedConcepts: []
      }
    };

    saveAssessmentAttempt(otherUserAttempt);

    // Target user 'target-user' has no attempts
    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'target-user', forceRefresh: true });
    const attentionGap = report.items.find(i => i.conceptId === 'c-attention')!;

    // Should NOT be affected by other-user-999's mistakes
    assert.strictEqual(attentionGap.totalAssessedQuestions, 0);
    assert.strictEqual(attentionGap.gapState, 'insufficient-evidence');
  });

  // --------------------------------------------------------------------------
  // Rule 9: Dismiss and defer actions update preferences and active gaps
  // --------------------------------------------------------------------------
  test('Rule 9: Dismiss and defer preferences remove concepts from active gaps', () => {
    // 2 incorrect answers on c-attention
    const kcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-attention',
      status: 'ready',
      questions: [],
      activeQuestionIndex: 0,
      attempts: {
        'q-1': {
          questionId: 'q-1',
          submittedAnswer: 'bad',
          evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: 'err', explanation: 'e', correctAnswer: 'c' },
          attemptedAt: '2026-10-10T10:00:00.000Z'
        },
        'q-2': {
          questionId: 'q-2',
          submittedAnswer: 'bad2',
          evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: 'err', explanation: 'e', correctAnswer: 'c' },
          attemptedAt: '2026-10-10T10:05:00.000Z'
        }
      },
      updatedAt: '2026-10-10T10:05:00.000Z'
    };
    saveStoredKnowledgeCheck(kcState);

    let report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    assert.strictEqual(report.activeGaps.length, 1);
    assert.strictEqual(report.activeGaps[0].conceptId, 'c-attention');

    // Dismiss c-attention
    dismissKnowledgeGap(testGraphId, 'c-attention');
    report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    assert.strictEqual(report.activeGaps.length, 0, 'Dismissed gap must not be in activeGaps');
    assert.strictEqual(report.dismissedCount, 1);

    // Restore c-attention
    restoreKnowledgeGap(testGraphId, 'c-attention');
    report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    assert.strictEqual(report.activeGaps.length, 1, 'Restored gap must reappear in activeGaps');

    // Defer c-attention
    deferKnowledgeGap(testGraphId, 'c-attention', 24);
    report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    assert.strictEqual(report.activeGaps.length, 0, 'Deferred gap must not be in activeGaps');
    assert.strictEqual(report.deferredCount, 1);
  });

  // --------------------------------------------------------------------------
  // Rule 10: Gracefully handles deleted concepts and invalid question references
  // --------------------------------------------------------------------------
  test('Rule 10: Gracefully handles deleted concepts without crashing or corrupting report', () => {
    // Add attempt referencing deleted concept 'c-deleted-concept'
    const deletedConceptAttempt: AssessmentAttempt = {
      id: 'att-with-deleted-node',
      testId: 'test-deleted',
      userId: 'test-user',
      graphId: testGraphId,
      graphName: testGraph.name,
      createdAt: '2026-10-11T12:00:00.000Z',
      completedAt: '2026-10-11T12:10:00.000Z',
      totalQuestions: 1,
      correctAnswers: 0,
      scorePercentage: 0,
      timeSpentSeconds: 120,
      completionReason: 'submission',
      questions: [
        {
          id: 'q-del',
          type: 'concept',
          question: 'Deleted question',
          options: [{ id: 'opt-1', text: 'A' }],
          correctOptionId: 'opt-1',
          explanation: 'Exp',
          conceptIds: ['c-deleted-concept'],
          conceptNames: ['Deleted Concept'],
          sourceIds: []
        }
      ],
      userAnswers: { 'q-del': 'wrong' },
      conceptIds: ['c-deleted-concept'],
      conceptNames: ['Deleted Concept'],
      sourceIds: [],
      resultsSummary: {
        testId: 'test-deleted',
        score: 0,
        totalQuestions: 1,
        percentage: 0,
        timeSpentSeconds: 120,
        strongConceptNames: [],
        reviewRecommendedConcepts: []
      }
    };
    saveAssessmentAttempt(deletedConceptAttempt);

    // Also add relationship to non-existent node
    const graphWithDanglingEdge: KnowledgeGraph = {
      ...testGraph,
      relationships: [
        ...testGraph.relationships,
        {
          id: 'rel-dangling',
          source: 'c-attention',
          target: 'c-ghost-node',
          type: 'depends-on',
          sourceChunkIds: []
        }
      ]
    };

    assert.doesNotThrow(() => {
      const report = detectKnowledgeGaps({ graph: graphWithDanglingEdge, userId: 'test-user', forceRefresh: true });
      assert.strictEqual(report.totalConcepts, testGraph.nodes.length);
    });
  });

  // --------------------------------------------------------------------------
  // Rule 11: Respectful, non-judgmental language audit
  // --------------------------------------------------------------------------
  test('Rule 11: Language strictly describes observed performance and never uses pejoratives', () => {
    // Flag concept with difficulty
    const kcState: ConceptKnowledgeCheckState = {
      graphId: testGraphId,
      conceptId: 'c-attention',
      status: 'ready',
      questions: [],
      activeQuestionIndex: 0,
      attempts: {
        'q-1': {
          questionId: 'q-1',
          submittedAnswer: 'bad',
          evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: 'err', explanation: 'e', correctAnswer: 'c' },
          attemptedAt: '2026-10-10T10:00:00.000Z'
        },
        'q-2': {
          questionId: 'q-2',
          submittedAnswer: 'bad2',
          evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: 'err', explanation: 'e', correctAnswer: 'c' },
          attemptedAt: '2026-10-10T10:05:00.000Z'
        }
      },
      updatedAt: '2026-10-10T10:05:00.000Z'
    };
    saveStoredKnowledgeCheck(kcState);

    const report = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user', forceRefresh: true });
    
    // Prohibited words list
    const pejoratives = ['weak', 'unintelligent', 'incapable', 'failing', 'bad student', 'stupid', 'dumb', 'incompetent'];

    for (const item of report.items) {
      const fullText = `${item.reason} ${item.statusLabel} ${item.recommendedAction.label} ${item.recommendedAction.description || ''}`.toLowerCase();
      for (const word of pejoratives) {
        assert.strictEqual(
          fullText.includes(word),
          false,
          `Knowledge gap text must not contain judgmental term "${word}": "${fullText}"`
        );
      }
    }
  });

  // --------------------------------------------------------------------------
  // Rule 12: Invalidation and caching mechanism
  // --------------------------------------------------------------------------
  test('Rule 12: Cache reuses report when inputs are stable and updates when invalidated', () => {
    const report1 = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user' });
    const report2 = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user' });

    // Should return cached report instance
    assert.strictEqual(report1, report2);

    // Invalidate cache
    invalidateKnowledgeGapsCache(testGraphId);
    const report3 = detectKnowledgeGaps({ graph: testGraph, userId: 'test-user' });

    // Should return freshly instantiated report
    assert.notStrictEqual(report1, report3);
    assert.strictEqual(report3.totalConcepts, report1.totalConcepts);
  });
});
