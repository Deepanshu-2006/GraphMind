import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Study Space Circular Chart — Rolling Slot-Digit Number Animation', () => {
  const slotDigitPath = path.resolve(__dirname, '../src/components/common/SlotDigit.tsx');
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const circularScorePath = path.resolve(__dirname, '../src/components/study/CircularScore.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const slotDigitSrc = fs.readFileSync(slotDigitPath, 'utf8');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const circularScoreSrc = fs.readFileSync(circularScorePath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Reusable SlotDigit Component Implementation', () => {
    it('exports SlotDigit component with support for rolling column transitions', () => {
      assert.ok(slotDigitSrc.includes('export const SlotDigit'), 'Must export SlotDigit component');
      assert.ok(slotDigitSrc.includes('NUMERALS_WITH_WRAP'), 'Must define NUMERALS_WITH_WRAP for full-cycle rolls');
      assert.ok(slotDigitSrc.includes('NUMERALS_STANDARD'), 'Must define standard 0-9 numerals');
    });

    it('implements wrap reel handling for trailing zero rolls (e.g. 80%)', () => {
      assert.ok(slotDigitSrc.includes('useWrap = spinIfZero && safeDigit === 0'), 'Must identify wrap condition when spinIfZero is true');
      assert.ok(slotDigitSrc.includes('targetIndex = useWrap ? 10 : safeDigit'), 'Must target index 10 when wrapping so 0 spins full cycle');
      assert.ok(slotDigitSrc.includes('targetY = `-${(targetIndex / total) * 100}%`'), 'Must calculate exact fractional translateY offset');
    });

    it('respects prefers-reduced-motion accessibility', () => {
      assert.ok(slotDigitSrc.includes('if (shouldReduceMotion)'), 'Must check shouldReduceMotion flag');
      assert.ok(slotDigitSrc.includes('aria-hidden="true"'), 'Must hide slot columns from duplicate screen reader announcement');
    });
  });

  describe('2. Study Space View Integration', () => {
    it('imports SlotDigit into StudySpaceView', () => {
      assert.ok(studyViewSrc.includes("import { SlotDigit } from '../common/SlotDigit'"), 'StudySpaceView must import SlotDigit');
    });

    it('derives scoreDigits array from clamped score', () => {
      assert.ok(studyViewSrc.includes('const scoreDigits = useMemo('), 'Must derive scoreDigits from clampedScore');
      assert.ok(studyViewSrc.includes("String(clampedScore).split('').map(Number)"), 'Must split score into individual digit values');
    });

    it('renders SlotDigit for each score digit inside study-continue-score-pct', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-score-digits"'), 'Must wrap digits in study-continue-score-digits');
      assert.ok(studyViewSrc.includes('<SlotDigit'), 'Must render SlotDigit components');
      assert.ok(studyViewSrc.includes('spinIfZero={clampedScore > 0 && digit === 0}'), 'Must pass spinIfZero to spin trailing 0s dynamically');
      assert.ok(studyViewSrc.includes('className="study-continue-pct-symbol"'), 'Must render percentage symbol');
      assert.ok(studyViewSrc.includes('{displayedScore}%'), 'Must maintain accessible text fallback');
    });
  });

  describe('3. CircularScore Standalone Component Integration', () => {
    it('imports and integrates SlotDigit in CircularScore', () => {
      assert.ok(circularScoreSrc.includes("import { SlotDigit } from '../common/SlotDigit'"), 'CircularScore must import SlotDigit');
      assert.ok(circularScoreSrc.includes('<SlotDigit'), 'CircularScore must render SlotDigit');
      assert.ok(circularScoreSrc.includes('className="study-continue-score-pct"'), 'CircularScore must maintain score percentage class');
    });
  });

  describe('4. CSS Typography, Alignment & Hardware-Accelerated Transforms', () => {
    it('styles study-continue-score-pct with baseline alignment and tabular numerals', () => {
      assert.match(
        studyCss,
        /\.study-continue-score-pct\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*baseline;[\s\S]*?justify-content:\s*center;/
      );
    });

    it('defines styles for slot digit containers, columns and numerals', () => {
      assert.match(
        studyCss,
        /\.study-continue-slot-digit\s*\{[\s\S]*?display:\s*inline-block;[\s\S]*?height:\s*0\.9em;[\s\S]*?overflow:\s*hidden;[\s\S]*?vertical-align:\s*baseline;/
      );
      assert.match(
        studyCss,
        /\.study-continue-slot-column\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?will-change:\s*transform;/
      );
      assert.match(
        studyCss,
        /\.study-continue-slot-numeral\s*\{[\s\S]*?display:\s*block;[\s\S]*?height:\s*0\.9em;[\s\S]*?text-align:\s*center;/
      );
    });

    it('styles percentage symbol with optical baseline alignment', () => {
      assert.match(
        studyCss,
        /\.study-continue-pct-symbol\s*\{[\s\S]*?display:\s*inline-block;[\s\S]*?vertical-align:\s*baseline;/
      );
    });
  });
});
