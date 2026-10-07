import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateActiveRecallTestSession,
  getIntelligentDistractors,
  evaluateTestAnswer,
  generateTestSessionSummary,
  hasSufficientMaterial
} from '../src/services/practiceQuestionGenerator';
import type { Concept, Relationship } from '../src/types';

describe('GRAPHMIND — REAL ACTIVE RECALL / GRAPH-BASED TEST EXPERIENCE', () => {
  // Realistic Graph Fixture: CPU Scheduling domain from user specification
  const conceptsFixture: Concept[] = [
    {
      id: 'c-cpu-scheduling',
      name: 'CPU Scheduling',
      category: 'Process',
      description: 'The mechanism determining which process runs when the CPU becomes idle.',
      sourceEvidence: 'CPU scheduling deals with the problem of deciding which process gets allocated CPU time from the ready queue.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-1'],
      isCore: true
    },
    {
      id: 'c-waiting-time',
      name: 'Waiting Time',
      category: 'Metric',
      description: 'The amount of time a process spends waiting in the ready queue before execution.',
      sourceEvidence: 'Waiting time is the total period that a process spends residing in the ready queue awaiting CPU dispatch.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2'],
      isCore: true
    },
    {
      id: 'c-response-time',
      name: 'Response Time',
      category: 'Metric',
      description: 'The amount of time it takes from submission of a request until the first response is produced.',
      sourceEvidence: 'Response time measures the elapsed duration between job arrival and the very first output execution.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2'],
      isCore: false
    },
    {
      id: 'c-turnaround-time',
      name: 'Turnaround Time',
      category: 'Metric',
      description: 'The interval from the time of submission of a process to the time of completion.',
      sourceEvidence: 'Turnaround time comprises the interval spanning submission to final termination.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2'],
      isCore: false
    },
    {
      id: 'c-throughput',
      name: 'Throughput',
      category: 'Metric',
      description: 'The number of processes completed per unit time.',
      sourceEvidence: 'Throughput represents the operational count of completed jobs within a fixed observation window.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2'],
      isCore: false
    },
    {
      id: 'c-ready-queue',
      name: 'Ready Queue',
      category: 'Data Structure',
      description: 'Queue storing processes residing in memory waiting for execution assignment.',
      sourceEvidence: 'Processes ready and waiting to execute are placed in a list termed the ready queue.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-1'],
      isCore: false
    },
    {
      id: 'c-time-quantum',
      name: 'Time Quantum',
      category: 'Parameter',
      description: 'A small unit of time assigned to each process in Round Robin scheduling.',
      sourceEvidence: 'In round-robin algorithms, each process is granted a discrete time slice called a quantum.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-3'],
      isCore: false
    }
  ];

  const relationshipsFixture: Relationship[] = [
    {
      id: 'rel-1',
      sourceId: 'c-cpu-scheduling',
      targetId: 'c-waiting-time',
      type: 'measured-by',
      predicate: 'measured by',
      description: 'CPU scheduling performance is directly evaluated by waiting time metrics.',
      sourceEvidence: 'Scheduling algorithms are compared and assessed primarily based on minimum waiting time.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2']
    },
    {
      id: 'rel-2',
      sourceId: 'c-cpu-scheduling',
      targetId: 'c-turnaround-time',
      type: 'measured-by',
      predicate: 'measured by',
      description: 'Scheduling efficacy is gauged through turnaround time minimization.',
      sourceEvidence: 'A key scheduling criterion is minimizing turnaround time.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2']
    },
    {
      id: 'rel-3',
      sourceId: 'c-cpu-scheduling',
      targetId: 'c-ready-queue',
      type: 'uses',
      predicate: 'uses',
      description: 'CPU scheduler selects candidate processes queued inside the ready queue.',
      sourceEvidence: 'The scheduler extracts pending processes directly from the ready queue.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-1']
    },
    {
      id: 'rel-4',
      sourceId: 'c-cpu-scheduling',
      targetId: 'c-time-quantum',
      type: 'uses',
      predicate: 'uses',
      description: 'Preemptive scheduling models divide CPU intervals using time quantums.',
      sourceEvidence: 'Time quantums regulate CPU scheduling slices.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-3']
    },
    {
      id: 'rel-5',
      sourceId: 'c-waiting-time',
      targetId: 'c-ready-queue',
      type: 'accumulates-in',
      predicate: 'accumulates in',
      description: 'Waiting time accrues while the process resides in the ready queue.',
      sourceEvidence: 'Time spent in the ready queue contributes directly to total waiting time.',
      sourceIds: ['src-os-textbook'],
      sourceChunkIds: ['chunk-2']
    }
  ];

  describe('1. Intelligent Distractor Generation (Section 12)', () => {
    it('prioritizes concepts with the same category and shared source chunks', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const distractors = getIntelligentDistractors(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        3
      );

      assert.strictEqual(distractors.length, 3, 'Should generate requested number of distractors');
      
      // All distractors must NOT include the target concept itself
      distractors.forEach(d => {
        assert.notStrictEqual(d.id, waitingTime.id, 'Distractor must never be the target concept');
      });

      // Distractors should be other Metrics from chunk-2 (Response Time, Turnaround Time, Throughput)
      const distractorNames = distractors.map(d => d.name);
      const isMetric = distractors.filter(d => d.category === 'Metric').length;
      assert.ok(isMetric >= 2, 'Distractors must prefer same category (Metric)');
      assert.ok(
        distractorNames.includes('Response Time') ||
        distractorNames.includes('Turnaround Time') ||
        distractorNames.includes('Throughput'),
        'Distractors should match plausible domain alternatives'
      );
    });

    it('never invents concepts outside the user graph data', () => {
      const cpuSched = conceptsFixture.find(c => c.id === 'c-cpu-scheduling')!;
      const distractors = getIntelligentDistractors(
        cpuSched,
        conceptsFixture,
        relationshipsFixture,
        4
      );

      const knownIds = new Set(conceptsFixture.map(c => c.id));
      distractors.forEach(d => {
        assert.ok(knownIds.has(d.id), `Distractor ${d.name} (${d.id}) must exist in graph`);
      });
    });
  });

  describe('2. Multi-Type Question Generation (Section 2 Types A–F)', () => {
    it('generates a 5-question active recall test session grounded in graph data', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      );

      assert.ok(session !== null, 'Session must not be null');
      assert.strictEqual(session!.focusConceptId, 'c-waiting-time');
      assert.ok(session!.questions.length >= 1 && session!.questions.length <= 5, 'Session contains up to 5 questions');

      // Verify questions have valid options and a single correct answer
      session!.questions.forEach((q, idx) => {
        assert.ok(q.id, `Question ${idx} must have an id`);
        assert.ok(q.question.length > 5, `Question ${idx} must have substantial question text`);
        assert.ok(q.options && q.options.length >= 2, `Question ${idx} must have at least 2 options`);
        
        const correctOptions = q.options.filter(o => o.isCorrect);
        assert.strictEqual(correctOptions.length, 1, `Question ${idx} must have exactly 1 correct option`);
        assert.strictEqual(q.correctOptionId, correctOptions[0].id);

        // Options must have clean labels and IDs
        q.options.forEach(opt => {
          assert.ok(opt.label && opt.label.trim().length > 0, 'Option label must not be empty');
          assert.ok(opt.id, 'Option must have an id');
        });
      });
    });

    it('TYPE D & B: Generates Complete the Connection diagram with concealed target node', () => {
      const cpuSched = conceptsFixture.find(c => c.id === 'c-cpu-scheduling')!;
      const session = generateActiveRecallTestSession(
        cpuSched,
        conceptsFixture,
        relationshipsFixture,
        5
      );

      assert.ok(session !== null);
      const fillOrRelQuestion = session!.questions.find(
        q => q.questionType === 'fill-connection' || q.questionType === 'relationship'
      );

      assert.ok(fillOrRelQuestion, 'Should include a fill-connection or relationship question');
      assert.ok(fillOrRelQuestion!.diagram, 'Fill-connection question must provide an ASCII/editorial diagram structure');
      assert.strictEqual(fillOrRelQuestion!.diagram!.sourceName, 'CPU Scheduling');
      assert.ok(fillOrRelQuestion!.diagram!.relationshipLabel.length > 0);
      assert.strictEqual(fillOrRelQuestion!.diagram!.targetMystery, true);

      // Node concealment must target the missing concept or predicate
      assert.ok(
        fillOrRelQuestion!.concealedNodeId !== null || fillOrRelQuestion!.concealedEdgeId !== null,
        'Should identify concealed node or edge ID for canvas concealment'
      );
    });

    it('TYPE A: Generates Concept Understanding definition question instead of raw What is X', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      );

      const conceptQuestion = session!.questions.find(q => q.questionType === 'concept-understanding');
      if (conceptQuestion) {
        assert.ok(
          !conceptQuestion.question.startsWith('What is Waiting Time?'),
          'Must not use primitive "What is X?" template'
        );
        assert.ok(
          conceptQuestion.question.includes('What concept describes this?') ||
          conceptQuestion.question.includes('Which concept'),
          'Must use active-recall inquiry framing'
        );
      }
    });

    it('TYPE F: Grounded in Source Evidence provenance', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      );

      // Verify at least one question carries source provenance
      const provenancedQuestions = session!.questions.filter(q => Boolean(q.sourceEvidence));
      assert.ok(provenancedQuestions.length > 0, 'Questions should carry sourceEvidence provenance');
      provenancedQuestions.forEach(q => {
        assert.ok(q.sourceIds && q.sourceIds.length > 0, 'Must record sourceIds for verification');
      });
    });
  });

  describe('3. Answer Evaluation & Feedback (Sections 8, 9, 10)', () => {
    it('evaluates correct answer with restrained green confirmation and source quote', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      )!;

      const q = session.questions[0];
      const correctOption = q.options!.find(o => o.isCorrect)!;

      const evalResult = evaluateTestAnswer(q, correctOption.id);
      assert.strictEqual(evalResult.isCorrect, true);
      assert.strictEqual(evalResult.status, 'correct');
      assert.strictEqual(evalResult.feedbackText, "Connected. That's the relationship in your material.");
    });

    it('evaluates incorrect answer with restrained mismatch feedback and retry allowed', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      )!;

      const q = session.questions[0];
      const wrongOption = q.options!.find(o => !o.isCorrect)!;

      const evalResult = evaluateTestAnswer(q, wrongOption.id);
      assert.strictEqual(evalResult.isCorrect, false);
      assert.strictEqual(evalResult.status, 'incorrect');
      assert.strictEqual(evalResult.feedbackText, "This connection doesn't match your material.");
    });

    it('handles reveal action without counting revealed answer as correct', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        5
      )!;

      const q = session.questions[0];
      const evalResult = evaluateTestAnswer(q, undefined, true);
      assert.strictEqual(evalResult.isCorrect, false, 'Revealed answer is NOT counted as correct');
      assert.strictEqual(evalResult.status, 'revealed');
      assert.ok(evalResult.feedbackText.includes('Answer revealed'));
    });
  });

  describe('4. Session Completion & Missed Concepts Summary (Sections 17 & 18)', () => {
    it('generates restrained summary without XP, streaks, or fake statistics', () => {
      const waitingTime = conceptsFixture.find(c => c.id === 'c-waiting-time')!;
      const session = generateActiveRecallTestSession(
        waitingTime,
        conceptsFixture,
        relationshipsFixture,
        3
      )!;

      const answers = [
        {
          questionId: session.questions[0].id,
          selectedOptionId: session.questions[0].correctOptionId,
          isCorrect: true,
          wasRevealed: false
        },
        {
          questionId: session.questions[1].id,
          selectedOptionId: 'wrong-opt',
          isCorrect: false,
          wasRevealed: false
        },
        {
          questionId: session.questions[2].id,
          selectedOptionId: undefined,
          isCorrect: false,
          wasRevealed: true
        }
      ];

      const summary = generateTestSessionSummary(session, answers, conceptsFixture);
      assert.strictEqual(summary.totalQuestions, 3);
      assert.strictEqual(summary.understoodCount, 1);
      assert.ok(summary.missedConcepts.length >= 1, 'Must track missed concepts for review');

      // Check missed concept details
      const missed = summary.missedConcepts[0];
      assert.ok(missed.conceptId, 'Missed concept must have conceptId for canvas navigation');
      assert.ok(missed.conceptName, 'Missed concept must have conceptName');
    });
  });

  describe('5. Insufficient Data Safeguard (Section 22)', () => {
    it('returns null session when concept has insufficient connected material', () => {
      const isolatedConcept: Concept = {
        id: 'c-isolated',
        name: 'Isolated Term',
        category: 'Unknown'
      };

      const hasSufficient = hasSufficientMaterial(isolatedConcept, [isolatedConcept], []);
      assert.strictEqual(hasSufficient, false, 'Isolated concept should have insufficient material');

      const session = generateActiveRecallTestSession(
        isolatedConcept,
        [isolatedConcept],
        [],
        5
      );
      assert.strictEqual(session, null, 'Must never invent questions for isolated unsupported concepts');
    });
  });
});
