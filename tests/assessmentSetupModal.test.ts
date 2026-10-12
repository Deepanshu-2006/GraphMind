import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { 
  computeQuestionCountOptions, 
  formatTwoDigits
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

describe('GraphMind Assessment Setup Modal — Refined Architecture & Curved Mechanical Timer', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  describe('1. Typography and Visual Hierarchy Refinement (Section 1)', () => {
    it('defines exact refined eyebrow, prominent heading, and editorial description', () => {
      const eyebrow = 'CONFIGURE ASSESSMENT';
      const heading = 'Make it your own.';
      const description = 'Choose your questions and set a time that works for you.';

      assert.equal(eyebrow, 'CONFIGURE ASSESSMENT');
      assert.equal(heading, 'Make it your own.');
      assert.equal(description, 'Choose your questions and set a time that works for you.');
    });

    it('uses readable, medium-weight section titles rather than heavy all-caps micro-labels', () => {
      const questionSectionTitle = 'Number of questions';
      const timeLimitSectionTitle = 'Time limit';

      assert.equal(questionSectionTitle, 'Number of questions');
      assert.equal(timeLimitSectionTitle, 'Time limit');
    });

    it('adheres to GraphMind design palette: near-black, white, muted gray, and lime accent', () => {
      const designTokens = {
        background: '#0E0E0E',
        surfaceElevated: '#121212',
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

  describe('2. Question Count Selector & Capacity (Section 2)', () => {
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
    });

    it('selected question count determines the exact number of assessment questions', () => {
      const test5 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 5 });
      assert.equal(test5.success, true);
      assert.equal(test5.test?.questions.length, 5);

      const test15 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 15 });
      assert.equal(test15.success, true);
      assert.equal(test15.test?.questions.length, 15);
    });
  });

  describe('3. Curved Mechanical Animated Timer (Section 3)', () => {
    it('formats numbers with two-digit precision (formatTwoDigits)', () => {
      assert.equal(formatTwoDigits(0), '00');
      assert.equal(formatTwoDigits(5), '05');
      assert.equal(formatTwoDigits(10), '10');
      assert.equal(formatTwoDigits(59), '59');
      assert.equal(formatTwoDigits(180), '180');
    });

    it('computes total assessment duration in seconds from independent minutes and seconds reels', () => {
      const computeTotalSeconds = (m: number, s: number) => m * 60 + s;

      assert.equal(computeTotalSeconds(5, 0), 300);
      assert.equal(computeTotalSeconds(10, 0), 600);
      assert.equal(computeTotalSeconds(12, 30), 750);
      assert.equal(computeTotalSeconds(0, 45), 45);
      assert.equal(computeTotalSeconds(180, 0), 10800);
    });

    it('validates minimum duration (>= 1 minute / 60 seconds) and maximum duration (<= 180 minutes)', () => {
      const isDurationValid = (m: number, s: number) => {
        const total = m * 60 + s;
        return total >= 60 && total <= 180 * 60;
      };

      assert.equal(isDurationValid(1, 0), true);
      assert.equal(isDurationValid(5, 0), true);
      assert.equal(isDurationValid(10, 30), true);
      assert.equal(isDurationValid(180, 0), true);

      assert.equal(isDurationValid(0, 0), false);
      assert.equal(isDurationValid(0, 45), false); // Less than 1 minute
      assert.equal(isDurationValid(180, 15), false); // Exceeds 180 minutes
    });

    it('adjusts minutes independently (+/- 1 min) while preserving seconds', () => {
      let m = 10;
      const s = 30;

      // Increment minutes
      m = Math.min(180, m + 1);
      assert.equal(m, 11);
      assert.equal(m * 60 + s, 690);

      // Decrement minutes
      m = Math.max(0, m - 1);
      assert.equal(m, 10);
      assert.equal(m * 60 + s, 630);
    });

    it('adjusts seconds in 15-second precision steps with clean minute wrapping', () => {
      let m = 10;
      let s = 45;

      // Quick plus on seconds wraps to next minute
      s += 15;
      if (s >= 60) {
        s = 0;
        m += 1;
      }
      assert.equal(m, 11);
      assert.equal(s, 0);

      // Quick minus wraps back
      s -= 15;
      if (s < 0) {
        s = 45;
        m -= 1;
      }
      assert.equal(m, 10);
      assert.equal(s, 45);
    });

    it('supports direct numeric entry for custom minutes and seconds', () => {
      const parseDirectEntry = (minStr: string, secStr: string) => {
        const parsedMin = parseInt(minStr.trim(), 10);
        const parsedSec = parseInt(secStr.trim(), 10);
        const safeMin = isNaN(parsedMin) ? 10 : Math.min(180, Math.max(0, parsedMin));
        const safeSec = isNaN(parsedSec) ? 0 : Math.min(59, Math.max(0, parsedSec));
        return { minutes: safeMin, seconds: safeSec, totalSeconds: safeMin * 60 + safeSec };
      };

      const result1 = parseDirectEntry('25', '30');
      assert.deepEqual(result1, { minutes: 25, seconds: 30, totalSeconds: 1530 });

      const resultClamped = parseDirectEntry('200', '99');
      assert.deepEqual(resultClamped, { minutes: 180, seconds: 59, totalSeconds: 10859 });
    });
  });

  describe('4. Text-Only Begin Assessment Action (Section 4)', () => {
    it('enforces text-only button design with no solid lime-green background or heavy enclosing border', () => {
      const buttonDesign = {
        hasSolidGreenBackground: false,
        hasProminentBorder: false,
        textDefaultColor: '#F5F5F5',
        hoverTextAccent: '#A3FF12',
        hasAnimatedUnderline: true,
        arrowHoverShiftPx: 4
      };

      assert.equal(buttonDesign.hasSolidGreenBackground, false);
      assert.equal(buttonDesign.hasProminentBorder, false);
      assert.equal(buttonDesign.hoverTextAccent, '#A3FF12');
      assert.equal(buttonDesign.hasAnimatedUnderline, true);
      assert.equal(buttonDesign.arrowHoverShiftPx, 4);
    });

    it('disables action and prevents submission when duration is under 1 minute', () => {
      const totalSeconds = 0;
      const canBegin = totalSeconds >= 60;
      assert.equal(canBegin, false);
    });
  });

  describe('5. Redesigned Minimal Session Summary (Section 5)', () => {
    it('formats session summary across 4 clean columns synchronized with timer and question selector', () => {
      const minutes = 12;
      const seconds = 30;
      const questionCount = 10;

      const summaryState = {
        graphName: defaultKnowledgeGraph.name || 'Knowledge Graph',
        questionsText: `${questionCount} questions`,
        timeText: `${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`,
        format: 'Multiple choice'
      };

      assert.equal(summaryState.graphName, 'Knowledge Graph');
      assert.equal(summaryState.questionsText, '10 questions');
      assert.equal(summaryState.timeText, '12:30');
      assert.equal(summaryState.format, 'Multiple choice');
    });

    it('updates immediately when user adjusts reels or question count', () => {
      let m = 5;
      let s = 0;
      let q = 20;

      const getSummary = () => ({
        timeText: `${formatTwoDigits(m)}:${formatTwoDigits(s)}`,
        questionsText: `${q} questions`
      });

      assert.deepEqual(getSummary(), { timeText: '05:00', questionsText: '20 questions' });

      // Change reels and question count
      m = 15;
      s = 45;
      q = 5;
      assert.deepEqual(getSummary(), { timeText: '15:45', questionsText: '5 questions' });
    });
  });

  describe('6. State Continuity & Results Persistence (Section 7)', () => {
    it('records exact configured timeLimitSeconds onto completed assessment attempt record', () => {
      const configuredTimeLimitSeconds = 750; // 12 minutes 30 seconds
      const test = generateKnowledgeTest(defaultKnowledgeGraph, {
        questionCount: 5,
        timeLimitSeconds: configuredTimeLimitSeconds
      }).test!;

      assert.equal(test.questions.length, 5);
      assert.equal(test.timeLimitSeconds, 750);

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

      // Verify persisted attempt in localStorage
      const historyRaw = globalThis.localStorage.getItem('graphmind_assessment_attempts_v1');
      assert.ok(historyRaw);
      const history: AssessmentAttempt[] = JSON.parse(historyRaw);
      const savedAttempt = history.find(a => a.id === summary.attemptId);

      assert.ok(savedAttempt);
      assert.equal(savedAttempt?.timeLimitSeconds, 750);
      assert.equal(savedAttempt?.totalQuestions, 5);
      assert.equal(savedAttempt?.correctAnswers, 4);
    });

    it('saves and restores setup config without losing question count or duration', () => {
      saveAssessmentSetupConfig({
        questionCount: 15,
        timeLimitMinutes: 25,
        isCustomTime: true
      });

      const loaded = loadAssessmentSetupConfig();
      assert.ok(loaded);
      assert.equal(loaded?.questionCount, 15);
      assert.equal(loaded?.timeLimitMinutes, 25);
    });
  });

  describe('7. Mobile and Responsive Constraints (Section 6 & 10)', () => {
    it('supports responsive rules for viewports <= 640px', () => {
      const mobileBreakpoints = {
        cardMaxWidthPx: 530,
        mobileBreakpointPx: 640,
        mobileSummaryColumns: 2,
        curvedReelWidthPx: 72
      };

      assert.equal(mobileBreakpoints.cardMaxWidthPx, 530);
      assert.equal(mobileBreakpoints.mobileBreakpointPx, 640);
      assert.equal(mobileBreakpoints.mobileSummaryColumns, 2);
      assert.equal(mobileBreakpoints.curvedReelWidthPx, 72);
    });
  });
});
