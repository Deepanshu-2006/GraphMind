import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkHistoricalImprovement,
  getContextualObservations,
  getContextualObservationForCycle
} from '../src/services/personaObservations';
import {
  PersonaAnalysisController,
  getScorePresentation
} from '../src/components/persona/personaAnalysisController';
import type { PersonaStatsData, PersonaRecentAssessment } from '../src/types/personaStats';

// Helper to create mock PersonaStatsData cleanly
function createMockStats(overrides?: {
  totalGraphs?: number;
  recentGraphName?: string;
  totalConcepts?: number;
  demonstratedConcepts?: number;
  demonstratedPercentage?: number;
  averageScore?: number | null;
  recentAssessments?: PersonaRecentAssessment[];
  activeRevision?: {
    graphId: string;
    graphName: string;
    reviewedCount: number;
    totalConcepts: number;
    progressPercent: number;
  } | null;
  conceptsNeedingRevisionCount?: number;
  conceptsNeedingRevisionExamples?: string[];
}): PersonaStatsData {
  return {
    activity: {
      totalGraphs: overrides?.totalGraphs ?? 1,
      recentGraph: overrides?.recentGraphName !== undefined ? (overrides.recentGraphName ? {
        graphId: 'graph-1',
        graphName: overrides.recentGraphName,
        updatedAt: '2026-10-18T10:00:00Z',
        createdAt: '2026-10-17T10:00:00Z',
        totalConcepts: overrides?.totalConcepts ?? 10
      } : null) : {
        graphId: 'graph-1',
        graphName: 'Neural Networks',
        updatedAt: '2026-10-18T10:00:00Z',
        createdAt: '2026-10-17T10:00:00Z',
        totalConcepts: overrides?.totalConcepts ?? 10
      },
      recentGraphs: [],
      totalConcepts: overrides?.totalConcepts ?? 10,
      demonstratedConcepts: overrides?.demonstratedConcepts ?? 6,
      demonstratedPercentage: overrides?.demonstratedPercentage ?? 60
    },
    performance: {
      totalAssessmentAttempts: overrides?.recentAssessments?.length ?? (overrides?.averageScore !== null ? 1 : 0),
      recentAssessments: overrides?.recentAssessments ?? (overrides?.averageScore !== null && overrides?.averageScore !== undefined ? [
        {
          id: 'test-1',
          testId: 'test-1',
          graphId: 'graph-1',
          graphName: 'Neural Networks',
          scorePercentage: overrides.averageScore,
          correctAnswers: 8,
          totalQuestions: 10,
          completedAt: '2026-10-18T09:00:00Z',
          timeSpentSeconds: 120
        }
      ] : []),
      averageScore: overrides?.averageScore !== undefined ? overrides.averageScore : 75,
      activeRevisionProgress: overrides?.activeRevision !== undefined ? overrides.activeRevision : null,
      conceptsNeedingRevisionCount: overrides?.conceptsNeedingRevisionCount ?? 0,
      conceptsNeedingRevisionExamples: overrides?.conceptsNeedingRevisionExamples ?? []
    },
    userId: 'user-123',
    userName: 'Learner'
  };
}

describe('GRAPHMIND — PERSONA CONTEXTUAL OBSERVATION SYSTEM', () => {

  describe('1. Low Assessment Performance (< 60%)', () => {
    it('acknowledges severe difficulty (<40%) with empathy and suggests focusing on flagged concept', () => {
      const stats = createMockStats({
        averageScore: 35,
        conceptsNeedingRevisionCount: 2,
        conceptsNeedingRevisionExamples: ['Backpropagation', 'Loss Functions']
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'low-performance');
      assert.ok(obs.cycle1.includes('Recent assessments proved challenging'));
      assert.ok(obs.cycle2.includes('Backpropagation'));
    });

    it('acknowledges foundation building for 40-59% and guides toward concept review', () => {
      const stats = createMockStats({
        averageScore: 52,
        conceptsNeedingRevisionCount: 3,
        conceptsNeedingRevisionExamples: ['Gradient Descent']
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'low-performance');
      assert.ok(obs.cycle1.includes('establishing a foundation'));
      assert.ok(obs.cycle2.includes('Gradient Descent'));
    });

    it('acknowledges upward progress when historical data confirms recent improvement despite low average', () => {
      const stats = createMockStats({
        averageScore: 48,
        recentAssessments: [
          {
            id: 'attempt-2',
            testId: 't-2',
            graphId: 'g-1',
            graphName: 'Neural Networks',
            scorePercentage: 55, // Latest attempt
            correctAnswers: 5,
            totalQuestions: 10,
            completedAt: '2026-10-18T10:00:00Z',
            timeSpentSeconds: 110
          },
          {
            id: 'attempt-1',
            testId: 't-1',
            graphId: 'g-1',
            graphName: 'Neural Networks',
            scorePercentage: 40, // Previous attempt
            correctAnswers: 4,
            totalQuestions: 10,
            completedAt: '2026-10-18T09:00:00Z',
            timeSpentSeconds: 130
          }
        ]
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'improved-progress');
      assert.ok(obs.cycle1.includes('upward progress') || obs.cycle1.includes('measurable improvement'));
      assert.ok(obs.cycle2.includes('improved to 55%, up from 40%'));
    });
  });

  describe('2. Historical Improvement Verification (Strict Confirmation)', () => {
    it('returns null when only 1 assessment attempt exists (no historical comparison possible)', () => {
      const singleAssessment: PersonaRecentAssessment[] = [
        {
          id: 'attempt-1',
          testId: 't-1',
          graphId: 'g-1',
          graphName: 'Neural Networks',
          scorePercentage: 85,
          correctAnswers: 8,
          totalQuestions: 10,
          completedAt: '2026-10-18T09:00:00Z',
          timeSpentSeconds: 100
        }
      ];

      const improvement = checkHistoricalImprovement(singleAssessment);
      assert.equal(improvement, null, 'Must never claim improvement with only 1 attempt');
    });

    it('returns null when latest score is less than or equal to previous score (no improvement)', () => {
      const decliningAssessments: PersonaRecentAssessment[] = [
        {
          id: 'attempt-2',
          testId: 't-2',
          graphId: 'g-1',
          graphName: 'Neural Networks',
          scorePercentage: 70, // Latest: lower
          correctAnswers: 7,
          totalQuestions: 10,
          completedAt: '2026-10-18T10:00:00Z',
          timeSpentSeconds: 90
        },
        {
          id: 'attempt-1',
          testId: 't-1',
          graphId: 'g-1',
          graphName: 'Neural Networks',
          scorePercentage: 80, // Previous: higher
          correctAnswers: 8,
          totalQuestions: 10,
          completedAt: '2026-10-18T09:00:00Z',
          timeSpentSeconds: 95
        }
      ];

      const improvement = checkHistoricalImprovement(decliningAssessments);
      assert.equal(improvement, null, 'Must never claim improvement when score declined or remained flat');
    });

    it('correctly confirms improvement when latestScore > previousScore with exact delta', () => {
      const improvedAssessments: PersonaRecentAssessment[] = [
        {
          id: 'attempt-2',
          testId: 't-2',
          graphId: 'g-1',
          graphName: 'Deep Learning',
          scorePercentage: 92, // Latest
          correctAnswers: 9,
          totalQuestions: 10,
          completedAt: '2026-10-18T10:00:00Z',
          timeSpentSeconds: 85
        },
        {
          id: 'attempt-1',
          testId: 't-1',
          graphId: 'g-1',
          graphName: 'Deep Learning',
          scorePercentage: 78, // Previous
          correctAnswers: 7,
          totalQuestions: 10,
          completedAt: '2026-10-18T09:00:00Z',
          timeSpentSeconds: 120
        }
      ];

      const improvement = checkHistoricalImprovement(improvedAssessments);
      assert.ok(improvement !== null);
      assert.equal(improvement?.hasImproved, true);
      assert.equal(improvement?.latestScore, 92);
      assert.equal(improvement?.previousScore, 78);
      assert.equal(improvement?.delta, 14);
      assert.equal(improvement?.sameGraph, true);
    });
  });

  describe('3. Strong Assessment Performance (>= 80%)', () => {
    it('acknowledges strong grasp with calm dignity without hyperbole or exaggerated celebration', () => {
      const stats = createMockStats({
        averageScore: 88
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'strong-performance');
      assert.equal(obs.cycle1, 'Strong grasp demonstrated across assessments, averaging 88%.');
      assert.ok(!obs.cycle1.includes('insane') && !obs.cycle1.includes('genius'));
      assert.ok(obs.cycle2.includes('Consistent understanding'));
    });

    it('acknowledges confirmed improvement in Cycle 2 when historical data supports it', () => {
      const stats = createMockStats({
        averageScore: 86,
        recentAssessments: [
          {
            id: 'a-2',
            testId: 't-2',
            graphId: 'g-1',
            graphName: 'Algorithms',
            scorePercentage: 95,
            correctAnswers: 9,
            totalQuestions: 10,
            completedAt: '2026-10-18T10:00:00Z',
            timeSpentSeconds: 90
          },
          {
            id: 'a-1',
            testId: 't-1',
            graphId: 'g-1',
            graphName: 'Algorithms',
            scorePercentage: 77,
            correctAnswers: 7,
            totalQuestions: 10,
            completedAt: '2026-10-18T09:00:00Z',
            timeSpentSeconds: 110
          }
        ]
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'improved-progress');
      assert.ok(obs.cycle1.includes('86%'));
      assert.ok(obs.cycle2.includes('improved to 95%, up from 77%'));
    });
  });

  describe('4. Unfinished Revision Session', () => {
    it('gently reminds the learner that revision can be resumed when unassessed', () => {
      const stats = createMockStats({
        averageScore: null,
        recentAssessments: [],
        activeRevision: {
          graphId: 'g-rev',
          graphName: 'Quantum Mechanics',
          reviewedCount: 3,
          totalConcepts: 7,
          progressPercent: 42
        }
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'unfinished-revision');
      assert.ok(obs.cycle1.includes('active revision session in Quantum Mechanics with 4 concepts remaining'));
      assert.ok(obs.cycle2.includes('resume your revision in Quantum Mechanics'));
    });

    it('handles singular concept remaining in active revision cleanly', () => {
      const stats = createMockStats({
        averageScore: null,
        recentAssessments: [],
        activeRevision: {
          graphId: 'g-rev',
          graphName: 'Linear Algebra',
          reviewedCount: 4,
          totalConcepts: 5,
          progressPercent: 80
        }
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'unfinished-revision');
      assert.ok(obs.cycle1.includes('1 concept left to review'));
    });
  });

  describe('5. Concepts Requiring Attention', () => {
    it('suggests focusing on the relevant flagged concept when unassessed', () => {
      const stats = createMockStats({
        averageScore: null,
        recentAssessments: [],
        activeRevision: null,
        conceptsNeedingRevisionCount: 2,
        conceptsNeedingRevisionExamples: ['Eigenvectors', 'Null Space']
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'concepts-needing-attention');
      assert.ok(obs.cycle1.includes('2 concepts flagged for review'));
      assert.ok(obs.cycle2.includes('Focusing on Eigenvectors'));
    });
  });

  describe('6. Unassessed Graphs & Getting Started', () => {
    it('observes graph creation and suggests baseline assessment when concepts exist but are unassessed', () => {
      const stats = createMockStats({
        totalGraphs: 1,
        recentGraphName: 'Microbiology',
        totalConcepts: 12,
        demonstratedConcepts: 5,
        demonstratedPercentage: 41,
        averageScore: null,
        recentAssessments: [],
        activeRevision: null,
        conceptsNeedingRevisionCount: 0
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'unassessed-learning');
      assert.ok(obs.cycle1.includes("established your knowledge graph in Microbiology"));
      assert.ok(obs.cycle2.includes('demonstrated understanding of 5 of 12 concepts'));
    });

    it('provides calm onboarding guidance for brand new learners (0 graphs, 0 tests)', () => {
      const stats = createMockStats({
        totalGraphs: 0,
        recentGraphName: '',
        totalConcepts: 0,
        demonstratedConcepts: 0,
        demonstratedPercentage: 0,
        averageScore: null,
        recentAssessments: [],
        activeRevision: null,
        conceptsNeedingRevisionCount: 0
      });

      const obs = getContextualObservations(stats);
      assert.equal(obs.category, 'getting-started');
      assert.ok(obs.cycle1.includes('Welcome to your learning space'));
      assert.ok(obs.cycle2.includes('Once you add study materials'));
    });
  });

  describe('7. Coordination With Persona Controller & Gestures', () => {
    // Minimal mock controllers
    class MockLifeController {
      public gazeX = 0;
      public gazeY = 0;
      public headShakeTriggered = false;
      public nodTriggered = false;
      public setAnalysisGaze(x: number, y: number) { this.gazeX = x; this.gazeY = y; }
      public releaseAnalysisGaze() {}
      public triggerHeadShake() { this.headShakeTriggered = true; }
      public triggerApprovingNod() { this.nodTriggered = true; }
      public cancelHeadShake() { this.headShakeTriggered = false; }
      public triggerBlink() {}
    }

    class MockExpressionController {
      public currentExpression = 'neutral';
      public setExpression(exp: string) { this.currentExpression = exp; }
      public setAnalysisLocked() {}
    }

    it('displays Cycle 1 contextual observation during cycle 1 and Cycle 2 during cycle 2', () => {
      const mockLife = new MockLifeController();
      const mockExpr = new MockExpressionController();

      const stats = createMockStats({
        averageScore: 84
      });

      let observedMessage: string | null = null;
      let observedCycle: 1 | 2 = 1;

      const controller = new PersonaAnalysisController({
        lifeController: mockLife as any,
        expressionController: mockExpr as any,
        stats,
        deterministic: true,
        onMessageChange: (msg, cycle) => {
          observedMessage = msg;
          observedCycle = cycle;
        }
      });

      // Start controller and transition to reactToScore (Cycle 1)
      controller.start('idle');
      controller.transitionTo('observeRight');
      controller.transitionTo('analysePerformance');
      controller.transitionTo('reactToScore');

      assert.equal(observedCycle, 1);
      assert.equal(observedMessage, getContextualObservationForCycle(stats, 1));
      assert.equal(mockExpr.currentExpression, 'happy', '>=80% must trigger happy reaction expression');

      // Return to idle smoothly clears message
      controller.transitionTo('returnToIdle');
      assert.equal(observedMessage, null, 'Message must clear cleanly on returnToIdle');

      // Cycle 2
      controller.transitionTo('idle');
      controller.transitionTo('observeRight');
      controller.transitionTo('analysePerformance');
      controller.transitionTo('reactToScore');

      assert.equal(observedCycle, 2);
      assert.equal(observedMessage, getContextualObservationForCycle(stats, 2));

      // After cycle 2 returnToIdle, settles into idle
      controller.transitionTo('returnToIdle');
      controller.transitionTo('idle');
      assert.equal(controller.isAnalysisComplete(), true);
    });

    it('preserves score presentation tier mappings and gestures (<40% head shake, >=80% approving nod)', () => {
      const presLow = getScorePresentation(25);
      assert.ok(presLow);
      assert.equal(presLow.reactionExpression, 'sad');
      assert.equal(presLow.hasHeadShake, true);
      assert.equal(presLow.hasNod, false);

      const presNeutral = getScorePresentation(50);
      assert.ok(presNeutral);
      assert.equal(presNeutral.reactionExpression, 'neutral');
      assert.equal(presNeutral.hasHeadShake, false);
      assert.equal(presNeutral.hasNod, false);

      const presHigh = getScorePresentation(90);
      assert.ok(presHigh);
      assert.equal(presHigh.reactionExpression, 'happy');
      assert.equal(presHigh.hasHeadShake, false);
      assert.equal(presHigh.hasNod, true);
    });
  });
});
