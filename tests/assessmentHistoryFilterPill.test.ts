import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND ASSESSMENT HISTORY — CINEMATIC FILTER SWITCHER PILL', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Cinematic Pill Movement & Easing (Section 1)', () => {
    it('animates pill with cinematic 500-650ms duration', () => {
      assert.ok(
        studyViewSrc.includes('duration: 0.54'),
        'Pill transition must use deliberate ~540ms cinematic duration'
      );
    });

    it('uses carefully tuned easing curve cubic-bezier(0.22, 1, 0.36, 1) for natural acceleration and deceleration', () => {
      assert.ok(
        studyViewSrc.includes('ease: [0.22, 1, 0.36, 1]'),
        'Pill transition must use [0.22, 1, 0.36, 1] easing curve'
      );
    });
  });

  describe('2. Single Continuous Pill Element (Section 2)', () => {
    it('renders a single continuous motion element moving horizontally across segments', () => {
      assert.ok(
        studyViewSrc.includes('className="study-filter-active-pill"'),
        'Must render single dedicated active pill element'
      );
      assert.ok(
        studyViewSrc.includes('x: filterTabBounds.left'),
        'Must translate horizontally to target segment x position'
      );
      assert.ok(
        studyViewSrc.includes('width: filterTabBounds.width'),
        'Must adapt width smoothly to match active segment width'
      );
    });

    it('styles pill with solid lime-green background, 6px radius, and hardware acceleration', () => {
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?background-color:\s*var\(--accent,\s*#A3FF12\);/,
        'Must preserve solid lime-green fill'
      );
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?border-radius:\s*6px;/,
        'Must preserve 6px corner radius'
      );
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?will-change:\s*transform,\s*width;/,
        'Must optimize GPU composition with will-change'
      );
    });
  });

  describe('3. Typography Transition Coordination (Section 4)', () => {
    it('styles active tab with high-contrast dark text and bold font weight', () => {
      assert.match(
        studyCss,
        /\.study-filter-tab\.active\s*\{[\s\S]*?color:\s*#0A0A0A;/,
        'Active option must have dark text on lime-green background'
      );
      assert.match(
        studyCss,
        /\.study-filter-tab\.active\s*\{[\s\S]*?font-weight:\s*600;/,
        'Active option must have strong font weight 600'
      );
    });

    it('styles inactive tabs with muted gray text on dark track', () => {
      assert.match(
        studyCss,
        /\.study-filter-tab\s*\{[\s\S]*?color:\s*#8A8A8A;/,
        'Inactive options must have muted gray text'
      );
      assert.match(
        studyCss,
        /\.study-filter-tab\s*\{[\s\S]*?font-weight:\s*500;/,
        'Inactive options must have medium font weight 500'
      );
    });

    it('transitions tab labels smoothly in 200-300ms using matching easing', () => {
      assert.match(
        studyCss,
        /\.study-filter-tab\s*\{[\s\S]*?transition:\s*color\s+240ms\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\);/,
        'Tab must transition color smoothly over 240ms'
      );
      assert.match(
        studyCss,
        /\.study-filter-tab-label\s*\{[\s\S]*?transition:\s*color\s+240ms\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\);/,
        'Label must transition color smoothly over 240ms'
      );
    });
  });

  describe('4. Rapid Interaction & State Continuity (Section 5)', () => {
    it('immediately updates filter mode on click so assessment data updates without delay', () => {
      assert.ok(
        studyViewSrc.includes("onClick={() => setFilterMode('all')}"),
        'Must update to all immediately on click'
      );
      assert.ok(
        studyViewSrc.includes("onClick={() => setFilterMode('needs-review')}"),
        'Must update to needs-review immediately on click'
      );
    });

    it('re-measures pill bounds on filter changes and window resize events', () => {
      assert.ok(studyViewSrc.includes('updateFilterPillPosition'));
      assert.ok(studyViewSrc.includes('ResizeObserver'));
      assert.ok(studyViewSrc.includes("addEventListener('resize'"));
    });
  });

  describe('5. Accessibility & Reduced Motion Preferences (Section 6)', () => {
    it('disables animation duration when shouldReduceMotion is active in React', () => {
      assert.ok(
        studyViewSrc.includes('shouldReduceMotion ? { duration: 0 }'),
        'Must snap instantly without transition when reduced motion is preferred'
      );
    });

    it('overrides pill and tab transitions in CSS media query for prefers-reduced-motion', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-filter-active-pill,[\s\S]*?\.study-filter-tab,[\s\S]*?transition:\s*none\s*!important;/,
        'CSS must disable transitions when prefers-reduced-motion is active'
      );
    });

    it('preserves accessible ARIA tablist semantics and arrow-key navigation', () => {
      assert.ok(studyViewSrc.includes('role="tablist"'));
      assert.ok(studyViewSrc.includes('role="tab"'));
      assert.ok(studyViewSrc.includes("aria-selected={activeFilterKey === 'all'}"));
      assert.ok(studyViewSrc.includes("aria-selected={activeFilterKey === 'needs-review'}"));
      assert.ok(studyViewSrc.includes('handleFilterTabKeyDown'));
    });
  });
});
