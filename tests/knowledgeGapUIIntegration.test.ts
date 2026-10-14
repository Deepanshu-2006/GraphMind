import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Knowledge Gap UI & System Integration Tests (Prompt 16)', () => {
  const studyViewPath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const studyGapCompPath = path.resolve(process.cwd(), 'src/components/study/KnowledgeGapSection.tsx');
  const revisionWorkspacePath = path.resolve(process.cwd(), 'src/components/revision/RevisionWorkspace.tsx');
  const revisionOverviewPath = path.resolve(process.cwd(), 'src/components/revision/RevisionConceptOverview.tsx');
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const studyCssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');
  const revisionCssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  const servicePath = path.resolve(process.cwd(), 'src/services/knowledgeGapDetection.ts');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyGapCompSrc = fs.readFileSync(studyGapCompPath, 'utf8');
  const revisionWorkspaceSrc = fs.readFileSync(revisionWorkspacePath, 'utf8');
  const revisionOverviewSrc = fs.readFileSync(revisionOverviewPath, 'utf8');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');
  const revisionCss = fs.readFileSync(revisionCssPath, 'utf8');
  const serviceSrc = fs.readFileSync(servicePath, 'utf8');

  describe('1. StudySpaceView Architecture & Section Placement', () => {
    it('integrates KnowledgeGapSection before Concepts Worth Revisiting', () => {
      assert.ok(studyViewSrc.includes('KnowledgeGapSection'), 'StudySpaceView must import KnowledgeGapSection');
      assert.ok(studyViewSrc.includes('<KnowledgeGapSection'), 'StudySpaceView must render KnowledgeGapSection');
      
      const gapsIdx = studyViewSrc.indexOf('<KnowledgeGapSection');
      const revisitIdx = studyViewSrc.indexOf('Concepts Worth Revisiting Section');

      assert.ok(gapsIdx !== -1, 'KnowledgeGapSection must exist');
      assert.ok(revisitIdx !== -1, 'Concepts Worth Revisiting must exist');
      assert.ok(gapsIdx < revisitIdx, 'KnowledgeGapSection must be placed before Concepts Worth Revisiting');
    });

    it('passes navigation callbacks to KnowledgeGapSection including onNavigateToRevision', () => {
      assert.match(
        studyViewSrc,
        /onNavigateToRevision=\{onNavigateToRevision\}/,
        'StudySpaceView must pass onNavigateToRevision down to KnowledgeGapSection'
      );
    });
  });

  describe('2. Revision Workspace & Concept Overview Integration', () => {
    it('computes knowledge gap report in RevisionWorkspace without mutating active session order', () => {
      assert.ok(revisionWorkspaceSrc.includes('detectKnowledgeGaps'), 'RevisionWorkspace must detect knowledge gaps');
      assert.ok(revisionWorkspaceSrc.includes('gapReport'), 'RevisionWorkspace must derive gapReport');
      
      // Ensure session reordering is NOT performed silently
      assert.ok(
        !revisionWorkspaceSrc.includes('gapReport.detectedGaps.sort('),
        'Revision session order must not be silently reordered by gap detection'
      );
    });

    it('displays contextual gap banner for current concept in RevisionWorkspace', () => {
      assert.ok(
        revisionWorkspaceSrc.includes('revision-gap-banner'),
        'RevisionWorkspace must render revision-gap-banner when active concept has an identified gap'
      );
      assert.ok(
        revisionWorkspaceSrc.includes('currentConceptGap'),
        'RevisionWorkspace must check for currentConceptGap'
      );
    });

    it('renders knowledge gap counts and foundational badges in RevisionConceptOverview', () => {
      assert.ok(
        revisionOverviewSrc.includes('gapReport'),
        'RevisionConceptOverview must accept gapReport prop'
      );
      assert.ok(
        revisionOverviewSrc.includes('KNOWLEDGE GAPS'),
        'RevisionConceptOverview must render KNOWLEDGE GAPS stat item'
      );
      assert.ok(
        revisionOverviewSrc.includes('foundational'),
        'RevisionConceptOverview must support foundational pill class'
      );
    });
  });

  describe('3. App Navigation & Routing Wiring', () => {
    it('wires onNavigateToRevision in App.tsx to navigate to revision view with focused concept', () => {
      assert.match(
        appSrc,
        /onNavigateToRevision=\{\(conceptId\)\s*=>\s*\{[\s\S]*?navigateToSection\('revision'\)/,
        'App.tsx must wire onNavigateToRevision to switch view and set focused concept'
      );
    });
  });

  describe('4. Swiss Editorial Styling & Design System Discipline', () => {
    it('applies monospace uppercase typography to eyebrow with lime-green accent', () => {
      assert.match(
        studyCss,
        /\.study-gaps-eyebrow\s*\{[^}]*color:\s*var\(--accent,\s*#A3FF12\);/,
        'Gaps eyebrow must use signature lime-green accent'
      );
      assert.match(
        studyCss,
        /\.study-gaps-eyebrow\s*\{[^}]*letter-spacing:\s*0\.18em;/,
        'Gaps eyebrow must match letter-spacing token'
      );
      assert.match(
        studyCss,
        /\.study-gaps-eyebrow\s*\{[^}]*text-transform:\s*uppercase;/,
        'Gaps eyebrow must be uppercase'
      );
    });

    it('defines restrained color tokens for gap categories without harsh saturated colors', () => {
      assert.match(
        studyCss,
        /\.gap-badge-review\s*\{[^}]*color:\s*#FBBF24;/,
        'Review recommended must use warm amber text'
      );
      assert.match(
        studyCss,
        /\.gap-badge-foundational\s*\{[^}]*color:\s*#D8B4FE;/,
        'Potential foundational gap must use muted purple text'
      );
      assert.match(
        studyCss,
        /\.gap-badge-observed\s*\{[^}]*color:\s*#7DD3FC;/,
        'Observed difficulty must use calm sky blue text'
      );
    });

    it('implements responsive layouts for tablet and mobile screens', () => {
      assert.ok(studyCss.includes('@media (max-width: 768px)'), 'CSS must include 768px media query');
      assert.ok(studyCss.includes('.study-gap-card-header'), 'Card header must have responsive styling');
      assert.ok(studyCss.includes('.study-gap-card-actions'), 'Card actions must adapt cleanly on smaller screens');
    });
  });

  describe('5. Tone & Student Dignity Enforcement', () => {
    it('never contains pejorative or demoralizing language in user-facing UI or detection messages', () => {
      const pejoratives = [
        'unintelligent',
        'dumb',
        'stupid',
        'weak student',
        'bad at',
        'failing student',
        'hopeless',
        'incompetent'
      ];

      for (const badWord of pejoratives) {
        assert.ok(!studyGapCompSrc.toLowerCase().includes(badWord), `KnowledgeGapSection must not contain "${badWord}"`);
        assert.ok(!revisionOverviewSrc.toLowerCase().includes(badWord), `RevisionConceptOverview must not contain "${badWord}"`);
      }
    });

    it('uses constructive, observation-based phrasing for recommendations and evidence', () => {
      assert.ok(
        serviceSrc.includes('Consider reviewing this concept again because'),
        'Must provide observation-grounded guidance for review recommended'
      );
      assert.ok(
        serviceSrc.includes('Your understanding of this concept is not yet established because there is insufficient assessment evidence.'),
        'Must state when evidence is insufficient without falsely diagnosing a gap'
      );
    });
  });
});
