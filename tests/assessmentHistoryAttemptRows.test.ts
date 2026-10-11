import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND ASSESSMENT HISTORY — ATTEMPT ROWS REDESIGN & COLLAPSIBLE HISTORY', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Clean Horizontal Row Structure (3 Areas)', () => {
    it('structures row into 3 horizontal areas: left, center (metrics), and right', () => {
      assert.ok(studyViewSrc.includes('className="study-record-left"'), 'Must have study-record-left area');
      assert.ok(studyViewSrc.includes('className="study-record-metrics"'), 'Must have center metrics area');
      assert.ok(studyViewSrc.includes('className="study-record-right"'), 'Must have study-record-right area');
    });

    it('LEFT area: renders attempt number label, prominent numerical score, and CORRECT ANSWERS label', () => {
      assert.ok(studyViewSrc.includes('className="study-record-identity"'));
      assert.ok(studyViewSrc.includes('Attempt {attemptNumber}'));
      assert.ok(studyViewSrc.includes('className="study-record-val study-record-val-primary"'));
      assert.ok(studyViewSrc.includes('{pad(attempt.correctAnswers)} / {pad(attempt.totalQuestions)}'));
      assert.ok(studyViewSrc.includes('CORRECT ANSWERS'));
    });

    it('CENTER area: renders completion date on top and concept review count underneath', () => {
      assert.ok(studyViewSrc.includes('className="study-record-val study-record-val-date"'));
      assert.ok(studyViewSrc.includes('{dateInfo.dateStr}'));
      assert.ok(studyViewSrc.includes('COMPLETED'));
      assert.ok(studyViewSrc.includes('className={`study-record-val study-record-val-review'));
      assert.ok(studyViewSrc.includes('TO REVIEW'));
    });

    it('RIGHT area: renders subtle status without red dot and right-aligned View Results action', () => {
      assert.ok(studyViewSrc.includes('className="study-status-expired"'));
      assert.ok(studyViewSrc.includes('Expired'));
      assert.ok(!studyViewSrc.includes('study-status-expired-dot'), 'Red dot must be removed from status');
      assert.ok(studyViewSrc.includes('View results'));
      assert.ok(studyViewSrc.includes('className="study-btn-arrow"'));
    });
  });

  describe('2. Typographic Hierarchy & Elimination of Card Styling', () => {
    it('formats numerical score with prominent 24px monospace font', () => {
      assert.match(
        studyCss,
        /\.study-record-val-primary\s*\{[\s\S]*?font-family:\s*var\(--font-mono,\s*monospace\);/
      );
      assert.match(
        studyCss,
        /\.study-record-val-primary\s*\{[\s\S]*?font-size:\s*24px;/
      );
      assert.match(
        studyCss,
        /\.study-record-val-primary\s*\{[\s\S]*?font-weight:\s*600;/
      );
    });

    it('formats attempt label with muted uppercase monospace styling', () => {
      assert.match(
        studyCss,
        /\.study-record-identity\s*\{[\s\S]*?font-family:\s*var\(--font-mono,\s*monospace\);/
      );
      assert.match(
        studyCss,
        /\.study-record-identity\s*\{[\s\S]*?text-transform:\s*uppercase;/
      );
      assert.match(
        studyCss,
        /\.study-record-identity\s*\{[\s\S]*?color:\s*#777777;/
      );
    });

    it('formats completion date with readable sans-serif medium-weight font', () => {
      assert.match(
        studyCss,
        /\.study-record-val-date\s*\{[\s\S]*?font-family:\s*var\(--font-body,\s*sans-serif\);/
      );
      assert.match(
        studyCss,
        /\.study-record-val-date\s*\{[\s\S]*?font-weight:\s*500;/
      );
      assert.match(
        studyCss,
        /\.study-record-val-date\s*\{[\s\S]*?color:\s*#E5E5E5;/
      );
    });

    it('highlights review count with restrained coral/red (#F87171) when concepts need attention', () => {
      assert.match(
        studyCss,
        /\.study-record-val-review\.study-meta-warm\s*\{[\s\S]*?color:\s*#F87171;/
      );
    });

    it('eliminates card borders and surfaces, using subtle hairline row dividers', () => {
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.05\);/
      );
      assert.match(
        studyCss,
        /\.study-record-item:last-child\s*\{[\s\S]*?border-bottom:\s*none;/
      );
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?background:\s*transparent;/
      );
    });
  });

  describe('3. Spacing, Alignment & Hover Micro-Interactions', () => {
    it('aligns row elements to a consistent 3-column horizontal grid', () => {
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?display:\s*grid;/
      );
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?grid-template-columns:\s*180px\s+1fr\s+auto;/
      );
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?align-items:\s*center;/
      );
    });

    it('applies subtle background tint and 4px arrow shift on row hover', () => {
      assert.match(
        studyCss,
        /\.study-record-item:hover\s*\{[\s\S]*?background-color:\s*rgba\(255,\s*255,\s*255,\s*0\.02\);/
      );
      assert.match(
        studyCss,
        /\.study-record-item:hover \.study-btn-arrow\s*\{[\s\S]*?transform:\s*translateX\(4px\);/
      );
      assert.match(
        studyCss,
        /\.study-record-item\s*\{[\s\S]*?transition:\s*background-color\s*200ms\s*cubic-bezier/
      );
    });
  });

  describe('4. Status Handling', () => {
    it('styles expired status as an understated inline label without badge pill or bullet', () => {
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
      assert.ok(!studyViewSrc.includes('study-status-expired-dot'));
    });
  });

  describe('5. Responsive Reflow (Tablet & Mobile)', () => {
    it('defines 768px tablet layout reorganizing into 2 rows without overlap', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.study-record-item\s*\{[\s\S]*?grid-template-columns:\s*1fr\s+auto;/
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.study-record-metrics\s*\{[\s\S]*?grid-area:\s*center;/
      );
    });

    it('defines 480px mobile layout stacking score, details, and action vertically', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.study-record-item\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.study-record-metrics\s*\{[\s\S]*?flex-direction:\s*column;/
      );
    });
  });

  describe('6. Collapsible Assessment History (Section 9)', () => {
    it('declares isAttemptsExpanded state defaulting to collapsed (3 most recent attempts)', () => {
      assert.ok(
        studyViewSrc.includes('const [isAttemptsExpanded, setIsAttemptsExpanded] = useState(false);'),
        'Must define isAttemptsExpanded state initialized to false'
      );
    });

    it('hides attempts beyond index 2 when collapsed', () => {
      assert.ok(
        studyViewSrc.includes('if (!isAttemptsExpanded && attemptIndex >= 3) {'),
        'Must hide attempts beyond the 3 most recent when collapsed'
      );
      assert.ok(
        studyViewSrc.includes('return null;'),
        'Must return null to omit collapsed attempts from DOM'
      );
    });

    it('renders show more / show fewer control when attempts exceed 3', () => {
      assert.ok(
        studyViewSrc.includes('{group.attempts.length > 3 && ('),
        'Must render expand control only when attempts > 3'
      );
      assert.ok(
        studyViewSrc.includes('className="study-records-expand-btn"'),
        'Must render expand button'
      );
      assert.ok(
        studyViewSrc.includes('setIsAttemptsExpanded(!isAttemptsExpanded)'),
        'Must toggle isAttemptsExpanded on click'
      );
      assert.ok(
        studyViewSrc.includes("'Show fewer'"),
        'Must display Show fewer when expanded'
      );
      assert.ok(
        studyViewSrc.includes('Show all ${group.attempts.length - 3} remaining'),
        'Must include remaining count in label'
      );
    });

    it('renders lime-green directional chevron (↓ and ↑) on expand button', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-records-expand-chevron\""),
        'Must render expand chevron'
      );
      assert.ok(
        studyViewSrc.includes("isAttemptsExpanded ? '↑' : '↓'"),
        'Must toggle arrow direction based on expanded state'
      );
      assert.match(
        studyCss,
        /\.study-records-expand-chevron\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/
      );
    });

    it('resets isAttemptsExpanded to false when switching knowledge graphs', () => {
      assert.ok(
        studyViewSrc.includes('setIsAttemptsExpanded(false);'),
        'Must reset attempt expansion state'
      );
      assert.ok(
        studyViewSrc.includes('prevSelectedGraphId !== effectiveSelectedGraphId'),
        'Must check for graph switch'
      );
    });

    it('resets isAttemptsExpanded when search query or filter mode changes', () => {
      assert.ok(
        studyViewSrc.includes('prevFilterKey !== currentFilterKey'),
        'Must track filter/search key changes'
      );
    });
  });
});
