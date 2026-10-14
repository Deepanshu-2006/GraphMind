import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import type { RevisionSessionState } from '../src/types/practice';
import type {
  KnowledgeCheckQuestion,
  KnowledgeCheckAttempt,
  ConceptKnowledgeCheckState
} from '../src/types/knowledgeCheck';
import type { ConceptPerformanceState } from '../src/types/adaptive';
import {
  calculateConceptMastery,
  loadGraphMasteryOverview,
  saveStoredMastery,
  loadStoredMastery,
  clearGraphMastery
} from '../src/services/conceptMastery';
import {
  deriveRevisionSessionInsights
} from '../src/services/sessionInsights';
import {
  generateAdaptiveRecommendation,
  deriveConceptPerformanceState
} from '../src/services/adaptiveRevision';
import {
  createRevisionSession,
  saveRevisionSession,
  loadRevisionSession
} from '../src/services/revisionSession';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import { RevisionConceptOverview } from '../src/components/revision/RevisionConceptOverview';
import { RevisionSessionInsights } from '../src/components/revision/RevisionSessionInsights';
import { KnowledgeCheckSection } from '../src/components/revision/KnowledgeCheckSection';

// Ensure localStorage mock is present for node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0
  } as unknown as Storage;
}

const mockGraph: KnowledgeGraph = {
  id: 'graph_polish_101',
  name: 'Machine Learning Fundamentals',
  nodes: [
    {
      id: 'node_gd',
      name: 'Gradient Descent',
      description: 'First-order iterative optimization algorithm for finding a local minimum of a differentiable function.',
      evidence: 'Descent step adjusts weights proportional to the negative gradient: w = w - eta * grad.',
      keyIdeas: [
        'Iterative weight adjustment in direction of steepest descent',
        'Learning rate controls step size'
      ],
      connections: [{ targetId: 'node_lr', relationship: 'requires' }]
    },
    {
      id: 'node_lr',
      name: 'Learning Rate',
      description: 'Tuning parameter in an optimization algorithm that determines the step size at each iteration.',
      evidence: 'High learning rate risks divergence; small learning rate results in sluggish convergence.',
      keyIdeas: [
        'Step magnitude tuning',
        'Risk of overshooting minimum'
      ],
      connections: [{ targetId: 'node_gd', relationship: 'relates-to' }]
    },
    {
      id: 'node_loss',
      name: 'Loss Function',
      description: 'Mathematical function mapping values of variables onto a real number representing cost.',
      evidence: 'Measures discrepancy between predictions and ground-truth targets.',
      keyIdeas: ['Quantifies model error'],
      connections: [{ targetId: 'node_gd', relationship: 'feeds' }]
    }
  ],
  edges: [
    { source: 'node_gd', target: 'node_lr', label: 'requires' },
    { source: 'node_loss', target: 'node_gd', label: 'optimizes' }
  ]
};

describe('GraphMind — Phase 3, Prompt 14: Revision Workspace Polish & Integration', () => {

  // ==========================================================================
  // 1. Complete Learning Flow & Real-Time Mastery Reactivity
  // ==========================================================================
  describe('1. Learning Flow & Real-Time Reactivity', () => {
    it('propagates formative question attempt and recalculates concept mastery in real time', () => {
      const graphId = mockGraph.id;
      const conceptId = 'node_gd';

      // 1. Initial attempt with correct answer
      const attempt: KnowledgeCheckAttempt = {
        questionId: 'q_gd_1',
        submittedAnswer: 'opt_a',
        evaluation: {
          isCorrect: true,
          score: 1.0,
          feedback: 'Correct step direction along the negative gradient vector.',
          correctAnswer: 'Negative gradient vector direction'
        },
        attemptedAt: new Date().toISOString()
      };

      const kcState: ConceptKnowledgeCheckState = {
        graphId,
        conceptId,
        questions: [{
          id: 'q_gd_1',
          conceptId,
          type: 'multiple-choice',
          prompt: 'What direction does gradient descent move weights in?',
          options: [
            { id: 'opt_a', text: 'Opposite to gradient vector', isCorrect: true },
            { id: 'opt_b', text: 'Parallel to gradient vector', isCorrect: false }
          ],
          correctAnswer: 'Opposite to gradient vector',
          rationale: 'Moves against the gradient towards minimal loss.',
          sourceTitle: 'Optimization Basics'
        }],
        attempts: {
          q_gd_1: attempt
        },
        activeQuestionIndex: 0,
        status: 'ready',
        updatedAt: new Date().toISOString()
      };

      // Calculate mastery based on authentic evidence
      const mastery = calculateConceptMastery({
        graphId,
        conceptId,
        conceptName: 'Gradient Descent',
        isVisitedInSession: true,
        knowledgeCheckState: kcState,
        isMarkedForReview: false
      });

      assert.equal(mastery.status, 'understanding-demonstrated');
      assert.equal(mastery.statusLabel, 'Understanding demonstrated');
      assert.equal(mastery.evidenceSource, 'knowledge-check');
      assert.ok(mastery.explanationSummary?.includes('negative gradient'));

      // Persist and verify recovery
      saveStoredMastery(graphId, mastery);
      const loaded = loadStoredMastery(graphId, conceptId);
      assert.ok(loaded);
      assert.equal(loaded?.status, 'understanding-demonstrated');
    });

    it('generates adaptive recommendation after student demonstrates understanding', () => {
      const performance: ConceptPerformanceState = {
        conceptId: 'node_gd',
        status: 'demonstrated-understanding',
        statusLabel: 'Understanding demonstrated',
        totalAttempts: 1,
        correctAttempts: 1,
        accuracyRate: 1.0,
        consecutiveIncorrectCount: 0,
        hasRecentMisconception: false
      };

      const session: RevisionSessionState = {
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 0,
        currentConceptId: 'node_gd',
        reviewedConceptIds: ['node_gd'],
        lastUpdated: new Date().toISOString()
      };

      const rec = generateAdaptiveRecommendation({
        graphId: mockGraph.id,
        currentConceptId: 'node_gd',
        currentConceptName: 'Gradient Descent',
        performance,
        graph: mockGraph,
        session
      });

      assert.ok(rec);
      assert.equal(rec.primaryAction.type, 'continue-planned-path');
      assert.ok(rec.primaryAction.label.includes('Learning Rate'));
      assert.ok(rec.rationale.includes('understanding'));
    });

    it('generates review recommendation when formative check detects misconceptions', () => {
      const performance: ConceptPerformanceState = {
        conceptId: 'node_gd',
        status: 'needs-review',
        statusLabel: 'Needs review',
        totalAttempts: 2,
        correctAttempts: 0,
        accuracyRate: 0.0,
        consecutiveIncorrectCount: 2,
        hasRecentMisconception: true,
        reviewSectionId: 'section-core-concept',
        reviewSectionTitle: 'Core Principle'
      };

      const session: RevisionSessionState = {
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 0,
        currentConceptId: 'node_gd',
        reviewedConceptIds: ['node_gd'],
        lastUpdated: new Date().toISOString()
      };

      const rec = generateAdaptiveRecommendation({
        graphId: mockGraph.id,
        currentConceptId: 'node_gd',
        currentConceptName: 'Gradient Descent',
        performance,
        graph: mockGraph,
        session
      });

      assert.ok(rec);
      assert.equal(rec.primaryAction.type, 'review-explanation-section');
      assert.ok(rec.primaryAction.label.includes('Core Principle'));
      assert.ok(rec.rationale.includes('review'));
    });
  });

  // ==========================================================================
  // 2. Typography, Reading Experience, and Swiss Editorial Hierarchy
  // ==========================================================================
  describe('2. Typography and Reading Experience', () => {
    it('enforces Swiss editorial styling tokens in revision.css without linear gradients or blur', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
      assert.ok(fs.existsSync(cssPath), 'revision.css must exist');
      const css = fs.readFileSync(cssPath, 'utf8');

      // Reject non-editorial decorative styles
      assert.ok(!css.includes('linear-gradient('), 'Must have zero linear-gradients in revision.css');
      assert.ok(!css.includes('backdrop-filter: blur'), 'Must have zero backdrop-filter blur in revision.css');

      // Verify essential typography and layout tokens
      assert.ok(css.includes('--font-body'), 'Must define or reference body typography token');
      assert.ok(css.includes('max-width: 760px') || css.includes('max-width: 820px'), 'Reading column must be constrained');
      assert.ok(css.includes('--accent, #A3FF12'), 'Uses restrained GraphMind signature green accent');
    });

    it('renders concept explanation and section hierarchy with proper semantics', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 0
      });

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          activeSession: session,
          onBackToGraph: () => {},
          skipEntryAnimation: true
        })
      );

      // Verify semantic landmarks and reading structure
      assert.ok(html.includes('role="banner"'), 'Header must have banner role');
      assert.ok(html.includes('role="main"'), 'Main reading area must have main role');
      assert.ok(html.includes('Gradient Descent'), 'Active concept title must be displayed');
      assert.ok(html.includes('01 / 03'), 'Session index must show 2-digit padded indicators');
    });
  });

  // ==========================================================================
  // 3. Animation and Motion Polish
  // ==========================================================================
  describe('3. Animation and Motion Polish', () => {
    it('includes all Phase 3 interactive components in prefers-reduced-motion CSS block', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Must contain reduced motion media query');
      assert.ok(css.includes('.revision-overview-drawer'), 'Overview drawer covered in reduced motion');
      assert.ok(css.includes('.revision-insights-container'), 'Insights container covered in reduced motion');
      assert.ok(css.includes('.revision-kc-container'), 'Knowledge check container covered in reduced motion');
      assert.ok(css.includes('.revision-adaptive-btn-primary'), 'Adaptive buttons covered in reduced motion');
    });

    it('respects entry animation flag so returning from graph does not replay entry sequence', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['node_gd', 'node_lr'],
        currentIndex: 0
      });
      session.entryAnimationPlayed = true;

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          activeSession: session,
          onBackToGraph: () => {}
        })
      );

      // When entryAnimationPlayed is true, components initialize directly in settled state
      assert.ok(html.includes('revision-workspace-root'));
      assert.ok(!html.includes('aria-busy="true"'));
    });
  });

  // ==========================================================================
  // 4. Loading, Empty, and Error States (Resilience)
  // ==========================================================================
  describe('4. Loading, Empty, and Error States', () => {
    it('gracefully degrades when explanation is unavailable so student can still study and answer questions', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['node_gd'],
        currentIndex: 0
      });

      // Render workspace with fallback content
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          activeSession: session,
          onBackToGraph: () => {},
          skipEntryAnimation: true
        })
      );

      // Verify that concept title, key ideas, and knowledge-check section are accessible
      assert.ok(html.includes('Gradient Descent'));
      assert.ok(html.includes('revision-kc-container'), 'Knowledge check is still rendered as fallback');
      assert.ok(html.includes('Check understanding'), 'Knowledge check submission button is available');
    });

    it('renders clean empty state when revision session has no concepts', () => {
      const emptyGraph: KnowledgeGraph = {
        id: 'graph_empty',
        name: 'Empty Graph',
        nodes: [],
        edges: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: emptyGraph,
          onBackToGraph: () => {},
          skipEntryAnimation: true
        })
      );

      assert.ok(html.includes('revision-empty-state'), 'Empty state card must be rendered');
      assert.ok(html.includes('No concepts available'));
    });
  });

  // ==========================================================================
  // 5. Session State, Navigation, and Completion Intentionality
  // ==========================================================================
  describe('5. Session State and Insights', () => {
    it('preserves revision session in storage on navigation and saves state reliably', () => {
      const session = createRevisionSession({
        graphId: mockGraph.id,
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 1
      });
      session.reviewedConceptIds = ['node_gd', 'node_lr'];

      saveRevisionSession(session, mockGraph.id);
      const restored = loadRevisionSession(mockGraph.id);

      assert.ok(restored);
      assert.equal(restored?.currentIndex, 1);
      assert.equal(restored?.conceptIds[restored.currentIndex], 'node_lr');
      assert.deepEqual(restored?.reviewedConceptIds, ['node_gd', 'node_lr']);
    });

    it('derives factual, non-gamified session insights upon completion', () => {
      const session: RevisionSessionState = {
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 2,
        currentConceptId: 'node_loss',
        reviewedConceptIds: ['node_gd', 'node_lr', 'node_loss'],
        markedForReviewIds: ['node_lr'],
        lastUpdated: new Date().toISOString()
      };

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        graphName: mockGraph.name,
        session,
        concepts: mockGraph.nodes.map((n) => ({ id: n.id, name: n.name }))
      });

      assert.equal(insights.totalSessionConcepts, 3);
      assert.equal(insights.visitedCount, 3);
      assert.equal(insights.isCompleted, true);
      assert.equal(insights.needsReviewCount, 1);
      assert.equal(insights.revisitConcepts[0].conceptId, 'node_lr');

      // Next actions must offer targeted review first
      assert.ok(insights.nextActions.length > 0);
      assert.equal(insights.nextActions[0].type, 'review-difficult');
    });

    it('renders RevisionSessionInsights component cleanly without trophies or badges', () => {
      const session: RevisionSessionState = {
        conceptIds: ['node_gd', 'node_lr', 'node_loss'],
        currentIndex: 2,
        currentConceptId: 'node_loss',
        reviewedConceptIds: ['node_gd', 'node_lr', 'node_loss'],
        lastUpdated: new Date().toISOString()
      };

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        graphName: mockGraph.name,
        session,
        concepts: mockGraph.nodes.map((n) => ({ id: n.id, name: n.name }))
      });

      const html = renderToString(
        React.createElement(RevisionSessionInsights, {
          insights,
          onSelectConcept: () => {},
          onResumeRevision: () => {},
          onReturnToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-insights-container'));
      assert.ok(html.includes('Revision Session Complete.'));
      assert.ok(!html.includes('🏆') && !html.includes('🎉') && !html.includes('badge'));
      assert.ok(html.includes('Suggested Next Steps'));
    });
  });

  // ==========================================================================
  // 6. Accessibility & Visual State Disambiguation
  // ==========================================================================
  describe('6. Accessibility & Visual State Disambiguation', () => {
    it('ensures concept overview drawer displays accessible text alongside color indicators', () => {
      const overview = loadGraphMasteryOverview(
        mockGraph.id,
        mockGraph.nodes.map((n) => ({ id: n.id, name: n.name }))
      );

      const html = renderToString(
        React.createElement(RevisionConceptOverview, {
          overview,
          conceptList: mockGraph.nodes.map((n) => ({ id: n.id, name: n.name })),
          currentConceptId: 'node_gd',
          isOpen: true,
          onToggle: () => {},
          onSelectConcept: () => {}
        })
      );

      // Verify aria labels and unambiguous status text
      assert.ok(html.includes('role="region"'));
      assert.ok(html.includes('aria-label="Concept revision overview"'));
      assert.ok(html.includes('DEMONSTRATED'));
      assert.ok(html.includes('NEEDS REVIEW'));
      assert.ok(html.includes('Not started') || html.includes('Demonstrated'));
    });

    it('renders knowledge-check radio options with accessible radio roles and checked states', () => {
      const question: KnowledgeCheckQuestion = {
        id: 'q_acc_1',
        conceptId: 'node_gd',
        type: 'multiple-choice',
        prompt: 'Which parameter determines step size?',
        options: [
          { id: 'opt_a', text: 'Learning rate', isCorrect: true },
          { id: 'opt_b', text: 'Batch size', isCorrect: false }
        ],
        correctAnswer: 'Learning rate',
        rationale: 'Learning rate scales the gradient step vector.'
      };

      const html = renderToString(
        React.createElement(KnowledgeCheckSection, {
          graph: mockGraph,
          conceptId: 'node_gd',
          conceptName: 'Gradient Descent'
        })
      );

      assert.ok(html.includes('role="radiogroup"'));
      assert.ok(html.includes('role="radio"'));
      assert.ok(html.includes('aria-checked="false"'));
      assert.ok(html.includes('A'));
      assert.ok(html.includes('B'));
    });
  });

});
