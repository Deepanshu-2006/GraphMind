import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND CONTINUE LEARNING — TEXT ENTRANCE ANIMATION REDESIGN', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Coordinated Text Reveal & Visual Hierarchy (Phase 2)', () => {
    it('reveals CONTINUE LEARNING kicker with subtle vertical rise and short controlled duration (0–150ms)', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-kicker"'));
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}"),
        'Kicker must start slightly below with subtle y: 6 travel'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.04, ease: REVEAL_EASE }}"),
        'Kicker must use 0.28s duration with 0.04s delay and REVEAL_EASE'
      );
    });

    it('reveals main heading through vertical clipping mask without altering font or line wrapping (100–450ms)', () => {
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
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.44, delay: 0.10, ease: REVEAL_EASE }}"),
        'Heading line must use 0.44s duration starting at 100ms'
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

    it('staggers assessment metadata (graph name, date, question count) after heading begins to settle (240ms)', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-meta-stack"'));
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}"),
        'Meta stack must start with restrained y: 8 travel'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.24, ease: REVEAL_EASE }}"),
        'Meta stack must enter at 240ms'
      );
    });

    it('reveals correct-answer count with upward motion and concepts-to-revisit understated (320–400ms)', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-ratio-row\""),
        'Ratio row must be a motion element'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.36, delay: 0.32, ease: REVEAL_EASE }}"),
        'Ratio row must enter at 320ms'
      );
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-meta\""),
        'Meta row must be a motion element'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.38, ease: REVEAL_EASE }}"),
        'Concepts indicator must enter at 380ms'
      );
    });

    it('reveals review action with subtle horizontal slide toward final position (460ms)', () => {
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
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.34, delay: 0.46, ease: REVEAL_EASE }}"),
        'Action row must enter after metrics at 460ms'
      );
    });
  });

  describe('2. Score Ring Coordination (Phase 3 & 4)', () => {
    it('reveals score ring container with subtle opacity and scale settling (160ms)', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-continue-action-wrap\""),
        'Action wrap must be a motion container'
      );
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}"),
        'Ring wrap must start with subtle scale: 0.98'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.38, delay: 0.16, ease: REVEAL_EASE }}"),
        'Ring wrap must enter at 160ms'
      );
    });

    it('coordinates SVG progress arc drawing and count-up starting at 320ms for 1.2s', () => {
      assert.ok(studyViewSrc.includes('strokeDashoffset: { duration: 1.2, delay: 0.32, ease: REVEAL_EASE }'));
      assert.ok(studyViewSrc.includes('setTimeout(() => {'));
      assert.ok(studyViewSrc.includes('duration: 1.2'));
      assert.ok(studyViewSrc.includes('ease: REVEAL_EASE'));
    });
  });

  describe('3. Replay Lifecycle on Graph Switching (Phase 5)', () => {
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

  describe('4. Accessibility & Reduced Motion (Phase 6)', () => {
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

    it('includes .study-continue-title-line in CSS prefers-reduced-motion media query', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-continue-title-line,/,
        'Must disable CSS transforms and transitions on .study-continue-title-line for reduced motion'
      );
    });
  });
});
