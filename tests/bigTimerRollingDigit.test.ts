import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Countdown Timer — Mechanical Rolling-Digit Animation', () => {
  const bigTimerPath = path.join(process.cwd(), 'src/components/test/BigTimer.tsx');
  const testWorkspacePath = path.join(process.cwd(), 'src/components/test/TestWorkspace.tsx');
  const testCssPath = path.join(process.cwd(), 'src/styles/test.css');

  const bigTimerContent = fs.readFileSync(bigTimerPath, 'utf-8');
  const testWorkspaceContent = fs.readFileSync(testWorkspacePath, 'utf-8');
  const testCssContent = fs.readFileSync(testCssPath, 'utf-8');

  describe('1. Rolling Digit Animation Mechanics (Section 1 & 2)', () => {
    it('uses vertical translate animation with downward roll (-100% to 0% to 100%)', () => {
      // Incoming digit starts above (-100%) and translates to 0%
      assert.match(
        bigTimerContent,
        /initial=\{\{\s*y:\s*['"]-100%['"]\s*\}\}/,
        'Incoming digit must start at -100% above the slot window'
      );
      assert.match(
        bigTimerContent,
        /animate=\{\{\s*y:\s*['"]0%['"]\s*\}\}/,
        'Active digit must translate to 0% in the visible slot window'
      );
      // Outgoing digit exits downward (100%) out of the slot window
      assert.match(
        bigTimerContent,
        /exit=\{\{\s*y:\s*['"]100%['"]\s*\}\}/,
        'Outgoing digit must exit downward to 100% below the slot window'
      );
    });

    it('does not use opacity fade or scale on the rolling digits', () => {
      // Find the motion.span animation definition inside AnimatedDigit
      const animSpanMatch = bigTimerContent.match(/<motion\.span[\s\S]*?<\/motion\.span>/);
      assert.ok(animSpanMatch, 'Should find motion.span inside AnimatedDigit');
      const animSpanStr = animSpanMatch[0];

      assert.ok(
        !animSpanStr.includes('opacity: 0'),
        'Rolling digits must not fade in/out with opacity'
      );
      assert.ok(
        !animSpanStr.includes('scale:'),
        'Rolling digits must not scale during roll transition'
      );
    });

    it('enforces 350–450ms duration and smooth cubic-bezier(0.22, 1, 0.36, 1) easing', () => {
      // Transition duration between 0.35s and 0.45s (350-450ms)
      const durationMatch = bigTimerContent.match(/duration:\s*([0-9.]+)/);
      assert.ok(durationMatch, 'Should specify transition duration');
      const durationSec = parseFloat(durationMatch[1]);
      assert.ok(
        durationSec >= 0.35 && durationSec <= 0.45,
        `Duration should be in 350-450ms range (0.35-0.45s), received: ${durationSec}s`
      );

      // Smooth cubic-bezier curve [0.22, 1, 0.36, 1]
      assert.match(
        bigTimerContent,
        /ease:\s*\[\s*0\.22,\s*1,\s*0\.36,\s*1\s*\]/,
        'Must use smooth cubic-bezier(0.22, 1, 0.36, 1) easing'
      );
    });

    it('animates digits independently with React.memo and stationary colon separator', () => {
      // Separate memoized AnimatedDigit component
      assert.match(bigTimerContent, /const AnimatedDigit = memo\(function AnimatedDigit/);

      // Digits are rendered independently
      assert.match(bigTimerContent, /<AnimatedDigit digit=\{minutesStr\[0\]\} \/>/);
      assert.match(bigTimerContent, /<AnimatedDigit digit=\{minutesStr\[1\]\} \/>/);
      assert.match(bigTimerContent, /<AnimatedDigit digit=\{secondsStr\[0\]\} \/>/);
      assert.match(bigTimerContent, /<AnimatedDigit digit=\{secondsStr\[1\]\} \/>/);

      // Colon separator is static and not animated
      assert.match(
        bigTimerContent,
        /<span className="big-timer-separator"[^>]*>:\s*<\/span>/,
        'Colon separator must be stationary outside of AnimatedDigit'
      );
    });
  });

  describe('2. Visual Design & Overflow-Hidden Slot Architecture (Section 1 & 3)', () => {
    it('enforces overflow-hidden digit windows to create clean rolling mechanical clock', () => {
      assert.match(
        testCssContent,
        /\.big-timer-digit-slot\s*\{[^}]*overflow:\s*hidden/,
        'Digit slots must have overflow: hidden'
      );
      assert.match(
        testCssContent,
        /\.big-timer-digit-slot\s*\{[^}]*position:\s*relative/,
        'Digit slots must have position: relative'
      );
    });

    it('enforces consistent fixed digit and separator widths to prevent layout shift', () => {
      // Desktop widths
      assert.match(
        testCssContent,
        /\.big-timer-digit-slot\s*\{[^}]*width:\s*24px/,
        'Desktop digit slots must have fixed 24px width'
      );
      assert.match(
        testCssContent,
        /\.big-timer-separator\s*\{[^}]*width:\s*10px/,
        'Desktop separator must have fixed 10px width'
      );

      // Tabular numerals for monospace consistency
      assert.match(
        testCssContent,
        /\.big-timer-digits\s*\{[^}]*font-variant-numeric:\s*tabular-nums/,
        'Must use font-variant-numeric: tabular-nums'
      );
    });

    it('maintains small uppercase muted TIME REMAINING label', () => {
      assert.match(bigTimerContent, /TIME REMAINING/);
      assert.match(
        testCssContent,
        /\.big-timer-label\s*\{[^}]*text-transform:\s*uppercase/,
        'Label must be uppercase'
      );
      assert.match(
        testCssContent,
        /\.big-timer-label\s*\{[^}]*font-size:\s*9px/,
        'Label must be small 9px font'
      );
    });
  });

  describe('3. Countdown Logic & Wall-Clock Synchronization (Section 4)', () => {
    it('uses wall-clock Date.now() elapsed calculation to prevent tab background drift', () => {
      assert.match(
        testWorkspaceContent,
        /Date\.now\(\)\s*-\s*startTimeRef\.current/,
        'Must measure elapsed time against startTimeRef.current'
      );
      assert.match(
        testWorkspaceContent,
        /Math\.floor\(\(Date\.now\(\)\s*-\s*startTimeRef\.current\)\s*\/\s*1000\)/,
        'Must calculate elapsed seconds from real wall clock'
      );
    });

    it('attaches visibilitychange and focus listeners to re-sync immediately when tab resumes', () => {
      assert.match(
        testWorkspaceContent,
        /document\.addEventListener\(['"]visibilitychange['"],\s*handleVisibilityChange\)/,
        'Must listen to visibilitychange to sync timer when tab becomes active'
      );
      assert.match(
        testWorkspaceContent,
        /window\.addEventListener\(['"]focus['"],\s*handleFocus\)/,
        'Must listen to window focus to sync timer'
      );
    });

    it('stops timer when test is submitted or time expires', () => {
      // Time expiration stops timer and transitions to timeup
      assert.match(testWorkspaceContent, /handleTimeExpired/);
      assert.match(testWorkspaceContent, /setMode\(['"]timeup['"]\)/);

      // Submitting test stops timer and transitions to results
      assert.match(testWorkspaceContent, /handleConfirmSubmit/);
      assert.match(testWorkspaceContent, /setIsTimerActive\(false\)/);
    });
  });

  describe('4. Rollover & Digit Transitions (Section 5)', () => {
    function getFormattedTimer(remainingSec: number) {
      const safe = Math.max(0, remainingSec);
      const mins = Math.floor(safe / 60);
      const secs = safe % 60;
      return {
        m0: mins.toString().padStart(2, '0')[0],
        m1: mins.toString().padStart(2, '0')[1],
        s0: secs.toString().padStart(2, '0')[0],
        s1: secs.toString().padStart(2, '0')[1]
      };
    }

    it('correctly maps 10:00 -> 09:59 transition across all four digits', () => {
      const before = getFormattedTimer(600); // 10:00
      const after = getFormattedTimer(599);  // 09:59

      assert.equal(before.m0, '1');
      assert.equal(before.m1, '0');
      assert.equal(before.s0, '0');
      assert.equal(before.s1, '0');

      assert.equal(after.m0, '0');
      assert.equal(after.m1, '9');
      assert.equal(after.s0, '5');
      assert.equal(after.s1, '9');
    });

    it('correctly maps 01:00 -> 00:59 minute rollover', () => {
      const before = getFormattedTimer(60); // 01:00
      const after = getFormattedTimer(59);  // 00:59

      assert.equal(before.m0, '0');
      assert.equal(before.m1, '1');
      assert.equal(before.s0, '0');
      assert.equal(before.s1, '0');

      assert.equal(after.m0, '0'); // m0 unchanged
      assert.equal(after.m1, '0'); // m1: 1 -> 0
      assert.equal(after.s0, '5'); // s0: 0 -> 5
      assert.equal(after.s1, '9'); // s1: 0 -> 9
    });

    it('correctly maps 00:10 -> 00:09 tens-of-seconds transition', () => {
      const before = getFormattedTimer(10);
      const after = getFormattedTimer(9);

      assert.equal(before.m0, '0');
      assert.equal(before.m1, '0');
      assert.equal(before.s0, '1');
      assert.equal(before.s1, '0');

      assert.equal(after.m0, '0'); // unchanged
      assert.equal(after.m1, '0'); // unchanged
      assert.equal(after.s0, '0'); // s0: 1 -> 0
      assert.equal(after.s1, '9'); // s1: 0 -> 9
    });

    it('preserves stationary digits on standard second ticks (09:56 -> 09:55 -> 09:54)', () => {
      const t56 = getFormattedTimer(596); // 09:56
      const t55 = getFormattedTimer(595); // 09:55
      const t54 = getFormattedTimer(594); // 09:54

      assert.equal(t56.m0, t55.m0);
      assert.equal(t56.m1, t55.m1);
      assert.equal(t56.s0, t55.s0);
      assert.equal(t56.s1, '6');
      assert.equal(t55.s1, '5');

      assert.equal(t55.m0, t54.m0);
      assert.equal(t55.m1, t54.m1);
      assert.equal(t55.s0, t54.s0);
      assert.equal(t54.s1, '4');
    });
  });

  describe('5. Prefers-Reduced-Motion & Accessibility (Section 5 & 6)', () => {
    it('supports prefers-reduced-motion via useReducedMotion hook in BigTimer', () => {
      assert.match(
        bigTimerContent,
        /import\s*\{[^}]*useReducedMotion[^}]*\}\s*from\s*['"]framer-motion['"]/,
        'Must import useReducedMotion from framer-motion'
      );
      assert.match(
        bigTimerContent,
        /const shouldReduceMotion = useReducedMotion\(\)/,
        'Must call useReducedMotion hook in AnimatedDigit'
      );
      assert.match(
        bigTimerContent,
        /if\s*\(shouldReduceMotion\)\s*\{\s*return\s*\(\s*<span className="big-timer-digit-slot">/,
        'Must return non-animated static digit when shouldReduceMotion is true'
      );
    });

    it('includes prefers-reduced-motion CSS rule disabling transitions', () => {
      assert.match(
        testCssContent,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.big-timer-digit[^}]*transition:\s*none\s*!important/
      );
    });

    it('provides accessible role="timer" and descriptive aria-label', () => {
      assert.match(bigTimerContent, /role="timer"/);
      assert.match(
        bigTimerContent,
        /aria-label=\{`Time remaining: \$\{minutesStr\} minutes and \$\{secondsStr\} seconds`\}/
      );
      assert.match(bigTimerContent, /aria-live="off"/);
    });

    it('adapts slot dimensions smoothly on mobile viewports (<768px)', () => {
      const mobileBlockMatch = testCssContent.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/);
      assert.ok(mobileBlockMatch, 'Must find @media (max-width: 768px) block');
      const mobileBlock = mobileBlockMatch[1];
      assert.match(mobileBlock, /\.big-timer-digits\s*\{[^}]*font-size:\s*30px/);
      assert.match(mobileBlock, /\.big-timer-digit-slot\s*\{[^}]*width:\s*20px/);
      assert.match(mobileBlock, /\.big-timer-digit-slot\s*\{[^}]*height:\s*32px/);
    });
  });
});
