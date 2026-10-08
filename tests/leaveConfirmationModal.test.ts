import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatRemainingTime } from '../src/components/test/LeaveConfirmationModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GRAPHMIND — EXIT TEST CONFIRMATION REDESIGN ARCHITECTURE', () => {
  const cssPath = resolve(__dirname, '../src/styles/test.css');
  const cssContent = readFileSync(cssPath, 'utf8');

  const tsxPath = resolve(__dirname, '../src/components/test/LeaveConfirmationModal.tsx');
  const tsxContent = readFileSync(tsxPath, 'utf8');

  const workspacePath = resolve(__dirname, '../src/components/test/TestWorkspace.tsx');
  const workspaceContent = readFileSync(workspacePath, 'utf8');

  describe('1. Overall Direction & Surface Palette (Section 1)', () => {
    it('uses quiet dark #111111 surface with 1px rgba(255,255,255,0.10) border', () => {
      assert.ok(
        cssContent.includes('.leave-modal-card') &&
        cssContent.includes('background: #111111;') &&
        cssContent.includes('border: 1px solid rgba(255, 255, 255, 0.10);'),
        'Modal must use #111111 surface and subtle 0.10 border'
      );
    });

    it('uses primary text #F5F5F5 and secondary text #8A8A8A', () => {
      assert.ok(
        cssContent.includes('.leave-modal-title') &&
        cssContent.includes('color: #F5F5F5;'),
        'Title must use #F5F5F5'
      );
      assert.ok(
        cssContent.includes('.leave-modal-body') &&
        cssContent.includes('color: #8A8A8A;'),
        'Body must use #8A8A8A'
      );
    });

    it('features GraphMind green #B8FF3D and restricts red accent to subtle exit hover (#E06A6A)', () => {
      assert.ok(
        cssContent.includes('.leave-status-dot') &&
        cssContent.includes('color: #B8FF3D;'),
        'Status marker dot must be GraphMind green #B8FF3D'
      );
      assert.ok(
        cssContent.includes('.leave-action-exit-btn:hover') &&
        cssContent.includes('color: #E06A6A;'),
        'Exit button hover must be muted red #E06A6A'
      );
      assert.ok(
        !cssContent.includes('background: #FF0000') &&
        !cssContent.includes('background: #E06A6A') &&
        !cssContent.includes('background: red'),
        'Must never have red background or red banner'
      );
    });
  });

  describe('2. Modal Size & Backdrop Restraint (Section 2 & 3)', () => {
    it('sizes modal compactly (max-width: 440px, within 420–460px range) with 32px padding', () => {
      assert.ok(
        cssContent.includes('.leave-modal-card') &&
        cssContent.includes('max-width: 440px;') &&
        cssContent.includes('padding: 32px;'),
        'Modal card must be 440px max-width with 32px padding'
      );
    });

    it('uses restrained backdrop (rgba(0,0,0,0.68)) with 6px blur so test remains recognizable', () => {
      assert.ok(
        cssContent.includes('.leave-modal-backdrop') &&
        cssContent.includes('background: rgba(0, 0, 0, 0.68);') &&
        cssContent.includes('backdrop-filter: blur(6px);'),
        'Backdrop must use 0.68 opacity and 6px blur'
      );
    });
  });

  describe('3. Top Status Marker (Section 4)', () => {
    it('renders ● EXITING TEST with green dot and tracked uppercase 11px font', () => {
      assert.ok(
        tsxContent.includes('leave-status-dot') &&
        tsxContent.includes('EXITING TEST'),
        'Modal must feature ● EXITING TEST'
      );
      assert.ok(
        cssContent.includes('.leave-status-text') &&
        cssContent.includes('font-size: 11px;') &&
        cssContent.includes('letter-spacing: 0.16em;') &&
        cssContent.includes('text-transform: uppercase;') &&
        cssContent.includes('color: #8A8A8A;'),
        'Status text must be 11px uppercase with 0.16em tracking and #8A8A8A'
      );
    });
  });

  describe('4. Main Title & Body Copy (Section 5 & 6)', () => {
    it('sets title "Leave this test?" with 28px font, -0.03em letter-spacing, line-height 1.1', () => {
      assert.ok(
        tsxContent.includes('Leave this test?'),
        'Title must be Leave this test?'
      );
      assert.ok(
        cssContent.includes('.leave-modal-title') &&
        cssContent.includes('font-size: 28px;') &&
        cssContent.includes('letter-spacing: -0.03em;') &&
        cssContent.includes('line-height: 1.1;'),
        'Title styling must match 28px, -0.03em, 1.1'
      );
    });

    it('sets human body copy with max-width 340px, 14px size, and 1.6 line-height', () => {
      assert.ok(
        tsxContent.includes('Your current progress and remaining time will be lost.') &&
        tsxContent.includes('You can start a new assessment when you return.'),
        'Body copy must explain progress and remaining time loss clearly'
      );
      assert.ok(
        cssContent.includes('.leave-modal-body') &&
        cssContent.includes('font-size: 14px;') &&
        cssContent.includes('line-height: 1.6;') &&
        cssContent.includes('max-width: 340px;'),
        'Body typography must match 14px, 1.6, max-width 340px'
      );
    });
  });

  describe('5. Real Test Context Line & Dynamic Formatting (Section 7)', () => {
    it('correctly formats remaining seconds into MM:SS string', () => {
      assert.equal(formatRemainingTime(588), '09:48');
      assert.equal(formatRemainingTime(600), '10:00');
      assert.equal(formatRemainingTime(65), '01:05');
      assert.equal(formatRemainingTime(0), '00:00');
    });

    it('renders real test state line: TEST 01 · 7 / 10 ANSWERED · 09:48 REMAINING', () => {
      assert.ok(
        tsxContent.includes('{testLabel}') &&
        tsxContent.includes('{answeredCount} / {totalCount} ANSWERED') &&
        tsxContent.includes('{formattedTime} REMAINING'),
        'Modal must dynamically interpolate real test state'
      );
      assert.ok(
        cssContent.includes('.leave-modal-context-line') &&
        cssContent.includes('font-size: 10.5px;') &&
        cssContent.includes('letter-spacing: 0.12em;') &&
        cssContent.includes('color: #5F5F5F;'),
        'Context line must be 10.5px with 0.12em tracking and #5F5F5F'
      );
    });

    it('wires real test state from TestWorkspace into LeaveConfirmationModal', () => {
      assert.ok(
        workspaceContent.includes('<LeaveConfirmationModal') &&
        workspaceContent.includes('answeredCount={Object.keys(answers).length}') &&
        workspaceContent.includes('totalCount={test?.questions.length || 0}') &&
        workspaceContent.includes('remainingSeconds={remainingSeconds}') &&
        workspaceContent.includes('testLabel="TEST 01"'),
        'TestWorkspace must pass live test state to LeaveConfirmationModal'
      );
    });
  });

  describe('6. Button Hierarchy & Space-Between Arrangement (Section 8 & 9)', () => {
    it('makes CONTINUE TEST → the visually dominant safe action with subtle green border', () => {
      assert.ok(
        tsxContent.includes('CONTINUE TEST') &&
        tsxContent.includes('leave-continue-arrow'),
        'Safe action must be CONTINUE TEST with directional arrow'
      );
      assert.ok(
        cssContent.includes('.leave-action-continue-btn') &&
        cssContent.includes('border: 1px solid rgba(184, 255, 61, 0.35);') &&
        cssContent.includes('color: #F5F5F5;'),
        'Continue button must have subtle green border and white text'
      );
      assert.ok(
        cssContent.includes('.leave-action-continue-btn:hover') &&
        cssContent.includes('color: #B8FF3D;') &&
        cssContent.includes('transform: translateX(3px);'),
        'Hover state must shift text to green and shift arrow 3px right'
      );
    });

    it('makes EXIT TEST a quiet secondary text action without red background', () => {
      assert.ok(
        tsxContent.includes('leave-action-exit-btn') &&
        tsxContent.includes('EXIT TEST'),
        'Destructive action must be EXIT TEST'
      );
      assert.ok(
        cssContent.includes('.leave-action-exit-btn') &&
        cssContent.includes('color: #777777;') &&
        cssContent.includes('background: transparent;'),
        'Exit button must default to quiet #777777 with transparent background'
      );
    });

    it('arranges buttons with space-between separation across full width', () => {
      assert.ok(
        cssContent.includes('.leave-modal-actions') &&
        cssContent.includes('justify-content: space-between;') &&
        cssContent.includes('width: 100%;'),
        'Buttons must be arranged with space-between layout'
      );
    });
  });

  describe('7. Interruption Animation, Staggered Reveal & Keyboard Accessibility (Section 10–13)', () => {
    it('structures content in 3 staggered reveal groups', () => {
      assert.ok(
        tsxContent.includes('leave-modal-group-status') &&
        tsxContent.includes('leave-modal-group-content') &&
        tsxContent.includes('leave-modal-group-footer'),
        'Content must be partitioned into 3 intentional animation groups'
      );
    });

    it('implements Escape key closure and Tab focus trap between continue and exit buttons', () => {
      assert.ok(
        tsxContent.includes("e.key === 'Escape'") &&
        tsxContent.includes("e.key === 'Tab'") &&
        tsxContent.includes('continueBtnRef.current?.focus()'),
        'Must support Escape to cancel, auto-focus on continue, and Tab focus trap'
      );
    });

    it('uses restrained translateY(12px) → 0 and scale(0.985) entrance animation', () => {
      assert.ok(
        tsxContent.includes('scale: 0.985') &&
        tsxContent.includes('y: 12') &&
        tsxContent.includes('[0.16, 1, 0.3, 1]'),
        'Entrance animation must use 0.985 scale, 12px y offset, and smooth cubic bezier'
      );
    });
  });
});
