import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Assessment TIME\'S UP Screen — Editorial Redesign Architecture', () => {
  const timeUpPath = path.join(process.cwd(), 'src/components/test/TimeUpScreen.tsx');
  const testWorkspacePath = path.join(process.cwd(), 'src/components/test/TestWorkspace.tsx');
  const testCssPath = path.join(process.cwd(), 'src/styles/test.css');

  const timeUpContent = fs.readFileSync(timeUpPath, 'utf-8');
  const testWorkspaceContent = fs.readFileSync(testWorkspacePath, 'utf-8');
  const testCssContent = fs.readFileSync(testCssPath, 'utf-8');

  describe('1. Composition & Visual Hierarchy (Section 1)', () => {
    it('structures content in strict editorial sequence: STATUS -> HEADLINE -> MESSAGE -> CONTEXT -> VIEW RESULTS', () => {
      const statusIdx = timeUpContent.indexOf('test-timeup-status');
      const headlineIdx = timeUpContent.indexOf('test-timeup-title');
      const messageIdx = timeUpContent.indexOf('test-timeup-message');
      const contextIdx = timeUpContent.indexOf('test-timeup-context-row');
      const actionIdx = timeUpContent.indexOf('test-timeup-action-btn');

      assert.ok(statusIdx !== -1, 'Must include status element');
      assert.ok(headlineIdx !== -1, 'Must include headline element');
      assert.ok(messageIdx !== -1, 'Must include message element');
      assert.ok(contextIdx !== -1, 'Must include context row element');
      assert.ok(actionIdx !== -1, 'Must include action button element');

      assert.ok(statusIdx < headlineIdx, 'Status must precede headline');
      assert.ok(headlineIdx < messageIdx, 'Headline must precede message');
      assert.ok(messageIdx < contextIdx, 'Message must precede context');
      assert.ok(contextIdx < actionIdx, 'Context must precede action');
    });

    it('renders A. STATUS: "ASSESSMENT / TIME EXPIRED" with lime-green marker dot', () => {
      assert.ok(
        timeUpContent.includes('ASSESSMENT / TIME EXPIRED'),
        'Status label must be ASSESSMENT / TIME EXPIRED'
      );
      assert.ok(
        timeUpContent.includes('test-timeup-status-dot'),
        'Must render status dot'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-status-dot') &&
        testCssContent.includes('color: var(--accent, #B8FF3D);'),
        'Status dot must use GraphMind lime-green #B8FF3D accent'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-status-text') &&
        testCssContent.includes('font-size: 11px;') &&
        testCssContent.includes('letter-spacing: 0.16em;') &&
        testCssContent.includes('text-transform: uppercase;'),
        'Status text must be 11px uppercase with tracked letter spacing'
      );
    });

    it('renders B. MAIN HEADING: "TIME\'S \\n UP." on two lines with selective lime-green period', () => {
      assert.ok(
        timeUpContent.includes("TIME'S") &&
        timeUpContent.includes('UP') &&
        timeUpContent.includes('test-timeup-period'),
        'Heading must contain TIME\'S, UP, and test-timeup-period'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-title') &&
        testCssContent.includes('clamp(64px, 8vw, 112px)') &&
        testCssContent.includes('line-height: 0.88;') &&
        testCssContent.includes('letter-spacing: -0.05em;') &&
        testCssContent.includes('color: #F5F5F5;'),
        'Heading typography must use clamp(64px, 8vw, 112px), tight line-height 0.88, negative tracking, and off-white color'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-period') &&
        testCssContent.includes('color: var(--accent, #B8FF3D);'),
        'Period must selectively use lime green accent #B8FF3D'
      );
    });

    it('renders C. SUPPORTING MESSAGE: exact human text constrained to ~420px', () => {
      assert.ok(
        timeUpContent.includes('Your assessment has been submitted.') &&
        timeUpContent.includes('Your recorded answers are ready to review.'),
        'Message must provide clear, reassuring assessment submission status'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-message') &&
        testCssContent.includes('font-size: 15.5px;') &&
        testCssContent.includes('line-height: 1.6;') &&
        testCssContent.includes('color: #929292;') &&
        testCssContent.includes('max-width: 420px;'),
        'Message must use 15–16px typography, comfortable 1.6 line height, and max-width 420px'
      );
    });

    it('renders D. ASSESSMENT CONTEXT: quiet metadata row using live assessment state', () => {
      assert.ok(
        timeUpContent.includes('{assessmentName}') &&
        timeUpContent.includes('{totalQuestions} QUESTIONS') &&
        timeUpContent.includes('{answeredCount} RECORDED'),
        'Context row must dynamically display assessment name, questions count, and recorded answers'
      );
      assert.ok(
        testWorkspaceContent.includes('<TimeUpScreen') &&
        testWorkspaceContent.includes('assessmentName={test?.title || graph?.name || \'ASSESSMENT\'}') &&
        testWorkspaceContent.includes('totalQuestions={test?.questions.length || 0}') &&
        testWorkspaceContent.includes('answeredCount={Object.keys(answers).length}'),
        'TestWorkspace must wire real assessment state to TimeUpScreen props'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-context-row') &&
        testCssContent.includes('font-size: 11px;') &&
        testCssContent.includes('letter-spacing: 0.12em;') &&
        testCssContent.includes('color: #6E6E6E;'),
        'Context row must use 11px uppercase muted styling'
      );
    });

    it('renders E. PRIMARY ACTION: VIEW RESULTS → with signature underline reveal and hover arrow shift', () => {
      assert.ok(
        timeUpContent.includes('VIEW RESULTS') &&
        timeUpContent.includes('test-timeup-action-arrow') &&
        timeUpContent.includes('test-timeup-action-underline'),
        'Action button must render VIEW RESULTS with arrow and underline element'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-action-btn') &&
        testCssContent.includes('background: transparent;') &&
        testCssContent.includes('border: none;') &&
        testCssContent.includes('font-size: 12px;') &&
        testCssContent.includes('font-weight: 600;') &&
        testCssContent.includes('letter-spacing: 0.08em;') &&
        testCssContent.includes('color: #F5F5F5;'),
        'Action button must be an unbordered editorial text button'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-action-arrow') &&
        testCssContent.includes('color: #B8FF3D;'),
        'Action arrow must be GraphMind lime green'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-action-underline') &&
        testCssContent.includes('height: 1px;') &&
        testCssContent.includes('background: #B8FF3D;') &&
        testCssContent.includes('transform: scaleX(0);') &&
        testCssContent.includes('transform-origin: left;'),
        'Underline must be 1px #B8FF3D, collapsed with scaleX(0) and transform-origin: left'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-action-btn:hover .test-timeup-action-underline') &&
        testCssContent.includes('transform: scaleX(1);'),
        'Underline must reveal from left to right on hover'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-action-btn:hover .test-timeup-action-arrow') &&
        testCssContent.includes('transform: translateX(3px);'),
        'Arrow must translate 3px right on hover'
      );
    });
  });

  describe('2. Restrained Visual Detail (Section 2)', () => {
    it('features a subtle oversized background numeral (00:00) with ultra-low contrast behind content', () => {
      assert.ok(
        timeUpContent.includes('test-timeup-bg-numeral') &&
        timeUpContent.includes('00:00'),
        'Must render 00:00 background numeral watermark'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-bg-numeral') &&
        testCssContent.includes('color: rgba(255, 255, 255, 0.022);') &&
        testCssContent.includes('pointer-events: none;') &&
        testCssContent.includes('z-index: 0;'),
        'Numeral must sit behind content at 0.022 low contrast with pointer-events none'
      );
    });
  });

  describe('3. Entrance Animation & Accessibility (Section 3)', () => {
    it('implements Framer Motion staggered entrance with restrained vertical movement', () => {
      assert.ok(
        timeUpContent.includes('staggerChildren: 0.08') &&
        timeUpContent.includes('delayChildren: 0.06'),
        'Must coordinate staggered entrance across elements'
      );
      assert.ok(
        timeUpContent.includes('[0.16, 1, 0.3, 1]'),
        'Must use GraphMind standard editorial cubic bezier curve'
      );
    });

    it('supports prefers-reduced-motion in both Framer Motion and CSS', () => {
      assert.ok(
        timeUpContent.includes('useReducedMotion') &&
        timeUpContent.includes('shouldReduceMotion'),
        'TimeUpScreen must query useReducedMotion'
      );
      assert.ok(
        testCssContent.includes('.test-timeup-stage') &&
        testCssContent.includes('.test-timeup-action-btn') &&
        testCssContent.includes('.test-timeup-action-arrow') &&
        testCssContent.includes('.test-timeup-action-underline') &&
        testCssContent.includes('@media (prefers-reduced-motion: reduce)'),
        'CSS must include timeup elements in prefers-reduced-motion media query'
      );
    });
  });

  describe('4. Navigation & State Continuity (Section 4)', () => {
    it('wires onViewResults to setMode(\'results\') in TestWorkspace preserving all answers and scores', () => {
      assert.ok(
        testWorkspaceContent.includes('onViewResults={() => setMode(\'results\')}'),
        'Must transition to results mode on click'
      );
      assert.ok(
        testWorkspaceContent.includes('const summary = recordKnowledgeTestCompletion(test, answers, timeSpent)'),
        'Must compute and save resultsSummary upon time expiration before rendering timeup'
      );
    });
  });

  describe('5. Responsive Breakpoints (Section 5)', () => {
    it('defines responsive rules for tablet (<=768px) and mobile (<=480px)', () => {
      assert.ok(
        testCssContent.includes('@media (max-width: 768px)') &&
        testCssContent.includes('.test-timeup-title') &&
        testCssContent.includes('clamp(52px, 11vw, 76px)'),
        'Must scale heading responsibly for tablet viewports'
      );
      assert.ok(
        testCssContent.includes('@media (max-width: 480px)') &&
        testCssContent.includes('.test-timeup-title') &&
        testCssContent.includes('clamp(48px, 13vw, 62px)'),
        'Must scale heading responsibly for mobile viewports'
      );
    });
  });
});
