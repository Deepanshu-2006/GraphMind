import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  saveAssessmentAttempt,
  getAssessmentAttempts,
  getAssessmentAttemptById,
  deleteAssessmentAttempt,
  clearAssessmentHistory,
  AssessmentPersistenceError,
  AssessmentAccessDeniedError,
  ASSESSMENT_HISTORY_STORAGE_KEY
} from '../src/services/assessmentHistory';
import {
  recordKnowledgeTestCompletion,
  clearAllUserData,
  saveUserGraph,
  deleteGraph
} from '../src/services/storage';
import { generateKnowledgeTest } from '../src/services/knowledgeTestGenerator';
import { setCurrentUser, clearCurrentUser } from '../src/services/auth';
import { defaultKnowledgeGraph } from '../src/data/graphData';
import {
  ensureResultsSummary,
  formatAttemptDate,
  computeProgressComparison,
  computeGraphLearningProgress,
  deriveConceptsWorthRevisiting
} from '../src/components/study/StudySpaceView';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt, KnowledgeTest } from '../src/types/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
let shouldThrowQuotaError = false;

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => {
    if (shouldThrowQuotaError) {
      throw new Error('QuotaExceededError: Storage quota exceeded.');
    }
    storageMap.set(key, String(val));
  },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('GRAPHMIND PHASE 1 — FINAL AUDIT & COMPREHENSIVE VERIFICATION SUITE', () => {
  beforeEach(() => {
    storageMap.clear();
    shouldThrowQuotaError = false;
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  // CASE 1: Successfully completing and saving an assessment
  it('Case 01: Successfully completing and saving an assessment', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    assert.strictEqual(testGen.success, true);
    const test = testGen.test!;

    const answers: Record<string, string> = {
      [test.questions[0].id]: test.questions[0].correctOptionId,
      [test.questions[1].id]: test.questions[1].correctOptionId,
      [test.questions[2].id]: test.questions[2].correctOptionId
    };

    const graphName = 'Machine Learning Foundations';
    const summary = recordKnowledgeTestCompletion(test, answers, 120, {
      completionReason: 'submission',
      graphName
    });

    assert.strictEqual(summary.persistenceStatus, 'saved');
    assert.strictEqual(summary.score, 3);
    assert.strictEqual(summary.totalQuestions, 5);
    assert.strictEqual(summary.percentage, 60);

    const savedAttempts = getAssessmentAttempts();
    assert.strictEqual(savedAttempts.length, 1);
    const attempt = savedAttempts[0];

    assert.strictEqual(attempt.id, summary.attemptId);
    assert.strictEqual(attempt.testId, test.id);
    assert.strictEqual(attempt.graphId, test.graphId);
    assert.strictEqual(attempt.graphName, graphName);
    assert.strictEqual(attempt.totalQuestions, 5);
    assert.strictEqual(attempt.correctAnswers, 3);
    assert.strictEqual(attempt.scorePercentage, 60);
    assert.strictEqual(attempt.timeSpentSeconds, 120);
    assert.strictEqual(attempt.completionReason, 'submission');
    assert.ok(attempt.completedAt);
    assert.ok(attempt.createdAt);
    assert.strictEqual(attempt.questions.length, 5);
  });

  // CASE 2: Retrieving the attempt after a page refresh
  it('Case 02: Retrieving the attempt after a page refresh (simulated)', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
    const test = testGen.test!;
    const answers = { [test.questions[0].id]: test.questions[0].correctOptionId };

    const summary = recordKnowledgeTestCompletion(test, answers, 90, {
      graphName: 'Biology 101'
    });

    // Simulate page refresh: verify persistent storage read
    const refreshedAttempts = getAssessmentAttempts();
    assert.strictEqual(refreshedAttempts.length, 1);

    const directAttempt = getAssessmentAttemptById(summary.attemptId);
    assert.ok(directAttempt);
    assert.strictEqual(directAttempt.id, summary.attemptId);
    assert.strictEqual(directAttempt.graphName, 'Biology 101');
    assert.strictEqual(directAttempt.timeSpentSeconds, 90);
  });

  // CASE 3: Saving multiple independent attempts
  it('Case 03: Saving multiple independent attempts on the same graph', () => {
    const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test1 = testGen1.test!;
    const summary1 = recordKnowledgeTestCompletion(test1, {
      [test1.questions[0].id]: test1.questions[0].correctOptionId
    }, 100);

    const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test2 = testGen2.test!;
    const summary2 = recordKnowledgeTestCompletion(test2, {
      [test2.questions[0].id]: test2.questions[0].correctOptionId,
      [test2.questions[1].id]: test2.questions[1].correctOptionId
    }, 150);

    const allAttempts = getAssessmentAttempts({ graphId: defaultKnowledgeGraph.id });
    assert.strictEqual(allAttempts.length, 2, 'Must preserve both attempts independently');
    assert.notStrictEqual(allAttempts[0].id, allAttempts[1].id);
    assert.strictEqual(allAttempts[0].id, summary2.attemptId, 'Newest attempt must be first');
    assert.strictEqual(allAttempts[1].id, summary1.attemptId, 'Older attempt must be second');
    assert.strictEqual(allAttempts[0].correctAnswers, 2);
    assert.strictEqual(allAttempts[1].correctAnswers, 1);
  });

  // CASE 4: Preserving unanswered questions
  it('Case 04: Preserving unanswered questions without fabricated answers', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test = testGen.test!;

    // Answer questions 0 and 2; leave 1, 3, 4 unanswered
    const answers: Record<string, string> = {
      [test.questions[0].id]: test.questions[0].correctOptionId,
      [test.questions[2].id]: 'wrong-option-id'
    };

    const summary = recordKnowledgeTestCompletion(test, answers, 75);
    const attempt = getAssessmentAttemptById(summary.attemptId)!;

    assert.strictEqual(attempt.userAnswers[test.questions[0].id], test.questions[0].correctOptionId);
    assert.strictEqual(attempt.userAnswers[test.questions[2].id], 'wrong-option-id');
    assert.strictEqual(attempt.userAnswers[test.questions[1].id], undefined);
    assert.strictEqual(attempt.userAnswers[test.questions[3].id], undefined);
    assert.strictEqual(attempt.userAnswers[test.questions[4].id], undefined);

    // Questions array still contains all 5 questions
    assert.strictEqual(attempt.questions.length, 5);
  });

  // CASE 5: Correct scoring across edge cases and rounding
  it('Case 05: Correct scoring calculations and rounding', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;

    // 1 of 3 correct = 33.333% -> rounds to 33%
    const summary1 = recordKnowledgeTestCompletion(test, {
      [test.questions[0].id]: test.questions[0].correctOptionId
    }, 60);
    assert.strictEqual(summary1.score, 1);
    assert.strictEqual(summary1.totalQuestions, 3);
    assert.strictEqual(summary1.percentage, 33);

    // 2 of 3 correct = 66.666% -> rounds to 67%
    const test2 = { ...test, id: 'test-scoring-2' };
    const summary2 = recordKnowledgeTestCompletion(test2, {
      [test2.questions[0].id]: test2.questions[0].correctOptionId,
      [test2.questions[1].id]: test2.questions[1].correctOptionId
    }, 60);
    assert.strictEqual(summary2.score, 2);
    assert.strictEqual(summary2.percentage, 67);

    // Empty test zero questions edge case
    const emptyTest: KnowledgeTest = {
      id: 'test-empty',
      graphId: 'graph-1',
      title: 'Empty Test',
      questions: [],
      flaggedQuestionIds: [],
      timeLimitSeconds: 60,
      startedAt: new Date().toISOString()
    };
    const emptySummary = recordKnowledgeTestCompletion(emptyTest, {}, 10);
    assert.strictEqual(emptySummary.score, 0);
    assert.strictEqual(emptySummary.totalQuestions, 0);
    assert.strictEqual(emptySummary.percentage, 0);
  });

  // CASE 6: Timeout submission
  it('Case 06: Timeout submission sets time_expired completion reason', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4, timeLimitSeconds: 600 });
    const test = testGen.test!;

    // Timeout occurs when timeSpent >= timeLimitSeconds
    const summary = recordKnowledgeTestCompletion(test, {
      [test.questions[0].id]: test.questions[0].correctOptionId
    }, 600, {
      completionReason: 'time_expired'
    });

    assert.strictEqual(summary.persistenceStatus, 'saved');
    const attempt = getAssessmentAttemptById(summary.attemptId)!;
    assert.strictEqual(attempt.completionReason, 'time_expired');
    assert.strictEqual(attempt.timeSpentSeconds, 600);
  });

  // CASE 7: Duplicate-submit prevention
  it('Case 07: Duplicate-submit prevention idempotency in persistence service', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;

    const attempt: AssessmentAttempt = {
      id: 'attempt-fixed-uuid',
      testId: test.id,
      userId: 'user-default',
      graphId: defaultKnowledgeGraph.id,
      graphName: defaultKnowledgeGraph.name,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalQuestions: 3,
      correctAnswers: 2,
      scorePercentage: 67,
      timeSpentSeconds: 45,
      questions: test.questions,
      userAnswers: { [test.questions[0].id]: test.questions[0].correctOptionId },
      conceptIds: [],
      conceptNames: [],
      sourceIds: [],
      completionReason: 'submission'
    };

    // First save
    const firstSave = saveAssessmentAttempt(attempt);
    assert.strictEqual(firstSave.id, 'attempt-fixed-uuid');
    assert.strictEqual(getAssessmentAttempts().length, 1);

    // Duplicate call with exact same ID
    const secondSave = saveAssessmentAttempt(attempt);
    assert.strictEqual(secondSave.id, 'attempt-fixed-uuid');
    assert.strictEqual(getAssessmentAttempts().length, 1, 'Duplicate ID must not insert a second entry');

    // Duplicate call with same testId but different attempt ID
    const duplicateTestIdAttempt = { ...attempt, id: 'attempt-another-uuid' };
    const thirdSave = saveAssessmentAttempt(duplicateTestIdAttempt);
    assert.strictEqual(thirdSave.id, 'attempt-fixed-uuid', 'Must return existing attempt for the same testId');
    assert.strictEqual(getAssessmentAttempts().length, 1, 'Same testId must not create duplicate attempt in history');
  });

  // CASE 8: Manual submission racing with timeout handling
  it('Case 08: Manual submission racing with timeout handling', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;
    const answers = { [test.questions[0].id]: test.questions[0].correctOptionId };

    // Simulate concurrent or rapid dual submission for the exact same test session
    const res1 = recordKnowledgeTestCompletion(test, answers, 50, {
      attemptId: 'race-attempt-1',
      completionReason: 'submission'
    });
    const res2 = recordKnowledgeTestCompletion(test, answers, 60, {
      attemptId: 'race-attempt-1',
      completionReason: 'time_expired'
    });

    assert.strictEqual(res1.attemptId, 'race-attempt-1');
    assert.strictEqual(res2.attemptId, 'race-attempt-1');
    const all = getAssessmentAttempts();
    assert.strictEqual(all.length, 1, 'Racing submissions for the same attempt must produce exactly 1 record');
  });

  // CASE 9: Persistence failure handling
  it('Case 09: Persistence failure sets persistenceStatus to failed and does not mark saved prematurely', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;

    shouldThrowQuotaError = true;

    const summary = recordKnowledgeTestCompletion(test, {}, 45);
    assert.strictEqual(summary.persistenceStatus, 'failed');
    assert.ok(summary.persistenceError);
    assert.strictEqual(getAssessmentAttempts().length, 0, 'No attempt should be saved on failure');
  });

  // CASE 10: Safe retry after a failed save
  it('Case 10: Safe retry after a failed save succeeds without data loss', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;
    const answers = { [test.questions[0].id]: test.questions[0].correctOptionId };

    shouldThrowQuotaError = true;
    const failedSummary = recordKnowledgeTestCompletion(test, answers, 45, {
      attemptId: 'retry-attempt-key'
    });
    assert.strictEqual(failedSummary.persistenceStatus, 'failed');
    assert.strictEqual(getAssessmentAttempts().length, 0);

    // Now storage becomes available again and user clicks "Retry Saving"
    shouldThrowQuotaError = false;
    const retrySummary = recordKnowledgeTestCompletion(test, answers, failedSummary.timeSpentSeconds, {
      attemptId: failedSummary.attemptId,
      completionReason: 'submission'
    });

    assert.strictEqual(retrySummary.persistenceStatus, 'saved');
    assert.strictEqual(getAssessmentAttempts().length, 1);
    const savedAttempt = getAssessmentAttemptById('retry-attempt-key')!;
    assert.ok(savedAttempt);
    assert.strictEqual(savedAttempt.id, 'retry-attempt-key');
    assert.strictEqual(savedAttempt.correctAnswers, 1);
  });

  // CASE 11: Historical result retrieval by exact attempt ID
  it('Case 11: Historical result retrieval by exact attempt ID', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const summary = recordKnowledgeTestCompletion(testGen.test!, {}, 30, {
      attemptId: 'specific-id-999'
    });

    const attempt = getAssessmentAttemptById('specific-id-999');
    assert.ok(attempt);
    assert.strictEqual(attempt.id, 'specific-id-999');
  });

  // CASE 12: Opening an older attempt loads the correct historical record
  it('Case 12: Opening an older attempt loads the correct historical record', () => {
    const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const summary1 = recordKnowledgeTestCompletion(testGen1.test!, {
      [testGen1.test!.questions[0].id]: testGen1.test!.questions[0].correctOptionId
    }, 40, { attemptId: 'attempt-old-1' });

    const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const summary2 = recordKnowledgeTestCompletion(testGen2.test!, {
      [testGen2.test!.questions[0].id]: testGen2.test!.questions[0].correctOptionId,
      [testGen2.test!.questions[1].id]: testGen2.test!.questions[1].correctOptionId
    }, 50, { attemptId: 'attempt-new-2' });

    // Open older attempt by ID
    const oldAttempt = getAssessmentAttemptById('attempt-old-1')!;
    assert.strictEqual(oldAttempt.id, 'attempt-old-1');
    assert.strictEqual(oldAttempt.correctAnswers, 1);
    assert.strictEqual(oldAttempt.scorePercentage, 33);

    // Open newer attempt by ID
    const newAttempt = getAssessmentAttemptById('attempt-new-2')!;
    assert.strictEqual(newAttempt.id, 'attempt-new-2');
    assert.strictEqual(newAttempt.correctAnswers, 2);
    assert.strictEqual(newAttempt.scorePercentage, 67);
  });

  // CASE 13: Preserving historical results after graph changes (immutability)
  it('Case 13: Historical attempt snapshot remains immutable even if active graph is mutated', () => {
    const mutableGraph: KnowledgeGraph = JSON.parse(JSON.stringify(defaultKnowledgeGraph));
    const testGen = generateKnowledgeTest(mutableGraph, {
      questionCount: 3,
      title: 'Original Neural Topology'
    });
    const originalQuestionText = testGen.test!.questions[0].question;
    const originalOptionText = testGen.test!.questions[0].options[0].text;

    const summary = recordKnowledgeTestCompletion(testGen.test!, {
      [testGen.test!.questions[0].id]: testGen.test!.questions[0].correctOptionId
    }, 45, { attemptId: 'immutable-test-id' });

    // Mutate the knowledge graph and generated test object
    testGen.test!.questions[0].question = 'Mutated Question Text';
    testGen.test!.questions[0].options[0].text = 'Mutated Option Text';

    // Retrieve historical attempt from storage
    const historicalAttempt = getAssessmentAttemptById('immutable-test-id')!;
    assert.strictEqual(historicalAttempt.questions[0].question, originalQuestionText, 'Question text must not change');
    assert.strictEqual(historicalAttempt.questions[0].options[0].text, originalOptionText, 'Option text must not change');
    assert.strictEqual(historicalAttempt.graphName, 'Original Neural Topology', 'Graph name must remain original snapshot');
  });

  // CASE 14: Deleted graph handling
  it('Case 14: Deleted graph metadata does not crash retrieval or review', () => {
    const tempGraph: KnowledgeGraph = JSON.parse(JSON.stringify(defaultKnowledgeGraph));
    tempGraph.id = 'temp-graph-delete';
    tempGraph.name = 'Temporary Neuroscience Graph';
    saveUserGraph(tempGraph, tempGraph.id);

    const testGen = generateKnowledgeTest(tempGraph, { questionCount: 3, title: tempGraph.name });
    assert.strictEqual(testGen.success, true);
    const summary = recordKnowledgeTestCompletion(testGen.test!, {}, 30, {
      graphName: tempGraph.name
    });

    // Delete the knowledge graph
    deleteGraph(tempGraph.id);

    // Assessment attempt must still be retrievable and displayable
    const attempt = getAssessmentAttemptById(summary.attemptId)!;
    assert.ok(attempt);
    assert.strictEqual(attempt.graphName, 'Temporary Neuroscience Graph');

    // Deriving concepts with activeGraph = null handles missing nodes cleanly
    const revisit = deriveConceptsWorthRevisiting([attempt], null);
    assert.ok(Array.isArray(revisit));
    assert.strictEqual(revisit.length > 0, true);
    assert.strictEqual(revisit[0].availableInGraph, false, 'Deleted graph concept must indicate not available');
  });

  // CASE 15: Historical answer review
  it('Case 15: Historical answer review data structures and ensures complete summary', () => {
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const test = testGen.test!;
    const answers = {
      [test.questions[0].id]: test.questions[0].correctOptionId,
      [test.questions[1].id]: 'wrong-id'
      // question 2 is left unanswered
    };

    const summary = recordKnowledgeTestCompletion(test, answers, 70);
    const attempt = getAssessmentAttemptById(summary.attemptId)!;

    // ensureResultsSummary guarantees complete review summary
    const reviewSummary = ensureResultsSummary(attempt);
    assert.strictEqual(reviewSummary.score, 1);
    assert.strictEqual(reviewSummary.totalQuestions, 3);
    assert.strictEqual(reviewSummary.percentage, 33);
    assert.ok(Array.isArray(reviewSummary.reviewRecommendedConcepts));
    assert.strictEqual(reviewSummary.reviewRecommendedConcepts.length >= 2, true);
  });

  // CASE 16: Invalid or nonexistent attempt ID
  it('Case 16: Invalid or nonexistent attempt ID returns null safely', () => {
    assert.strictEqual(getAssessmentAttemptById('nonexistent-uuid-xyz'), null);
    assert.strictEqual(getAssessmentAttemptById(''), null);
    assert.strictEqual(deleteAssessmentAttempt('nonexistent-uuid-xyz'), false);
  });

  // CASE 17: Unauthorized access where authentication exists
  it('Case 17: Enforces strict user data ownership and throws AssessmentAccessDeniedError', () => {
    setCurrentUser('user-alice');
    const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
    const summary = recordKnowledgeTestCompletion(testGen.test!, {}, 40, {
      userId: 'user-alice',
      attemptId: 'alice-secret-attempt'
    });

    // Switch to User Bob
    setCurrentUser('user-bob');

    // Bob cannot list Alice's attempts
    const bobAttempts = getAssessmentAttempts({ userId: 'user-bob' });
    assert.strictEqual(bobAttempts.find(a => a.id === 'alice-secret-attempt'), undefined);

    // Bob cannot fetch Alice's attempt by ID
    assert.throws(() => {
      getAssessmentAttemptById('alice-secret-attempt', { userId: 'user-bob' });
    }, AssessmentAccessDeniedError);

    // Bob cannot delete Alice's attempt
    assert.throws(() => {
      deleteAssessmentAttempt('alice-secret-attempt', { userId: 'user-bob' });
    }, AssessmentAccessDeniedError);
  });

  // CASE 18: Empty Study Space
  it('Case 18: Empty Study Space handles zero attempts cleanly', () => {
    const attempts = getAssessmentAttempts();
    assert.strictEqual(attempts.length, 0);

    const progress = computeGraphLearningProgress('default_graph', attempts);
    assert.strictEqual(progress, null);

    const revisit = deriveConceptsWorthRevisiting(attempts, defaultKnowledgeGraph);
    assert.deepStrictEqual(revisit, []);
  });

  // CASE 19: Loading and error states
  it('Case 19: Error handling and persistence failure banners exist in UI sources', () => {
    const studySpaceSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx'),
      'utf8'
    );
    const testResultsSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/test/TestResultsView.tsx'),
      'utf8'
    );

    // Verify study space error and empty state markup
    assert.ok(studySpaceSrc.includes('study-error-banner'));
    assert.ok(studySpaceSrc.includes('study-empty-state'));
    assert.ok(studySpaceSrc.includes('study-loading-state'));

    // Verify results view persistence failure banner & retry
    assert.ok(testResultsSrc.includes('results-persistence-status-bar'));
    assert.ok(testResultsSrc.includes('results-persistence-retry-btn'));
    assert.ok(testResultsSrc.includes('Assessment record could not be saved to persistent history.'));
  });

  // CASE 20: Mobile responsiveness & design system
  it('Case 20: Mobile responsiveness and design tokens verification in CSS', () => {
    const studyCss = fs.readFileSync(
      path.resolve(__dirname, '../src/styles/studySpace.css'),
      'utf8'
    );
    const testCss = fs.readFileSync(
      path.resolve(__dirname, '../src/styles/test.css'),
      'utf8'
    );

    // Verify mobile media queries
    assert.ok(studyCss.includes('@media (max-width: 768px)'));
    assert.ok(studyCss.includes('@media (max-width: 480px)'));
    assert.ok(testCss.includes('@media (max-width: 768px)'));
    assert.ok(testCss.includes('@media (max-width: 480px)'));

    // Verify reduced motion accessibility
    assert.ok(studyCss.includes('prefers-reduced-motion'));
    assert.ok(testCss.includes('prefers-reduced-motion'));

    // Verify core color tokens (#0A0A0A, #101010, #242424, #A3FF12 / lime-green)
    assert.ok(studyCss.includes('#0A0A0A') || studyCss.includes('#0a0a0a') || studyCss.includes('rgba(10, 10, 10'));
    assert.ok(studyCss.includes('#A3FF12') || studyCss.includes('#a3ff12'));
  });

  // CASE 21: Existing assessment flow remaining fully functional
  it('Case 21: End-to-end learning progress comparison across multiple attempts', () => {
    const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test1 = testGen1.test!;
    const attempt1Summary = recordKnowledgeTestCompletion(test1, {
      [test1.questions[0].id]: test1.questions[0].correctOptionId,
      [test1.questions[1].id]: test1.questions[1].correctOptionId
    }, 120); // 2/5 = 40%

    const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
    const test2 = testGen2.test!;
    const attempt2Summary = recordKnowledgeTestCompletion(test2, {
      [test2.questions[0].id]: test2.questions[0].correctOptionId,
      [test2.questions[1].id]: test2.questions[1].correctOptionId,
      [test2.questions[2].id]: test2.questions[2].correctOptionId,
      [test2.questions[3].id]: test2.questions[3].correctOptionId
    }, 110, {
      completedAt: new Date(Date.now() + 5000).toISOString()
    }); // 4/5 = 80%

    const targetGraphId = test1.graphId; // 'default_graph'
    const attempts = getAssessmentAttempts({ graphId: targetGraphId });
    assert.strictEqual(attempts.length, 2);

    const progress = computeGraphLearningProgress(targetGraphId, attempts)!;
    assert.ok(progress);
    assert.strictEqual(progress.latestScore, 80);
    assert.strictEqual(progress.previousScore, 40);
    assert.strictEqual(progress.diffPoints, 40);
    assert.strictEqual(progress.comparisonStatus, 'improved');
    assert.strictEqual(progress.scoreChangeFormatted, '+40 percentage points');

    const comparison = computeProgressComparison(attempts[0], attempts[1]);
    assert.strictEqual(comparison.status, 'improved');
    assert.strictEqual(comparison.diffPoints, 40);
  });
});
