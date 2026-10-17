import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — PERSONA RIGHT PERFORMANCE PANEL POLISH & CINEMATIC ENTRANCE', () => {
  const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');
  const panelSrc = fs.readFileSync(panelPath, 'utf8');
  const cssPath = path.resolve(__dirname, '../src/styles/persona.css');
  const cssSrc = fs.readFileSync(cssPath, 'utf8');

  // =========================================================================
  // 1. 5-LEVEL TYPOGRAPHIC HIERARCHY
  // =========================================================================
  describe('1. 5-Level Editorial Typographic Hierarchy', () => {
    it('Level A: defines section identity eyebrow with small uppercase text, monospace font, and green bullet dot', () => {
      assert.ok(panelSrc.includes('YOUR PERFORMANCE'), 'Panel must include YOUR PERFORMANCE section label');
      assert.ok(panelSrc.includes('persona-activity-tag-bullet'), 'Panel must include bullet dot');
      assert.ok(cssSrc.includes('.persona-performance-panel .persona-activity-tag'), 'CSS must define tag typography for performance panel');
      assert.ok(cssSrc.includes('font-size: 11px'), 'Eyebrow must be 11px monospace');
      assert.ok(cssSrc.includes('letter-spacing: 0.15em'), 'Eyebrow must use controlled letter-spacing');
    });

    it('Level B: defines supporting headline at 18px matching left panel character', () => {
      assert.ok(panelSrc.includes('Progress, practice, and mastery.'), 'Must contain supporting headline');
      assert.ok(cssSrc.includes('.persona-performance-panel .persona-activity-subtitle'), 'CSS must define subtitle typography');
      assert.ok(cssSrc.includes('font-size: 18px'), 'Headline must be 18px on desktop');
    });

    it('Level C: defines primary numerical values at 44px with tabular numbers and clipped reveal wrappers', () => {
      assert.ok(panelSrc.includes('persona-stat-value-clip'), 'Primary numbers must be wrapped in overflow-hidden clipping wrapper');
      assert.ok(panelSrc.includes('persona-stat-value-inner'), 'Primary numbers must have inner motion wrapper');
      assert.ok(cssSrc.includes('.persona-performance-panel .persona-stat-value'), 'CSS must define stat value typography');
      assert.ok(cssSrc.includes('font-size: 44px'), 'Primary statistics must be 44px on desktop');
      assert.ok(cssSrc.includes('tabular-nums'), 'Primary numbers must use tabular numerals');
    });

    it('Level D: defines metric labels in consistent uppercase monospace with 11px sizing', () => {
      assert.ok(panelSrc.includes('ASSESSMENT PERFORMANCE'), 'Must contain ASSESSMENT PERFORMANCE metric label');
      assert.ok(panelSrc.includes('ACTIVE REVISION SESSION'), 'Must contain ACTIVE REVISION SESSION metric label');
      assert.ok(panelSrc.includes('CONCEPTS TO REVISIT'), 'Must contain CONCEPTS TO REVISIT metric label');
      assert.ok(cssSrc.includes('.persona-performance-panel .persona-stat-label'), 'CSS must define metric label styling');
    });

    it('Level E: defines supporting information with comfortable 13.5px sizing and muted text', () => {
      assert.ok(panelSrc.includes('persona-stat-subtext'), 'Must use persona-stat-subtext for descriptions');
      assert.ok(cssSrc.includes('.persona-performance-panel .persona-stat-subtext'), 'CSS must define subtext styling');
      assert.ok(cssSrc.includes('font-size: 13.5px'), 'Supporting descriptions must be 13.5px');
    });
  });

  // =========================================================================
  // 2. REFINED ASSESSMENT RESULTS & CHIPS
  // =========================================================================
  describe('2. Refined Assessment Results & Concepts to Revisit', () => {
    it('styles percentage score badges with minimal typographic annotations without boxed borders', () => {
      assert.ok(panelSrc.includes('persona-score-badge'), 'Must render score badges on assessment rows');
      assert.ok(cssSrc.includes('.persona-score-badge'), 'CSS must style persona-score-badge');
      assert.ok(cssSrc.includes('background: transparent;'), 'Score badge must use clean transparent background');
      assert.ok(cssSrc.includes('border: none;'), 'Score badge must avoid boxed borders');
      assert.ok(cssSrc.includes('tabular-nums'), 'Score badge must use tabular figures');
    });

    it('styles recent assessment items with ellipsis name truncation and right-aligned timestamp', () => {
      assert.ok(panelSrc.includes('persona-performance-item'), 'Must style assessment items');
      assert.ok(panelSrc.includes('persona-activity-name'), 'Must style assessment name as primary text');
      assert.ok(panelSrc.includes('persona-activity-time'), 'Must style assessment time');
    });

    it('styles resume session action as an understated inline action with subtle hover arrow', () => {
      assert.ok(panelSrc.includes('persona-revision-resume-btn'), 'Must render resume session button');
      assert.ok(panelSrc.includes('persona-resume-arrow'), 'Must include resume arrow');
      assert.ok(cssSrc.includes('.persona-revision-resume-btn'), 'CSS must style resume session button');
      assert.ok(cssSrc.includes('transform: translateX(3px);'), 'Resume arrow must glide right on hover');
    });

    it('renders concept tags as refined editorial pills with comfortable spacing and curvature', () => {
      assert.ok(panelSrc.includes('persona-concepts-chips-container'), 'Must render concept chips container');
      assert.ok(panelSrc.includes('persona-concept-chip'), 'Must render individual concept chips');
      assert.ok(cssSrc.includes('.persona-concept-chip'), 'CSS must style concept chip tags');
      assert.ok(cssSrc.includes('border-radius: 9999px;'), 'Concept pills must use smooth pill curvature');
      assert.ok(cssSrc.includes('gap: 12px;'), 'Concept pills must have comfortable 12px gap');
    });
  });

  // =========================================================================
  // 3. COORDINATED 4-PHASE CINEMATIC ENTRANCE TIMELINE
  // =========================================================================
  describe('3. Coordinated 4-Phase Cinematic Entrance Sequence', () => {
    it('Phase A (0–450 ms): reveals green indicator dot, section label, and supporting headline', () => {
      assert.ok(panelSrc.includes('eyebrowDotVariants'), 'Must define eyebrow dot reveal variants');
      assert.ok(panelSrc.includes('eyebrowTextVariants'), 'Must define eyebrow text reveal variants');
      assert.ok(panelSrc.includes('headlineVariants'), 'Must define headline reveal variants');
    });

    it('Phase B (350–1,250 ms): reveals assessment performance label, clipped average score, description, and staggered rows', () => {
      assert.ok(panelSrc.includes('metric1LabelVariants'), 'Must define assessment label reveal variants');
      assert.ok(panelSrc.includes('metric1ValueVariants'), 'Must define clipped average score reveal variants');
      assert.ok(panelSrc.includes('metric1SubtextVariants'), 'Must define assessment subtext reveal variants');
      assert.ok(panelSrc.includes('scoresListContainerVariants'), 'Must define staggered scores list container');
      assert.ok(panelSrc.includes('scoresListItemVariants'), 'Must define scores list item reveal');
      assert.ok(panelSrc.includes('rowBadgeVariants'), 'Must define row badge reveal');
      assert.ok(panelSrc.includes('rowNameVariants'), 'Must define row name reveal');
      assert.ok(panelSrc.includes('rowTimeVariants'), 'Must define row time reveal');
    });

    it('Phase C (1,000–1,950 ms): reveals revision label, clipped percentage, description, progress fill, and resume action', () => {
      assert.ok(panelSrc.includes('metric2LabelVariants'), 'Must define revision label reveal variants');
      assert.ok(panelSrc.includes('metric2ValueVariants'), 'Must define clipped revision percentage reveal variants');
      assert.ok(panelSrc.includes('metric2SubtextVariants'), 'Must define revision subtext reveal variants');
      assert.ok(panelSrc.includes('progressTrackVariants'), 'Must define progress track reveal variants');
      assert.ok(panelSrc.includes('resumeBtnVariants'), 'Must define resume session button reveal variants');
    });

    it('Phase D (1,750–2,500 ms): reveals concepts to revisit label, clipped attention count, description, and concept chips', () => {
      assert.ok(panelSrc.includes('revisitLabelVariants'), 'Must define revisit label reveal variants');
      assert.ok(panelSrc.includes('revisitValueVariants'), 'Must define clipped revisit count reveal variants');
      assert.ok(panelSrc.includes('revisitSubtextVariants'), 'Must define revisit subtext reveal variants');
      assert.ok(panelSrc.includes('chipsContainerVariants'), 'Must define concept chips staggered container');
      assert.ok(panelSrc.includes('chipItemVariants'), 'Must define chip item reveal variants');
    });
  });

  // =========================================================================
  // 4. NUMBER REVEAL & PROGRESS BAR COORDINATION
  // =========================================================================
  describe('4. Accurate Number Reveal & Progress Bar Scaling', () => {
    it('animates numbers from 0 to real value with coordinated delays matching clipped entrance', () => {
      // Average score delay ~420ms
      assert.ok(panelSrc.includes('delay={shouldReduceMotion ? 0 : 420}'));
      // Revision percentage delay ~1000ms
      assert.ok(panelSrc.includes('delay={shouldReduceMotion ? 0 : 1000}'));
      // Concepts to revisit delay ~1800ms
      assert.ok(panelSrc.includes('delay={shouldReduceMotion ? 0 : 1800}'));
    });

    it('scales revision progress line from scaleX: 0 to exact revisionProgressRatio', () => {
      assert.ok(panelSrc.includes('initial={{ scaleX: 0 }}'));
      assert.ok(panelSrc.includes('animate={{ scaleX: revisionProgressRatio }}'));
      assert.ok(panelSrc.includes("style={{ transformOrigin: 'left' }}"));
      assert.ok(panelSrc.includes('duration: shouldReduceMotion ? 0 : 1.0'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 1.20'));
    });

    it('sets revisionProgressRatio to 0 when revisionProgress is null or 0%', () => {
      assert.ok(panelSrc.includes('const revisionProgressRatio = revisionProgress'));
      assert.ok(panelSrc.includes('Math.max(0, Math.min(100, revisionProgress.progressPercent)) / 100'));
    });
  });

  // =========================================================================
  // 5. LIFECYCLE, REDUCED MOTION & SCOPE INTEGRITY
  // =========================================================================
  describe('5. Lifecycle, Reduced Motion & Scope Integrity', () => {
    it('exports PersonaPerformancePanel wrapped in React.memo to prevent re-render re-animation', () => {
      assert.ok(panelSrc.includes('React.memo'));
      assert.ok(panelSrc.includes("PersonaPerformancePanel.displayName = 'PersonaPerformancePanel';"));
    });

    it('zeros out entrance translations and delays when shouldReduceMotion is enabled', () => {
      assert.ok(panelSrc.includes('shouldReduceMotion ? 0 : 10'));
      assert.ok(panelSrc.includes('shouldReduceMotion ? 0 : 6'));
      assert.ok(panelSrc.includes('shouldReduceMotion ? 0 : 8'));
    });

    it('does not introduce fake metrics, gamification streaks, or audio hooks', () => {
      assert.ok(!panelSrc.includes('streak'));
      assert.ok(!panelSrc.includes('retentionScore'));
      assert.ok(!/\bxp\b/i.test(panelSrc));
      assert.ok(!panelSrc.includes('badge') || panelSrc.includes('persona-score-badge')); // only score badge allowed, no gamification badges
      assert.ok(!panelSrc.includes('speechRecognition'));
      assert.ok(!panelSrc.includes('AudioContext'));
    });
  });
});
