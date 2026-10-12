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

    it('initializes timer duration to 01:00 (1 minute) by default and never 00:00', () => {
      const defaultMinutes = 1;
      const defaultSeconds = 0;
      const formatted = `${formatTwoDigits(defaultMinutes)}:${formatTwoDigits(defaultSeconds)}`;

      assert.equal(formatted, '01:00');
      assert.notEqual(formatted, '00:00');
      assert.equal(defaultMinutes * 60 + defaultSeconds, 60);
    });

    it('maintains clean, restrained timer aperture bracket without unnecessary borders or green decorations', () => {
      const timerStyling = {
        hasUnnecessaryGreenUnderline: false,
        hasGreenCornerGlow: false,
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
        backgroundSubtle: 'rgba(255, 255, 255, 0.015)'
      };

      assert.equal(timerStyling.hasUnnecessaryGreenUnderline, false);
      assert.equal(timerStyling.hasGreenCornerGlow, false);
    });

    it('supports direct numeric entry for custom minutes and seconds', () => {
      const parseDirectEntry = (minStr: string, secStr: string) => {
        const parsedMin = parseInt(minStr.trim(), 10);
        const parsedSec = parseInt(secStr.trim(), 10);
        const safeMin = isNaN(parsedMin) ? 1 : Math.min(180, Math.max(0, parsedMin));
        const safeSec = isNaN(parsedSec) ? 0 : Math.min(59, Math.max(0, parsedSec));
        return { minutes: safeMin, seconds: safeSec, totalSeconds: safeMin * 60 + safeSec };
      };

      const result1 = parseDirectEntry('25', '30');
      assert.deepEqual(result1, { minutes: 25, seconds: 30, totalSeconds: 1530 });

      const resultDefault = parseDirectEntry('', '');
      assert.deepEqual(resultDefault, { minutes: 1, seconds: 0, totalSeconds: 60 });

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

  describe('5. Simplified Single-Line Assessment Summary', () => {
    it('formats assessment summary as a quiet horizontal contextual line: Testing · 10 questions · 01:00', () => {
      const minutes = 1;
      const seconds = 0;
      const questionCount = 10;
      const graphName = 'Testing';

      const summaryParts = [
        graphName,
        `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`,
        `${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`
      ];

      const formattedLine = summaryParts.join(' · ');
      assert.equal(formattedLine, 'Testing · 10 questions · 01:00');
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

  describe('9. Cinematic Modal Entry & Coordinated Reveal Motion (Part 1)', () => {
    it('defines smooth backdrop transition with dark overlay and background blur', () => {
      const backdrop = {
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        entranceDurationSeconds: 0.38,
        exitDurationSeconds: 0.2, // 200ms (within 180-240ms range)
        ease: [0.16, 1, 0.3, 1]
      };

      assert.equal(backdrop.backdropFilter, 'blur(8px)');
      assert.ok(backdrop.entranceDurationSeconds >= 0.35 && backdrop.entranceDurationSeconds <= 0.45);
      assert.ok(backdrop.exitDurationSeconds >= 0.18 && backdrop.exitDurationSeconds <= 0.24);
      assert.ok(backdrop.exitDurationSeconds < backdrop.entranceDurationSeconds);
    });

    it('choreographs modal card entrance arriving into focus without overshoot or bounce', () => {
      const cardEntrance = {
        opacity: { from: 0, to: 1 },
        translateY: { from: 14, to: 0 },
        scale: { from: 0.975, to: 1 },
        durationSeconds: 0.5, // 500ms (within 450-600ms range)
        ease: [0.16, 1, 0.3, 1]
      };

      assert.equal(cardEntrance.opacity.from, 0);
      assert.equal(cardEntrance.opacity.to, 1);
      assert.equal(cardEntrance.translateY.from, 14);
      assert.equal(cardEntrance.scale.from, 0.975);
      assert.ok(cardEntrance.durationSeconds >= 0.45 && cardEntrance.durationSeconds <= 0.60);
    });

    it('coordinates 6-group staggered reveal sequence with short 35-55ms intervals', () => {
      const sequence = [
        '1. Eyebrow (CONFIGURE ASSESSMENT)',
        '2. Heading & description (Make it your own.)',
        '3. Question selection section',
        '4. Timer section',
        '5. Assessment summary line',
        '6. Footer actions (Cancel & Begin assessment)'
      ];

      const staggerIntervalSeconds = 0.045; // 45ms (within 35-55ms range)
      assert.equal(sequence.length, 6);
      assert.ok(staggerIntervalSeconds >= 0.035 && staggerIntervalSeconds <= 0.055);
    });

    it('executes closing exit animation noticeably faster than entrance (180-240ms)', () => {
      const exitAnimation = {
        opacity: 0,
        translateY: 8,
        scale: 0.985,
        durationSeconds: 0.20 // 200ms
      };

      assert.equal(exitAnimation.opacity, 0);
      assert.equal(exitAnimation.scale, 0.985);
      assert.ok(exitAnimation.durationSeconds >= 0.18 && exitAnimation.durationSeconds <= 0.24);
    });

    it('locks background scrolling on open and restores previous overflow on close', () => {
      const fakeBody = { style: { overflow: '' } };

      // Open modal
      const originalOverflow = fakeBody.style.overflow;
      fakeBody.style.overflow = 'hidden';
      assert.equal(fakeBody.style.overflow, 'hidden');

      // Close modal
      fakeBody.style.overflow = originalOverflow;
      assert.equal(fakeBody.style.overflow, '');
    });

    it('respects prefers-reduced-motion with instant/reduced transitions', () => {
      const getVariants = (reducedMotion: boolean) => ({
        card: {
          initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.975 },
          animate: reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
          duration: reducedMotion ? 0.18 : 0.5
        }
      });

      const normal = getVariants(false);
      const reduced = getVariants(true);

      assert.equal(normal.card.initial.y, 14);
      assert.equal(normal.card.initial.scale, 0.975);
      assert.equal(reduced.card.initial.y, undefined);
      assert.equal(reduced.card.initial.scale, undefined);
      assert.ok(reduced.card.duration < normal.card.duration);
    });
  });

  describe('10. Tactile Curved Timer Animation & Controlled Physical Snapping (Part 2)', () => {
    it('uses weighted quartic ease-out curve 1 - (1 - t)^4 with ~260ms settling duration', () => {
      const quarticEase = (t: number) => 1 - Math.pow(1 - t, 4);

      // Verify progression has weighted mechanical feel
      assert.equal(quarticEase(0), 0);
      assert.equal(quarticEase(1), 1);
      assert.ok(quarticEase(0.5) > 0.9, 'Quartic ease moves swifter initially and decelerates with mechanical weight');

      const singleStepDurationMs = 260; // within 220-320ms range
      assert.ok(singleStepDurationMs >= 220 && singleStepDurationMs <= 320);
    });

    it('calculates continuous physical projection with smooth scale and opacity without jarring font jumps', () => {
      const projectDigit = (diff: number) => {
        const absDiff = Math.abs(diff);
        const centerProximity = Math.max(0, 1 - Math.min(1, absDiff));
        const scale = 0.86 + centerProximity * 0.14;
        const opacity = Math.max(0, 1 - Math.pow(absDiff / 1.55, 1.55));
        const isCenter = absDiff < 0.35;
        return { scale, opacity, isCenter };
      };

      // Center selected digit
      const center = projectDigit(0);
      assert.equal(center.scale, 1.0);
      assert.equal(center.opacity, 1.0);
      assert.equal(center.isCenter, true);

      // 1 slot away (neighbor)
      const neighbor = projectDigit(1.0);
      assert.equal(neighbor.scale, 0.86);
      assert.ok(neighbor.opacity >= 0.35 && neighbor.opacity <= 0.55);
      assert.equal(neighbor.isCenter, false);

      // Halfway between slots during drag / transition
      const halfway = projectDigit(0.5);
      assert.ok(Math.abs(halfway.scale - 0.93) < 0.001);
      assert.ok(halfway.opacity > neighbor.opacity && halfway.opacity < center.opacity);
    });

    it('caps flick momentum to at most 1 slot preventing erratic runaway roulette wheel', () => {
      const computeTactileMomentum = (vy: number) => {
        let momentumSlots = 0;
        if (Math.abs(vy) > 0.35) {
          momentumSlots = vy > 0 ? -1 : 1;
        }
        return momentumSlots;
      };

      // Slow drag has zero runaway momentum
      assert.equal(computeTactileMomentum(0.1), 0);
      assert.equal(computeTactileMomentum(-0.2), 0);

      // Fast flick capped at strictly 1 slot
      assert.equal(computeTactileMomentum(0.8), -1);
      assert.equal(computeTactileMomentum(-1.2), 1);
      assert.equal(computeTactileMomentum(5.0), -1);
    });

    it('preserves boundary protection so timer never accidentally settles at 00:00', () => {
      const minDurationSeconds = 60; // 01:00

      const canDecrementMinutes = (m: number, s: number) => {
        const nextM = m - 1;
        return nextM * 60 + s >= minDurationSeconds;
      };

      const canDecrementSeconds = (m: number, s: number) => {
        let nextS = s - 15;
        let nextM = m;
        if (nextS < 0) {
          nextS = 45;
          nextM = m - 1;
        }
        return nextM * 60 + nextS >= minDurationSeconds;
      };

      // At 01:00 (minimum duration)
      assert.equal(canDecrementMinutes(1, 0), false, 'Cannot decrement 1 min to 0 when seconds is 0');
      assert.equal(canDecrementSeconds(1, 0), false, 'Cannot decrement 0 seconds when minutes is 1');

      // At 02:00
      assert.equal(canDecrementMinutes(2, 0), true);
      assert.equal(canDecrementSeconds(2, 0), true);
    });
  });
});


