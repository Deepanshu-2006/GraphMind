import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Prerequisite-Aware Learning UI & System Integration Tests (Prompt 17)', () => {
  const foundationsCompPath = path.resolve(process.cwd(), 'src/components/revision/FoundationsSection.tsx');
  const revisionWorkspacePath = path.resolve(process.cwd(), 'src/components/revision/RevisionWorkspace.tsx');
  const revisionCssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  const typesPath = path.resolve(process.cwd(), 'src/types/prerequisites.ts');
  const servicePath = path.resolve(process.cwd(), 'src/services/prerequisiteAnalysis.ts');

  const foundationsCompSrc = fs.readFileSync(foundationsCompPath, 'utf8');
  const revisionWorkspaceSrc = fs.readFileSync(revisionWorkspacePath, 'utf8');
  const revisionCss = fs.readFileSync(revisionCssPath, 'utf8');
  const typesSrc = fs.readFileSync(typesPath, 'utf8');
  const serviceSrc = fs.readFileSync(servicePath, 'utf8');

  describe('1. FoundationsSection Architecture & Fallback Discipline', () => {
    it('returns null and cleanly omits section when no foundations exist', () => {
      assert.ok(
        foundationsCompSrc.includes('if (!report || !report.hasFoundations || !report.items || report.items.length === 0)'),
        'FoundationsSection must guard against empty reports and return null'
      );
      assert.ok(
        foundationsCompSrc.includes('return null;'),
        'FoundationsSection must return null instead of rendering empty decorative section'
      );
    });

    it('displays distinct category badges for confirmed prerequisites, source foundations, and related concepts', () => {
      assert.ok(
        foundationsCompSrc.includes('category-confirmed-prerequisite'),
        'Must support category-confirmed-prerequisite badge styling'
      );
      assert.ok(
        foundationsCompSrc.includes('category-source-foundation'),
        'Must support category-source-foundation badge styling'
      );
      assert.ok(
        foundationsCompSrc.includes('category-related-concept'),
        'Must support category-related-concept badge styling'
      );
    });

    it('renders evidence status indicators with distinct color-coded dots', () => {
      assert.ok(
        foundationsCompSrc.includes('evidenceStatus'),
        'Must render student evidence status'
      );
      assert.ok(
        foundationsCompSrc.includes('revision-foundation-status-dot'),
        'Must render foundation status dot marker'
      );
    });

    it('provides direct actions: review foundation detour and explore in graph', () => {
      assert.ok(
        foundationsCompSrc.includes('onOpenFoundationalConcept'),
        'Must provide direct action callback to open foundational concept'
      );
      assert.ok(
        foundationsCompSrc.includes('Review foundation'),
        'Must render "Review foundation" button text'
      );
      assert.ok(
        foundationsCompSrc.includes('onViewInGraph'),
        'Must provide option to view concept in knowledge graph'
      );
    });
  });

  describe('2. Revision Workspace Simplification (Prompt 11)', () => {
    it('omits FoundationsSection and section-foundations in simplified RevisionWorkspace', () => {
      assert.ok(
        !revisionWorkspaceSrc.includes('<FoundationsSection'),
        'RevisionWorkspace must not render FoundationsSection in simplified revision'
      );
      assert.ok(
        !revisionWorkspaceSrc.includes("id: 'section-foundations'"),
        'Active sections list must omit section-foundations in simplified revision'
      );
      assert.ok(
        !revisionWorkspaceSrc.includes("label: 'Foundations'"),
        'Section jump navigation must not include Foundations'
      );
    });

    it('omits foundational excursion detour banner in simplified RevisionWorkspace', () => {
      assert.ok(
        !revisionWorkspaceSrc.includes('revision-excursion-banner'),
        'RevisionWorkspace must omit revision-excursion-banner'
      );
      assert.ok(
        !revisionWorkspaceSrc.includes('handleOpenFoundationalConcept'),
        'RevisionWorkspace must omit handleOpenFoundationalConcept'
      );
    });
  });

  describe('3. Swiss Editorial Styling & Visual Hierarchy', () => {
    it('applies monospace typography to foundations kicker and badges', () => {
      assert.match(
        revisionCss,
        /\.revision-foundations-kicker\s*\{[^}]*font-family:\s*var\(--font-mono/,
        'Foundations kicker must use monospace font'
      );
      assert.match(
        revisionCss,
        /\.revision-excursion-badge\s*\{[^}]*font-family:\s*var\(--font-mono/,
        'Excursion badge must use monospace font'
      );
    });

    it('enforces restrained status colors without garish gradients', () => {
      assert.match(
        revisionCss,
        /\.revision-foundation-status-dot\.needs-review\s*\{[^}]*background-color:\s*#E879F9/,
        'Needs review status dot must use muted magenta accent'
      );
      assert.match(
        revisionCss,
        /\.revision-foundation-status-dot\.demonstrated\s*\{[^}]*background-color:\s*#22C55E/,
        'Demonstrated status dot must use GraphMind positive green'
      );
      assert.match(
        revisionCss,
        /\.revision-foundation-status-dot\.not-assessed\s*\{[^}]*background-color:\s*#71717A/,
        'Not assessed status dot must use neutral zinc dot'
      );
    });

    it('defines responsive layout rules for cards and banner on tablet and mobile', () => {
      assert.ok(
        revisionCss.includes('@media (max-width: 768px)'),
        'CSS must define responsive media query for tablet'
      );
      assert.ok(
        revisionCss.includes('.revision-foundation-card'),
        'CSS must style foundation cards'
      );
      assert.ok(
        revisionCss.includes('.revision-excursion-banner'),
        'CSS must style excursion banner'
      );
    });
  });

  describe('4. Type Definitions & Service Contracts', () => {
    it('exports all prerequisite data models from types index', () => {
      const typesIndexSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/types/index.ts'), 'utf8');
      assert.ok(typesIndexSrc.includes("export * from './prerequisites';"), 'types/index.ts must re-export prerequisites');
    });

    it('defines PrerequisiteCategory and PrerequisiteEvidenceStatus unions', () => {
      assert.ok(typesSrc.includes("'confirmed-prerequisite'"), 'Must include confirmed-prerequisite');
      assert.ok(typesSrc.includes("'source-foundation'"), 'Must include source-foundation');
      assert.ok(typesSrc.includes("'related-concept'"), 'Must include related-concept');
      assert.ok(typesSrc.includes("'needs-review'"), 'Must include needs-review');
      assert.ok(typesSrc.includes("'observed-difficulty'"), 'Must include observed-difficulty');
      assert.ok(typesSrc.includes("'not-assessed'"), 'Must include not-assessed');
      assert.ok(typesSrc.includes("'demonstrated'"), 'Must include demonstrated');
    });

    it('caps recommendations at maximum 5 items to avoid cognitive overload', () => {
      assert.ok(
        serviceSrc.includes('.slice(0, 5)'),
        'prerequisiteAnalysis must slice results to top 5 items'
      );
    });
  });
});
