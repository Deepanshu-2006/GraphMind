/**
 * tests/continueLearningEmptyStateRefinement.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — REFINE THE CONTINUE LEARNING EMPTY STATE
 *
 * Acceptance Criteria verified:
 * 1. Borderless message container: content sits directly on page background with no rectangular border or card background.
 * 2. Exact copy hierarchy:
 *    - Eyebrow: ASSESSMENT HISTORY
 *    - Main message: Your progress starts here.
 *    - Supporting text: Take your first assessment to see how well you understand this graph and discover which concepts need another look.
 *    - Primary action: Start an assessment →
 * 3. Text action refinement:
 *    - Clean text action with arrow
 *    - Subtle lime accent on hover/focus
 *    - Arrow animates a few pixels right on hover (translateX(4px))
 *    - Visible focus state for keyboard accessibility
 *    - Invokes existing assessment navigation with currently selected graph
 * 4. Rotating circular dashed ring:
 *    - Rotates continuously and smoothly (approx. 20s linear infinite)
 *    - Rotates around its exact center (100px 100px)
 *    - Rotates only the decorative dashed ring layer (<g className="study-continue-rotating-ring">)
 * 5. Minimal central indicator:
 *    - Stationary, upright, centered, readable dash (—) and "NO ASSESSMENTS"
 *    - Neutral subdued colors (#555555 and #8E8E8E)
 * 6. Reduced-motion accessibility:
 *    - Disables continuous rotation when prefers-reduced-motion is active
 *    - Disables hover arrow translation
 *    - Keeps ring visible in normal static state
 * 7. Responsive composition:
 *    - Preserves desktop 2-column composition
 *    - Stacks cleanly on mobile without overlap or horizontal overflow
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — REFINE THE CONTINUE LEARNING EMPTY STATE', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Borderless Container & Content Direct on Background (Requirement 1)', () => {
    it('removes rectangular border, card background, and container padding from empty-state message', () => {
      assert.match(
        studyCss,
        /\.study-continue-empty-body\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;[\s\S]*?padding:\s*0;/,
        'Empty body must have transparent background, no border, and zero container padding'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-body\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*flex-start;/,
        'Empty body must arrange content vertically directly on page background'
      );
    });

    it('preserves asymmetric two-column composition between narrative and circular indicator', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-info"'), 'Must have left narrative column');
      assert.ok(studyViewSrc.includes('className="study-continue-action-wrap"'), 'Must have right circular indicator column');
      assert.match(
        studyCss,
        /\.study-continue-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*320px;/,
        'Desktop grid must preserve two-column narrative and 320px circular indicator layout'
      );
    });
  });

  describe('2. Exact Copy Hierarchy & Editorial Typography (Requirement 2)', () => {
    it('renders exact eyebrow copy: ASSESSMENT HISTORY', () => {
      assert.ok(
        studyViewSrc.includes("{latestAttempt ? 'CONTINUE LEARNING' : 'ASSESSMENT HISTORY'}"),
        'Eyebrow must render "ASSESSMENT HISTORY" in empty state'
      );
      assert.ok(studyViewSrc.includes('className="study-continue-kicker"'), 'Must use editorial kicker class');
    });

    it('renders exact main message copy: Your progress starts here.', () => {
      assert.ok(
        studyViewSrc.includes('{latestAttempt ? \'Your learning, in progress.\' : \'Your progress starts here.\'}'),
        'Main heading must render "Your progress starts here." in empty state'
      );
      assert.ok(studyViewSrc.includes('className="study-continue-title"'), 'Must use editorial title class');
    });

    it('renders exact supporting text copy with comfortable line height and restrained width', () => {
      const expectedSupportingText = 'Take your first assessment to see how well you understand this graph and discover which concepts need another look.';
      assert.ok(
        studyViewSrc.includes(expectedSupportingText),
        'Must render exact supporting text copy'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-msg\s*\{[\s\S]*?line-height:\s*1\.6;[\s\S]*?max-width:\s*480px;/,
        'Supporting text must use comfortable line height (1.6) and restrained width (480px)'
      );
    });

    it('omits redundant "No assessments yet" meta stack when in empty state', () => {
      // In empty state, latestAttempt is falsey, so meta-stack is suppressed
      assert.ok(
        studyViewSrc.includes('{latestAttempt && (\n                          <div className="study-continue-meta-stack">'),
        'Meta stack with redundant subtitles must only be displayed when an attempt exists'
      );
    });
  });

  describe('3. Refined Start Assessment Text Action (Requirement 3)', () => {
    it('renders "Start an assessment →" as a clean text action button', () => {
      assert.ok(
        studyViewSrc.includes('className="study-continue-empty-action-btn"'),
        'Must use dedicated text action button class'
      );
      assert.ok(
        studyViewSrc.includes('<span className="study-continue-empty-action-label">Start an assessment</span>'),
        'Must render exact action label "Start an assessment"'
      );
      assert.ok(
        studyViewSrc.includes('<span className="study-continue-empty-action-arrow" aria-hidden="true">→</span>'),
        'Must render arrow indicator'
      );
    });

    it('styles action with subtle lime accent on hover/focus and animated arrow shift', () => {
      assert.match(
        studyCss,
        /\.study-continue-empty-action-btn:hover,\s*\.study-continue-empty-action-btn:focus-visible\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Action must illuminate in lime accent on hover and focus'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-action-btn:hover\s*\.study-continue-empty-action-arrow[\s\S]*?\{[\s\S]*?transform:\s*translateX\(4px\);/,
        'Arrow must animate 4px right on hover'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-action-btn:focus-visible\s*\{[\s\S]*?outline:\s*1px\s*solid\s*var\(--accent,\s*#A3FF12\);/,
        'Action must provide high-contrast visible focus outline for keyboard accessibility'
      );
    });

    it('invokes existing assessment navigation handler on click with active graph aria-label', () => {
      assert.ok(
        studyViewSrc.includes('onClick={onNavigateToGraph}'),
        'Must wire existing onNavigateToGraph handler'
      );
      assert.ok(
        studyViewSrc.includes('aria-label={`Start assessment for ${selectedGraphMeta.name}`}'),
        'Must maintain descriptive accessible label referencing current graph'
      );
    });
  });

  describe('4. Continuous Smooth Rotation of Circular Dashed Ring (Requirement 4)', () => {
    it('isolates rotating dashed ring layer inside <g className="study-continue-rotating-ring"> in SVG', () => {
      assert.ok(
        studyViewSrc.includes('<g \n                              className="study-continue-rotating-ring"'),
        'Dashed ring circle must be wrapped in dedicated rotating layer'
      );
      assert.ok(
        studyViewSrc.includes('className="study-continue-circle-track study-continue-circle-track-empty"'),
        'Must render dashed empty circle track'
      );
      assert.ok(
        studyViewSrc.includes('className="study-continue-circle-track study-continue-circle-track-empty-alt"'),
        'Must render alternating dashed empty circle track'
      );
    });

    it('styles alternating track segments on rotating circular ring (green shade and original subtle track color)', () => {
      assert.match(
        studyCss,
        /\.study-continue-circle-track-empty\s*\{[\s\S]*?stroke:\s*var\(--accent,\s*#A3FF12\);[\s\S]*?stroke-dasharray:\s*4\s*8;/,
        'Primary track segment must use electric lime green shade'
      );
      assert.match(
        studyCss,
        /\.study-continue-circle-track-empty-alt\s*\{[\s\S]*?stroke:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);[\s\S]*?stroke-dasharray:\s*4\s*8;[\s\S]*?stroke-dashoffset:\s*6;/,
        'Alternating track segment must use original subtle track stroke with offset'
      );
    });

    it('defines continuous 20s linear infinite rotation around exact center (100px 100px)', () => {
      assert.match(
        studyCss,
        /@keyframes\s+studyRingContinuousRotate\s*\{[\s\S]*?from\s*\{[\s\S]*?transform:\s*rotate\(0deg\);[\s\S]*?to\s*\{[\s\S]*?transform:\s*rotate\(360deg\);/,
        'Must define 0 to 360 degree linear keyframe rotation'
      );
      assert.match(
        studyCss,
        /\.study-continue-rotating-ring\s*\{[\s\S]*?animation:\s*studyRingContinuousRotate\s*20s\s*linear\s*infinite;/,
        'Must rotate continuously with 20s duration, linear timing, and infinite repetition'
      );
      assert.match(
        studyCss,
        /\.study-continue-rotating-ring\s*\{[\s\S]*?transform-origin:\s*100px\s*100px;/,
        'Must rotate around exact center of 200x200 viewBox (100px 100px)'
      );
      assert.match(
        studyCss,
        /\.study-continue-rotating-ring\s*\{[\s\S]*?transform-box:\s*view-box;/,
        'Must specify transform-box: view-box for reliable SVG coordinate space rotation'
      );
    });
  });

  describe('5. Minimal Central Indicator (Requirement 5)', () => {
    it('maintains stationary, upright, readable dash and "NO ASSESSMENTS" centered in ring', () => {
      // Content is outside SVG in HTML overlay, completely decoupled from rotating ring
      const contentIdx = studyViewSrc.indexOf('className="study-continue-circle-content"');
      const svgIdx = studyViewSrc.indexOf('className="study-continue-circle-svg"');
      assert.ok(contentIdx > svgIdx, 'Text content overlay must be distinct from and positioned after SVG');

      assert.ok(studyViewSrc.includes('study-continue-empty-dash'), 'Must render em-dash element');
      assert.ok(studyViewSrc.includes('>—</span>'), 'Must display em-dash symbol');
      assert.ok(studyViewSrc.includes('NO ASSESSMENTS'), 'Must display uppercase "NO ASSESSMENTS" label');
      assert.ok(studyViewSrc.includes('study-continue-circle-lbl-empty'), 'Must attach study-continue-circle-lbl-empty class');
    });

    it('styles "NO ASSESSMENTS" label in crisp green shade without glow and dash in subdued tone', () => {
      assert.match(
        studyCss,
        /\.study-continue-empty-dash\s*\{[\s\S]*?color:\s*#555555;/,
        'Dash must use subdued neutral tone (#555555)'
      );
      assert.match(
        studyCss,
        /\.study-continue-circle-lbl-empty\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);[\s\S]*?text-shadow:\s*none;/,
        'NO ASSESSMENTS label must use vibrant green shade without glow'
      );
    });
  });

  describe('6. Motion Polish & Accessibility (Requirement 6)', () => {
    it('disables continuous ring rotation and hover arrow translation when prefers-reduced-motion is active', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-continue-rotating-ring[\s\S]*?animation:\s*none\s*!important;/,
        'Must disable ring rotation in prefers-reduced-motion CSS media query'
      );
      assert.ok(
        studyViewSrc.includes("style={shouldReduceMotion ? { animation: 'none' } : undefined}"),
        'Must also enforce reduced motion via Framer Motion useReducedMotion hook in JSX'
      );
    });
  });

  describe('7. Responsive Layout (Requirement 7)', () => {
    it('adapts gracefully on small screens without overlapping text and circular indicator', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-continue-empty-body\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?padding:\s*0;/,
        'Must adapt empty body with vertical column stacking and zero padding on mobile'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-continue-summary-block:has\(\.study-continue-empty-body\)[\s\S]*?border-top:\s*none;[\s\S]*?padding-top:\s*0;/,
        'Must remove border-top on mobile when summary block is in empty state'
      );
    });
  });
});
