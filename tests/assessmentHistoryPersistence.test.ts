import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { generateKnowledgeTest } from '../src/services/knowledgeTestGenerator';
import {
  recordKnowledgeTestCompletion,
  clearAllUserData
} from '../src/services/storage';
import {
  getAssessmentAttempts,
  getAssessmentAttemptById,
  saveAssessmentAttempt,
  clearAssessmentHistory,
  AssessmentPersistenceError,
  AssessmentAccessDeniedError,
  ASSESSMENT_HISTORY_STORAGE_KEY
} from '../src/services/assessmentHistory';
import {
  setCurrentUser,
  clearCurrentUser,
  getCurrentUserId,
  DEFAULT_LOCAL_USER_ID
} from '../src/services/auth';
import { defaultKnowledgeGraph } from '../src/data/graphData';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { KnowledgeTest } from '../src/types/test';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
let shouldSimulateQuotaExceeded = false;

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => {
    if (shouldSimulateQuotaExceeded) {
      throw new Error('QuotaExceededError: The quota has been exceeded.');
    }
    storageMap.set(key, String(val));
  },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('GRAPHMIND PHASE 1 — PERSISTENT ASSESSMENT HISTORY VERIFICATION', () => {
  beforeEach(() => {
    storageMap.clear();
    shouldSimulateQuotaExceeded = false;
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  it('1. Completes an assessment and verifies that a complete attempt record is saved', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    assert.strictEqual(testGen.success, true);
    const test = testGen.test!;

    // Select answers for all 5 questions: 3 correct, 2 incorrect
    const answers: Record<string, string> = {};
    answers[test.questions[0].id] = test.questions[0].correctOptionId;
    answers[test.questions[1].id] = test.questions[1].correctOptionId;
    answers[test.questions[2].id] = test.questions[2].correctOptionId;
    // For questions 3 & 4 pick a distractor option
    const q3Distractor = test.questions[3].options.find(o => o.id !== test.questions[3].correctOptionId)!.id;
    answers[test.questions[3].id] = q3Distractor;
    const q4Distractor = test.questions[4].options.find(o => o.id !== test.questions[4].correctOptionId)!.id;
    answers[test.questions[4].id] = q4Distractor;

    const summary = recordKnowledgeTestCompletion(test, answers, 145, {
      completionReason: 'submission',
      graphName: defaultKnowledgeGraph.name
    });

    assert.strictEqual(summary.score, 3);
    assert.strictEqual(summary.totalQuestions, 5);
    assert.strictEqual(summary.percentage, 60);
    assert.strictEqual(summary.persistenceStatus, 'saved');
    assert.ok(summary.attemptId, 'Must generate and return a unique attemptId');

    // Verify stored attempt in persistent history
    const attempts = getAssessmentAttempts();
    assert.strictEqual(attempts.length, 1, 'Exactly one attempt record should be saved');

    const saved = attempts[0];
    assert.strictEqual(saved.id, summary.attemptId);
    assert.strictEqual(saved.testId, test.id);
    assert.strictEqual(saved.graphId, test.graphId || 'default_graph');
    assert.ok(saved.graphName);
    assert.strictEqual(saved.correctAnswers, 3);
    assert.strictEqual(saved.totalQuestions, 5);
    assert.strictEqual(saved.scorePercentage, 60);
    assert.strictEqual(saved.timeSpentSeconds, 145);
    assert.strictEqual(saved.completionReason, 'submission');
    assert.strictEqual(saved.questions.length, 5);
    assert.deepStrictEqual(saved.userAnswers, answers);
    assert.ok(saved.createdAt);
    assert.ok(saved.completedAt);
    assert.ok(saved.conceptIds.length > 0);
  });

  it('2. Refreshes the page and retrieves the saved attempt across sessions', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
    const test = testGen.test!;
    const answers: Record<string, string> = {
      [test.questions[0].id]: test.questions[0].correctOptionId
    };

    const summary = recordKnowledgeTestCompletion(test, answers, 90, {
      completionReason: 'submission'
    });

    // Simulate page refresh / restart: verify raw storage contains valid JSON
    const rawStorage = storageMap.get(ASSESSMENT_HISTORY_STORAGE_KEY);
    assert.ok(rawStorage, 'Underlying storage key must be populated');

    // Retrieve via service interface
    const retrievedAttempts = getAssessmentAttempts();
    assert.strictEqual(retrievedAttempts.length, 1);
    assert.strictEqual(retrievedAttempts[0].id, summary.attemptId);

    // Retrieve individual attempt by ID
    const singleAttempt = getAssessmentAttemptById(summary.attemptId!);
    assert.ok(singleAttempt);
    assert.strictEqual(singleAttempt.id, summary.attemptId);
    assert.strictEqual(singleAttempt.correctAnswers, 1);
    assert.strictEqual(singleAttempt.totalQuestions, 4);
  });

  it('3. Completes multiple assessments on the same graph and verifies both attempts exist', () => {
    const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test1 = testGen1.test!;
    const test2 = testGen2.test!;

    // Ensure distinct test IDs
    test2.id = 'test-distinct-run-2';

    const summary1 = recordKnowledgeTestCompletion(test1, {}, 45, { completionReason: 'submission' });
    const summary2 = recordKnowledgeTestCompletion(test2, {}, 80, { completionReason: 'submission' });

    const attempts = getAssessmentAttempts({ graphId: test1.graphId || 'default_graph' });
    assert.strictEqual(attempts.length, 2, 'Both attempts must be preserved on the same graph');

    // Ordered newest first (summary2 completed after summary1)
    assert.strictEqual(attempts[0].id, summary2.attemptId);
    assert.strictEqual(attempts[1].id, summary1.attemptId);
  });

  it('4. Submits an assessment with unanswered questions without inventing answers', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test = testGen.test!;

    // Answer only question 0, leave questions 1..4 unanswered
    const partialAnswers: Record<string, string> = {
      [test.questions[0].id]: test.questions[0].correctOptionId
    };

    const summary = recordKnowledgeTestCompletion(test, partialAnswers, 60, {
      completionReason: 'submission'
    });

    assert.strictEqual(summary.score, 1);
    assert.strictEqual(summary.totalQuestions, 5);

    const attempt = getAssessmentAttemptById(summary.attemptId!);
    assert.ok(attempt);

    // Question 0 answered, questions 1..4 must NOT have invented answers
    assert.strictEqual(attempt.userAnswers[test.questions[0].id], test.questions[0].correctOptionId);
    assert.strictEqual(attempt.userAnswers[test.questions[1].id], undefined);
    assert.strictEqual(attempt.userAnswers[test.questions[2].id], undefined);
    assert.strictEqual(attempt.userAnswers[test.questions[3].id], undefined);
    assert.strictEqual(attempt.userAnswers[test.questions[4].id], undefined);

    // Check missed concepts representation: selectedOptionText is 'Unanswered'
    const missedQ1 = summary.reviewRecommendedConcepts.find(m => m.questionId === test.questions[1].id);
    assert.ok(missedQ1);
    assert.strictEqual(missedQ1.selectedOptionText, 'Unanswered');
  });

  it('5. Allows an assessment to expire and verifies that its attempt is saved with time_expired reason', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
    const test = testGen.test!;

    // Timeout occurs at full time limit: 600s
    const summary = recordKnowledgeTestCompletion(test, {}, test.timeLimitSeconds, {
      completionReason: 'time_expired'
    });

    assert.strictEqual(summary.persistenceStatus, 'saved');
    const attempt = getAssessmentAttemptById(summary.attemptId!);
    assert.ok(attempt);
    assert.strictEqual(attempt.completionReason, 'time_expired');
    assert.strictEqual(attempt.timeSpentSeconds, test.timeLimitSeconds);
  });

  it('6. Triggers submission more than once and verifies that only one record is created (deduplication)', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
    const test = testGen.test!;
    const answers = { [test.questions[0].id]: test.questions[0].correctOptionId };

    // First submission
    const summary1 = recordKnowledgeTestCompletion(test, answers, 100);
    // Duplicate submission with same test ID / attempt ID
    const summary2 = recordKnowledgeTestCompletion(test, answers, 100, {
      attemptId: summary1.attemptId
    });

    const attempts = getAssessmentAttempts();
    assert.strictEqual(attempts.length, 1, 'Duplicate submission must not create a duplicate attempt record');
    assert.strictEqual(attempts[0].id, summary1.attemptId);
  });

  it('7. Verifies that the stored score matches the results summary and questions evaluation', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
    const test = testGen.test!;

    // 2 correct out of 4 = 50%
    const answers = {
      [test.questions[0].id]: test.questions[0].correctOptionId,
      [test.questions[1].id]: test.questions[1].correctOptionId
    };

    const summary = recordKnowledgeTestCompletion(test, answers, 120);
    const attempt = getAssessmentAttemptById(summary.attemptId!);

    assert.ok(attempt);
    assert.strictEqual(attempt.correctAnswers, summary.score);
    assert.strictEqual(attempt.totalQuestions, summary.totalQuestions);
    assert.strictEqual(attempt.scorePercentage, summary.percentage);
    assert.strictEqual(attempt.scorePercentage, 50);
  });

  it('8. Verifies historical questions, choices, and explanations remain intact and immutable after subsequent graph edits', () => {
    // Clone graph to simulate mutations
    const mutableGraph: KnowledgeGraph = JSON.parse(JSON.stringify(defaultKnowledgeGraph));
    const testGen = generateKnowledgeTest(mutableGraph, { questionCount: 3 });
    const test = testGen.test!;

    const originalQuestionText = test.questions[0].question;
    const originalOption0Text = test.questions[0].options[0].text;
    const originalExplanation = test.questions[0].explanation;

    const summary = recordKnowledgeTestCompletion(test, {}, 50);

    // Now simulate later modifications to mutableGraph and test object
    test.questions[0].question = 'MUTATED QUESTION TEXT AFTER EDIT';
    test.questions[0].options[0].text = 'MUTATED OPTION TEXT';
    test.questions[0].explanation = 'MUTATED EXPLANATION';
    mutableGraph.nodes[0].name = 'RENAMED NODE';

    // Retrieve historical attempt
    const historicalAttempt = getAssessmentAttemptById(summary.attemptId!);
    assert.ok(historicalAttempt);

    // Stored historical snapshot must remain completely unaffected by subsequent changes
    assert.strictEqual(historicalAttempt.questions[0].question, originalQuestionText);
    assert.strictEqual(historicalAttempt.questions[0].options[0].text, originalOption0Text);
    assert.strictEqual(historicalAttempt.questions[0].explanation, originalExplanation);
  });

  it('9. Verifies authorization and ownership using user identity', () => {
    // User Alice completes a test
    setCurrentUser({ id: 'user-alice-123', email: 'alice@graphmind.ai', name: 'Alice' });
    assert.strictEqual(getCurrentUserId(), 'user-alice-123');

    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const testAlice = testGen.test!;
    const summaryAlice = recordKnowledgeTestCompletion(testAlice, {}, 60);

    // Alice can see her attempt
    const aliceAttempts = getAssessmentAttempts();
    assert.strictEqual(aliceAttempts.length, 1);
    assert.strictEqual(aliceAttempts[0].id, summaryAlice.attemptId);
    assert.strictEqual(aliceAttempts[0].userId, 'user-alice-123');

    // Switch to User Bob
    setCurrentUser({ id: 'user-bob-456', email: 'bob@graphmind.ai', name: 'Bob' });
    assert.strictEqual(getCurrentUserId(), 'user-bob-456');

    // Bob cannot see Alice's attempts in the list
    const bobAttempts = getAssessmentAttempts();
    assert.strictEqual(bobAttempts.length, 0, 'Bob must not see Alice attempts in history list');

    // Bob cannot fetch Alice's attempt directly by ID
    assert.throws(() => {
      getAssessmentAttemptById(summaryAlice.attemptId!);
    }, (err: any) => {
      return err instanceof AssessmentAccessDeniedError;
    }, 'Direct retrieval across user boundaries must throw AssessmentAccessDeniedError');
  });

  it('10. Simulates a persistence failure and confirms that the system does not falsely claim success', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;

    // Turn on simulated storage failure (e.g. QuotaExceededError or disk error)
    shouldSimulateQuotaExceeded = true;

    const summary = recordKnowledgeTestCompletion(test, {}, 45);

    // System must explicitly report failed status and not falsely claim success
    assert.strictEqual(summary.persistenceStatus, 'failed');
    assert.ok(summary.persistenceError, 'Must populate persistenceError description');
    assert.ok(summary.persistenceError.includes('quota') || summary.persistenceError.includes('storage'));
  });
});
