import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Cinematic TIME\'S UP Transition — Architecture & Orchestration', () => {
  const testWorkspacePath = path.join(process.cwd(), 'src/components/test/TestWorkspace.tsx');
  const bigTimerPath = path.join(process.cwd(), 'src/components/test/BigTimer.tsx');
  const timeUpPath = path.join(process.cwd(), 'src/components/test/TimeUpScreen.tsx');
  const testCssPath = path.join(process.cwd(), 'src/styles/test.css');

  const testWorkspaceContent = fs.readFileSync(testWorkspacePath, 'utf-8');
  const bigTimerContent = fs.readFileSync(bigTimerPath, 'utf-8');
  const timeUpContent = fs.readFileSync(timeUpPath, 'utf-8');
  const testCssContent = fs.readFileSync(testCssPath, 'utf-8');

  describe('PHASE 1 — The Final Countdown & Sole Visual Focus', () => {
    it('triggers the cinematic transition sequence only when remaining time hits 00:00', () => {
      assert.ok(
        testWorkspaceContent.includes('if (remaining <= 0) {') &&
        testWorkspaceContent.includes('setIsTimerActive(false);') &&
        testWorkspaceContent.includes('handleTimeExpired();'),
        'Countdown must halt and trigger handleTimeExpired at 00:00'
      );
    });

    it('pauses the clock at 00:00 and fades the surrounding assessment interface into darkness', () => {
      assert.ok(
        testWorkspaceContent.includes('setRemainingSeconds(0);') &&
        testWorkspaceContent.includes("setTimeTransitionPhase('receding');"),
        'Remaining seconds must be clamped to 0 and interface must transition to receding'
      );
      assert.ok(
        testWorkspaceContent.includes('is-transition-receding'),
        'Must apply is-transition-receding to receding assessment canvas and exit button'
      );
      assert.ok(
        testCssContent.includes('.test-workspace-content-canvas.is-transition-receding') &&
        testCssContent.includes('opacity: 0 !important;') &&
        testCssContent.includes('pointer-events: none !important;'),
        'Content canvas must cleanly fade to 0 opacity without pointer events'
      );
      assert.ok(
        testCssContent.includes('.topbar-exit-anchor.is-transition-receding') &&
        testCssContent.includes('opacity: 0 !important;'),
        'Exit button must fade down smoothly during transition'
      );
    });
  });

  describe('PHASE 2 — The Actual Timer Clock Takes Over', () => {
    it('animates the ACTUAL timer instance in the topbar anchor rather than creating a duplicate clock', () => {
      assert.ok(
        testWorkspaceContent.includes('ref={timerAnchorRef}') &&
        testWorkspaceContent.includes('className={`topbar-timer-anchor ${') &&
        testWorkspaceContent.includes("timeTransitionPhase !== 'idle' ? 'is-transitioning-timer' : ''"),
        'The actual topbar-timer-anchor must be animated directly via timerAnchorRef'
      );
      assert.ok(
        testCssContent.includes('.topbar-timer-anchor.is-transitioning-timer') &&
        testCssContent.includes('z-index: 1000;') &&
        testCssContent.includes('transform-origin: center center;') &&
        testCssContent.includes('will-change: transform, opacity;'),
        'Animated timer anchor must sit at z-index: 1000 with center transform origin and hardware acceleration'
      );
    });

    it('calculates the exact delta from current topbar position to the visual center of the viewport', () => {
      assert.ok(
        testWorkspaceContent.includes('const rect = timerAnchorRef.current?.getBoundingClientRect();') &&
        testWorkspaceContent.includes('const currentCenterX = rect.left + rect.width / 2;') &&
        testWorkspaceContent.includes('const currentCenterY = rect.top + rect.height / 2;') &&
        testWorkspaceContent.includes('const targetCenterX = window.innerWidth / 2;') &&
        testWorkspaceContent.includes('x: targetCenterX - currentCenterX') &&
        testWorkspaceContent.includes('y: targetCenterY - currentCenterY'),
        'Must measure getBoundingClientRect and dynamically calculate viewport center offset'
      );
    });

    it('enlarges the timer smoothly toward the visual center using GPU transforms', () => {
      assert.ok(
        testWorkspaceContent.includes("timeTransitionPhase === 'centering'") &&
        testWorkspaceContent.includes('scale: typeof window !== \'undefined\' && window.innerWidth < 600 ? 1.8 : 2.2') &&
        testWorkspaceContent.includes('duration: 0.7') &&
        testWorkspaceContent.includes('ease: [0.16, 1, 0.3, 1]'),
        'Must coordinate translate-and-scale with duration 0.7s and GraphMind cubic bezier curve'
      );
    });

    it('holds the enlarged 00:00 briefly and transitions digits to restrained GraphMind lime-green accent', () => {
      assert.ok(
        testWorkspaceContent.includes("timeTransitionPhase === 'hold'") &&
        testWorkspaceContent.includes("isTransitionAccent={timeTransitionPhase === 'hold' || timeTransitionPhase === 'dissolve'}"),
        'Must transition to hold phase and activate isTransitionAccent'
      );
      assert.ok(
        bigTimerContent.includes('isTransitionAccent?: boolean;') &&
        bigTimerContent.includes('isTransitionAccent ? \'timer-transition-accent\' : \'\''),
        'BigTimer must accept and apply timer-transition-accent class'
      );
      assert.ok(
        testCssContent.includes('.big-timer-container.timer-transition-accent .big-timer-digits') &&
        testCssContent.includes('color: var(--accent, #B8FF3D) !important;') &&
        testCssContent.includes('animation: none !important;'),
        'Timer digits must take GraphMind lime-green #B8FF3D accent and stop warning pulse during hold'
      );
    });

    it('fades out the secondary label and dissolves the clock with slight upward movement into darkness', () => {
      assert.ok(
        testCssContent.includes('.big-timer-container.is-transitioning .big-timer-label') &&
        testCssContent.includes('opacity: 0;'),
        'Secondary TIME REMAINING label must fade away during transition'
      );
      assert.ok(
        testWorkspaceContent.includes("timeTransitionPhase === 'dissolve'") &&
        testWorkspaceContent.includes('y: timerTargetDelta.y - 18') &&
        testWorkspaceContent.includes('opacity: 0'),
        'Dissolve phase must translate slightly upward (y - 18) and fade opacity to 0'
      );
    });
  });

  describe('PHASE 3 & 4 — Sequential TIME\'S UP Reveal & Coordinated Motion', () => {
    it('reveals TimeUpScreen only after the clock dissolve phase completes', () => {
      assert.ok(
        testWorkspaceContent.includes("setTimeTransitionPhase('dissolve');") &&
        testWorkspaceContent.includes("setTimeTransitionPhase('done');") &&
        testWorkspaceContent.includes("setMode('timeup');"),
        'TimeUpScreen mode must only be set after dissolve phase finishes'
      );
    });

    it('reveals TIME\'S and UP. using a refined vertical clip/mask reveal with separate lines and connected period', () => {
      assert.ok(
        timeUpContent.includes('test-timeup-title-line-mask') &&
        timeUpContent.includes('headingLine1Variants') &&
        timeUpContent.includes('headingLine2Variants'),
        'Heading lines must be wrapped in clip mask containers with individual animation variants'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-title-line-mask') &&
        testCssContent.includes('overflow: hidden;') &&
        testCssContent.includes('line-height: 0.84;'),
        'Line mask container must use overflow: hidden for vertical clip reveal'
      );
      assert.ok(
        timeUpContent.includes('y: shouldReduceMotion ? 0 : \'100%\'') &&
        timeUpContent.includes('y: \'0%\''),
        'Title lines must translate from 100% (hidden below mask edge) to 0%'
      );
      assert.ok(
        timeUpContent.includes('UP<span className="test-timeup-period" aria-hidden="true">.</span>'),
        'Period must remain connected to UP'
      );
    });

    it('reveals supporting copy, metadata context, and VIEW RESULTS with signature underline interaction in sequence', () => {
      assert.ok(
        timeUpContent.includes('test-timeup-message') &&
        timeUpContent.includes('test-timeup-context-row') &&
        timeUpContent.includes('test-timeup-action-btn') &&
        timeUpContent.includes('test-timeup-action-underline'),
        'TimeUpScreen must contain message, context, action button, and animated underline'
      );
    });
  });

  describe('PHASE 5 & 6 — Functional Correctness, Single-Submission, & Edge Cases', () => {
    it('submits assessment exactly once upon expiration and prevents duplicate submission', () => {
      assert.ok(
        testWorkspaceContent.includes('if (!test || hasSubmittedRef.current || isTransitionTriggeredRef.current) return;') &&
        testWorkspaceContent.includes('hasSubmittedRef.current = true;') &&
        testWorkspaceContent.includes('isTransitionTriggeredRef.current = true;'),
        'Must guard against duplicate submission using ref locks'
      );
      assert.ok(
        testWorkspaceContent.includes('const summary = recordKnowledgeTestCompletion(test, answers, timeSpent);') &&
        testWorkspaceContent.includes('setResultsSummary(summary);'),
        'Must calculate and store resultsSummary immediately upon expiration'
      );
    });

    it('does not trigger TIME\'S UP transition on manual exit or early submission', () => {
      assert.ok(
        testWorkspaceContent.includes('const handleConfirmSubmit = useCallback(() => {') &&
        testWorkspaceContent.includes("setMode('results');"),
        'Early submission must transition directly to results without triggering time-up animation'
      );
      // Ensure handleConfirmSubmit doesn't trigger timeTransitionPhase
      const submitStart = testWorkspaceContent.indexOf('const handleConfirmSubmit');
      const submitEnd = testWorkspaceContent.indexOf('}, [test, answers, onPracticeStatesUpdated, clearTransitionTimeouts]);');
      const submitBody = testWorkspaceContent.substring(submitStart, submitEnd);
      assert.ok(
        !submitBody.includes('setTimeTransitionPhase'),
        'Submit handler must never trigger time-up transition phases'
      );
    });

    it('respects prefers-reduced-motion by bypassing the large clock movement directly to timeup mode', () => {
      assert.ok(
        testWorkspaceContent.includes('if (shouldReduceMotion) {') &&
        testWorkspaceContent.includes("setTimeTransitionPhase('done');") &&
        testWorkspaceContent.includes("setMode('timeup');"),
        'Reduced motion preference must immediately transition to timeup mode without running the clock animation'
      );
    });

    it('safely cleans up all transition timers on unmount', () => {
      assert.ok(
        testWorkspaceContent.includes('const clearTransitionTimeouts = useCallback(() => {') &&
        testWorkspaceContent.includes('transitionTimeoutsRef.current.forEach(t => clearTimeout(t));') &&
        testWorkspaceContent.includes('clearTransitionTimeouts();'),
        'Must clean up pending transition timeouts on unmount and test restart'
      );
    });
  });
});
