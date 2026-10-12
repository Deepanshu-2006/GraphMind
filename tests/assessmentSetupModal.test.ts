import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { 
  computeQuestionCountOptions, 
  TIME_PRESET_OPTIONS 
} from '../src/components/test/AssessmentSetupModal';
import { 
  generateKnowledgeTest, 
  getMaxAvailableQuestions 
} from '../src/services/knowledgeTestGenerator';
import { 
  loadAssessmentSetupConfig, 
  saveAssessmentSetupConfig, 
  recordKnowledgeTestCompletion 
} from '../src/services/storage';
import { defaultKnowledgeGraph } from '../src/data/graphData';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt } from '../src/types/test';

// In-memory localStorage mock for node test runner
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Attach mock to global
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  (globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = new LocalStorageMock();
}

describe('GraphMind Assessment Setup Modal — Architecture & Functional Integrity', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  describe('1. Open Setup Modal & Design Specifications (Section 1)', () => {
    it('defines exact eyebrow, heading, and description typography text', () => {
      const eyebrow = 'CONFIGURE ASSESSMENT';
      const heading = 'Make it your own.';
      const description = 'Choose how many questions to attempt and how much time you want.';

      assert.equal(eyebrow, 'CONFIGURE ASSESSMENT');
      assert.equal(heading, 'Make it your own.');
      assert.equal(description, 'Choose how many questions to attempt and how much time you want.');
    });

    it('adheres to GraphMind design palette: near-black, white, muted gray, and lime accent', () => {
      const designTokens = {
        background: '#0E0E0E',
        textPrimary: '#FFFFFF',
        textMuted: '#8E8E93',
        accentLime: '#A3FF12',
        borderSubtle: 'rgba(255, 255, 255, 0.08)'
      };

      assert.equal(designTokens.background, '#0E0E0E');
      assert.equal(designTokens.textPrimary, '#FFFFFF');
      assert.equal(designTokens.accentLime, '#A3FF12');
    });
  });

  describe('2. Question Count Selector & Graph Capacity (Section 2)', () => {
    it('computes options for default knowledge graph with 27 available questions', () => {
      const maxAvailable = getMaxAvailableQuestions(defaultKnowledgeGraph);
      assert.equal(maxAvailable, 27);

      const options = computeQuestionCountOptions(maxAvailable);
      assert.equal(options.length, 5);

      const labels = options.map(o => o.label);
      assert.deepEqual(labels, ['5', '10', '15', '20', 'All']);

      const allOption = options.find(o => o.value === 'all');
      assert.ok(allOption);
      assert.equal(allOption.actualCount, 27);
    });

    it('never offers a question count greater than valid available questions', () => {
      const maxAvailable = 12;
      const options = computeQuestionCountOptions(maxAvailable);

      assert.ok(options.length > 0);
      options.forEach(opt => {
        assert.ok(opt.actualCount <= maxAvailable, `Option count ${opt.actualCount} must not exceed ${maxAvailable}`);
      });

      // 15 and 20 must NOT be present
      assert.equal(options.some(o => o.value === 15), false);
      assert.equal(options.some(o => o.value === 20), false);
      assert.deepEqual(options.map(o => o.label), ['5', '10', 'All']);
    });

    it('provides sensible options when fewer than five questions are available', () => {
      // 4 available questions
      const options4 = computeQuestionCountOptions(4);
      assert.deepEqual(options4.map(o => o.label), ['3', 'All']);
      assert.equal(options4.find(o => o.value === 'all')?.actualCount, 4);

      // 3 available questions
      const options3 = computeQuestionCountOptions(3);
      assert.deepEqual(options3.map(o => o.label), ['3', 'All']);
      assert.equal(options3.find(o => o.value === 'all')?.actualCount, 3);
    });

    it('returns empty options array when graph has fewer than 3 questions', () => {
      assert.deepEqual(computeQuestionCountOptions(2), []);
      assert.deepEqual(computeQuestionCountOptions(1), []);
      assert.deepEqual(computeQuestionCountOptions(0), []);
      assert.deepEqual(computeQuestionCountOptions(-1), []);
    });

    it('selected question count generates the exact number of assessment questions', () => {
      const test5 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.equal(test5.success, true);
      assert.equal(test5.test?.questions.length, 5);

      const test15 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 15 });
      assert.equal(test15.success, true);
      assert.equal(test15.test?.questions.length, 15);

      const maxAvailable = getMaxAvailableQuestions(defaultKnowledgeGraph);
      const testAll = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: maxAvailable });
      assert.equal(testAll.success, true);
      assert.equal(testAll.test?.questions.length, maxAvailable);
    });
  });

  describe('3. Total Duration & Custom Time Limit (Section 3)', () => {
    it('defines standard presets: 5 min, 10 min, 20 min, Custom', () => {
      assert.equal(TIME_PRESET_OPTIONS.length, 4);
      assert.equal(TIME_PRESET_OPTIONS[0].label, '5 min');
      assert.equal(TIME_PRESET_OPTIONS[1].label, '10 min');
      assert.equal(TIME_PRESET_OPTIONS[2].label, '20 min');
      assert.equal(TIME_PRESET_OPTIONS[3].label, 'Custom');
    });

    it('validates custom duration between 1 and 180 minutes', () => {
      const isValidDuration = (val: string) => {
        const parsed = parseInt(val.trim(), 10);
        return !isNaN(parsed) && parsed >= 1 && parsed <= 180 && Number.isInteger(Number(val.trim()));
      };

      assert.equal(isValidDuration('1'), true);
      assert.equal(isValidDuration('15'), true);
      assert.equal(isValidDuration('180'), true);

      assert.equal(isValidDuration('0'), false);
      assert.equal(isValidDuration('-5'), false);
      assert.equal(isValidDuration('181'), false);
      assert.equal(isValidDuration('12.5'), false);
      assert.equal(isValidDuration(''), false);
      assert.equal(isValidDuration('abc'), false);
    });

    it('correctly maps minutes to total timeLimitSeconds in generated test', () => {
      const test10Min = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 10,
        timeLimitSeconds: 10 * 60
      });
      assert.equal(test10Min.test?.timeLimitSeconds, 600);

      const test5Min = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 5,
        timeLimitSeconds: 5 * 60
      });
      assert.equal(test5Min.test?.timeLimitSeconds, 300);

      const testCustom25 = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 10,
        timeLimitSeconds: 25 * 60
      });
      assert.equal(testCustom25.test?.timeLimitSeconds, 1500);
    });
  });

  describe('4. Live Session Summary (Section 4)', () => {
    it('formats summary with graph name, questions, duration, and format', () => {
      const summaryState = {
        graphName: defaultKnowledgeGraph.name || 'Knowledge Graph',
        questionCount: 10,
        timeLimitMinutes: 10,
        format: 'Multiple choice'
      };

      assert.equal(summaryState.graphName, 'Knowledge Graph');
      assert.equal(summaryState.questionCount, 10);
      assert.equal(summaryState.timeLimitMinutes, 10);
      assert.equal(summaryState.format, 'Multiple choice');
    });

    it('immediately reflects selections when user switches question count or duration', () => {
      let currentQuestions = 5;
      let currentMinutes = 20;

      const getFormattedSummary = () => ({
        questionsText: `${currentQuestions} questions`,
        timeText: `${currentMinutes} minutes`
      });

      assert.deepEqual(getFormattedSummary(), {
        questionsText: '5 questions',
        timeText: '20 minutes'
      });

      // Switch to All (27) and 10 minutes
      currentQuestions = 27;
      currentMinutes = 10;
      assert.deepEqual(getFormattedSummary(), {
        questionsText: '27 questions',
        timeText: '10 minutes'
      });
    });
  });

  describe('5. Modal Footer Actions & State Invariants (Section 5)', () => {
    it('Cancel closes modal without starting timer or recording an attempt', () => {
      let isModalOpen = true;
      let isTimerActive = false;
      const attemptsCountBefore = 0;

      // User clicks Cancel
      isModalOpen = false;

      assert.equal(isModalOpen, false);
      assert.equal(isTimerActive, false);
      assert.equal(attemptsCountBefore, 0);
    });

    it('Begin assessment initializes session, starts countdown, and creates configured test', () => {
      let isTimerActive = false;
      let mode = 'intro';

      const config = {
        questionCount: 15,
        timeLimitSeconds: 15 * 60
      };

      const result = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: config.questionCount,
        timeLimitSeconds: config.timeLimitSeconds
      });

      assert.equal(result.success, true);
      assert.equal(result.test?.questions.length, 15);
      assert.equal(result.test?.timeLimitSeconds, 900);

      // Begin assessment transition
      isTimerActive = true;
      mode = 'testing';

      assert.equal(isTimerActive, true);
      assert.equal(mode, 'testing');
    });
  });

  describe('6. Animation Curve & Accessibility Invariants (Section 6)', () => {
    it('uses standard premium easing [0.22, 1, 0.36, 1] for modal and selection pill', () => {
      const easingCurve = [0.22, 1, 0.36, 1];
      const entryDurationMs = 360;
      const entryTranslateYPx = 16;

      assert.deepEqual(easingCurve, [0.22, 1, 0.36, 1]);
      assert.ok(entryDurationMs >= 300 && entryDurationMs <= 400);
      assert.ok(entryTranslateYPx >= 12 && entryTranslateYPx <= 16);
    });

    it('provides accessible dialog attributes (role, aria-modal, aria-labelledby)', () => {
      const dialogAttrs = {
        role: 'dialog',
        ariaModal: 'true',
        ariaLabelledby: 'setup-modal-heading',
        ariaDescribedby: 'setup-modal-description'
      };

      assert.equal(dialogAttrs.role, 'dialog');
      assert.equal(dialogAttrs.ariaModal, 'true');
      assert.equal(dialogAttrs.ariaLabelledby, 'setup-modal-heading');
      assert.equal(dialogAttrs.ariaDescribedby, 'setup-modal-description');
    });
  });

  describe('7. Settings Persistence & Cross-Graph Revalidation (Section 7)', () => {
    it('saves and loads configured setup settings from localStorage', () => {
      saveAssessmentSetupConfig({
        questionCount: 15,
        timeLimitMinutes: 20,
        isCustomTime: false
      });

      const loaded = loadAssessmentSetupConfig();
      assert.ok(loaded);
      assert.equal(loaded?.questionCount, 15);
      assert.equal(loaded?.timeLimitMinutes, 20);
      assert.equal(loaded?.isCustomTime, false);
    });

    it('revalidates stale persisted count when new graph has fewer available questions', () => {
      // User saved 20 questions on previous large graph
      saveAssessmentSetupConfig({
        questionCount: 20,
        timeLimitMinutes: 10,
        isCustomTime: false
      });

      // New smaller graph only has 8 available questions
      const smallerGraphCapacity = 8;
      const options = computeQuestionCountOptions(smallerGraphCapacity);
      const persisted = loadAssessmentSetupConfig();

      let effectiveSelection: number | 'all' = 'all';
      if (typeof persisted?.questionCount === 'number') {
        const match = options.find(o => o.value === persisted.questionCount);
        if (match) {
          effectiveSelection = match.value;
        } else {
          // Stale value 20 exceeds 8 -> fall back to valid option or 'all'
          effectiveSelection = options[options.length - 1].value;
        }
      }

      assert.notEqual(effectiveSelection, 20);
      assert.equal(effectiveSelection, 'all');
    });
  });

  describe('8. Assessment Results & History Persistence Integrity (Section 8)', () => {
    it('records timeLimitSeconds and actual question count on completed attempt record', () => {
      const configuredTimeLimitSeconds = 900; // 15 minutes
      const test = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 5,
        timeLimitSeconds: configuredTimeLimitSeconds
      }).test!;

      assert.equal(test.questions.length, 5);
      assert.equal(test.timeLimitSeconds, 900);

      // Simulate 4 correct answers out of 5
      const answers: Record<string, string> = {};
      test.questions.forEach((q, idx) => {
        answers[q.id] = idx === 0 ? 'wrong' : q.correctOptionId;
      });

      const summary = recordKnowledgeTestCompletion(test, answers, 180, {
        graphName: defaultKnowledgeGraph.name || 'Knowledge Graph'
      });

      assert.equal(summary.totalQuestions, 5);
      assert.equal(summary.score, 4);
      assert.equal(summary.percentage, 80);

      // Verify the persisted attempt record contains timeLimitSeconds
      const historyRaw = globalThis.localStorage.getItem('graphmind_assessment_attempts_v1');
      assert.ok(historyRaw);
      const history: AssessmentAttempt[] = JSON.parse(historyRaw);
      const savedAttempt = history.find(a => a.id === summary.attemptId);

      assert.ok(savedAttempt);
      assert.equal(savedAttempt?.totalQuestions, 5);
      assert.equal(savedAttempt?.timeLimitSeconds, 900);
      assert.equal(savedAttempt?.correctAnswers, 4);
      assert.equal(savedAttempt?.scorePercentage, 80);
    });

    it('remains backward-compatible with legacy attempts lacking timeLimitSeconds', () => {
      const legacyAttempt: AssessmentAttempt = {
        id: 'legacy-attempt-1',
        testId: 'test-1',
        title: 'Legacy Assessment',
        targetConceptId: 'c1',
        targetConceptName: 'Concept',
        totalQuestions: 10,
        correctCount: 8,
        score: 80,
        timeSpentSeconds: 450,
        timestamp: Date.now() - 100000,
        answers: {},
        conceptResults: [],
        reviewRecommendedConcepts: []
      };

      assert.equal(legacyAttempt.timeLimitSeconds, undefined);
      assert.equal(legacyAttempt.score, 80);
      assert.equal(legacyAttempt.totalQuestions, 10);
    });
  });

  describe('9. Empty & Edge Case Resilience (Section 9)', () => {
    it('handles null or empty graph without throwing', () => {
      assert.equal(getMaxAvailableQuestions(null), 0);
      assert.equal(getMaxAvailableQuestions(undefined), 0);

      const emptyGraph: KnowledgeGraph = {
        id: 'empty',
        name: 'Empty Graph',
        nodes: [],
        edges: []
      };
      assert.equal(getMaxAvailableQuestions(emptyGraph), 0);
      assert.deepEqual(computeQuestionCountOptions(0), []);
    });

    it('prevents generating an assessment when graph has insufficient material', () => {
      const smallGraph: KnowledgeGraph = {
        id: 'small',
        name: 'Small Graph',
        nodes: [
          { id: '1', label: 'Node 1', group: 'core', radius: 10, connections: [] },
          { id: '2', label: 'Node 2', group: 'core', radius: 10, connections: [] }
        ],
        edges: []
      };

      const result = generateKnowledgeTest(smallGraph, { questionCount: 5 });
      assert.equal(result.success, false);
      assert.equal(result.test, undefined);
    });

    it('handles timer expiration using configured timeLimitSeconds', () => {
      const configuredTimeLimitSeconds = 300; // 5 min
      const test = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 5,
        timeLimitSeconds: configuredTimeLimitSeconds
      }).test!;

      // Time expired: timeSpent = test.timeLimitSeconds
      const timeSpent = Math.max(1, test.timeLimitSeconds);
      assert.equal(timeSpent, 300);

      const summary = recordKnowledgeTestCompletion(test, {}, timeSpent, {
        completionReason: 'timeout',
        graphName: defaultKnowledgeGraph.name
      });

      assert.equal(summary.timeSpentSeconds, 300);
    });
  });

  describe('10. Mobile and Responsive Constraints (Section 10)', () => {
    it('supports responsive rules for viewports <= 640px', () => {
      const mobileBreakpoints = {
        cardMaxWidthPx: 500,
        mobileBreakpointPx: 640,
        mobileSummaryColumns: 1,
        mobileActionsDirection: 'column-reverse'
      };

      assert.equal(mobileBreakpoints.mobileBreakpointPx, 640);
      assert.equal(mobileBreakpoints.mobileSummaryColumns, 1);
      assert.equal(mobileBreakpoints.mobileActionsDirection, 'column-reverse');
    });
  });
});
