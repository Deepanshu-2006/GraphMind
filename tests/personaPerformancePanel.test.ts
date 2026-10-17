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

describe('GRAPHMIND — PERSONA PERFORMANCE PANEL (Step 13)', () => {
  beforeEach(() => {
    storageMap.clear();
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  // =========================================================================
  // 1. RECENT TEST PERFORMANCE & AVERAGE SCORE
  // =========================================================================
  describe('1. Recent Test Performance & Scores', () => {
    it('returns null average score and empty recent tests when no completed tests exist', () => {
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.performance.totalAssessmentAttempts, 0);
      assert.strictEqual(stats.performance.averageScore, null);
      assert.deepStrictEqual(stats.performance.recentAssessments, []);
    });

    it('displays single assessment score with 100% accuracy and accurate singular label', () => {
      const attempt: AssessmentAttempt = {
        id: 'attempt-101',
        testId: 'test-os-basics',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        scorePercentage: 88,
        correctAnswers: 9,
        totalQuestions: 10,
        completedAt: '2026-10-17T08:00:00.000Z',
        timeSpentSeconds: 140,
        answers: {}
      };

      saveAssessmentAttempt(attempt);

      const stats = calculatePersonaStats();

      assert.strictEqual(stats.performance.totalAssessmentAttempts, 1);
      assert.strictEqual(stats.performance.averageScore, 88);
      assert.strictEqual(stats.performance.recentAssessments.length, 1);
      assert.strictEqual(stats.performance.recentAssessments[0].scorePercentage, 88);
      assert.strictEqual(stats.performance.recentAssessments[0].graphName, 'Operating Systems');
      assert.strictEqual(stats.performance.recentAssessments[0].completedAt, '2026-10-17T08:00:00.000Z');
    });

    it('calculates rounded average across multiple tests and caps recent scores at 3, newest first', () => {
      const attempts: AssessmentAttempt[] = [
        {
          id: 'att-1',
          testId: 't-1',
          graphId: 'g-algo',
          graphName: 'Algorithms',
          scorePercentage: 80,
          correctAnswers: 8,
          totalQuestions: 10,
          completedAt: '2026-10-10T10:00:00.000Z',
          timeSpentSeconds: 120,
          answers: {}
        },
        {
          id: 'att-2',
          testId: 't-2',
          graphId: 'g-algo',
          graphName: 'Algorithms',
          scorePercentage: 90,
          correctAnswers: 9,
          totalQuestions: 10,
          completedAt: '2026-10-12T10:00:00.000Z',
          timeSpentSeconds: 110,
          answers: {}
        },
        {
          id: 'att-3',
          testId: 't-3',
          graphId: 'g-net',
          graphName: 'Computer Networks',
          scorePercentage: 75,
          correctAnswers: 15,
          totalQuestions: 20,
          completedAt: '2026-10-15T10:00:00.000Z',
          timeSpentSeconds: 300,
          answers: {}
        },
        {
          id: 'att-4',
          testId: 't-4',
          graphId: 'g-db',
          graphName: 'Databases',
          scorePercentage: 95,
          correctAnswers: 19,
          totalQuestions: 20,
          completedAt: '2026-10-17T09:00:00.000Z', // newest
          timeSpentSeconds: 250,
          answers: {}
        }
      ];

      for (const a of attempts) {
        saveAssessmentAttempt(a);
      }

      const stats = calculatePersonaStats();

      // Total completed attempts: 4
      assert.strictEqual(stats.performance.totalAssessmentAttempts, 4);

      // Average score: (80 + 90 + 75 + 95) / 4 = 340 / 4 = 85%
      assert.strictEqual(stats.performance.averageScore, 85);

      // Recent assessments capped at 3, ordered newest first:
      assert.strictEqual(stats.performance.recentAssessments.length, 3);
      assert.strictEqual(stats.performance.recentAssessments[0].id, 'att-4'); // Databases (95%)
      assert.strictEqual(stats.performance.recentAssessments[0].scorePercentage, 95);
      assert.strictEqual(stats.performance.recentAssessments[1].id, 'att-3'); // Computer Networks (75%)
      assert.strictEqual(stats.performance.recentAssessments[2].id, 'att-2'); // Algorithms (90%)
    });

    it('isolates assessment attempts by user ownership (auth filter)', () => {
      // User A attempts
      saveAssessmentAttempt({
        id: 'user-a-1',
        testId: 't-1',
        graphId: 'g-1',
        graphName: 'Math',
        scorePercentage: 100,
        correctAnswers: 10,
        totalQuestions: 10,
        completedAt: '2026-10-17T09:00:00.000Z',
        timeSpentSeconds: 60,
        userId: 'user-a',
        answers: {}
      });

      // User B attempts
      saveAssessmentAttempt({
        id: 'user-b-1',
        testId: 't-2',
        graphId: 'g-2',
        graphName: 'Physics',
        scorePercentage: 60,
        correctAnswers: 6,
        totalQuestions: 10,
        completedAt: '2026-10-17T09:30:00.000Z',
        timeSpentSeconds: 90,
        userId: 'user-b',
        answers: {}
      });

      // Query for User A
      const statsA = calculatePersonaStats({ userId: 'user-a' });
      assert.strictEqual(statsA.performance.totalAssessmentAttempts, 1);
      assert.strictEqual(statsA.performance.averageScore, 100);
      assert.strictEqual(statsA.performance.recentAssessments[0].graphName, 'Math');

      // Query for User B
      const statsB = calculatePersonaStats({ userId: 'user-b' });
      assert.strictEqual(statsB.performance.totalAssessmentAttempts, 1);
      assert.strictEqual(statsB.performance.averageScore, 60);
      assert.strictEqual(statsB.performance.recentAssessments[0].graphName, 'Physics');
    });
  });

  // =========================================================================
  // 2. REVISION PROGRESS (SESSION-SPECIFIC, NEVER FABRICATED AS GLOBAL)
  // =========================================================================
  describe('2. Revision Progress (Session-Specific)', () => {
    it('returns null revision progress when no active revision session exists', () => {
      const stats = calculatePersonaStats();
      assert.strictEqual(stats.performance.activeRevisionProgress, null);
    });

    it('captures active session metrics accurately and preserves session context', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-compilers',
        name: 'Compiler Architecture',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-compilers',
        name: 'Compiler Architecture',
        nodes: [
          { id: 'c-lex', name: 'Lexical Analysis', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-parse', name: 'AST Parsing', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-sem', name: 'Semantic Analysis', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-opt', name: 'Optimization Passes', type: 'concept', description: '', sourceIds: [] },
          { id: 'c-code', name: 'Code Generation', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-compilers', graphData);

      // Session: 3 of 5 concepts reviewed (60%)
      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-compilers',
        conceptIds: ['c-lex', 'c-parse', 'c-sem', 'c-opt', 'c-code'],
        currentIndex: 3,
        currentConceptId: 'c-opt',
        totalConcepts: 5,
        createdAt: '2026-10-17T07:00:00.000Z',
        updatedAt: '2026-10-17T07:30:00.000Z',
        reviewedConceptIds: ['c-lex', 'c-parse', 'c-sem'],
        markedForReviewIds: []
      };

      saveRevisionSession(session, 'graph-compilers');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.ok(stats.performance.activeRevisionProgress !== null);
      assert.strictEqual(stats.performance.activeRevisionProgress?.graphId, 'graph-compilers');
      assert.strictEqual(stats.performance.activeRevisionProgress?.graphName, 'Compiler Architecture');
      assert.strictEqual(stats.performance.activeRevisionProgress?.reviewedCount, 3);
      assert.strictEqual(stats.performance.activeRevisionProgress?.totalConcepts, 5);
      assert.strictEqual(stats.performance.activeRevisionProgress?.progressPercent, 60);
      assert.strictEqual(stats.performance.activeRevisionProgress?.currentConceptName, 'Optimization Passes');
    });

    it('treats completed sessions (all concepts reviewed) as finished, yielding null active session', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-os-arch',
        name: 'OS Architecture',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z'
      };

      saveGraphs([graphMeta]);

      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-os-arch',
        conceptIds: ['c1', 'c2'],
        currentIndex: 1,
        totalConcepts: 2,
        createdAt: '2026-10-16T10:00:00.000Z',
        updatedAt: '2026-10-16T10:20:00.000Z',
        reviewedConceptIds: ['c1', 'c2'], // All reviewed
        markedForReviewIds: []
      };

      saveRevisionSession(session, 'graph-os-arch');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });
      assert.strictEqual(stats.performance.activeRevisionProgress, null);
    });
  });

  // =========================================================================
  // 3. CONCEPTS TO REVISIT (ATTENTION / NEEDS-REVIEW DEDUPLICATION & EXAMPLES)
  // =========================================================================
  describe('3. Concepts to Revisit & Example Extraction', () => {
    it('returns 0 concepts and empty examples when all concepts are mastered or unflagged', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-clean',
        name: 'Clean Code',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-clean',
        name: 'Clean Code',
        nodes: [
          { id: 'c-solid', name: 'SOLID Principles', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-clean', graphData);
      updateConceptPracticeState('c-solid', 'understood', 'graph-clean');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.strictEqual(stats.performance.conceptsNeedingRevisionCount, 0);
      assert.deepStrictEqual(stats.performance.conceptsNeedingRevisionExamples, []);
    });

    it('collects up to 2 unique concept name examples when concepts need review', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-security',
        name: 'Network Security',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-security',
        name: 'Network Security',
        nodes: [
          { id: 'sec-1', name: 'Zero Trust Architecture', type: 'concept', description: '', sourceIds: [] },
          { id: 'sec-2', name: 'Diffie-Hellman Key Exchange', type: 'concept', description: '', sourceIds: [] },
          { id: 'sec-3', name: 'Buffer Overflow Exploits', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-security', graphData);

      // Flag 3 concepts needing review
      updateConceptPracticeState('sec-1', 'needs-review', 'graph-security');
      updateConceptPracticeState('sec-2', 'needs-review', 'graph-security');
      updateConceptPracticeState('sec-3', 'needs-review', 'graph-security');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      assert.strictEqual(stats.performance.conceptsNeedingRevisionCount, 3);
      // Up to 2 example names capped
      assert.strictEqual(stats.performance.conceptsNeedingRevisionExamples.length, 2);
      assert.strictEqual(stats.performance.conceptsNeedingRevisionExamples[0], 'Zero Trust Architecture');
      assert.strictEqual(stats.performance.conceptsNeedingRevisionExamples[1], 'Diffie-Hellman Key Exchange');
    });

    it('deduplicates identical concept flagged across both practice state and active session', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-ds',
        name: 'Data Structures',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-ds',
        name: 'Data Structures',
        nodes: [
          { id: 'ds-trie', name: 'Trie Data Structure', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-ds', graphData);

      // Flag 'ds-trie' in practice state
      updateConceptPracticeState('ds-trie', 'needs-review', 'graph-ds');

      // Also flag 'ds-trie' in active session marked list
      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-ds',
        conceptIds: ['ds-trie'],
        currentIndex: 0,
        totalConcepts: 1,
        createdAt: '2026-10-17T09:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z',
        reviewedConceptIds: [],
        markedForReviewIds: ['ds-trie']
      };
      saveRevisionSession(session, 'graph-ds');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });

      // Count is 1, not 2
      assert.strictEqual(stats.performance.conceptsNeedingRevisionCount, 1);
      assert.deepStrictEqual(stats.performance.conceptsNeedingRevisionExamples, ['Trie Data Structure']);
    });
  });

  // =========================================================================
  // 4. GAMIFICATION AVOIDANCE & DATA INTEGRITY
  // =========================================================================
  describe('4. Strict Data Integrity (No Fabrications)', () => {
    it('prohibits retention scores, learning streaks, or XP from existing in stats data model', () => {
      const stats = calculatePersonaStats();

      assert.strictEqual((stats.performance as any).retentionScore, undefined);
      assert.strictEqual((stats.performance as any).knowledgeRetention, undefined);
      assert.strictEqual((stats.performance as any).streak, undefined);
      assert.strictEqual((stats.activity as any).streak, undefined);
      assert.strictEqual((stats.performance as any).xp, undefined);
      assert.strictEqual((stats.performance as any).badge, undefined);
    });
  });
});
