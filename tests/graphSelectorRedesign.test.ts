import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — GRAPH SELECTOR REDESIGN SPECIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Closed Selector Redesign (Section 2)', () => {
    it('renders a restrained lime-green indicator with transition on graph switch, without pulsing or permanent glow', () => {
      // Must contain pip-slot and pip
      assert.ok(studyViewSrc.includes('study-graph-selector-pip-slot'), 'Must have pip slot');
      assert.ok(studyViewSrc.includes('study-graph-selector-pip'), 'Must have pip indicator');
      // Motion animation keyed to selectedGraph.id
      assert.ok(
        studyViewSrc.includes('key={selectedGraph?.id || \'none\'}'),
        'Pip must have key on selectedGraph to trigger transition on graph switch'
      );
      // CSS does not have permanent glow or pulse animation
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

  describe('2. Positioning and Responsive Layout (Section 3)', () => {
    it('positions selector in header right area aligned with header content', () => {
      assert.ok(studyViewSrc.includes('study-header-main-row'));
      assert.ok(studyViewSrc.includes('study-header-right'));
      assert.match(
        studyCss,
        /\.study-header-main-row\s*\{[\s\S]*?justify-content:\s*space-between;/,
        'Header row must justify content between title and selector'
      );
    });

    it('stacks selector cleanly below heading on narrower screens without colliding', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*820px\)\s*\{[\s\S]*?\.study-header-main-row\s*\{[\s\S]*?flex-direction:\s*column;/,
        'Must stack vertically on narrow screens'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*820px\)\s*\{[\s\S]*?\.study-graph-selector-trigger\s*\{[\s\S]*?width:\s*100%;/,
        'Selector trigger must span width on mobile'
      );
    });
  });

  describe('3. Dropdown Panel Design (Section 4)', () => {
    it('uses near-black surface with thin border and controlled corner radius', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-popover\s*\{[\s\S]*?background-color:\s*#111111;[\s\S]*?border-radius:\s*8px;/,
        'Popover surface must be near-black (#111111) with 8px border-radius'
      );
    });

    it('renders panel header with KNOWLEDGE GRAPHS kicker and accurate dynamic graph count', () => {
      assert.ok(studyViewSrc.includes('KNOWLEDGE GRAPHS'), 'Header must contain KNOWLEDGE GRAPHS kicker');
      assert.ok(studyViewSrc.includes('{availableGraphs.length}'), 'Header must display dynamic graph count');
      assert.match(
        studyCss,
        /\.study-graph-selector-popover-kicker\s*\{[\s\S]*?text-transform:\s*uppercase;[\s\S]*?letter-spacing:/,
        'Kicker must use tracked uppercase mono font'
      );
    });

    it('renders improved search field with subtle distinction and restrained focus border', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-search-box'), 'Must have search box');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-input'), 'Must have search input');
      assert.match(
        studyCss,
        /\.study-graph-selector-search-input:focus\s*\{[\s\S]*?border-color:\s*rgba\(163,\s*255,\s*18,\s*0\.40\);/,
        'Focus must use restrained lime-green border without glowing green outline'
      );
      assert.ok(studyViewSrc.includes('study-graph-selector-search-clear'), 'Must have clear button');
    });

    it('renders graph options with structured left text group and right latest score', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-option-main'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-pip-wrap'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-info'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-title'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-meta'));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-score'));
      assert.match(
        studyCss,
        /\.study-graph-selector-option-score\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums;/,
        'Score must use tabular-nums for vertical alignment'
      );
    });

    it('styles selected option with subtle lime-green background tint and restrained indicator', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-option\.is-selected\s*\{[\s\S]*?background-color:\s*rgba\(163,\s*255,\s*18,\s*0\.07\);/,
        'Selected row must use subtle lime tint background'
      );
      assert.ok(studyViewSrc.includes('study-graph-selector-option-pip'));
    });

    it('renders thoughtful empty search state with clear search button', () => {
      assert.ok(studyViewSrc.includes('No graphs found'), 'Must have empty title');
      assert.ok(studyViewSrc.includes('Try another search.'), 'Must have empty subtitle');
      assert.ok(studyViewSrc.includes('study-graph-selector-empty-clear'), 'Must have clear search button');
    });
  });

  describe('4. Opening & Closing Animation (Section 5 & 6)', () => {
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
    });
  });

  describe('5. Accessibility and Interaction Continuity (Section 7 & 8)', () => {
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
