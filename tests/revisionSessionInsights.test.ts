import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import type { RevisionSessionState } from '../src/types/practice';
import type { ConceptKnowledgeCheckState } from '../src/types/knowledgeCheck';
import { deriveRevisionSessionInsights } from '../src/services/sessionInsights';
import { RevisionSessionInsights } from '../src/components/revision/RevisionSessionInsights';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';
import { saveRevisionSession, loadRevisionSession, clearRevisionSession } from '../src/services/storage';

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

describe('GraphMind Feature: Revision Session Insights (Phase 3 — Prompt 13)', { concurrency: 1 }, () => {
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  let cssContent: string;

  beforeEach(() => {
    storageMap.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  const mockNode1: KnowledgeNode = {
    id: 'c-consensus',
    name: 'Distributed Consensus',
    type: 'theory',
    description: 'Agreement on state across distributed nodes.',
    sourceIds: ['src-consensus']
  };

  const mockNode2: KnowledgeNode = {
    id: 'c-raft',
    name: 'Raft Consensus Protocol',
    type: 'algorithm',
    description: 'Decomposed leader election and log replication.',
    sourceIds: ['src-raft']
  };

  const mockNode3: KnowledgeNode = {
    id: 'c-bft',
    name: 'Byzantine Fault Tolerance',
    type: 'mechanism',
    description: 'Consensus resilience under arbitrary node failures.',
    sourceIds: ['src-bft']
  };

  const mockRel1: KnowledgeRelationship = {
    id: 'rel-1',
    source: 'c-consensus',
    target: 'c-raft',
    relationType: 'prerequisite',
    description: 'Consensus theory precedes Raft algorithm.'
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-distributed-systems',
    name: 'Distributed Systems',
    nodes: [mockNode1, mockNode2, mockNode3],
    relationships: [mockRel1],
    sources: []
  };

  const mockSession: RevisionSessionState = {
    isActive: true,
    graphId: 'graph-distributed-systems',
    conceptIds: ['c-consensus', 'c-raft', 'c-bft'],
    currentIndex: 0,
    currentConceptId: 'c-consensus',
    totalConcepts: 3,
    createdAt: '2026-10-14T05:00:00.000Z',
    reviewedConceptIds: ['c-consensus'],
    markedForReviewIds: []
  };

  const mockExplanation: ConceptExplanation = {
    conceptId: 'c-consensus',
    graphId: 'graph-distributed-systems',
    title: 'Distributed Consensus Explained',
    overview: 'Consensus is fundamental to fault-tolerant distributed computing.',
    sections: [
      {
        id: 'sec-1',
        title: 'The Consensus Problem',
        content: 'Processes agree on values despite network partitions.',
        type: 'core-concept',
        order: 1
      }
    ],
    sourceAttribution: [],
    prerequisiteConceptIds: [],
    relatedConceptIds: ['c-raft'],
    generatedAt: Date.now(),
    version: 1
  };

  /* ====================================================================
   * SUITE 1: Insights Derivation & Accuracy
   * ==================================================================== */
  describe('1. Insights Derivation & Accuracy', () => {
    test('distinguishes visited vs. unvisited concepts accurately', () => {
      // Only c-consensus visited, c-raft and c-bft unvisited
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.strictEqual(insights.totalSessionConcepts, 3);
      assert.strictEqual(insights.visitedCount, 1);
      assert.strictEqual(insights.unvisitedCount, 2);
      assert.strictEqual(insights.isCompleted, false);
      assert.strictEqual(insights.reviewedConcepts.length, 1);
      assert.strictEqual(insights.reviewedConcepts[0].conceptId, 'c-consensus');
      assert.strictEqual(insights.unvisitedConcepts.length, 2);
    });

    test('distinguishes reading/visited alone from assessed with demonstrated understanding', () => {
      // c-consensus visited with NO questions answered
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.strictEqual(insights.assessedCount, 0);
      assert.strictEqual(insights.demonstratedCount, 0);
      assert.strictEqual(insights.unassessedVisitedCount, 1);
      // Status must be in-progress, never understanding-demonstrated
      assert.strictEqual(insights.reviewedConcepts[0].masteryStatus, 'in-progress');
      assert.strictEqual(insights.reviewedConcepts[0].wasAssessed, false);
    });

    test('records demonstrated understanding when verified formative checks exist', () => {
      // Save verified correct attempt for c-consensus
      const correctCheck: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-consensus',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-1',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Accurate concept mastery.',
              explanation: 'Consensus ensures safety.',
              correctAnswer: 'opt-1'
            },
            attemptedAt: '2026-10-14T05:10:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:10:00.000Z'
      };
      saveStoredKnowledgeCheck(correctCheck);

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.strictEqual(insights.assessedCount, 1);
      assert.strictEqual(insights.demonstratedCount, 1);
      assert.strictEqual(insights.demonstratedConcepts.length, 1);
      assert.strictEqual(insights.demonstratedConcepts[0].conceptId, 'c-consensus');
      assert.strictEqual(insights.demonstratedConcepts[0].masteryStatus, 'understanding-demonstrated');
    });

    test('accurately identifies concepts needing review from failed attempts', () => {
      // Save failed attempt for c-consensus
      const failedCheck: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-consensus',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-bad',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Incorrect understanding of Byzantine faults.',
              explanation: 'Consensus requires quorum.',
              correctAnswer: 'opt-good'
            },
            attemptedAt: '2026-10-14T05:10:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:10:00.000Z'
      };
      saveStoredKnowledgeCheck(failedCheck);

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.strictEqual(insights.needsReviewCount, 1);
      assert.strictEqual(insights.revisitConcepts.length, 1);
      assert.strictEqual(insights.revisitConcepts[0].conceptId, 'c-consensus');
      assert.strictEqual(insights.revisitConcepts[0].masteryStatus, 'needs-review');
    });

    test('marks session completed only when all concepts in the sequence have been visited', () => {
      const fullSession: RevisionSessionState = {
        ...mockSession,
        reviewedConceptIds: ['c-consensus', 'c-raft', 'c-bft'],
        currentIndex: 2,
        currentConceptId: 'c-bft'
      };

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: fullSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.strictEqual(insights.visitedCount, 3);
      assert.strictEqual(insights.unvisitedCount, 0);
      assert.strictEqual(insights.isCompleted, true);
    });

    test('generates transparent observation notes for unassessed and partial sessions', () => {
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.ok(insights.notes && insights.notes.length > 0);
      assert.ok(insights.notes.some(n => n.includes('formative assessment')));
      assert.ok(insights.notes.some(n => n.includes('remain unvisited')));
    });
  });

  /* ====================================================================
   * SUITE 2: Actionable Next Steps Derivation
   * ==================================================================== */
  describe('2. Actionable Next Steps Derivation', () => {
    test('prioritizes reviewing difficult concepts when needs-review concepts exist', () => {
      // Save failed attempt
      const failedCheck: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-consensus',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-bad',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Incorrect.',
              explanation: 'Exp',
              correctAnswer: 'opt-good'
            },
            attemptedAt: '2026-10-14T05:10:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:10:00.000Z'
      };
      saveStoredKnowledgeCheck(failedCheck);

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      const primaryAction = insights.nextActions.find(a => a.isPrimary);
      assert.ok(primaryAction);
      assert.strictEqual(primaryAction.type, 'review-difficult');
      assert.strictEqual(primaryAction.conceptId, 'c-consensus');
      assert.strictEqual(primaryAction.conceptIndex, 0);
    });

    test('suggests continuing with the next unvisited concept when no difficulties exist', () => {
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      const primaryAction = insights.nextActions.find(a => a.isPrimary);
      assert.ok(primaryAction);
      assert.strictEqual(primaryAction.type, 'continue-sequence');
      assert.strictEqual(primaryAction.conceptId, 'c-raft');
    });

    test('always provides return-to-graph and complete-session actions', () => {
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      assert.ok(insights.nextActions.some(a => a.type === 'return-graph'));
      assert.ok(insights.nextActions.some(a => a.type === 'finish-session'));
    });
  });

  /* ====================================================================
   * SUITE 3: Component Rendering & Accessibility
   * ==================================================================== */
  describe('3. RevisionSessionInsights Component Rendering', () => {
    test('renders minimal editorial header and non-gamified metrics', () => {
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
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
      assert.ok(html.includes('• REVISION / SESSION INSIGHTS'));
      assert.ok(html.includes('Revision Session Summary.'));
      assert.ok(html.includes('CONCEPTS VISITED'));
      assert.ok(html.includes('DEMONSTRATED'));
      assert.ok(html.includes('NEEDS REVIEW'));
      assert.ok(html.includes('FORMALLY ASSESSED'));
      assert.ok(html.includes('Resume revision'));
      // No gamified words or badges
      assert.ok(!html.includes('Trophy'));
      assert.ok(!html.includes('Badge'));
      assert.ok(!html.includes('Confetti'));
    });

    test('renders completed session title when isCompleted is true', () => {
      const fullSession: RevisionSessionState = {
        ...mockSession,
        reviewedConceptIds: ['c-consensus', 'c-raft', 'c-bft']
      };

      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: fullSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      const html = renderToString(
        React.createElement(RevisionSessionInsights, {
          insights,
          onSelectConcept: () => {},
          onReturnToGraph: () => {}
        })
      );

      assert.ok(html.includes('Revision Session Complete.'));
    });

    test('renders concepts to revisit, demonstrated, and reviewed sections', () => {
      const insights = deriveRevisionSessionInsights({
        graph: mockGraph,
        session: mockSession,
        concepts: mockGraph.nodes.map(n => ({ id: n.id, name: n.name }))
      });

      const html = renderToString(
        React.createElement(RevisionSessionInsights, {
          insights,
          onSelectConcept: () => {},
          onResumeRevision: () => {},
          onReturnToGraph: () => {}
        })
      );

      assert.ok(html.includes('Concepts to Revisit'));
      assert.ok(html.includes('Understanding Demonstrated'));
      assert.ok(html.includes('All Concepts Visited'));
      assert.ok(html.includes('Suggested Next Steps'));
    });
  });

  /* ====================================================================
   * SUITE 4: RevisionWorkspace Integration & Intentional Completion
   * ==================================================================== */
  describe('4. RevisionWorkspace Integration & Intentional Completion', () => {
    test('does NOT open session summary automatically when navigating concepts', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          session: mockSession,
          explanation: mockExplanation,
          onNext: () => {},
          onPrevious: () => {},
          onExit: () => {},
          onSelectConcept: () => {}
        })
      );

      // Session insights container must NOT be visible by default
      assert.ok(!html.includes('revision-insights-container'));
      assert.ok(html.includes('revision-concept-canvas'));
      assert.ok(html.includes('Session insights'));
    });

    test('renders Complete session button on the last concept', () => {
      const lastSession: RevisionSessionState = {
        ...mockSession,
        currentIndex: 2,
        currentConceptId: 'c-bft'
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          session: lastSession,
          explanation: mockExplanation,
          onNext: () => {},
          onPrevious: () => {},
          onExit: () => {},
          onSelectConcept: () => {}
        })
      );

      assert.ok(html.includes('Complete session'));
      assert.ok(html.includes('revision-complete-session-action'));
    });

    test('session state is preserved when returning to knowledge graph', () => {
      saveRevisionSession(mockSession, 'graph-distributed-systems');
      const loaded = loadRevisionSession('graph-distributed-systems');

      assert.ok(loaded);
      assert.strictEqual(loaded.graphId, 'graph-distributed-systems');
      assert.strictEqual(loaded.currentIndex, 0);
      assert.deepStrictEqual(loaded.reviewedConceptIds, ['c-consensus']);
    });

    test('clearing session resets stored revision state cleanly without polluting other graphs', () => {
      saveRevisionSession(mockSession, 'graph-distributed-systems');
      saveRevisionSession({ ...mockSession, graphId: 'graph-other' }, 'graph-other');

      clearRevisionSession('graph-distributed-systems');
      assert.strictEqual(loadRevisionSession('graph-distributed-systems'), null);
      assert.ok(loadRevisionSession('graph-other'));
    });
  });

  /* ====================================================================
   * SUITE 5: Swiss-Editorial CSS Integrity & Accessibility
   * ==================================================================== */
  describe('5. Swiss-Editorial CSS Integrity & Accessibility', () => {
    test('enforces zero linear gradients in revision.css', () => {
      const gradientMatches = cssContent.match(/linear-gradient/gi);
      assert.strictEqual(
        gradientMatches,
        null,
        'revision.css must have ZERO linear-gradient definitions'
      );
    });

    test('enforces zero backdrop-filter blur in revision.css', () => {
      const backdropMatches = cssContent.match(/backdrop-filter:\s*blur/gi);
      assert.strictEqual(
        backdropMatches,
        null,
        'revision.css must have ZERO backdrop-filter blur definitions'
      );
    });

    test('verifies Section 13 session insights styles exist in revision.css', () => {
      assert.ok(cssContent.includes('.revision-insights-container'));
      assert.ok(cssContent.includes('.revision-insights-header'));
      assert.ok(cssContent.includes('.revision-insights-eyebrow'));
      assert.ok(cssContent.includes('.revision-insights-metrics-grid'));
      assert.ok(cssContent.includes('.revision-insights-metric-card'));
      assert.ok(cssContent.includes('.revision-insights-notes'));
      assert.ok(cssContent.includes('.revision-insights-section'));
      assert.ok(cssContent.includes('.revision-insights-row'));
      assert.ok(cssContent.includes('.revision-insights-action-card'));
    });

    test('includes reduced-motion support for insights animations', () => {
      assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'));
    });
  });
});
