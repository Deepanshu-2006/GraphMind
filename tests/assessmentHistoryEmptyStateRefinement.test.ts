import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND ASSESSMENT HISTORY — EMPTY STATE REFINEMENT', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Left-Aligned Editorial Architecture (Eliminating Centered Boxing)', () => {
    it('uses dedicated study-history-empty-state container for zero-assessments state', () => {
      assert.ok(
        studyViewSrc.includes('selectedGraphAttempts.length === 0 ? ('),
        'Must branch on selectedGraphAttempts.length === 0'
      );
      assert.ok(
        studyViewSrc.includes('className="study-history-empty-state"'),
        'Must use dedicated study-history-empty-state class instead of generic centered search empty'
      );
    });

    it('enforces left-aligned, borderless layout in CSS without background or centering', () => {
      assert.match(
        studyCss,
        /\.study-history-empty-state\s*\{[\s\S]*?align-items:\s*flex-start;/,
        'Must align items to flex-start (left-aligned)'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-state\s*\{[\s\S]*?text-align:\s*left;/,
        'Must set text-align: left'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-state\s*\{[\s\S]*?background:\s*transparent;/,
        'Must have transparent background'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-state\s*\{[\s\S]*?border:\s*none;/,
        'Must have border: none'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-state\s*\{[\s\S]*?max-width:\s*520px;/,
        'Must constrain max-width to 520px for editorial reading comfort'
      );
    });
  });

  describe('2. Visual Hierarchy & Exact Messaging', () => {
    it('displays exact title: No assessment history yet.', () => {
      assert.ok(
        studyViewSrc.includes('No assessment history yet.'),
        'Must preserve exact title copy'
      );
      assert.ok(
        studyViewSrc.includes('className="study-history-empty-title"'),
        'Must wrap in study-history-empty-title'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-title\s*\{[\s\S]*?font-weight:\s*550;/,
        'Title must have font-weight: 550'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-title\s*\{[\s\S]*?color:\s*var\(--text-primary,\s*#F5F5F5\);/,
        'Title must use #F5F5F5 primary text token'
      );
    });

    it('displays exact explanatory subtitle: Completed assessments will appear here.', () => {
      assert.ok(
        studyViewSrc.includes('Completed assessments will appear here.'),
        'Must preserve exact subtitle copy'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-desc[\s\S]*?color:\s*var\(--text-secondary,\s*#9CA3AF\);/,
        'Subtitle must use secondary text color #9CA3AF'
      );
      assert.match(
        studyCss,
        /\.study-history-empty-desc[\s\S]*?line-height:\s*1\.6;/,
        'Subtitle must have comfortable 1.6 line-height'
      );
    });
  });

  describe('3. Signature Action Link & Electric Lime Hover Interactions', () => {
    it('renders text action link with exact "Start assessment" text and directional arrow', () => {
      assert.ok(
        studyViewSrc.includes('className="study-history-empty-action"'),
        'Must use study-history-empty-action button'
      );
      assert.ok(
        studyViewSrc.includes('<span>Start assessment</span>'),
        'Must include exact <span>Start assessment</span> text'
      );
      assert.ok(
        studyViewSrc.includes('className="study-history-empty-action-arrow"'),
        'Must include directional arrow element'
      );
    });

    it('transitions action color to electric lime (#A3FF12) on hover and focus-visible', () => {
      assert.match(
        studyCss,
        /\.study-history-empty-action:hover,\s*\.study-history-empty-action:focus-visible\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Must turn text to electric lime on hover/focus'
      );
    });

    it('translates arrow 4px to the right on hover and focus-visible', () => {
      assert.match(
        studyCss,
        /\.study-history-empty-action:hover\s*\.study-history-empty-action-arrow[\s\S]*?transform:\s*translateX\(4px\);/,
        'Must translate arrow 4px on hover'
      );
    });

    it('provides accessible focus indicator with lime outline', () => {
      assert.match(
        studyCss,
        /\.study-history-empty-action:focus-visible\s*\{[\s\S]*?outline:\s*1px solid var\(--accent,\s*#A3FF12\);/,
        'Must provide 1px lime outline on focus-visible'
      );
    });
  });

  describe('4. Motion, Accessibility & Responsive Behavior', () => {
    it('animates empty state with REVEAL_EASE easing on view entry', () => {
      assert.ok(
        studyViewSrc.includes('animate={hasHistoryEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}'),
        'Must trigger entrance animation when history section enters view'
      );
      assert.ok(
        studyViewSrc.includes('transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.38, delay: 0.16, ease: REVEAL_EASE }}'),
        'Must use REVEAL_EASE and honor shouldReduceMotion'
      );
    });

    it('disables arrow transition and transform under prefers-reduced-motion in CSS', () => {
      assert.match(
        studyCss,
        /\.study-history-empty-action-arrow\s*\{[\s\S]*?transition:\s*none !important;/
      );
    });

    it('sets max-width: 100% on mobile breakpoints', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.study-history-empty-state\s*\{[\s\S]*?max-width:\s*100%;/
      );
    });
  });

  describe('5. Preservation of Search & Filter Empty State Differentiation', () => {
    it('leaves search empty state container for search/filter queries intact', () => {
      assert.ok(
        studyViewSrc.includes('className="study-search-empty"'),
        'Must retain study-search-empty for query/filter mismatches'
      );
      assert.ok(
        studyViewSrc.includes('No assessments found matching'),
        'Must preserve search mismatch title'
      );
      assert.ok(
        studyViewSrc.includes('Clear search query'),
        'Must preserve Clear search action'
      );
    });
  });
});
