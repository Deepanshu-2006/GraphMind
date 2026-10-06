import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
  hasSufficientMaterial, 
  generateCandidateQuestions, 
  getPracticeQuestionForConcept, 
  evaluateAnswer 
} from '../src/services/practiceQuestionGenerator';
import { 
  loadConceptPracticeStates, 
  saveConceptPracticeStates, 
  updateConceptPracticeState, 
  getConceptPracticeState,
  clearAllUserData
} from '../src/services/storage';
import type { QuestionGenerationContext, PracticeQuestion } from '../src/types/practice';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('GraphMind Phase 2: Practice Mode - Contextual Practice System', () => {

  describe('1. Insufficient Material & Error Safeguards (Section 3 & 29)', () => {
    test('returns false for hasSufficientMaterial when concept lacks evidence and description', () => {
      const emptyContext: QuestionGenerationContext = {
        conceptId: 'sparse-concept',
        conceptName: 'Sparse Concept',
        description: '',
        evidence: '',
        relationships: []
      };

      assert.equal(hasSufficientMaterial(emptyContext), false);
      assert.equal(getPracticeQuestionForConcept(emptyContext), null);
    });

    test('returns null rather than inventing facts when source material is insufficient', () => {
      const minimalContext: QuestionGenerationContext = {
        conceptId: 'vague-concept',
        conceptName: 'Vague Concept',
        description: 'Short.',
        evidence: 'Too brief',
        relationships: []
      };

      const question = getPracticeQuestionForConcept(minimalContext);
      assert.equal(question, null, 'Must NOT generate question from insufficient source material');
    });
  });

  describe('2. Grounded Question Generation Types (Section 4–10)', () => {
    const osContext: QuestionGenerationContext = {
      conceptId: 'round-robin',
      conceptName: 'Round Robin',
      category: 'Method',
      description: 'A preemptive CPU scheduling algorithm that allocates a fixed time quantum to each ready process.',
      evidence: 'Round Robin scheduling assigns each ready process a fixed time quantum before switching to the next process in the ready queue.',
      page: 12,
      sourceName: 'Operating Systems Unit 1.pdf',
      relationships: [
        {
          id: 'rel-cpu-rr',
          type: 'uses',
          targetId: 'cpu-scheduling',
          targetName: 'CPU Scheduling',
          direction: 'incoming',
          description: 'CPU scheduling uses Round Robin for fair time-sharing'
        }
      ],
      neighborConcepts: [
        {
          id: 'fcfs',
          name: 'First-Come, First-Served',
          description: 'A non-preemptive algorithm executing processes strictly in arrival order.'
        }
      ],
      allGraphConcepts: [
        { id: 'cpu-scheduling', name: 'CPU Scheduling' },
        { id: 'fcfs', name: 'First-Come, First-Served' },
        { id: 'sjf', name: 'Shortest Job First' },
        { id: 'priority', name: 'Priority Scheduling' },
        { id: 'round-robin', name: 'Round Robin' }
      ]
    };

    test('generates multiple candidate question types from authentic material', () => {
      const candidates = generateCandidateQuestions(osContext);
      assert.ok(candidates.length >= 2, `Expected at least 2 question candidates, got ${candidates.length}`);

      const types = candidates.map(c => c.type);
      assert.ok(types.includes('concept-relationship'), 'Should generate concept-relationship question');
      assert.ok(types.includes('multiple-choice'), 'Should generate multiple-choice question');
      assert.ok(types.includes('true-false'), 'Should generate true-false question');
    });

    test('concept-relationship question derives correct answer strictly from graph edge', () => {
      const candidates = generateCandidateQuestions(osContext);
      const relQuestion = candidates.find(c => c.type === 'concept-relationship');

      assert.ok(relQuestion, 'Relationship question must exist');
      assert.match(relQuestion.question, /relationship between/i);
      assert.ok(relQuestion.options && relQuestion.options.length >= 2);
      assert.equal(relQuestion.correctAnswer, 'CPU Scheduling uses Round Robin');
      assert.equal(relQuestion.sourceName, 'Operating Systems Unit 1.pdf');
      assert.equal(relQuestion.page, 12);
    });

    test('multiple-choice options use actual graph concepts as distractors', () => {
      const candidates = generateCandidateQuestions(osContext);
      const mcq = candidates.find(c => c.type === 'multiple-choice');

      assert.ok(mcq, 'Multiple-choice question must exist');
      assert.ok(mcq.options && mcq.options.length === 4);
      assert.ok(mcq.options.includes('Round Robin'));

      // Verify distractors are real concepts from allGraphConcepts (FCFS, SJF, Priority Scheduling)
      const distractors = mcq.options.filter(opt => opt !== 'Round Robin');
      for (const distractor of distractors) {
        assert.ok(
          osContext.allGraphConcepts?.some(c => c.name === distractor),
          `Distractor "${distractor}" must be a real concept from the user's graph`
        );
      }
    });

    test('preserves authentic page number without fabrication', () => {
      const candidates = generateCandidateQuestions(osContext);
      for (const q of candidates) {
        assert.equal(q.page, 12, 'Page number must match source metadata');
      }

      // Test with concept that has no page
      const noPageContext: QuestionGenerationContext = {
        ...osContext,
        page: undefined
      };
      const noPageCandidates = generateCandidateQuestions(noPageContext);
      for (const q of noPageCandidates) {
        assert.equal(q.page, undefined, 'Must not fabricate page numbers when absent');
      }
    });

    test('numerical-procedural questions are generated when evidence contains numbers or formulas', () => {
      const numericalContext: QuestionGenerationContext = {
        conceptId: 'mirror-formula',
        conceptName: 'Mirror Formula',
        category: 'Formula',
        description: 'Relationship between object distance u, image distance v, and focal length f.',
        evidence: 'In spherical mirrors, 1/f = 1/v + 1/u where f is focal length, v is image distance, and u is object distance.',
        page: 165,
        sourceName: 'Physics Chapter 10.pdf'
      };

      const candidates = generateCandidateQuestions(numericalContext);
      const numQuestion = candidates.find(c => c.type === 'numerical-procedural');

      assert.ok(numQuestion, 'Numerical/procedural question should be generated when formula exists');
      assert.match(numQuestion.question, /1\/f = 1\/v \+ 1\/u/);
    });
  });

  describe('3. Question Deduplication (Section 21)', () => {
    const ctx: QuestionGenerationContext = {
      conceptId: 'cpu-scheduling',
      conceptName: 'CPU Scheduling',
      category: 'Concept',
      description: 'CPU scheduling is the basis of multi-programmed operating systems.',
      evidence: 'CPU scheduling decides which process runs on the CPU when multiple processes are ready.',
      page: 8,
      sourceName: 'OS.pdf',
      allGraphConcepts: [
        { id: 'cpu-scheduling', name: 'CPU Scheduling' },
        { id: 'throughput', name: 'Throughput' },
        { id: 'turnaround', name: 'Turnaround Time' }
      ]
    };

    test('cycles to next unpracticed question when previous question ID was answered', () => {
      const firstQ = getPracticeQuestionForConcept(ctx);
      assert.ok(firstQ);

      const secondQ = getPracticeQuestionForConcept(ctx, [firstQ.id]);
      assert.ok(secondQ);
      assert.notEqual(firstQ.id, secondQ.id, 'Second practice session must provide a different question');
    });

    test('reuses existing question cleanly when all available candidates have been practiced', () => {
      const allCandidates = generateCandidateQuestions(ctx);
      const allIds = allCandidates.map(c => c.id);

      const repeatedQ = getPracticeQuestionForConcept(ctx, allIds);
      assert.ok(repeatedQ);
      assert.ok(allIds.includes(repeatedQ.id), 'Should cleanly cycle rather than fabricating fake questions');
    });
  });

  describe('4. Answer Evaluation (Section 11–14)', () => {
    test('accurately evaluates multiple-choice answers', () => {
      const mcq: PracticeQuestion = {
        id: 'q-mcq-test',
        conceptId: 'rr',
        conceptName: 'Round Robin',
        type: 'multiple-choice',
        question: 'Which algorithm uses a time slice?',
        options: ['FCFS', 'Round Robin', 'SJF'],
        correctAnswer: 'Round Robin',
        explanation: 'Round Robin assigns a time slice.'
      };

      const correct = evaluateAnswer(mcq, 'Round Robin');
      assert.equal(correct.isCorrect, true);

      const wrong = evaluateAnswer(mcq, 'FCFS');
      assert.equal(wrong.isCorrect, false);

      const empty = evaluateAnswer(mcq, '');
      assert.equal(empty.isCorrect, false);
    });

    test('evaluates short-answer questions semantically without rigid punctuation matching', () => {
      const sa: PracticeQuestion = {
        id: 'q-sa-test',
        conceptId: 'rr',
        conceptName: 'Round Robin',
        type: 'short-answer',
        question: 'What is Round Robin?',
        correctAnswer: 'A preemptive scheduling algorithm using a fixed time quantum for ready processes.',
        explanation: 'Round Robin uses a fixed time quantum.'
      };

      // Semantic answer containing core concepts
      const studentMatch = evaluateAnswer(sa, 'preemptive scheduling with time quantum for processes');
      assert.equal(studentMatch.isCorrect, true);

      // Completely unrelated answer
      const studentMiss = evaluateAnswer(sa, 'unrelated memory paging mechanism');
      assert.equal(studentMiss.isCorrect, false);
    });
  });

  describe('5. Practice State Persistence (Section 16–18)', () => {
    const testGraphId = 'graph-test-practice-suite';

    test('persists and loads practice status (unseen, learning, needs-review, understood)', () => {
      // Clear any prior test artifacts
      saveConceptPracticeStates({}, testGraphId);

      // Default state is unseen
      const initial = getConceptPracticeState('rr-node', testGraphId);
      assert.equal(initial.status, 'unseen');
      assert.equal(initial.practiceCount, 0);

      // Update to 'learning' upon answering
      updateConceptPracticeState('rr-node', 'learning', testGraphId);
      const learningState = getConceptPracticeState('rr-node', testGraphId);
      assert.equal(learningState.status, 'learning');
      assert.equal(learningState.practiceCount, 1);
      assert.ok(learningState.lastPracticedAt);

      // Student clicks AGAIN -> 'needs-review'
      updateConceptPracticeState('rr-node', 'needs-review', testGraphId);
      const reviewState = getConceptPracticeState('rr-node', testGraphId);
      assert.equal(reviewState.status, 'needs-review');
      assert.equal(reviewState.practiceCount, 2);

      // Student clicks GOT IT -> 'understood'
      updateConceptPracticeState('rr-node', 'understood', testGraphId);
      const understoodState = getConceptPracticeState('rr-node', testGraphId);
      assert.equal(understoodState.status, 'understood');
      assert.equal(understoodState.practiceCount, 3);
    });

    test('retains distinct practice states for multiple concepts in a graph', () => {
      updateConceptPracticeState('c1', 'understood', testGraphId);
      updateConceptPracticeState('c2', 'needs-review', testGraphId);
      updateConceptPracticeState('c3', 'learning', testGraphId);

      const allStates = loadConceptPracticeStates(testGraphId);
      assert.equal(allStates['c1']?.status, 'understood');
      assert.equal(allStates['c2']?.status, 'needs-review');
      assert.equal(allStates['c3']?.status, 'learning');
    });
  });
});
