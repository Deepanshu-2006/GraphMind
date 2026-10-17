import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import {
  saveGraphs,
  saveGraphData,
  saveRevisionSession,
  clearAllUserData,
  updateConceptPracticeState
} from '../src/services/storage';
import {
  saveAssessmentAttempt,
  clearAssessmentHistory
} from '../src/services/assessmentHistory';
import {
  setCurrentUser,
  clearCurrentUser
} from '../src/services/auth';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt } from '../src/types/test';
import type { RevisionSessionState } from '../src/types/practice';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
  get length() { return storageMap.size; }
};

describe('GRAPHMIND — PERSONA STATISTICS DATA LAYER (usePersonaStats)', () => {
  beforeEach(() => {
    storageMap.clear();
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  // =========================================================================
  // 1. EMPTY STATE (NO GRAPHS, NO ASSESSMENTS)
  // =========================================================================
  describe('1. Empty State Handling', () => {
    it('returns clean, zeroed activity stats when no graphs exist', () => {
      saveGraphs([]);
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.activity.totalGraphs, 0);
      assert.strictEqual(stats.activity.recentGraph, null);
      assert.strictEqual(stats.activity.totalConcepts, 0);
      assert.strictEqual(stats.activity.demonstratedConcepts, 0);
      assert.strictEqual(stats.activity.demonstratedPercentage, 0);
    });

    it('returns null average score and empty assessments list when no attempts exist', () => {
      const stats = calculatePersonaStats();

      assert.strictEqual(stats.performance.totalAssessmentAttempts, 0);
      assert.strictEqual(stats.performance.recentAssessments.length, 0);
      // Strictly null to prevent presenting a misleading or fake 0%
      assert.strictEqual(stats.performance.averageScore, null);
      assert.strictEqual(stats.performance.activeRevisionProgress, null);
      assert.strictEqual(stats.performance.conceptsNeedingRevisionCount, 0);
    });
  });

  // =========================================================================
  // 2. MULTIPLE GRAPHS & CONCEPT AGGREGATION
  // =========================================================================
  describe('2. Multi-Graph & Concept Rollup', () => {
    it('aggregates total graphs and sums concepts across multiple graphs', () => {
      const graphMeta1: KnowledgeGraphMeta = {
        id: 'graph-os',
        name: 'Operating Systems',
        description: 'OS concepts',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-02T10:00:00.000Z'
      };

      const graphMeta2: KnowledgeGraphMeta = {
        id: 'graph-networks',
        name: 'Computer Networks',
        description: 'Network concepts',
        createdAt: '2026-03-03T10:00:00.000Z',
        updatedAt: '2026-03-04T12:00:00.000Z' // Later update
      };

      const graphData1: KnowledgeGraph = {
        id: 'graph-os',
        name: 'Operating Systems',
        nodes: [
          { id: 'c-proc', name: 'Processes', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-thread', name: 'Threads', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-lock', name: 'Mutex Locks', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      const graphData2: KnowledgeGraph = {
        id: 'graph-networks',
        name: 'Computer Networks',
        nodes: [
          { id: 'c-tcp', name: 'TCP', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-udp', name: 'UDP', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta1, graphMeta2]);
      saveGraphData('graph-os', graphData1);
      saveGraphData('graph-networks', graphData2);

      const stats = calculatePersonaStats({ graphs: [graphMeta1, graphMeta2] });

      assert.strictEqual(stats.activity.totalGraphs, 2);
      assert.strictEqual(stats.activity.totalConcepts, 5); // 3 + 2
      assert.ok(stats.activity.recentGraph !== null);
      assert.strictEqual(stats.activity.recentGraph?.graphId, 'graph-networks');
      assert.strictEqual(stats.activity.recentGraph?.graphName, 'Computer Networks');
      assert.strictEqual(stats.activity.recentGraph?.totalConcepts, 2);
      assert.strictEqual(stats.activity.recentGraphs.length, 2);
      assert.strictEqual(stats.activity.recentGraphs[0].graphId, 'graph-networks');
      assert.strictEqual(stats.activity.recentGraphs[1].graphId, 'graph-os');
    });
  });

  // =========================================================================
  // 3. ASSESSMENT ATTEMPTS, SCORES & RECENT LIMITATION
  // =========================================================================
  describe('3. Assessment Scoring & History', () => {
    it('calculates the exact rounded arithmetic mean of completed attempts', () => {
      const attempts: AssessmentAttempt[] = [
        {
          id: 'attempt-1',
          testId: 'test-1',
          userId: 'user-local-default',
          graphId: 'graph-os',
          graphName: 'Operating Systems',
          createdAt: '2026-03-10T09:00:00.000Z',
          completedAt: '2026-03-10T09:10:00.000Z',
          totalQuestions: 10,
          correctAnswers: 8,
          scorePercentage: 80,
          timeSpentSeconds: 600,
          questions: [],
          userAnswers: {},
          conceptIds: [],
          conceptNames: [],
          sourceIds: [],
          completionReason: 'submission',
          resultsSummary: {
            testId: 'test-1',
            score: 8,
            totalQuestions: 10,
            percentage: 80,
            timeSpentSeconds: 600,
            strongConceptNames: [],
            reviewRecommendedConcepts: []
          }
        },
        {
          id: 'attempt-2',
          testId: 'test-2',
          userId: 'user-local-default',
          graphId: 'graph-os',
          graphName: 'Operating Systems',
          createdAt: '2026-03-11T09:00:00.000Z',
          completedAt: '2026-03-11T09:10:00.000Z',
          totalQuestions: 10,
          correctAnswers: 9,
          scorePercentage: 90,
          timeSpentSeconds: 600,
          questions: [],
          userAnswers: {},
          conceptIds: [],
          conceptNames: [],
          sourceIds: [],
          completionReason: 'submission',
          resultsSummary: {
            testId: 'test-2',
            score: 9,
            totalQuestions: 10,
            percentage: 90,
            timeSpentSeconds: 600,
            strongConceptNames: [],
            reviewRecommendedConcepts: []
          }
        },
        {
          id: 'attempt-3',
          testId: 'test-3',
          userId: 'user-local-default',
          graphId: 'graph-os',
          graphName: 'Operating Systems',
          createdAt: '2026-03-12T09:00:00.000Z',
          completedAt: '2026-03-12T09:10:00.000Z',
          totalQuestions: 10,
          correctAnswers: 7,
          scorePercentage: 75,
          timeSpentSeconds: 600,
          questions: [],
          userAnswers: {},
          conceptIds: [],
          conceptNames: [],
          sourceIds: [],
          completionReason: 'submission',
          resultsSummary: {
            testId: 'test-3',
            score: 7,
            totalQuestions: 10,
            percentage: 75,
            timeSpentSeconds: 600,
            strongConceptNames: [],
            reviewRecommendedConcepts: []
          }
        }
      ];

      for (const a of attempts) {
        saveAssessmentAttempt(a);
      }

      const stats = calculatePersonaStats();

      assert.strictEqual(stats.performance.totalAssessmentAttempts, 3);
      // (80 + 90 + 75) / 3 = 245 / 3 = 81.666... -> rounds to 82
      assert.strictEqual(stats.performance.averageScore, 82);
    });

    it('limits recent assessments to at most three, in newest-first order', () => {
      // Create 5 attempts with distinct completion times
      for (let i = 1; i <= 5; i++) {
        saveAssessmentAttempt({
          id: `attempt-${i}`,
          testId: `test-${i}`,
          userId: 'user-local-default',
          graphId: 'graph-1',
          graphName: 'Algorithms',
          createdAt: `2026-03-0${i}T10:00:00.000Z`,
          completedAt: `2026-03-0${i}T10:15:00.000Z`,
          totalQuestions: 10,
          correctAnswers: i * 2,
          scorePercentage: i * 20,
          timeSpentSeconds: 300,
          questions: [],
          userAnswers: {},
          conceptIds: [],
          conceptNames: [],
          sourceIds: [],
          completionReason: 'submission',
          resultsSummary: {
            testId: `test-${i}`,
            score: i * 2,
            totalQuestions: 10,
            percentage: i * 20,
            timeSpentSeconds: 300,
            strongConceptNames: [],
            reviewRecommendedConcepts: []
          }
        });
      }

      const stats = calculatePersonaStats();

      assert.strictEqual(stats.performance.totalAssessmentAttempts, 5);
      assert.strictEqual(stats.performance.recentAssessments.length, 3);
      // Most recent should be attempt-5, then attempt-4, then attempt-3
      assert.strictEqual(stats.performance.recentAssessments[0].id, 'attempt-5');
      assert.strictEqual(stats.performance.recentAssessments[0].scorePercentage, 100);
      assert.strictEqual(stats.performance.recentAssessments[1].id, 'attempt-4');
      assert.strictEqual(stats.performance.recentAssessments[2].id, 'attempt-3');
    });

    it('isolates attempts by user ID', () => {
      setCurrentUser({ id: 'user-alice', name: 'Alice' });

      saveAssessmentAttempt({
        id: 'attempt-alice',
        testId: 'test-1',
        userId: 'user-alice',
        graphId: 'graph-1',
        graphName: 'Math',
        createdAt: '2026-03-10T10:00:00.000Z',
        completedAt: '2026-03-10T10:10:00.000Z',
        totalQuestions: 10,
        correctAnswers: 10,
        scorePercentage: 100,
        timeSpentSeconds: 200,
        questions: [],
        userAnswers: {},
        conceptIds: [],
        conceptNames: [],
        sourceIds: [],
        completionReason: 'submission',
        resultsSummary: {
          testId: 'test-1',
          score: 10,
          totalQuestions: 10,
          percentage: 100,
          timeSpentSeconds: 200,
          strongConceptNames: [],
          reviewRecommendedConcepts: []
        }
      });

      saveAssessmentAttempt({
        id: 'attempt-bob',
        testId: 'test-2',
        userId: 'user-bob',
        graphId: 'graph-1',
        graphName: 'Math',
        createdAt: '2026-03-11T10:00:00.000Z',
        completedAt: '2026-03-11T10:10:00.000Z',
        totalQuestions: 10,
        correctAnswers: 5,
        scorePercentage: 50,
        timeSpentSeconds: 200,
        questions: [],
        userAnswers: {},
        conceptIds: [],
        conceptNames: [],
        sourceIds: [],
        completionReason: 'submission',
        resultsSummary: {
          testId: 'test-2',
          score: 5,
          totalQuestions: 10,
          percentage: 50,
          timeSpentSeconds: 200,
          strongConceptNames: [],
          reviewRecommendedConcepts: []
        }
      });

      const statsAlice = calculatePersonaStats({ userId: 'user-alice' });
      assert.strictEqual(statsAlice.performance.totalAssessmentAttempts, 1);
      assert.strictEqual(statsAlice.performance.averageScore, 100);

      const statsBob = calculatePersonaStats({ userId: 'user-bob' });
      assert.strictEqual(statsBob.performance.totalAssessmentAttempts, 1);
      assert.strictEqual(statsBob.performance.averageScore, 50);
    });
  });

  // =========================================================================
  // 4. REVISION SESSIONS & DEDUPLICATED NEEDS-REVIEW CONCEPTS
  // =========================================================================
  describe('4. Revision Sessions & Needs-Review Deduplication', () => {
    it('captures active revision session progress and reports null when completed', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-ai',
        name: 'Artificial Intelligence',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-ai',
        name: 'Artificial Intelligence',
        nodes: [
          { id: 'c-search', name: 'Search Algorithms', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-heur', name: 'Heuristics', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-bayes', name: 'Bayesian Nets', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-markov', name: 'Markov Models', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-ai', graphData);

      // Active session: 2 of 4 reviewed (50% progress)
      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-ai',
        conceptIds: ['c-search', 'c-heur', 'c-bayes', 'c-markov'],
        currentIndex: 2,
        currentConceptId: 'c-bayes',
        totalConcepts: 4,
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:30:00.000Z',
        reviewedConceptIds: ['c-search', 'c-heur'],
        markedForReviewIds: []
      };

      saveRevisionSession(session, 'graph-ai');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.ok(stats.performance.activeRevisionProgress !== null);
      assert.strictEqual(stats.performance.activeRevisionProgress?.reviewedCount, 2);
      assert.strictEqual(stats.performance.activeRevisionProgress?.totalConcepts, 4);
      assert.strictEqual(stats.performance.activeRevisionProgress?.progressPercent, 50);
      assert.strictEqual(stats.performance.activeRevisionProgress?.currentConceptName, 'Bayesian Nets');
    });

    it('deduplicates concepts requiring revision across practice states, mastery, and sessions', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-db',
        name: 'Databases',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-db',
        name: 'Databases',
        nodes: [
          { id: 'c-btree', name: 'B-Trees', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-acid', name: 'ACID Properties', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-norm', name: 'Normalization', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-db', graphData);

      // 1. Mark 'c-btree' in practice states as 'needs-review'
      updateConceptPracticeState('c-btree', 'needs-review', 'graph-db');

      // 2. Also mark 'c-btree' in revision session markedForReviewIds (SAME concept)
      // and add 'c-acid' (NEW concept)
      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-db',
        conceptIds: ['c-btree', 'c-acid', 'c-norm'],
        currentIndex: 0,
        totalConcepts: 3,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        reviewedConceptIds: [],
        markedForReviewIds: ['c-btree', 'c-acid']
      };
      saveRevisionSession(session, 'graph-db');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      // 'c-btree' appears in both practice state and session marked list.
      // Total unique concepts needing revision must be exactly 2 ('c-btree' and 'c-acid'), NEVER 3.
      assert.strictEqual(stats.performance.conceptsNeedingRevisionCount, 2);
    });
  });

  // =========================================================================
  // 5. DEMONSTRATED UNDERSTANDING & RESTRICTED METRICS
  // =========================================================================
  describe('5. Verified Progress & Gamification Avoidance', () => {
    it('calculates demonstrated understanding from verified mastery without streaks or retention', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-cloud',
        name: 'Cloud Computing',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-cloud',
        name: 'Cloud Computing',
        nodes: [
          { id: 'c-s3', name: 'Object Storage', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-ec2', name: 'Virtual Compute', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-iam', name: 'Identity & Access', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-vpc', name: 'Virtual Private Cloud', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-cloud', graphData);

      // Mark 2 of 4 concepts as 'understood' in practice state
      updateConceptPracticeState('c-s3', 'understood', 'graph-cloud');
      updateConceptPracticeState('c-ec2', 'understood', 'graph-cloud');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.strictEqual(stats.activity.totalConcepts, 4);
      assert.strictEqual(stats.activity.demonstratedConcepts, 2);
      assert.strictEqual(stats.activity.demonstratedPercentage, 50);

      // Verify that NO streak or retention properties exist on the stats model
      assert.strictEqual((stats.activity as any).streak, undefined);
      assert.strictEqual((stats.performance as any).retention, undefined);
      assert.strictEqual((stats.performance as any).xp, undefined);
    });
  });
});
