import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRevisionRecommendations,
  dismissRecommendation,
  deferRecommendation,
  restoreRecommendation,
  clearRecommendationPreferences,
  invalidateRecommendationsCache
} from '../src/services/revisionRecommendations';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { RevisionSessionState } from '../src/types/practice';
import { saveStoredKnowledgeCheck } from '../src/services/knowledgeCheck';
import { saveStoredMastery } from '../src/services/conceptMastery';
import { saveRevisionSession } from '../src/services/storage';

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

describe('GraphMind — Personalized Revision Recommendations (Prompt 18)', () => {
  const sampleGraph: KnowledgeGraph = {
    id: 'graph-neuro-rec',
    name: 'Neuroscience & Cellular Signaling',
    nodes: [
      {
        id: 'node-action-potential',
        name: 'Action Potential',
        type: 'concept',
        description: 'Rapid sequence of changes in the voltage across a membrane.',
        prerequisites: ['node-ion-channels'],
        evidence: 'Requires voltage-gated ion channels and resting potential.'
      },
      {
        id: 'node-ion-channels',
        name: 'Ion Channels',
        type: 'concept',
        description: 'Pore-forming membrane proteins that allow ions to pass through.',
        evidence: 'Fundamental transport mechanism across membranes.'
      },
      {
        id: 'node-synaptic-transmission',
        name: 'Synaptic Transmission',
        type: 'concept',
        description: 'Process by which signaling molecules are released by the axon terminal.',
        evidence: 'Triggered by action potential arrival.'
      },
      {
        id: 'node-neurotransmitters',
        name: 'Neurotransmitters',
        type: 'concept',
        description: 'Endogenous chemicals that enable neurotransmission.',
        evidence: 'Released into the synaptic cleft.'
      },
      {
        id: 'node-glial-cells',
        name: 'Glial Cells',
        type: 'concept',
        description: 'Non-neuronal cells in the central and peripheral nervous system.',
        evidence: 'Provide physical and metabolic support to neurons.'
      }
    ],
    relationships: [
      {
        id: 'rel-1',
        source: 'node-ion-channels',
        target: 'node-action-potential',
        type: 'prerequisite',
        description: 'Ion channels are essential for action potential generation'
      },
      {
        id: 'rel-2',
        source: 'node-action-potential',
        target: 'node-synaptic-transmission',
        type: 'triggers',
        description: 'Action potential triggers neurotransmitter release'
      },
      {
        id: 'rel-3',
        source: 'node-synaptic-transmission',
        target: 'node-neurotransmitters',
        type: 'utilizes',
        description: 'Synaptic transmission utilizes neurotransmitters'
      }
    ]
  };

  beforeEach(() => {
    storageMap.clear();
    invalidateRecommendationsCache();
  });

  describe('1. Unfinished Revision Session Resumption (Category A: Continue Learning)', () => {
    it('recommends resuming an unfinished session when a session is active and has remaining concepts', () => {
      const activeSession: RevisionSessionState = {
        isActive: true,
        graphId: sampleGraph.id,
        conceptIds: ['node-action-potential', 'node-ion-channels', 'node-synaptic-transmission'],
        currentIndex: 1,
        currentConceptId: 'node-ion-channels',
        totalConcepts: 3,
        reviewedConceptIds: ['node-action-potential'],
        markedForReviewIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveRevisionSession(activeSession, sampleGraph.id);

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        activeSession,
        forceRefresh: true
      });

      assert.strictEqual(report.hasActiveRecommendations, true);
      assert.ok(report.primaryRecommendation);
      assert.strictEqual(report.primaryRecommendation.category, 'continue-learning');
      assert.strictEqual(report.primaryRecommendation.conceptId, 'node-ion-channels');
      assert.strictEqual(report.primaryRecommendation.actionType, 'continue-revision');
      assert.strictEqual(report.primaryRecommendation.actionLabel, 'Continue revision');
      assert.ok(report.primaryRecommendation.explanation.includes('unfinished revision session'));
      assert.ok(report.primaryRecommendation.explanation.includes('2 of 3 concepts remaining'));
    });

    it('does not recommend continue-learning when the session is completely finished', () => {
      const completedSession: RevisionSessionState = {
        isActive: true,
        graphId: sampleGraph.id,
        conceptIds: ['node-action-potential', 'node-ion-channels'],
        currentIndex: 1,
        currentConceptId: 'node-ion-channels',
        totalConcepts: 2,
        reviewedConceptIds: ['node-action-potential', 'node-ion-channels'],
        markedForReviewIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveRevisionSession(completedSession, sampleGraph.id);

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        activeSession: completedSession,
        forceRefresh: true
      });

      const continueItem = report.allRecommendations.find(r => r.category === 'continue-learning');
      assert.strictEqual(continueItem, undefined, 'Completed session should not emit continue-learning recommendation');
    });
  });

  describe('2. Repeated Difficulty & Needs Review (Category B: Review a Difficult Concept)', () => {
    it('recommends reviewing a concept when there is evidence of repeated incorrect attempts', () => {
      saveStoredMastery(sampleGraph.id, {
        conceptId: 'node-action-potential',
        conceptName: 'Action Potential',
        status: 'needs-review',
        statusLabel: 'Needs review',
        attemptCount: 2,
        correctCount: 0,
        incorrectCount: 2,
        consecutiveIncorrectCount: 2,
        evidenceSource: 'knowledge-check',
        lastAttemptIso: new Date().toISOString()
      });

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      assert.strictEqual(report.hasActiveRecommendations, true);
      const diffRec = report.allRecommendations.find(r => r.conceptId === 'node-action-potential');
      assert.ok(diffRec);
      assert.strictEqual(diffRec.category, 'review-difficulty');
      assert.strictEqual(diffRec.actionType, 'review-concept');
      assert.strictEqual(diffRec.actionLabel, 'Review concept');
      assert.ok(diffRec.explanation.includes('2 most recent answers were incorrect'));
    });
  });

  describe('3. Foundational Prerequisites (Category C: Review a Foundation)', () => {
    it('recommends reviewing a prerequisite when student is studying an advanced concept with unassessed prerequisite', () => {
      // Student is on Action Potential in session, but Ion Channels is not assessed
      const activeSession: RevisionSessionState = {
        isActive: true,
        graphId: sampleGraph.id,
        conceptIds: ['node-action-potential'],
        currentIndex: 0,
        currentConceptId: 'node-action-potential',
        totalConcepts: 1,
        reviewedConceptIds: [],
        markedForReviewIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        activeSession,
        forceRefresh: true
      });

      const foundRec = report.allRecommendations.find(
        r => r.category === 'review-foundation' && r.conceptId === 'node-ion-channels'
      );
      assert.ok(foundRec, 'Should recommend foundational prerequisite Ion Channels');
      assert.strictEqual(foundRec.actionType, 'open-foundation');
      assert.strictEqual(foundRec.actionLabel, 'Review foundation');
      assert.ok(foundRec.explanation.includes('Review prerequisite Ion Channels'));
    });
  });

  describe('4. Incomplete Evidence (Category D: Practice a Concept)', () => {
    it('recommends practicing a concept when it was visited in session but has 0 check attempts', () => {
      const activeSession: RevisionSessionState = {
        isActive: true,
        graphId: sampleGraph.id,
        conceptIds: ['node-action-potential', 'node-ion-channels'],
        currentIndex: 1,
        currentConceptId: 'node-ion-channels',
        totalConcepts: 2,
        reviewedConceptIds: ['node-action-potential'],
        markedForReviewIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // node-action-potential was reviewed/visited, but has 0 attempts recorded
      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        activeSession,
        forceRefresh: true
      });

      const practiceRec = report.allRecommendations.find(
        r => r.category === 'practice-concept' && r.conceptId === 'node-action-potential'
      );
      assert.ok(practiceRec, 'Should recommend practicing Action Potential');
      assert.strictEqual(practiceRec.actionType, 'practice-concept');
      assert.strictEqual(practiceRec.actionLabel, 'Practice questions');
      assert.ok(practiceRec.explanation.includes('gather more evidence of understanding'));
    });
  });

  describe('5. Real Graph Connections (Category E: Explore a Connection)', () => {
    it('recommends exploring a connected concept from a demonstrated concept', () => {
      // Mark Action Potential as demonstrated
      saveStoredMastery(sampleGraph.id, {
        conceptId: 'node-action-potential',
        conceptName: 'Action Potential',
        status: 'understanding-demonstrated',
        statusLabel: 'Understanding demonstrated',
        attemptCount: 2,
        correctCount: 2,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        evidenceSource: 'knowledge-check',
        lastAttemptIso: new Date().toISOString()
      });

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      const connRec = report.allRecommendations.find(r => r.category === 'explore-connection');
      assert.ok(connRec, 'Should suggest exploring connected concept');
      assert.strictEqual(connRec.conceptId, 'node-synaptic-transmission');
      assert.strictEqual(connRec.targetConceptId, 'node-action-potential');
      assert.strictEqual(connRec.actionType, 'explore-graph');
      assert.strictEqual(connRec.actionLabel, 'Explore in graph');
      assert.ok(connRec.explanation.includes('Explore Synaptic Transmission, connected via "triggers" from Action Potential'));
    });
  });

  describe('6. Unstudied Concepts (Category F: Start Something New)', () => {
    it('recommends starting an unstudied concept when no active session or review items exist', () => {
      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      const startRec = report.allRecommendations.find(r => r.category === 'start-new');
      assert.ok(startRec, 'Should offer starting a new concept');
      assert.strictEqual(startRec.actionType, 'start-concept');
      assert.strictEqual(startRec.actionLabel, 'Start concept');
      assert.ok(startRec.explanation.includes('Begin studying this unstudied concept'));
    });
  });

  describe('7. Adaptive Priority Ranking & Deduplication', () => {
    it('elevates foundational prerequisite to Priority 1 when paused on a concept with a struggling foundation', () => {
      // Ion Channels has needs-review difficulty
      saveStoredMastery(sampleGraph.id, {
        conceptId: 'node-ion-channels',
        conceptName: 'Ion Channels',
        status: 'needs-review',
        statusLabel: 'Needs review',
        attemptCount: 2,
        correctCount: 0,
        incorrectCount: 2,
        consecutiveIncorrectCount: 2,
        evidenceSource: 'knowledge-check',
        lastAttemptIso: new Date().toISOString()
      });

      // Student is paused on Action Potential in session
      const activeSession: RevisionSessionState = {
        isActive: true,
        graphId: sampleGraph.id,
        conceptIds: ['node-action-potential', 'node-glial-cells'],
        currentIndex: 0,
        currentConceptId: 'node-action-potential',
        totalConcepts: 2,
        reviewedConceptIds: [],
        markedForReviewIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        activeSession,
        forceRefresh: true
      });

      // The foundational prerequisite Ion Channels should be elevated to Priority 1 over generic session resumption
      assert.ok(report.primaryRecommendation);
      assert.strictEqual(report.primaryRecommendation.category, 'review-foundation');
      assert.strictEqual(report.primaryRecommendation.conceptId, 'node-ion-channels');
      assert.strictEqual(report.primaryRecommendation.priority, 1);
    });

    it('deduplicates recommendations so a single concept only appears once at its highest priority', () => {
      // Action potential has needs-review
      saveStoredMastery(sampleGraph.id, {
        conceptId: 'node-action-potential',
        conceptName: 'Action Potential',
        status: 'needs-review',
        statusLabel: 'Needs review',
        attemptCount: 1,
        correctCount: 0,
        incorrectCount: 1,
        consecutiveIncorrectCount: 1,
        evidenceSource: 'knowledge-check',
        lastAttemptIso: new Date().toISOString()
      });

      const report = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      const actionPotentialItems = report.allRecommendations.filter(r => r.conceptId === 'node-action-potential');
      assert.strictEqual(actionPotentialItems.length, 1, 'Action Potential should appear exactly once in the report');
      assert.strictEqual(actionPotentialItems[0].category, 'review-difficulty');
    });
  });

  describe('8. User Control & Persistence (Dismiss & Defer)', () => {
    it('persists dismissed recommendations and excludes them from active list', () => {
      const report1 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      assert.ok(report1.primaryRecommendation);
      const topRecId = report1.primaryRecommendation.id;

      dismissRecommendation(sampleGraph.id, topRecId);

      const report2 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      assert.strictEqual(report2.dismissedCount, 1);
      const stillPresent = report2.allRecommendations.some(r => r.id === topRecId);
      assert.strictEqual(stillPresent, false, 'Dismissed recommendation should not appear in active list');
    });

    it('restores dismissed recommendation when requested', () => {
      const report1 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      const topRecId = report1.primaryRecommendation!.id;
      dismissRecommendation(sampleGraph.id, topRecId);

      restoreRecommendation(sampleGraph.id, topRecId);

      const report3 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      assert.strictEqual(report3.dismissedCount, 0);
      assert.ok(report3.allRecommendations.some(r => r.id === topRecId));
    });

    it('defers recommendation with valid expiration', () => {
      const report1 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      const topRecId = report1.primaryRecommendation!.id;
      deferRecommendation(sampleGraph.id, topRecId, 24);

      const report2 = generateRevisionRecommendations({
        graph: sampleGraph,
        forceRefresh: true
      });

      assert.strictEqual(report2.allRecommendations.some(r => r.id === topRecId), false);
    });
  });

  describe('9. Edge Cases & Safety', () => {
    it('handles empty or null graph gracefully without throwing', () => {
      const emptyGraph: KnowledgeGraph = {
        id: 'empty-graph',
        name: 'Empty',
        nodes: []
      };

      const report = generateRevisionRecommendations({
        graph: emptyGraph,
        forceRefresh: true
      });

      assert.strictEqual(report.hasActiveRecommendations, false);
      assert.strictEqual(report.primaryRecommendation, null);
      assert.deepStrictEqual(report.secondaryRecommendations, []);
    });
  });
});
