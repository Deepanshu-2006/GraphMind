import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND STUDY SPACE — COMPLETE UI/UX OVERHAUL VERIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Strong Editorial Design Direction & Tokens', () => {
    it('uses near-black background #0A0A0A and dark surfaces #101010 to #141414', () => {
      assert.ok(
        studyCss.includes('#0A0A0A') || studyCss.includes('#0a0a0a'),
        'Must use #0A0A0A background'
      );
      assert.ok(
        studyCss.includes('#101010') || studyCss.includes('var(--bg-surface, #101010)'),
        'Must use #101010 surface token'
      );
      assert.ok(
        studyCss.includes('#F5F5F5') || studyCss.includes('var(--text-primary, #F5F5F5)'),
        'Must use #F5F5F5 primary text'
      );
      assert.ok(
        studyCss.includes('#A1A1A1') || studyCss.includes('var(--text-secondary, #A1A1A1)'),
        'Must use #A1A1A1 secondary text'
      );
      assert.ok(
        studyCss.includes('#707070'),
        'Must use #707070 muted text'
      );
      assert.ok(
        studyCss.includes('#A3FF12') || studyCss.includes('var(--accent, #A3FF12)'),
        'Must use GraphMind lime green accent with restraint'
      );
    });

    it('enforces controlled editorial width and spacing (~1080px max-width, ~32-44px padding)', () => {
      assert.match(
        studyCss,
        /\.study-space-container\s*\{[\s\S]*?max-width:\s*1080px;/
      );
      assert.match(
        studyCss,
        /\.study-title\s*\{[\s\S]*?font-size:\s*clamp\(72px,\s*6vw,\s*104px\);/
      );
    });
  });

  describe('2. Refined Page Header & Rhythm', () => {
    it('renders editorial header with eyebrow, title, and supporting text', () => {
      assert.ok(studyViewSrc.includes('YOUR LEARNING'), 'Must contain YOUR LEARNING eyebrow');
      assert.ok(studyViewSrc.includes('Study Space'), 'Must contain Study Space title');
      assert.ok(
        studyViewSrc.includes('Your assessments, progress, and concepts worth revisiting.'),
        'Must contain supporting subtitle'
      );
      assert.ok(studyViewSrc.includes('study-header-divider'), 'Must include hairline header divider');
    });

    it('implements masked line reveal for Study Space title without cutting descenders', () => {
      assert.ok(studyViewSrc.includes('study-title-clip'), 'Must wrap title in clip container');
      assert.ok(studyViewSrc.includes('study-title-line'), 'Must use animated title line span');
      assert.match(
        studyCss,
        /\.study-title\s*\{[\s\S]*?line-height:\s*1\.05;/,
        'Line height must be at least 1.05 to prevent descender clipping'
      );
      assert.match(
        studyCss,
        /\.study-title-clip\s*\{[\s\S]*?padding-bottom:\s*0\.22em;[\s\S]*?margin-bottom:\s*-0\.22em;/,
        'Clip container must reserve bottom padding for letters with descenders (y, p)'
      );
    });
  });

  describe('3. Continue Learning Compact Editorial Composition (V3)', () => {
    it('composes Continue Learning with left contextual info and right score / primary action', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-box"'));
      assert.ok(studyViewSrc.includes('className="study-continue-info"'));
      assert.ok(studyViewSrc.includes('className="study-continue-action-wrap"'));
      assert.ok(studyViewSrc.includes('className="study-continue-score-block"'));
      assert.ok(studyViewSrc.includes('className="study-continue-score-pct"'));
      assert.ok(studyViewSrc.includes('Review missed concepts'));
      assert.ok(studyViewSrc.includes('Review results'));
    });

    it('implements V3 Left Region with editorial typography and ratio summary', () => {
      assert.ok(studyViewSrc.includes('CONTINUE LEARNING'), 'Must have CONTINUE LEARNING eyebrow');
      assert.ok(studyViewSrc.includes('study-continue-ratio-row'), 'Must contain ratio summary row');
      assert.ok(studyViewSrc.includes('study-continue-ratio-num'), 'Must display ratio numeral');
      assert.ok(studyViewSrc.includes('study-continue-ratio-slash'), 'Must have slash separator');
      assert.ok(studyViewSrc.includes('CORRECT ANSWERS'), 'Must have uppercase CORRECT ANSWERS label');
      assert.ok(studyViewSrc.includes('study-continue-meta'), 'Must have quiet supporting metadata');
    });

    it('styles Continue Learning score block with large tabular numeral and subtle counts', () => {
      assert.match(
        studyCss,
        /\.study-continue-score-pct\s*\{[\s\S]*?font-size:\s*clamp\((?:56px,\s*6vw,\s*66px|70px,\s*6\.8vw,\s*84px)\);[\s\S]*?font-weight:\s*600;/
      );
      assert.match(
        studyCss,
        /\.study-continue-ratio-num\s*\{[\s\S]*?font-size:\s*clamp\(48px,\s*5\.2vw,\s*60px\);/
      );
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?font-size:\s*clamp\((?:34px,\s*3\.4vw,\s*38px|36px,\s*3\.8vw,\s*42px|38px,\s*4vw,\s*44px|44px,\s*4\.8vw,\s*52px)\);/
      );
    });

    it('implements a mathematically precise circular progress visualization', () => {
      assert.ok(studyViewSrc.includes('viewBox="0 0 200 200"'), 'Must specify 200x200 viewBox');
      assert.ok(studyViewSrc.includes('role="progressbar"'), 'Must have accessible progressbar role');
      assert.ok(studyViewSrc.includes('className="study-continue-circle-track"'), 'Must include track circle');
      assert.ok(studyViewSrc.includes('className="study-continue-circle-arc"'), 'Must include progress arc circle');
      assert.ok(studyViewSrc.includes('transform="rotate(-90 100 100)"'), 'Must rotate starting point to 12 o\'clock');
      assert.ok(studyViewSrc.includes('CIRCLE_RADIUS = 82'), 'Must define radius 82');
      assert.ok(studyViewSrc.includes('CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS'), 'Must calculate 2*PI*r circumference');
      assert.ok(studyViewSrc.includes('className="study-continue-circle-lbl"'), 'Must have SCORE label in circle');
    });

    it('clamps scores to 0-100 range and handles 0% and 100% states cleanly', () => {
      assert.ok(
        studyViewSrc.includes('Math.max(0, Math.min(100, Math.round(raw)))'),
        'Must clamp score to 0..100 integer range'
      );
      assert.ok(
        studyViewSrc.includes('strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - clampedScore / 100)'),
        'Must calculate stroke offset using standard circle percentage formula'
      );
      assert.ok(
        studyViewSrc.includes('opacity: clampedScore === 0 ? 0 : 1'),
        'Must hide stroke at 0% so no artificial green dot remains visible'
      );
    });

    it('choreographs synchronized counter and arc animation with viewport awareness', () => {
      assert.ok(studyViewSrc.includes('useInView(continueSectionRef'), 'Must use viewport observer ref');
      assert.ok(studyViewSrc.includes('animate(0, clampedScore'), 'Must count up from 0 to clampedScore in sync');
      assert.ok(studyViewSrc.includes('duration: 1.2'), 'Must coordinate 1.2s duration between arc and counter');
      assert.ok(studyViewSrc.includes('shouldReduceMotion'), 'Must respect user reduced motion preference');
    });

    it('implements V6 open editorial composition sitting directly on canvas with no enclosing card', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-context-layer"'), 'Must have context layer grouping');
      assert.ok(studyViewSrc.includes('className="study-continue-summary-block"'), 'Must have performance summary block');
      assert.ok(studyViewSrc.includes('className="study-continue-circle-track"'), 'Must have clean SVG circle track');
      assert.ok(studyViewSrc.includes('className="study-continue-circle-arc"'), 'Must have clean SVG circle arc');
      assert.match(
        studyCss,
        /\.study-continue-box\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/
      );
    });
  });

  describe('4. Learning Progress Visualization & Factual Restraint', () => {
    it('renders restrained SVG chart with reference guidelines and hollow nodes', () => {
      assert.ok(studyViewSrc.includes('viewBox="0 0 540 80"'));
      assert.ok(studyViewSrc.includes('study-svg-point-node'));
      assert.ok(studyViewSrc.includes('strokeDasharray="3 3"'));
      assert.ok(studyViewSrc.includes('100%'));
      assert.ok(studyViewSrc.includes('50%'));
      assert.ok(studyViewSrc.includes('0%'));
    });

    it('treats identical or 0% to 0% attempts with neutral tone instead of celebrating', () => {
      assert.ok(
        studyViewSrc.includes('isUnchangedOrZero'),
        'Must detect unchanged or zero score attempts'
      );
      assert.ok(
        studyViewSrc.includes("isUnchangedOrZero ? '0 percentage points' : prog.scoreChangeFormatted"),
        'Must format unchanged diff neutrally'
      );
    });

    it('provides interactive hover inspection and keyboard accessibility on chart nodes', () => {
      assert.ok(
        studyViewSrc.includes('hoveredPointAttemptId'),
        'Must track hovered point attempt id'
      );
      assert.ok(
        studyViewSrc.includes('tabIndex={0}'),
        'SVG nodes must be focusable'
      );
      assert.ok(
        studyViewSrc.includes("e.key === 'Enter' || e.key === ' '"),
        'Must handle keyboard activation on SVG point nodes'
      );
    });
  });

  describe('5. Assessment History & Group Hierarchy', () => {
    it('streamlines latest attempt and avoids nested bordered card repetition', () => {
      assert.ok(studyViewSrc.includes('className="study-latest-card"'));
      assert.ok(studyViewSrc.includes('className="study-metrics-grid"'));
      assert.ok(studyViewSrc.includes('VIEW RESULTS'));
    });

    it('supports previous attempts disclosure with accessible aria controls and rotating chevron', () => {
      assert.ok(studyViewSrc.includes('className="study-disclosure-btn"'));
      assert.ok(studyViewSrc.includes('aria-expanded={isExpanded}'));
      assert.ok(studyViewSrc.includes('study-disclosure-arrow'));
      assert.match(
        studyCss,
        /\.study-disclosure-arrow\.open\s*\{[\s\S]*?transform:\s*rotate\(180deg\);/
      );
    });

    it('styles table rows with signature hover and focus state', () => {
      assert.match(
        studyCss,
        /\.study-row:hover\s*\{[\s\S]*?background-color:/
      );
      assert.match(
        studyCss,
        /\.study-row:focus-visible\s*\{[\s\S]*?outline:\s*1px solid var\(--accent/
      );
    });
  });

  describe('6. Editorial Concepts Worth Revisiting Index', () => {
    it('renders concepts as an editorial index with 2-digit index numbers', () => {
      assert.ok(
        studyViewSrc.includes('className="study-revisit-num"'),
        'Must render 2-digit index number for concepts'
      );
      assert.ok(
        studyViewSrc.includes('{pad(idx + 1)}'),
        'Must format index numbers as 01, 02, etc.'
      );
      assert.ok(studyViewSrc.includes('className="study-revisit-name"'));
      assert.ok(studyViewSrc.includes('className="study-revisit-status"'));
    });

    it('provides accessible pagination toggle when concepts exceed 5', () => {
      assert.ok(
        studyViewSrc.includes('isAllConceptsExpanded'),
        'Must have expansion toggle state for concepts'
      );
      assert.ok(
        studyViewSrc.includes('conceptsWorthRevisiting.length > 5'),
        'Must only render toggle button when more than 5 concepts exist'
      );
      assert.ok(
        studyViewSrc.includes('Show fewer concepts'),
        'Must support collapsing concepts list'
      );
    });
  });

  describe('7. Responsive Layouts & Accessibility', () => {
    it('includes responsive rules for tablet and mobile', () => {
      assert.match(studyCss, /@media\s*\(max-width:\s*960px\)/);
      assert.match(studyCss, /@media\s*\(max-width:\s*768px\)/);
      assert.match(studyCss, /@media\s*\(max-width:\s*640px\)/);
      assert.match(studyCss, /@media\s*\(max-width:\s*480px\)/);
    });

    it('disables transitions and animations when prefers-reduced-motion is active', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none\s*!important;/
      );
    });
  });
});
