import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeConceptFoundations,
  invalidatePrerequisiteCache
} from '../src/services/prerequisiteAnalysis';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { RevisionSessionState } from '../src/types/practice';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';
import { saveStoredMastery } from '../src/services/conceptMastery';

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

describe('GraphMind — Prerequisite-Aware Learning (Prompt 17)', () => {
  const sampleGraph: KnowledgeGraph = {
    id: 'graph-prereq-101',
    name: 'Neural Computation',
    nodes: [
      {
        id: 'node-backprop',
        name: 'Backpropagation',
        type: 'concept',
        description: 'Algorithm for calculating gradients of the loss function with respect to weights.',
        prerequisites: ['node-calculus-chain-rule'],
        evidence: 'Requires repeated application of the chain rule from multivariable calculus.'
      },
      {
        id: 'node-calculus-chain-rule',
        name: 'Multivariable Chain Rule',
        type: 'concept',
        description: 'Formula for computing derivatives of composite multivariable functions.',
        evidence: 'Foundational calculus concept.'
      },
      {
        id: 'node-linear-algebra',
        name: 'Matrix Multiplication',
        type: 'foundation',
        description: 'Binary operation that produces a matrix from two matrices.',
        evidence: 'Core linear algebra foundation for neural activations.'
      },
      {
        id: 'node-gradient-descent',
        name: 'Gradient Descent Optimization',
        type: 'concept',
        description: 'First-order iterative optimization algorithm.',
        evidence: 'Directly uses gradients computed by backpropagation.'
      },
      {
        id: 'node-isolated',
        name: 'Isolated Concept',
        type: 'concept',
        description: 'A concept with no prerequisites or edges.'
      }
    ],
    edges: [
      // Explicit prerequisite edge (node-linear-algebra is foundation for node-backprop)
      {
        id: 'edge-1',
        from: 'node-linear-algebra',
        to: 'node-backprop',
        label: 'foundation-for'
      },
      // General related edge (uses / related-to)
      {
        id: 'edge-2',
        from: 'node-backprop',
        to: 'node-gradient-descent',
        label: 'uses'
      }
    ]
  };

  const sampleSession: RevisionSessionState = {
    sessionId: 'session-prereq-1',
    conceptIds: ['node-backprop', 'node-gradient-descent'],
    currentIndex: 0,
    reviewedConceptIds: ['node-backprop'],
    markedForReviewIds: []
  };

  it('identifies confirmed prerequisites from node.prerequisites array', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    assert.ok(report.hasFoundations, 'Report should have foundations');
    const chainRuleRec = report.items.find(i => i.conceptId === 'node-calculus-chain-rule');
    assert.ok(chainRuleRec, 'Chain rule should be identified as a recommendation');
    assert.equal(chainRuleRec.category, 'confirmed-prerequisite');
    assert.equal(chainRuleRec.categoryLabel, 'Confirmed Prerequisite');
    assert.equal(chainRuleRec.provenance, 'explicit-node-prerequisite');
    assert.match(chainRuleRec.whyItHelps, /explicit prerequisite/i);
  });

  it('identifies confirmed prerequisites from edge type foundation-for or prerequisite', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    const linearAlgRec = report.items.find(i => i.conceptId === 'node-linear-algebra');
    assert.ok(linearAlgRec, 'Matrix multiplication should be identified');
    assert.equal(linearAlgRec.category, 'confirmed-prerequisite');
    assert.equal(linearAlgRec.categoryLabel, 'Confirmed Prerequisite');
    assert.equal(linearAlgRec.provenance, 'graph-relationship-edge');
  });

  it('strictly labels general graph edges as related concepts, never as prerequisites', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    const gradDescentRec = report.items.find(i => i.conceptId === 'node-gradient-descent');
    assert.ok(gradDescentRec, 'Gradient descent should be recommended as related');
    assert.equal(gradDescentRec.category, 'related-concept');
    assert.equal(gradDescentRec.categoryLabel, 'Related Concept in Graph');
    assert.notEqual(gradDescentRec.category, 'confirmed-prerequisite');
    assert.match(gradDescentRec.whyItHelps, /directly related/i);
  });

  it('prioritizes confirmed prerequisites above source foundations and related concepts', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    // Both confirmed prerequisites must come before related concepts
    const categories = report.items.map(i => i.category);
    const firstRelatedIndex = categories.indexOf('related-concept');
    const firstPrereqIndex = categories.indexOf('confirmed-prerequisite');

    assert.ok(firstPrereqIndex >= 0, 'Must have confirmed prerequisite');
    assert.ok(firstRelatedIndex > firstPrereqIndex, 'Prerequisites must precede related concepts');
  });

  it('does not invent prerequisites for isolated concepts and returns empty foundations report', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-isolated',
      activeSession: sampleSession,
      forceRefresh: true
    });

    assert.equal(report.hasFoundations, false);
    assert.equal(report.items.length, 0);
    assert.equal(report.summaryText, 'No prerequisite or foundational relationships recorded for this concept.');
  });

  it('marks evidence status as not-assessed when concept has not been assessed', () => {
    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    const chainRuleRec = report.items.find(i => i.conceptId === 'node-calculus-chain-rule')!;
    assert.equal(chainRuleRec.evidenceStatus, 'not-assessed');
    assert.equal(chainRuleRec.evidenceStatusLabel, 'Not assessed yet');
  });

  it('reflects demonstrated difficulty when learner struggles on formative check', () => {
    // Save failing knowledge check for chain rule
    saveStoredKnowledgeCheck({
      graphId: sampleGraph.id,
      conceptId: 'node-calculus-chain-rule',
      status: 'ready',
      questions: [],
      activeQuestionIndex: 0,
      attempts: {
        'q-1': {
          questionId: 'q-1',
          submittedAnswer: 'wrong answer',
          evaluation: {
            isCorrect: false,
            score: 0,
            evaluationConfidence: 'high',
            feedback: 'Incorrect',
            explanation: 'Chain rule derivative requires outer and inner derivatives.',
            correctAnswer: 'dz/dx'
          },
          attemptedAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString()
    });

    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    const chainRuleRec = report.items.find(i => i.conceptId === 'node-calculus-chain-rule')!;
    assert.equal(chainRuleRec.evidenceStatus, 'observed-difficulty');
    assert.equal(chainRuleRec.evidenceStatusLabel, 'Difficulty observed');
    assert.match(chainRuleRec.whyItHelps, /difficulty was recorded/i);
  });

  it('reflects demonstrated understanding when learner mastered the concept', () => {
    // Save mastered state for matrix multiplication
    saveStoredMastery(sampleGraph.id, {
      conceptId: 'node-linear-algebra',
      conceptName: 'Matrix Multiplication',
      status: 'understanding-demonstrated',
      statusLabel: 'Understanding demonstrated',
      attemptCount: 3,
      correctCount: 3,
      incorrectCount: 0,
      consecutiveIncorrectCount: 0,
      evidenceSource: 'knowledge-checks'
    });

    invalidatePrerequisiteCache(sampleGraph.id);
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'node-backprop',
      activeSession: sampleSession,
      forceRefresh: true
    });

    const linearAlgRec = report.items.find(i => i.conceptId === 'node-linear-algebra')!;
    assert.equal(linearAlgRec.evidenceStatus, 'demonstrated');
    assert.equal(linearAlgRec.evidenceStatusLabel, 'Demonstrated understanding');
    assert.equal(linearAlgRec.masteryState?.status, 'understanding-demonstrated');
  });

  it('enforces maximum cap of 5 foundational recommendations to prevent cognitive overload', () => {
    // Construct graph with 8 connected nodes
    const largeGraph: KnowledgeGraph = {
      id: 'graph-large-101',
      name: 'Large Graph',
      nodes: [
        { id: 'target', name: 'Target Concept', type: 'concept' },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `dep-${i}`,
          name: `Prerequisite ${i}`,
          type: 'concept' as const
        }))
      ],
      edges: Array.from({ length: 8 }, (_, i) => ({
        id: `e-${i}`,
        from: `dep-${i}`,
        to: 'target',
        label: 'foundation-for'
      }))
    };

    invalidatePrerequisiteCache(largeGraph.id);
    const report = analyzeConceptFoundations({
      graph: largeGraph,
      conceptId: 'target',
      forceRefresh: true
    });

    assert.ok(report.items.length <= 5, 'Must not exceed 5 items');
    assert.equal(report.items.length, 5);
  });

  it('supports source-supported foundation node type without explicit edge', () => {
    const sourceFoundationGraph: KnowledgeGraph = {
      id: 'graph-found-type',
      name: 'Foundation Type Test',
      nodes: [
        { id: 'root', name: 'Advanced AI', type: 'concept' },
        { id: 'found-node', name: 'Probability Theory', type: 'foundation', evidence: 'Primary foundation' }
      ],
      edges: [
        { id: 'e-rel', from: 'root', to: 'found-node', label: 'relates-to' }
      ]
    };

    invalidatePrerequisiteCache(sourceFoundationGraph.id);
    const report = analyzeConceptFoundations({
      graph: sourceFoundationGraph,
      conceptId: 'root',
      forceRefresh: true
    });

    const foundRec = report.items.find(i => i.conceptId === 'found-node');
    assert.ok(foundRec, 'Found node must be in report');
    assert.equal(foundRec.category, 'source-foundation');
    assert.equal(foundRec.categoryLabel, 'Source-Supported Foundation');
  });

  it('handles invalid or missing target concept gracefully', () => {
    const report = analyzeConceptFoundations({
      graph: sampleGraph,
      conceptId: 'non-existent-node'
    });

    assert.equal(report.hasFoundations, false);
    assert.equal(report.items.length, 0);
  });
});
