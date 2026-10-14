import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import type { ConceptExplanation } from '../src/types/explanation';
import type { RevisionSessionState, ConceptPracticeState } from '../src/types/practice';
import type { ConceptKnowledgeCheckState, KnowledgeCheckAttempt } from '../src/types/knowledgeCheck';
import type { ConceptMasteryStatus } from '../src/types/mastery';
import {
  masteryStatusToPracticeStatus,
  practiceStatusToMasteryStatus
} from '../src/types/mastery';
import {
  formatMasteryLabel,
  calculateConceptMastery,
  loadGraphMasteryOverview,
  saveStoredMastery,
  loadStoredMastery,
  syncConceptMasteryToStorage,
  clearGraphMastery,
  getMasteryStorageKey
} from '../src/services/conceptMastery';
import { RevisionConceptOverview } from '../src/components/revision/RevisionConceptOverview';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import { loadConceptPracticeStates } from '../src/services/storage';

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

describe('GraphMind Feature: Concept Mastery Tracking (Phase 3 — Prompt 12)', { concurrency: 1 }, () => {
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
    description: 'Agreement on system state across distributed nodes.',
    sourceIds: ['src-consensus-paper']
  };

  const mockNode2: KnowledgeNode = {
    id: 'c-raft',
    name: 'Raft Consensus Algorithm',
    type: 'algorithm',
    description: 'Leader election and log replication consensus protocol.',
    sourceIds: ['src-raft-paper']
  };

  const mockNode3: KnowledgeNode = {
    id: 'c-bft',
    name: 'Byzantine Fault Tolerance',
    type: 'mechanism',
    description: 'Resilience against arbitrary malicious behaviors.',
    sourceIds: ['src-bft-paper']
  };

  const mockRel1: KnowledgeRelationship = {
    id: 'rel-consensus-to-raft',
    source: 'c-consensus',
    target: 'c-raft',
    relationType: 'prerequisite',
    description: 'Consensus theory precedes Raft algorithm.'
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-dist-systems',
    name: 'Distributed Systems Core',
    nodes: [mockNode1, mockNode2, mockNode3],
    relationships: [mockRel1],
    sources: []
  };

  const mockSession: RevisionSessionState = {
    isActive: true,
    graphId: 'graph-dist-systems',
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
    graphId: 'graph-dist-systems',
    title: 'Distributed Consensus Explained',
    overview: 'Consensus is fundamental to fault-tolerant distributed computing.',
    sections: [
      {
        id: 'sec-1',
        title: 'The Consensus Problem',
        content: 'Multiple processes must agree on a single data value.',
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
   * SUITE 1: Mastery State Definitions and Formatting
   * ==================================================================== */
  describe('1. Mastery State Definitions and Labels', () => {
    test('formats all four mastery states with concise, accessible plain text', () => {
      assert.strictEqual(formatMasteryLabel('not-started'), 'Not started');
      assert.strictEqual(formatMasteryLabel('in-progress'), 'In progress');
      assert.strictEqual(formatMasteryLabel('needs-review'), 'Needs review');
      assert.strictEqual(formatMasteryLabel('understanding-demonstrated'), 'Understanding demonstrated');
    });

    test('preserves backward compatibility with legacy practice statuses', () => {
      // masteryStatusToPracticeStatus
      assert.strictEqual(masteryStatusToPracticeStatus('not-started'), 'unseen');
      assert.strictEqual(masteryStatusToPracticeStatus('in-progress'), 'learning');
      assert.strictEqual(masteryStatusToPracticeStatus('needs-review'), 'needs-review');
      assert.strictEqual(masteryStatusToPracticeStatus('understanding-demonstrated'), 'understood');

      // practiceStatusToMasteryStatus
      assert.strictEqual(practiceStatusToMasteryStatus('unseen'), 'not-started');
      assert.strictEqual(practiceStatusToMasteryStatus('learning'), 'in-progress');
      assert.strictEqual(practiceStatusToMasteryStatus('needs-review'), 'needs-review');
      assert.strictEqual(practiceStatusToMasteryStatus('understood'), 'understanding-demonstrated');
    });
  });

  /* ====================================================================
   * SUITE 2: Deterministic Mastery Calculation Rules
   * ==================================================================== */
  describe('2. Deterministic Mastery Calculation Rules', () => {
    test('new concepts with no revision activity begin as not-started', () => {
      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: false,
        knowledgeCheckState: null
      });

      assert.strictEqual(summary.status, 'not-started');
      assert.strictEqual(summary.statusLabel, 'Not started');
      assert.strictEqual(summary.attemptCount, 0);
      assert.strictEqual(summary.correctCount, 0);
      assert.strictEqual(summary.incorrectCount, 0);
      assert.strictEqual(summary.consecutiveIncorrectCount, 0);
      assert.strictEqual(summary.evidenceSource, 'none');
    });

    test('reading or visiting an explanation alone transitions to in-progress, NEVER understanding demonstrated', () => {
      const visitedSummary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        knowledgeCheckState: null
      });

      assert.strictEqual(visitedSummary.status, 'in-progress');
      assert.strictEqual(visitedSummary.statusLabel, 'In progress');
      assert.strictEqual(visitedSummary.attemptCount, 0);
      assert.strictEqual(visitedSummary.evidenceSource, 'session-study');
      assert.notStrictEqual(visitedSummary.status, 'understanding-demonstrated');
    });

    test('a verified correct knowledge-check answer transitions to understanding-demonstrated', () => {
      const correctCheck: ConceptKnowledgeCheckState = {
        conceptId: 'c-consensus',
        graphId: 'graph-dist-systems',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-01',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Accurate and source-grounded.',
              explanation: 'Consensus ensures safety.',
              correctAnswer: 'opt-01'
            },
            attemptedAt: '2026-10-14T05:00:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:00:00.000Z'
      };

      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        knowledgeCheckState: correctCheck
      });

      assert.strictEqual(summary.status, 'understanding-demonstrated');
      assert.strictEqual(summary.statusLabel, 'Understanding demonstrated');
      assert.strictEqual(summary.attemptCount, 1);
      assert.strictEqual(summary.correctCount, 1);
      assert.strictEqual(summary.incorrectCount, 0);
      assert.strictEqual(summary.consecutiveIncorrectCount, 0);
      assert.strictEqual(summary.lastAttemptCorrect, true);
      assert.strictEqual(summary.evidenceSource, 'knowledge-check');
    });

    test('incorrect answers trigger needs-review status', () => {
      const failedCheck: ConceptKnowledgeCheckState = {
        conceptId: 'c-consensus',
        graphId: 'graph-dist-systems',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-03',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Incorrect premise regarding leader election.',
              explanation: 'Leader election requires quorum.',
              correctAnswer: 'opt-01'
            },
            attemptedAt: '2026-10-14T05:00:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:00:00.000Z'
      };

      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        knowledgeCheckState: failedCheck
      });

      assert.strictEqual(summary.status, 'needs-review');
      assert.strictEqual(summary.statusLabel, 'Needs review');
      assert.strictEqual(summary.attemptCount, 1);
      assert.strictEqual(summary.correctCount, 0);
      assert.strictEqual(summary.incorrectCount, 1);
      assert.strictEqual(summary.consecutiveIncorrectCount, 1);
      assert.strictEqual(summary.lastAttemptCorrect, false);
    });

    test('recovering after error updates consecutive errors and mastery', () => {
      const recoveredCheck: ConceptKnowledgeCheckState = {
        conceptId: 'c-consensus',
        graphId: 'graph-dist-systems',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 1,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'opt-wrong',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Wrong answer.',
              explanation: 'Explanation 1',
              correctAnswer: 'opt-right'
            },
            attemptedAt: '2026-10-14T04:00:00.000Z'
          },
          'q2': {
            questionId: 'q2',
            submittedAnswer: 'opt-right',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Correct understanding.',
              explanation: 'Explanation 2',
              correctAnswer: 'opt-right'
            },
            attemptedAt: '2026-10-14T05:00:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:00:00.000Z'
      };

      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        knowledgeCheckState: recoveredCheck
      });

      assert.strictEqual(summary.status, 'understanding-demonstrated');
      assert.strictEqual(summary.attemptCount, 2);
      assert.strictEqual(summary.correctCount, 1);
      assert.strictEqual(summary.incorrectCount, 1);
      // Latest attempt was correct, so consecutive incorrect count reset to 0
      assert.strictEqual(summary.consecutiveIncorrectCount, 0);
      assert.strictEqual(summary.lastAttemptCorrect, true);
    });

    test('uncertain AI-graded responses are treated conservatively as in-progress', () => {
      const uncertainCheck: ConceptKnowledgeCheckState = {
        conceptId: 'c-consensus',
        graphId: 'graph-dist-systems',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q1': {
            questionId: 'q1',
            submittedAnswer: 'Nodes vote on proposals',
            evaluation: {
              isCorrect: true,
              score: 0.8,
              evaluationConfidence: 'uncertain',
              feedback: 'Touches on relevant ideas, but confidence is uncertain.',
              explanation: 'Consensus involves voting.',
              correctAnswer: 'Agreement across nodes'
            },
            attemptedAt: '2026-10-14T05:00:00.000Z'
          }
        },
        updatedAt: '2026-10-14T05:00:00.000Z'
      };

      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        knowledgeCheckState: uncertainCheck
      });

      // Even though technically marked isCorrect: true, uncertain confidence forces in-progress
      assert.strictEqual(summary.status, 'in-progress');
      assert.strictEqual(summary.isUncertain, true);
      assert.match(summary.explanationSummary || '', /confidence is uncertain/i);
    });

    test('marked for review manually flags concept as needs-review', () => {
      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        isMarkedForReview: true,
        knowledgeCheckState: null
      });

      assert.strictEqual(summary.status, 'needs-review');
      assert.strictEqual(summary.statusLabel, 'Needs review');
    });

    test('legacy practice state is preserved when no new knowledge check exists', () => {
      const legacySummary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        practiceState: {
          conceptId: 'c-consensus',
          status: 'understood',
          practiceCount: 3,
          lastStudiedAt: '2026-10-13T00:00:00.000Z'
        },
        knowledgeCheckState: null
      });

      assert.strictEqual(legacySummary.status, 'understanding-demonstrated');
      assert.strictEqual(legacySummary.evidenceSource, 'legacy-practice');
      assert.strictEqual(legacySummary.attemptCount, 3);
    });
  });

  /* ====================================================================
   * SUITE 3: Graph Overview Aggregation & Storage Isolation
   * ==================================================================== */
  describe('3. Graph Overview Aggregation & Storage Isolation', () => {
    test('computes graph-wide mastery overview with correct category counts', () => {
      const overview = loadGraphMasteryOverview(
        'graph-dist-systems',
        mockGraph.nodes.map(n => ({ id: n.id, name: n.name })),
        mockSession
      );

      assert.strictEqual(overview.graphId, 'graph-dist-systems');
      assert.strictEqual(overview.totalConcepts, 3);
      // c-consensus is in current session -> in-progress
      assert.ok(overview.inProgressCount >= 1);
      assert.strictEqual(typeof overview.needsReviewCount, 'number');
      assert.strictEqual(typeof overview.understandingDemonstratedCount, 'number');
      assert.strictEqual(typeof overview.notStartedCount, 'number');
    });

    test('isolates mastery storage strictly by graph ID and concept ID', () => {
      const summaryA = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-A',
        isVisitedInSession: false,
        knowledgeCheckState: null
      });

      const summaryB = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-B',
        isVisitedInSession: true,
        knowledgeCheckState: null
      });

      saveStoredMastery('graph-A', summaryA);
      saveStoredMastery('graph-B', summaryB);

      const loadedA = loadStoredMastery('graph-A', 'c-consensus');
      const loadedB = loadStoredMastery('graph-B', 'c-consensus');

      assert.strictEqual(loadedA?.status, 'not-started');
      assert.strictEqual(loadedB?.status, 'in-progress');

      clearGraphMastery('graph-A');
      assert.strictEqual(loadStoredMastery('graph-A', 'c-consensus'), null);
      assert.strictEqual(loadStoredMastery('graph-B', 'c-consensus')?.status, 'in-progress');
    });

    test('syncConceptMasteryToStorage synchronizes with legacy practice state store', () => {
      const summary = calculateConceptMastery({
        conceptId: 'c-consensus',
        conceptName: 'Distributed Consensus',
        graphId: 'graph-dist-systems',
        isVisitedInSession: true,
        isMarkedForReview: true,
        knowledgeCheckState: null
      });

      assert.strictEqual(summary.status, 'needs-review');
      syncConceptMasteryToStorage('graph-dist-systems', summary);

      // Verify legacy practice state store is updated
      const states = loadConceptPracticeStates('graph-dist-systems');
      assert.strictEqual(states['c-consensus']?.status, 'needs-review');
    });

    test('handles corrupt or invalid storage data gracefully', () => {
      const corruptKey = getMasteryStorageKey('graph-err', 'c-err');
      localStorage.setItem(corruptKey, '{ INVALID_JSON_DATA %%%');

      const result = loadStoredMastery('graph-err', 'c-err');
      assert.strictEqual(result, null);
    });
  });

  /* ====================================================================
   * SUITE 4: Revision Concept Overview Component
   * ==================================================================== */
  describe('4. Revision Concept Overview Component', () => {
    test('renders overview drawer with counts and accessible labels', () => {
      const overview = loadGraphMasteryOverview(
        'graph-dist-systems',
        mockGraph.nodes.map(n => ({ id: n.id, name: n.name })),
        mockSession
      );

      const html = renderToString(
        React.createElement(RevisionConceptOverview, {
          overview,
          conceptList: mockGraph.nodes.map(n => ({ id: n.id, name: n.name })),
          currentConceptId: 'c-consensus',
          isOpen: true,
          onToggle: () => {},
          onSelectConcept: () => {}
        })
      );

      // Check drawer elements
      assert.ok(html.includes('revision-overview-drawer'));
      assert.ok(html.includes('CONCEPTS OVERVIEW'));
      assert.ok(html.includes('DEMONSTRATED'));
      assert.ok(html.includes('NEEDS REVIEW'));
      assert.ok(html.includes('IN PROGRESS'));
      assert.ok(html.includes('Distributed Consensus'));
      assert.ok(html.includes('Raft Consensus Algorithm'));
      assert.ok(html.includes('Byzantine Fault Tolerance'));
      // Accessible status pill
      assert.ok(html.includes('revision-overview-status-pill'));
      assert.ok(html.includes('Current'));
    });

    test('renders collapsed state cleanly without blocking workspace', () => {
      const overview = loadGraphMasteryOverview(
        'graph-dist-systems',
        mockGraph.nodes.map(n => ({ id: n.id, name: n.name })),
        mockSession
      );

      const html = renderToString(
        React.createElement(RevisionConceptOverview, {
          overview,
          conceptList: mockGraph.nodes.map(n => ({ id: n.id, name: n.name })),
          currentConceptId: 'c-consensus',
          isOpen: false,
          onToggle: () => {},
          onSelectConcept: () => {}
        })
      );

      assert.ok(html.includes('revision-overview-drawer'));
      assert.ok(html.includes('aria-expanded="false"'));
      // Drawer body content should not be present when closed
      assert.ok(!html.includes('revision-overview-summary-strip'));
      assert.ok(!html.includes('revision-overview-list'));
    });
  });

  /* ====================================================================
   * SUITE 5: RevisionWorkspace Integration
   * ==================================================================== */
  describe('5. RevisionWorkspace Integration', () => {
    test('renders inline concept mastery indicator in badge header with text and dot', () => {
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

      // Check inline mastery badge
      assert.ok(html.includes('revision-concept-mastery-tag'), 'Inline mastery tag rendered');
      assert.ok(html.includes('revision-mastery-dot'), 'Status dot rendered');
      assert.ok(html.includes('aria-label="Concept mastery:'), 'Accessible aria-label on tag');
      // Concept is visited in session with explanation -> In progress
      assert.ok(html.includes('In progress'), 'Displays concise text label');
      // Overview toggle bar is removed per Revision Workspace Simplification
      assert.ok(!html.includes('revision-overview-toggle-bar'), 'Concept overview toggle bar is removed');
      assert.ok(!html.includes('CONCEPTS OVERVIEW'), 'Concepts overview strip is removed');
    });

    test('does not communicate mastery by color alone', () => {
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

      // Every mastery element must have accompanying readable text label
      assert.ok(html.includes('In progress'));
      assert.ok(!html.includes('CONCEPTS OVERVIEW'), 'Concepts overview strip is removed');
    });
  });

  /* ====================================================================
   * SUITE 6: Swiss-Editorial CSS Integrity & Accessibility
   * ==================================================================== */
  describe('6. Swiss-Editorial CSS Integrity & Accessibility', () => {
    test('enforces zero linear gradients in revision.css', () => {
      const gradientMatches = cssContent.match(/linear-gradient/gi);
      assert.strictEqual(
        gradientMatches,
        null,
        'revision.css must have ZERO linear-gradient definitions to maintain strict Swiss-editorial discipline'
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

    test('verifies Section 12 mastery styles exist in revision.css', () => {
      assert.ok(cssContent.includes('.revision-concept-mastery-tag'));
      assert.ok(cssContent.includes('.revision-mastery-dot'));
      assert.ok(cssContent.includes('.revision-overview-drawer'));
      assert.ok(cssContent.includes('.revision-overview-toggle-bar'));
      assert.ok(cssContent.includes('.revision-overview-content'));
      assert.ok(cssContent.includes('.revision-overview-list'));
      assert.ok(cssContent.includes('.revision-overview-row'));
      assert.ok(cssContent.includes('.revision-overview-status-pill'));
    });

    test('includes reduced motion media queries for mastery drawer and animations', () => {
      assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'));
    });
  });
});
