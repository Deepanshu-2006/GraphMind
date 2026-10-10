import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssessmentAttempt } from '../src/types/test';
import {
  computeGraphLearningProgress,
  computeProgressComparison
} from '../src/components/study/StudySpaceView';
import { calculateTrajectoryGeometry } from '../src/components/study/LearningTrajectoryChart';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND STUDY SPACE — LEARNING TRAJECTORY REDESIGN VERIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Section Introduction & Editorial Typography (Prompt Section 3)', () => {
    it('renders exact editorial hierarchy: eyebrow, primary heading, and supporting copy', () => {
      assert.ok(
        studyViewSrc.includes('LEARNING PROGRESS'),
        'Must display LEARNING PROGRESS eyebrow'
      );
      assert.ok(
        studyViewSrc.includes('Your learning, over time.'),
        'Must display "Your learning, over time." heading'
      );
      assert.ok(
        studyViewSrc.includes('See how your understanding changes with every assessment.'),
        'Must display supporting text'
      );
    });

    it('styles section introduction with lime green eyebrow and controlled typography', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-eyebrow\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Eyebrow must use lime green accent'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?font-size:\s*clamp\(32px,\s*3\.2vw,\s*38px\);/,
        'Heading font size must be approximately 32–38px on desktop'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-section-desc\s*\{[\s\S]*?color:\s*#777777;/,
        'Supporting text must be muted and readable'
      );
    });
  });

  describe('2. Elimination of Enclosing Cards (Prompt Section 4)', () => {
    it('renders trajectories without enclosing borders and with hairline region dividers', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-row\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/,
        'Trajectories must not use large rounded cards enclosing everything'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-row\s*\+\s*\.study-trajectory-row\s*\{[\s\S]*?border-top:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.08\);/,
        'Subtle hairline divider must separate graph regions'
      );
    });
  });

  describe('3. Area A: Graph Identity & Dominant Performance Metric (Prompt Section 5)', () => {
    it('displays knowledge graph name, attempt count, and large dominant latest metric', () => {
      assert.ok(studyViewSrc.includes('study-trajectory-identity'));
      assert.ok(studyViewSrc.includes('study-trajectory-graph-name'));
      assert.ok(studyViewSrc.includes('study-trajectory-attempts-count'));
      assert.ok(studyViewSrc.includes('study-trajectory-score-val'));
      assert.ok(studyViewSrc.includes('Latest result'));
    });

    it('styles latest score as a dominant typographic metric', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-score-val\s*\{[\s\S]*?font-size:\s*clamp\(40px,\s*4\.4vw,\s*48px\);[\s\S]*?font-weight:\s*600;/
      );
    });

    it('calculates score change truthfully in normalized percentage points', () => {
      const mockAttempt1: AssessmentAttempt = {
        id: 'att-1',
        testId: 't-1',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        startedAt: '2026-10-09T10:00:00.000Z',
        completedAt: '2026-10-09T10:05:00.000Z',
        scorePercentage: 0,
        totalQuestions: 10,
        correctAnswers: 0,
        incorrectAnswers: 10,
        unansweredQuestions: 0,
        answers: [],
        questionResults: [],
        completionReason: 'all_answered'
      };

      const mockAttempt2: AssessmentAttempt = {
        id: 'att-2',
        testId: 't-2',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        startedAt: '2026-10-10T10:00:00.000Z',
        completedAt: '2026-10-10T10:05:00.000Z',
        scorePercentage: 10,
        totalQuestions: 10,
        correctAnswers: 1,
        incorrectAnswers: 9,
        unansweredQuestions: 0,
        answers: [],
        questionResults: [],
        completionReason: 'all_answered'
      };

      const prog = computeGraphLearningProgress('graph-os', [mockAttempt1, mockAttempt2]);
      assert.ok(prog);
      assert.strictEqual(prog.latestScore, 10);
      assert.strictEqual(prog.previousScore, 0);
      assert.strictEqual(prog.diffPoints, 10);
      assert.strictEqual(prog.scoreChangeFormatted, '+10 percentage points');
      assert.strictEqual(prog.comparisonStatus, 'improved');
    });

    it('handles decreasing scores accurately without false positives', () => {
      const mockAttempt1: AssessmentAttempt = {
        id: 'att-1',
        testId: 't-1',
        graphId: 'graph-algo',
        graphName: 'Algorithms',
        startedAt: '2026-10-08T10:00:00.000Z',
        completedAt: '2026-10-08T10:05:00.000Z',
        scorePercentage: 80,
        totalQuestions: 10,
        correctAnswers: 8,
        incorrectAnswers: 2,
        unansweredQuestions: 0,
        answers: [],
        questionResults: [],
        completionReason: 'all_answered'
      };

      const mockAttempt2: AssessmentAttempt = {
        id: 'att-2',
        testId: 't-2',
        graphId: 'graph-algo',
        graphName: 'Algorithms',
        startedAt: '2026-10-09T10:00:00.000Z',
        completedAt: '2026-10-09T10:05:00.000Z',
        scorePercentage: 65,
        totalQuestions: 10,
        correctAnswers: 6,
        incorrectAnswers: 4,
        unansweredQuestions: 0,
        answers: [],
        questionResults: [],
        completionReason: 'all_answered'
      };

      const prog = computeGraphLearningProgress('graph-algo', [mockAttempt1, mockAttempt2]);
      assert.ok(prog);
      assert.strictEqual(prog.latestScore, 65);
      assert.strictEqual(prog.previousScore, 80);
      assert.strictEqual(prog.diffPoints, 15);
      assert.strictEqual(prog.scoreChangeFormatted, '−15 percentage points');
      assert.strictEqual(prog.comparisonStatus, 'declined');
    });

    it('handles single valid attempt without manufacturing a comparison', () => {
      const mockAttempt1: AssessmentAttempt = {
        id: 'att-single',
        testId: 't-1',
        graphId: 'graph-single',
        graphName: 'Networks',
        startedAt: '2026-10-10T10:00:00.000Z',
        completedAt: '2026-10-10T10:05:00.000Z',
        scorePercentage: 70,
        totalQuestions: 10,
        correctAnswers: 7,
        incorrectAnswers: 3,
        unansweredQuestions: 0,
        answers: [],
        questionResults: [],
        completionReason: 'all_answered'
      };

      const prog = computeGraphLearningProgress('graph-single', [mockAttempt1]);
      assert.ok(prog);
      assert.strictEqual(prog.totalAttempts, 1);
      assert.strictEqual(prog.hasComparison, false);
      assert.strictEqual(prog.previousScore, undefined);
      assert.ok(studyViewSrc.includes('Complete another assessment to see your progress.'));
    });
  });

  describe('4. Area B: Mathematical Score History Visualization (Prompt Section 6)', () => {
    it('uses a fixed 0–100% scale without normalizing individual graphs to their own peak', () => {
      const attempts = [
        {
          attemptId: '1',
          attemptNumber: 'Attempt 01',
          scorePercentage: 0,
          completedAt: '2026-10-09T10:00:00Z',
          dateStr: 'Oct 09',
          timeStr: '10:00',
          totalQuestions: 10,
          correctAnswers: 0
        },
        {
          attemptId: '2',
          attemptNumber: 'Attempt 02',
          scorePercentage: 20,
          completedAt: '2026-10-10T10:00:00Z',
          dateStr: 'Oct 10',
          timeStr: '10:00',
          totalQuestions: 10,
          correctAnswers: 2
        }
      ];

      const geom = calculateTrajectoryGeometry(attempts);
      // For score 0%, y must be at Y_MAX (baseline)
      assert.strictEqual(geom.coords[0].y, geom.Y_MAX);
      // For score 20%, y must be Y_MAX - 0.20 * (Y_MAX - Y_MIN)
      const expectedY20 = geom.Y_MAX - 0.2 * (geom.Y_MAX - geom.Y_MIN);
      assert.strictEqual(geom.coords[1].y, Math.round(expectedY20 * 10) / 10);
      assert.ok(geom.coords[1].y > geom.Y_MIN, '20% score must not touch top 100% guideline');
    });

    it('correctly handles all-zero scores and 100% scores without coordinate distortion', () => {
      const zeroAttempts = [
        {
          attemptId: '1',
          attemptNumber: 'Attempt 01',
          scorePercentage: 0,
          completedAt: '2026-10-08T10:00:00Z',
          dateStr: 'Oct 08',
          timeStr: '10:00',
          totalQuestions: 10,
          correctAnswers: 0
        },
        {
          attemptId: '2',
          attemptNumber: 'Attempt 02',
          scorePercentage: 0,
          completedAt: '2026-10-09T10:00:00Z',
          dateStr: 'Oct 09',
          timeStr: '10:00',
          totalQuestions: 10,
          correctAnswers: 0
        }
      ];

      const geomZero = calculateTrajectoryGeometry(zeroAttempts);
      assert.strictEqual(geomZero.coords[0].y, geomZero.Y_MAX);
      assert.strictEqual(geomZero.coords[1].y, geomZero.Y_MAX);
      assert.ok(geomZero.pathD.includes(`M ${geomZero.coords[0].x} ${geomZero.Y_MAX}`));

      const perfectAttempts = [
        {
          attemptId: '3',
          attemptNumber: 'Attempt 01',
          scorePercentage: 100,
          completedAt: '2026-10-08T10:00:00Z',
          dateStr: 'Oct 08',
          timeStr: '10:00',
          totalQuestions: 10,
          correctAnswers: 10
        }
      ];

      const geomPerfect = calculateTrajectoryGeometry(perfectAttempts);
      assert.strictEqual(geomPerfect.coords[0].y, geomPerfect.Y_MIN);
    });
  });

  describe('5. Area C: Compact Attempt Navigation (Prompt Section 7)', () => {
    it('replaces bulky rectangular buttons with compact chronological attempt entries', () => {
      assert.ok(studyViewSrc.includes('study-trajectory-strip'));
      assert.ok(studyViewSrc.includes('study-trajectory-chip'));
      assert.ok(studyViewSrc.includes('study-trajectory-chip-num'));
      assert.ok(studyViewSrc.includes('study-trajectory-chip-arrow'));
      assert.ok(studyViewSrc.includes('study-trajectory-chip-score'));
      assert.ok(studyViewSrc.includes('study-trajectory-chip-date'));
    });

    it('enforces bidirectional point selection and results opening', () => {
      assert.ok(studyViewSrc.includes('onClick={() => handleOpenAttempt(pt.attemptId)}'));
      assert.ok(studyViewSrc.includes('onMouseEnter={() => setHoveredPointAttemptId(pt.attemptId)}'));
      assert.ok(studyViewSrc.includes('onMouseLeave={() => setHoveredPointAttemptId(null)}'));
    });
  });

  describe('6. Viewport Scroll-Triggered Animation (Prompt Section 8)', () => {
    it('uses useInView with once: true for viewport scroll triggering', () => {
      assert.ok(
        studyViewSrc.includes('useInView(progressSectionRef, { once: true, amount: 0.15 })'),
        'Must observe scroll entry for progress section'
      );
      assert.ok(
        studyViewSrc.includes('useInView(rowRef, { once: true, amount: 0.15 })'),
        'Each trajectory row must trigger independently on scroll'
      );
    });

    it('animates numerical counter from 0 to latest score upon entering view', () => {
      assert.ok(
        studyViewSrc.includes('animate(0, prog.latestScore'),
        'Must smoothly transition latest result number from 0'
      );
    });

    it('draws SVG trajectory line with motion.path pathLength', () => {
      assert.ok(
        studyViewSrc.includes('pathLength: 1'),
        'Must animate trajectory stroke pathLength'
      );
    });

    it('supports prefers-reduced-motion without animated movement or delays', () => {
      assert.ok(studyViewSrc.includes('shouldReduceMotion'));
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-trajectory-line\s*\{[\s\S]*?animation:\s*none(?:\s*!important)?;/i,
        'CSS must disable trajectory line animation under prefers-reduced-motion'
      );
    });
  });

  describe('7. Responsive Architecture (Prompt Section 10)', () => {
    it('provides tailored rules for desktop, tablet, and mobile breakpoints', () => {
      assert.match(studyCss, /@media\s*\(max-width:\s*960px\)/);
      assert.match(studyCss, /@media\s*\(max-width:\s*640px\)/);
      assert.match(
        studyCss,
        /\.study-trajectory-header\s*\{[\s\S]*?flex-direction:\s*column;/
      );
      assert.match(
        studyCss,
        /\.study-trajectory-chip\s*\{[\s\S]*?min-height:\s*34px;/
      );
    });
  });
});
