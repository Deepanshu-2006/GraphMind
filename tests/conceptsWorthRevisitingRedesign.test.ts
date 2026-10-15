import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Concepts Worth Revisiting Section Redesign', () => {
  const studyViewPath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const studyCssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Section Spacing and Positioning', () => {
    it('applies consistent vertical spacing matching Assessment History and Learning Progress', () => {
      // Assessment History and Learning Progress use margin-top: 56px
      assert.match(
        studyCss,
        /\.study-revisit-section\s*\{[^}]*margin-top:\s*56px;/,
        'Concepts Worth Revisiting must use the same 56px margin-top as Assessment History and Learning Progress'
      );
      assert.match(
        studyCss,
        /\.study-revisit-section\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/,
        'Section must display as flex column naturally continuing the layout'
      );
    });

    it('does not insert artificial divider lines between sections', () => {
      // The section itself should not have borders or divider bars
      const sectionMatch = studyCss.match(/\.study-revisit-section\s*\{([^}]+)\}/);
      assert.ok(sectionMatch, 'study-revisit-section must exist in CSS');
      assert.ok(!sectionMatch[1].includes('border-top:'), 'Must not have artificial border-top divider');
    });
  });

  describe('2. Section Eyebrow', () => {
    it('uses GraphMind lime-green accent matching LEARNING PROGRESS and CONTINUE LEARNING', () => {
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[^}]*color:\s*var\(--accent,\s*#A3FF12\);/,
        'Eyebrow must use the exact lime-green accent color var(--accent, #A3FF12)'
      );
    });

    it('matches uppercase compact monospace typography and letter spacing', () => {
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[^}]*font-family:\s*var\(--font-mono,\s*monospace\);/,
        'Must use monospace font family'
      );
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[^}]*text-transform:\s*uppercase;/,
        'Must be uppercase'
      );
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[^}]*letter-spacing:\s*0\.16em;/,
        'Must match 0.16em letter-spacing of other section kickers'
      );
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[^}]*font-size:\s*10\.5px;/,
        'Must match 10.5px compact font size'
      );
    });

    it('renders WORTH ANOTHER LOOK in StudySpaceView JSX', () => {
      assert.ok(
        studyViewSrc.includes('WORTH ANOTHER LOOK'),
        'Must render WORTH ANOTHER LOOK'
      );
      assert.ok(
        studyViewSrc.includes('study-revisit-eyebrow'),
        'Must apply study-revisit-eyebrow class'
      );
    });
  });

  describe('3. Section Heading and Description', () => {
    it('uses the same typography system as Assessment History and Learning Progress', () => {
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-title\s*\{[^}]*font-family:\s*var\(--font-display(?:,\s*'Inter Tight')?,\s*var\(--font-body,\s*sans-serif\)\);/,
        'Heading must use the display font family'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-title\s*\{[^}]*font-size:\s*clamp\((?:32px,\s*3\.2vw,\s*38px|30px,\s*3\.4vw,\s*40px)\);/,
        'Heading must use the display size'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-title\s*\{[^}]*font-weight:\s*(?:550|650|700);/,
        'Heading must use font-weight: 550–700'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-title\s*\{[^}]*letter-spacing:\s*(?:-0\.025em|-0\.04em);/,
        'Heading must match letter-spacing: -0.025em to -0.04em'
      );
    });

    it('renders the exact heading and supporting description', () => {
      assert.ok(
        studyViewSrc.includes('Concepts worth revisiting'),
        'Must have primary heading "Concepts worth revisiting"'
      );
      assert.ok(
        studyViewSrc.includes(
          'Identified from questions answered incorrectly or left unanswered in your assessment history.'
        ),
        'Must have supporting description text'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-desc\s*\{[^}]*color:\s*#777777;/,
        'Description must be rendered in muted gray #777777'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block\s+\.study-section-desc\s*\{[^}]*font-size:\s*15px;/,
        'Description must have font-size 15px matching Assessment History description'
      );
    });
  });

  describe('4. Redesign the Concept Rows', () => {
    it('removes visual heaviness and boxed borders in favor of subtle horizontal separators', () => {
      assert.match(
        studyCss,
        /\.study-revisit-card\s*\{[^}]*border:\s*none;/,
        'Must remove prominent rectangular borders'
      );
      assert.match(
        studyCss,
        /\.study-revisit-card\s*\{[^}]*border-bottom:\s*1px\s+solid\s+rgba\(255,\s*255,\s*255,\s*0\.05\);/,
        'Must use subtle hairline horizontal separator'
      );
      assert.match(
        studyCss,
        /\.study-revisit-card:last-child\s*\{[^}]*border-bottom:\s*none;/,
        'Last row must not have bottom border'
      );
      assert.match(
        studyCss,
        /\.study-revisit-card:hover\s*\{[^}]*background-color:\s*rgba\(255,\s*255,\s*255,\s*0\.02\);/,
        'Hover state must use subtle low-contrast tint'
      );
    });

    it('formats sequential numbers as restrained monospace 01, 02 in muted gray', () => {
      assert.ok(
        studyViewSrc.includes('className="study-revisit-num"'),
        'Must render numbering element'
      );
      assert.ok(
        studyViewSrc.includes('{pad(idx + 1)}'),
        'Must format numbers with 2 digits (pad)'
      );
      assert.match(
        studyCss,
        /\.study-revisit-num\s*\{[^}]*font-family:\s*var\(--font-mono,\s*monospace\);/,
        'Number must use monospace font'
      );
      assert.match(
        studyCss,
        /\.study-revisit-num\s*\{[^}]*color:\s*#555555;/,
        'Number must use restrained muted gray #555555'
      );
    });

    it('styles concept names as the primary visual element within each row', () => {
      assert.match(
        studyCss,
        /\.study-revisit-name\s*\{[^}]*font-size:\s*16px;/,
        'Concept name must be 16px'
      );
      assert.match(
        studyCss,
        /\.study-revisit-name\s*\{[^}]*font-weight:\s*550;/,
        'Concept name must have weight 550 for clear distinction'
      );
      assert.match(
        studyCss,
        /\.study-revisit-name\s*\{[^}]*color:\s*var\(--text-primary,\s*#F5F5F5\);/,
        'Concept name must use primary white text'
      );
    });

    it('demotes graph-name badge from heavy box to understated metadata without green fill', () => {
      assert.match(
        studyCss,
        /\.study-revisit-graph-tag\s*\{[^}]*background:\s*none;/,
        'Graph tag must remove heavy background'
      );
      assert.match(
        studyCss,
        /\.study-revisit-graph-tag\s*\{[^}]*border:\s*none;/,
        'Graph tag must have no border'
      );
      assert.match(
        studyCss,
        /\.study-revisit-graph-tag\s*\{[^}]*color:\s*#666666;/,
        'Graph tag must use quiet muted gray #666666'
      );
      assert.ok(
        studyViewSrc.includes('study-revisit-meta-sep'),
        'Must render subtle metadata separator'
      );
    });

    it('renders review context directly below concept name in muted gray', () => {
      assert.match(
        studyCss,
        /\.study-revisit-status\s*\{[^}]*color:\s*#777777;/,
        'Review context must use muted gray #777777'
      );
      assert.match(
        studyCss,
        /\.study-revisit-status\s*\{[^}]*font-size:\s*13\.5px;/,
        'Review context must have compact 13.5px size'
      );
    });

    it('refines REVIEW IN GRAPH action with lime-green arrow and smooth 220ms hover translation', () => {
      assert.match(
        studyCss,
        /\.study-revisit-action-btn\s+\.study-revisit-arrow\s*\{[^}]*color:\s*var\(--accent,\s*#A3FF12\);/,
        'Arrow must be colored in GraphMind lime-green'
      );
      assert.match(
        studyCss,
        /\.study-revisit-action-btn\s+\.study-revisit-arrow\s*\{[^}]*transition:\s*transform\s*220ms/,
        'Arrow must have a 220ms smooth transition'
      );
      assert.match(
        studyCss,
        /\.study-revisit-card:hover\s+\.study-revisit-arrow[^{]*\{[^}]*transform:\s*translateX\(4px\);/,
        'Hovering the row moves the arrow 4px to the right'
      );
      assert.match(
        studyCss,
        /\.study-revisit-card:hover\s+\.study-revisit-action-btn[^{]*\{[^}]*color:\s*#EEEEEE;/,
        'Hovering the row subtly brightens the text color'
      );
    });
  });

  describe('5. Row Spacing and Visual Hierarchy', () => {
    it('applies comfortable padding and alignment across rows', () => {
      assert.match(
        studyCss,
        /\.study-revisit-card\s*\{[^}]*padding:\s*18px\s+12px;/,
        'Rows must use comfortable 18px vertical padding'
      );
      assert.match(
        studyCss,
        /\.study-revisit-action-wrap\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/,
        'Action must be vertically centered'
      );
    });
  });

  describe('6. Show All Control', () => {
    it('uses muted gray text, lime arrow, and animated micro-interaction', () => {
      assert.match(
        studyCss,
        /\.study-concepts-expand-btn\s*\{[^}]*color:\s*#777777;/,
        'Expand button default text must be muted gray #777777'
      );
      assert.match(
        studyCss,
        /\.study-concepts-expand-arrow\s*\{[^}]*color:\s*var\(--accent,\s*#A3FF12\);/,
        'Expand button arrow must be lime green'
      );
      assert.match(
        studyCss,
        /\.study-concepts-expand-btn:hover\s+\.study-concepts-expand-arrow\s*\{[^}]*transform:\s*translateY\(2px\);/,
        'Arrow animates slightly downward when collapsed'
      );
      assert.match(
        studyCss,
        /\.study-concepts-expand-btn:hover\s+\.study-concepts-expand-arrow\.expanded\s*\{[^}]*transform:\s*translateY\(-2px\);/,
        'Arrow animates slightly upward when expanded'
      );
    });

    it('preserves expansion toggle logic and dynamic label', () => {
      assert.ok(
        studyViewSrc.includes('Show fewer concepts'),
        'Must support collapsing concepts list'
      );
      assert.ok(
        studyViewSrc.includes('Show all ${conceptsWorthRevisiting.length} concepts worth revisiting'),
        'Must show total count in expand label'
      );
    });
  });

  describe('7. Scroll-Triggered Entry Animation', () => {
    it('uses useInView observer with once: true so it triggers when scrolled into view without repeating', () => {
      assert.ok(
        studyViewSrc.includes('revisitSectionRef'),
        'Must have ref for scroll-triggered observation'
      );
      assert.ok(
        studyViewSrc.includes('useInView(revisitSectionRef, { once: true, amount: 0.1 })'),
        'Must observe scroll entrance with once: true'
      );
      assert.ok(
        studyViewSrc.includes('hasRevisitEnteredView'),
        'Must track view entry state'
      );
    });

    it('staggers consecutive concept rows with refined easing cubic-bezier(0.22, 1, 0.36, 1)', () => {
      assert.ok(
        studyViewSrc.includes('EDITORIAL_EASE = [0.22, 1, 0.36, 1]'),
        'Must use refined easing curve cubic-bezier(0.22, 1, 0.36, 1)'
      );
      assert.ok(
        studyViewSrc.includes('delay: 0.14 + idx * 0.05'),
        'Must stagger consecutive rows by 50ms'
      );
      assert.ok(
        studyViewSrc.includes('duration: 0.46'),
        'Must use duration around 460ms (400-500ms range)'
      );
      assert.ok(
        studyViewSrc.includes('y: 12'),
        'Must translate rows upward by 12px (10-14px range)'
      );
    });

    it('respects prefers-reduced-motion in both Framer Motion and CSS', () => {
      assert.ok(
        studyViewSrc.includes('shouldReduceMotion ? false : { opacity: 0, y: 12 }'),
        'Framer Motion must disable entry animation for reduced motion'
      );
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-revisit-card[\s\S]*?transition:\s*none\s*!important;/,
        'CSS must disable transitions when reduced motion is preferred'
      );
    });
  });

  describe('8. Responsive Design', () => {
    it('provides tablet and mobile responsive rules for revisit section', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*960px\)[\s\S]*?\.study-revisit-header-block\s+\.study-section-title/,
        'Tablet breakpoint must scale title'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-revisit-card\s*\{[^}]*display:\s*grid;/,
        'Mobile breakpoint must switch to clean grid layout'
      );
    });
  });
});
