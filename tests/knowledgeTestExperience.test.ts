import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { generateKnowledgeTest } from '../src/services/knowledgeTestGenerator';
import { 
  recordKnowledgeTestCompletion, 
  loadKnowledgeTests, 
  loadLatestKnowledgeTest,
  getConceptPracticeState,
  clearAllUserData
} from '../src/services/storage';
import { defaultKnowledgeGraph } from '../src/data/graphData';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('REAL TIMED MCQ TEST EXPERIENCE ARCHITECTURE', () => {
  beforeEach(() => {
    storageMap.clear();
    clearAllUserData();
  });

  describe('1. Test Generation & Authenticity', () => {
    it('rejects empty graph and returns no_graph error', () => {
      const result = generateKnowledgeTest(null);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'no_graph');
    });

    it('rejects graph with insufficient material and offers graceful failure', () => {
      const minimalGraph: KnowledgeGraph = {
        id: 'min-graph',
        nodes: [
          { id: 'c1', name: 'A', type: 'concept', description: 'Tiny', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      const result = generateKnowledgeTest(minimalGraph);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'insufficient_material');
      assert.strictEqual(result.message, 'Not enough material to create a full test yet.');
    });

    it('generates authentic grounded test from canonical knowledge graph', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 10 });
      assert.strictEqual(result.success, true);
      assert.ok(result.test, 'Test object should exist');

      const test = result.test!;
      assert.strictEqual(test.questions.length, 10, 'Should generate 10 questions by default');
      assert.strictEqual(test.timeLimitSeconds, 600, 'Should default to 10 minutes (600s)');
      assert.ok(result.conceptsCovered && result.conceptsCovered.length > 0);
    });

    it('formats exactly 4 options per question with 01, 02, 03, 04 slots', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.strictEqual(result.success, true);

      for (const q of result.test!.questions) {
        assert.strictEqual(q.options.length, 4, 'Each question must have exactly 4 options');
        assert.deepStrictEqual(
          q.options.map(o => o.id),
          ['01', '02', '03', '04'],
          'Options must be indexed 01 through 04'
        );
        assert.ok(
          ['01', '02', '03', '04'].includes(q.correctOptionId),
          'correctOptionId must point to one of the 4 slots'
        );
        const correctOpt = q.options.find(o => o.id === q.correctOptionId);
        assert.ok(correctOpt && correctOpt.text.length > 0, 'Correct option text must exist');
      }
    });

    it('generates diverse question types: concept, relationship, application, comparison', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 10 });
      assert.strictEqual(result.success, true);

      const typesFound = new Set(result.test!.questions.map(q => q.type));
      assert.ok(typesFound.has('concept'), 'Should generate concept understanding questions');
      assert.ok(typesFound.has('relationship') || typesFound.has('application'), 'Should generate relationship or application questions');
    });

    it('distributes questions across graph concepts without monopolizing a single node', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 10 });
      assert.strictEqual(result.success, true);

      const conceptCounts = new Map<string, number>();
      for (const q of result.test!.questions) {
        for (const cId of q.conceptIds) {
          conceptCounts.set(cId, (conceptCounts.get(cId) || 0) + 1);
        }
      }

      // No single concept should dominate all 10 questions
      for (const [, count] of conceptCounts) {
        assert.ok(count < 8, `Concept appeared ${count} times; questions must be distributed across graph`);
      }
    });

    it('verifies explanations and source excerpts are grounded in the graph material', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.strictEqual(result.success, true);

      for (const q of result.test!.questions) {
        assert.ok(q.explanation && q.explanation.length > 15, 'Explanation must be substantial');
        assert.ok(q.sourceName, 'Question must carry source provenance');
      }
    });
  });

  describe('2. Test Submission, Scoring & Weakness Identification', () => {
    it('calculates score, percentage, and separates strong concepts from review recommended', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.strictEqual(result.success, true);
      const test = result.test!;

      // Answer first 3 correctly, last 2 incorrectly
      const answers: Record<string, string> = {};
      test.questions.forEach((q, idx) => {
        if (idx < 3) {
          answers[q.id] = q.correctOptionId;
        } else {
          // pick a wrong option
          const wrongOpt = q.options.find(o => o.id !== q.correctOptionId);
          answers[q.id] = wrongOpt!.id;
        }
      });

      const summary = recordKnowledgeTestCompletion(test, answers, 240);

      assert.strictEqual(summary.score, 3);
      assert.strictEqual(summary.totalQuestions, 5);
      assert.strictEqual(summary.percentage, 60);
      assert.strictEqual(summary.timeSpentSeconds, 240);
      assert.strictEqual(summary.reviewRecommendedConcepts.length, 2);
      assert.ok(summary.strongConceptNames.length >= 2);
    });

    it('updates concept practice states: missed concepts marked as needs-review', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
      assert.strictEqual(result.success, true);
      const test = result.test!;

      // Intentionally miss the first question
      const missedQ = test.questions[0];
      const missedConceptId = missedQ.conceptIds[0];
      const wrongOpt = missedQ.options.find(o => o.id !== missedQ.correctOptionId)!;

      const answers: Record<string, string> = {
        [missedQ.id]: wrongOpt.id
      };

      recordKnowledgeTestCompletion(test, answers, 120);

      const state = getConceptPracticeState(missedConceptId, test.graphId);
      assert.strictEqual(state.status, 'needs-review', 'Missed concept should be marked for review');
    });

    it('persists completed test in test history and retrieves with loadLatestKnowledgeTest', () => {
      const result = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.strictEqual(result.success, true);
      const test = result.test!;

      const answers: Record<string, string> = {
        [test.questions[0].id]: test.questions[0].correctOptionId
      };

      recordKnowledgeTestCompletion(test, answers, 180);

      const history = loadKnowledgeTests(test.graphId);
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].id, test.id);
      assert.strictEqual(history[0].score, 1);

      const latest = loadLatestKnowledgeTest(test.graphId);
      assert.ok(latest);
      assert.strictEqual(latest?.id, test.id);
    });
  });

  describe('3. Operating Systems Domain Grounding Verification', () => {
    it('generates grounded test for OS concepts when provided', () => {
      const osGraph: KnowledgeGraph = {
        id: 'graph-os',
        name: 'Operating Systems',
        sources: [
          {
            id: 'src-os-notes',
            name: 'OS Concepts Ch 5: CPU Scheduling',
            type: 'text',
            createdAt: '2026-10-01'
          }
        ],
        nodes: [
          {
            id: 'cpu-sched',
            name: 'CPU Scheduling',
            type: 'process',
            description: 'The process of selecting which ready process gets allocated CPU cores.',
            evidence: 'CPU scheduling is the basis of multiprogrammed operating systems where the OS allocates CPU to ready processes.',
            sourceIds: ['src-os-notes']
          },
          {
            id: 'waiting-time',
            name: 'Waiting Time',
            type: 'metric',
            description: 'The total amount of time a process spends waiting in the ready queue.',
            evidence: 'Waiting time is the sum of periods spent waiting in the ready queue before CPU bursts.',
            sourceIds: ['src-os-notes']
          },
          {
            id: 'turnaround-time',
            name: 'Turnaround Time',
            type: 'metric',
            description: 'The interval from the time of submission of a process to the time of completion.',
            evidence: 'Turnaround time measures the entire lifecycle elapsed from submission to final termination.',
            sourceIds: ['src-os-notes']
          },
          {
            id: 'sjf',
            name: 'Shortest Job First',
            type: 'algorithm',
            description: 'A scheduling algorithm that associates with each process the length of its next CPU burst.',
            evidence: 'SJF selects the process with the shortest burst time, providing provably minimal average waiting time.',
            sourceIds: ['src-os-notes']
          },
          {
            id: 'round-robin',
            name: 'Round Robin',
            type: 'algorithm',
            description: 'A preemptive scheduling algorithm where each process receives a small unit of CPU time called a quantum.',
            evidence: 'Round robin allocates a fixed time quantum per process in circular queue order.',
            sourceIds: ['src-os-notes']
          }
        ],
        relationships: [
          {
            id: 'rel-sched-wait',
            source: 'cpu-sched',
            target: 'waiting-time',
            type: 'evaluates',
            label: 'evaluated by',
            description: 'CPU scheduling algorithms are evaluated using waiting time criteria.',
            sourceChunkIds: []
          },
          {
            id: 'rel-sjf-wait',
            source: 'sjf',
            target: 'waiting-time',
            type: 'minimizes',
            label: 'optimizes',
            description: 'Shortest Job First minimizes average waiting time across processes.',
            sourceChunkIds: []
          }
        ]
      };

      const result = generateKnowledgeTest(osGraph, { questionCount: 5 });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.test?.title, 'Operating Systems');
      assert.ok(result.test?.questions.length === 5);

      for (const q of result.test!.questions) {
        assert.strictEqual(q.options.length, 4);
        assert.ok(q.explanation.length > 0);
      }
    });
  });
});
