import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateActiveRecallTestSession,
  getIntelligentDistractors
} from '../src/services/practiceQuestionGenerator';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import type { Concept, Node, Edge, GraphConceptData } from '../src/types';

describe('TEST MODE STABILITY & BLACK SCREEN REGRESSION FIXES', () => {
  const sampleNodes: Node<GraphConceptData>[] = [
    {
      id: 'c-ml',
      position: { x: 100, y: 100 },
      data: {
        id: 'c-ml',
        label: 'Machine Learning',
        name: 'Machine Learning',
        category: 'Concept',
        description: 'A method of data analysis that automates analytical model building.',
        sources: [{ id: 'src-1', name: 'AI Handbook', page: 12 }],
        relationships: [
          {
            id: 'r1',
            type: 'subfield-of',
            targetId: 'c-ai',
            targetName: 'Artificial Intelligence',
            direction: 'outgoing',
            description: 'Machine Learning is a subset of Artificial Intelligence'
          }
        ]
      }
    },
    {
      id: 'c-ai',
      position: { x: 300, y: 100 },
      data: {
        id: 'c-ai',
        label: 'Artificial Intelligence',
        name: 'Artificial Intelligence',
        category: 'Field',
        description: 'Simulation of human intelligence by software and machines.',
        sources: [{ id: 'src-1', name: 'AI Handbook', page: 10 }],
        relationships: [
          {
            id: 'r1',
            type: 'subfield-of',
            targetId: 'c-ml',
            targetName: 'Machine Learning',
            direction: 'incoming',
            description: 'Machine Learning is a subset of Artificial Intelligence'
          }
        ]
      }
    }
  ];

  const sampleEdges: Edge[] = [
    {
      id: 'e1',
      source: 'c-ml',
      target: 'c-ai',
      data: {
        id: 'r1',
        label: 'subfield of',
        sourceId: 'c-ml',
        targetId: 'c-ai'
      }
    }
  ];

  it('generates active recall test session safely from question context without throwing', () => {
    const allGraphConcepts = sampleNodes.map(n => ({
      id: n.id,
      name: n.data.name || n.data.label,
      category: n.data.category,
      description: n.data.description
    }));

    const session = generateActiveRecallTestSession(
      {
        conceptId: 'c-ml',
        conceptName: 'Machine Learning',
        category: 'Concept',
        description: 'A method of data analysis that automates analytical model building.',
        relationships: sampleNodes[0].data.relationships,
        allGraphConcepts
      },
      allGraphConcepts
    );

    assert.ok(session, 'Test session should be created');
    assert.ok(session.questions.length > 0, 'Should generate questions');
    const firstQ = session.questions[0];
    assert.ok(firstQ.id, 'Question should have a stable ID');
    assert.ok(firstQ.options.length >= 2, 'Question should have answer options');
  });

  it('handles empty or minimal concepts gracefully without throwing', () => {
    const minimalConcept: Concept = {
      id: 'c-isolated',
      name: 'Isolated Term',
      category: 'Concept',
      description: 'A short description of an isolated concept.',
      isCore: false
    };

    const session = generateActiveRecallTestSession(minimalConcept, [minimalConcept]);
    // May return null or a session, but must not throw uncaught error
    if (session) {
      assert.ok(Array.isArray(session.questions));
    } else {
      assert.strictEqual(session, null);
    }
  });

  it('calculateVisibleGraph maintains visible graph during test mode and prevents blackout', () => {
    const result = calculateVisibleGraph({
      allNodes: sampleNodes,
      allEdges: sampleEdges,
      selectedNodeId: 'c-ml',
      densityMode: 'balanced',
      zoomLevel: 'standard',
      studyFilterMode: 'all',
      practiceStates: {},
      recalledConceptIds: new Set(),
      reviewConceptIds: new Set(),
      isRevisionMode: false,
      revisionCurrentConceptId: null,
      revisionVisitedConceptIds: new Set()
    });

    assert.ok(result.visibleNodes.length > 0, 'Visible nodes should not be empty');
    assert.ok(result.visibleEdges.length > 0, 'Visible edges should not be empty');
    assert.ok(result.visibleNodes.some(n => n.id === 'c-ml'), 'Tested node should be in visible graph');
  });

  it('intelligent distractors do not duplicate correct target concept', () => {
    const allConcepts = [
      { id: '1', name: 'Deep Learning' },
      { id: '2', name: 'Neural Networks' },
      { id: '3', name: 'Linear Regression' },
      { id: '4', name: 'Supervised Learning' }
    ];

    const distractors = getIntelligentDistractors('1', 'Deep Learning', allConcepts, undefined, undefined, 3);
    assert.strictEqual(distractors.some(d => d.id === '1'), false, 'Target should not be in distractors');
    assert.strictEqual(distractors.length, 3, 'Should return exactly 3 distractors');
  });
});
