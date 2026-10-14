import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GraphMind Unified Learning Overview UI Integration (Phase 4 — Prompt 19)', () => {
  const studySpacePath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const compPath = path.resolve(process.cwd(), 'src/components/study/UnifiedLearningOverview.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');

  const studySpaceSrc = fs.readFileSync(studySpacePath, 'utf-8');
  const compSrc = fs.readFileSync(compPath, 'utf-8');
  const cssSrc = fs.readFileSync(cssPath, 'utf-8');

  describe('1. StudySpaceView Architecture & Section Placement', () => {
    it('imports UnifiedLearningOverview into StudySpaceView.tsx', () => {
      assert.ok(
        studySpaceSrc.includes("import { UnifiedLearningOverview } from './UnifiedLearningOverview'"),
        'StudySpaceView must import UnifiedLearningOverview'
      );
    });

    it('renders UnifiedLearningOverview prominently below header and loading state', () => {
      assert.ok(
        studySpaceSrc.includes('<UnifiedLearningOverview'),
        'StudySpaceView must render <UnifiedLearningOverview'
      );

      const overviewIndex = studySpaceSrc.indexOf('<UnifiedLearningOverview');
      const continueIndex = studySpaceSrc.indexOf('className="study-continue-section"');
      const recIndex = studySpaceSrc.indexOf('<RevisionRecommendationsSection');
      const gapIndex = studySpaceSrc.indexOf('<KnowledgeGapSection');

      assert.ok(overviewIndex !== -1, 'UnifiedLearningOverview must be present');
      assert.ok(continueIndex !== -1, 'Continue Learning section must be present');
      assert.ok(recIndex !== -1, 'RevisionRecommendationsSection must be present');
      assert.ok(gapIndex !== -1, 'KnowledgeGapSection must be present');

      assert.ok(
        overviewIndex < continueIndex,
        'UnifiedLearningOverview must appear before Continue Learning section'
      );
      assert.ok(
        recIndex < gapIndex,
        'RevisionRecommendationsSection must appear before KnowledgeGapSection'
      );
    });

    it('passes functional navigation callbacks and graph context to UnifiedLearningOverview', () => {
      assert.ok(
        studySpaceSrc.includes('graph={(currentKnowledgeGraph || activeGraph)!}'),
        'Must pass graph to UnifiedLearningOverview'
      );
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

    it('preserves existing performance visualizations, trajectory chart, and attempt history', () => {
      assert.ok(
        studySpaceSrc.includes('study-continue-circle-arc'),
        'Must preserve CircularScore SVG arc'
      );
      assert.ok(
        studySpaceSrc.includes('study-continue-circle-endpoint'),
        'Must preserve CircularScore endpoint pip'
      );
      assert.ok(
        studySpaceSrc.includes('study-trajectory-section'),
        'Must preserve Assessment Trajectory section'
      );
      assert.ok(
        studySpaceSrc.includes('study-history-section'),
        'Must preserve Assessment History records section'
      );
    });
  });

  describe('2. UnifiedLearningOverview Component Design & Structure', () => {
    it('renders editorial header with uppercase graph name and green dot indicator', () => {
      assert.ok(
        compSrc.includes('unified-overview-header'),
        'Must render overview header'
      );
      assert.ok(
        compSrc.includes('unified-overview-eyebrow'),
        'Must render overview eyebrow'
      );
      assert.ok(
        compSrc.includes('unified-overview-dot'),
        'Must render green dot indicator'
      );
      assert.ok(
        compSrc.includes('LEARNING OVERVIEW ·'),
        'Must render uppercase LEARNING OVERVIEW label'
      );
      assert.ok(
        compSrc.includes('Your active learning state'),
        'Must render editorial heading'
      );
    });

    it('displays session paused pill when an unfinished revision session is present', () => {
      assert.ok(
        compSrc.includes('overview.hasUnfinishedSession'),
        'Must inspect hasUnfinishedSession'
      );
      assert.ok(
        compSrc.includes('unified-overview-session-pill'),
        'Must render unified-overview-session-pill container'
      );
      assert.ok(
        compSrc.includes('Session paused:'),
        'Must label session as paused'
      );
    });

    it('renders four-metric concept understanding ledger strip', () => {
      assert.ok(
        compSrc.includes('unified-overview-ledger'),
        'Must render unified-overview-ledger region'
      );
      assert.ok(
        compSrc.includes('ledger-metric demonstrated'),
        'Must render demonstrated count metric'
      );
      assert.ok(
        compSrc.includes('ledger-metric review'),
        'Must render review count metric'
      );
      assert.ok(
        compSrc.includes('ledger-metric progress'),
        'Must render in-progress count metric'
      );
      assert.ok(
        compSrc.includes('ledger-metric unstudied'),
        'Must render unstudied count metric'
      );
      assert.ok(
        compSrc.includes('ledger-summary-ratio'),
        'Must render demonstrated percentage and ratio'
      );
      assert.ok(
        compSrc.includes('Activity:'),
        'Must distinguish activity from demonstrated understanding'
      );
    });

    it('renders hero card for the primary recommended next step', () => {
      assert.ok(
        compSrc.includes('unified-overview-hero-card'),
        'Must render hero card'
      );
      assert.ok(
        compSrc.includes('RECOMMENDED NEXT STEP'),
        'Must label section RECOMMENDED NEXT STEP'
      );
      assert.ok(
        compSrc.includes('overview-category-badge'),
        'Must render category badge'
      );
      assert.ok(
        compSrc.includes('overview-priority-tag'),
        'Must render TOP PRIORITY tag for top actions'
      );
      assert.ok(
        compSrc.includes('overview-concept-title'),
        'Must render concept title'
      );
      assert.ok(
        compSrc.includes('overview-explanation'),
        'Must render grounded explanation'
      );
      assert.ok(
        compSrc.includes('overview-evidence-pill'),
        'Must render recorded evidence pill'
      );
    });

    it('renders compact section for concepts requiring attention', () => {
      assert.ok(
        compSrc.includes('unified-overview-attention-wrap'),
        'Must render attention wrap container'
      );
      assert.ok(
        compSrc.includes('CONCEPTS REQUIRING ATTENTION'),
        'Must label section CONCEPTS REQUIRING ATTENTION'
      );
      assert.ok(
        compSrc.includes('overview-attention-list'),
        'Must render attention items list'
      );
      assert.ok(
        compSrc.includes('attention-status-pill'),
        'Must render status pill'
      );
      assert.ok(
        compSrc.includes('attention-reason'),
        'Must render reason description'
      );
      assert.ok(
        compSrc.includes('overview-attention-clean'),
        'Must render clean state when no concepts need review'
      );
    });

    it('uses functional editorial action buttons with underline and hover indicator', () => {
      assert.ok(
        compSrc.includes('study-editorial-btn'),
        'Must use signature study-editorial-btn'
      );
      assert.ok(
        compSrc.includes('study-btn-arrow'),
        'Must include arrow icon'
      );
      assert.ok(
        compSrc.includes('study-btn-underline'),
        'Must include underline bar'
      );
      assert.ok(
        compSrc.includes('handleActionClick'),
        'Must handle action click events'
      );
    });
  });

  describe('3. Swiss-Editorial Design System & Accessibility', () => {
    it('defines Section 17 tokens in studySpace.css', () => {
      assert.ok(
        cssSrc.includes('.unified-overview-section'),
        'Must define .unified-overview-section in CSS'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-ledger'),
        'Must define .unified-overview-ledger in CSS'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card'),
        'Must define .unified-overview-hero-card in CSS'
      );
      assert.ok(
        cssSrc.includes('.overview-attention-row'),
        'Must define .overview-attention-row in CSS'
      );
      assert.ok(
        cssSrc.includes('.overview-attention-clean'),
        'Must define .overview-attention-clean in CSS'
      );
    });

    it('applies category accent borders without flashy gradients', () => {
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card.continue-learning'),
        'Must style continue-learning border'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card.review-difficulty'),
        'Must style review-difficulty border'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card.review-foundation'),
        'Must style review-foundation border'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card.practice-concept'),
        'Must style practice-concept border'
      );
    });

    it('implements responsive rules for smaller screens', () => {
      assert.ok(
        cssSrc.includes('@media (max-width: 768px)'),
        'Must include responsive styles'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-ledger {'),
        'Must adapt ledger on mobile screens'
      );
      assert.ok(
        cssSrc.includes('.overview-attention-row {'),
        'Must adapt attention row on mobile screens'
      );
    });

    it('supports prefers-reduced-motion for all unified overview components', () => {
      assert.ok(
        cssSrc.includes('@media (prefers-reduced-motion: reduce)'),
        'Must define prefers-reduced-motion media query'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-section'),
        'Must disable motion for unified-overview-section'
      );
      assert.ok(
        cssSrc.includes('.unified-overview-hero-card'),
        'Must disable motion for unified-overview-hero-card'
      );
      assert.ok(
        cssSrc.includes('.overview-attention-row'),
        'Must disable motion for overview-attention-row'
      );
    });
  });
});
