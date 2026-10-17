import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { personaTransitionController } from '../src/components/persona/personaTransition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appSrcPath = path.resolve(__dirname, '../src/App.tsx');
const appShellPath = path.resolve(__dirname, '../src/components/layout/AppShell.tsx');
const topBarPath = path.resolve(__dirname, '../src/components/layout/TopBar.tsx');
const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
const transitionPath = path.resolve(__dirname, '../src/components/persona/personaTransition.ts');

const appSrc = fs.readFileSync(appSrcPath, 'utf8');
const appShellSrc = fs.readFileSync(appShellPath, 'utf8');
const topBarSrc = fs.readFileSync(topBarPath, 'utf8');
const sidebarSrc = fs.readFileSync(sidebarPath, 'utf8');
const transitionSrc = fs.readFileSync(transitionPath, 'utf8');

describe('GRAPHMIND — UNIVERSAL PERSONA PROFILE ACCESS FROM ANY SECTION', () => {
  describe('1. Transition Controller Universal Access API', () => {
    it('provides openPersona method that activates Persona without requiring HERO_IDLE', () => {
      assert.ok(
        transitionSrc.includes('openPersona(): boolean'),
        'personaTransitionController must expose openPersona method'
      );
    });

    it('allows opening Persona from HERO_ENTERING state (e.g., direct navigation to /graph or /study)', () => {
      personaTransitionController.startHeroEntering();
      assert.equal(personaTransitionController.state, 'HERO_ENTERING');

      const opened = personaTransitionController.openPersona();
      assert.equal(opened, true, 'openPersona must succeed from HERO_ENTERING state');
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');
    });

    it('allows opening Persona from RETURNING_TO_HERO state (e.g. repeated opens from /graph)', () => {
      personaTransitionController.completeHumanFormed();
      personaTransitionController.setPersonaReady();
      assert.equal(personaTransitionController.state, 'PERSONA_READY');

      personaTransitionController.triggerReturnToHero();
      assert.equal(personaTransitionController.state, 'RETURNING_TO_HERO');

      // Re-opening while on non-overview page without hero orb mounting
      const openedAgain = personaTransitionController.openPersona();
      assert.equal(openedAgain, true, 'openPersona must succeed from RETURNING_TO_HERO');
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');
    });

    it('prevents double activation when already in Persona', () => {
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');
      const doubleOpen = personaTransitionController.openPersona();
      assert.equal(doubleOpen, false, 'openPersona must reject duplicate activation while active');
    });

    it('allows clean return to workspace even if exited early during ORB_TO_HUMAN formation', () => {
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');
      const exitEarly = personaTransitionController.triggerReturnToHero();
      assert.equal(exitEarly, true, 'triggerReturnToHero must succeed during ORB_TO_HUMAN');
      assert.equal(personaTransitionController.state, 'RETURNING_TO_HERO');
    });
  });

  describe('2. App Shell & Application Component Integration', () => {
    it('wires handleOpenPersona to personaTransitionController.openPersona() in App.tsx', () => {
      assert.ok(
        appSrc.includes('personaTransitionController.openPersona()'),
        'App.tsx handleOpenPersona must call personaTransitionController.openPersona()'
      );
    });

    it('passes onOpenPersona to both TopBar and Sidebar in AppShell.tsx', () => {
      assert.ok(
        appShellSrc.includes('onOpenPersona={onOpenPersona}'),
        'AppShell must pass onOpenPersona to child navigation components'
      );
    });

    it('renders the profile avatar button in TopBar.tsx with onOpenPersona trigger', () => {
      assert.ok(
        topBarSrc.includes('className="profile-avatar"'),
        'TopBar must render profile-avatar'
      );
      assert.ok(
        topBarSrc.includes('onOpenPersona?.()'),
        'TopBar profile-avatar must invoke onOpenPersona'
      );
    });

    it('renders accessible Profile navigation item in Sidebar.tsx footer alongside Settings', () => {
      assert.ok(
        sidebarSrc.includes('id="btn-sidebar-persona-profile"'),
        'Sidebar must render accessible profile button'
      );
      assert.ok(
        sidebarSrc.includes('onOpenPersona()'),
        'Sidebar profile button must invoke onOpenPersona'
      );
    });
  });
});
