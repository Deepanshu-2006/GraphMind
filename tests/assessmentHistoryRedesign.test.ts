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

    it('styles heading with editorial clamp typography matching Learning Progress and tight spacing', () => {
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*clamp\((?:32px,\s*3\.2vw,\s*38px|30px,\s*3\.4vw,\s*40px)\);/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?font-size:\s*15px;/
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

    it('styles active pill with solid lime-green fill, 6px rounding, and near-black active text', () => {
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?background-color:\s*var\(--accent,\s*#A3FF12\);/
      );
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?border:\s*none;/
      );
      assert.match(
        studyCss,
        /\.study-filter-active-pill\s*\{[\s\S]*?border-radius:\s*6px;/
      );
      assert.match(
        studyCss,
        /\.study-filter-tab\.active\s*\{[\s\S]*?color:\s*#0A0A0A;/
      );
      assert.match(
        studyCss,
        /\.study-filter-tab\.active\s*\{[\s\S]*?font-weight:\s*600;/
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

  describe('4. Assessment Groups — Elimination of Boxing & Editorial Hierarchy', () => {
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

    it('implements Graph Identity with 20px semibold name and singular/plural assessment count', () => {
      assert.ok(studyViewSrc.includes('className="study-group-name"'));
      assert.ok(studyViewSrc.includes('className="study-group-count study-group-meta"'));
      assert.ok(studyViewSrc.includes("{group.totalAttempts} {group.totalAttempts === 1 ? 'assessment' : 'assessments'}"));
      assert.match(
        studyCss,
        /\.study-group-name\s*\{[\s\S]*?font-size:\s*20px;/
      );
    });

    it('removes redundant score comparisons, percentage points, and percentage score from records', () => {
      assert.ok(!studyViewSrc.includes('study-progress-diff-val'), 'Must not repeat percentage point comparisons in history');
      assert.ok(!studyViewSrc.includes('study-progress-range-lbl'), 'Must not display previous to latest score ranges');
    });

    it('implements minimal editorial records list with clear metric columns and labels', () => {
      assert.ok(studyViewSrc.includes('className="study-records-list"'));
      assert.ok(studyViewSrc.includes('className="study-record-item"'));
      assert.ok(studyViewSrc.includes('className="study-record-identity"'));
      assert.ok(studyViewSrc.includes('Attempt {attemptNumber}'));
      assert.ok(studyViewSrc.includes('CORRECT ANSWERS'));
      assert.ok(studyViewSrc.includes('COMPLETED'));
      assert.ok(studyViewSrc.includes('TO REVIEW'));
      assert.ok(studyViewSrc.includes('View results'));
      assert.match(
        studyCss,
        /\.study-record-val-primary\s*\{[\s\S]*?font-size:\s*24px;/
      );
    });

    it('styles records with clean hairline dividers and restrained whitespace', () => {
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.05\);/
      );
      assert.match(
        studyCss,
        /\.study-record-item:last-child\s*\{[\s\S]*?border-bottom:\s*none;/
      );
    });
  });

  describe('5. Status Badges & Minimal Empty States', () => {
    it('styles time expired as a restrained inline status (● Expired)', () => {
      assert.ok(studyViewSrc.includes('study-status-expired'));
      assert.ok(studyViewSrc.includes('Expired'));
      assert.match(
        studyCss,
        /\.study-status-expired[\s\S]*?color:\s*#F87171;/
      );
      assert.match(
        studyCss,
        /\.study-status-expired[\s\S]*?background:\s*transparent;/
      );
      assert.match(
        studyCss,
        /\.study-status-expired[\s\S]*?border:\s*none;/
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

  describe('7. Typography Alignment & Section Separation Polish', () => {
    it('matches typography language of Learning Progress for section heading and description', () => {
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-weight:\s*(?:550|650|700);/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?letter-spacing:\s*(?:-0\.025em|-0\.04em);/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?line-height:\s*(?:1\.08|1\.15);/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?color:\s*#777777;/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?max-width:\s*520px;/
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?margin-top:\s*8px;/
      );
    });

    it('enforces identical section separation gap between Learning Progress and Assessment History as Continue Learning', () => {
      assert.match(
        studyCss,
        /\.study-history-section\s*\{[\s\S]*?margin-top:\s*56px;/
      );
      assert.match(
        studyCss,
        /\.study-progress-section\s*\{[\s\S]*?margin-bottom:\s*64px;/
      );
    });

    it('applies signature masked clip and slide entry animation to assessment history heading matching learning progress', () => {
      assert.ok(
        studyViewSrc.includes('study-history-title-clip'),
        'History heading must have title clip wrapper'
      );
      assert.ok(
        studyViewSrc.includes('study-history-title-line'),
        'History heading line must have title line element'
      );
      assert.match(
        studyCss,
        /\.study-history-title-clip\s*\{[\s\S]*?overflow:\s*hidden;/
      );
      assert.match(
        studyCss,
        /\.study-history-title-line\s*\{[\s\S]*?transform-origin:\s*0%\s+100%;/
      );
    });

    it('unifies muted metadata and metric labels with #777777 and compact letter-spacing', () => {
      assert.match(
        studyCss,
        /\.study-group-count,\s*\n?\.study-group-meta\s*\{[\s\S]*?color:\s*#777777;/
      );
      assert.match(
        studyCss,
        /\.study-record-identity\s*\{[\s\S]*?color:\s*#777777;/
      );
      assert.match(
        studyCss,
        /\.study-record-identity\s*\{[\s\S]*?letter-spacing:\s*0\.04em;/
      );
      assert.match(
        studyCss,
        /\.study-record-lbl\s*\{[\s\S]*?color:\s*#777777;/
      );
    });
  });
});
