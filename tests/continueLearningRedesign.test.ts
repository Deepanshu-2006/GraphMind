import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Continue Learning Redesign & Asymmetric Editorial Assessment Experience', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const circularScorePath = path.resolve(__dirname, '../src/components/study/CircularScore.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const circularScoreSrc = fs.readFileSync(circularScorePath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Composition & Editorial Hierarchy (Step 2)', () => {
    it('composes an asymmetric editorial layout on the existing background without an enclosing card', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-box"'));
      assert.ok(studyViewSrc.includes('className="study-continue-grid"'));
      assert.match(
        studyCss,
        /\.study-continue-box\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/
      );
    });

    it('houses all assessment narrative items in the LEFT column (study-continue-info)', () => {
      // Find the left column
      const leftColStart = studyViewSrc.indexOf('className="study-continue-info"');
      const rightColStart = studyViewSrc.indexOf('className="study-continue-action-wrap"');
      assert.ok(leftColStart !== -1 && rightColStart !== -1, 'Must have left and right columns');
      assert.ok(leftColStart < rightColStart, 'Left column must precede right column');

      const leftColContent = studyViewSrc.slice(leftColStart, rightColStart);

      // Verify LEFT items:
      // 1. Small uppercase CONTINUE LEARNING label
      assert.ok(leftColContent.includes('CONTINUE LEARNING'), 'Left column must include CONTINUE LEARNING');
      assert.ok(leftColContent.includes('study-continue-kicker'), 'Must have kicker class');

      // 2. Prominent assessment or graph title
      assert.ok(leftColContent.includes('study-continue-title'), 'Left column must include title');
      assert.ok(leftColContent.includes('{latestAttempt.graphName}'), 'Must display graphName');

      // 3. Quiet assessment date and contextual metadata
      assert.ok(leftColContent.includes('latestDateInfo.dateStr'), 'Left column must include assessment date');
      assert.ok(leftColContent.includes('latestAttempt.totalQuestions'), 'Left column must include questions count');
      assert.ok(leftColContent.includes('study-continue-context-line'), 'Must use context-line styling');

      // 4. Large correct-answer statistic
      assert.ok(leftColContent.includes('study-continue-ratio-row'), 'Left column must include ratio row');
      assert.ok(leftColContent.includes('study-continue-ratio-num'), 'Must display large ratio numbers');
      assert.ok(leftColContent.includes('study-continue-ratio-slash'), 'Must display slash separator');

      // 5. Supporting label identifying correct answers
      assert.ok(leftColContent.includes('CORRECT ANSWERS'), 'Left column must include CORRECT ANSWERS');
      assert.ok(leftColContent.includes('study-continue-ratio-lbl'), 'Must use ratio label');

      // 6. Number of concepts requiring revision
      assert.ok(leftColContent.includes('study-meta-warm'), 'Must have warm highlight for concepts to revisit');
      assert.ok(leftColContent.includes('to revisit'), 'Must display count of concepts requiring revision');
    });

    it('houses circular score visualization and action in the RIGHT column (study-continue-action-wrap)', () => {
      const rightColStart = studyViewSrc.indexOf('className="study-continue-action-wrap"');
      const rightColEnd = studyViewSrc.indexOf('</motion.section>', rightColStart);
      const rightColContent = studyViewSrc.slice(rightColStart, rightColEnd);

      // Verify RIGHT items:
      // 1. Custom circular SVG score visualization
      assert.ok(rightColContent.includes('study-continue-circle-svg'), 'Right column must have SVG circular score');
      assert.ok(rightColContent.includes('study-continue-circle-track'), 'Right column must have track');
      assert.ok(rightColContent.includes('study-continue-circle-arc'), 'Right column must have lime arc');

      // 2. Animated percentage positioned in its center
      assert.ok(rightColContent.includes('study-continue-score-pct'), 'Right column must have percentage element');
      assert.ok(rightColContent.includes('{displayedScore}%'), 'Must display animated score percentage');

      // 3. Small uppercase assessment-score caption
      assert.ok(rightColContent.includes('study-continue-circle-lbl'), 'Right column must have circle label');
      assert.ok(rightColContent.includes('SCORE'), 'Must label as SCORE');

      // 4. Review-missed-concepts action beneath visualization
      assert.ok(rightColContent.includes('study-continue-action-btn'), 'Right column must have action button');
      assert.ok(rightColContent.includes('REVIEW MISSED CONCEPTS'), 'Must have REVIEW MISSED CONCEPTS text');
    });

    it('enforces visually dominant title and substantial but secondary correct-answer statistic in typography', () => {
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?font-size:\s*clamp\(44px,\s*4\.8vw,\s*52px\);[\s\S]*?font-weight:\s*600;/
      );
      assert.match(
        studyCss,
        /\.study-continue-ratio-num\s*\{[\s\S]*?font-size:\s*clamp\(48px,\s*5\.2vw,\s*60px\);[\s\S]*?font-weight:\s*600;/
      );
      assert.match(
        studyCss,
        /\.study-continue-score-pct\s*\{[\s\S]*?font-size:\s*clamp\(56px,\s*6vw,\s*66px\);[\s\S]*?font-weight:\s*600;/
      );
    });
  });

  describe('2. Custom SVG Score Visualization & Precise Calculations (Step 3)', () => {
    it('implements a standalone reusable CircularScore component file', () => {
      assert.ok(circularScoreSrc.includes('export function CircularScore'), 'Must export CircularScore component');
      assert.ok(circularScoreSrc.includes('CIRCLE_RADIUS = 82'), 'Must define CIRCLE_RADIUS = 82');
      assert.ok(circularScoreSrc.includes('CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS'), 'Must calculate CIRCLE_CIRCUMFERENCE');
    });

    it('draws a thin muted circular track and lime-green progress arc', () => {
      assert.match(
        studyCss,
        /\.study-continue-circle-track\s*\{[\s\S]*?stroke:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);[\s\S]*?fill:\s*none;/
      );
      assert.match(
        studyCss,
        /\.study-continue-circle-arc\s*\{[\s\S]*?stroke:\s*var\(--accent,\s*#A3FF12\);[\s\S]*?fill:\s*none;/
      );
    });

    it('ensures the circle container maintains a strict 1:1 aspect ratio across viewports', () => {
      assert.match(
        studyCss,
        /\.study-continue-circle-wrap\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1;/
      );
    });

    it('accurately clamps score and suppresses rounded cap at 0%', () => {
      assert.ok(
        studyViewSrc.includes('strokeLinecap={clampedScore === 0 ? \'butt\' : \'round\'}'),
        'Must use butt stroke cap at 0% to prevent visible dot artifact'
      );
      assert.ok(
        studyViewSrc.includes('opacity: clampedScore === 0 ? 0 : 1'),
        'Must set opacity to 0 when score is 0'
      );
      assert.ok(
        studyViewSrc.includes('Math.max(0, Math.min(100, Math.round(raw)))'),
        'Must clamp score strictly to 0..100 range'
      );
    });
  });

  describe('3. Synchronized Entrance Animation & Reduced Motion (Step 4)', () => {
    it('coordinates arc drawing and percentage counter with synchronized duration and easing', () => {
      assert.ok(studyViewSrc.includes('duration: 1.2'), 'Both arc and counter must use 1.2s duration');
      assert.ok(studyViewSrc.includes('ease: REVEAL_EASE'), 'Both must use controlled REVEAL_EASE');
      assert.ok(studyViewSrc.includes('delay: 0.32'), 'Arc must start at 320ms');
      assert.ok(studyViewSrc.includes('setTimeout(() => {'), 'Counter must coordinate start at 320ms');
    });

    it('guards against repeated animation triggers on incidental re-renders', () => {
      assert.ok(
        studyViewSrc.includes('hasAnimatedRef.current'),
        'Must use hasAnimatedRef guard to prevent repeated re-triggering'
      );
    });

    it('respects prefers-reduced-motion by rendering final score immediately with zero duration', () => {
      assert.ok(
        studyViewSrc.includes('if (shouldReduceMotion) {'),
        'Must check shouldReduceMotion in useEffect'
      );
      assert.ok(
        studyViewSrc.includes('transition={shouldReduceMotion ? { duration: 0 } :'),
        'Must set duration: 0 when shouldReduceMotion is true'
      );
    });
  });

  describe('4. Refined Review Action & State Handling (Step 5)', () => {
    it('renders REVIEW MISSED CONCEPTS when concepts require revision and REVIEW RESULTS when mastered', () => {
      assert.ok(
        studyViewSrc.includes("missedCount > 0 ? 'REVIEW MISSED CONCEPTS' : 'REVIEW RESULTS'"),
        'Must dynamically switch label based on missed concepts'
      );
      assert.ok(
        studyViewSrc.includes("missedCount > 0 ? 'review-missed' : 'historical-results'"),
        'Must route to review-missed when concepts exist and historical-results when mastered'
      );
    });

    it('features lime-green directional arrow with subtle hover translation and signature underline', () => {
      assert.match(
        studyCss,
        /\.study-continue-action-btn\s*\.study-btn-arrow\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/
      );
      assert.match(
        studyCss,
        /\.study-continue-action-btn:hover\s*\.study-btn-arrow\s*\{[\s\S]*?transform:\s*translateX\(4px\);/
      );
      assert.match(
        studyCss,
        /\.study-continue-action-btn\s*\.study-btn-underline\s*\{[\s\S]*?background:\s*var\(--accent,\s*#A3FF12\);/
      );
    });

    it('implements an accessible focus-visible state on the review button', () => {
      assert.match(
        studyCss,
        /\.study-continue-action-btn:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--accent,\s*#A3FF12\);/
      );
    });
  });

  describe('5. Responsive Editorial Layout & Design Constraints (Step 6)', () => {
    it('does not introduce vertical dividers or card wrappers', () => {
      assert.doesNotMatch(studyCss, /\.study-continue-section\s*\{[^}]*border-left/);
      assert.doesNotMatch(studyCss, /\.study-continue-grid\s*\{[^}]*border-left/);
      assert.doesNotMatch(studyCss, /\.study-continue-box\s*\{[^}]*box-shadow/);
      assert.doesNotMatch(studyCss, /\.study-continue-box\s*\{[^}]*backdrop-filter/);
    });

    it('adapts gracefully on tablet and mobile without horizontal overflow', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*960px\)[\s\S]*?\.study-continue-circle-wrap\s*\{[\s\S]*?width:\s*170px;/
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-continue-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-continue-circle-wrap\s*\{[\s\S]*?width:\s*160px;/
      );
    });
  });
});
