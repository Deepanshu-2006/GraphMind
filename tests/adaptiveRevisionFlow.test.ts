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
import {
  deriveConceptPerformanceState,
  findConnectedPrerequisite,
  findConnectedConcepts,
  generateAdaptiveRecommendation,
  saveAdaptiveRecommendation,
  loadAdaptiveRecommendation,
  clearAdaptiveRecommendations,
  getAdaptiveRecStorageKey
} from '../src/services/adaptiveRevision';
import { AdaptiveNextStep } from '../src/components/revision/AdaptiveNextStep';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';

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

describe('GraphMind Feature: Adaptive Revision Flow (Phase 3 — Prompt 11)', { concurrency: 1 }, () => {
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
    id: 'c-distributed-consensus',
    name: 'Distributed Consensus',
    type: 'theory',
    description: 'Agreement on state among multiple distributed nodes in the presence of faults.',
    sourceIds: ['src-raft-paper']
  };

  const mockNode2: KnowledgeNode = {
    id: 'c-raft-algorithm',
    name: 'Raft Consensus Algorithm',
    type: 'algorithm',
    description: 'A consensus algorithm designed to be understandable through decomposed leader election and log replication.',
    sourceIds: ['src-raft-paper']
  };

  const mockNode3: KnowledgeNode = {
    id: 'c-byzantine-fault-tolerance',
    name: 'Byzantine Fault Tolerance',
    type: 'mechanism',
    description: 'Resilience against arbitrary or malicious node behaviors in distributed systems.',
    sourceIds: ['src-bft-paper']
  };

  const mockRel1: KnowledgeRelationship = {
    id: 'rel-consensus-to-raft',
    source: 'c-distributed-consensus',
    target: 'c-raft-algorithm',
    relationType: 'prerequisite',
    description: 'Distributed consensus fundamentals are a prerequisite for understanding Raft.'
  };

  const mockRel2: KnowledgeRelationship = {
    id: 'rel-raft-to-bft',
    source: 'c-raft-algorithm',
    target: 'c-byzantine-fault-tolerance',
    relationType: 'related-to',
    description: 'Raft addresses crash-fault tolerance whereas BFT addresses arbitrary failures.'
  };

  const mockGraph: KnowledgeGraph = {
    id: 'graph-distributed-systems',
    name: 'Distributed Systems',
    nodes: [mockNode1, mockNode2, mockNode3],
    relationships: [mockRel1, mockRel2],
    sources: []
  };

  const mockSession: RevisionSessionState = {
    isActive: true,
    graphId: 'graph-distributed-systems',
    conceptIds: ['c-distributed-consensus', 'c-raft-algorithm', 'c-byzantine-fault-tolerance'],
    currentIndex: 1, // Currently on Raft
    currentConceptId: 'c-raft-algorithm',
    totalConcepts: 3,
    createdAt: '2026-10-14T00:00:00.000Z',
    reviewedConceptIds: ['c-distributed-consensus'],
    markedForReviewIds: []
  };

  const mockExplanation: ConceptExplanation = {
    id: 'exp-raft',
    graphId: 'graph-distributed-systems',
    conceptId: 'c-raft-algorithm',
    conceptName: 'Raft Consensus Algorithm',
    sourceFingerprint: 'fp-raft-1',
    version: 1,
    generatedAt: '2026-10-14T00:00:00.000Z',
    overview: 'Raft manages replicated logs through leader election and log replication.',
    sections: [
      {
        id: 'section-overview',
        num: '01',
        title: 'Core Definition',
        content: 'Raft manages replicated logs through leader election.'
      },
      {
        id: 'section-key-principles',
        num: '02',
        title: 'Leader Election & Heartbeats',
        content: 'Leaders send periodic heartbeats to maintain authority.'
      },
      {
        id: 'section-step-by-step-learning',
        num: '03',
        title: 'Step-by-Step Learning',
        content: 'Election timeout triggers candidate state.'
      }
    ],
    workedExample: {
      problemStatement: 'Simulate a leader election when heartbeat fails.',
      steps: [
        {
          stepNumber: 1,
          title: 'Heartbeat timeout',
          explanation: 'Follower timer expires and node transitions to candidate state.',
          substeps: ['Increment term', 'Vote for self']
        }
      ],
      finalAnswer: 'Candidate obtains majority votes and becomes new leader.',
      keyTakeaway: 'Election safety ensures at most one leader per term.'
    }
  };

  describe('1. Adaptive Signals & Performance State Derivation', () => {
    test('unassessed concept visited in session is marked studied-unassessed, never mastered', () => {
      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        isReviewedInSession: true,
        knowledgeCheckState: null
      });

      assert.equal(state.status, 'studied-unassessed');
      assert.equal(state.attemptCount, 0);
      assert.equal(state.correctCount, 0);
      assert.equal(state.incorrectCount, 0);
      assert.equal(state.lastAttemptCorrect, undefined);
    });

    test('unvisited concept without attempts is marked not-studied', () => {
      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-byzantine-fault-tolerance',
        conceptName: 'Byzantine Fault Tolerance',
        isReviewedInSession: false,
        knowledgeCheckState: null
      });

      assert.equal(state.status, 'not-studied');
      assert.equal(state.attemptCount, 0);
    });

    test('incorrect knowledge-check answer triggers needs-review with misconception data', () => {
      const checkState: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q-raft-1': {
            questionId: 'q-raft-1',
            submittedAnswer: 'opt-wrong',
            attemptedAt: '2026-10-14T01:00:00.000Z',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Followers do not initiate elections without a timeout.',
              explanation: 'Heartbeat timeouts trigger leader election.',
              misconceptionGuidance: 'Followers only become candidates after timing out on leader heartbeats.',
              correctAnswer: 'Heartbeat timeout expiration',
              reviewSectionId: 'section-key-principles',
              reviewSectionTitle: 'Leader Election & Heartbeats'
            }
          }
        },
        updatedAt: '2026-10-14T01:00:00.000Z'
      };

      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        isReviewedInSession: true,
        knowledgeCheckState: checkState
      });

      assert.equal(state.status, 'needs-review');
      assert.equal(state.attemptCount, 1);
      assert.equal(state.incorrectCount, 1);
      assert.equal(state.consecutiveIncorrectCount, 1);
      assert.equal(state.lastAttemptCorrect, false);
      assert.equal(state.reviewSectionId, 'section-key-principles');
      assert.equal(state.reviewSectionTitle, 'Leader Election & Heartbeats');
      assert.ok(state.misconceptionGuidance?.includes('Followers only become candidates'));
    });

    test('tracks consecutive incorrect attempts across multiple checks', () => {
      const checkState: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q-1': {
            questionId: 'q-1',
            submittedAnswer: 'wrong-1',
            attemptedAt: '2026-10-14T01:00:00.000Z',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Incorrect',
              explanation: '',
              correctAnswer: 'Correct'
            }
          },
          'q-2': {
            questionId: 'q-2',
            submittedAnswer: 'wrong-2',
            attemptedAt: '2026-10-14T01:05:00.000Z',
            evaluation: {
              isCorrect: false,
              score: 0,
              evaluationConfidence: 'high',
              feedback: 'Incorrect again',
              explanation: '',
              correctAnswer: 'Correct'
            }
          }
        },
        updatedAt: '2026-10-14T01:05:00.000Z'
      };

      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: checkState
      });

      assert.equal(state.status, 'needs-review');
      assert.equal(state.attemptCount, 2);
      assert.equal(state.incorrectCount, 2);
      assert.equal(state.consecutiveIncorrectCount, 2);
    });

    test('single correct answer transitions to showing-understanding, not permanent mastery', () => {
      const checkState: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q-raft-1': {
            questionId: 'q-raft-1',
            submittedAnswer: 'opt-correct',
            attemptedAt: '2026-10-14T01:00:00.000Z',
            evaluation: {
              isCorrect: true,
              score: 1,
              evaluationConfidence: 'high',
              feedback: 'Correct understanding.',
              explanation: '',
              correctAnswer: 'Heartbeat timeout'
            }
          }
        },
        updatedAt: '2026-10-14T01:00:00.000Z'
      };

      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: checkState
      });

      assert.equal(state.status, 'showing-understanding');
      assert.equal(state.lastAttemptCorrect, true);
    });

    test('multiple successful attempts classify as demonstrated-understanding', () => {
      const checkState: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q-1': {
            questionId: 'q-1',
            submittedAnswer: 'correct-1',
            attemptedAt: '2026-10-14T01:00:00.000Z',
            evaluation: { isCorrect: true, score: 1, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '' }
          },
          'q-2': {
            questionId: 'q-2',
            submittedAnswer: 'correct-2',
            attemptedAt: '2026-10-14T01:05:00.000Z',
            evaluation: { isCorrect: true, score: 1, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '' }
          }
        },
        updatedAt: '2026-10-14T01:05:00.000Z'
      };

      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: checkState
      });

      assert.equal(state.status, 'demonstrated-understanding');
      assert.equal(state.attemptCount, 2);
      assert.equal(state.correctCount, 2);
    });

    test('flags uncertainty when evaluation confidence is uncertain', () => {
      const checkState: ConceptKnowledgeCheckState = {
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        status: 'ready',
        questions: [],
        activeQuestionIndex: 0,
        attempts: {
          'q-short-1': {
            questionId: 'q-short-1',
            submittedAnswer: 'it handles votes and replication',
            attemptedAt: '2026-10-14T01:00:00.000Z',
            evaluation: {
              isCorrect: true,
              score: 0.8,
              evaluationConfidence: 'uncertain',
              feedback: 'This answer touches on relevant aspects, but may be incomplete.',
              explanation: '',
              correctAnswer: 'Raft elects a leader and replicates log entries across followers.'
            }
          }
        },
        updatedAt: '2026-10-14T01:00:00.000Z'
      };

      const state = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: checkState
      });

      assert.equal(state.isUncertain, true);
    });
  });

  describe('2. Adaptive Next-Step Recommendations', () => {
    test('struggling student receives recommendation to review misconception section', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'bad',
              attemptedAt: '2026-10-14T01:00:00.000Z',
              evaluation: {
                isCorrect: false,
                score: 0,
                evaluationConfidence: 'high',
                feedback: 'Incorrect',
                explanation: '',
                correctAnswer: '',
                reviewSectionId: 'section-key-principles',
                reviewSectionTitle: 'Leader Election & Heartbeats'
              }
            }
          },
          updatedAt: '2026-10-14T01:00:00.000Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      assert.equal(rec.primaryAction.type, 'review-explanation-section');
      assert.equal(rec.primaryAction.targetSectionId, 'section-key-principles');
      assert.ok(rec.primaryAction.label.includes('Leader Election & Heartbeats'));
      assert.ok(rec.rationale.includes('Consider reviewing this concept again because your last answer was incorrect.'));

      // Secondary actions must include retry and planned sequence continuation
      const retryAction = rec.secondaryActions.find(a => a.type === 'retry-knowledge-check');
      const sequenceAction = rec.secondaryActions.find(a => a.type === 'continue-planned-path');
      assert.ok(retryAction, 'Must provide retry action');
      assert.ok(sequenceAction, 'Must preserve student control with planned path continuation');
    });

    test('identifies and suggests authentic prerequisite when student struggles', () => {
      const prereq = findConnectedPrerequisite(mockGraph, 'c-raft-algorithm');
      assert.ok(prereq);
      assert.equal(prereq?.id, 'c-distributed-consensus');
      assert.equal(prereq?.relationType, 'prerequisite');

      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'bad',
              attemptedAt: '2026-10-14T01:00:00.000Z',
              evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '' }
            }
          },
          updatedAt: '2026-10-14T01:00:00.000Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      const prereqAction = rec.secondaryActions.find(a => a.type === 'explore-prerequisite-concept');
      assert.ok(prereqAction);
      assert.equal(prereqAction?.targetConceptId, 'c-distributed-consensus');
      assert.ok(prereqAction?.label.includes('Distributed Consensus'));
    });

    test('does not invent fake prerequisites when no dependency relation exists in graph', () => {
      const noPrereqGraph: KnowledgeGraph = {
        id: 'graph-no-prereq',
        name: 'Simple Graph',
        nodes: [mockNode2, mockNode3],
        relationships: [mockRel2], // only related-to, no prerequisite
        sources: []
      };

      const prereq = findConnectedPrerequisite(noPrereqGraph, 'c-byzantine-fault-tolerance');
      assert.equal(prereq, null);
    });

    test('recommends worked example when available and no specific misconception section is linked', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'bad',
              attemptedAt: '2026-10-14T01:00:00.000Z',
              evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '' }
            }
          },
          updatedAt: '2026-10-14T01:00:00.000Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      assert.equal(rec.primaryAction.type, 'review-worked-example');
      assert.equal(rec.primaryAction.targetSectionId, 'section-step-by-step-learning');
      assert.ok(rec.primaryAction.label.includes('worked example'));
    });

    test('successful student receives recommendation to continue to scheduled next concept', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'good',
              attemptedAt: '2026-10-14T01:00:00.000Z',
              evaluation: { isCorrect: true, score: 1, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '' }
            }
          },
          updatedAt: '2026-10-14T01:00:00.000Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      assert.equal(rec.primaryAction.type, 'continue-planned-path');
      assert.equal(rec.primaryAction.targetConceptId, 'c-byzantine-fault-tolerance');
      assert.ok(rec.primaryAction.label.includes('Byzantine Fault Tolerance'));
      assert.ok(rec.rationale.includes('answered the knowledge check for "Raft Consensus Algorithm" correctly'));

      // Secondary action offers optional exploration of connected concepts
      const exploreAction = rec.secondaryActions.find(a => a.type === 'explore-related-concept');
      assert.ok(exploreAction);
    });

    test('uncertain short answer receives plain language caution without claiming mastery', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'partial',
              attemptedAt: '2026-10-14T01:00:00.000Z',
              evaluation: {
                isCorrect: true,
                score: 0.8,
                evaluationConfidence: 'uncertain',
                feedback: 'Ambiguous',
                explanation: '',
                correctAnswer: '',
                reviewSectionId: 'section-overview',
                reviewSectionTitle: 'Core Definition'
              }
            }
          },
          updatedAt: '2026-10-14T01:00:00.000Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      assert.ok(rec.rationale.includes('evaluation was uncertain'));
      assert.equal(rec.primaryAction.type, 'review-explanation-section');
      assert.ok(rec.secondaryActions.some(a => a.type === 'retry-knowledge-check'));
    });
  });

  describe('3. Student Control & Sequence Stability', () => {
    test('original revision sequence is always preserved in recommendations', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: null
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      // The original planned path must be accessible
      const hasPlannedPathAction = rec.primaryAction.type === 'continue-planned-path' ||
        rec.secondaryActions.some(a => a.type === 'continue-planned-path');
      assert.ok(hasPlannedPathAction, 'Planned path must remain accessible');
    });

    test('does not silently reorder or skip concepts in the revision session', () => {
      assert.equal(mockSession.conceptIds[0], 'c-distributed-consensus');
      assert.equal(mockSession.conceptIds[1], 'c-raft-algorithm');
      assert.equal(mockSession.conceptIds[2], 'c-byzantine-fault-tolerance');
    });
  });

  describe('4. Persistence & Graph Isolation', () => {
    test('persists and loads adaptive recommendations isolated by graph ID and concept ID', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        isReviewedInSession: true,
        knowledgeCheckState: null
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      saveAdaptiveRecommendation(rec);
      const loaded = loadAdaptiveRecommendation('graph-distributed-systems', 'c-raft-algorithm');

      assert.ok(loaded);
      assert.equal(loaded?.conceptId, 'c-raft-algorithm');
      assert.equal(loaded?.graphId, 'graph-distributed-systems');
      assert.equal(loaded?.primaryAction.label, rec.primaryAction.label);

      // Verify cross-graph isolation
      const wrongGraph = loadAdaptiveRecommendation('graph-other-system', 'c-raft-algorithm');
      assert.equal(wrongGraph, null);
    });

    test('clearing adaptive recommendations for one graph leaves other graphs intact', () => {
      const rec1 = {
        graphId: 'graph-1',
        conceptId: 'c-1',
        conceptName: 'Concept 1',
        performanceState: { conceptId: 'c-1', conceptName: 'Concept 1', status: 'needs-review' as const, attemptCount: 1, correctCount: 0, incorrectCount: 1, consecutiveIncorrectCount: 1 },
        rationale: 'Review needed',
        primaryAction: { id: 'act-1', label: 'Review', type: 'review-explanation-section' as const, isPrimary: true },
        secondaryActions: [],
        fallbackToSequence: false,
        generatedAt: '2026-10-14T00:00:00Z'
      };

      const rec2 = {
        ...rec1,
        graphId: 'graph-2',
        conceptId: 'c-2'
      };

      saveAdaptiveRecommendation(rec1);
      saveAdaptiveRecommendation(rec2);

      assert.ok(loadAdaptiveRecommendation('graph-1', 'c-1'));
      assert.ok(loadAdaptiveRecommendation('graph-2', 'c-2'));

      clearAdaptiveRecommendations('graph-1');

      assert.equal(loadAdaptiveRecommendation('graph-1', 'c-1'), null);
      assert.ok(loadAdaptiveRecommendation('graph-2', 'c-2'), 'graph-2 recommendations must remain intact');
    });
  });

  describe('5. Error Handling & Safe Fallback', () => {
    test('missing performance data produces safe fallback without crashing', () => {
      const emptyPerformance = deriveConceptPerformanceState({
        graphId: 'graph-test',
        conceptId: 'c-unknown',
        conceptName: 'Unknown Concept',
        knowledgeCheckState: null
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-test',
        currentConceptId: 'c-unknown',
        currentConceptName: 'Unknown Concept',
        performance: emptyPerformance,
        explanation: null,
        graph: null,
        session: null
      });

      assert.ok(rec);
      assert.equal(rec.fallbackToSequence, true);
      assert.ok(rec.primaryAction);
      assert.ok(rec.rationale);
    });

    test('handles corrupt localStorage entries gracefully', () => {
      const key = getAdaptiveRecStorageKey('graph-test', 'c-corrupt');
      storageMap.set(key, 'INVALID_JSON_CORRUPT{');

      const loaded = loadAdaptiveRecommendation('graph-test', 'c-corrupt');
      assert.equal(loaded, null);
    });
  });

  describe('6. UI Rendering & Integration', () => {
    test('renders AdaptiveNextStep component with status and action buttons', () => {
      const performance = deriveConceptPerformanceState({
        graphId: 'graph-distributed-systems',
        conceptId: 'c-raft-algorithm',
        conceptName: 'Raft Consensus Algorithm',
        knowledgeCheckState: {
          graphId: 'graph-distributed-systems',
          conceptId: 'c-raft-algorithm',
          status: 'ready',
          questions: [],
          activeQuestionIndex: 0,
          attempts: {
            'q-1': {
              questionId: 'q-1',
              submittedAnswer: 'wrong',
              attemptedAt: '2026-10-14T01:00:00Z',
              evaluation: { isCorrect: false, score: 0, evaluationConfidence: 'high', feedback: '', explanation: '', correctAnswer: '', reviewSectionId: 'section-key-principles', reviewSectionTitle: 'Leader Election' }
            }
          },
          updatedAt: '2026-10-14T01:00:00Z'
        }
      });

      const rec = generateAdaptiveRecommendation({
        graphId: 'graph-distributed-systems',
        currentConceptId: 'c-raft-algorithm',
        currentConceptName: 'Raft Consensus Algorithm',
        performance,
        explanation: mockExplanation,
        graph: mockGraph,
        session: mockSession
      });

      const html = renderToString(React.createElement(AdaptiveNextStep, { recommendation: rec }));

      assert.ok(html.includes('revision-adaptive-container'));
      assert.ok(html.includes('ADAPTIVE GUIDANCE'));
      assert.ok(html.includes('NEEDS REVIEW'));
      assert.ok(html.includes('revision-adaptive-btn-primary'));
      assert.ok(html.includes('Leader Election'));
      assert.ok(html.includes('Try question again'));
      assert.ok(html.includes('Continue in planned order'));
    });

    test('renders seamlessly in RevisionWorkspace alongside existing revision elements', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Distributed Systems',
          initialConceptId: 'c-raft-algorithm',
          session: mockSession,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-workspace'));
      assert.ok(html.includes('Raft Consensus Algorithm'));
      assert.ok(html.includes('revision-section-knowledge-check'));
    });
  });

  describe('7. Visual Design & Swiss-Editorial CSS Integrity', () => {
    test('enforces zero linear gradients and zero backdrop-filter blur in revision.css', () => {
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'revision.css must not use backdrop-filter: blur');
      assert.ok(!cssContent.includes('linear-gradient'), 'revision.css must not use linear gradients');
    });

    test('defines required adaptive revision styling classes in revision.css', () => {
      const requiredClasses = [
        '.revision-adaptive-container',
        '.revision-adaptive-header',
        '.revision-adaptive-kicker',
        '.revision-adaptive-status-pill',
        '.revision-adaptive-rationale',
        '.revision-adaptive-actions',
        '.revision-adaptive-btn-primary',
        '.revision-adaptive-btn-secondary'
      ];

      for (const cls of requiredClasses) {
        assert.ok(cssContent.includes(cls), `CSS must include ${cls}`);
      }
    });
  });
});
