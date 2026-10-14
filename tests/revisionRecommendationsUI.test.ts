import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Personalized Revision Recommendations UI & System Integration Tests (Prompt 18)', () => {
  const recommendationsCompPath = path.resolve(process.cwd(), 'src/components/study/RevisionRecommendationsSection.tsx');
  const studySpaceViewPath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const studySpaceCssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');
  const typesPath = path.resolve(process.cwd(), 'src/types/recommendations.ts');
  const servicePath = path.resolve(process.cwd(), 'src/services/revisionRecommendations.ts');

  const compSrc = fs.readFileSync(recommendationsCompPath, 'utf8');
  const studySpaceSrc = fs.readFileSync(studySpaceViewPath, 'utf8');
  const cssSrc = fs.readFileSync(studySpaceCssPath, 'utf8');
  const typesSrc = fs.readFileSync(typesPath, 'utf8');
  const serviceSrc = fs.readFileSync(servicePath, 'utf8');

  describe('1. Component Architecture & Visual Hierarchy', () => {
    it('guards against null, empty or nodeless graphs by returning null', () => {
      assert.ok(
        compSrc.includes('if (!graph || !graph.nodes || graph.nodes.length === 0)'),
        'RevisionRecommendationsSection must guard against empty graphs'
      );
      assert.ok(
        compSrc.includes('return null;'),
        'RevisionRecommendationsSection must return null when no graph nodes exist'
      );
    });

    it('renders editorial header with monospace eyebrow and green marker dot', () => {
      assert.ok(
        compSrc.includes('study-rec-eyebrow'),
        'Must render editorial eyebrow'
      );
      assert.ok(
        compSrc.includes('RECOMMENDED NEXT STEP'),
        'Must render "RECOMMENDED NEXT STEP" kicker'
      );
      assert.ok(
        compSrc.includes('study-rec-dot'),
        'Must render green marker dot in eyebrow'
      );
    });

    it('renders a primary hero recommendation card with crisp typography and distinct category tag', () => {
      assert.ok(
        compSrc.includes('study-rec-hero-card'),
        'Must render hero primary recommendation card'
      );
      assert.ok(
        compSrc.includes('study-rec-category-badge'),
        'Must render category badge'
      );
      assert.ok(
        compSrc.includes('study-rec-concept-title'),
        'Must render concept title'
      );
      assert.ok(
        compSrc.includes('study-rec-explanation'),
        'Must render transparent grounded explanation'
      );
    });

    it('displays concrete evidence snippet pill without vague motivational text', () => {
      assert.ok(
        compSrc.includes('study-rec-evidence-pill'),
        'Must render evidence pill container'
      );
      assert.ok(
        compSrc.includes('study-rec-evidence-label'),
        'Must render EVIDENCE: label'
      );
      assert.ok(
        compSrc.includes('primary.evidenceSnippet'),
        'Must display actual evidence snippet'
      );
    });

    it('renders up to 3 secondary recommendations in a compact sub-grid', () => {
      assert.ok(
        compSrc.includes('study-rec-secondary-list'),
        'Must render secondary recommendations list'
      );
      assert.ok(
        compSrc.includes('OTHER USEFUL ACTIONS'),
        'Must render "OTHER USEFUL ACTIONS" heading'
      );
      assert.ok(
        compSrc.includes('study-rec-secondary-grid'),
        'Must render secondary grid'
      );
      assert.ok(
        compSrc.includes('secondary.map'),
        'Must map secondary recommendations'
      );
    });
  });

  describe('2. User Control & Dismissal Experience', () => {
    it('provides accessible dismiss buttons on primary and secondary recommendation cards', () => {
      assert.ok(
        compSrc.includes('study-rec-dismiss-btn'),
        'Must provide dismiss button on hero card'
      );
      assert.ok(
        compSrc.includes('study-rec-card-dismiss'),
        'Must provide dismiss button on secondary cards'
      );
      assert.ok(
        compSrc.includes('aria-label={`Dismiss recommendation for ${primary.conceptName}`}'),
        'Must have descriptive aria-label on primary dismiss button'
      );
    });

    it('provides restore button when dismissed recommendations exist', () => {
      assert.ok(
        compSrc.includes('study-rec-restore-all-btn'),
        'Must render restore button'
      );
      assert.ok(
        compSrc.includes('handleRestoreAll'),
        'Must wire handleRestoreAll click handler'
      );
      assert.ok(
        compSrc.includes('report.dismissedCount > 0'),
        'Must only display restore button when dismissed items exist'
      );
    });

    it('renders clean fallback card when all recommendations are addressed or demonstrated', () => {
      assert.ok(
        compSrc.includes('study-rec-empty-card'),
        'Must render fallback empty card'
      );
      assert.ok(
        compSrc.includes('All concepts up to date'),
        'Must render calm, positive confirmation'
      );
      assert.ok(
        compSrc.includes('EXPLORE GRAPH'),
        'Must provide explore graph action in empty state'
      );
    });
  });

  describe('3. Functional Action Handlers', () => {
    it('maps recommendation action types to specific navigation handlers', () => {
      assert.ok(
        compSrc.includes('continue-revision'),
        'Must handle continue-revision action type'
      );
      assert.ok(
        compSrc.includes('review-concept'),
        'Must handle review-concept action type'
      );
      assert.ok(
        compSrc.includes('open-foundation'),
        'Must handle open-foundation action type'
      );
      assert.ok(
        compSrc.includes('practice-concept'),
        'Must handle practice-concept action type'
      );
      assert.ok(
        compSrc.includes('explore-graph'),
        'Must handle explore-graph action type'
      );
      assert.ok(
        compSrc.includes('start-concept'),
        'Must handle start-concept action type'
      );
    });

    it('renders editorial action buttons with signature underline and arrow hover transition', () => {
      assert.ok(
        compSrc.includes('study-editorial-btn'),
        'Must use signature study-editorial-btn'
      );
      assert.ok(
        compSrc.includes('study-btn-arrow'),
        'Must include signature arrow indicator'
      );
      assert.ok(
        compSrc.includes('study-btn-underline'),
        'Must include signature underline bar'
      );
    });
  });

  describe('4. Study Space Integration', () => {
    it('imports and integrates RevisionRecommendationsSection in StudySpaceView.tsx', () => {
      assert.ok(
        studySpaceSrc.includes("import { RevisionRecommendationsSection } from './RevisionRecommendationsSection'"),
        'StudySpaceView must import RevisionRecommendationsSection'
      );
      assert.ok(
        studySpaceSrc.includes('<RevisionRecommendationsSection'),
        'StudySpaceView must render RevisionRecommendationsSection'
      );
    });

    it('renders recommendations above KnowledgeGapSection in the populated state', () => {
      const recIndex = studySpaceSrc.indexOf('<RevisionRecommendationsSection');
      const gapIndex = studySpaceSrc.indexOf('<KnowledgeGapSection');
      assert.ok(recIndex !== -1, 'RevisionRecommendationsSection must be present');
      assert.ok(gapIndex !== -1, 'KnowledgeGapSection must be present');
      assert.ok(
        recIndex < gapIndex,
        'RevisionRecommendationsSection must appear before KnowledgeGapSection in StudySpace'
      );
    });

    it('passes navigation callbacks for revision, concept, and graph without mutating active session', () => {
      assert.ok(
        studySpaceSrc.includes('onNavigateToRevision={onNavigateToRevision}'),
        'Must pass onNavigateToRevision'
      );
      assert.ok(
        studySpaceSrc.includes('onNavigateToConcept={onNavigateToConcept}'),
        'Must pass onNavigateToConcept'
      );
      assert.ok(
        studySpaceSrc.includes('onNavigateToGraph={onNavigateToGraph}'),
        'Must pass onNavigateToGraph'
      );
    });
  });

  describe('5. Swiss-Editorial CSS Design System Tokens', () => {
    it('defines Section 16 styling tokens in studySpace.css', () => {
      assert.ok(
        cssSrc.includes('.study-recommendations-section'),
        'Must define .study-recommendations-section in CSS'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card'),
        'Must define .study-rec-hero-card in CSS'
      );
      assert.ok(
        cssSrc.includes('.study-rec-secondary-grid'),
        'Must define .study-rec-secondary-grid in CSS'
      );
      assert.ok(
        cssSrc.includes('.study-rec-dot'),
        'Must define .study-rec-dot green marker'
      );
    });

    it('applies restrained category accent borders without gradients or card overload', () => {
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.continue-learning'),
        'Must style continue-learning border accent'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.review-difficulty'),
        'Must style review-difficulty border accent'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.review-foundation'),
        'Must style review-foundation border accent'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.practice-concept'),
        'Must style practice-concept border accent'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.explore-connection'),
        'Must style explore-connection border accent'
      );
      assert.ok(
        cssSrc.includes('.study-rec-hero-card.start-new'),
        'Must style start-new border accent'
      );
    });

    it('includes responsive breakpoints for tablet and mobile screens', () => {
      assert.ok(
        cssSrc.includes('@media (max-width: 768px)'),
        'Must include responsive styles'
      );
      assert.ok(
        cssSrc.includes('.study-rec-secondary-grid {'),
        'Must adapt secondary grid on mobile'
      );
    });
  });
});
