import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateRevisionPath } from '../src/services/revisionPathGenerator';
import {
  generateActiveRecallQuestions,
  getActiveRecallQuestionForConcept
} from '../src/services/practiceQuestionGenerator';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import type { QuestionGenerationContext } from '../src/types/practice';

describe('GraphMind Phase 5: Exam Preparation / Revision Mode', () => {

  // Realistic OS curriculum graph based on standard syllabus:
  // CPU Scheduling -> Process -> Time Quantum -> Round Robin -> Waiting Time
  const sampleNodes = [
    {
      id: 'c-cpu-sched',
      label: 'CPU Scheduling',
      name: 'CPU Scheduling',
      category: 'Core Primitive',
      importance: 'core',
      isCore: true,
      description: 'The process of selecting which ready process is allocated the CPU core.',
      evidence: 'CPU scheduling is the basis of multiprogrammed operating systems.',
      sources: [{ id: 's1', name: 'OperatingSystems.pdf', page: 12 }]
    },
    {
      id: 'c-process',
      label: 'Process',
      name: 'Process',
      category: 'Core Primitive',
      importance: 'core',
      isCore: true,
      description: 'A program in execution with associated resources and program counter.',
      evidence: 'A process is an active entity executing instructions in memory.',
      sources: [
        { id: 's1', name: 'OperatingSystems.pdf', page: 4 },
        { id: 's2', name: 'KernelArchitecture.pdf', page: 18 }
      ]
    },
    {
      id: 'c-time-quantum',
      label: 'Time Quantum',
      name: 'Time Quantum',
      category: 'Mechanism',
      importance: 'standard',
      description: 'A small unit of time allocated to each process in preemptive scheduling.',
      evidence: 'The period of time for which a process is allowed to run in a preemptive multitasking system is called the time quantum.',
      sources: [{ id: 's1', name: 'OperatingSystems.pdf', page: 15 }]
    },
    {
      id: 'c-round-robin',
      label: 'Round Robin',
      name: 'Round Robin',
      category: 'Algorithm',
      importance: 'standard',
      description: 'A preemptive scheduling algorithm that assigns a fixed time quantum per process.',
      evidence: 'Round Robin is designed specifically for time-sharing systems where processes are dispatched in FIFO order but preempted when the quantum expires.',
      sources: [{ id: 's1', name: 'OperatingSystems.pdf', page: 16 }]
    },
    {
      id: 'c-waiting-time',
      label: 'Waiting Time',
      name: 'Waiting Time',
      category: 'Metric',
      importance: 'standard',
      description: 'The sum of periods spent waiting in the ready queue.',
      evidence: 'Waiting time is the amount of time a process has been waiting in the ready queue.',
      sources: [{ id: 's1', name: 'OperatingSystems.pdf', page: 13 }]
    },
    {
      id: 'c-deadlock',
      label: 'Deadlock',
      name: 'Deadlock',
      category: 'Concurrency',
      importance: 'standard',
      description: 'A situation where a set of processes are blocked because each holds a resource and waits for another.',
      evidence: 'Deadlock occurs when four necessary conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait.',
      sources: [{ id: 's1', name: 'OperatingSystems.pdf', page: 32 }]
    }
  ];

  const sampleEdges = [
    {
      id: 'e-cpu-process',
      source: 'c-cpu-sched',
      target: 'c-process',
      label: 'allocates',
      data: { relationshipType: 'manages' }
    },
    {
      id: 'e-process-tq',
      source: 'c-process',
      target: 'c-time-quantum',
      label: 'receives',
      data: { relationshipType: 'constrained-by' }
    },
    {
      id: 'e-tq-rr',
      source: 'c-time-quantum',
      target: 'c-round-robin',
      label: 'defines',
      data: { relationshipType: 'defines-behavior-of' }
    },
    {
      id: 'e-rr-wt',
      source: 'c-round-robin',
      target: 'c-waiting-time',
      label: 'minimizes',
      data: { relationshipType: 'evaluates' }
    }
  ];

  describe('1. Revision Path Traversal along Actual Graph Relationships', () => {
    test('traces connected sequence following graph edges (CPU Scheduling -> Process -> Time Quantum -> Round Robin -> Waiting Time)', () => {
      const path = generateRevisionPath({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        startConceptId: 'c-cpu-sched',
        onlyReviewQueue: false
      });

      assert.ok(path.length >= 4, 'Should build a multi-step revision path');
      assert.strictEqual(path[0].conceptId, 'c-cpu-sched', 'First concept should be start anchor');
      assert.strictEqual(path[1].conceptId, 'c-process', 'Second concept should follow direct edge to Process');
      assert.strictEqual(path[2].conceptId, 'c-time-quantum', 'Third concept should follow edge to Time Quantum');
      assert.strictEqual(path[3].conceptId, 'c-round-robin', 'Fourth concept should follow edge to Round Robin');
    });

    test('prioritizes concepts marked "Review Again" / needs-review before unreviewed concepts', () => {
      const reviewQueue = new Set(['c-time-quantum']);
      const practiceStates = {
        'c-time-quantum': { status: 'needs-review' }
      };

      const path = generateRevisionPath({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        reviewConceptIds: reviewQueue,
        practiceStates,
        onlyReviewQueue: false
      });

      assert.ok(path.length > 0);
      assert.strictEqual(path[0].conceptId, 'c-time-quantum', 'Concept needing review should be prioritized as seed');
      assert.strictEqual(path[0].reason, 'marked-for-review');
    });

    test('prioritizes connected concepts adjacent to review concepts in next steps', () => {
      const reviewQueue = new Set(['c-time-quantum']);
      const path = generateRevisionPath({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        reviewConceptIds: reviewQueue,
        onlyReviewQueue: false
      });

      // Neighbors of Time Quantum are Process (incoming) and Round Robin (outgoing)
      const nextId = path[1]?.conceptId;
      assert.ok(
        nextId === 'c-round-robin' || nextId === 'c-process',
        `Step 2 should be a direct neighbor of Time Quantum, got: ${nextId}`
      );
      assert.strictEqual(path[1].reason, 'connected-concept');
    });

    test('returns empty list when onlyReviewQueue is true and nothing needs review (Section 18 Empty State)', () => {
      const emptyPath = generateRevisionPath({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        reviewConceptIds: new Set<string>(),
        practiceStates: {},
        onlyReviewQueue: true
      });

      assert.strictEqual(emptyPath.length, 0, 'Empty queue should return empty array to trigger "Nothing needs review yet"');
    });

    test('generates curriculum path from core concepts when starting revision from empty state', () => {
      const fullPath = generateRevisionPath({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        reviewConceptIds: new Set<string>(),
        practiceStates: {},
        onlyReviewQueue: false
      });

      assert.ok(fullPath.length > 0, 'Should generate revision sequence for exam prep');
      const firstNode = sampleNodes.find(n => n.id === fullPath[0].conceptId);
      assert.ok(
        firstNode?.importance === 'core' || firstNode?.isCore,
        'Should start from a core foundational concept'
      );
    });
  });

  describe('2. Exam-Focused Grounded Question Types (Section 11 & 12)', () => {
    test('generates direct definition questions ("Define Process.")', () => {
      const context: QuestionGenerationContext = {
        conceptId: 'c-process',
        conceptName: 'Process',
        category: 'Core Primitive',
        description: 'A process is a program in execution.',
        evidence: 'A process is an active entity executing instructions in memory.',
        page: 4,
        sourceName: 'OperatingSystems.pdf',
        relationships: []
      };

      const questions = generateActiveRecallQuestions(context);
      const defQuestion = questions.find(q => q.question.includes('Define Process'));
      assert.ok(defQuestion, 'Should include exam-style prompt: "Define Process."');
      assert.strictEqual(defQuestion?.pattern, 'definition');
      assert.ok(defQuestion?.passage?.includes('active entity') || defQuestion?.answer?.includes('active entity'));
      assert.strictEqual(defQuestion?.sourceName, 'OperatingSystems.pdf');
    });

    test('generates relational and role questions ("Explain the relationship between...", "What role does...")', () => {
      const context: QuestionGenerationContext = {
        conceptId: 'c-time-quantum',
        conceptName: 'Time Quantum',
        category: 'Mechanism',
        description: 'A small unit of time allocated to each process.',
        evidence: 'The time quantum sets the slice allocated in Round Robin.',
        page: 15,
        sourceName: 'OperatingSystems.pdf',
        relationships: [
          {
            id: 'e-tq-rr',
            type: 'defines-behavior-of',
            targetId: 'c-round-robin',
            targetName: 'Round Robin',
            direction: 'outgoing',
            description: 'Defines the time slice for Round Robin scheduling'
          }
        ]
      };

      const questions = generateActiveRecallQuestions(context);
      const relQuestion = questions.find(q => q.pattern === 'relationship');
      assert.ok(relQuestion, 'Should include relational exam question');
      assert.ok(relQuestion.question.includes('Round Robin'));
    });

    test('generates dependency exam prompt ("What concept depends on CPU Scheduling?")', () => {
      const context: QuestionGenerationContext = {
        conceptId: 'c-cpu-sched',
        conceptName: 'CPU Scheduling',
        category: 'Core Primitive',
        description: 'Allocates CPU cores to ready processes.',
        evidence: 'CPU scheduling allocates the processor to ready processes.',
        relationships: [
          {
            id: 'e-cpu-proc',
            type: 'manages',
            targetId: 'c-process',
            targetName: 'Process',
            direction: 'outgoing',
            description: 'Processes in the ready queue depend on CPU scheduling for execution'
          }
        ]
      };

      const questions = generateActiveRecallQuestions(context);
      const depQuestion = questions.find(q => q.question.includes('depends on') || q.question.includes('relationship'));
      assert.ok(depQuestion, 'Should include dependency or relational exam prompt');
    });

    test('preserves source provenance and page attribution on exam questions', () => {
      const context: QuestionGenerationContext = {
        conceptId: 'c-process',
        conceptName: 'Process',
        category: 'Core Primitive',
        description: 'A process is a program in execution.',
        evidence: 'A process is an active entity executing instructions in memory.',
        page: 4,
        sourceName: 'OperatingSystems.pdf'
      };

      const q = getActiveRecallQuestionForConcept(context);
      assert.ok(q);
      assert.strictEqual(q.sourceName, 'OperatingSystems.pdf');
      assert.strictEqual(q.page, 4);
    });
  });

  describe('3. Revision Visual Hierarchy in Viewport Calculation (Section 3, 14)', () => {
    test('marks current revision concept with isRevisionCurrent and focuses it', () => {
      const flowNodes = sampleNodes.map((n, i) => ({
        id: n.id,
        position: { x: i * 150, y: i * 80 },
        data: { label: n.label, name: n.name, category: n.category }
      }));

      const flowEdges = sampleEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data
      }));

      const result = calculateVisibleGraph({
        allNodes: flowNodes,
        allEdges: flowEdges,
        selectedNodeId: 'c-process',
        isRevisionMode: true,
        revisionCurrentConceptId: 'c-process',
        revisionVisitedConceptIds: new Set(['c-cpu-sched'])
      });

      const currentFlow = result.visibleNodes.find(n => n.id === 'c-process');
      assert.ok(currentFlow, 'Current node should be visible');
      assert.strictEqual(currentFlow.data.isRevisionCurrent, true, 'Current node should have isRevisionCurrent = true');
      assert.strictEqual(currentFlow.data.dimmed, false, 'Current node should not be dimmed');
    });

    test('keeps immediate connected neighbors normal and dims unrelated nodes', () => {
      const flowNodes = sampleNodes.map((n, i) => ({
        id: n.id,
        position: { x: i * 150, y: i * 80 },
        data: { label: n.label, name: n.name, category: n.category }
      }));

      const flowEdges = sampleEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data
      }));

      const result = calculateVisibleGraph({
        allNodes: flowNodes,
        allEdges: flowEdges,
        selectedNodeId: 'c-process',
        isRevisionMode: true,
        revisionCurrentConceptId: 'c-process',
        revisionVisitedConceptIds: new Set()
      });

      // Immediate neighbors of Process are CPU Scheduling and Time Quantum
      const neighborNode = result.visibleNodes.find(n => n.id === 'c-time-quantum');
      assert.ok(neighborNode);
      assert.strictEqual(neighborNode.data.dimmed, false, 'Direct neighbor should not be dimmed');

      // Unrelated concept Deadlock should be dimmed
      const unrelatedNode = result.visibleNodes.find(n => n.id === 'c-deadlock');
      assert.ok(unrelatedNode);
      assert.strictEqual(unrelatedNode.data.dimmed, true, 'Unrelated concept should be dimmed');
    });

    test('highlights incident edges with revision-active class', () => {
      const flowNodes = sampleNodes.map((n, i) => ({
        id: n.id,
        position: { x: i * 150, y: i * 80 },
        data: { label: n.label, name: n.name, category: n.category }
      }));

      const flowEdges = sampleEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data
      }));

      const result = calculateVisibleGraph({
        allNodes: flowNodes,
        allEdges: flowEdges,
        selectedNodeId: 'c-process',
        isRevisionMode: true,
        revisionCurrentConceptId: 'c-process',
        revisionVisitedConceptIds: new Set()
      });

      const incidentEdge = result.visibleEdges.find(e => e.source === 'c-process' || e.target === 'c-process');
      assert.ok(incidentEdge);
      assert.ok(
        incidentEdge.className?.includes('revision-active'),
        `Active revision edge should include revision-active class, got: ${incidentEdge.className}`
      );
    });

    test('quiets visited concepts with isRevisionPathVisited', () => {
      const flowNodes = sampleNodes.map((n, i) => ({
        id: n.id,
        position: { x: i * 150, y: i * 80 },
        data: { label: n.label, name: n.name, category: n.category }
      }));

      const flowEdges = sampleEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data
      }));

      const result = calculateVisibleGraph({
        allNodes: flowNodes,
        allEdges: flowEdges,
        selectedNodeId: 'c-process',
        isRevisionMode: true,
        revisionCurrentConceptId: 'c-process',
        revisionVisitedConceptIds: new Set(['c-cpu-sched'])
      });

      const visitedNode = result.visibleNodes.find(n => n.id === 'c-cpu-sched');
      assert.ok(visitedNode);
      assert.strictEqual(visitedNode.data.isRevisionPathVisited, true, 'Visited node should have isRevisionPathVisited = true');
    });
  });

  describe('4. Multi-Source Provenance Preservation (Section 19)', () => {
    test('concept referencing multiple sources preserves all sources and pages', () => {
      const multiSourceConcept = sampleNodes.find(n => n.id === 'c-process');
      assert.ok(multiSourceConcept);
      assert.strictEqual(multiSourceConcept.sources.length, 2, 'Process should have multiple sources');
      assert.strictEqual(multiSourceConcept.sources[0].name, 'OperatingSystems.pdf');
      assert.strictEqual(multiSourceConcept.sources[0].page, 4);
      assert.strictEqual(multiSourceConcept.sources[1].name, 'KernelArchitecture.pdf');
      assert.strictEqual(multiSourceConcept.sources[1].page, 18);
    });
  });
});
