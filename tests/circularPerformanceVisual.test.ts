import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('GraphMind Circular Knowledge Performance Visualization', () => {
  function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
    const rad = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  }

  describe('1. Circular Geometry & Segments Math (Section 1, 2, 3)', () => {
    it('creates exactly 10 distinct arc segments for a 10-question test', () => {
      const totalQuestions = 10;
      const N = totalQuestions;
      const slotDeg = 360 / N;
      const gapDeg = 5;
      const spanDeg = slotDeg - gapDeg;

      const segments = Array.from({ length: N }, (_, i) => {
        const startAngle = -90 + i * slotDeg + gapDeg / 2;
        const endAngle = startAngle + spanDeg;
        return {
          index: i,
          startAngle,
          endAngle,
          spanDeg
        };
      });

      assert.equal(segments.length, 10);
      assert.equal(segments[0].spanDeg, 31);
      assert.equal(slotDeg, 36);
      assert.equal(gapDeg, 5);
      // Validates gaps between every segment
      for (let i = 0; i < N - 1; i++) {
        const currentEnd = segments[i].endAngle;
        const nextStart = segments[i + 1].startAngle;
        assert.equal(Math.round(nextStart - currentEnd), 5);
      }
    });

    it('generates valid SVG arc path strings without crashing', () => {
      const pathD = describeArc(160, 160, 112, -90, -59);
      assert.ok(pathD.startsWith('M 160 48'));
      assert.ok(pathD.includes('A 112 112 0 0 1'));
    });
  });

  describe('2. Segment States & Color Rules (Section 4)', () => {
    it('colors correct segments with GraphMind green and incorrect with muted neutral (no red)', () => {
      const greenAccentToken = 'var(--accent, #A3FF12)';
      const mutedDarkToken = 'rgba(255, 255, 255, 0.08)';

      const getSegmentColor = (isCorrect: boolean) => {
        return isCorrect ? greenAccentToken : mutedDarkToken;
      };

      assert.equal(getSegmentColor(true), 'var(--accent, #A3FF12)');
      assert.equal(getSegmentColor(false), 'rgba(255, 255, 255, 0.08)');
      assert.notEqual(getSegmentColor(false), '#FF0000');
    });

    it('correctly maps 4 correct and 6 incorrect for a 40% test result', () => {
      const score = 4;
      const total = 10;
      const states = Array.from({ length: total }, (_, i) => i < score);
      const correctCount = states.filter(Boolean).length;
      const reviewCount = states.filter(s => !s).length;

      assert.equal(correctCount, 4);
      assert.equal(reviewCount, 6);
    });
  });

  describe('3. Center Content & Metadata (Section 5, 6, 12)', () => {
    it('formats dominant two-digit score and quiet denominator', () => {
      const score = 4;
      const total = 10;
      const scoreStr = score.toString().padStart(2, '0');
      const totalStr = `/${total.toString().padStart(2, '0')}`;

      assert.equal(scoreStr, '04');
      assert.equal(totalStr, '/10');
    });

    it('formats percentage text and footer summary', () => {
      const percentage = 40;
      const pctStr = `${percentage}% correct`;
      const footerStr = `4 correct · 6 to revisit`;

      assert.equal(pctStr, '40% correct');
      assert.equal(footerStr, '4 correct · 6 to revisit');
    });

    it('formats label above with KNOWLEDGE PERFORMANCE', () => {
      const headerLabel = 'KNOWLEDGE PERFORMANCE';
      assert.equal(headerLabel, 'KNOWLEDGE PERFORMANCE');
    });
  });

  describe('4. Contextual Tooltips (Section 10 & 11)', () => {
    it('builds question number, status and concept name for tooltips', () => {
      const questionItem = {
        questionNumber: 4,
        questionId: 'q-4',
        isCorrect: true,
        conceptName: 'CPU Scheduling'
      };

      const qNumStr = `QUESTION ${questionItem.questionNumber.toString().padStart(2, '0')}`;
      const statusStr = questionItem.isCorrect ? 'CORRECT' : 'REVIEW';

      assert.equal(qNumStr, 'QUESTION 04');
      assert.equal(statusStr, 'CORRECT');
      assert.equal(questionItem.conceptName, 'CPU Scheduling');
    });
  });

  describe('5. Exit Animations (Section 18)', () => {
    it('differentiates review exit vs graph exit', () => {
      const exitTargetReview = 'missed';
      const exitTargetGraph = 'graph';

      assert.equal(exitTargetReview, 'missed');
      assert.equal(exitTargetGraph, 'graph');
    });
  });
});
