import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateActiveRecallQuestions,
  getActiveRecallQuestionForConcept,
  findNextRecallConceptId,
  hasSufficientMaterial
} from '../src/services/practiceQuestionGenerator';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import type { QuestionGenerationContext, ActiveRecallSessionState } from '../src/types/practice';
import type { GraphConceptData, KnowledgeRelationship } from '../src/types/graph';

describe('GraphMind Phase 4: Test Yourself / Active Recall', () => {

  const sampleOsContext: QuestionGenerationContext = {
    conceptId: 'concept-process',
    conceptName: 'Process',
    category: 'Core Primitive',
    description: 'A process is a program in execution, representing the fundamental unit of work in modern operating systems.',
    evidence: 'A process is an active entity with a program counter specifying the next instruction to execute and a set of associated resources.',
    page: 4,
    sourceName: 'Test.pdf',
    relationships: [
      {
        id: 'rel-process-sched',
        type: 'managed-by',
        targetId: 'concept-cpu-sched',
        targetName: 'CPU Scheduling',
        direction: 'outgoing',
        description: 'Processes in the ready queue are allocated CPU time by CPU Scheduling'
      },
      {
        id: 'rel-process-threads',
        type: 'contains',
        targetId: 'concept-threads',
        targetName: 'Threads',
        direction: 'outgoing',
        description: 'A process contains one or more execution threads sharing memory'
      }
    ],
    neighborConcepts: [
      {
        id: 'concept-cpu-sched',
        name: 'CPU Scheduling',
        description: 'Determines which ready process is allocated the CPU.'
      },
      {
        id: 'concept-threads',
        name: 'Threads',
        description: 'Lightweight execution units within a process.'
      }
    ],
    allGraphConcepts: [
      { id: 'concept-process', name: 'Process' },
      { id: 'concept-cpu-sched', name: 'CPU Scheduling' },
      { id: 'concept-threads', name: 'Threads' },
      { id: 'concept-deadlock', name: 'Deadlock' },
      { id: 'concept-virtual-mem', name: 'Virtual Memory' }
    ]
  };

  describe('1. Active Recall Question Generation (Section 3 & 4)', () => {

    test('generates Definition Recall question (Pattern A: "What is Process?")', () => {
      const questions = generateActiveRecallQuestions(sampleOsContext);
      assert.ok(questions.length > 0, 'Should generate active recall questions');

      const defQuestion = questions.find(q => q.pattern === 'definition');
      assert.ok(defQuestion, 'Must include definition recall question');
      assert.equal(defQuestion?.question, 'What is Process?');
      assert.ok(defQuestion?.answer.includes('program in execution'));
      assert.equal(defQuestion?.sourceName, 'Test.pdf');
      assert.equal(defQuestion?.page, 4);
    });

    test('generates Explanation Recall question (Pattern B)', () => {
      const schedContext: QuestionGenerationContext = {
        conceptId: 'concept-cpu-sched',
        conceptName: 'CPU Scheduling',
        category: 'Mechanism',
        description: 'CPU Scheduling is critical for maximizing CPU utilization and ensuring responsive multitasking across processes.',
        evidence: 'CPU scheduling forms the basis of multiprogrammed operating systems.',
        page: 7,
        sourceName: 'Test.pdf',
        relationships: []
      };

      const questions = generateActiveRecallQuestions(schedContext);
      const explQuestion = questions.find(q => q.pattern === 'explanation');
      assert.ok(explQuestion, 'Must include explanation recall question');
      assert.ok(
        explQuestion?.question.startsWith('Explain why CPU Scheduling is important') ||
        explQuestion?.question.startsWith('Explain the core role of CPU Scheduling')
      );
      assert.ok(explQuestion?.answer.includes('CPU Scheduling'));
    });

    test('generates Relationship Recall question (Pattern C)', () => {
      const questions = generateActiveRecallQuestions(sampleOsContext);
      const relQuestion = questions.find(q => q.pattern === 'relationship');
      assert.ok(relQuestion, 'Must include relationship recall question');
      assert.ok(
        relQuestion?.question.includes('relationship between Process and')
      );
      assert.ok(relQuestion?.answer.length > 0);
    });

    test('generates Connection Recall question (Pattern D)', () => {
      const questions = generateActiveRecallQuestions(sampleOsContext);
      const connQuestion = questions.find(q => q.pattern === 'connection');
      assert.ok(connQuestion, 'Must include connection recall question');
      assert.ok(
        connQuestion?.question.includes('Which concept is associated with Process through')
      );
      assert.ok(
        connQuestion?.answer.includes('CPU Scheduling') || connQuestion?.answer.includes('Threads')
      );
    });

    test('retrieves active recall question with answered question cycling', () => {
      const q1 = getActiveRecallQuestionForConcept(sampleOsContext, []);
      assert.ok(q1, 'Should return first question');

      const q2 = getActiveRecallQuestionForConcept(sampleOsContext, [q1!.id]);
      assert.ok(q2, 'Should return subsequent question');
      assert.notEqual(q2?.id, q1?.id, 'Should cycle to next question when available');
    });
  });

  describe('2. Empty / Insufficient Data Guardrail (Section 3 & 17)', () => {

    test('safeguard against empty concept: returns empty array without hallucinating', () => {
      const emptyContext: QuestionGenerationContext = {
        conceptId: 'concept-empty',
        conceptName: 'Empty Concept',
        description: '',
        evidence: '',
        relationships: []
      };

      assert.equal(hasSufficientMaterial(emptyContext), false);
      const questions = generateActiveRecallQuestions(emptyContext);
      assert.deepEqual(questions, []);
      assert.equal(getActiveRecallQuestionForConcept(emptyContext), null);
    });

    test('safeguard against trivial/stub concepts: returns null', () => {
      const stubContext: QuestionGenerationContext = {
        conceptId: 'concept-stub',
        conceptName: 'Stub Concept',
        description: 'Notes.',
        evidence: 'See doc.',
        relationships: []
      };

      assert.equal(hasSufficientMaterial(stubContext), false);
      assert.equal(getActiveRecallQuestionForConcept(stubContext), null);
    });
  });

  describe('3. Intelligent Next Concept Navigation (Section 11)', () => {

    const testGraphNodes: GraphConceptData[] = [
      {
        id: 'c-proc',
        name: 'Process',
        description: 'Core process',
        importance: 'core',
        relationshipCount: 2,
        directConnections: [
          { targetId: 'c-sched', targetName: 'CPU Scheduling', type: 'managed-by' },
          { targetId: 'c-thread', targetName: 'Threads', type: 'contains' }
        ]
      },
      {
        id: 'c-sched',
        name: 'CPU Scheduling',
        description: 'Scheduling unit',
        importance: 'core',
        relationshipCount: 1,
        directConnections: [{ targetId: 'c-proc', targetName: 'Process', type: 'manages' }]
      },
      {
        id: 'c-thread',
        name: 'Threads',
        description: 'Thread unit',
        importance: 'supporting',
        relationshipCount: 1,
        directConnections: [{ targetId: 'c-proc', targetName: 'Process', type: 'contained-by' }]
      },
      {
        id: 'c-deadlock',
        name: 'Deadlock',
        description: 'Deadlock state',
        importance: 'supporting',
        relationshipCount: 0,
        directConnections: []
      },
      {
        id: 'c-virtmem',
        name: 'Virtual Memory',
        description: 'Memory paging',
        importance: 'core',
        relationshipCount: 0,
        directConnections: []
      }
    ];

    test('prefers directly connected concepts that are not yet tested in the session', () => {
      const sessionState: ActiveRecallSessionState = {
        currentConceptId: 'c-proc',
        testedConceptIds: ['c-proc'],
        recalledConceptIds: ['c-proc'],
        reviewConceptIds: []
      };

      const nextId = findNextRecallConceptId('c-proc', testGraphNodes, sessionState);
      assert.ok(
        nextId === 'c-sched' || nextId === 'c-thread',
        `Should prioritize direct neighbors c-sched or c-thread, got ${nextId}`
      );
    });

    test('prefers directly connected review concept if untested neighbors are already tested', () => {
      const sessionState: ActiveRecallSessionState = {
        currentConceptId: 'c-proc',
        testedConceptIds: ['c-proc', 'c-sched', 'c-thread'],
        recalledConceptIds: ['c-proc', 'c-sched'],
        reviewConceptIds: ['c-thread'] // direct neighbor needing review
      };

      const nextId = findNextRecallConceptId('c-proc', testGraphNodes, sessionState);
      assert.equal(nextId, 'c-thread', 'Direct neighbor marked for review should take precedence');
    });

    test('moves to other untested graph concepts when direct neighbors are completed', () => {
      const sessionState: ActiveRecallSessionState = {
        currentConceptId: 'c-proc',
        testedConceptIds: ['c-proc', 'c-sched', 'c-thread'],
        recalledConceptIds: ['c-proc', 'c-sched', 'c-thread'],
        reviewConceptIds: []
      };

      const nextId = findNextRecallConceptId('c-proc', testGraphNodes, sessionState);
      assert.ok(
        nextId === 'c-deadlock' || nextId === 'c-virtmem',
        `Should move to remaining untested nodes c-deadlock or c-virtmem, got ${nextId}`
      );
    });

    test('cycles back to session review concepts when all nodes have been tested', () => {
      const sessionState: ActiveRecallSessionState = {
        currentConceptId: 'c-proc',
        testedConceptIds: ['c-proc', 'c-sched', 'c-thread', 'c-deadlock', 'c-virtmem'],
        recalledConceptIds: ['c-proc', 'c-sched', 'c-deadlock', 'c-virtmem'],
        reviewConceptIds: ['c-thread']
      };

      const nextId = findNextRecallConceptId('c-proc', testGraphNodes, sessionState);
      assert.equal(nextId, 'c-thread', 'Should cycle to concept marked for review');
    });
  });

  describe('4. Graph Visual Feedback Integration (Section 2 & 10)', () => {

    const allNodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: GraphConceptData }> = [
      {
        id: 'c-proc',
        type: 'conceptNode',
        position: { x: 100, y: 100 },
        data: { id: 'c-proc', label: 'Process', code: 'PROC', importance: 'core', relationshipCount: 1, confidence: 90, synapses: 1 }
      },
      {
        id: 'c-sched',
        type: 'conceptNode',
        position: { x: 250, y: 100 },
        data: { id: 'c-sched', label: 'CPU Scheduling', code: 'SCHED', importance: 'core', relationshipCount: 1, confidence: 90, synapses: 1 }
      },
      {
        id: 'c-virtmem',
        type: 'conceptNode',
        position: { x: 400, y: 100 },
        data: { id: 'c-virtmem', label: 'Virtual Memory', code: 'VMEM', importance: 'core', relationshipCount: 0, confidence: 85, synapses: 0 }
      }
    ];

    const allEdges = [
      {
        id: 'r1',
        source: 'c-proc',
        target: 'c-sched',
        type: 'custom',
        data: { id: 'r1', relation: 'managed-by' }
      }
    ];

    test('tags visible nodes with isSessionRecalled and isSessionReview flags', () => {
      const result = calculateVisibleGraph({
        allNodes: allNodes as any,
        allEdges: allEdges as any,
        selectedNodeId: 'c-proc',
        densityMode: 'balanced',
        recalledConceptIds: ['c-proc', 'c-sched'],
        reviewConceptIds: ['c-virtmem']
      });

      const procNode = result.visibleNodes.find(n => n.id === 'c-proc');
      const schedNode = result.visibleNodes.find(n => n.id === 'c-sched');
      const virtNode = result.visibleNodes.find(n => n.id === 'c-virtmem');

      assert.equal(procNode?.data.isSessionRecalled, true);
      assert.equal(schedNode?.data.isSessionRecalled, true);
      assert.equal(virtNode?.data.isSessionReview, true);
    });

    test('preserves neighbor visibility while dimming unrelated concepts during recall', () => {
      const result = calculateVisibleGraph({
        allNodes: allNodes as any,
        allEdges: allEdges as any,
        selectedNodeId: 'c-proc',
        densityMode: 'balanced'
      });

      const procNode = result.visibleNodes.find(n => n.id === 'c-proc');
      const schedNode = result.visibleNodes.find(n => n.id === 'c-sched');
      const virtNode = result.visibleNodes.find(n => n.id === 'c-virtmem');

      assert.equal(procNode?.selected, true);
      assert.equal(schedNode?.data.highlighted, true, 'Connected neighbor remains highlighted/visible');
      assert.equal(virtNode?.data.dimmed, true, 'Unconnected concept is dimmed');
    });
  });
});
