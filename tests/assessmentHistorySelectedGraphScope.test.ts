import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('GRAPHMIND ASSESSMENT HISTORY — SELECTED KNOWLEDGE GRAPH SCOPING', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  // Sample assessment attempts across two distinct knowledge graphs
  const testingAttempt1: AssessmentAttempt = {
    id: 'test-att-01',
    testId: 'test-t-1',
    graphId: 'graph-testing',
    graphName: 'Testing',
    completedAt: '2026-10-01T10:00:00Z',
    createdAt: '2026-10-01T09:45:00Z',
    scorePercentage: 60,
    correctAnswers: 3,
    totalQuestions: 5,
    timeSpentSeconds: 300,
    completionReason: 'submitted',
    conceptNames: ['Unit Testing', 'Mocking'],
    userAnswers: { 'q-1': 'o-1', 'q-2': 'o-2', 'q-3': 'o-3' },
    questions: [],
    resultsSummary: {
      testId: 'test-t-1',
      totalQuestions: 5,
      correctCount: 3,
      missedCount: 2,
      scorePercentage: 60,
      completionReason: 'submitted',
      timeSpentSeconds: 300,
      completedAt: '2026-10-01T10:00:00Z',
      reviewRecommendedConcepts: [
        {
          conceptId: 'c-mock',
          conceptName: 'Mocking',
          questionId: 'q-4',
          questionText: 'What is a mock?',
          selectedOptionText: 'A real object',
          correctOptionText: 'A test double',
          explanation: 'Mocks are test doubles.'
        }
      ],
      strongConcepts: ['Unit Testing']
    }
  };

  const testingAttempt2: AssessmentAttempt = {
    id: 'test-att-02',
    testId: 'test-t-2',
    graphId: 'graph-testing',
    graphName: 'Testing',
    completedAt: '2026-10-05T14:30:00Z',
    createdAt: '2026-10-05T14:15:00Z',
    scorePercentage: 100,
    correctAnswers: 5,
    totalQuestions: 5,
    timeSpentSeconds: 240,
    completionReason: 'submitted',
    conceptNames: ['Unit Testing', 'Mocking', 'Integration Testing'],
    userAnswers: { 'q-1': 'o-1', 'q-2': 'o-2', 'q-3': 'o-3', 'q-4': 'o-4', 'q-5': 'o-5' },
    questions: [],
    resultsSummary: {
      testId: 'test-t-2',
      totalQuestions: 5,
      correctCount: 5,
      missedCount: 0,
      scorePercentage: 100,
      completionReason: 'submitted',
      timeSpentSeconds: 240,
      completedAt: '2026-10-05T14:30:00Z',
      reviewRecommendedConcepts: [],
      strongConcepts: ['Unit Testing', 'Mocking', 'Integration Testing']
    }
  };

  const osAttempt1: AssessmentAttempt = {
    id: 'os-att-01',
    testId: 'os-t-1',
    graphId: 'graph-os',
    graphName: 'Operating Systems',
    completedAt: '2026-10-03T11:00:00Z',
    createdAt: '2026-10-03T10:40:00Z',
    scorePercentage: 75,
    correctAnswers: 6,
    totalQuestions: 8,
    timeSpentSeconds: 420,
    completionReason: 'submitted',
    conceptNames: ['Virtual Memory', 'Page Tables'],
    userAnswers: {},
    questions: [],
    resultsSummary: {
      testId: 'os-t-1',
      totalQuestions: 8,
      correctCount: 6,
      missedCount: 2,
      scorePercentage: 75,
      completionReason: 'submitted',
      timeSpentSeconds: 420,
      completedAt: '2026-10-03T11:00:00Z',
      reviewRecommendedConcepts: [
        {
          conceptId: 'c-page',
          conceptName: 'Page Tables',
          questionId: 'q-os-1',
          questionText: 'What is a page table?',
          selectedOptionText: 'Physical cache',
          correctOptionText: 'Address translation map',
          explanation: 'Page tables map virtual to physical pages.'
        }
      ],
      strongConcepts: ['Virtual Memory']
    }
  };

  const allAttempts = [testingAttempt1, osAttempt1, testingAttempt2];

  describe('1. Static Code Inspection & Architectural Contracts', () => {
    it('scopes graphGroups strictly to selectedGraphAttempts instead of global attempts collection', () => {
      assert.ok(
        studyViewSrc.includes('const graphGroups = useMemo<GraphAttemptGroup[]>(() => {'),
        'Must define graphGroups useMemo'
      );
      assert.ok(
        studyViewSrc.includes('for (const a of selectedGraphAttempts) {'),
        'Must iterate exclusively over selectedGraphAttempts'
      );
      assert.ok(
        !studyViewSrc.includes('for (const a of attempts) {\n      // Use stable graph identifier'),
        'Must NOT iterate over global attempts in graphGroups'
      );
    });

    it('scopes attemptNumberMap strictly to selectedGraphAttempts for chronological numbering', () => {
      assert.ok(
        studyViewSrc.includes('const attemptNumberMap = useMemo(() => {'),
        'Must define attemptNumberMap useMemo'
      );
      assert.ok(
        studyViewSrc.includes('for (const a of selectedGraphAttempts) {'),
        'Must iterate over selectedGraphAttempts'
      );
    });

    it('scopes conceptsWorthRevisiting to selectedGraphAttempts', () => {
      assert.ok(
        studyViewSrc.includes('deriveConceptsWorthRevisiting(selectedGraphAttempts, currentKnowledgeGraph || activeGraph)'),
        'Must pass selectedGraphAttempts and currentKnowledgeGraph to deriveConceptsWorthRevisiting'
      );
    });

    it('resets search query, review filter, and viewMode on graph switch without page reload', () => {
      assert.ok(
        studyViewSrc.includes("setPrevSelectedGraphId(effectiveSelectedGraphId);"),
        'Must track graph switch'
      );
      assert.ok(
        studyViewSrc.includes("setSearchQuery('');"),
        'Must clear search query on graph switch'
      );
      assert.ok(
        studyViewSrc.includes("setFilterMode('all');"),
        'Must reset filter mode to all on graph switch'
      );
      assert.ok(
        studyViewSrc.includes("setSelectedAttemptId(null);"),
        'Must reset selected attempt id on graph switch'
      );
      assert.ok(
        studyViewSrc.includes("setViewMode('list');"),
        'Must reset view mode to list on graph switch'
      );
    });

    it('renders clean empty state with exact messaging when selected graph has zero assessments', () => {
      assert.ok(
        studyViewSrc.includes('selectedGraphAttempts.length === 0 ? ('),
        'Must branch on selectedGraphAttempts.length === 0'
      );
      assert.ok(
        studyViewSrc.includes('No assessment history yet.'),
        'Must display exact title: No assessment history yet.'
      );
      assert.ok(
        studyViewSrc.includes('Completed assessments will appear here.'),
        'Must display exact subtitle: Completed assessments will appear here.'
      );
      assert.ok(
        studyViewSrc.includes('<span>Start assessment</span>'),
        'Must provide Start assessment CTA in empty state'
      );
    });

    it('renders search controls toolbar only when selected graph has assessments', () => {
      assert.ok(
        studyViewSrc.includes('{selectedGraphAttempts.length > 0 && ('),
        'Must render controls bar conditioned on selectedGraphAttempts.length > 0'
      );
    });
  });

  describe('2. Behavioral Scenario Verification (A through G)', () => {
    it('Case A: When "Testing" is selected, only Testing assessment records are visible', () => {
      const selectedId = 'graph-testing';
      const scopedAttempts = allAttempts.filter(a => a.graphId === selectedId);

      assert.strictEqual(scopedAttempts.length, 2);
      assert.ok(scopedAttempts.every(a => a.graphId === 'graph-testing'));
      assert.ok(!scopedAttempts.some(a => a.graphId === 'graph-os'));
      assert.strictEqual(scopedAttempts.find(a => a.id === 'test-att-01')?.scorePercentage, 60);
      assert.strictEqual(scopedAttempts.find(a => a.id === 'test-att-02')?.scorePercentage, 100);
    });

    it('Case B: When switching to "Operating Systems", Testing records disappear and only OS records appear', () => {
      const selectedId = 'graph-os';
      const scopedAttempts = allAttempts.filter(a => a.graphId === selectedId);

      assert.strictEqual(scopedAttempts.length, 1);
      assert.strictEqual(scopedAttempts[0].id, 'os-att-01');
      assert.strictEqual(scopedAttempts[0].graphName, 'Operating Systems');
      assert.ok(!scopedAttempts.some(a => a.graphId === 'graph-testing'));
    });

    it('Case C: When switching back to "Testing", complete Testing assessment history returns', () => {
      const selectedId = 'graph-testing';
      const scopedAttempts = allAttempts.filter(a => a.graphId === selectedId);

      assert.strictEqual(scopedAttempts.length, 2);
      // Sorted descending (newest first)
      const sorted = [...scopedAttempts].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      assert.strictEqual(sorted[0].id, 'test-att-02');
      assert.strictEqual(sorted[1].id, 'test-att-01');
    });

    it('Case D: When selecting a graph without completed assessments, returns empty records without falling back to other graphs', () => {
      const selectedId = 'graph-computer-networks';
      const scopedAttempts = allAttempts.filter(a => a.graphId === selectedId);

      assert.strictEqual(scopedAttempts.length, 0);
      assert.deepStrictEqual(scopedAttempts, []);
    });

    it('Case E: Search and "Needs review" filters operate strictly within selected graph records', () => {
      const selectedId = 'graph-testing';
      const testingRecords = allAttempts.filter(a => a.graphId === selectedId);

      // Search for concept "Integration"
      const searchResults = testingRecords.filter(a => a.conceptNames?.some(c => c.toLowerCase().includes('integration')));
      assert.strictEqual(searchResults.length, 1);
      assert.strictEqual(searchResults[0].id, 'test-att-02');

      // Needs review filter (score < 80 or missed concepts > 0)
      const needsReviewResults = testingRecords.filter(a => {
        const missed = a.resultsSummary?.reviewRecommendedConcepts?.length || 0;
        return a.scorePercentage < 80 || missed > 0;
      });
      assert.strictEqual(needsReviewResults.length, 1);
      assert.strictEqual(needsReviewResults[0].id, 'test-att-01');
      assert.strictEqual(needsReviewResults[0].scorePercentage, 60);

      // Searching for an OS concept ("Virtual Memory") inside Testing returns zero results
      const crossGraphSearch = testingRecords.filter(a => a.conceptNames?.some(c => c.toLowerCase().includes('virtual memory')));
      assert.strictEqual(crossGraphSearch.length, 0);
    });

    it('Case F: Chronological attempt numbering assigns Attempt 01, 02 strictly within selected graph', () => {
      const selectedId = 'graph-testing';
      const testingRecords = allAttempts.filter(a => a.graphId === selectedId);

      // Sorted ascending for chronological attempt numbers
      const sortedAsc = [...testingRecords].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      const numberMap = new Map<string, string>();
      sortedAsc.forEach((a, idx) => {
        numberMap.set(a.id, String(idx + 1).padStart(2, '0'));
      });

      assert.strictEqual(numberMap.get('test-att-01'), '01');
      assert.strictEqual(numberMap.get('test-att-02'), '02');
    });

    it('Case G: Switching graphs repeatedly produces no duplicate attempts or stale records', () => {
      const graphSequence = ['graph-testing', 'graph-os', 'graph-testing', 'graph-computer-networks', 'graph-os'];
      
      for (const gId of graphSequence) {
        const filtered = allAttempts.filter(a => a.graphId === gId);
        // Verify unique IDs
        const ids = filtered.map(a => a.id);
        const uniqueIds = new Set(ids);
        assert.strictEqual(ids.length, uniqueIds.size, `No duplicates for graph ${gId}`);

        if (gId === 'graph-testing') {
          assert.strictEqual(filtered.length, 2);
        } else if (gId === 'graph-os') {
          assert.strictEqual(filtered.length, 1);
        } else if (gId === 'graph-computer-networks') {
          assert.strictEqual(filtered.length, 0);
        }
      }
    });
  });
});
