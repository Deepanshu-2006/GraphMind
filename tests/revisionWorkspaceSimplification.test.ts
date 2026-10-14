/**
 * tests/revisionWorkspaceSimplification.test.ts
 *
 * Dedicated acceptance tests for:
 * GRAPHMIND — REVISION WORKSPACE SIMPLIFICATION: REMOVE UNNECESSARY REVISION FEATURES
 *
 * Verifies:
 * 1. Session Insights button and standalone summary screen are removed from Revision Workspace.
 * 2. Concepts Overview strip and all its statistics are removed.
 * 3. Potential Foundational Gap warning banner and its associated actions are removed.
 * 4. Foundations & Prerequisites section and all its cards/badges are removed.
 * 5. Related Concepts section remains rendered and functional.
 * 6. Essential revision experience (header, counter, explanation, knowledge checks, source references, navigation) remains intact.
 * 7. Revision session state and graph callbacks are preserved.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import type { RevisionSessionState } from '../src/types/practice';
import type { ConceptExplanation } from '../src/types/explanation';
import type { ConceptKnowledgeCheckState } from '../src/types/knowledgeCheck';
import { saveStoredExplanation } from '../src/services/conceptExplanation';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';
import fs from 'node:fs';
import path from 'node:path';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; },
    key: (index: number) => Array.from(storageMap.keys())[index] || null
  };
}

const mockNode1: KnowledgeNode = {
  id: 'c1',
  name: 'Qubits and Superposition',
  type: 'concept',
  description: 'Fundamental units of quantum information capable of existing in linear combinations.',
  sourceIds: ['source-1'],
  evidence: 'Section 1.1: State vectors and linear operators in finite-dimensional Hilbert space.',
  keyIdeas: [
    'State vectors belong to a two-dimensional Hilbert space.',
    'Superposition collapses upon measurement according to Born rule probabilities.'
  ]
};

const mockNode2: KnowledgeNode = {
  id: 'c2',
  name: 'Quantum Entanglement',
  type: 'concept',
  description: 'Non-classical correlations between quantum states.',
  sourceIds: ['source-1']
};

const mockNode3: KnowledgeNode = {
  id: 'c3',
  name: 'Quantum Gates and Circuits',
  type: 'concept',
  description: 'Unitary transformations applied to quantum registers.',
  sourceIds: ['source-1']
};

const mockRel1: KnowledgeRelationship = {
  id: 'rel-1',
  source: 'c1',
  target: 'c2',
  relationType: 'related-to',
  description: 'entangles into'
};

const mockRel2: KnowledgeRelationship = {
  id: 'rel-2',
  source: 'c1',
  target: 'c3',
  relationType: 'prerequisite',
  description: 'manipulated by'
};

const mockGraph: KnowledgeGraph = {
  id: 'graph-test-simp-01',
  name: 'Quantum Computing Fundamentals',
  nodes: [mockNode1, mockNode2, mockNode3],
  relationships: [mockRel1, mockRel2],
  sources: [
    {
      id: 'source-1',
      title: 'Quantum Mechanics Textbook',
      type: 'document'
    }
  ]
};

const mockSession: RevisionSessionState = {
  isActive: true,
  graphId: 'graph-test-simp-01',
  conceptIds: ['c1', 'c2', 'c3'],
  currentIndex: 0,
  currentConceptId: 'c1',
  totalConcepts: 3,
  createdAt: '2026-10-14T00:00:00.000Z',
  reviewedConceptIds: ['c1'],
  markedForReviewIds: []
};

const mockExplanation: ConceptExplanation = {
  graphId: 'graph-test-simp-01',
  conceptId: 'c1',
  conceptName: 'Qubits and Superposition',
  overview: 'A qubit is the basic unit of quantum information, analogous to the classical bit.',
  detailedExplanation: [
    'Unlike classical bits that are strictly 0 or 1, qubits exist in linear combinations of orthonormal basis states |0⟩ and |1⟩.'
  ],
  howItWorks: [
    'A state vector evolves under unitary operators preserving normalization.'
  ],
  keyTerminology: [
    {
      term: 'Bloch Sphere',
      definition: 'Geometric representation of pure qubit states on the surface of a unit sphere.'
    }
  ],
  importantPoints: [
    'State vectors belong to a two-dimensional Hilbert space.',
    'Superposition collapses upon measurement according to Born rule probabilities.'
  ],
  relatedConceptReferences: [
    {
      conceptId: 'c2',
      conceptName: 'Quantum Entanglement',
      relationshipType: 'related-to',
      context: 'Superposition enables entangled multi-qubit states.'
    }
  ],
  sourceReferences: [
    {
      sourceId: 'source-1',
      sourceTitle: 'Quantum Mechanics Textbook',
      excerpt: 'Section 1.1: State vectors and linear operators in finite-dimensional Hilbert space.'
    }
  ],
  isSourceGrounded: true,
  groundingConfidence: 'high',
  generatedAt: new Date().toISOString()
};

const mockKnowledgeCheckState: ConceptKnowledgeCheckState = {
  graphId: 'graph-test-simp-01',
  conceptId: 'c1',
  questions: [
    {
      id: 'q1',
      graphId: 'graph-test-simp-01',
      conceptId: 'c1',
      conceptName: 'Qubits and Superposition',
      type: 'multiple-choice',
      prompt: 'What mathematical construct describes a pure qubit state?',
      options: [
        { id: 'opt-01', text: 'A two-dimensional complex Hilbert space vector' },
        { id: 'opt-02', text: 'A classical probability scalar' }
      ],
      correctOptionId: 'opt-01',
      correctAnswer: 'A two-dimensional complex Hilbert space vector',
      explanation: 'Qubit state vectors reside in a 2D complex vector space.',
      sourceTitle: 'Quantum Mechanics Textbook'
    }
  ],
  attempts: {},
  activeQuestionIndex: 0,
  status: 'ready',
  updatedAt: new Date().toISOString()
};

describe('Revision Workspace Simplification — Acceptance Criteria', () => {
  beforeEach(() => {
    storageMap.clear();
    saveStoredExplanation(mockExplanation);
    saveStoredKnowledgeCheck(mockKnowledgeCheckState);
  });

  const renderWorkspace = (propsOverrides = {}) => {
    return renderToString(
      React.createElement(RevisionWorkspace, {
        graph: mockGraph,
        graphName: 'Quantum Computing Fundamentals',
        session: mockSession,
        initialConceptId: 'c1',
        onBackToGraph: () => {},
        skipEntryAnimation: true,
        ...propsOverrides
      })
    );
  };

  /* ====================================================================
   * CRITERION 1 & 2: REMOVAL OF SESSION INSIGHTS
   * ==================================================================== */
  describe('1. Session Insights Removal', () => {
    test('Session insights button is not rendered in Revision Workspace header', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Session insights'),
        false,
        'Header should not have "Session insights" button'
      );
      assert.strictEqual(
        html.includes('revision-insights-trigger'),
        false,
        'revision-insights-trigger class should not exist in DOM'
      );
    });

    test('Standalone session insights container is not present in the DOM', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('revision-session-insights'),
        false,
        'revision-session-insights container must not be rendered'
      );
      assert.strictEqual(
        html.includes('SESSION INSIGHTS'),
        false,
        'SESSION INSIGHTS heading must not be rendered'
      );
    });
  });

  /* ====================================================================
   * CRITERION 3: REMOVAL OF CONCEPTS OVERVIEW
   * ==================================================================== */
  describe('2. Concepts Overview Strip & Statistics Removal', () => {
    test('Concepts overview strip is not rendered above concept content', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('CONCEPTS OVERVIEW'),
        false,
        'CONCEPTS OVERVIEW banner must not be rendered'
      );
      assert.strictEqual(
        html.includes('revision-overview-toggle-bar'),
        false,
        'revision-overview-toggle-bar container must not be rendered'
      );
    });

    test('Concepts overview statistics (demonstrated, needing review, gaps) are removed', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Concepts demonstrated'),
        false,
        'Metrics for demonstrated concepts must not be present'
      );
      assert.strictEqual(
        html.includes('Concepts needing review'),
        false,
        'Metrics for concepts needing review must not be present'
      );
      assert.strictEqual(
        html.includes('Flagged knowledge gaps'),
        false,
        'Metrics for flagged knowledge gaps must not be present'
      );
      assert.strictEqual(
        html.includes('View concepts'),
        false,
        'View concepts drawer control must not be present'
      );
      assert.strictEqual(
        html.includes('revision-concept-overview-drawer'),
        false,
        'Overview drawer must not be present in workspace'
      );
    });
  });

  /* ====================================================================
   * CRITERION 4: REMOVAL OF POTENTIAL KNOWLEDGE GAP WARNING
   * ==================================================================== */
  describe('3. Potential Knowledge Gap Warning Removal', () => {
    test('Potential gap warning banner is completely absent from concept content', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('revision-gap-banner'),
        false,
        'revision-gap-banner must not exist'
      );
      assert.strictEqual(
        html.includes('POTENTIAL FOUNDATIONAL GAP'),
        false,
        'POTENTIAL FOUNDATIONAL GAP warning title must not exist'
      );
      assert.strictEqual(
        html.includes('revision-gap-badge'),
        false,
        'revision-gap-badge must not exist'
      );
      assert.strictEqual(
        html.includes('Dismiss gap warning'),
        false,
        'Dismiss gap warning action must not exist'
      );
    });
  });

  /* ====================================================================
   * CRITERION 5: REMOVAL OF FOUNDATIONS & PREREQUISITES
   * ==================================================================== */
  describe('4. Foundations & Prerequisites Removal', () => {
    test('Entire Foundations & Prerequisites section is absent from DOM', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('FOUNDATIONS / REQUISITE CONCEPTS'),
        false,
        'FOUNDATIONS / REQUISITE CONCEPTS section heading must not exist'
      );
      assert.strictEqual(
        html.includes('section-foundations'),
        false,
        'section-foundations section element must not exist'
      );
      assert.strictEqual(
        html.includes('CONFIRMED PREREQUISITE'),
        false,
        'CONFIRMED PREREQUISITE badges must not exist'
      );
      assert.strictEqual(
        html.includes('WHY THIS HELPS'),
        false,
        'WHY THIS HELPS explanation panels must not exist'
      );
      assert.strictEqual(
        html.includes('Review foundation'),
        false,
        'Review foundation buttons must not exist'
      );
    });
  });

  /* ====================================================================
   * CRITERION 6: RETENTION OF RELATED CONCEPTS SECTION
   * ==================================================================== */
  describe('5. Related Concepts Section Retention', () => {
    test('Related concepts section is preserved and functional', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Related concepts'),
        true,
        'Related concepts section title must be rendered'
      );
      assert.strictEqual(
        html.includes('Quantum Entanglement'),
        true,
        'Connected related concept label must be rendered'
      );
      assert.strictEqual(
        html.includes('Inspect'),
        true,
        'Inspect preview button must be rendered'
      );
      assert.strictEqual(
        html.includes('Explore in graph'),
        true,
        'Explore in graph button must be rendered'
      );
    });
  });

  /* ====================================================================
   * CRITERION 7: ESSENTIAL REVISION EXPERIENCE INTACT
   * ==================================================================== */
  describe('6. Essential Revision Experience Intact', () => {
    test('Revision header contains graph name, View graph, and Back to graph', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Quantum Computing Fundamentals'),
        true,
        'Graph name is rendered in header'
      );
      assert.strictEqual(
        html.includes('Back to graph'),
        true,
        'Back to graph button is present'
      );
      assert.strictEqual(
        html.includes('View graph'),
        true,
        'View graph header action is present'
      );
    });

    test('Revision progress indicators show position and progress sequence', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('01 / 03') || html.includes('01'),
        true,
        'Current concept position counter is displayed'
      );
      assert.strictEqual(
        html.includes('revision-progress-fill'),
        true,
        'Progress bar fill indicator is displayed'
      );
    });

    test('Concept explanation sections are rendered cleanly', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Qubits and Superposition'),
        true,
        'Concept title is displayed'
      );
      assert.strictEqual(
        html.includes('Understanding the concept'),
        true,
        'Understanding the concept section is displayed'
      );
      assert.strictEqual(
        html.includes('A qubit is the basic unit of quantum information'),
        true,
        'Concept explanation overview text is displayed'
      );
      assert.strictEqual(
        html.includes('Important Points') || html.includes('Important details'),
        true,
        'Important points section is displayed'
      );
      assert.strictEqual(
        html.includes('Terminology') || html.includes('Bloch Sphere'),
        true,
        'Terminology section is displayed'
      );
    });

    test('Knowledge checks are rendered with questions and interactive options', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('revision-section-knowledge-check'),
        true,
        'Knowledge check container is displayed'
      );
      assert.strictEqual(
        html.includes('What mathematical construct describes a pure qubit state?'),
        true,
        'Question prompt is displayed'
      );
      assert.strictEqual(
        html.includes('A two-dimensional complex Hilbert space vector'),
        true,
        'Answer option is displayed'
      );
      assert.strictEqual(
        html.includes('Check understanding') || html.includes('revision-kc-submit-btn'),
        true,
        'Submit answer button is present'
      );
    });

    test('Source references are rendered with citations', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('SOURCE GROUNDING') || html.includes('Sources') || html.includes('Quantum Mechanics Textbook'),
        true,
        'Source citation title is displayed'
      );
    });

    test('Previous and Next concept navigation controls are present', () => {
      const html = renderWorkspace();
      assert.strictEqual(
        html.includes('Previous concept'),
        true,
        'Previous concept button is rendered'
      );
      assert.strictEqual(
        html.includes('Next concept'),
        true,
        'Next concept button is rendered'
      );
    });

    test('Last concept in sequence renders Complete session without redirecting to insights', () => {
      const lastConceptSession: RevisionSessionState = {
        ...mockSession,
        currentIndex: 2, // at 'c3' out of 3 concepts
        currentConceptId: 'c3'
      };
      const html = renderWorkspace({ session: lastConceptSession, initialConceptId: 'c3' });
      assert.strictEqual(
        html.includes('Complete session'),
        true,
        'Complete session button is rendered on final concept'
      );
      assert.strictEqual(
        html.includes('Session insights'),
        false,
        'Does not display session insights prompt'
      );
    });
  });

  /* ====================================================================
   * CRITERION 8: CODEBASE CLEANLINESS
   * ==================================================================== */
  describe('7. Source Code Architecture & Cleanliness', () => {
    test('RevisionWorkspace.tsx does not import deleted widgets or gap detection', () => {
      const sourceCode = fs.readFileSync(
        path.join(process.cwd(), 'src/components/revision/RevisionWorkspace.tsx'),
        'utf-8'
      );

      assert.strictEqual(
        sourceCode.includes("import { RevisionSessionInsights }"),
        false,
        'RevisionSessionInsights should not be imported'
      );
      assert.strictEqual(
        sourceCode.includes("import { RevisionConceptOverview }"),
        false,
        'RevisionConceptOverview should not be imported'
      );
      assert.strictEqual(
        sourceCode.includes("import { FoundationsSection }"),
        false,
        'FoundationsSection should not be imported'
      );
      assert.strictEqual(
        sourceCode.includes("detectKnowledgeGaps"),
        false,
        'detectKnowledgeGaps should not be called in RevisionWorkspace'
      );
      assert.strictEqual(
        sourceCode.includes("foundationalExcursion"),
        false,
        'foundationalExcursion state should not be present'
      );
    });
  });
});
