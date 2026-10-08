import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GRAPHMIND — FINAL POLISH FOR SUBMIT TEST ACTION', () => {
  const cssPath = resolve(__dirname, '../src/styles/test.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  const tsxPath = resolve(__dirname, '../src/components/test/TestQuestionView.tsx');
  const tsxContent = readFileSync(tsxPath, 'utf8');

  describe('1. Remove Generic Button Look (Section 1, 2, 12)', () => {
    it('eliminates boxed green outline and large rounded rectangle on Submit Test', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial {') &&
        cssContent.includes('background: transparent;') &&
        cssContent.includes('border: none;'),
        'Submit Test must be a boundaryless editorial text action with border: none and background: transparent'
      );
      assert.ok(
        !cssContent.includes('.btn-submit-editorial { border: 1px solid') &&
        !cssContent.includes('.btn-submit-editorial { background: #A3FF12'),
        'Must not use filled rectangle or boxed border'
      );
    });

    it('uses clean editorial typography: 12–13px, font-weight 550, letter-spacing 0.10em, uppercase', () => {
      assert.ok(
        cssContent.includes('.test-submit-text {') &&
        cssContent.includes('font-size: 12.5px;') &&
        cssContent.includes('font-weight: 550;') &&
        cssContent.includes('letter-spacing: 0.10em;') &&
        cssContent.includes('text-transform: uppercase;') &&
        cssContent.includes('color: #F5F5F5;'),
        'Typography must be 12.5px uppercase, 550 weight, 0.10em tracking'
      );
    });
  });

  describe('2. Custom Editorial Underline (Section 1, 4)', () => {
    it('renders custom underline element in markup with track and fill', () => {
      assert.ok(
        tsxContent.includes('test-submit-underline-track') &&
        tsxContent.includes('test-submit-underline-fill'),
        'Markup must include test-submit-underline-track and test-submit-underline-fill'
      );
    });

    it('defaults to 46–60px (52px) width with rgba(255,255,255,0.25) and 1px height', () => {
      assert.ok(
        cssContent.includes('.test-submit-underline-fill {') &&
        cssContent.includes('width: 52px;') &&
        cssContent.includes('height: 1px;') &&
        cssContent.includes('background-color: rgba(255, 255, 255, 0.25);'),
        'Underline fill must default to 52px width, 1px height, rgba(255,255,255,0.25)'
      );
    });

    it('expands to 100% width and turns GraphMind green (#B8FF3D) on hover with ease-out', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial:hover:not(:disabled) .test-submit-underline-fill {') &&
        cssContent.includes('width: 100%;') &&
        cssContent.includes('background-color: #B8FF3D;'),
        'Hover state must expand underline to 100% and #B8FF3D'
      );
      assert.ok(
        cssContent.includes('transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1)'),
        'Underline expansion must use 260ms ease-out transition'
      );
    });
  });

  describe('3. Restrained Hover Micro-Interaction (Section 5)', () => {
    it('shifts text ~2px right and shifts arrow ~5px right on hover', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial:hover:not(:disabled) .test-submit-text {') &&
        cssContent.includes('transform: translateX(2px);') &&
        cssContent.includes('color: #B8FF3D;'),
        'Hover must shift text 2px and shift color toward #B8FF3D'
      );
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial:hover:not(:disabled) .test-submit-arrow {') &&
        cssContent.includes('transform: translateX(5px);') &&
        cssContent.includes('color: #B8FF3D;'),
        'Hover must shift arrow 5px and shift color toward #B8FF3D'
      );
    });

    it('does NOT scale the button, add background fill, or add glow', () => {
      assert.ok(
        !cssContent.includes('.btn-submit-editorial:hover { transform: scale') &&
        !cssContent.includes('.btn-submit-editorial:hover { box-shadow: 0 0') &&
        !cssContent.includes('.btn-submit-editorial:hover { filter: drop-shadow'),
        'Must not scale button or add glow'
      );
    });
  });

  describe('4. Previous Button Restraint & Visual Hierarchy (Section 2, 7)', () => {
    it('renders ← PREVIOUS as quiet, unbordered action (12px, #666666)', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-prev {') &&
        cssContent.includes('font-size: 12px;') &&
        cssContent.includes('color: #666666;') &&
        cssContent.includes('border: none;'),
        'Previous button must be borderless 12px #666666'
      );
    });

    it('transitions to #A1A1A1 and shifts arrow 3px left on hover', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-prev:hover:not(:disabled) {') &&
        cssContent.includes('color: #A1A1A1;'),
        'Previous hover must turn color to #A1A1A1'
      );
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-prev:hover:not(:disabled) .test-prev-arrow {') &&
        cssContent.includes('transform: translateX(-3px);'),
        'Previous hover must shift arrow 3px left'
      );
    });
  });

  describe('5. Positioning & Generous Vertical Spacing (Section 8)', () => {
    it('sets 48–60px spacing above action row with subtle 1px divider and 26px padding', () => {
      assert.ok(
        cssContent.includes('.test-question-bottom-nav {') &&
        cssContent.includes('margin-top: clamp(48px, 5.2vw, 60px);') &&
        cssContent.includes('padding-top: 26px;') &&
        cssContent.includes('border-top: 1px solid rgba(255, 255, 255, 0.07);'),
        'Bottom nav must maintain 48–60px top margin, 1px divider, and 26px padding'
      );
    });

    it('arranges actions full-width with Previous on left and Submit on right', () => {
      assert.ok(
        cssContent.includes('.test-question-bottom-nav {') &&
        cssContent.includes('justify-content: space-between;') &&
        cssContent.includes('width: 100%;'),
        'Actions must span full width with space-between layout'
      );
    });
  });

  describe('6. Tooltip Removal & Accessibility (Section 10, 11)', () => {
    it('removes native title="Submit test" tooltip from Submit Test button', () => {
      assert.ok(
        !tsxContent.includes('title="Submit test"'),
        'Submit Test button must NOT have native title="Submit test" tooltip'
      );
      assert.ok(
        !tsxContent.includes('title="Previous question (ArrowLeft)"'),
        'Previous button must NOT have native title tooltip'
      );
    });

    it('maintains accessible aria-label on Submit and Previous buttons', () => {
      assert.ok(
        tsxContent.includes('aria-label="Submit test"'),
        'Submit button must provide aria-label="Submit test"'
      );
      assert.ok(
        tsxContent.includes('aria-label="Previous question"'),
        'Previous button must provide aria-label="Previous question"'
      );
    });

    it('implements subtle green focus indicators (focus-visible) instead of heavy browser outline', () => {
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial:focus-visible {') &&
        cssContent.includes('outline: 1px solid rgba(184, 255, 61, 0.5);'),
        'Submit button focus-visible must use subtle green outline'
      );
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-prev:focus-visible {') &&
        cssContent.includes('outline: 1px solid rgba(184, 255, 61, 0.4);'),
        'Previous button focus-visible must use subtle green outline'
      );
    });
  });

  describe('7. Submit Click Active State (Section 9)', () => {
    it('briefly enters tactical active state with shifted arrow before triggering confirmation modal', () => {
      assert.ok(
        tsxContent.includes('isSubmittingAction') &&
        tsxContent.includes('handleSubmitClick') &&
        tsxContent.includes('is-active-submit'),
        'Must support isSubmittingAction state and is-active-submit class'
      );
      assert.ok(
        cssContent.includes('.test-nav-editorial-btn.btn-submit-editorial.is-active-submit .test-submit-arrow {') &&
        cssContent.includes('transform: translateX(8px);'),
        'Active submit feedback must slide arrow forward'
      );
    });
  });
});
