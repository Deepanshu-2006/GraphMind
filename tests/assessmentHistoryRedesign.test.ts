import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND ASSESSMENT HISTORY — PREMIUM REDESIGN VERIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Design Direction & Section Header', () => {
    it('preserves exact section heading and description copy', () => {
      assert.ok(studyViewSrc.includes('Assessment history'), 'Must have heading Assessment history');
      assert.ok(
        studyViewSrc.includes('Every completed assessment, ready to revisit.'),
        'Must have exact supporting description'
      );
    });

    it('styles heading with editorial 24-28px clamp typography and tight spacing', () => {
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*clamp\(24px,\s*2\.5vw,\s*28px\);/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?font-size:\s*clamp\(14px/
      );
    });
  });

  describe('2. Filter Switcher & Signature Gliding Active Pill', () => {
    it('implements refined horizontal segmented control with semantic tablist and tabs', () => {
      assert.ok(studyViewSrc.includes('role="tablist"'), 'Must have tablist role');
      assert.ok(studyViewSrc.includes('aria-label="Assessment filter"'), 'Must have accessible tablist label');
      assert.ok(studyViewSrc.includes('role="tab"'), 'Segments must have role="tab"');
      assert.ok(studyViewSrc.includes('aria-selected='), 'Segments must expose aria-selected');
    });

    it('renders dedicated moving active pill with Framer Motion translation and width adaptation', () => {
      assert.ok(studyViewSrc.includes('className="study-filter-active-pill"'), 'Must render active pill element');
      assert.ok(studyViewSrc.includes('animate={{\n                        x: filterTabBounds.left,'), 'Must animate x to segment position');
      assert.ok(studyViewSrc.includes('width: filterTabBounds.width'), 'Must animate width to segment width');
      assert.ok(studyViewSrc.includes('duration: 0.24'), 'Must have smooth ~240ms movement');
      assert.ok(studyViewSrc.includes('ease: [0.22, 1, 0.36, 1]'), 'Must use smooth deceleration easing');
    });

    it('measures active tab position on mount, filter change, window resize, and ResizeObserver', () => {
      assert.ok(studyViewSrc.includes('updateFilterPillPosition'), 'Must define updateFilterPillPosition');
      assert.ok(studyViewSrc.includes('ResizeObserver'), 'Must use ResizeObserver for container resizing');
      assert.ok(studyViewSrc.includes("addEventListener('resize'"), 'Must listen to window resize');
    });

    it('supports accessible arrow-key keyboard navigation across tabs', () => {
      assert.ok(studyViewSrc.includes('handleFilterTabKeyDown'), 'Must define keyboard navigation');
      assert.ok(studyViewSrc.includes("e.key === 'ArrowRight'"), 'Must handle ArrowRight');
      assert.ok(studyViewSrc.includes("e.key === 'ArrowLeft'"), 'Must handle ArrowLeft');
    });

    it('styles active pill with restrained, low-opacity lime green tint and no heavy glow', () => {
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?background-color:\s*rgba\(163,\s*255,\s*18,\s*0\.08\);/
      );
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?border:\s*1px solid rgba\(163,\s*255,\s*18,\s*0\.18\);/
      );
      assert.match(
        studyCss,
        /\.study-filter-tab\.active\s*\{[\s\S]*?color:\s*#FFFFFF;/
      );
    });
  });

  describe('3. Search Field Matching GraphMind Signature Focus Line', () => {
    it('implements signature focus treatment with 1px lime line along bottom edge', () => {
      assert.ok(studyViewSrc.includes('study-search-focus-line'), 'Must include focus accent line');
      assert.match(
        studyCss,
        /\.study-search-focus-line\s*\{[\s\S]*?background-color:\s*var\(--accent/
      );
      assert.match(
        studyCss,
        /\.study-search-focus-line\s*\{[\s\S]*?transform:\s*scaleX\(0\);/
      );
      assert.match(
        studyCss,
        /\.study-search-wrap\.focused \.study-search-focus-line[\s\S]*?transform:\s*scaleX\(1\);/
      );
    });

    it('transitions search glyph color to lime green on focus', () => {
      assert.match(
        studyCss,
        /\.study-search-wrap\.focused \.study-search-icon[\s\S]*?color:\s*var\(--accent/
      );
    });

    it('preserves immediate search filtering, clearing, and accessible input', () => {
      assert.ok(studyViewSrc.includes('onChange={(e) => setSearchQuery(e.target.value)}'));
      assert.ok(studyViewSrc.includes('className="study-search-clear"'));
      assert.ok(studyViewSrc.includes('setSearchQuery(\'\')'));
    });
  });

  describe('4. Assessment Groups — Elimination of Boxing & 3-Level Hierarchy', () => {
    it('eliminates heavy outer card boxing and replaces with subtle hairline dividers', () => {
      assert.match(
        studyCss,
        /\.study-graph-group\s*\{[\s\S]*?background:\s*transparent;/
      );
      assert.match(
        studyCss,
        /\.study-graph-group\s*\{[\s\S]*?border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.06\);/
      );
    });

    it('implements Level 1 Graph Identity with 19px semibold name and muted attempt count', () => {
      assert.ok(studyViewSrc.includes('className="study-group-name"'));
      assert.ok(studyViewSrc.includes('className="study-group-meta"'));
      assert.ok(studyViewSrc.includes('{group.totalAttempts} {group.totalAttempts === 1 ? \'attempt\' : \'attempts\'}'));
    });

    it('formats Level 1 score comparison with two-line layout aligned right', () => {
      assert.ok(studyViewSrc.includes('className="study-progress-diff-val"'));
      assert.ok(studyViewSrc.includes('className="study-progress-range-lbl"'));
      assert.ok(studyViewSrc.includes('Previous {group.progressComparison.previousScore}% → Latest {group.progressComparison.latestScore}%'));
      assert.match(
        studyCss,
        /\.study-progress-comparison\s*\{[\s\S]*?align-items:\s*flex-end;/
      );
    });

    it('implements Level 2 Latest Assessment with kicker and aligned metrics columns', () => {
      assert.ok(studyViewSrc.includes('className="study-latest-card"'));
      assert.ok(studyViewSrc.includes('className="study-latest-kicker"'));
      assert.ok(studyViewSrc.includes('Latest attempt · Attempt'));
      assert.ok(studyViewSrc.includes('Correct answers'));
      assert.ok(studyViewSrc.includes('Score'));
      assert.ok(studyViewSrc.includes('Completed'));
      assert.ok(studyViewSrc.includes('Concepts to review'));
      assert.ok(studyViewSrc.includes('VIEW RESULTS'));
    });

    it('implements Level 3 Previous Attempts minimal disclosure and clean table', () => {
      assert.ok(studyViewSrc.includes('className="study-disclosure-btn"'));
      assert.ok(studyViewSrc.includes('PREVIOUS ATTEMPTS · {group.previousAttempts.length}'));
      assert.ok(studyViewSrc.includes('study-disclosure-arrow'));
      assert.match(
        studyCss,
        /\.study-table-container\s*\{[\s\S]*?border:\s*none;/
      );
      assert.match(
        studyCss,
        /\.study-table-container\s*\{[\s\S]*?background:\s*transparent;/
      );
    });
  });

  describe('5. Status Badges & Minimal Empty States', () => {
    it('styles time expired badge as compact, restrained status label', () => {
      assert.match(
        studyCss,
        /\.study-badge-expired\s*\{[\s\S]*?background-color:\s*rgba\(239,\s*68,\s*68,\s*0\.08\);/
      );
      assert.match(
        studyCss,
        /\.study-badge-expired\s*\{[\s\S]*?border:\s*1px solid rgba\(239,\s*68,\s*68,\s*0\.2\);/
      );
      assert.match(
        studyCss,
        /\.study-badge-expired\s*\{[\s\S]*?color:\s*#F87171;/
      );
    });

    it('provides clear differentiation between search query empty state and filter empty states', () => {
      assert.ok(studyViewSrc.includes('No assessments found matching "${searchQuery}"'));
      assert.ok(studyViewSrc.includes('No assessments need review'));
      assert.ok(studyViewSrc.includes('Clear search query'));
      assert.ok(studyViewSrc.includes('Clear search filters'));
    });
  });

  describe('6. Motion & Responsive Reflow', () => {
    it('animates list transition subtly on filter and search state changes', () => {
      assert.ok(studyViewSrc.includes('key={`${activeFilterKey}-${searchQuery ? \'search\' : \'nosearch\'}`'));
      assert.ok(studyViewSrc.includes('duration: 0.18'));
    });

    it('defines responsive reflow rules for tablet and mobile', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.study-controls-bar\s*\{[\s\S]*?flex-direction:\s*column;/
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.study-filter-tabs\s*\{[\s\S]*?overflow-x:\s*auto;/
      );
    });
  });
});
