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
        /\.study-title\s*\{[\s\S]*?font-size:\s*36px;/
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
  });

  describe('3. Continue Learning Compact Editorial Composition', () => {
    it('composes Continue Learning with left contextual info and right score / primary action', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-box"'));
      assert.ok(studyViewSrc.includes('className="study-continue-info"'));
      assert.ok(studyViewSrc.includes('className="study-continue-action-wrap"'));
      assert.ok(studyViewSrc.includes('className="study-continue-score-block"'));
      assert.ok(studyViewSrc.includes('className="study-continue-score-pct"'));
      assert.ok(studyViewSrc.includes('Review missed concepts'));
      assert.ok(studyViewSrc.includes('Review results'));
    });

    it('styles Continue Learning score block with large tabular numeral and subtle counts', () => {
      assert.match(
        studyCss,
        /\.study-continue-score-pct\s*\{[\s\S]*?font-size:\s*28px;[\s\S]*?font-weight:\s*600;/
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
