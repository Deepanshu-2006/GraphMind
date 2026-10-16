import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const personaExperiencePath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
const personaAtmospherePath = path.resolve(__dirname, '../src/components/persona/PersonaAtmosphere.tsx');
const personaCssPath = path.resolve(__dirname, '../src/styles/persona.css');
const topBarPath = path.resolve(__dirname, '../src/components/layout/TopBar.tsx');
const appShellPath = path.resolve(__dirname, '../src/components/layout/AppShell.tsx');
const appPath = path.resolve(__dirname, '../src/App.tsx');
const indexCssPath = path.resolve(__dirname, '../src/index.css');

const personaExperienceSrc = fs.readFileSync(personaExperiencePath, 'utf8');
const personaAtmosphereSrc = fs.readFileSync(personaAtmospherePath, 'utf8');
const personaCss = fs.readFileSync(personaCssPath, 'utf8');
const topBarSrc = fs.readFileSync(topBarPath, 'utf8');
const appShellSrc = fs.readFileSync(appShellPath, 'utf8');
const appSrc = fs.readFileSync(appPath, 'utf8');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

describe('GRAPHMIND — PERSONA EXPERIENCE FOUNDATION (PROMPT 01)', () => {
  describe('1. Project Inspection & Safe Integration', () => {
    it('imports persona.css into the main index.css cascade', () => {
      assert.ok(
        indexCss.includes("@import './styles/persona.css';"),
        'persona.css must be imported in src/index.css'
      );
    });

    it('reuses existing framer-motion and lucide-react without external animation dependencies', () => {
      assert.ok(
        personaExperienceSrc.includes("from 'framer-motion'"),
        'PersonaExperience must use framer-motion'
      );
      assert.ok(
        personaExperienceSrc.includes("from 'lucide-react'"),
        'PersonaExperience must reuse installed lucide-react icons'
      );
    });

    it('preserves existing landing page particle sphere architecture in KnowledgeOrb3D', () => {
      const orbPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');
      assert.ok(fs.existsSync(orbPath), 'KnowledgeOrb3D.tsx must remain intact');
    });
  });

  describe('2. Profile Interaction & Double-Activation Prevention', () => {
    it('wires the existing top-right profile avatar as the Persona entry point', () => {
      assert.ok(
        topBarSrc.includes('onOpenPersona'),
        'TopBar must accept onOpenPersona callback'
      );
      assert.ok(
        topBarSrc.includes('onClick={(e) => {'),
        'Profile avatar must handle click events'
      );
      assert.ok(
        topBarSrc.includes("onOpenPersona?.()"),
        'Profile avatar must call onOpenPersona'
      );
    });

    it('supports keyboard accessibility (Enter and Space) on profile avatar', () => {
      assert.ok(
        topBarSrc.includes("e.key === 'Enter' || e.key === ' '"),
        'Profile avatar must handle keyboard activation on Enter or Space'
      );
    });

    it('prevents duplicate activation in App.tsx', () => {
      assert.ok(
        appSrc.includes('if (isPersonaOpen) return;'),
        'handleOpenPersona must guard against double activation'
      );
    });
  });

  describe('3. Dedicated Full-Screen Persona Experience Shell', () => {
    it('occupies the entire application viewport with fixed full-screen dimensions', () => {
      assert.match(
        personaCss,
        /\.persona-experience-root\s*\{[\s\S]*?position:\s*fixed;/,
        'Must use fixed positioning'
      );
      assert.match(
        personaCss,
        /\.persona-experience-root\s*\{[\s\S]*?inset:\s*0;/,
        'Must span full inset: 0'
      );
      assert.match(
        personaCss,
        /\.persona-experience-root\s*\{[\s\S]*?z-index:\s*9999;/,
        'Must elevate above header and sidebar navigation'
      );
    });

    it('shields underlying application elements from screen readers and interaction while active', () => {
      assert.ok(
        appShellSrc.includes('aria-hidden={isPersonaOpen}'),
        'AppShell must be marked aria-hidden when Persona is active'
      );
      assert.ok(
        appShellSrc.includes("inert={isPersonaOpen ? '' : undefined}"),
        'AppShell must be inert when Persona is active'
      );
    });

    it('preserves underlying workspace state without full page reload or view reset', () => {
      assert.ok(
        appSrc.includes('<PersonaExperience'),
        'PersonaExperience must be rendered cleanly via overlay/AnimatePresence'
      );
      assert.ok(
        appSrc.includes('previousPathRef'),
        'App must store previous path to restore cleanly upon exit'
      );
    });
  });

  describe('4. Visual Direction & Swiss-Editorial Aesthetics', () => {
    it('uses GraphMind near-black background and signature tokens', () => {
      assert.match(
        personaCss,
        /background-color:\s*var\(--bg-app,\s*#0A0A0A\);/,
        'Must inherit near-black background'
      );
      assert.match(
        personaCss,
        /color:\s*var\(--text-primary,\s*#F5F5F5\);/,
        'Must use primary white text token'
      );
      assert.match(
        personaCss,
        /var\(--accent,\s*#A3FF12\)/,
        'Must use signature lime accent #A3FF12'
      );
    });

    it('uses editorial display typography for headlines', () => {
      assert.match(
        personaCss,
        /font-family:\s*var\(--font-display,\s*'Inter Tight',\s*sans-serif\);/,
        'Headline must use Inter Tight display typography'
      );
    });

    it('does not contain glassmorphism or purple gradients', () => {
      assert.ok(!personaCss.includes('backdrop-filter: blur'), 'Must avoid glassmorphism');
      assert.ok(!personaCss.includes('#8b5cf6') && !personaCss.includes('#a855f7'), 'Must avoid purple gradients');
    });
  });

  describe('5. Initial Experience State & Required Content', () => {
    it('renders the exact identity label "GRAPHMIND PERSONA"', () => {
      assert.ok(
        personaExperienceSrc.includes('GRAPHMIND PERSONA'),
        'Must display GRAPHMIND PERSONA identity label'
      );
    });

    it('renders the exact introductory headline "Your learning, brought to life."', () => {
      assert.ok(
        personaExperienceSrc.includes('Your learning, brought to life.'),
        'Must render headline: Your learning, brought to life.'
      );
    });

    it('renders the exact supporting sentence "A personal space for exploring your knowledge journey."', () => {
      assert.ok(
        personaExperienceSrc.includes('A personal space for exploring your knowledge journey.'),
        'Must render supporting sentence: A personal space for exploring your knowledge journey.'
      );
    });

    it('does not display fabricated personalized statistics or fake AI chat boxes', () => {
      assert.ok(!personaExperienceSrc.includes('95% accuracy'), 'No fake stats allowed');
      assert.ok(!personaExperienceSrc.includes('Ask me anything'), 'No fake AI chat prompt');
      assert.ok(!personaExperienceSrc.includes('messages:'), 'No fake chat transcript');
    });

    it('provides the future 3D character stage integration point with anchor attributes', () => {
      assert.ok(
        personaExperienceSrc.includes('data-character-stage="true"'),
        'Must declare data-character-stage="true"'
      );
      assert.ok(
        personaExperienceSrc.includes('id="persona-character-stage"'),
        'Must declare id="persona-character-stage"'
      );
      assert.ok(
        personaExperienceSrc.includes('characterSlot'),
        'Must support characterSlot prop for Prompt 02'
      );
    });
  });

  describe('6. Exit Interaction & Accessibility', () => {
    it('features a subtle editorial text-and-arrow exit button', () => {
      assert.ok(
        personaExperienceSrc.includes('persona-exit-btn'),
        'Must render persona-exit-btn'
      );
      assert.ok(
        personaExperienceSrc.includes('Return to workspace'),
        'Must render "Return to workspace" label'
      );
      assert.ok(
        personaExperienceSrc.includes('ArrowLeft'),
        'Must render subtle arrow icon'
      );
    });

    it('supports Escape key navigation to exit Persona', () => {
      assert.ok(
        personaExperienceSrc.includes("e.key === 'Escape'"),
        'Must close on Escape key'
      );
    });

    it('manages focus trap and restores focus upon exit', () => {
      assert.ok(
        personaExperienceSrc.includes('previousFocusRef'),
        'Must store previously focused element'
      );
      assert.ok(
        personaExperienceSrc.includes('previousFocusRef.current.focus()'),
        'Must return focus on exit'
      );
      assert.ok(
        personaExperienceSrc.includes("e.key === 'Tab'"),
        'Must trap tab navigation within Persona dialog'
      );
    });

    it('prevents background scroll when Persona is active', () => {
      assert.ok(
        personaExperienceSrc.includes("document.body.style.overflow = 'hidden'"),
        'Must prevent background body scroll'
      );
    });
  });

  describe('7. Atmospheric Particles & Animation Cleanup', () => {
    it('PersonaAtmosphere cleans up animation frames and resize listeners on unmount', () => {
      assert.ok(
        personaAtmosphereSrc.includes('cancelAnimationFrame(animationFrameId)'),
        'Must cancel animation frame on unmount'
      );
      assert.ok(
        personaAtmosphereSrc.includes("window.removeEventListener('resize', resizeCanvas)"),
        'Must remove resize listener on unmount'
      );
    });

    it('respects prefers-reduced-motion in atmosphere and Framer Motion transitions', () => {
      assert.ok(
        personaAtmosphereSrc.includes('prefers-reduced-motion: reduce'),
        'PersonaAtmosphere must detect reduced motion preference'
      );
      assert.ok(
        personaExperienceSrc.includes('useReducedMotion()'),
        'PersonaExperience must use useReducedMotion'
      );
      assert.ok(
        personaCss.includes('@media (prefers-reduced-motion: reduce)'),
        'persona.css must include reduced motion overrides'
      );
    });
  });
});
