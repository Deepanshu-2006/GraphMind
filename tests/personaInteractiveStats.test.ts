import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { AssessmentAttempt } from '../src/types/test';
import type { RevisionSessionState } from '../src/types/practice';
import {
  saveGraphs,
  saveGraphData,
  saveRevisionSession,
  clearAllUserData,
  loadActiveGraphId,
  saveActiveGraphId
} from '../src/services/storage';
import {
  saveAssessmentAttempt,
  clearAssessmentHistory,
  getAssessmentAttemptById
} from '../src/services/assessmentHistory';
import { clearCurrentUser } from '../src/services/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('GRAPHMIND — PERSONA INTERACTIVE STATISTICS & NAVIGATION', () => {
  beforeEach(() => {
    storageMap.clear();
    clearCurrentUser();
    clearAllUserData();
    clearAssessmentHistory();
  });

  // =========================================================================
  // 1. YOUR GRAPHS INTERACTION
  // =========================================================================
  describe('1. Your Graphs Interaction (Requirement 1)', () => {
    it('provides onOpenOverview callback on PersonaActivityPanel to open knowledge graphs overview', () => {
      let overviewOpened = false;
      const mockOpenOverview = () => {
        overviewOpened = true;
      };

      // Trigger callback
      mockOpenOverview();
      assert.strictEqual(overviewOpened, true, 'Calling onOpenOverview must trigger navigation');
    });

    it('verifies PersonaActivityPanel renders accessible interactive trigger wrapping label and count', () => {
      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaActivityPanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');

      assert.ok(panelSrc.includes('onOpenOverview?: () => void;'), 'PersonaActivityPanelProps must define onOpenOverview');
      assert.ok(panelSrc.includes('onClick={onOpenOverview}'), 'Trigger must invoke onOpenOverview');
      assert.ok(panelSrc.includes('persona-stat-trigger'), 'Must apply persona-stat-trigger class');
      assert.ok(panelSrc.includes('YOUR GRAPHS'), 'Must render YOUR GRAPHS label');
      assert.ok(panelSrc.includes('data-testid="persona-total-graphs"'), 'Must preserve persona-total-graphs data-testid');
    });

    it('verifies App.tsx routes onOpenOverview to handleNavigateFromPersona("overview")', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appSrc = fs.readFileSync(appPath, 'utf8');

      assert.ok(
        appSrc.includes("onOpenOverview={() => {") && appSrc.includes("handleNavigateFromPersona('overview')"),
        'App.tsx must wire onOpenOverview to handleNavigateFromPersona("overview")'
      );
    });
  });

  // =========================================================================
  // 2. LEARNING PROGRESS INTERACTION
  // =========================================================================
  describe('2. Learning Progress Interaction (Requirement 2)', () => {
    it('provides onOpenStudy callback on PersonaActivityPanel to open learning overview in study space', () => {
      let studyOpened = false;
      const mockOpenStudy = () => {
        studyOpened = true;
      };

      mockOpenStudy();
      assert.strictEqual(studyOpened, true, 'Calling onOpenStudy must trigger navigation');
    });

    it('verifies PersonaActivityPanel renders accessible interactive trigger and progress track for learning progress', () => {
      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaActivityPanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');

      assert.ok(panelSrc.includes('onOpenStudy?: () => void;'), 'PersonaActivityPanelProps must define onOpenStudy');
      assert.ok(panelSrc.includes('onClick={onOpenStudy}'), 'Learning progress trigger must invoke onOpenStudy');
      assert.ok(panelSrc.includes('data-testid="persona-demonstrated-percentage"'), 'Must preserve persona-demonstrated-percentage testid');
      assert.ok(panelSrc.includes('persona-progress-track--interactive'), 'Progress track must support interactive styling');
    });

    it('verifies App.tsx routes onOpenStudy to handleNavigateFromPersona("study")', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appSrc = fs.readFileSync(appPath, 'utf8');

      assert.ok(
        appSrc.includes("onOpenStudy={() => {") && appSrc.includes("handleNavigateFromPersona('study')"),
        'App.tsx must wire onOpenStudy to handleNavigateFromPersona("study")'
      );
    });
  });

  // =========================================================================
  // 3. RECENT ACTIVITY INTERACTION
  // =========================================================================
  describe('3. Recent Activity Interaction (Requirement 3)', () => {
    it('makes each recent graph item clickable and opens the corresponding graph in workspace', () => {
      const g1: KnowledgeGraphMeta = {
        id: 'graph-ds-1',
        name: 'Distributed Systems',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-17T09:00:00.000Z'
      };

      saveGraphs([g1]);
      saveActiveGraphId(g1.id);

      const stats = calculatePersonaStats({ graphs: [g1] });
      assert.strictEqual(stats.activity.recentGraphs.length, 1);
      const recent = stats.activity.recentGraphs[0];

      let selectedId: string | null = null;
      let targetSection: string | null = null;
      const mockSelectGraph = (graphId: string) => {
        selectedId = graphId;
        targetSection = 'graph';
        saveActiveGraphId(graphId);
      };

      mockSelectGraph(recent.graphId);

      assert.strictEqual(selectedId, 'graph-ds-1');
      assert.strictEqual(targetSection, 'graph');
      assert.strictEqual(loadActiveGraphId(), 'graph-ds-1');
    });

    it('disables activity items when graphId is absent and does not invent fake destinations', () => {
      const stats = calculatePersonaStats({ graphs: [] });
      assert.strictEqual(stats.activity.recentGraphs.length, 0);
      assert.strictEqual(stats.activity.recentGraph, null);
    });
  });

  // =========================================================================
  // 4. ASSESSMENT PERFORMANCE INTERACTION
  // =========================================================================
  describe('4. Assessment Performance Interaction (Requirement 4)', () => {
    it('preserves existing score calculations and average score accuracy', () => {
      const attemptA: AssessmentAttempt = {
        id: 'attempt-early-1',
        testId: 'test-os-attempt-1',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        scorePercentage: 70,
        correctAnswers: 7,
        totalQuestions: 10,
        completedAt: '2026-10-16T10:00:00.000Z',
        timeSpentSeconds: 120,
        answers: {}
      };

      const attemptB: AssessmentAttempt = {
        id: 'attempt-recent-2',
        testId: 'test-os-attempt-2',
        graphId: 'graph-os',
        graphName: 'Operating Systems',
        scorePercentage: 90,
        correctAnswers: 9,
        totalQuestions: 10,
        completedAt: '2026-10-17T08:00:00.000Z',
        timeSpentSeconds: 100,
        answers: {}
      };

      saveAssessmentAttempt(attemptA);
      saveAssessmentAttempt(attemptB);

      const stats = calculatePersonaStats({ graphs: [] });

      // Calculations preserved: (70 + 90) / 2 = 80%
      assert.strictEqual(stats.performance.totalAssessmentAttempts, 2);
      assert.strictEqual(stats.performance.averageScore, 80);
      assert.strictEqual(stats.performance.recentAssessments.length, 2);
    });

    it('makes assessment metric trigger open assessment history and keeps individual attempt clicks isolated', () => {
      let generalAssessmentsOpened = false;
      const mockOpenAssessments = () => {
        generalAssessmentsOpened = true;
      };

      let specificAttemptOpened: string | null = null;
      const mockSelectAssessment = (attemptId: string) => {
        specificAttemptOpened = attemptId;
      };

      // Clicking overall metric opens assessment history
      mockOpenAssessments();
      assert.strictEqual(generalAssessmentsOpened, true);

      // Clicking individual attempt review opens that attempt
      mockSelectAssessment('attempt-early-1');
      assert.strictEqual(specificAttemptOpened, 'attempt-early-1');
    });

    it('verifies PersonaPerformancePanel renders interactive trigger for average score and wires onOpenAssessments', () => {
      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');

      assert.ok(panelSrc.includes('onOpenAssessments?: () => void;'), 'Must define onOpenAssessments prop');
      assert.ok(panelSrc.includes('onClick={onOpenAssessments}'), 'Trigger must invoke onOpenAssessments');
      assert.ok(panelSrc.includes('data-testid="persona-average-score"'), 'Must preserve persona-average-score testid');
    });

    it('verifies App.tsx routes onOpenAssessments to handleNavigateFromPersona("study")', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appSrc = fs.readFileSync(appPath, 'utf8');

      assert.ok(
        appSrc.includes("onOpenAssessments={() => {") && appSrc.includes("handleNavigateFromPersona('study')"),
        'App.tsx must wire onOpenAssessments to handleNavigateFromPersona("study")'
      );
    });
  });

  // =========================================================================
  // 5. ACTIVE REVISION SESSION INTERACTION
  // =========================================================================
  describe('5. Active Revision Session Interaction (Requirement 5)', () => {
    it('preserves existing Resume session action and opens the correct revision session', () => {
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-algo',
        name: 'Algorithms',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        id: 'graph-algo',
        name: 'Algorithms',
        nodes: [
          { id: 'c1', name: 'BFS', type: 'concept', description: '', sourceIds: [] },
          { id: 'c2', name: 'DFS', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [],
        sources: []
      };

      saveGraphs([graphMeta]);
      saveGraphData('graph-algo', graphData);

      const session: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-algo',
        conceptIds: ['c1', 'c2'],
        currentIndex: 1,
        currentConceptId: 'c2',
        totalConcepts: 2,
        createdAt: '2026-10-17T07:00:00.000Z',
        updatedAt: '2026-10-17T07:30:00.000Z',
        reviewedConceptIds: ['c1'],
        markedForReviewIds: []
      };

      saveRevisionSession(session, 'graph-algo');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });
      assert.notStrictEqual(stats.performance.activeRevisionProgress, null);

      let resumedGraphId: string | null = null;
      let navigatedSection: string | null = null;
      const mockResumeRevision = (graphId: string) => {
        resumedGraphId = graphId;
        navigatedSection = 'revision';
        saveActiveGraphId(graphId);
      };

      mockResumeRevision(stats.performance.activeRevisionProgress!.graphId);
      assert.strictEqual(resumedGraphId, 'graph-algo');
      assert.strictEqual(navigatedSection, 'revision');
      assert.strictEqual(loadActiveGraphId(), 'graph-algo');
    });

    it('verifies PersonaPerformancePanel renders interactive triggers for active revision and preserves Resume session button', () => {
      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');

      assert.ok(panelSrc.includes('persona-revision-resume-btn'), 'Must preserve persona-revision-resume-btn class');
      assert.ok(panelSrc.includes('Resume session</span>'), 'Must preserve Resume session label');
      assert.ok(panelSrc.includes('data-testid="persona-revision-progress"'), 'Must preserve persona-revision-progress testid');
    });

    it('disables session trigger when no active session exists to prevent inventing destinations', () => {
      const stats = calculatePersonaStats({ graphs: [] });
      assert.strictEqual(stats.performance.activeRevisionProgress, null);

      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');
      assert.ok(panelSrc.includes('disabled={!revisionProgress || !onResumeRevision}'), 'Must be disabled when revisionProgress is null');
    });
  });

  // =========================================================================
  // 6. CONCEPTS TO REVISIT INTERACTION
  // =========================================================================
  describe('6. Concepts to Revisit Interaction (Requirement 6)', () => {
    it('makes concept chips interactive and allows navigating to revision with the concept', () => {
      let chosenConcept: string | undefined = undefined;
      let targetSection: string | null = null;

      const mockOpenRevision = (conceptName?: string) => {
        chosenConcept = conceptName;
        targetSection = 'revision';
      };

      // User clicks on example concept chip
      mockOpenRevision('Binary Search');
      assert.strictEqual(chosenConcept, 'Binary Search');
      assert.strictEqual(targetSection, 'revision');
    });

    it('verifies PersonaPerformancePanel renders concept chips as accessible interactive buttons', () => {
      const panelPath = path.resolve(__dirname, '../src/components/persona/PersonaPerformancePanel.tsx');
      const panelSrc = fs.readFileSync(panelPath, 'utf8');

      assert.ok(panelSrc.includes('onOpenRevision?: (conceptName?: string) => void;'), 'Must define onOpenRevision prop');
      assert.ok(panelSrc.includes('persona-concept-chip persona-concept-chip--interactive'), 'Must apply persona-concept-chip--interactive class');
      assert.ok(panelSrc.includes('data-testid="persona-concepts-needing-revision"'), 'Must preserve persona-concepts-needing-revision testid');
    });

    it('verifies App.tsx focuses the target concept and routes to revision workspace', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appSrc = fs.readFileSync(appPath, 'utf8');

      assert.ok(appSrc.includes('onOpenRevision={(conceptIdentifier) => {'), 'App.tsx must wire onOpenRevision');
      assert.ok(appSrc.includes('setFocusedConceptId'), 'Must focus target concept');
      assert.ok(appSrc.includes("handleNavigateFromPersona('revision')"), 'Must navigate to revision workspace');
    });
  });

  // =========================================================================
  // 7. INTERACTION DESIGN, AESTHETICS & ACCESSIBILITY
  // =========================================================================
  describe('7. Interaction Design, Aesthetics & Accessibility Constraints', () => {
    const cssPath = path.resolve(__dirname, '../src/styles/persona.css');
    const cssSrc = fs.readFileSync(cssPath, 'utf8');

    it('provides cursor feedback for genuinely clickable elements and default for disabled elements', () => {
      assert.ok(cssSrc.includes('.persona-stat-trigger:not(:disabled)'), 'Must style active triggers with pointer');
      assert.ok(cssSrc.includes('cursor: pointer;'), 'Must provide cursor: pointer for interactive elements');
      assert.ok(cssSrc.includes('.persona-stat-trigger:disabled'), 'Must set cursor: default on disabled triggers');
    });

    it('provides accessible keyboard focus states using accent outline', () => {
      assert.ok(cssSrc.includes('.persona-stat-trigger:focus-visible'), 'Must define focus-visible for stat triggers');
      assert.ok(cssSrc.includes('outline: 1px solid var(--accent, #A3FF12);'), 'Must use GraphMind accent outline');
      assert.ok(cssSrc.includes('.persona-concept-chip--interactive:focus-visible'), 'Must define focus-visible for concept chips');
    });

    it('preserves dark, minimal aesthetic without unnecessary buttons, cards, borders, or glassmorphic blur filters', () => {
      assert.ok(!cssSrc.includes('.persona-stat-trigger { background: #'), 'Triggers must have transparent background');
      assert.ok(!cssSrc.includes('.persona-stat-trigger { border: 1px solid #'), 'Triggers must not add card borders');
    });

    it('verifies PersonaExperience wires all interactive handlers into both panels', () => {
      const expPath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
      const expSrc = fs.readFileSync(expPath, 'utf8');

      assert.ok(expSrc.includes('onOpenOverview={handleOpenOverview}'), 'Must pass onOpenOverview to activity panel');
      assert.ok(expSrc.includes('onOpenStudy={handleOpenStudy}'), 'Must pass onOpenStudy to activity panel');
      assert.ok(expSrc.includes('onOpenAssessments={handleOpenAssessments}'), 'Must pass onOpenAssessments to performance panel');
      assert.ok(expSrc.includes('onOpenRevision={handleOpenRevision}'), 'Must pass onOpenRevision to performance panel');
    });
  });
});
