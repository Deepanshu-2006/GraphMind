import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssessmentAttempt } from '../src/types/test';
import {
  computeGraphLearningProgress,
  computeProgressComparison
} from '../src/components/study/StudySpaceView';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND STUDY SPACE — KNOWLEDGE GRAPH SELECTOR & FILTERED LEARNING PROGRESS', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Header Layout & Graph Selector Placement (Requirement 2)', () => {
    it('arranges header in a balanced horizontal row on desktop with title on left and selector on right', () => {
      assert.ok(studyViewSrc.includes('study-header-main-row'), 'Must contain header main row');
      assert.ok(studyViewSrc.includes('study-header-left'), 'Must contain header left column');
      assert.ok(studyViewSrc.includes('study-header-right'), 'Must contain header right container');
      assert.ok(studyViewSrc.includes('<StudyGraphSelector'), 'Must render StudyGraphSelector component in header');
    });

    it('styles header with flexbox layout and stacks on narrow screens', () => {
      assert.match(
        studyCss,
        /\.study-header-main-row\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/,
        'Header main row must use flex layout'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*820px\)\s*\{[\s\S]*?\.study-header-main-row\s*\{[\s\S]*?flex-direction:\s*column;/,
        'Header must stack vertically on mobile/narrow screens'
      );
    });

    it('styles selector trigger button with minimal borderless surface, refined typography, and muted chevron', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-trigger\s*\{[\s\S]*?background-color:\s*transparent;[\s\S]*?border:\s*none;/,
        'Trigger must have transparent background and borderless styling'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-pip\s*\{[\s\S]*?background-color:\s*var\(--accent,\s*#A3FF12\);/,
        'Trigger must have subtle lime-green status indicator pip'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-chevron\s*\{[\s\S]*?color:\s*#6E6E6E;/,
        'Chevron must be muted'
      );
    });
  });

  describe('2. Custom Accessible Graph Selector Popover (Requirement 3)', () => {
    it('renders popover with search input, listbox, and keyboard accessibility', () => {
      assert.ok(studyViewSrc.includes('id="study-graph-selector-popover"'), 'Must have popover container');
      assert.ok(studyViewSrc.includes('role="listbox"'), 'Must have listbox role for accessibility');
      assert.ok(studyViewSrc.includes('role="option"'), 'Must have option roles for graphs');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-input'), 'Must have search input');
      assert.ok(studyViewSrc.includes('Search knowledge graphs…'), 'Must have search placeholder');
      assert.ok(studyViewSrc.includes('study-graph-selector-search-clear'), 'Must have clear search button');
    });

    it('supports keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)', () => {
      assert.ok(studyViewSrc.includes("e.key === 'Escape'"), 'Must handle Escape key');
      assert.ok(studyViewSrc.includes("e.key === 'ArrowDown'"), 'Must handle ArrowDown key');
      assert.ok(studyViewSrc.includes("e.key === 'ArrowUp'"), 'Must handle ArrowUp key');
      assert.ok(studyViewSrc.includes("e.key === 'Enter'"), 'Must handle Enter key');
    });

    it('displays truthful metadata: completed assessment count, latest score, or "No assessments yet"', () => {
      assert.ok(studyViewSrc.includes('study-graph-selector-option-meta'));
      assert.ok(studyViewSrc.includes("'No assessments yet'"));
      assert.ok(studyViewSrc.includes('study-graph-selector-option-score'));
    });

    it('styles popover with anchored positioning, z-index, and scroll containment', () => {
      assert.match(
        studyCss,
        /\.study-graph-selector-popover\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?background-color:\s*#111111;[\s\S]*?z-index:\s*100;/,
        'Popover must be absolutely anchored with high z-index'
      );
      assert.match(
        studyCss,
        /\.study-graph-selector-list\s*\{[\s\S]*?max-height:\s*240px;[\s\S]*?overflow-y:\s*auto;/,
        'List must have internal scroll limit'
      );
    });
  });

  describe('3. Single Persistent Learning Progress Section for Selected Graph (Requirement 5)', () => {
    it('renders Learning Progress section conditioned on selectedGraphMeta', () => {
      assert.ok(
        studyViewSrc.includes('{selectedGraphMeta && ('),
        'Must display Learning Progress conditioned on selectedGraphMeta'
      );
    });

    it('renders exactly one LearningTrajectoryRow with key bound to selectedGraphProgress.graphId', () => {
      assert.ok(
        studyViewSrc.includes('key={selectedGraphProgress.graphId}'),
        'Row key must be bound to graphId to trigger clean re-animations upon graph change'
      );
      assert.ok(
        !studyViewSrc.includes('allGraphProgress.map'),
        'Must NOT iterate and stack multiple progress sections vertically'
      );
    });

    it('correctly filters attempt history strictly by graphId', () => {
      const mockAttempts: AssessmentAttempt[] = [
        {
          id: 'att-1',
          testId: 't-1',
          graphId: 'graph-ds',
          graphName: 'Distributed Systems',
          startedAt: '2026-10-09T10:00:00.000Z',
          completedAt: '2026-10-09T10:05:00.000Z',
          scorePercentage: 70,
          totalQuestions: 10,
          correctAnswers: 7,
          incorrectAnswers: 3,
          unansweredCount: 0,
          timeSpentSeconds: 300,
          completionReason: 'submitted',
          questions: [],
          userAnswers: {},
          flaggedQuestionIds: [],
          conceptNames: ['Consensus']
        },
        {
          id: 'att-2',
          testId: 't-2',
          graphId: 'graph-os',
          graphName: 'Operating Systems',
          startedAt: '2026-10-09T11:00:00.000Z',
          completedAt: '2026-10-09T11:05:00.000Z',
          scorePercentage: 85,
          totalQuestions: 10,
          correctAnswers: 8,
          incorrectAnswers: 2,
          unansweredCount: 0,
          timeSpentSeconds: 300,
          completionReason: 'submitted',
          questions: [],
          userAnswers: {},
          flaggedQuestionIds: [],
          conceptNames: ['Virtual Memory']
        }
      ];

      const progDS = computeGraphLearningProgress('graph-ds', mockAttempts);
      const progOS = computeGraphLearningProgress('graph-os', mockAttempts);

      assert.ok(progDS !== null);
      assert.equal(progDS.graphId, 'graph-ds');
      assert.equal(progDS.latestScore, 70);
      assert.equal(progDS.totalAttempts, 1);

      assert.ok(progOS !== null);
      assert.equal(progOS.graphId, 'graph-os');
      assert.equal(progOS.latestScore, 85);
      assert.equal(progOS.totalAttempts, 1);
    });
  });

  describe('4. Graph-Specific Empty States & Edge Cases (Requirement 7)', () => {
    it('returns null from computeGraphLearningProgress for graphs with 0 assessments', () => {
      const prog = computeGraphLearningProgress('graph-empty', []);
      assert.equal(prog, null, 'Must return null when no assessments exist');
    });

    it('renders refined empty state when selected graph has 0 assessments', () => {
      assert.ok(studyViewSrc.includes('study-progress-empty-card'));
      assert.ok(studyViewSrc.includes('study-progress-empty-msg'));
      assert.ok(studyViewSrc.includes('Complete your first assessment to begin tracking your scores'));
      assert.ok(studyViewSrc.includes('study-progress-empty-action'));
    });

    it('truthfully handles legitimate 0% score and 100% score without fabricating data', () => {
      const attempt0: AssessmentAttempt = {
        id: 'att-0',
        testId: 't-0',
        graphId: 'graph-zero',
        graphName: 'Zero Score Graph',
        startedAt: '2026-10-09T10:00:00.000Z',
        completedAt: '2026-10-09T10:05:00.000Z',
        scorePercentage: 0,
        totalQuestions: 10,
        correctAnswers: 0,
        incorrectAnswers: 10,
        unansweredCount: 0,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        questions: [],
        userAnswers: {},
        flaggedQuestionIds: [],
        conceptNames: []
      };

      const progZero = computeGraphLearningProgress('graph-zero', [attempt0]);
      assert.ok(progZero !== null);
      assert.equal(progZero.latestScore, 0);
      assert.equal(progZero.hasComparison, false);

      const attempt100: AssessmentAttempt = {
        id: 'att-100',
        testId: 't-100',
        graphId: 'graph-perfect',
        graphName: 'Perfect Score Graph',
        startedAt: '2026-10-09T10:00:00.000Z',
        completedAt: '2026-10-09T10:05:00.000Z',
        scorePercentage: 100,
        totalQuestions: 10,
        correctAnswers: 10,
        incorrectAnswers: 0,
        unansweredCount: 0,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        questions: [],
        userAnswers: {},
        flaggedQuestionIds: [],
        conceptNames: []
      };

      const prog100 = computeGraphLearningProgress('graph-perfect', [attempt100]);
      assert.ok(prog100 !== null);
      assert.equal(prog100.latestScore, 100);
    });

    it('truthfully formats comparison for 1 attempt vs multiple attempts', () => {
      const att1: AssessmentAttempt = {
        id: 'att-1',
        testId: 't-1',
        graphId: 'graph-multi',
        graphName: 'Multi Attempt Graph',
        startedAt: '2026-10-08T10:00:00.000Z',
        completedAt: '2026-10-08T10:05:00.000Z',
        scorePercentage: 50,
        totalQuestions: 10,
        correctAnswers: 5,
        incorrectAnswers: 5,
        unansweredCount: 0,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        questions: [],
        userAnswers: {},
        flaggedQuestionIds: [],
        conceptNames: []
      };

      const att2: AssessmentAttempt = {
        id: 'att-2',
        testId: 't-2',
        graphId: 'graph-multi',
        graphName: 'Multi Attempt Graph',
        startedAt: '2026-10-09T10:00:00.000Z',
        completedAt: '2026-10-09T10:05:00.000Z',
        scorePercentage: 80,
        totalQuestions: 10,
        correctAnswers: 8,
        incorrectAnswers: 2,
        unansweredCount: 0,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        questions: [],
        userAnswers: {},
        flaggedQuestionIds: [],
        conceptNames: []
      };

      const comp = computeProgressComparison(att2, att1);
      assert.equal(comp.diffPoints, 30);
      assert.equal(comp.status, 'improved');
      assert.equal(comp.message, 'Improved by 30 percentage points');
    });
  });

  describe('5. Assessment History Relationship & Distinct Filtering', () => {
    it('keeps history filters focused on All assessments and Needs review without redundant graph tab', () => {
      assert.ok(studyViewSrc.includes('All assessments'));
      assert.ok(studyViewSrc.includes('Needs review'));
      assert.ok(studyViewSrc.includes('study-filter-tabs'));
    });

    it('provides accessible reset action in search empty state', () => {
      assert.ok(studyViewSrc.includes('Clear search filters'));
      assert.ok(studyViewSrc.includes('No assessments found matching'));
    });
  });

  describe('6. Self-Healing & Fallback on Graph Deletion (Requirement 4)', () => {
    it('implements effectiveSelectedGraphId fallback to first available graph or active context', () => {
      assert.ok(studyViewSrc.includes('effectiveSelectedGraphId'));
      assert.ok(studyViewSrc.includes('availableGraphs.some(g => g.id === selectedGraphId)'));
    });
  });

  describe('7. Synchronized Continue Learning with Selected Graph', () => {
    it('consumes the single source of truth effectiveSelectedGraphId for both Continue Learning and Learning Progress', () => {
      assert.ok(
        studyViewSrc.includes('const selectedGraphAttempts = useMemo<AssessmentAttempt[]>('),
        'Must filter attempts strictly by effectiveSelectedGraphId'
      );
      assert.ok(
        studyViewSrc.includes('return gid === effectiveSelectedGraphId;'),
        'Must match graphId against effectiveSelectedGraphId'
      );
      assert.ok(
        studyViewSrc.includes('const latestAttempt = useMemo<AssessmentAttempt | null>('),
        'Must derive latestAttempt from selectedGraphAttempts'
      );
    });

    it('renders Continue Learning conditioned on selectedGraphMeta', () => {
      assert.ok(
        studyViewSrc.includes('{selectedGraphMeta && ('),
        'Must render Continue Learning section based on selectedGraphMeta'
      );
    });

    it('provides a clean empty state in Continue Learning when selected graph has no assessments', () => {
      assert.ok(studyViewSrc.includes('className="study-continue-empty-body"'));
      assert.ok(studyViewSrc.includes('className="study-continue-empty-msg"'));
      assert.ok(studyViewSrc.includes('Take your first assessment to see how well you understand this graph and discover which concepts need another look.'));
      assert.ok(studyViewSrc.includes('Start an assessment'));
      assert.ok(studyViewSrc.includes('study-continue-circle-track-empty'));
      assert.ok(studyViewSrc.includes('study-continue-empty-dash'));
      assert.ok(studyViewSrc.includes('NO ASSESSMENTS'));
      assert.ok(studyViewSrc.includes('study-continue-rotating-ring'));
    });

    it('restarts score animation and resets hasAnimatedRef when switching between knowledge graphs', () => {
      assert.ok(studyViewSrc.includes('lastAnimatedGraphIdRef.current !== effectiveSelectedGraphId'));
      assert.ok(studyViewSrc.includes('lastAnimatedGraphIdRef.current = effectiveSelectedGraphId;'));
      assert.ok(studyViewSrc.includes('hasAnimatedRef.current = false;'));
      assert.ok(studyViewSrc.includes('key={`circle-arc-${effectiveSelectedGraphId || \'none\'}-${latestAttempt.id}`}'));
    });

    it('includes CSS tokens for Continue Learning empty state and muted orbit track', () => {
      assert.match(
        studyCss,
        /\.study-continue-empty-body\s*\{[\s\S]*?display:\s*flex;[\s\S]*?background:\s*transparent;/,
        'Must style Continue Learning empty body borderless on page background'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-msg\s*\{[\s\S]*?color:\s*var\(--text-secondary,\s*#9CA3AF\);/,
        'Must style Continue Learning empty message with neutral secondary color'
      );
      assert.match(
        studyCss,
        /\.study-continue-circle-track-empty\s*\{[\s\S]*?stroke-dasharray:\s*4\s*8;/,
        'Must style empty orbit track with dashed stroke'
      );
      assert.match(
        studyCss,
        /\.study-continue-circle-track-empty-alt\s*\{[\s\S]*?stroke-dasharray:\s*4\s*8;/,
        'Must style alternate empty orbit track with dashed stroke'
      );
      assert.match(
        studyCss,
        /\.study-continue-empty-dash\s*\{[\s\S]*?color:\s*#555555;/,
        'Must style quiet empty em-dash'
      );
    });

    it('filters attempts strictly by selected graph in mathematical test', () => {
      const mockAttempts: AssessmentAttempt[] = [
        {
          id: 'att-testing-1',
          testId: 't-1',
          graphId: 'graph-testing',
          graphName: 'Testing',
          startedAt: '2026-10-10T10:00:00.000Z',
          completedAt: '2026-10-10T10:05:00.000Z',
          scorePercentage: 80,
          totalQuestions: 10,
          correctAnswers: 8,
          incorrectAnswers: 2,
          unansweredCount: 0,
          timeSpentSeconds: 300,
          completionReason: 'submitted',
          questions: [],
          userAnswers: {},
          flaggedQuestionIds: [],
          conceptNames: ['Unit Testing']
        },
        {
          id: 'att-os-1',
          testId: 't-2',
          graphId: 'graph-os',
          graphName: 'Operating Systems',
          startedAt: '2026-10-10T11:00:00.000Z',
          completedAt: '2026-10-10T11:05:00.000Z',
          scorePercentage: 90,
          totalQuestions: 10,
          correctAnswers: 9,
          incorrectAnswers: 1,
          unansweredCount: 0,
          timeSpentSeconds: 300,
          completionReason: 'submitted',
          questions: [],
          userAnswers: {},
          flaggedQuestionIds: [],
          conceptNames: ['Virtual Memory']
        }
      ];

      // Operating Systems selected: only OS attempts returned
      const osAttempts = mockAttempts.filter(a => (a.graphId || `unassigned-${a.id}`) === 'graph-os');
      assert.equal(osAttempts.length, 1);
      assert.equal(osAttempts[0].graphName, 'Operating Systems');
      assert.equal(osAttempts[0].scorePercentage, 90);

      // Testing selected: only Testing attempts returned
      const testAttempts = mockAttempts.filter(a => (a.graphId || `unassigned-${a.id}`) === 'graph-testing');
      assert.equal(testAttempts.length, 1);
      assert.equal(testAttempts[0].graphName, 'Testing');
      assert.equal(testAttempts[0].scorePercentage, 80);

      // Graph with 0 assessments selected: empty list returned
      const emptyAttempts = mockAttempts.filter(a => (a.graphId || `unassigned-${a.id}`) === 'graph-empty');
      assert.equal(emptyAttempts.length, 0);

      // Legitimate 0% attempt: non-null attempt with 0% score preserved
      const zeroAttempt: AssessmentAttempt = {
        id: 'att-zero-1',
        testId: 't-3',
        graphId: 'graph-zero',
        graphName: 'Zero Graph',
        startedAt: '2026-10-10T12:00:00.000Z',
        completedAt: '2026-10-10T12:05:00.000Z',
        scorePercentage: 0,
        totalQuestions: 10,
        correctAnswers: 0,
        incorrectAnswers: 10,
        unansweredCount: 0,
        timeSpentSeconds: 300,
        completionReason: 'submitted',
        questions: [],
        userAnswers: {},
        flaggedQuestionIds: [],
        conceptNames: []
      };
      const zeroAttempts = [zeroAttempt].filter(a => (a.graphId || `unassigned-${a.id}`) === 'graph-zero');
      assert.equal(zeroAttempts.length, 1);
      assert.equal(zeroAttempts[0].scorePercentage, 0);
    });
  });
});
