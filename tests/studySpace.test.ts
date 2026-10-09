import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  formatAttemptDate, 
  formatDuration 
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
