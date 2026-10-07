import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('Editorial Learning Actions Polish (Test Yourself & Review This Concept)', () => {
  const panelPath = path.resolve(process.cwd(), 'src/components/graph/NodeContextPanel.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/styles/graph.css');

  const panelContent = fs.readFileSync(panelPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  test('Panel provides dedicated editorial action area with divider and no card container', () => {
    // Must contain .concept-panel-actions-area and divider
    assert.ok(
      panelContent.includes('concept-panel-actions-area'),
      'NodeContextPanel must have .concept-panel-actions-area'
    );
    assert.ok(
      panelContent.includes('concept-panel-actions-divider'),
      'NodeContextPanel must have .concept-panel-actions-divider'
    );
    // Does not use obsolete .study-practice-cta-section
    assert.ok(
      !panelContent.includes('study-practice-cta-section'),
      'NodeContextPanel should replace study-practice-cta-section with concept-panel-actions-area'
    );
  });

  test('Action hierarchy: Primary is TEST YOURSELF (or REVIEW AGAIN), Secondary is REVIEW THIS CONCEPT', () => {
    // Primary action
    assert.ok(
      panelContent.includes("'REVIEW AGAIN' : 'TEST YOURSELF'"),
      'Primary action must display TEST YOURSELF (or REVIEW AGAIN when needs-review)'
    );
    assert.ok(
      panelContent.includes('action-primary'),
      'Primary action must use .action-primary class'
    );
    assert.ok(
      panelContent.includes('action-primary-indicator'),
      'Primary action must include the small green indicator accent'
    );

    // Secondary action renamed to REVIEW THIS CONCEPT
    assert.ok(
      panelContent.includes('REVIEW THIS CONCEPT'),
      'Secondary action must be labeled "REVIEW THIS CONCEPT" (not generic "REVISION")'
    );
    assert.ok(
      panelContent.includes('action-secondary'),
      'Secondary action must use .action-secondary class'
    );
  });

  test('Both actions use real accessible button elements with directional arrow (↗) and title/aria-label', () => {
    // Both actions use motion.button with type="button"
    assert.ok(
      panelContent.includes('aria-label="Review this concept in revision mode"'),
      'Secondary button must provide accessible aria-label'
    );
    assert.ok(
      panelContent.includes('ArrowUpRight'),
      'Both actions must use ArrowUpRight (↗) icon'
    );
  });

  test('Styling removes generic green box button and uses editorial row styling', () => {
    // Ensure the old bright green button style .study-revise-cta-btn is removed
    assert.ok(
      !cssContent.includes('.study-revise-cta-btn {'),
      'The generic bright green .study-revise-cta-btn must be removed from graph.css'
    );

    // Action rows are transparent background with editorial typography
    assert.ok(
      cssContent.includes('.editorial-action-row {'),
      'graph.css must define .editorial-action-row'
    );
    assert.ok(
      cssContent.includes('background: transparent;'),
      '.editorial-action-row must have a transparent background'
    );

    // Primary styling: ~12.5px font size, 600 weight, primary text
    assert.ok(
      cssContent.includes('.editorial-action-row.action-primary .action-row-title'),
      'Must define primary action title styling'
    );
    assert.ok(
      cssContent.includes('font-size: 12.5px;'),
      'Primary title font size must be ~12.5px'
    );

    // Secondary styling: ~12px font size, 500 weight, secondary text
    assert.ok(
      cssContent.includes('.editorial-action-row.action-secondary .action-row-title'),
      'Must define secondary action title styling'
    );
    assert.ok(
      cssContent.includes('font-size: 12px;'),
      'Secondary title font size must be ~12px'
    );
  });

  test('Micro-interactions: Underline draw animation on hover and directional arrow shift', () => {
    // Underline animation: scaleX(0) -> scaleX(1) with transform-origin: left
    assert.ok(
      cssContent.includes('transform: scaleX(0);'),
      'Action underline must start at scaleX(0)'
    );
    assert.ok(
      cssContent.includes('transform-origin: left;'),
      'Underline transform-origin must be left'
    );
    assert.ok(
      cssContent.includes('.editorial-action-row:hover .action-row-underline {\n  transform: scaleX(1);'),
      'Hover must transition underline to scaleX(1)'
    );

    // Primary underline uses GraphMind green accent (#A3FF12)
    assert.ok(
      cssContent.includes('.primary-underline {\n  background-color: #A3FF12;'),
      'Primary underline must use #A3FF12 accent'
    );

    // Arrow shift on hover: moves up and right
    assert.ok(
      cssContent.includes('transform: translate(3px, -3px);'),
      'Hover must shift the arrow 3px right and 3px up'
    );
  });

  test('Panel entry animation and tap feedback are configured with framer-motion', () => {
    // Actions area enters with subtle y translation
    assert.ok(
      panelContent.includes('initial={{ opacity: 0, y: 6 }}'),
      'Actions area should enter with y: 6 -> 0'
    );
    // Tap response scale: 0.99
    assert.ok(
      panelContent.includes('whileTap={{ scale: 0.99 }}'),
      'Actions should have subtle scale: 0.99 tap feedback'
    );
  });
});
