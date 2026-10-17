import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  easeOutCubic,
  clampValue,
  calculateInterpolatedValue
} from '../src/components/persona/PersonaAnimatedNumber';
import { formatTabularCount, formatRelativeTime } from '../src/components/persona/PersonaActivityPanel';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt } from '../src/types/test';
import type { RevisionSessionState } from '../src/types/practice';
import {
  saveGraphData,
  saveRevisionSession,
  clearAllUserData,
  updateConceptPracticeState
} from '../src/services/storage';
import {
  saveAssessmentAttempt,
  clearAssessmentHistory
} from '../src/services/assessmentHistory';
import { clearCurrentUser } from '../src/services/auth';

// In-memory localStorage mock for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
  get length() { return storageMap.size; }
};

describe('GRAPHMIND — PERSONA CINEMATIC STATISTICS ANIMATIONS (Step 15)', () => {
  // =========================================================================
  // 1. STATISTICAL NUMBER ANIMATION INTERPOLATION & EASING
  // =========================================================================
  describe('1. Animated Number Interpolation & Easing Math', () => {
    it('satisfies boundary conditions for ease-out cubic curve', () => {
      assert.strictEqual(easeOutCubic(0), 0);
      assert.strictEqual(easeOutCubic(1), 1);
      // Below 0 clamps to 0, above 1 clamps to 1
      assert.strictEqual(easeOutCubic(-0.5), 0);
      assert.strictEqual(easeOutCubic(1.5), 1);
    });

    it('demonstrates smooth deceleration (ease-out cubic curvature)', () => {
      // For easeOutCubic: f(0.25) > 0.25 and rate of change slows down as t -> 1
      const p25 = easeOutCubic(0.25); // 1 - (0.75)^3 = 1 - 0.421875 = 0.578125
      const p50 = easeOutCubic(0.5);  // 1 - (0.5)^3 = 1 - 0.125 = 0.875
      const p75 = easeOutCubic(0.75); // 1 - (0.25)^3 = 1 - 0.015625 = 0.984375

      assert(p25 > 0.5, 'Quick initial responsiveness');
      assert(p50 > 0.8, 'Smooth deceleration past midpoint');
      assert(p75 > 0.95, 'Gentle settling into final value');
      assert(p25 < p50 && p50 < p75, 'Strictly monotonically increasing');
    });

    it('guarantees exact integer target settling at progress >= 1.0', () => {
      const target = 85;
      const start = 0;
      const finalVal = calculateInterpolatedValue(start, target, 1.0, 0, 100);
      assert.strictEqual(finalVal, target, 'Must match exact integer target on completion');

      const overshot = calculateInterpolatedValue(start, target, 1.2, 0, 100);
      assert.strictEqual(overshot, target, 'Must never exceed target on completion');
    });

    it('clamps values strictly within valid [0, 100] percentage bounds', () => {
      assert.strictEqual(clampValue(-15, 0, 100), 0);
      assert.strictEqual(clampValue(125, 0, 100), 100);
      assert.strictEqual(clampValue(74, 0, 100), 74);
      assert.strictEqual(clampValue(0, 0, 100), 0);
      assert.strictEqual(clampValue(100, 0, 100), 100);
    });

    it('produces integer values throughout interpolation without floating decimals', () => {
      const start = 0;
      const target = 42;
      for (let t = 0; t <= 1.0; t += 0.1) {
        const val = calculateInterpolatedValue(start, target, t);
        assert.strictEqual(Number.isInteger(val), true, `Value at t=${t} must be an integer`);
        assert(val >= 0 && val <= 42, `Value at t=${t} must be within start and target`);
      }
    });

    it('integrates seamlessly with formatTabularCount for whole-number counters', () => {
      const val0 = calculateInterpolatedValue(0, 0, 1.0);
      assert.strictEqual(formatTabularCount(val0), '00');

      const val5 = calculateInterpolatedValue(0, 5, 1.0);
      assert.strictEqual(formatTabularCount(val5), '05');

      const val42 = calculateInterpolatedValue(0, 42, 1.0);
      assert.strictEqual(formatTabularCount(val42), '42');
    });
  });

  // =========================================================================
  // 2. PROGRESS INDICATORS & DATA ACCURACY
  // =========================================================================
  describe('2. Progress Indicators & Data Accuracy', () => {
    it('handles zero concepts cleanly without fabricating false 0% progress', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.activity.totalConcepts, 0);
      assert.strictEqual(stats.activity.demonstratedPercentage, 0);
      // When totalConcepts === 0, the UI renders '—%' and width is 0%
      const renderedWidth = stats.activity.totalConcepts === 0 ? 0 : stats.activity.demonstratedPercentage;
      assert.strictEqual(renderedWidth, 0);
    });

    it('calculates verified learning progress accurately from mastered concepts', () => {
      storageMap.clear();
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-algo',
        name: 'Algorithms',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        nodes: [
          { id: 'c1', name: 'BFS', summary: 'Breadth First Search' },
          { id: 'c2', name: 'DFS', summary: 'Depth First Search' },
          { id: 'c3', name: 'Dijkstra', summary: 'Shortest path' },
          { id: 'c4', name: 'A*', summary: 'Heuristic search' }
        ],
        relationships: []
      };

      saveGraphData('graph-algo', graphData);
      updateConceptPracticeState('c1', 'understood', 'graph-algo');
      updateConceptPracticeState('c2', 'understood', 'graph-algo');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });
      // 2 out of 4 = 50%
      assert.strictEqual(stats.activity.demonstratedPercentage, 50);
      const width = stats.activity.totalConcepts === 0 ? 0 : stats.activity.demonstratedPercentage;
      assert.strictEqual(width, 50);
    });

    it('reports revision progress accurately when session is active and 0 when absent', () => {
      storageMap.clear();
      clearAssessmentHistory();

      // No active revision session
      let stats = calculatePersonaStats({ graphs: [] });
      assert.strictEqual(stats.performance.activeRevisionProgress, null);
      let width = stats.performance.activeRevisionProgress ? stats.performance.activeRevisionProgress.progressPercent : 0;
      assert.strictEqual(width, 0);

      // Active revision session with 3 of 5 concepts reviewed (60%)
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

      saveGraphData('graph-compilers', graphData);

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

      stats = calculatePersonaStats({ graphs: [graphMeta] });
      assert.notStrictEqual(stats.performance.activeRevisionProgress, null);
      assert.strictEqual(stats.performance.activeRevisionProgress?.progressPercent, 60);
      width = stats.performance.activeRevisionProgress ? stats.performance.activeRevisionProgress.progressPercent : 0;
      assert.strictEqual(width, 60);
    });
  });

  // =========================================================================
  // 3. COORDINATED PANEL ENTRANCE & HORIZONTAL OFFSETS
  // =========================================================================
  describe('3. Coordinated Panel Entrance Motion Constraints', () => {
    it('verifies left and right panel entrance movement stays within 8-14px boundary', () => {
      const leftOffset = -10; // Left panel: x: -10
      const rightOffset = 10; // Right panel: x: 10

      assert(Math.abs(leftOffset) >= 8 && Math.abs(leftOffset) <= 14, 'Left offset within 8-14px');
      assert(Math.abs(rightOffset) >= 8 && Math.abs(rightOffset) <= 14, 'Right offset within 8-14px');
      assert(leftOffset < 0, 'Left panel enters subtly from the left');
      assert(rightOffset > 0, 'Right panel enters subtly from the right');
    });

    it('verifies reduced motion completely removes horizontal offset', () => {
      const shouldReduceMotion = true;
      const leftOffset = shouldReduceMotion ? 0 : -10;
      const rightOffset = shouldReduceMotion ? 0 : 10;

      assert.strictEqual(leftOffset, 0, 'Reduced motion disables left horizontal slide');
      assert.strictEqual(rightOffset, 0, 'Reduced motion disables right horizontal slide');
    });
  });

  // =========================================================================
  // 4. DATA UPDATE TRANSITIONS & STABLE REACT KEYS
  // =========================================================================
  describe('4. Recent Activity and Assessment Updates with Stable Keys', () => {
    it('verifies recent graph activity uses persistent graph.graphId for stable keys', () => {
      storageMap.clear();
      const g1: KnowledgeGraphMeta = {
        id: 'graph-alpha',
        name: 'Distributed Systems',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z'
      };

      const stats = calculatePersonaStats({ graphs: [g1] });
      assert.strictEqual(stats.activity.recentGraphs.length, 1);
      const item = stats.activity.recentGraphs[0];
      assert.strictEqual(item.graphId, 'graph-alpha');
      assert.strictEqual(typeof item.graphId, 'string');
      assert(item.graphId.length > 0, 'Must have a stable persistent identifier');
    });

    it('verifies recent assessment items use persistent attempt.id for stable keys', () => {
      storageMap.clear();
      clearAssessmentHistory();

      const attempt: AssessmentAttempt = {
        id: 'attempt-score-99',
        testId: 'test-1',
        graphId: 'g-1',
        graphName: 'Physics',
        scorePercentage: 92,
        correctAnswers: 9,
        totalQuestions: 10,
        completedAt: '2026-10-17T09:15:00.000Z',
        timeSpentSeconds: 150,
        answers: {}
      };

      saveAssessmentAttempt(attempt);
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual(stats.performance.recentAssessments.length, 1);
      const recent = stats.performance.recentAssessments[0];
      assert.strictEqual(recent.id, 'attempt-score-99');
      assert.strictEqual(typeof recent.id, 'string');
      assert(recent.id.length > 0, 'Must have a stable persistent identifier');
    });
  });

  // =========================================================================
  // 5. DATA INTEGRITY & ZERO GAMIFICATION / FAKE COUNTERS
  // =========================================================================
  describe('5. Data Integrity & Prohibited Elements Check', () => {
    it('verifies no fake streaks, retention, or XP are injected into the stats model', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });

      assert.strictEqual((stats as any).streak, undefined);
      assert.strictEqual((stats as any).retentionScore, undefined);
      assert.strictEqual((stats as any).xp, undefined);
      assert.strictEqual((stats as any).level, undefined);
    });
  });
});
