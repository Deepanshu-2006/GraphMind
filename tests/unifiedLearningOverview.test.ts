import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { RevisionSessionState, ConceptPracticeState } from '../src/types/practice';
import { computeUnifiedLearningOverview } from '../src/services/unifiedLearningOverview';
import { saveStoredMastery, clearGraphMastery } from '../src/services/conceptMastery';
import { invalidateKnowledgeGapsCache } from '../src/services/knowledgeGapDetection';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined' || !(globalThis as any).localStorage?.getItem) {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
    removeItem: (key: string) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
    key: (i: number) => Array.from(storageMap.keys())[i] || null,
    get length() { return storageMap.size; }
  };
}

describe('GraphMind Unified Learning Overview Service (Phase 4 — Prompt 19)', () => {
  const sampleGraph: KnowledgeGraph = {
    id: 'graph-unified-overview-1',
    name: 'Neural Networks & Deep Learning',
    nodes: [
      {
        id: 'node-activation',
        name: 'Activation Functions',
        description: 'Non-linear transformations in neural layers.',
        summary: 'Non-linear activations enable deep networks to learn complex functions.',
        category: 'core',
        keywords: ['relu', 'sigmoid', 'non-linearity']
      },
      {
        id: 'node-backprop',
        name: 'Backpropagation',
        description: 'Gradient descent through chain rule.',
        summary: 'Propagates loss gradients backward to update network weights.',
        category: 'algorithm',
        keywords: ['gradients', 'chain rule', 'optimization']
      },
      {
        id: 'node-loss',
        name: 'Loss Functions',
        description: 'Quantifying model error.',
        summary: 'Measures discrepancy between predictions and ground truth.',
        category: 'core',
        keywords: ['cross entropy', 'mse']
      },
      {
        id: 'node-regularization',
        name: 'Regularization Techniques',
        description: 'Techniques to prevent overfitting.',
        summary: 'Dropout and weight decay to ensure generalization.',
        category: 'optimization',
        keywords: ['dropout', 'l2', 'generalization']
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-activation',
        target: 'node-backprop',
        label: 'prerequisite_for',
        type: 'prerequisite_for'
      },
      {
        id: 'edge-2',
        source: 'node-loss',
        target: 'node-backprop',
        label: 'prerequisite_for',
        type: 'prerequisite_for'
      }
    ]
  };

  describe('1. Robust Input Handling & Empty States', () => {
    it('returns safe fallback values when graph is null or empty', () => {
      // @ts-expect-error Testing runtime invalid input
      const resNull = computeUnifiedLearningOverview({ graph: null });
      assert.equal(resNull.totalConcepts, 0);
      assert.equal(resNull.demonstratedCount, 0);
      assert.equal(resNull.isNewUser, true);
      assert.equal(resNull.hasZeroAssessments, true);

      const emptyGraph: KnowledgeGraph = { id: 'empty', name: 'Empty', nodes: [], edges: [] };
      const resEmpty = computeUnifiedLearningOverview({ graph: emptyGraph });
      assert.equal(resEmpty.totalConcepts, 0);
      assert.equal(resEmpty.demonstratedPercentage, 0);
      assert.equal(resEmpty.primaryRecommendation, null);
    });

    it('identifies new users with zero assessments and zero revision activity', () => {
      const res = computeUnifiedLearningOverview({
        graph: sampleGraph,
        userId: 'brand-new-user-test'
      });

      assert.equal(res.totalConcepts, 4);
      assert.equal(res.hasZeroAssessments, true);
      assert.equal(res.isNewUser, true);
      assert.equal(res.demonstratedPercentage, 0);
      // Clean neutral state: does not manufacture knowledge gaps
      assert.equal(res.conceptsNeedingAttention.length, 0);
    });
  });

  describe('2. Distinguishing Activity from Demonstrated Understanding', () => {
    it('accurately separates in-progress activity from demonstrated understanding', () => {
      // Node 1: In progress (read/visited, 0 answers)
      const inProgressState: ConceptPracticeState = {
        conceptId: 'node-activation',
        conceptName: 'Activation Functions',
        graphId: sampleGraph.id,
        status: 'in-progress',
        statusLabel: 'In Progress',
        totalQuestionsAnswered: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        lastPracticedAt: new Date().toISOString()
      };
      saveStoredMastery(sampleGraph.id, inProgressState);

      // Node 2: Demonstrated understanding (3 correct answers, 0 consecutive incorrect)
      const demonstratedState: ConceptPracticeState = {
        conceptId: 'node-backprop',
        conceptName: 'Backpropagation',
        graphId: sampleGraph.id,
        status: 'understanding-demonstrated',
        statusLabel: 'Understanding Demonstrated',
        totalQuestionsAnswered: 3,
        correctCount: 3,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        lastPracticedAt: new Date().toISOString()
      };
      saveStoredMastery(sampleGraph.id, demonstratedState);

      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        userId: 'test-user-activity-vs-demonstrated'
      });

      assert.equal(overview.totalConcepts, 4);
      assert.equal(overview.demonstratedCount, 1, 'Only node-backprop has demonstrated understanding');
      assert.equal(overview.inProgressCount, 1, 'node-activation is in progress');
      assert.equal(overview.notStartedCount, 2, '2 nodes not started');
      assert.equal(overview.activityCount, 2, 'Total activity is inProgress (1) + demonstrated (1)');
      assert.equal(overview.demonstratedPercentage, 25, '1 of 4 is 25%');

      // Cleanup
      clearGraphMastery(sampleGraph.id);
    });
  });

  describe('3. Unfinished Revision Session Detection', () => {
    it('detects active revision session and reports remaining concepts and progress percent', () => {
      const activeSession: RevisionSessionState = {
        graphId: sampleGraph.id,
        currentConceptId: 'node-backprop',
        currentIndex: 1,
        conceptIds: ['node-activation', 'node-backprop', 'node-loss'],
        reviewedConceptIds: ['node-activation'],
        isActive: true,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        activeSession
      });

      assert.equal(overview.hasUnfinishedSession, true);
      assert.ok(overview.unfinishedSession);
      assert.equal(overview.unfinishedSession?.currentConceptId, 'node-backprop');
      assert.equal(overview.unfinishedSession?.currentConceptName, 'Backpropagation');
      assert.equal(overview.unfinishedSession?.totalConcepts, 3);
      assert.equal(overview.unfinishedSession?.reviewedConceptsCount, 1);
      assert.equal(overview.unfinishedSession?.remainingCount, 2);
      assert.equal(overview.unfinishedSession?.progressPercent, 33);
    });

    it('marks session as finished when all concepts are reviewed', () => {
      const completedSession: RevisionSessionState = {
        graphId: sampleGraph.id,
        currentConceptId: 'node-loss',
        currentIndex: 2,
        conceptIds: ['node-activation', 'node-backprop', 'node-loss'],
        reviewedConceptIds: ['node-activation', 'node-backprop', 'node-loss'],
        isActive: true,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        activeSession: completedSession
      });

      assert.equal(overview.hasUnfinishedSession, false);
      assert.equal(overview.unfinishedSession, null);
    });
  });

  describe('4. Grounded Knowledge Gaps & Difficulties', () => {
    it('surfaces concepts with consecutive incorrect answers with factual evidence snippet', () => {
      const needsReviewState: ConceptPracticeState = {
        conceptId: 'node-regularization',
        conceptName: 'Regularization Techniques',
        graphId: sampleGraph.id,
        status: 'needs-review',
        statusLabel: 'Needs Review',
        totalQuestionsAnswered: 2,
        correctCount: 0,
        incorrectCount: 2,
        consecutiveIncorrectCount: 2,
        lastPracticedAt: new Date().toISOString()
      };
      saveStoredMastery(sampleGraph.id, needsReviewState);

      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        userId: 'test-user-knowledge-gaps'
      });

      assert.equal(overview.needsReviewCount, 1);
      assert.equal(overview.conceptsNeedingAttention.length, 1);

      const attentionItem = overview.conceptsNeedingAttention[0];
      assert.equal(attentionItem.conceptId, 'node-regularization');
      assert.equal(attentionItem.conceptName, 'Regularization Techniques');
      assert.equal(attentionItem.status, 'needs-review');
      assert.ok(attentionItem.reason.includes('2 consecutive incorrect answers recorded'));
      assert.equal(attentionItem.evidenceSnippet, '2 incorrect answers recorded');
      assert.equal(attentionItem.actionType, 'review-concept');

      // Cleanup
      clearGraphMastery(sampleGraph.id);
      localStorage.clear();
      invalidateKnowledgeGapsCache(sampleGraph.id);
    });

    it('does not manufacture difficulties when no concepts are flagged for review', () => {
      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        userId: 'clean-slate-user'
      });

      assert.equal(overview.conceptsNeedingAttention.length, 0);
    });
  });

  describe('5. Coherent Recommendation Integration', () => {
    it('prioritizes resuming an unfinished session as the primary recommended action', () => {
      const activeSession: RevisionSessionState = {
        graphId: sampleGraph.id,
        currentConceptId: 'node-backprop',
        currentIndex: 1,
        conceptIds: ['node-activation', 'node-backprop'],
        reviewedConceptIds: ['node-activation'],
        isActive: true,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const overview = computeUnifiedLearningOverview({
        graph: sampleGraph,
        activeSession
      });

      assert.ok(overview.primaryRecommendation, 'Primary recommendation must exist');
      assert.equal(overview.primaryRecommendation?.category, 'continue-learning');
      assert.equal(overview.primaryRecommendation?.actionType, 'continue-revision');
      assert.equal(overview.primaryRecommendation?.conceptId, 'node-backprop');
      assert.ok(overview.primaryRecommendation?.explanation.length > 0);
    });
  });
});
