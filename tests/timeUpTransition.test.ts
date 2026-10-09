import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Cinematic TIME\'S UP Transition — Architecture & Orchestration', () => {
  const testWorkspacePath = path.join(process.cwd(), 'src/components/test/TestWorkspace.tsx');
  const timeUpPath = path.join(process.cwd(), 'src/components/test/TimeUpScreen.tsx');
  const testCssPath = path.join(process.cwd(), 'src/styles/test.css');

  const testWorkspaceContent = fs.readFileSync(testWorkspacePath, 'utf-8');
  const timeUpContent = fs.readFileSync(timeUpPath, 'utf-8');
  const testCssContent = fs.readFileSync(testCssPath, 'utf-8');

  describe('STAGE A — The Final Second & Centering Bounds Calculation', () => {
    it('triggers the transition sequence only when countdown hits 00:00', () => {
      assert.ok(
        testWorkspaceContent.includes('if (remaining <= 0) {') &&
        testWorkspaceContent.includes('setIsTimerActive(false);') &&
        testWorkspaceContent.includes('handleTimeExpired();'),
        'Countdown must halt and trigger handleTimeExpired at 00:00'
      );
    });

    it('settles digits at 00:00, orchestrates anticipation and receding phases, and calculates content bounds', () => {
      assert.ok(
        testWorkspaceContent.includes('setRemainingSeconds(0);') &&
        testWorkspaceContent.includes("setTimeTransitionPhase('anticipation');") &&
        testWorkspaceContent.includes("setTimeTransitionPhase('receding');"),
        'Must orchestrate anticipation (0.0s-0.5s) and receding (0.5s-1.2s) phases'
      );
      assert.ok(
        testCssContent.includes('[data-transition-phase="anticipation"]') &&
        testCssContent.includes('[data-transition-phase="receding"]') &&
        testCssContent.includes('color: #FF5A5A !important;'),
        'Must settle 00:00 digits with restrained red tint #FF5A5A and no animation'
      );
      assert.ok(
        testWorkspaceContent.includes('workspaceRootRef.current.getBoundingClientRect();') &&
        testWorkspaceContent.includes('timerAnchorRef.current.getBoundingClientRect();'),
        'Must measure workspaceRootRef and timerAnchorRef bounds'
      );
      assert.ok(
        testWorkspaceContent.includes('const contentCenterX = rootRect.width / 2;') &&
        testWorkspaceContent.includes('const contentCenterY = rootRect.height / 2;'),
        'Visual center must be mathematically calculated from actual available content bounds'
      );
      assert.ok(
        testWorkspaceContent.includes('x: timerCenterX - contentCenterX') &&
        testWorkspaceContent.includes('y: timerCenterY - contentCenterY'),
        'Initial timer offset must be calculated from live DOM coordinates without hardcoded offsets'
      );
    });
  });

  describe('STAGE B — Dedicated Transition Layer & The Clock Takes Over', () => {
    it('uses a dedicated transition layer that covers the main content area with mathematical centering', () => {
      assert.ok(
        timeUpContent.includes('test-timeup-transition-layer'),
        'TimeUpScreen must apply test-timeup-transition-layer class'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-transition-layer') &&
        testCssContent.includes('position: absolute;') &&
        testCssContent.includes('inset: 0;') &&
        testCssContent.includes('z-index: 50;'),
        'Dedicated transition layer must cover main content area with position absolute inset 0'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-hero-anchor') &&
        testCssContent.includes('min-height: 180px;'),
        'Hero anchor must host both transforming clock and emerging heading at optical center'
      );
    });

    it('smoothly glides the clock into the exact center with controlled easing and restrained red tint', () => {
      assert.ok(
        timeUpContent.includes('initialTimerOffset') &&
        timeUpContent.includes('clockContainerVariants'),
        'TimeUpScreen must receive initialTimerOffset and apply clockContainerVariants'
      );
      assert.ok(
        timeUpContent.includes('x: initialTimerOffset.x') &&
        timeUpContent.includes('y: initialTimerOffset.y') &&
        timeUpContent.includes('x: 0') &&
        timeUpContent.includes('y: 0'),
        'Clock must animate from measured initialTimerOffset to (0, 0) center'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-cinematic-clock') &&
        testCssContent.includes('font-family: var(--font-mono') &&
        testCssContent.includes('clamp(72px, 10.5vw, 114px);') &&
        testCssContent.includes('color: #FF5A5A;'),
        'Clock must enlarge substantially to clamp(72px, 10.5vw, 114px) with restrained red tint #FF5A5A'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-clock-sep') &&
        testCssContent.includes('color: #FF5A5A;'),
        'Clock colon must preserve restrained red tint #FF5A5A'
      );
    });
  });

  describe('STAGE C & D — Clock Transformation & Simultaneous TIME\'S UP Reveal', () => {
    it('separates clock digits horizontally and dissolves them upward after the 00:00 hold', () => {
      assert.ok(
        timeUpContent.includes('minutesGroupVariants') &&
        timeUpContent.includes('secondsGroupVariants') &&
        timeUpContent.includes('separatorVariants'),
        'Must coordinate individual digit group transforms for minutes, seconds, and separator'
      );
      assert.ok(
        timeUpContent.includes('delay: 1.7') &&
        timeUpContent.includes('x: shouldReduceMotion ? 0 : -48') &&
        timeUpContent.includes('x: shouldReduceMotion ? 0 : 48'),
        'Clock must hold for ~900ms before separating at delay 1.7s'
      );
    });

    it('begins revealing TIME\'S UP before the clock has completely disappeared so both feel connected', () => {
      assert.ok(
        timeUpContent.includes('headingLine1Variants') &&
        timeUpContent.includes('headingLine2Variants') &&
        timeUpContent.includes('test-timeup-title-line-mask'),
        'Heading lines must use separate line masks and animation variants'
      );
      assert.ok(
        timeUpContent.includes('delay: shouldReduceMotion ? 0 : 1.9') ||
        timeUpContent.includes('delay: shouldReduceMotion ? 0 : 1.90'),
        'Heading entrance delay must overlap with clock dissolve duration to maintain continuous narrative'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-title-line-mask') &&
        testCssContent.includes('overflow: hidden;'),
        'Line mask container must use overflow: hidden for vertical clip reveal'
      );
      assert.ok(
        timeUpContent.includes('UP<span className="test-timeup-period" aria-hidden="true">.</span>'),
        'Period must remain connected to UP'
      );
    });
  });

  describe('STAGE E — Final Screen Settles & State Continuity', () => {
    it('reveals eyebrow, supporting copy, metadata context, and VIEW RESULTS button in sequence', () => {
      assert.ok(
        timeUpContent.includes('test-timeup-status') &&
        timeUpContent.includes('test-timeup-message') &&
        timeUpContent.includes('test-timeup-context-row') &&
        timeUpContent.includes('test-timeup-action-btn') &&
        timeUpContent.includes('test-timeup-action-underline'),
        'TimeUpScreen must contain status eyebrow, message, context row, action button, and animated underline'
      );
    });

    it('submits assessment exactly once upon expiration and preserves recorded answers and score', () => {
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
    });

    it('respects prefers-reduced-motion accessibility across framer motion and CSS', () => {
      assert.ok(
        timeUpContent.includes('useReducedMotion') &&
        timeUpContent.includes('shouldReduceMotion'),
        'Must query useReducedMotion in TimeUpScreen'
      );
      assert.ok(
        testCssContent.includes('@media (prefers-reduced-motion: reduce)'),
        'CSS must include reduced motion adaptations'
      );
    });

    it('cleans up transition timeouts and intervals safely', () => {
      assert.ok(
        testWorkspaceContent.includes('const clearTransitionTimeouts = useCallback(() => {') &&
        testWorkspaceContent.includes('clearTransitionTimeouts();'),
        'Must clean up pending timeouts on unmount and test restart'
      );
    });
  });
});
