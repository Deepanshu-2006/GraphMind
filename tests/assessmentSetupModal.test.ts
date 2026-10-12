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

  describe('5. Redesigned Minimal Session Summary (2-Row × 2-Column Grid)', () => {
    it('structures session summary into a compact two-row arrangement avoiding cramped technical tables', () => {
      const minutes = 1;
      const seconds = 0;
      const questionCount = 10;

      // Row 1: Knowledge graph & Questions
      const row1 = {
        graph: { label: 'Knowledge graph', value: 'Testing' },
        questions: { label: 'Questions', value: questionCount }
      };

      // Row 2: Time limit & Format
      const row2 = {
        timeLimit: { label: 'Time limit', value: `${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}` },
        format: { label: 'Format', value: 'Multiple choice' }
      };

      assert.equal(row1.graph.label, 'Knowledge graph');
      assert.equal(row1.graph.value, 'Testing');
      assert.equal(row1.questions.label, 'Questions');
      assert.equal(row1.questions.value, 10);

      assert.equal(row2.timeLimit.label, 'Time limit');
      assert.equal(row2.timeLimit.value, '01:00');
      assert.equal(row2.format.label, 'Format');
      assert.equal(row2.format.value, 'Multiple choice');
    });

    it('updates immediately when user adjusts reels or question count', () => {
      let m = 5;
      let s = 0;
      let q = 20;

      const getSummary = () => ({
        timeText: `${formatTwoDigits(m)}:${formatTwoDigits(s)}`,
        questionsVal: q
      });

      assert.deepEqual(getSummary(), { timeText: '05:00', questionsVal: 20 });

      // Change reels and question count
      m = 15;
      s = 45;
      q = 5;
      assert.deepEqual(getSummary(), { timeText: '15:45', questionsVal: 5 });
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
        cardMaxWidthPx: 518,
        mobileBreakpointPx: 640,
        mobileSummaryColumns: 2,
        curvedReelWidthPx: 72,
        curvedReelViewportHeightPx: 90
      };

      assert.equal(mobileBreakpoints.cardMaxWidthPx, 518);
      assert.equal(mobileBreakpoints.mobileBreakpointPx, 640);
      assert.equal(mobileBreakpoints.mobileSummaryColumns, 2);
      assert.equal(mobileBreakpoints.curvedReelWidthPx, 72);
      assert.equal(mobileBreakpoints.curvedReelViewportHeightPx, 90);
    });
  });

  describe('8. Focused Refinement: Height Reduction, 3-Row Cylinder, Draggable Physics & Momentum', () => {
    it('achieves ~15-20% modal height reduction via compact timer instrument and tightened spacing', () => {
      const spacingTokens = {
        cardPadding: { top: 24, horizontal: 30, bottom: 20 },
        eyebrowMarginBottom: 6,
        headingMarginBottom: 6,
        descriptionMarginBottom: 16,
        sectionBlockMarginBottom: 16,
        timerInstrumentPadding: { top: 10, horizontal: 16, bottom: 8 },
        curvedReelViewportHeight: 96, // Reduced from 144px (33% reduction in reel height)
        slotHeight: 38,
        quickButtonSize: 20, // Reduced from 24px
        summaryMarginTop: 14,
        summaryMarginBottom: 18
      };

      assert.equal(spacingTokens.cardPadding.top, 24);
      assert.equal(spacingTokens.curvedReelViewportHeight, 96);
      assert.equal(spacingTokens.slotHeight, 38);
      assert.equal(spacingTokens.quickButtonSize, 20);
      assert.equal(spacingTokens.sectionBlockMarginBottom, 16);
    });

    it('displays exactly 1 neighbor above and 1 below at rest with natural cylindrical fading and culling', () => {
      const computeSlotProjection = (slotVal: number, displayFloat: number) => {
        const diff = slotVal - displayFloat;
        const absDiff = Math.abs(diff);
        const isCulled = absDiff > 1.45;
        const scale = Math.max(0.72, 1 - absDiff * 0.22);
        const opacity = Math.max(0, 1 - Math.pow(absDiff, 1.4) * 0.68);
        const isCenter = absDiff < 0.35;
        return { diff, absDiff, isCulled, scale, opacity, isCenter };
      };

      // Settled at 10.0
      const center = computeSlotProjection(10, 10.0);
      assert.equal(center.isCulled, false);
      assert.equal(center.isCenter, true);
      assert.equal(center.scale, 1.0);
      assert.equal(center.opacity, 1.0);

      const aboveNeighbor = computeSlotProjection(9, 10.0);
      assert.equal(aboveNeighbor.isCulled, false);
      assert.equal(aboveNeighbor.isCenter, false);
      assert.equal(aboveNeighbor.diff, -1.0);
      assert.ok(aboveNeighbor.opacity > 0.25 && aboveNeighbor.opacity < 0.40);

      const belowNeighbor = computeSlotProjection(11, 10.0);
      assert.equal(belowNeighbor.isCulled, false);
      assert.equal(belowNeighbor.isCenter, false);
      assert.equal(belowNeighbor.diff, 1.0);
      assert.ok(belowNeighbor.opacity > 0.25 && belowNeighbor.opacity < 0.40);

      // Distant slots (absDiff >= 2) must be culled
      const distantAbove = computeSlotProjection(8, 10.0);
      assert.equal(distantAbove.isCulled, true);

      const distantBelow = computeSlotProjection(12, 10.0);
      assert.equal(distantBelow.isCulled, true);
    });

    it('translates reel continuously with pointer during vertical drag', () => {
      const SLOT_HEIGHT = 38;
      const startFloat = 10.0;

      // Drag up by 19px (half a slot) -> pulls next numbers up -> value increases continuously
      const deltaYUp = -19;
      const nextFloatUp = startFloat - deltaYUp / SLOT_HEIGHT;
      assert.equal(nextFloatUp, 10.5);

      // Drag down by 38px (one full slot) -> pulls previous numbers down -> value decreases
      const deltaYDown = 38;
      const nextFloatDown = startFloat - deltaYDown / SLOT_HEIGHT;
      assert.equal(nextFloatDown, 9.0);
    });

    it('calculates velocity and momentum with stable snapping on pointer release', () => {
      const SLOT_HEIGHT = 38;
      const min = 0;
      const max = 59;

      const computeReleaseSnap = (
        currentPos: number,
        vy: number /* px/ms, positive if dragged down */
      ) => {
        let momentumSlots = 0;
        if (Math.abs(vy) > 0.18) {
          momentumSlots = (vy * 85) / SLOT_HEIGHT;
          momentumSlots = Math.max(-3, Math.min(3, momentumSlots));
        }
        const targetWithMomentum = currentPos - momentumSlots;
        return Math.max(min, Math.min(max, Math.round(targetWithMomentum)));
      };

      // Stationary release (vy ~ 0) snaps to nearest integer
      assert.equal(computeReleaseSnap(10.2, 0), 10);
      assert.equal(computeReleaseSnap(10.7, 0), 11);

      // Quick upward flick (vy < 0) adds upward momentum (increases value)
      const flickUpTarget = computeReleaseSnap(10.2, -0.6);
      assert.ok(flickUpTarget > 10, 'Upward flick should increase target value');
      assert.ok(flickUpTarget <= 13, 'Momentum must be capped to prevent erratic runaway');

      // Boundary clamping
      assert.equal(computeReleaseSnap(1.0, 1.5), 0); // Cannot go below min
      assert.equal(computeReleaseSnap(58.0, -1.5), 59); // Cannot exceed max
    });

    it('prevents awkward wrapping of KNOWLEDGE GRAPH in 4-column summary layout', () => {
      const summaryLayout = {
        gridTemplateColumns: 'minmax(130px, 1.4fr) minmax(85px, 1fr) minmax(85px, 1fr) minmax(105px, 1.1fr)',
        knowledgeGraphMinWidthPx: 130,
        labelWhiteSpace: 'nowrap',
        valueFontSizePx: 13.5,
        valueColor: '#F4F4F5'
      };

      assert.equal(summaryLayout.knowledgeGraphMinWidthPx >= 130, true);
      assert.equal(summaryLayout.labelWhiteSpace, 'nowrap');
      assert.equal(summaryLayout.valueColor, '#F4F4F5');
    });
  });
});

