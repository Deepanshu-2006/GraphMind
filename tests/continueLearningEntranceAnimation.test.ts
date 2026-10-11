import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND CONTINUE LEARNING — SOPHISTICATED TYPOGRAPHY ENTRANCE ANIMATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Eyebrow — Subtle Horizontal Clipping Reveal (0.00–0.04s)', () => {
    it('reveals CONTINUE LEARNING kicker through a horizontal clipping mask emerging left-to-right', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-kicker-clip"'), 'Must have clipping container');
      assert.ok(studyViewSrc.includes('className="study-continue-kicker"'), 'Must have kicker element');
      assert.ok(
        studyViewSrc.includes("clipPath: 'inset(0 100% 0 0)'"),
        'Kicker must start masked horizontally at inset(0 100% 0 0)'
      );
      assert.ok(
        studyViewSrc.includes("clipPath: 'inset(0 0% 0 0)'"),
        'Kicker must reveal to inset(0 0% 0 0)'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, delay: 0.04, ease: REVEAL_EASE }}"),
        'Kicker must use relaxed 0.48s duration starting at 0.04s'
      );
    });

    it('defines CSS tokens for horizontal clipping container and performance optimization', () => {
      assert.match(
        studyCss,
        /\.study-continue-kicker-clip\s*\{[\s\S]*?overflow:\s*hidden;/,
        'Kicker clip container must have overflow: hidden'
      );
      assert.match(
        studyCss,
        /\.study-continue-kicker\s*\{[\s\S]*?will-change:[\s\S]*?clip-path;/,
        'Kicker must optimize clip-path'
      );
    });
  });

  describe('2. Main Heading — Hero Line-Level Vertical Reveal (0.12s)', () => {
    it('reveals main heading through vertical clipping mask without altering font or line wrapping (0.12s)', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-title-clip"'), 'Must have clipping container');
      assert.ok(studyViewSrc.includes('className="study-continue-title-line"'), 'Must have animated line span');
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}"),
        'Heading line must start masked below at y: 105%'
      );
      assert.ok(
        studyViewSrc.includes("animate={hasContinueEnteredView ? { opacity: 1, y: '0%' } : { opacity: 0, y: '105%' }}"),
        'Heading line must animate to y: 0%'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.62, delay: 0.12, ease: REVEAL_EASE }}"),
        'Heading line must use relaxed 0.62s duration starting at 0.12s'
      );
      assert.ok(studyViewSrc.includes('Your learning, in progress.'), 'Must preserve exact heading copy');
    });

    it('defines CSS tokens for title clipping mask protecting descenders', () => {
      assert.match(
        studyCss,
        /\.study-continue-title-clip\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?padding-bottom:\s*0\.16em;[\s\S]*?margin-bottom:\s*-0\.16em;/,
        'Clip container must reserve padding for descenders'
      );
      assert.match(
        studyCss,
        /\.study-continue-title-line\s*\{[\s\S]*?transform-origin:\s*0%\s*100%;[\s\S]*?will-change:\s*transform,\s*opacity;/,
        'Title line must optimize transform and opacity'
      );
    });
  });

  describe('3. Transition into Details — Coordinated Stagger (0.34s–0.72s)', () => {
    it('reveals selected graph name with subtle vertical reveal at 0.34s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-graph-name\""),
        'Graph name must be styled with study-continue-graph-name'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.34, ease: REVEAL_EASE }}"),
        'Graph name must enter at 0.34s'
      );
    });

    it('reveals assessment metadata (date, question count) staggered at 0.44s', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-context-line"'));
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.44, ease: REVEAL_EASE }}"),
        'Assessment metadata must enter at 0.44s'
      );
    });

    it('reveals correct-answer count with upward motion at 0.54s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-ratio-row\""),
        'Ratio row must be a motion element'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.54, ease: REVEAL_EASE }}"),
        'Ratio row must enter at 0.54s'
      );
    });

    it('reveals concepts-to-revisit indicator at 0.64s with preserved warm styling', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-meta\""),
        'Meta row must be a motion element'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.44, delay: 0.64, ease: REVEAL_EASE }}"),
        'Concepts indicator must enter at 0.64s'
      );
    });

    it('reveals review action with subtle horizontal entrance at 0.72s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-action-row\""),
        'Action row must be a motion element'
      );
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}"),
        'Action row must start with subtle x: -8 horizontal travel'
      );
      assert.ok(
        studyViewSrc.includes("animate={hasContinueEnteredView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}"),
        'Action row must animate to x: 0'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.72, ease: REVEAL_EASE }}"),
        'Action row must enter at 0.72s'
      );
    });
  });

  describe('4. Score Ring Synchronization (0.22s & 0.45s)', () => {
    it('reveals score ring container with restrained opacity transition at 0.22s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-action-wrap\""),
        'Action wrap must be a motion container'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.22, ease: REVEAL_EASE }}"),
        'Ring wrap must enter with restrained opacity transition at 0.22s'
      );
    });

    it('coordinates SVG progress arc drawing and count-up starting at 0.45s (450ms) for 1.2s', () => {
      assert.ok(studyViewSrc.includes('strokeDashoffset: { duration: 1.2, delay: 0.45, ease: REVEAL_EASE }'));
      assert.ok(studyViewSrc.includes('setTimeout(() => {'));
      assert.ok(studyViewSrc.includes('450);'));
      assert.ok(studyViewSrc.includes('duration: 1.2'));
      assert.ok(studyViewSrc.includes('ease: REVEAL_EASE'));
    });
  });

  describe('5. Replay Lifecycle on Graph Switching', () => {
    it('binds key={effectiveSelectedGraphId || "none"} on study-continue-grid to replay on every graph change', () => {
      assert.ok(
        studyViewSrc.includes('key={effectiveSelectedGraphId || \'none\'}'),
        'Must key grid by effectiveSelectedGraphId to replay entrance on switch'
      );
      assert.ok(
        studyViewSrc.includes('className="study-continue-grid"'),
        'Must retain study-continue-grid class'
      );
    });

    it('immediately resets displayedScore during render when graph selection changes to prevent stale score flash', () => {
      assert.ok(
        studyViewSrc.includes('const [prevSelectedGraphId, setPrevSelectedGraphId] = useState(effectiveSelectedGraphId);'),
        'Must track prevSelectedGraphId'
      );
      assert.ok(
        studyViewSrc.includes('if (prevSelectedGraphId !== effectiveSelectedGraphId) {'),
        'Must detect graph id change during render'
      );
      assert.ok(
        studyViewSrc.includes('setDisplayedScore(shouldReduceMotion ? clampedScore : 0);'),
        'Must reset score to 0 on graph switch'
      );
    });

    it('cleans up active timers and controls when switching graphs rapidly', () => {
      assert.ok(studyViewSrc.includes('clearTimeout(timer);'));
      assert.ok(studyViewSrc.includes('controls.stop();'));
      assert.ok(studyViewSrc.includes('hasAnimatedRef.current = false;'));
    });
  });

  describe('6. Accessibility & Reduced Motion', () => {
    it('disables animation durations and delays when shouldReduceMotion is true', () => {
      assert.ok(
        studyViewSrc.includes('transition={shouldReduceMotion ? { duration: 0 } :'),
        'Must set duration: 0 across motion elements when shouldReduceMotion is active'
      );
      assert.ok(
        studyViewSrc.includes('if (shouldReduceMotion) {\n      setDisplayedScore(clampedScore);'),
        'Must set final score immediately when reduced motion is preferred'
      );
    });

    it('includes .study-continue-kicker and .study-continue-title-line in CSS prefers-reduced-motion media query', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-continue-kicker,/,
        'Must include .study-continue-kicker in reduced motion rules'
      );
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-continue-title-line,/,
        'Must include .study-continue-title-line in reduced motion rules'
      );
    });
  });
});
