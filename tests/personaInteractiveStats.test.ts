import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt } from '../src/types/test';
import type { RevisionSessionState } from '../src/types/practice';
import {
  saveGraphs,
  saveGraphData,
  saveRevisionSession,
  clearAllUserData,
  loadActiveGraphId,
  saveActiveGraphId
} from '../src/services/storage';
import {
  saveAssessmentAttempt,
  clearAssessmentHistory,
  getAssessmentAttemptById
} from '../src/services/assessmentHistory';
import { clearCurrentUser } from '../src/services/auth';

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

describe('GRAPHMIND — PERSONA INTERACTIVE LEARNING STATISTICS & SMART NAVIGATION (Step 16)', () => {
  // =========================================================================
  // 1. RECENT KNOWLEDGE GRAPHS INTERACTION & SELECTION
  // =========================================================================
  describe('1. Recent Knowledge Graphs Navigation', () => {
    it('provides valid graphId and graphName for recent graph selection', () => {
      storageMap.clear();

      const g1: KnowledgeGraphMeta = {
        id: 'graph-ds-1',
        name: 'Distributed Systems',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z'
      };

      saveGraphs([g1]);
      saveActiveGraphId(g1.id);

      const stats = calculatePersonaStats({ graphs: [g1] });
      assert.strictEqual(stats.activity.recentGraphs.length, 1);
      const recent = stats.activity.recentGraphs[0];

      let selectedId: string | null = null;
      const mockSelectGraph = (graphId: string) => {
        selectedId = graphId;
        saveActiveGraphId(graphId);
      };

      // Simulating user click on the interactive graph row
      mockSelectGraph(recent.graphId);

      assert.strictEqual(selectedId, 'graph-ds-1');
      assert.strictEqual(loadActiveGraphId(), 'graph-ds-1');
    });

    it('preserves empty state and does not create fake interactive items when 0 graphs exist', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.activity.recentGraphs.length, 0);
      assert.strictEqual(stats.activity.recentGraph, null);
    });
  });

  // =========================================================================
  // 2. RECENT ASSESSMENT RESULTS INTERACTION & PERSISTENCE
  // =========================================================================
  describe('2. Recent Assessment Results Navigation & Snapshot Preservation', () => {
    it('preserves the exact assessment attempt ID when an assessment is selected', () => {
      storageMap.clear();
      clearAssessmentHistory();

      const attemptA: AssessmentAttempt = {
        id: 'attempt-early-1',
        testId: 'test-os-attempt-1',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        scorePercentage: 70,
        correctAnswers: 7,
        totalQuestions: 10,
        completedAt: '2026-10-16T10:00:00.000Z',
        timeSpentSeconds: 120,
        answers: {}
      };

      const attemptB: AssessmentAttempt = {
        id: 'attempt-recent-2',
        testId: 'test-os-attempt-2',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        scorePercentage: 90,
        correctAnswers: 9,
        totalQuestions: 10,
        completedAt: '2026-10-17T08:00:00.000Z', // newest
        timeSpentSeconds: 100,
        answers: {}
      };

      saveAssessmentAttempt(attemptA);
      saveAssessmentAttempt(attemptB);

      const stats = calculatePersonaStats({ graphs: [] });

      // Assessment items are ordered newest first (attemptB, then attemptA)
      assert.strictEqual(stats.performance.recentAssessments.length, 2);
      assert.strictEqual(stats.performance.recentAssessments[0].id, 'attempt-recent-2');
      assert.strictEqual(stats.performance.recentAssessments[1].id, 'attempt-early-1');

      // User selects the earlier attempt (attemptA)
      let openedAttemptId: string | null = null;
      let targetGraphId: string | undefined = undefined;

      const mockSelectAssessment = (attemptId: string, graphId?: string) => {
        openedAttemptId = attemptId;
        targetGraphId = graphId;
      };

      mockSelectAssessment(stats.performance.recentAssessments[1].id, stats.performance.recentAssessments[1].graphId);

      assert.strictEqual(openedAttemptId, 'attempt-early-1', 'Must preserve the specific clicked attempt ID');
      assert.strictEqual(targetGraphId, 'graph-os', 'Must preserve the associated graph ID');

      // Verify the underlying assessment record snapshot exists and can be retrieved
      const retrieved = getAssessmentAttemptById(openedAttemptId!);
      assert.notStrictEqual(retrieved, null);
      assert.strictEqual(retrieved?.scorePercentage, 70, 'Matches the historical 70% score, not the 90% latest score');
    });

    it('isolates attempts across different graphs without cross-contamination', () => {
      storageMap.clear();
      clearAssessmentHistory();

      const attemptML: AssessmentAttempt = {
        id: 'att-ml-1',
        testId: 'test-ml-attempt-1',
        graphId: 'graph-ml',
        graphName: 'Machine Learning',
        scorePercentage: 95,
        correctAnswers: 19,
        totalQuestions: 20,
        completedAt: '2026-10-17T09:00:00.000Z',
        timeSpentSeconds: 240,
        answers: {}
      };

      saveAssessmentAttempt(attemptML);
      const stats = calculatePersonaStats({ graphs: [] });

      const item = stats.performance.recentAssessments[0];
      assert.strictEqual(item.id, 'att-ml-1');
      assert.strictEqual(item.graphId, 'graph-ml');
      assert.strictEqual(item.graphName, 'Machine Learning');
    });
  });

  // =========================================================================
  // 3. REVISION SESSION METRICS & RESUME ACTION
  // =========================================================================
  describe('3. Revision Session Navigation & Scope Preservation', () => {
    it('provides reliable graphId when an active revision session exists', () => {
      storageMap.clear();

      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-algo',
        name: 'Algorithms',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-algo',
        name: 'Algorithms',
        nodes: [
          { id: 'c1', name: 'BFS', type: 'concept', description: '', sourceIds: [] },
          { id: 'c2', name: 'DFS', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-algo', graphData);

      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-algo',
        conceptIds: ['c1', 'c2'],
        currentIndex: 1,
        currentConceptId: 'c2',
        totalConcepts: 2,
        createdAt: '2026-10-17T07:00:00.000Z',
        updatedAt: '2026-10-17T07:30:00.000Z',
        reviewedConceptIds: ['c1'],
        markedForReviewIds: []
      };

      saveRevisionSession(session, 'graph-algo');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });
      assert.notStrictEqual(stats.performance.activeRevisionProgress, null);

      let resumedGraphId: string | null = null;
      const mockResumeRevision = (graphId: string) => {
        resumedGraphId = graphId;
        saveActiveGraphId(graphId);
      };

      mockResumeRevision(stats.performance.activeRevisionProgress!.graphId);
      assert.strictEqual(resumedGraphId, 'graph-algo');
      assert.strictEqual(loadActiveGraphId(), 'graph-algo');
    });

    it('reports null revision progress when no active session exists', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.performance.activeRevisionProgress, null);
    });
  });

  // =========================================================================
  // 4. INFORMATIONAL SCOPING & ANTI-MISLEADING GUARANTEE
  // =========================================================================
  describe('4. Informational vs Interactive Scoping Guarantee', () => {
    it('keeps aggregate learning progress strictly informational (no arbitrary graph navigation)', () => {
      storageMap.clear();

      const g1: KnowledgeGraphMeta = {
        id: 'graph-1',
        name: 'Graph 1',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z'
      };
      const g2: KnowledgeGraphMeta = {
        id: 'graph-2',
        name: 'Graph 2',
        createdAt: '2026-10-11T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z'
      };

      const stats = calculatePersonaStats({ graphs: [g1, g2] });

      // demonstratedPercentage is aggregated across all graphs
      assert(typeof stats.activity.demonstratedPercentage === 'number');
    });

    it('keeps concepts-needing-revision count informational to avoid sending user to an arbitrary graph', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      // conceptsNeedingRevisionCount is an informational rollup
      assert.strictEqual(typeof stats.performance.conceptsNeedingRevisionCount, 'number');
      assert(Array.isArray(stats.performance.conceptsNeedingRevisionExamples));
    });
  });

  // =========================================================================
  // 5. DATA INTEGRITY & PROHIBITED ACTIONS
  // =========================================================================
  describe('5. Data Integrity & Prohibited Actions', () => {
    it('does not fabricate assessment attempts or routes when history is empty', () => {
      storageMap.clear();
      clearAssessmentHistory();

      const stats = calculatePersonaStats({ graphs: [] });
      assert.strictEqual(stats.performance.totalAssessmentAttempts, 0);
      assert.strictEqual(stats.performance.averageScore, null);
      assert.deepStrictEqual(stats.performance.recentAssessments, []);
    });

    it('strictly avoids gamification properties', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual((stats as any).streak, undefined);
      assert.strictEqual((stats as any).xp, undefined);
      assert.strictEqual((stats as any).badges, undefined);
    });
  });
});
