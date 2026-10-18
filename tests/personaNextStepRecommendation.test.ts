import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getPersonaNextStepRecommendation } from '../src/services/personaRecommendation';
import {
  saveGraphs,
  saveGraphData,
  saveRevisionSession,
  clearAllUserData,
  updateConceptPracticeState
} from '../src/services/storage';
import {
  saveAssessmentAttempt,
  clearAssessmentHistory
} from '../src/services/assessmentHistory';
import { clearCurrentUser } from '../src/services/auth';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { PersonaStatsData } from '../src/types/personaStats';
import type { RevisionSessionState } from '../src/types/practice';
import type { AssessmentAttempt } from '../src/types/test';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
  get length() { return storageMap.size; }
};

describe('GRAPHMIND — CONTEXTUAL NEXT-STEP RECOMMENDATION (personaRecommendation)', () => {
  beforeEach(() => {
    storageMap.clear();
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  // =========================================================================
  // 1. PRIORITY 1: UNFINISHED REVISION SESSION
  // =========================================================================
  describe('Priority 1: Unfinished Revision Session', () => {
    it('recommends resuming an unfinished revision session when active in stats', () => {
      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: 85,
          totalCompletedAttempts: 2,
          recentAssessments: [],
          activeRevisionProgress: {
            graphId: 'graph-neuro',
            graphName: 'Neuroscience Basics',
            reviewedCount: 3,
            totalConcepts: 10,
            progressPercent: 30,
            currentConceptName: 'Synapse'
          },
          conceptsNeedingRevisionCount: 2,
          conceptsNeedingRevisionExamples: ['Action Potential', 'Dopamine']
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        hasExistingResumeAction: false
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'resume-revision');
      assert.strictEqual(recommendation.destination, 'revision');
      assert.strictEqual(recommendation.graphId, 'graph-neuro');
      assert.strictEqual(recommendation.graphName, 'Neuroscience Basics');
      assert.strictEqual(recommendation.actionLabel, 'Resume session');
      assert.strictEqual(recommendation.title, 'Resume revision in Neuroscience Basics');
      assert.strictEqual(recommendation.description, '7 concepts remain to complete this session.');
    });

    it('recommends resuming an unfinished revision session found in storage when stats active session is null', () => {
      const graph: KnowledgeGraphMeta = {
        id: 'graph-algo',
        name: 'Algorithms',
        conceptCount: 4,
        connectionCount: 3,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };
      saveGraphs([graph]);

      const session: RevisionSessionState = {
        graphId: 'graph-algo',
        isActive: true,
        conceptIds: ['c1', 'c2', 'c3', 'c4'],
        reviewedConceptIds: ['c1'],
        currentIndex: 1,
        totalConcepts: 4,
        startedAt: '2026-10-10T12:00:00Z'
      };
      saveRevisionSession(session);

      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: null,
          totalCompletedAttempts: 0,
          recentAssessments: [],
          activeRevisionProgress: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [graph]
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'resume-revision');
      assert.strictEqual(recommendation.graphId, 'graph-algo');
      assert.strictEqual(recommendation.graphName, 'Algorithms');
      assert.strictEqual(recommendation.actionLabel, 'Resume session');
      assert.strictEqual(recommendation.description, '3 concepts remain to complete this session.');
    });
  });

  // =========================================================================
  // 2. ANTI-DUPLICATION RULE FOR RESUME ACTION
  // =========================================================================
  describe('Anti-Duplication Rule for Resume Action', () => {
    it('skips resume-revision and falls through to Priority 2 when Resume action is already clearly available elsewhere', () => {
      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: 90,
          totalCompletedAttempts: 3,
          recentAssessments: [],
          activeRevisionProgress: {
            graphId: 'graph-neuro',
            graphName: 'Neuroscience Basics',
            reviewedCount: 5,
            totalConcepts: 10,
            progressPercent: 50,
            currentConceptName: 'Synapse'
          },
          conceptsNeedingRevisionCount: 2,
          conceptsNeedingRevisionExamples: ['Action Potential', 'Dopamine']
        }
      };

      // hasExistingResumeAction is true because the right panel displays the active revision session with Resume button
      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        hasExistingResumeAction: true
      });

      assert.ok(recommendation);
      assert.notStrictEqual(recommendation.type, 'resume-revision');
      assert.strictEqual(recommendation.type, 'review-concepts');
      assert.strictEqual(recommendation.actionLabel, 'Review concepts');
      assert.strictEqual(recommendation.destination, 'revision');
      assert.strictEqual(recommendation.title, 'Review Action Potential');
      assert.strictEqual(recommendation.conceptName, 'Action Potential');
    });

    it('falls through to Priority 3 when Resume action is available elsewhere and no concepts need revision', () => {
      const graph: KnowledgeGraphMeta = {
        id: 'graph-quantum',
        name: 'Quantum Physics',
        conceptCount: 5,
        connectionCount: 4,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };

      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: null,
          totalCompletedAttempts: 0,
          recentAssessments: [],
          activeRevisionProgress: {
            graphId: 'graph-quantum',
            graphName: 'Quantum Physics',
            reviewedCount: 2,
            totalConcepts: 5,
            progressPercent: 40,
            currentConceptName: null
          },
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [graph],
        hasExistingResumeAction: true
      });

      assert.ok(recommendation);
      // Priority 1 was skipped to prevent duplicate resume button; Priority 2 had 0 concepts; Priority 3 applies:
      assert.strictEqual(recommendation.type, 'take-assessment');
      assert.strictEqual(recommendation.destination, 'graph');
      assert.strictEqual(recommendation.graphId, 'graph-quantum');
      assert.strictEqual(recommendation.title, 'Assess Quantum Physics');
      assert.strictEqual(recommendation.actionLabel, 'Start assessment');
    });
  });

  // =========================================================================
  // 3. PRIORITY 2: CONCEPTS REQUIRING ATTENTION
  // =========================================================================
  describe('Priority 2: Concepts Requiring Attention', () => {
    it('recommends reviewing concepts when no unfinished revision session exists', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-math',
        name: 'Discrete Math',
        conceptCount: 6,
        connectionCount: 4,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };
      const graphData: KnowledgeGraph = {
        id: 'graph-math',
        name: 'Discrete Math',
        nodes: [
          { id: 'c1', name: 'Graph Theory', summary: 'Nodes & edges' },
          { id: 'c2', name: 'Combinatorics', summary: 'Permutations' }
        ],
        connections: []
      };
      saveGraphs([graphMeta]);
      saveGraphData(graphMeta.id, graphData);

      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: 78,
          totalCompletedAttempts: 1,
          recentAssessments: [{
            id: 'attempt-1',
            graphId: 'graph-math',
            graphName: 'Discrete Math',
            scorePercentage: 78,
            completedAt: '2026-10-12T10:00:00Z'
          }],
          activeRevisionProgress: null,
          conceptsNeedingRevisionCount: 1,
          conceptsNeedingRevisionExamples: ['Combinatorics']
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [graphMeta]
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'review-concepts');
      assert.strictEqual(recommendation.destination, 'revision');
      assert.strictEqual(recommendation.conceptName, 'Combinatorics');
      assert.strictEqual(recommendation.title, 'Review Combinatorics');
      assert.strictEqual(recommendation.description, '1 concept requires review in Discrete Math.');
      assert.strictEqual(recommendation.actionLabel, 'Review concepts');
      assert.strictEqual(recommendation.graphId, 'graph-math');
    });

    it('detects concepts needing review from storage fallback when stats conceptsNeedingRevisionCount is 0', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-chem',
        name: 'Organic Chemistry',
        conceptCount: 3,
        connectionCount: 2,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };
      const graphData: KnowledgeGraph = {
        id: 'graph-chem',
        name: 'Organic Chemistry',
        nodes: [
          { id: 'chem-1', name: 'Stereochemistry', summary: 'Chirality' }
        ],
        connections: []
      };
      saveGraphs([graphMeta]);
      saveGraphData(graphMeta.id, graphData);
      updateConceptPracticeState('chem-1', 'needs-review', 'graph-chem');

      const recommendation = getPersonaNextStepRecommendation(null, {
        graphs: [graphMeta]
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'review-concepts');
      assert.strictEqual(recommendation.conceptName, 'Stereochemistry');
      assert.strictEqual(recommendation.title, 'Review Stereochemistry');
      assert.strictEqual(recommendation.graphName, 'Organic Chemistry');
    });
  });

  // =========================================================================
  // 4. PRIORITY 3: UNASSESSED GRAPH
  // =========================================================================
  describe('Priority 3: Unassessed Graph', () => {
    it('recommends taking an assessment for the unassessed graph', () => {
      const graph1: KnowledgeGraphMeta = {
        id: 'g-assessed',
        name: 'Assessed Subject',
        conceptCount: 4,
        connectionCount: 3,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };
      const graph2: KnowledgeGraphMeta = {
        id: 'g-unassessed',
        name: 'Machine Learning',
        conceptCount: 8,
        connectionCount: 6,
        createdAt: '2026-10-11T12:00:00Z',
        updatedAt: '2026-10-11T12:00:00Z'
      };
      saveGraphs([graph1, graph2]);

      const attempt: AssessmentAttempt = {
        id: 'att-1',
        graphId: 'g-assessed',
        graphName: 'Assessed Subject',
        scorePercentage: 92,
        totalQuestions: 10,
        correctCount: 9,
        incorrectCount: 1,
        unansweredCount: 0,
        timeSpentSeconds: 120,
        completedAt: '2026-10-12T10:00:00Z',
        conceptIds: [],
        conceptNames: []
      };
      saveAssessmentAttempt(attempt);

      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: 92,
          totalCompletedAttempts: 1,
          recentAssessments: [{
            id: 'att-1',
            graphId: 'g-assessed',
            graphName: 'Assessed Subject',
            scorePercentage: 92,
            completedAt: '2026-10-12T10:00:00Z'
          }],
          activeRevisionProgress: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [graph1, graph2]
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'take-assessment');
      assert.strictEqual(recommendation.destination, 'graph');
      assert.strictEqual(recommendation.graphId, 'g-unassessed');
      assert.strictEqual(recommendation.graphName, 'Machine Learning');
      assert.strictEqual(recommendation.title, 'Assess Machine Learning');
      assert.strictEqual(recommendation.actionLabel, 'Start assessment');
      assert.strictEqual(recommendation.description, 'Test your understanding of this knowledge graph to measure progress.');
    });

    it('prioritizes the active graph if it is unassessed', () => {
      const g1: KnowledgeGraphMeta = {
        id: 'g1',
        name: 'Graph One',
        conceptCount: 3,
        connectionCount: 2,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };
      const g2: KnowledgeGraphMeta = {
        id: 'g2',
        name: 'Active Graph Two',
        conceptCount: 5,
        connectionCount: 4,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };

      const stats: Partial<PersonaStatsData> = {
        performance: {
          averageScore: null,
          totalCompletedAttempts: 0,
          recentAssessments: [],
          activeRevisionProgress: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [g1, g2],
        activeGraphId: 'g2'
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'take-assessment');
      assert.strictEqual(recommendation.graphId, 'g2');
      assert.strictEqual(recommendation.graphName, 'Active Graph Two');
      assert.strictEqual(recommendation.title, 'Assess Active Graph Two');
    });
  });

  // =========================================================================
  // 5. PRIORITY 4: CONTINUE LEARNING
  // =========================================================================
  describe('Priority 4: Continue Learning', () => {
    it('recommends exploring the graph when all graphs are assessed and no revision is needed', () => {
      const graph: KnowledgeGraphMeta = {
        id: 'g-complete',
        name: 'Deep Learning',
        conceptCount: 12,
        connectionCount: 18,
        createdAt: '2026-10-10T12:00:00Z',
        updatedAt: '2026-10-10T12:00:00Z'
      };

      const stats: Partial<PersonaStatsData> = {
        activity: {
          totalGraphs: 1,
          totalConcepts: 12,
          demonstratedConcepts: 12,
          demonstratedPercentage: 100,
          recentGraph: {
            graphId: 'g-complete',
            graphName: 'Deep Learning',
            updatedAt: '2026-10-10T12:00:00Z'
          },
          recentGraphs: []
        },
        performance: {
          averageScore: 95,
          totalCompletedAttempts: 2,
          recentAssessments: [{
            id: 'att-dl',
            graphId: 'g-complete',
            graphName: 'Deep Learning',
            scorePercentage: 95,
            completedAt: '2026-10-12T10:00:00Z'
          }],
          activeRevisionProgress: null,
          conceptsNeedingRevisionCount: 0,
          conceptsNeedingRevisionExamples: []
        }
      };

      const recommendation = getPersonaNextStepRecommendation(stats as PersonaStatsData, {
        graphs: [graph]
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'continue-learning');
      assert.strictEqual(recommendation.destination, 'graph');
      assert.strictEqual(recommendation.graphId, 'g-complete');
      assert.strictEqual(recommendation.graphName, 'Deep Learning');
      assert.strictEqual(recommendation.title, 'Continue learning in Deep Learning');
      assert.strictEqual(recommendation.actionLabel, 'Explore graph');
      assert.strictEqual(recommendation.description, 'Explore concept relationships and deepen your mastery.');
    });

    it('gracefully recommends creating the first graph when 0 graphs exist', () => {
      const recommendation = getPersonaNextStepRecommendation(null, {
        graphs: []
      });

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'continue-learning');
      assert.strictEqual(recommendation.destination, 'overview');
      assert.strictEqual(recommendation.title, 'Create your first graph');
      assert.strictEqual(recommendation.actionLabel, 'Create graph');
      assert.strictEqual(recommendation.description, 'Upload materials or create a graph to begin exploring concepts.');
    });
  });

  // =========================================================================
  // 6. ROBUSTNESS & MISSING DATA HANDLING
  // =========================================================================
  describe('6. Robustness and Missing Data Handling', () => {
    it('handles null stats without throwing errors', () => {
      const recommendation = getPersonaNextStepRecommendation(null, {});
      assert.ok(recommendation);
      assert.ok(typeof recommendation.title === 'string');
      assert.ok(typeof recommendation.description === 'string');
      assert.ok(typeof recommendation.actionLabel === 'string');
    });

    it('handles empty options object without throwing errors', () => {
      const recommendation = getPersonaNextStepRecommendation(null);
      assert.ok(recommendation);
    });
  });
});
