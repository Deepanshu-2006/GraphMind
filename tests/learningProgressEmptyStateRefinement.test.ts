import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
const studyCss = fs.readFileSync(studyCssPath, 'utf8');

describe('GRAPHMIND — REFINEMENT OF LEARNING PROGRESS EMPTY STATE', () => {
  describe('1. Remove Outer Card (Requirement 1)', () => {
    it('completely removes rectangular border, card background, card padding, and container radius', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?background:\s*transparent;/,
        'Must sit directly on page background with background: transparent'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?border:\s*none;/,
        'Must remove outer card border'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?padding:\s*0;/,
        'Must remove bulky container padding'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?border-radius:\s*0;/,
        'Must remove container border-radius'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?box-shadow:\s*none;/,
        'Must remove container box-shadow'
      );
    });

    it('keeps empty state constrained to comfortable horizontal width without full-page stretching', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-card[\s\S]*?max-width:\s*580px;/,
        'Must constrain width to max-width: 580px'
      );
    });
  });

  describe('2. Exact Content Hierarchy (Requirement 2)', () => {
    it('preserves existing section heading and subtitle', () => {
      assert.ok(studyViewSrc.includes('LEARNING PROGRESS'), 'Must keep LEARNING PROGRESS eyebrow');
      assert.ok(studyViewSrc.includes('Your learning, over time.'), 'Must keep section heading');
      assert.ok(
        studyViewSrc.includes('See how your understanding changes with every assessment.'),
        'Must keep section subtitle'
      );
    });

    it('displays dynamic selected graph name without hardcoding', () => {
      assert.ok(
        studyViewSrc.includes('{selectedGraphMeta.name}'),
        'Must dynamically bind selected graph name'
      );
      assert.ok(
        !studyViewSrc.includes('Operating Systems</h3>') && !studyViewSrc.includes('>Operating Systems<'),
        'Must never hardcode graph name in empty state'
      );
    });

    it('displays exact assessment count: 0 assessments', () => {
      assert.ok(
        studyViewSrc.includes('0 assessments'),
        'Must render exact 0 assessments text'
      );
    });

    it('displays exact main message: Your progress starts here.', () => {
      assert.ok(
        studyViewSrc.includes('Your progress starts here.'),
        'Must render exact main message'
      );
    });

    it('displays exact supporting text without duplication', () => {
      const exactSupportingCopy =
        'Complete your first assessment to begin tracking your scores, review past attempts, and see how your understanding develops over time.';
      assert.ok(
        studyViewSrc.includes(exactSupportingCopy),
        'Must render exact supporting text'
      );
      // Ensure it does not duplicate
      const matches = studyViewSrc.split(exactSupportingCopy).length - 1;
      assert.equal(matches, 1, 'Supporting text must appear exactly once');
    });

    it('displays exact action: Explore this graph →', () => {
      assert.ok(
        studyViewSrc.includes('Explore this graph'),
        'Must render "Explore this graph" action label'
      );
      assert.ok(
        studyViewSrc.includes('→'),
        'Must include arrow symbol in action button'
      );
    });
  });

  describe('3. Minimal Typography & Design Tokens (Requirement 3)', () => {
    it('styles graph name as medium-sized heading with restrained weight and light text', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-graph-title\s*\{[\s\S]*?font-size:\s*19px;[\s\S]*?color:\s*var\(--text-primary,\s*#F5F5F5\);/,
        'Graph title must use restrained medium size and near-white color'
      );
    });

    it('styles assessment count as small, muted text placed close to graph name without badge/pill styling', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-count\s*\{[\s\S]*?font-family:\s*var\(--font-mono,\s*monospace\);[\s\S]*?font-size:\s*13px;[\s\S]*?color:\s*var\(--text-secondary,\s*#9CA3AF\);/,
        'Assessment count must be small, muted text'
      );
      assert.ok(
        !studyCss.includes('.study-progress-empty-count {\n  border-radius:') &&
        !studyCss.includes('.study-progress-empty-count {\n  background:'),
        'Must not style count as pill or badge'
      );
    });

    it('styles main message with strong editorial hierarchy smaller than page heading', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-heading\s*\{[\s\S]*?font-size:\s*21px;[\s\S]*?font-weight:\s*600;/,
        'Main message must use 21px font size and semi-bold weight'
      );
    });

    it('styles supporting text with comfortable line height and restrained width', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-desc\s*\{[\s\S]*?line-height:\s*1\.6;[\s\S]*?max-width:\s*540px;[\s\S]*?color:\s*var\(--text-secondary,\s*#9CA3AF\);/,
        'Supporting text must use comfortable line-height and max-width ~540px'
      );
    });

    it('styles action as text-based link with electric lime accent on hover and focus', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-action:hover,\s*\.study-progress-empty-action:focus-visible\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Action must highlight in electric lime on hover/focus'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-action:focus-visible\s*\{[\s\S]*?outline:\s*1px\s*solid\s*var\(--accent,\s*#A3FF12\);/,
        'Action must have accessible focus-visible outline'
      );
    });
  });

  describe('4. Left-Aligned Layout & Vertical Spacing (Requirement 4)', () => {
    it('lays out header elements left-aligned with small gap between title and count', () => {
      assert.match(
        studyCss,
        /\.study-progress-empty-header\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*14px;/,
        'Header row must align graph title and count to baseline with 14px gap'
      );
      assert.match(
        studyCss,
        /\.study-progress-empty-header\s*\{[\s\S]*?margin-bottom:\s*24px;/,
        'Must provide deliberate space before main message'
      );
    });

    it('omits illustrations, icons, charts, or decorative badges from empty state', () => {
      // The old dot icon should be gone
      assert.ok(
        !studyViewSrc.includes('study-trajectory-dot') ||
        studyViewSrc.indexOf('study-trajectory-dot') === studyViewSrc.lastIndexOf('study-trajectory-dot'),
        'Must remove decorative dot icon from empty state'
      );
    });
  });

  describe('5. Assessment History Section Preservation (Requirement 5)', () => {
    it('preserves the entire Assessment History section below Learning Progress intact', () => {
      const progIdx = studyViewSrc.indexOf('className="study-progress-section"');
      const histIdx = studyViewSrc.indexOf('className="study-history-section"');
      assert.ok(progIdx !== -1, 'Learning progress section must exist');
      assert.ok(histIdx !== -1, 'Assessment history section must exist');
      assert.ok(histIdx > progIdx, 'Assessment history section must follow learning progress');
      assert.ok(studyViewSrc.includes('title="Assessment history"'), 'Must keep assessment history title');
      assert.ok(studyViewSrc.includes('study-filter-tabs'), 'Must keep assessment history filter tabs');
    });
  });

  describe('6. Functional Wiring (Requirement 6)', () => {
    it('renders empty state conditionally when selectedGraphProgress is null', () => {
      assert.ok(
        studyViewSrc.includes('{selectedGraphProgress ? ('),
        'Must condition on selectedGraphProgress'
      );
      assert.ok(
        studyViewSrc.includes('<LearningTrajectoryRow'),
        'Must render LearningTrajectoryRow when selectedGraphProgress exists'
      );
    });

    it('wires onNavigateToGraph handler to action button with accessible label', () => {
      assert.ok(
        studyViewSrc.includes('onClick={onNavigateToGraph}'),
        'Must wire existing onNavigateToGraph handler'
      );
      assert.ok(
        studyViewSrc.includes('aria-label={`Explore knowledge graph ${selectedGraphMeta.name}`}'),
        'Must provide descriptive accessible label'
      );
    });
  });

  describe('7. Responsiveness & Motion Accessibility (Requirement 7)', () => {
    it('wraps header gracefully on narrow screens without horizontal overflow', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-progress-empty-header\s*\{[\s\S]*?flex-wrap:\s*wrap;/,
        'Header row must wrap flexibly on small screens'
      );
    });

    it('disables action arrow translation when prefers-reduced-motion is active', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-progress-empty-action-arrow/,
        'Must include empty action arrow in reduced motion media query'
      );
    });
  });
});
