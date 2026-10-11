import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — GRAPH SELECTOR VISUAL REFINEMENT SPECIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Closed Selector (Section 5)', () => {
    it('renders a restrained lime-green indicator with transition on graph switch, without pulsing or permanent glow', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-pip-slot'), 'Must have pip slot');
      assert.ok(studyViewSrc.includes('study-graph-selector-pip'), 'Must have pip indicator');
      assert.ok(
        studyViewSrc.includes('key={selectedGraph?.id || \'none\'}'),
        'Pip must have key on selectedGraph to trigger transition on graph switch'
      );
      assert.doesNotMatch(
        studyCss,
        /\.study-graph-selector-pip\s*\{[\s\S]*?animation:\s*pulse/i,
        'Pip must not have pulsing animation'
      );
      assert.doesNotMatch(
        studyCss,
        /\.study-graph-selector-pip\s*\{[\s\S]*?box-shadow:\s*0 0 1[0-9]px/i,
        'Pip must not have oversized glowing shadow'
      );
    });

    it('renders selected graph name with medium-weight and graceful truncation', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-name'), 'Must have graph name class');
      assert.match(
        studyCss,
        /\.study-graph-selector-name\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/,
        'Name must gracefully truncate with text-overflow ellipsis'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-trigger\s*\{[\s\S]*?font-weight:\s*500;/,
        'Trigger font-weight must be medium (500)'
      );
    });

    it('renders chevron with rotation animation synchronized with dropdown open state', () => {
      assert.ok(studyViewSrc.includes('ChevronDown'), 'Must render ChevronDown');
      assert.ok(studyViewSrc.includes('study-graph-selector-chevron'), 'Must have chevron class');
      assert.match(
        studyCss,
        /\.study-graph-selector-chevron\.open\s*\{[\s\S]*?transform:\s*rotate\(180deg\);/,
        'Chevron must rotate 180 degrees when open'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-chevron\s*\{[\s\S]*?transition:\s*transform/,
        'Chevron must have smooth transition for rotation'
      );
    });

    it('provides carefully designed hover, focus-visible, and open states', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-trigger:hover\s*\{/,
        'Must have hover state'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-trigger:focus-visible\s*\{[\s\S]*?border-color:\s*var\(--accent,\s*#A3FF12\);/,
        'Must have lime-green focus-visible state'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-trigger\.is-open\s*\{/,
        'Must have is-open active state'
      );
    });
  });

  describe('2. Removal of Green Selected-Row Background & Minimal Selected State (Section 1)', () => {
    it('completely removes persistent green background tint on selected option row', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-option\.is-selected\s*\{[\s\S]*?background-color:\s*transparent;/,
        'Selected row must use transparent background matching dropdown surface'
      );
      assert.doesNotMatch(
        studyCss,
        /\.study-graph-selector-option\.is-selected\s*\{[^}]*background-color:\s*rgba\(163,\s*255,\s*18/i,
        'Selected row must NOT have lime green background tint'
      );
    });

    it('differentiates selected state through crisp white title and lime pip indicator', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-option\.is-selected\s+\.study-graph-selector-option-title\s*\{[\s\S]*?color:\s*#FFFFFF;/,
        'Selected option title must be crisp white (#FFFFFF)'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-option-title\s*\{[\s\S]*?color:\s*#CCCCCC;/,
        'Unselected option title must be slightly muted white (#CCCCCC)'
      );
      assert.ok(studyViewSrc.includes('study-graph-selector-option-pip'), 'Selected row has lime-green pip');
    });

    it('reserves lime green for indicator, rendering scores in white/muted text', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-option-score\s*\{[\s\S]*?color:\s*#8E8E8E;/,
        'Ordinary score must be muted gray (#8E8E8E), not lime green'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-option-score\.is-selected\s*\{[\s\S]*?color:\s*#E5E5E5;/,
        'Selected row score must be clean light gray/white (#E5E5E5)'
      );
    });
  });

  describe('3. Matching GraphMind Main Search Bar Interaction (Section 4)', () => {
    it('uses matching search control container, input, and focus line structure', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-search-control'), 'Must have search control container');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-focus-line'), 'Must have signature focus line');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-input'), 'Must have search input');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-clear'), 'Must have clear button');
    });

    it('implements main search bar animations: icon color transition, input borderless reset, and bottom focus line reveal', () => {
      // Focus line animation matches main search bar
      assert.match(
        studyCss,
        /\.study-graph-selector-search-focus-line\s*\{[\s\S]*?background-color:\s*var\(--accent,\s*#A3FF12\);[\s\S]*?transform:\s*scaleX\(0\);[\s\S]*?transition:\s*transform 220ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/,
        'Focus line must animate scaleX with 220ms cubic-bezier matching main search bar'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-search-control\.focused\s+\.study-graph-selector-search-focus-line\s*\{[\s\S]*?transform:\s*scaleX\(1\);/,
        'Focus line must expand to scaleX(1) on focused container'
      );
      // Input has zero borders and zero outline
      assert.match(
        studyCss,
        /\.study-graph-selector-search-input[\s\S]*?border:\s*none\s*!important;[\s\S]*?outline:\s*none\s*!important;/,
        'Search input must have zero borders/outlines matching main search input'
      );
      // Icon color shift
      assert.match(
        studyCss,
        /\.study-graph-selector-search-control\.focused\s+\.study-graph-selector-search-icon\s*\{[\s\S]*?color:\s*#B8FF3D;[\s\S]*?transform:\s*translateX\(1px\);/,
        'Search icon must transition to #B8FF3D and translateX(1px) matching main search bar'
      );
    });
  });

  describe('4. Dropdown Panel Typography & Hierarchy (Section 2 & 3)', () => {
    it('renders panel header with KNOWLEDGE GRAPHS kicker and accurate dynamic graph count', () => {
      assert.ok(studyViewSrc.includes('KNOWLEDGE GRAPHS'), 'Header must contain KNOWLEDGE GRAPHS kicker');
      assert.ok(studyViewSrc.includes('{availableGraphs.length}'), 'Header must display dynamic graph count');
      assert.match(
        studyCss,
        /\.study-graph-selector-popover-kicker\s*\{[\s\S]*?text-transform:\s*uppercase;[\s\S]*?letter-spacing:/,
        'Kicker must use tracked uppercase mono font'
      );
    });

    it('renders graph options with structured text group and right-aligned tabular scores', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-option-main'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-pip-wrap'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-info'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-title'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-meta'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-score'));
      assert.match(
        studyCss,
        /\.study-graph-selector-option-meta\s*\{[\s\S]*?font-size:\s*11px;[\s\S]*?color:\s*#777777;/,
        'Meta must be 11px muted gray'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-option-score\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums;/,
        'Score must use tabular-nums for vertical alignment'
      );
    });

    it('renders thoughtful empty search state with clear search button', () => {
      assert.ok(studyViewSrc.includes('No graphs found'), 'Must have empty title');
      assert.ok(studyViewSrc.includes('Try another search.'), 'Must have empty subtitle');
      assert.ok(studyViewSrc.includes('study-graph-selector-empty-clear'), 'Must have clear search button');
    });
  });

  describe('5. Opening & Closing Animation & Accessibility (Section 6 & 7)', () => {
    it('uses AnimatePresence for coordinated opening and closing animation', () => {
      assert.ok(studyViewSrc.includes('<AnimatePresence>'), 'Must wrap popover in AnimatePresence');
      assert.ok(studyViewSrc.includes('initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.99 }}'));
      assert.ok(studyViewSrc.includes('exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.99 }}'));
    });

    it('staggers entry of graph option rows', () => {
      assert.ok(
        studyViewSrc.includes('Math.min(0.18, 0.05 + idx * 0.03)'),
        'Must apply subtle stagger delay to graph rows'
      );
    });

    it('respects prefers-reduced-motion across Framer Motion props and CSS', () => {
      assert.ok(studyViewSrc.includes('shouldReduceMotion = false'));
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-graph-selector-popover[\s\S]*?transition:\s*none\s*!important;/,
        'CSS must disable transitions and transforms on reduced motion'
      );
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-graph-selector-search-focus-line/,
        'CSS must disable focus line transitions on reduced motion'
      );
    });

    it('provides ARIA attributes for listbox and trigger button', () => {
      assert.ok(studyViewSrc.includes('aria-haspopup="listbox"'));
      assert.ok(studyViewSrc.includes('aria-expanded={isOpen}'));
      assert.ok(studyViewSrc.includes('role="listbox"'));
      assert.ok(studyViewSrc.includes('role="option"'));
      assert.ok(studyViewSrc.includes('aria-selected={isSelected}'));
    });

    it('handles outside clicks, Escape key, and keyboard selection', () => {
      assert.ok(studyViewSrc.includes('pointerdown'), 'Must attach pointerdown listener for outside clicks');
      assert.ok(studyViewSrc.includes('e.key === \'Escape\''), 'Must handle Escape key');
      assert.ok(studyViewSrc.includes('e.key === \'ArrowDown\''), 'Must handle ArrowDown key');
      assert.ok(studyViewSrc.includes('e.key === \'ArrowUp\''), 'Must handle ArrowUp key');
      assert.ok(studyViewSrc.includes('e.key === \'Enter\''), 'Must handle Enter key');
    });
  });
});
