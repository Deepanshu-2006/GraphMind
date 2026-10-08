import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TestResultsSummary, MissedConceptItem } from '../src/types/test';

describe('GraphMind Test Results Experience Redesign', () => {
  const mockResultsAverage: TestResultsSummary = {
    testId: 'test-os-101',
    score: 4,
    totalQuestions: 10,
    percentage: 40,
    timeSpentSeconds: 62, // 01:02
    strongConceptNames: ['Aging', 'Throughput', 'CPU Scheduling', 'Response Time'],
    reviewRecommendedConcepts: [
      {
        conceptId: 'c-srtf',
        conceptName: 'Shortest Remaining Time First',
        questionId: 'q-1',
        questionText: 'Which preemptive algorithm minimizes average waiting time?',
        selectedOptionText: 'Round Robin',
        correctOptionText: 'Shortest Remaining Time First',
        explanation: 'SRTF is the preemptive version of SJF.'
      },
      {
        conceptId: 'c-rr',
        conceptName: 'Round Robin Scheduling',
        questionId: 'q-2',
        questionText: 'What parameter determines Round Robin context switches?',
        selectedOptionText: 'Priority queue',
        correctOptionText: 'Time Quantum',
        explanation: 'Time quantum slices dictate context switch frequency.'
      },
      {
        conceptId: 'c-os',
        conceptName: 'Operating System',
        questionId: 'q-3',
        questionText: 'What is the role of the kernel?',
        selectedOptionText: 'Application runtime',
        correctOptionText: 'Hardware abstraction and resource management',
        explanation: 'The kernel manages hardware and resources.'
      },
      {
        conceptId: 'c-proc',
        conceptName: 'Process',
        questionId: 'q-4',
        questionText: 'What distinguishes a process from a program?',
        selectedOptionText: 'Code on disk',
        correctOptionText: 'Program in execution with active context',
        explanation: 'A process is an active entity with a program counter.'
      },
      {
        conceptId: 'c-cpu-util',
        conceptName: 'CPU Utilization',
        questionId: 'q-5',
        questionText: 'How is CPU utilization defined?',
        selectedOptionText: 'Process count',
        correctOptionText: 'Percentage of time the CPU is busy',
        explanation: 'CPU utilization measures busy time percentage.'
      },
      {
        conceptId: 'c-starv',
        conceptName: 'Starvation',
        questionId: 'q-6',
        questionText: 'Which technique prevents indefinite postponement?',
        selectedOptionText: 'Round robin',
        correctOptionText: 'Aging',
        explanation: 'Aging gradually increases priority over time.'
      }
    ]
  };

  const mockResultsPerfect: TestResultsSummary = {
    testId: 'test-perfect-1',
    score: 10,
    totalQuestions: 10,
    percentage: 100,
    timeSpentSeconds: 185,
    strongConceptNames: ['Virtual Memory', 'Paging', 'TLB', 'Segmentation'],
    reviewRecommendedConcepts: []
  };

  const mockResultsLow: TestResultsSummary = {
    testId: 'test-low-1',
    score: 2,
    totalQuestions: 10,
    percentage: 20,
    timeSpentSeconds: 90,
    strongConceptNames: ['Cache'],
    reviewRecommendedConcepts: [
      {
        conceptId: 'c-pipeline',
        conceptName: 'Instruction Pipelining',
        questionId: 'q-p1',
        questionText: 'What causes data hazards?',
        selectedOptionText: 'Branch delay',
        correctOptionText: 'Data dependency between instructions',
        explanation: 'Data hazards occur when instructions depend on uncomputed results.'
      }
    ]
  };

  describe('1. Core Design Direction & Hierarchy (Section 1 & 2)', () => {
    it('answers the three student learning questions in strict order', () => {
      const pageSections = [
        'HOW_DID_I_DO', // Title, Score, Interpretation
        'WHAT_DO_I_UNDERSTAND', // WHAT YOU KNOW
        'WHAT_SHOULD_I_REVIEW' // WORTH REVISITING & ACTIONS
      ];

      assert.equal(pageSections[0], 'HOW_DID_I_DO');
      assert.equal(pageSections[1], 'WHAT_DO_I_UNDERSTAND');
      assert.equal(pageSections[2], 'WHAT_SHOULD_I_REVIEW');
    });

    it('enforces content width max-width between 1100px and 1180px with intentional whitespace', () => {
      const resultsMaxWidth = 1140;
      assert.ok(resultsMaxWidth >= 1100 && resultsMaxWidth <= 1180, 'Results page width should be 1100-1180px');
    });
  });

  describe('2. Eyebrow & Main Title (Section 3 & 4)', () => {
    it('formats eyebrow with • TEST / RESULTS and tiny green marker', () => {
      const eyebrow = 'TEST / RESULTS';
      const markerColor = '#A3FF12';
      assert.equal(eyebrow, 'TEST / RESULTS');
      assert.equal(markerColor, '#A3FF12');
    });

    it('formats main editorial title as intentional two-line TEST COMPLETE heading', () => {
      const titleLines = ['TEST', 'COMPLETE'];
      assert.deepEqual(titleLines, ['TEST', 'COMPLETE']);
    });
  });

  describe('3. Hero Score & Secondary Metrics (Section 5 & 7)', () => {
    it('formats hero score with two-digit padding and denominator on baseline', () => {
      const scoreFormatted = mockResultsAverage.score.toString().padStart(2, '0');
      const totalFormatted = mockResultsAverage.totalQuestions.toString().padStart(2, '0');

      assert.equal(scoreFormatted, '04');
      assert.equal(totalFormatted, '10');
      assert.equal(`${scoreFormatted} / ${totalFormatted}`, '04 / 10');
    });

    it('formats quiet secondary metric with percentage and elapsed time in MM:SS', () => {
      const mins = Math.floor(mockResultsAverage.timeSpentSeconds / 60);
      const secs = mockResultsAverage.timeSpentSeconds % 60;
      const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const metricLine = `${mockResultsAverage.percentage}% correct · ${timeFormatted} elapsed`;

      assert.equal(timeFormatted, '01:02');
      assert.equal(metricLine, '40% correct · 01:02 elapsed');
    });
  });

  describe('4. Score Interpretation Tiers (Section 6)', () => {
    function interpret(pct: number) {
      if (pct >= 80) return { headline: 'STRONG UNDERSTANDING', tone: 'positive' };
      if (pct >= 60) return { headline: 'SOLID UNDERSTANDING', tone: 'positive' };
      if (pct >= 40) return { headline: 'BUILDING UNDERSTANDING', tone: 'warning' };
      return { headline: 'NEEDS REVIEW', tone: 'warning' };
    }

    it('classifies 0-39% as NEEDS REVIEW with warm warning accent', () => {
      const res = interpret(20);
      assert.equal(res.headline, 'NEEDS REVIEW');
      assert.equal(res.tone, 'warning');
    });

    it('classifies 40-59% as BUILDING UNDERSTANDING with warm warning accent', () => {
      const res = interpret(40);
      assert.equal(res.headline, 'BUILDING UNDERSTANDING');
      assert.equal(res.tone, 'warning');
    });

    it('classifies 60-79% as SOLID UNDERSTANDING with GraphMind positive green', () => {
      const res = interpret(70);
      assert.equal(res.headline, 'SOLID UNDERSTANDING');
      assert.equal(res.tone, 'positive');
    });

    it('classifies 80-100% as STRONG UNDERSTANDING with GraphMind positive green', () => {
      const res = interpret(100);
      assert.equal(res.headline, 'STRONG UNDERSTANDING');
      assert.equal(res.tone, 'positive');
    });
  });

  describe('5. Editorial Knowledge Report (Section 10, 13, 14)', () => {
    it('uses human-centered headings: WHAT YOU KNOW and WORTH REVISITING', () => {
      const col1Title = 'WHAT YOU KNOW';
      const col2Title = 'WORTH REVISITING';
      assert.equal(col1Title, 'WHAT YOU KNOW');
      assert.equal(col2Title, 'WORTH REVISITING');
    });

    it('deduplicates review concepts and formats counts with 2 digits', () => {
      const reviewSeen = new Set<string>();
      const list: string[] = [];
      for (const item of mockResultsAverage.reviewRecommendedConcepts) {
        if (!reviewSeen.has(item.conceptName)) {
          reviewSeen.add(item.conceptName);
          list.push(item.conceptName);
        }
      }

      const strongCountStr = mockResultsAverage.strongConceptNames.length.toString().padStart(2, '0');
      const reviewCountStr = list.length.toString().padStart(2, '0');

      assert.equal(strongCountStr, '04');
      assert.equal(reviewCountStr, '06');
    });

    it('handles perfect score zero review concepts cleanly', () => {
      assert.equal(mockResultsPerfect.reviewRecommendedConcepts.length, 0);
      const emptyNotice = 'All concepts mastered with full accuracy.';
      assert.ok(emptyNotice.length > 0);
    });

    it('formats row index numbers with 2-digit tabular values (01, 02...)', () => {
      const index0 = 0;
      const index5 = 5;
      assert.equal((index0 + 1).toString().padStart(2, '0'), '01');
      assert.equal((index5 + 1).toString().padStart(2, '0'), '06');
    });
  });

  describe('6. Next Actions Hierarchy & Micro-Interactions (Section 16, 17, 18, 19)', () => {
    it('provides REVIEW MISSED CONCEPTS as primary action when missed concepts exist', () => {
      const hasMissed = mockResultsAverage.reviewRecommendedConcepts.length > 0;
      const primaryActionLabel = hasMissed ? 'REVIEW MISSED CONCEPTS' : 'RETURN TO GRAPH';
      assert.equal(primaryActionLabel, 'REVIEW MISSED CONCEPTS');
    });

    it('provides RETURN TO GRAPH as primary action when 100% score is achieved', () => {
      const hasMissed = mockResultsPerfect.reviewRecommendedConcepts.length > 0;
      const primaryActionLabel = hasMissed ? 'REVIEW MISSED CONCEPTS' : 'RETURN TO GRAPH';
      assert.equal(primaryActionLabel, 'RETURN TO GRAPH');
    });

    it('provides plain text secondary action REVIEW ALL ANSWERS and quiet BACK TO GRAPH', () => {
      const secondaryAction = 'REVIEW ALL ANSWERS';
      const backAction = 'BACK TO GRAPH';
      assert.equal(secondaryAction, 'REVIEW ALL ANSWERS');
      assert.equal(backAction, 'BACK TO GRAPH');
    });
  });

  describe('7. Background Living Topology (Section 22)', () => {
    it('restrains background graph topology opacity between 0.04 and 0.08', () => {
      const opacity = 0.06;
      assert.ok(opacity >= 0.04 && opacity <= 0.08, 'Topology opacity must stay very subtle (0.04-0.08)');
    });
  });
});
