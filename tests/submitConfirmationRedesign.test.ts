import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GRAPHMIND — SUBMIT TEST CONFIRMATION REDESIGN ARCHITECTURE', () => {
  const cssPath = resolve(__dirname, '../src/styles/test.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  const tsxPath = resolve(__dirname, '../src/components/test/SubmitConfirmationModal.tsx');
  const tsxContent = readFileSync(tsxPath, 'utf8');

  describe('1. Composition & Editorial Identity (Section 1, 2, 8, 19)', () => {
    it('eliminates generic CONFIRMATION language in favor of ASSESSMENT COMPLETE', () => {
      assert.ok(
        tsxContent.includes('ASSESSMENT COMPLETE'),
        'Modal must feature ASSESSMENT COMPLETE eyebrow'
      );
      assert.ok(
        !tsxContent.includes('test-modal-kicker">CONFIRMATION<') &&
        !tsxContent.includes('SUBMIT TEST?</h2>'),
        'Modal must remove generic CONFIRMATION and SUBMIT TEST? question title'
      );
    });

    it('renders editorial eyebrow with GraphMind green marker', () => {
      assert.ok(
        tsxContent.includes('submit-modal-eyebrow') &&
        tsxContent.includes('submit-eyebrow-marker'),
        'Modal must include submit-modal-eyebrow with submit-eyebrow-marker'
      );
      assert.ok(
        cssContent.includes('.submit-modal-eyebrow {') &&
        cssContent.includes('color: var(--accent, #A3FF12);') &&
        cssContent.includes('letter-spacing: 0.18em;'),
        'Eyebrow must use GraphMind green with tracking'
      );
    });

    it('uses quiet dark #111111 surface with 12px radius and subtle 0.08 border', () => {
      assert.ok(
        cssContent.includes('.submit-assessment-card {') &&
        cssContent.includes('background: #111111;') &&
        cssContent.includes('border: 1px solid rgba(255, 255, 255, 0.08);') &&
        cssContent.includes('border-radius: 12px;'),
        'Modal surface must be #111111 with 12px radius and 0.08 subtle border'
      );
    });
  });

  describe('2. Headline & Supporting Copy (Section 1, 3)', () => {
    it('features prominent headline READY TO SEE HOW YOU DID?', () => {
      assert.ok(
        tsxContent.includes('READY TO SEE') &&
        tsxContent.includes('HOW YOU DID?'),
        'Headline must ask READY TO SEE HOW YOU DID?'
      );
      assert.ok(
        cssContent.includes('.submit-modal-heading {') &&
        cssContent.includes('font-size: 34px;') &&
        cssContent.includes('line-height: 1.15;'),
        'Headline must use 34px desktop font with tight line height'
      );
    });

    it('restrains supporting text width to ~420px with muted gray color', () => {
      assert.ok(
        cssContent.includes('.submit-modal-supporting {') &&
        cssContent.includes('max-width: 420px;') &&
        cssContent.includes('color: var(--text-secondary, #A1A1A1);'),
        'Supporting text must be restrained to max-width 420px'
      );
      assert.ok(
        tsxContent.includes('Your result will be calculated from your answers'),
        'Supporting copy must explain calculation from student answers'
      );
    });
  });

  describe('3. Segmented Completion Ring & Status Row (Section 4, 5, 12)', () => {
    it('implements segmented completion ring SVG with mathematical arcs for each question', () => {
      assert.ok(
        tsxContent.includes('SegmentedCompletionRing') &&
        tsxContent.includes('submit-ring-svg'),
        'Must render mathematical SegmentedCompletionRing SVG'
      );
      assert.ok(
        tsxContent.includes('slotAngle = 360 / safeTotal') &&
        tsxContent.includes('gapAngle = Math.min(7, Math.max(4, 40 / safeTotal))'),
        'Must calculate segment geometry with proportional slot and gap angles'
      );
    });

    it('staggers segment drawing with 50–70ms sequence', () => {
      assert.ok(
        tsxContent.includes('0.055'),
        'Must use ~55ms stagger delay for sequential segment assembly'
      );
    });

    it('formats completion count as tabular information (e.g. 10 / 10 ANSWERED)', () => {
      assert.ok(
        tsxContent.includes('submit-completion-fraction') &&
        tsxContent.includes('submit-completion-label'),
        'Must render fraction and label in completion block'
      );
      assert.ok(
        cssContent.includes('.submit-completion-fraction {') &&
        cssContent.includes('font-variant-numeric: tabular-nums;'),
        'Fraction numerals must use monospace tabular alignment'
      );
    });

    it('expands completion ring during submission transition to bridge into results screen', () => {
      assert.ok(
        tsxContent.includes('isSubmitting') &&
        tsxContent.includes('scale: [1, 2.5]'),
        'Completion ring must expand (scale 1 -> 2.5) during submission to bridge into results'
      );
    });
  });

  describe('4. Backdrop & Surface Restraint (Section 7)', () => {
    it('restrains backdrop blur to 6px without aggressive frosted glass', () => {
      assert.ok(
        cssContent.includes('.submit-assessment-backdrop {') &&
        cssContent.includes('background: rgba(0, 0, 0, 0.72);') &&
        cssContent.includes('backdrop-filter: blur(6px);'),
        'Backdrop must use rgba(0,0,0,0.72) and blur(6px)'
      );
    });
  });

  describe('5. Submit Button Interaction & Calculating Transition (Section 9, 10, 11)', () => {
    it('styles SUBMIT TEST as boundaryless minimal text-forward action (border: none)', () => {
      assert.ok(
        cssContent.includes('.submit-action-confirm-btn {') &&
        cssContent.includes('border: none;') &&
        cssContent.includes('color: var(--accent, #A3FF12);'),
        'Submit button must be minimal and boundaryless with accent text'
      );
    });

    it('moves arrow 5px to right and draws underline on hover', () => {
      assert.ok(
        cssContent.includes('.submit-action-confirm-btn:hover .confirm-btn-arrow') &&
        cssContent.includes('transform: translateX(5px);'),
        'Hover must move arrow 5px to the right'
      );
      assert.ok(
        cssContent.includes('.confirm-btn-underline {') &&
        cssContent.includes('scaleX(0)') &&
        cssContent.includes('.submit-action-confirm-btn:hover .confirm-btn-underline') &&
        cssContent.includes('scaleX(1)'),
        'Hover must draw bottom underline from left to right'
      );
    });

    it('implements 600–800ms transition with CALCULATING state and sweep line', () => {
      assert.ok(
        tsxContent.includes("isSubmitting ? 'CALCULATING' : 'SUBMIT TEST'"),
        'Button label must change to CALCULATING during submission'
      );
      assert.ok(
        tsxContent.includes('confirm-btn-sweep-line'),
        'Must render green sweep line across button during calculation'
      );
      assert.ok(
        tsxContent.includes('650'),
        'Transition duration must be approximately 650ms (within 600–800ms window)'
      );
    });
  });

  describe('6. Secondary Actions & Cancellation (Section 13, 14, 15, 17)', () => {
    it('styles GO BACK with muted text and sliding left arrow on hover', () => {
      assert.ok(
        cssContent.includes('.submit-action-back-btn {') &&
        cssContent.includes('color: var(--text-muted, #8A8A8A);'),
        'GO BACK must have muted text'
      );
      assert.ok(
        cssContent.includes('.submit-action-back-btn:hover .back-arrow') &&
        cssContent.includes('opacity: 1;') &&
        cssContent.includes('transform: translateX(0);'),
        'Left arrow must slide in on hover of GO BACK'
      );
    });

    it('disables cancellation while calculation transition is executing', () => {
      assert.ok(
        tsxContent.includes('if (isSubmitting) return;'),
        'Must block cancellation while isSubmitting is true'
      );
    });

    it('supports Escape key to cancel and Enter key to submit', () => {
      assert.ok(
        tsxContent.includes("e.key === 'Escape'") &&
        tsxContent.includes("e.key === 'Enter'"),
        'Must support Escape and Enter keyboard shortcuts'
      );
    });
  });
});
