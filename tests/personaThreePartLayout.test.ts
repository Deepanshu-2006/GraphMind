import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const personaExperiencePath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
const personaCssPath = path.resolve(__dirname, '../src/styles/persona.css');
const personaActivityPanelPath = path.resolve(__dirname, '../src/components/persona/PersonaActivityPanel.tsx');
const personaPerformancePanelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');

const personaExperienceSrc = fs.readFileSync(personaExperiencePath, 'utf8');
const personaCss = fs.readFileSync(personaCssPath, 'utf8');
const personaActivityPanelSrc = fs.readFileSync(personaActivityPanelPath, 'utf8');
const personaPerformancePanelSrc = fs.readFileSync(personaPerformancePanelPath, 'utf8');

describe('GRAPHMIND — COMPLETE THREE-PART PERSONA LAYOUT INTEGRATION (Step 14)', () => {
  // =========================================================================
  // 1. THREE-PART COMPOSITION & VISUAL ZONES
  // =========================================================================
  describe('1. Three-Part Composition Architecture', () => {
    it('integrates PersonaActivityPanel on the left, character in center, and PersonaPerformancePanel on the right', () => {
      // Confirms both panels are imported
      assert.ok(
        personaExperienceSrc.includes("import { PersonaActivityPanel } from './PersonaActivityPanel';"),
        'PersonaExperience must import PersonaActivityPanel'
      );
      assert.ok(
        personaExperienceSrc.includes("import { PersonaPerformancePanel } from './PersonaPerformancePanel';"),
        'PersonaExperience must import PersonaPerformancePanel'
      );

      // Confirms the 3-column layout slots exist
      assert.ok(
        personaExperienceSrc.includes('className="persona-dashboard-left"'),
        'Must render left column container'
      );
      assert.ok(
        personaExperienceSrc.includes('className="persona-dashboard-center"'),
        'Must render center spacer container'
      );
      assert.ok(
        personaExperienceSrc.includes('className="persona-dashboard-right"'),
        'Must render right column container'
      );

      // Confirms both components are rendered inside their respective columns
      assert.ok(
        personaExperienceSrc.includes('<PersonaActivityPanel'),
        'Must render PersonaActivityPanel in the left zone'
      );
      assert.ok(
        personaExperienceSrc.includes('<PersonaPerformancePanel'),
        'Must render PersonaPerformancePanel in the right zone'
      );
    });

    it('preserves the central 3D character stage with anchor attributes', () => {
      assert.ok(
        personaExperienceSrc.includes('id="persona-character-stage"'),
        'Must retain id="persona-character-stage"'
      );
      assert.ok(
        personaExperienceSrc.includes('data-character-stage="true"'),
        'Must retain data-character-stage="true"'
      );
      assert.ok(
        personaExperienceSrc.includes('characterSlot'),
        'Must retain characterSlot integration slot'
      );
    });

    it('assigns accessible landmarks and region roles to the dashboard overlay', () => {
      assert.ok(
        personaExperienceSrc.includes('role="region"'),
        'Overlay must declare role="region" for screen readers'
      );
      assert.ok(
        personaExperienceSrc.includes('aria-label="Learning Statistics Dashboard"'),
        'Overlay must declare descriptive aria-label'
      );
      assert.ok(
        personaExperienceSrc.includes('id="persona-dashboard-overlay"'),
        'Overlay must declare id="persona-dashboard-overlay"'
      );
    });
  });

  // =========================================================================
  // 2. HORIZONTAL CENTERING & CHARACTER DOMINANCE
  // =========================================================================
  describe('2. Horizontal Centering & Character Dominance', () => {
    it('uses mathematically symmetrical 3-column grid to lock character at exact 50vw center', () => {
      // Left and right tracks must have identical constraints so 1fr center is symmetrically placed
      assert.match(
        personaCss,
        /grid-template-columns:\s*minmax\(\s*280px,\s*340px\s*\)\s*1fr\s*minmax\(\s*280px,\s*340px\s*\);/,
        'Desktop grid must declare symmetrical minmax(280px, 340px) 1fr minmax(280px, 340px) columns'
      );
    });

    it('allows pointer events to pass through the center column for unobstructed 3D interaction', () => {
      assert.match(
        personaCss,
        /\.persona-dashboard-overlay\s*\{[\s\S]*?pointer-events:\s*none;/,
        'Overlay container must have pointer-events: none'
      );
      assert.match(
        personaCss,
        /\.persona-dashboard-center\s*\{[\s\S]*?pointer-events:\s*none;/,
        'Center column must maintain pointer-events: none to allow cursor tracking across character face'
      );
      assert.match(
        personaCss,
        /\.persona-dashboard-left\s*\{[\s\S]*?pointer-events:\s*auto;/,
        'Left panel must enable pointer-events: auto for button interaction'
      );
      assert.match(
        personaCss,
        /\.persona-dashboard-right\s*\{[\s\S]*?pointer-events:\s*auto;/,
        'Right panel must enable pointer-events: auto for button interaction'
      );
    });

    it('caps side panel widths at 340px to prevent encroachment into character space', () => {
      assert.match(
        personaCss,
        /\.persona-dashboard-left\s*\{[\s\S]*?max-width:\s*340px;/,
        'Left panel max-width must be capped at 340px'
      );
      assert.match(
        personaCss,
        /\.persona-dashboard-right\s*\{[\s\S]*?max-width:\s*340px;/,
        'Right panel max-width must be capped at 340px'
      );
    });

    it('provides top padding clearance to prevent side panels from colliding with header controls', () => {
      assert.match(
        personaCss,
        /padding:\s*calc\(\s*64px\s*\+\s*20px\s*\)\s*48px\s*48px\s*48px;/,
        'Overlay must provide top clearance below 64px header'
      );
    });
  });

  // =========================================================================
  // 3. RESPONSIVE ADAPTABILITY ACROSS VIEWPORT CATEGORIES
  // =========================================================================
  describe('3. Responsive Viewport Adaptability', () => {
    it('adapts for standard laptops (1024px-1279px) with reduced column widths before character shrink', () => {
      assert.match(
        personaCss,
        /@media\s*\(max-width:\s*1279px\)\s*and\s*\(min-width:\s*1024px\)/,
        'Must define standard laptop media query'
      );
      assert.match(
        personaCss,
        /minmax\(\s*250px,\s*300px\s*\)\s*1fr\s*minmax\(\s*250px,\s*300px\s*\)/,
        'Laptop grid must reduce side column widths to minmax(250px, 300px)'
      );
    });

    it('reorganizes into a balanced 2-column dock on tablets (768px-1023px) below character', () => {
      assert.match(
        personaCss,
        /@media\s*\(max-width:\s*1023px\)\s*and\s*\(min-width:\s*768px\)/,
        'Must define tablet media query'
      );
      assert.match(
        personaCss,
        /grid-template-columns:\s*1fr\s*1fr;/,
        'Tablet overlay must switch to a 2-column dock (1fr 1fr)'
      );
      assert.match(
        personaCss,
        /align-items:\s*flex-end;/,
        'Tablet overlay must dock panels at the bottom edge below character'
      );
    });

    it('organizes into a single-column vertical stack on mobile (<768px)', () => {
      assert.match(
        personaCss,
        /@media\s*\(max-width:\s*767px\)/,
        'Must define mobile media query'
      );
      assert.match(
        personaCss,
        /flex-direction:\s*column;/,
        'Mobile overlay must switch to flex-direction: column'
      );
      assert.match(
        personaCss,
        /max-height:\s*36vh;/,
        'Mobile panels must be bounded by max-height to keep character visible'
      );
    });
  });

  // =========================================================================
  // 4. VISUAL COHESION & SWISS-EDITORIAL RESTRAINT
  // =========================================================================
  describe('4. Visual Cohesion & Design Tokens', () => {
    it('shares identical typography and label hierarchy between left and right panels', () => {
      // Both panels share eyebrow tag styling
      assert.ok(personaActivityPanelSrc.includes('persona-activity-tag'));
      assert.ok(personaPerformancePanelSrc.includes('persona-activity-tag'));

      // Both panels share primary stat values
      assert.ok(personaActivityPanelSrc.includes('persona-stat-value'));
      assert.ok(personaPerformancePanelSrc.includes('persona-stat-value'));

      // Both panels share thin progress bar styling
      assert.ok(personaActivityPanelSrc.includes('persona-progress-track'));
      assert.ok(personaPerformancePanelSrc.includes('persona-progress-track'));
    });

    it('strictly avoids glassmorphic blur filters and gaudy gradients', () => {
      assert.ok(!personaCss.includes('backdrop-filter: blur'), 'Must avoid glassmorphism blur in persona styles');
      assert.ok(!personaCss.includes('#8b5cf6') && !personaCss.includes('#a855f7'), 'Must avoid purple gradients');
    });

    it('respects prefers-reduced-motion across transitions and animations', () => {
      assert.ok(personaCss.includes('@media (prefers-reduced-motion: reduce)'));
      assert.ok(personaExperienceSrc.includes('useReducedMotion'));
    });
  });

  // =========================================================================
  // 5. SCOPE INTEGRITY (NO FABRICATION, NO AUDIO/VOICE REGRESSION)
  // =========================================================================
  describe('5. Strict Scope Integrity', () => {
    it('does not introduce streak counters or fake knowledge-retention metrics', () => {
      assert.ok(!personaActivityPanelSrc.includes('retentionScore'));
      assert.ok(!personaPerformancePanelSrc.includes('retentionScore'));
      assert.ok(!personaActivityPanelSrc.includes('streak'));
      assert.ok(!personaPerformancePanelSrc.includes('streak'));
    });

    it('does not add microphone or speech-recognition UI', () => {
      assert.ok(!personaExperienceSrc.includes('webkitSpeechRecognition'));
      assert.ok(!personaExperienceSrc.includes('SpeechRecognition'));
      assert.ok(!personaExperienceSrc.includes('navigator.mediaDevices'));
    });
  });
});
