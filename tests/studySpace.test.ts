import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  formatAttemptDate, 
  formatDuration,
  computeProgressComparison,
  ensureResultsSummary,
  pad
} from '../src/components/study/StudySpaceView';
import {
  saveAssessmentAttempt,
  getAssessmentAttempts,
  getAssessmentAttemptById,
  clearAssessmentHistory,
  ASSESSMENT_HISTORY_STORAGE_KEY
} from '../src/services/assessmentHistory';
import { generateKnowledgeTest } from '../src/services/knowledgeTestGenerator';
import { recordKnowledgeTestCompletion, clearAllUserData } from '../src/services/storage';
import { defaultKnowledgeGraph } from '../src/data/graphData';
import type { AssessmentAttempt } from '../src/types/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('GRAPHMIND PHASE 1, PROMPT 2 — STUDY SPACE ARCHITECTURE', () => {
  const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
  const sidebarSrc = fs.readFileSync(sidebarPath, 'utf8');

  const appPath = path.resolve(__dirname, '../src/App.tsx');
  const appSrc = fs.readFileSync(appPath, 'utf8');

  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  beforeEach(() => {
    storageMap.clear();
    clearAllUserData();
    clearAssessmentHistory();
  });

  describe('1. Sidebar Integration & Navigation Routing', () => {
    it('replaces Learning Paths with Study Space in primary navigation', () => {
      assert.ok(
        sidebarSrc.includes("id: 'study'") && sidebarSrc.includes("label: 'Study Space'"),
        "Sidebar must contain Study Space with id 'study'"
      );
      assert.ok(
        sidebarSrc.includes('BookOpen'),
        'Sidebar must use BookOpen or suitable study icon'
      );
      assert.ok(
        !sidebarSrc.includes("label: 'Learning Paths'"),
        'Sidebar must no longer render Learning Paths label in primary navigation'
      );
    });

    it('maintains strict 4-item primary navigation order: Overview, Knowledge Graph, Study Space, Sources', () => {
      const items = [
        { id: 'overview', label: 'Overview' },
        { id: 'graph', label: 'Knowledge Graph' },
        { id: 'study', label: 'Study Space' },
        { id: 'sources', label: 'Sources' }
      ];

      items.forEach((item) => {
        assert.ok(
          sidebarSrc.includes(`id: '${item.id}'`) && sidebarSrc.includes(`label: '${item.label}'`),
          `Sidebar must include ${item.label}`
        );
      });
    });

    it('routes /study and /paths to study section in App.tsx', () => {
      assert.ok(
        appSrc.includes("if (path === 'study' || path === 'paths') return 'study';"),
        'App router must map /study and legacy /paths to study section'
      );
      assert.ok(
        appSrc.includes("<StudySpaceView"),
        'App.tsx must mount StudySpaceView for study section'
      );
    });
  });

  describe('2. Study Space Editorial Header & Layout Composition', () => {
    it('features restrained editorial header with exact human copy', () => {
      assert.ok(studyViewSrc.includes('YOUR LEARNING'), 'Must contain YOUR LEARNING eyebrow');
      assert.ok(studyViewSrc.includes('Study Space'), 'Must contain Study Space page title');
      assert.ok(
        studyViewSrc.includes('Your assessments, progress, and concepts worth revisiting.'),
        'Must contain supporting subtitle'
      );
      assert.ok(studyViewSrc.includes('study-header-divider'), 'Must include subtle header divider');
    });

    it('uses GraphMind typography scale (~36px desktop title, no oversized hero)', () => {
      assert.match(
        studyCss,
        /\.study-title\s*\{[\s\S]*?font-size:\s*36px;/,
        'Desktop title must be restrained ~36px'
      );
      assert.match(
        studyCss,
        /\.study-space-container\s*\{[\s\S]*?max-width:\s*1080px;/,
        'Container width must align with standard editorial layout (~1080px)'
      );
    });
  });

  describe('3. Continue Learning Section (Highlighted Latest Relevant Attempt)', () => {
    it('highlights latest attempt with authentic data and contextual review actions', () => {
      assert.ok(studyViewSrc.includes('CONTINUE LEARNING'), 'Must contain CONTINUE LEARNING kicker');
      assert.ok(studyViewSrc.includes('Review missed concepts'), 'Must offer Review missed concepts action when missed concepts exist');
      assert.ok(studyViewSrc.includes('Review results'), 'Must offer Review results action');
      assert.ok(studyViewSrc.includes('study-meta-warm'), 'Must visually indicate concepts worth revisiting');
    });

    it('does not render Continue Learning section when no assessment attempts exist', () => {
      assert.ok(
        studyViewSrc.includes('{!isLoading && !errorMessage && attempts.length > 0 && ('),
        'Only render Continue Learning and History when attempts exist'
      );
    });
  });

  describe('4. Assessment History List & Table Architecture', () => {
    it('defines exact column headers: ATTEMPT, COMPLETED, RESULT, QUESTIONS, ACTION', () => {
      const headers = ['ATTEMPT', 'COMPLETED', 'RESULT', 'QUESTIONS', 'ACTION'];
      headers.forEach(h => {
        assert.ok(
          studyViewSrc.includes(`<th scope="col" className="study-th">${h}</th>`) ||
          studyViewSrc.includes(`<th scope="col" className="study-th study-th-action">${h}</th>`),
          `Table must include column header ${h}`
        );
      });
    });

    it('renders real persisted attempts sorted newest first', () => {
      const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const test1 = testGen1.test!;
      const test2 = testGen2.test!;
      test2.id = 'test-run-2';

      // Submit test1 first, then test2
      const summary1 = recordKnowledgeTestCompletion(test1, {}, 60, { graphName: 'Graph A' });
      const summary2 = recordKnowledgeTestCompletion(test2, {}, 120, { graphName: 'Graph B' });

      const attempts = getAssessmentAttempts();
      assert.strictEqual(attempts.length, 2);
      // Newest first
      assert.strictEqual(attempts[0].id, summary2.attemptId);
      assert.strictEqual(attempts[1].id, summary1.attemptId);
    });

    it('preserves multiple attempts on the same graph without grouping or overwriting', () => {
      const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const test1 = testGen1.test!;
      const test2 = testGen2.test!;
      test2.id = 'test-distinct-same-graph';

      recordKnowledgeTestCompletion(test1, {}, 45);
      recordKnowledgeTestCompletion(test2, {}, 90);

      const attempts = getAssessmentAttempts({ graphId: defaultKnowledgeGraph.id });
      assert.strictEqual(attempts.length, 2, 'Must keep multiple attempts on same graph distinct');
    });

    it('formats attempt row metadata with signature underline hover animation', () => {
      assert.match(
        studyCss,
        /\.study-btn-underline\s*\{[\s\S]*?width:\s*0%;[\s\S]*?background-color:\s*var\(--accent/
      );
      assert.match(
        studyCss,
        /\.study-editorial-btn:hover\s*\.study-btn-underline\s*\{[\s\S]*?width:\s*100%;/
      );
    });
  });

  describe('5. Opening Historical Results & State Integrity', () => {
    it('retrieves immutable historical snapshot and connects to TestResultsView', () => {
      const testGen = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 4 });
      const test = testGen.test!;
      const answers: Record<string, string> = {
        [test.questions[0].id]: test.questions[0].correctOptionId
      };

      const summary = recordKnowledgeTestCompletion(test, answers, 75);
      const attempt = getAssessmentAttemptById(summary.attemptId!);
      assert.ok(attempt);

      // Verify questions snapshot
      assert.strictEqual(attempt.questions.length, 4);
      assert.strictEqual(attempt.userAnswers[test.questions[0].id], test.questions[0].correctOptionId);
      assert.strictEqual(attempt.correctAnswers, 1);
      assert.strictEqual(attempt.totalQuestions, 4);

      // Verify TestResultsView back button configured with BACK TO STUDY SPACE
      assert.ok(
        studyViewSrc.includes('backButtonLabel="BACK TO STUDY SPACE"'),
        'Historical results view must pass BACK TO STUDY SPACE to back button'
      );
    });

    it('supports deep-linking and browser navigation via URL search param ?attempt=', () => {
      assert.ok(
        studyViewSrc.includes("url.searchParams.set('attempt', attemptId)"),
        'Must sync attempt ID into URL parameters'
      );
      assert.ok(
        studyViewSrc.includes("window.addEventListener('popstate'"),
        'Must handle popstate events for seamless browser back/forward navigation'
      );
    });
  });

  describe('6. Empty, Loading, and Error States', () => {
    it('renders clean empty state with exact copy when user has no attempts', () => {
      assert.ok(
        studyViewSrc.includes('No assessments yet.'),
        'Must display No assessments yet. heading'
      );
      assert.ok(
        studyViewSrc.includes('Complete an assessment from your knowledge graph to build your learning history.'),
        'Must display supporting empty state copy'
      );
      assert.ok(
        studyViewSrc.includes('Explore your graph'),
        'Must provide Explore your graph primary action'
      );
    });

    it('provides retry mechanism on error', () => {
      assert.ok(
        studyViewSrc.includes('study-error-banner'),
        'Must render error banner when error occurs'
      );
      assert.ok(
        studyViewSrc.includes('study-retry-btn'),
        'Must render retry button'
      );
    });
  });

  describe('7. Utility Formatting Functions', () => {
    it('formats date and time cleanly across environments', () => {
      const iso = '2026-10-09T14:32:00.000Z';
      const formatted = formatAttemptDate(iso);
      assert.strictEqual(formatted.dateStr, 'Oct 09, 2026');
      assert.strictEqual(formatted.timeStr, '14:32');
    });

    it('formats duration in minutes and seconds correctly', () => {
      assert.strictEqual(formatDuration(45), '45s');
      assert.strictEqual(formatDuration(60), '1m 00s');
      assert.strictEqual(formatDuration(145), '2m 25s');
      assert.strictEqual(formatDuration(600), '10m 00s');
    });
  });

  describe('8. Zero Mock Data & Responsive Architecture', () => {
    it('does not contain hardcoded or fake assessment attempt records', () => {
      assert.doesNotMatch(studyViewSrc, /const\s+mockAttempts\s*=/i);
      assert.doesNotMatch(studyViewSrc, /const\s+sampleAttempts\s*=/i);
      assert.doesNotMatch(studyViewSrc, /const\s+dummyAttempts\s*=/i);
    });

    it('defines responsive layout rules for tablet and mobile in studySpace.css', () => {
      assert.match(studyCss, /@media\s*\(max-width:\s*960px\)/);
      assert.match(studyCss, /@media\s*\(max-width:\s*640px\)/);
      assert.match(studyCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });
  });
});

describe('GRAPHMIND STUDY SPACE PROMPT 3 — ASSESSMENT HISTORY & ATTEMPT ORGANIZATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  beforeEach(() => {
    storageMap.clear();
    clearAllUserData();
    clearAssessmentHistory();
  });

  describe('1. Organize Attempts By Graph & Preserve Individual Snapshots', () => {
    it('groups multiple attempts belonging to the same knowledge graph', () => {
      const testGen1 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const testGen2 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });
      const testGen3 = generateKnowledgeTest(defaultKnowledgeGraph, { questionCount: 3 });

      const t1 = testGen1.test!;
      const t2 = { ...testGen2.test!, id: 'attempt-t2' };
      const t3 = { ...testGen3.test!, id: 'attempt-t3' };

      const s1 = recordKnowledgeTestCompletion(t1, {}, 40, { graphName: 'Operating Systems' });
      const s2 = recordKnowledgeTestCompletion(t2, {}, 50, { graphName: 'Operating Systems' });
      const s3 = recordKnowledgeTestCompletion(t3, {}, 60, { graphName: 'Operating Systems' });

      const all = getAssessmentAttempts({ graphId: defaultKnowledgeGraph.id });
      assert.strictEqual(all.length, 3, 'Must preserve all 3 attempts without dropping or overwriting');

      // Check unique IDs preserved
      assert.strictEqual(all[0].id, s3.attemptId);
      assert.strictEqual(all[1].id, s2.attemptId);
      assert.strictEqual(all[2].id, s1.attemptId);
    });

    it('separates attempts from different knowledge graphs', () => {
      const graphA = {
        ...defaultKnowledgeGraph,
        id: 'graph-operating-systems',
        name: 'Operating Systems'
      };
      const testGen1 = generateKnowledgeTest(graphA, { questionCount: 3 });
      const t1 = testGen1.test!;

      const graphB = {
        ...defaultKnowledgeGraph,
        id: 'graph-distributed-systems',
        name: 'Distributed Systems'
      };
      const testGen2 = generateKnowledgeTest(graphB, { questionCount: 3 });
      const t2 = testGen2.test!;

      recordKnowledgeTestCompletion(t1, {}, 60, { graphName: 'Operating Systems' });
      recordKnowledgeTestCompletion(t2, {}, 90, { graphName: 'Distributed Systems' });

      const attemptsGraphA = getAssessmentAttempts({ graphId: 'graph-operating-systems' });
      const attemptsGraphB = getAssessmentAttempts({ graphId: 'graph-distributed-systems' });

      assert.strictEqual(attemptsGraphA.length, 1);
      assert.strictEqual(attemptsGraphB.length, 1);
      assert.notStrictEqual(attemptsGraphA[0].graphId, attemptsGraphB[0].graphId);
    });

    it('safely handles missing graph metadata by assigning fallback unassigned identity', () => {
      assert.ok(
        studyViewSrc.includes("const key = a.graphId || a.graphName || `unassigned-${a.id}`;"),
        'Must handle missing graphId safely without merging into incorrect groups'
      );
    });
  });

  describe('2. Learning Progress Calculation (Normalized Percentage Points)', () => {
    it('computes improvement in percentage points when score improves', () => {
      const attempt1: AssessmentAttempt = {
        id: 'att-1',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-01T10:00:00Z',
        createdAt: '2026-10-01T09:50:00Z',
        scorePercentage: 60,
        correctAnswers: 3,
        totalQuestions: 5,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const attempt2: AssessmentAttempt = {
        id: 'att-2',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-05T10:00:00Z',
        createdAt: '2026-10-05T09:50:00Z',
        scorePercentage: 80,
        correctAnswers: 8,
        totalQuestions: 10,
        timeSpentSeconds: 500,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const comparison = computeProgressComparison(attempt2, attempt1);
      assert.strictEqual(comparison.status, 'improved');
      assert.strictEqual(comparison.diffPoints, 20);
      assert.strictEqual(comparison.previousScore, 60);
      assert.strictEqual(comparison.latestScore, 80);
      assert.strictEqual(comparison.message, 'Improved by 20 percentage points');
    });

    it('computes decline in percentage points when score decreases', () => {
      const attempt1: AssessmentAttempt = {
        id: 'att-1',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-01T10:00:00Z',
        createdAt: '2026-10-01T09:50:00Z',
        scorePercentage: 85,
        correctAnswers: 17,
        totalQuestions: 20,
        timeSpentSeconds: 600,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const attempt2: AssessmentAttempt = {
        id: 'att-2',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-05T10:00:00Z',
        createdAt: '2026-10-05T09:50:00Z',
        scorePercentage: 70,
        correctAnswers: 7,
        totalQuestions: 10,
        timeSpentSeconds: 400,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const comparison = computeProgressComparison(attempt2, attempt1);
      assert.strictEqual(comparison.status, 'declined');
      assert.strictEqual(comparison.diffPoints, 15);
      assert.strictEqual(comparison.message, 'Decreased by 15 percentage points');
    });

    it('computes unchanged status when scores are identical across attempts with different question counts', () => {
      // 4/5 = 80% vs 8/10 = 80%
      const attempt1: AssessmentAttempt = {
        id: 'att-1',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-01T10:00:00Z',
        createdAt: '2026-10-01T09:50:00Z',
        scorePercentage: 80,
        correctAnswers: 4,
        totalQuestions: 5,
        timeSpentSeconds: 150,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const attempt2: AssessmentAttempt = {
        id: 'att-2',
        graphId: 'graph-1',
        graphName: 'Algorithms',
        completedAt: '2026-10-05T10:00:00Z',
        createdAt: '2026-10-05T09:50:00Z',
        scorePercentage: 80,
        correctAnswers: 8,
        totalQuestions: 10,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        userAnswers: {},
        questions: []
      };

      const comparison = computeProgressComparison(attempt2, attempt1);
      assert.strictEqual(comparison.status, 'unchanged');
      assert.strictEqual(comparison.diffPoints, 0);
      assert.strictEqual(comparison.message, 'Unchanged (same score as previous attempt)');
    });
  });

  describe('3. Latest Attempt Presentation & Hierarchy', () => {
    it('presents latest attempt with clear score, correct answers, and date metadata', () => {
      assert.ok(
        studyViewSrc.includes('Latest attempt · Attempt'),
        'Must display latest attempt label with attempt sequence number'
      );
      assert.ok(
        studyViewSrc.includes('Correct answers'),
        'Must include Correct answers label'
      );
      assert.ok(
        studyViewSrc.includes('Score'),
        'Must include Score label'
      );
      assert.ok(
        studyViewSrc.includes('VIEW RESULTS'),
        'Must include VIEW RESULTS action'
      );
    });

    it('displays time expired badge if latest attempt expired', () => {
      assert.ok(
        studyViewSrc.includes("latest.completionReason === 'time_expired'"),
        'Must check if latest attempt completed due to timer expiry'
      );
      assert.ok(
        studyViewSrc.includes('study-badge-expired'),
        'Must style time expired badge'
      );
    });
  });

  describe('4. Previous Attempts Disclosure & Accessibility', () => {
    it('renders disclosure button with total previous attempts count', () => {
      assert.ok(
        studyViewSrc.includes('PREVIOUS ATTEMPTS · {group.previousAttempts.length}'),
        'Must indicate previous attempts count on disclosure button'
      );
      assert.ok(
        studyViewSrc.includes("aria-expanded={isExpanded}"),
        'Must provide accessible aria-expanded attribute'
      );
      assert.ok(
        studyViewSrc.includes("aria-controls={`prev-attempts-${group.graphId}`}"),
        'Must connect disclosure button to panel via aria-controls'
      );
    });

    it('toggles label between VIEW HISTORY and HIDE HISTORY with rotating arrow', () => {
      assert.ok(
        studyViewSrc.includes("{isExpanded ? 'HIDE HISTORY' : 'VIEW HISTORY'}"),
        'Must toggle between VIEW HISTORY and HIDE HISTORY'
      );
      assert.ok(
        studyViewSrc.includes("study-disclosure-arrow ${isExpanded ? 'open' : ''}"),
        'Must toggle .open class on disclosure arrow'
      );
      assert.match(
        studyCss,
        /\.study-disclosure-arrow\.open\s*\{[\s\S]*?transform:\s*rotate\(180deg\);/,
        'CSS must rotate arrow 180deg when open'
      );
    });

    it('supports keyboard navigation on historical rows', () => {
      assert.ok(
        studyViewSrc.includes("tabIndex={0}"),
        'Must enable keyboard focus on attempt rows'
      );
      assert.ok(
        studyViewSrc.includes("e.key === 'Enter' || e.key === ' '"),
        'Must support Enter and Space keys to open historical results'
      );
    });

    it('does not render disclosure toggle if only 1 attempt exists for the graph', () => {
      assert.ok(
        studyViewSrc.includes('{group.previousAttempts.length > 0 && ('),
        'Only render previous attempts section when older attempts actually exist'
      );
    });
  });

  describe('5. Search & Filter Functionality', () => {
    it('provides search input and filter tabs for All and Needs Review', () => {
      assert.ok(
        studyViewSrc.includes('placeholder="Search by graph or concept…"'),
        'Search input must have helpful placeholder'
      );
      assert.ok(
        studyViewSrc.includes('All assessments'),
        'Must have All assessments filter tab'
      );
      assert.ok(
        studyViewSrc.includes('Needs review'),
        'Must have Needs review filter tab'
      );
    });

    it('provides clear search filters CTA when no matches are found', () => {
      assert.ok(
        studyViewSrc.includes('study-search-empty'),
        'Must render search empty state container'
      );
      assert.ok(
        studyViewSrc.includes('Clear search filters'),
        'Must provide Clear search filters action'
      );
    });
  });

  describe('6. Design Tokens & Visual Fidelity', () => {
    it('uses GraphMind design tokens: near-black background, surface, and lime green accent', () => {
      assert.match(
        studyCss,
        /--bg-surface,\s*#101010/,
        'Must use #101010 surface token'
      );
      assert.match(
        studyCss,
        /--border-default,\s*#242424/,
        'Must use #242424 border token'
      );
      assert.match(
        studyCss,
        /--accent,\s*#A3FF12/,
        'Must use #A3FF12 lime green accent'
      );
    });

    it('styles progress comparison with restrained positive, warning, and unchanged tones', () => {
      assert.match(
        studyCss,
        /\.study-progress-comparison\.improved\s*\{[\s\S]*?var\(--accent/
      );
      assert.match(
        studyCss,
        /\.study-progress-comparison\.declined\s*\{[\s\S]*?#F87171/
      );
      assert.match(
        studyCss,
        /\.study-progress-comparison\.unchanged\s*\{[\s\S]*?#A1A1A1/
      );
    });
  });
});

describe('GRAPHMIND STUDY SPACE PROMPT 4 — HISTORICAL RESULTS & ANSWER REVIEW', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const testResultsPath = path.resolve(__dirname, '../src/components/test/TestResultsView.tsx');
  const testResultsSrc = fs.readFileSync(testResultsPath, 'utf8');

  const testReviewPath = path.resolve(__dirname, '../src/components/test/TestReviewView.tsx');
  const testReviewSrc = fs.readFileSync(testReviewPath, 'utf8');

  const missedConceptsPath = path.resolve(__dirname, '../src/components/test/MissedConceptsReview.tsx');
  const missedConceptsSrc = fs.readFileSync(missedConceptsPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  beforeEach(() => {
    storageMap.clear();
    clearAllUserData();
    clearAssessmentHistory();
  });

  describe('1. Immutable Historical Attempt Snapshot', () => {
    it('persists and retrieves exact questions, user answers, and score snapshot', () => {
      const graph = { ...defaultKnowledgeGraph, id: 'graph-arch-1', name: 'Computer Architecture' };
      const testGen = generateKnowledgeTest(graph, { questionCount: 4 });
      const test = testGen.test!;

      // 1 correct, 1 incorrect, 2 unanswered
      const answers: Record<string, string> = {
        [test.questions[0].id]: test.questions[0].correctOptionId,
        [test.questions[1].id]: 'wrong-option-id'
      };

      const summary = recordKnowledgeTestCompletion(test, answers, 110, {
        graphName: 'Computer Architecture',
        completionReason: 'submission'
      });

      const attempt = getAssessmentAttemptById(summary.attemptId!);
      assert.ok(attempt);
      assert.strictEqual(attempt.graphName, 'Computer Architecture');
      assert.strictEqual(attempt.totalQuestions, 4);
      assert.strictEqual(attempt.correctAnswers, 1);
      assert.strictEqual(attempt.scorePercentage, 25);
      assert.strictEqual(attempt.timeSpentSeconds, 110);
      assert.strictEqual(attempt.completionReason, 'submission');

      // Check unanswered questions are strictly preserved as absent
      assert.strictEqual(attempt.userAnswers[test.questions[0].id], test.questions[0].correctOptionId);
      assert.strictEqual(attempt.userAnswers[test.questions[1].id], 'wrong-option-id');
      assert.strictEqual(attempt.userAnswers[test.questions[2].id], undefined);
      assert.strictEqual(attempt.userAnswers[test.questions[3].id], undefined);
    });

    it('does not overwrite or corrupt older attempts when a new assessment completes', () => {
      const graph = { ...defaultKnowledgeGraph, id: 'graph-db-1', name: 'Databases' };
      const t1 = generateKnowledgeTest(graph, { questionCount: 3 }).test!;
      const t2 = { ...generateKnowledgeTest(graph, { questionCount: 3 }).test!, id: 'test-db-2' };

      const s1 = recordKnowledgeTestCompletion(t1, { [t1.questions[0].id]: t1.questions[0].correctOptionId }, 60);
      const s2 = recordKnowledgeTestCompletion(t2, {}, 120);

      const oldAttempt = getAssessmentAttemptById(s1.attemptId!);
      const newAttempt = getAssessmentAttemptById(s2.attemptId!);

      assert.ok(oldAttempt);
      assert.ok(newAttempt);
      assert.strictEqual(oldAttempt.correctAnswers, 1);
      assert.strictEqual(newAttempt.correctAnswers, 0);
      assert.notStrictEqual(oldAttempt.id, newAttempt.id);
    });

    it('reconstructs complete results summary safely via ensureResultsSummary if omitted from legacy record', () => {
      const legacyAttempt: AssessmentAttempt = {
        id: 'legacy-att-99',
        testId: 'legacy-test-99',
        graphId: 'legacy-graph',
        graphName: 'Legacy Systems',
        createdAt: '2026-09-01T10:00:00Z',
        completedAt: '2026-09-01T10:15:00Z',
        totalQuestions: 2,
        correctAnswers: 1,
        scorePercentage: 50,
        timeSpentSeconds: 900,
        completionReason: 'submission',
        questions: [
          {
            id: 'q-leg-1',
            question: 'Question 1',
            options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
            correctOptionId: 'A',
            explanation: 'Why A is correct',
            conceptIds: ['c1'],
            conceptNames: ['Concept 1']
          },
          {
            id: 'q-leg-2',
            question: 'Question 2',
            options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
            correctOptionId: 'B',
            explanation: 'Why B is correct',
            conceptIds: ['c2'],
            conceptNames: ['Concept 2']
          }
        ],
        userAnswers: {
          'q-leg-1': 'A' // correct, q-leg-2 is unanswered
        },
        conceptIds: ['c1', 'c2'],
        conceptNames: ['Concept 1', 'Concept 2'],
        sourceIds: [],
        resultsSummary: undefined as any
      };

      const summary = ensureResultsSummary(legacyAttempt);
      assert.strictEqual(summary.score, 1);
      assert.strictEqual(summary.totalQuestions, 2);
      assert.strictEqual(summary.percentage, 50);
      assert.strictEqual(summary.reviewRecommendedConcepts.length, 1);
      assert.strictEqual(summary.reviewRecommendedConcepts[0].questionId, 'q-leg-2');
      assert.strictEqual(summary.reviewRecommendedConcepts[0].selectedOptionText, 'Unanswered');
      assert.strictEqual(summary.strongConceptNames[0], 'Concept 1');
    });
  });

  describe('2. Navigation Between Historical Sub-Views & URL Route Sync', () => {
    it('syncs attempt ID and sub-views to URL search params', () => {
      assert.ok(
        studyViewSrc.includes("url.searchParams.set('attempt', selectedAttemptId)"),
        'Must sync attempt ID to URL parameter'
      );
      assert.ok(
        studyViewSrc.includes("url.searchParams.set('view', 'answers')"),
        'Must sync answers review subview to URL'
      );
      assert.ok(
        studyViewSrc.includes("url.searchParams.set('view', 'missed')"),
        'Must sync missed review subview to URL'
      );
    });

    it('handles popstate browser back/forward navigation between subviews and list', () => {
      assert.ok(
        studyViewSrc.includes("window.addEventListener('popstate', handlePopState)"),
        'Must attach popstate listener'
      );
      assert.ok(
        studyViewSrc.includes("if (viewParam === 'answers')"),
        'Must restore review-answers view on popstate navigation'
      );
      assert.ok(
        studyViewSrc.includes("if (viewParam === 'missed')"),
        'Must restore review-missed view on popstate navigation'
      );
    });
  });

  describe('3. Display Historical Performance in TestResultsView', () => {
    it('accepts isHistorical and displays saved graph name and completion date', () => {
      assert.ok(
        testResultsSrc.includes('isHistorical?: boolean;'),
        'TestResultsView must accept isHistorical prop'
      );
      assert.ok(
        testResultsSrc.includes('completionDate?: string;'),
        'TestResultsView must accept completionDate prop'
      );
      assert.ok(
        testResultsSrc.includes('results-historical-header-context'),
        'Must render historical header context'
      );
      assert.ok(
        studyCss.includes('.results-historical-header-context'),
        'Must style results-historical-header-context'
      );
    });
  });

  describe('4. Read-Only Review All Answers & All Answer States', () => {
    it('handles correct, incorrect, and unanswered questions clearly', () => {
      assert.ok(
        testReviewSrc.includes("const isUnanswered = !selectedId || selectedId === '';"),
        'Must explicitly detect unanswered questions'
      );
      assert.ok(
        testReviewSrc.includes("isCorrect ? 'CORRECT' : isUnanswered ? 'UNANSWERED' : 'INCORRECT'"),
        'Must display CORRECT, UNANSWERED, and INCORRECT statuses'
      );
      assert.ok(
        testReviewSrc.includes("isUnanswered ? 'Unanswered' : (selectedOption?.text || selectedId)"),
        'Must display Unanswered label in summary for unanswered questions'
      );
    });

    it('does not display empty explanation or fake source quote when metadata is absent', () => {
      assert.ok(
        testReviewSrc.includes('q.explanation &&'),
        'Only render explanation section when explanation exists'
      );
      assert.ok(
        testReviewSrc.includes('q.sourceEvidence &&'),
        'Only render source evidence quote when source evidence exists'
      );
    });
  });

  describe('5. Concept Availability & Graceful Graph Navigation', () => {
    it('gracefully disables graph navigation when concept is not in current active graph', () => {
      assert.ok(
        testReviewSrc.includes('isConceptAvailableInGraph'),
        'TestReviewView must check if concept exists in current graph'
      );
      assert.ok(
        testReviewSrc.includes('Concept not in current graph'),
        'TestReviewView must explain when concept is absent from graph'
      );
      assert.ok(
        missedConceptsSrc.includes('isConceptAvailableInGraph'),
        'MissedConceptsReview must check if concept exists in current graph'
      );
      assert.ok(
        missedConceptsSrc.includes('Concept not in current graph'),
        'MissedConceptsReview must explain when concept is absent from graph'
      );
    });

    it('renders historical results even when knowledge graph is deleted or inaccessible', () => {
      // StudySpaceView passes activeGraph to TestResultsView and TestReviewView, but if activeGraph is null,
      // TestResultsView and TestReviewView still render complete saved snapshot
      assert.ok(
        studyViewSrc.includes('graph={activeGraph}'),
        'Must pass activeGraph safely into results and review views'
      );
    });
  });

  describe('6. Security, Ownership, and Read-Only Guarantees', () => {
    it('renders clean error banner when attempt ID does not exist or access is unauthorized', () => {
      assert.ok(
        studyViewSrc.includes('Assessment attempt could not be found or access was denied.'),
        'Must display restrained error message on missing or unauthorized attempt'
      );
      assert.ok(
        studyViewSrc.includes('Back to Study Space'),
        'Must provide Back to Study Space action'
      );
    });

    it('does not trigger timer countdown, question editing, or assessment submission in review mode', () => {
      // TestReviewView has no input elements, radio groups, countdown timers, or submit handlers
      assert.doesNotMatch(testReviewSrc, /<input/);
      assert.doesNotMatch(testReviewSrc, /recordKnowledgeTestCompletion/);
      assert.doesNotMatch(testReviewSrc, /saveAssessmentAttempt/);
    });
  });
});

