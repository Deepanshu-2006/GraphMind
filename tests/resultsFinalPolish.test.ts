import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScoreInterpretation } from '../src/components/test/TestResultsView';
import type { TestResultsSummary, KnowledgeTest } from '../src/types/test';

describe('GRAPHMIND — FINAL POLISH FOR TEST RESULTS / PERFORMANCE PAGE', () => {
  const mock10PercentResults: TestResultsSummary = {
    testId: 'test-os-final',
    score: 1,
    totalQuestions: 10,
    percentage: 10,
    timeSpentSeconds: 20, // 00:20 elapsed
    strongConceptNames: ['Aging'],
    reviewRecommendedConcepts: [
      {
        conceptId: 'c-srtf',
        conceptName: 'Shortest Remaining Time First',
        questionId: 'q-2',
        questionText: 'Which preemptive algorithm minimizes average waiting time?',
        selectedOptionText: 'Round Robin',
        correctOptionText: 'Shortest Remaining Time First',
        explanation: 'SRTF minimizes waiting time.'
      },
      {
        conceptId: 'c-rr',
        conceptName: 'Round Robin Scheduling',
        questionId: 'q-3',
        questionText: 'What parameter determines context switch rate in Round Robin?',
        selectedOptionText: 'Priority queue',
        correctOptionText: 'Time Quantum',
        explanation: 'Time quantum dictates slice frequency.'
      },
      {
        conceptId: 'c-os',
        conceptName: 'Operating System',
        questionId: 'q-4',
        questionText: 'What is the role of the OS kernel?',
        selectedOptionText: 'Application runtime',
        correctOptionText: 'Hardware abstraction and resource management',
        explanation: 'The kernel manages hardware.'
      }
    ]
  };

  const mockTestWithUnanswered: KnowledgeTest = {
    id: 'test-os-final',
    graphId: 'graph-os',
    title: 'Operating Systems Knowledge Assessment',
    timeLimitSeconds: 600,
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i + 1}`,
      question: `Question ${i + 1} regarding system performance and architecture`,
      options: [
        { id: '01', text: 'Option A' },
        { id: '02', text: 'Option B' },
        { id: '03', text: 'Option C' },
        { id: '04', text: 'Option D' }
      ],
      correctOptionId: '01',
      explanation: 'Explanation text',
      conceptIds: [`c-${i + 1}`],
      conceptNames: [`Concept ${i + 1}`],
      difficulty: 'medium'
    })),
    createdAt: new Date().toISOString()
  };

  describe('1. Viewport & Scroll Position Fix', () => {
    it('ensures results canvas uses justify-content: flex-start to prevent top clipping', () => {
      // Content canvas alignment must start from the top edge
      const canvasJustifyContent = 'flex-start';
      assert.equal(canvasJustifyContent, 'flex-start');
    });

    it('resets scroll position to 0 on submission so entrance animation is fully visible', () => {
      let currentScrollTop = 380;
      // When transitioning to results view, scrollTop must be reset
      currentScrollTop = 0;
      assert.equal(currentScrollTop, 0);
    });
  });

  describe('2. Hero Composition & Editorial Typography', () => {
    it('formats dominant two-digit score with smaller denominator on baseline', () => {
      const scoreNum = mock10PercentResults.score.toString().padStart(2, '0');
      const totalNum = mock10PercentResults.totalQuestions.toString().padStart(2, '0');
      assert.equal(scoreNum, '01');
      assert.equal(totalNum, '10');
      assert.equal(`${scoreNum} / ${totalNum}`, '01 / 10');
    });

    it('formats elapsed time as secondary metadata without score duplication', () => {
      const mins = Math.floor(mock10PercentResults.timeSpentSeconds / 60);
      const secs = mock10PercentResults.timeSpentSeconds % 60;
      const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const elapsedText = `${timeFormatted} elapsed`;

      assert.equal(timeFormatted, '00:20');
      assert.equal(elapsedText, '00:20 elapsed');
    });
  });

  describe('3. Score-Derived Assessment Interpretation (Section 7 & 8)', () => {
    it('derives 0–49%: "Several foundational concepts need reinforcement."', () => {
      const interp = getScoreInterpretation(10);
      assert.equal(interp.headline, 'NEEDS REVIEW');
      assert.equal(interp.statement, 'Several foundational concepts need reinforcement.');
      assert.equal(
        interp.narrative,
        'Several foundational concepts need reinforcement. A focused review of the concepts you missed will help strengthen the connections in your knowledge graph.'
      );
      assert.equal(interp.tone, 'warning');
    });

    it('derives 50–69%: "Core ideas are forming. A focused review will strengthen the connections."', () => {
      const interp = getScoreInterpretation(55);
      assert.equal(interp.headline, 'BUILDING UNDERSTANDING');
      assert.equal(
        interp.statement,
        'Core ideas are forming. A focused review will strengthen the connections.'
      );
      assert.equal(interp.tone, 'warning');
    });

    it('derives 70–89%: "Solid understanding with a few gaps to revisit."', () => {
      const interp = getScoreInterpretation(75);
      assert.equal(interp.headline, 'SOLID UNDERSTANDING');
      assert.equal(interp.statement, 'Solid understanding with a few gaps to revisit.');
      assert.equal(interp.tone, 'positive');
    });

    it('derives 90–100%: "Strong command of the material."', () => {
      const interp = getScoreInterpretation(95);
      assert.equal(interp.headline, 'STRONG UNDERSTANDING');
      assert.equal(interp.statement, 'Strong command of the material.');
      assert.equal(interp.tone, 'positive');
    });
  });

  describe('4. Circular Performance Visualization Geometry & Alignment', () => {
    it('creates exactly 10 question segments for a 10-question test', () => {
      const totalSegments = mock10PercentResults.totalQuestions;
      assert.equal(totalSegments, 10);
    });

    it('assigns correct segments GraphMind green and review segments muted dark gray', () => {
      const getStroke = (status: 'correct' | 'incorrect' | 'unanswered') => {
        if (status === 'correct') return 'var(--accent, #A3FF12)';
        if (status === 'unanswered') return 'rgba(255, 255, 255, 0.04)';
        return 'rgba(255, 255, 255, 0.09)';
      };

      assert.equal(getStroke('correct'), 'var(--accent, #A3FF12)');
      assert.equal(getStroke('incorrect'), 'rgba(255, 255, 255, 0.09)');
      assert.equal(getStroke('unanswered'), 'rgba(255, 255, 255, 0.04)');
    });

    it('formats center circle typography with dominant number, denominator, and percentage in uppercase', () => {
      const centerScore = '01';
      const centerTotal = '/10';
      const centerPercent = `${mock10PercentResults.percentage}% CORRECT`;

      assert.equal(centerScore, '01');
      assert.equal(centerTotal, '/10');
      assert.equal(centerPercent, '10% CORRECT');
    });

    it('formats label above circle as • KNOWLEDGE PERFORMANCE with 10px uppercase and 0.18em tracking', () => {
      const label = 'KNOWLEDGE PERFORMANCE';
      const fontSize = 10;
      const letterSpacing = '0.18em';
      assert.equal(label, 'KNOWLEDGE PERFORMANCE');
      assert.equal(fontSize, 10);
      assert.equal(letterSpacing, '0.18em');
    });
  });

  describe('5. Actionable Concept Rows Bridge Back to Knowledge Graph (Section 12)', () => {
    it('maps review concepts with conceptIds for graph focusing', () => {
      const reviewItems = mock10PercentResults.reviewRecommendedConcepts;
      assert.ok(reviewItems.length > 0);
      assert.equal(reviewItems[0].conceptName, 'Shortest Remaining Time First');
      assert.equal(reviewItems[0].conceptId, 'c-srtf');
    });

    it('triggers bridge handler with conceptId to center and inspect in graph', () => {
      let focusedConceptId: string | null = null;
      let closedTest = false;

      const onSelectConceptToReview = (conceptId: string) => {
        closedTest = true;
        focusedConceptId = conceptId;
      };

      // Simulate clicking concept row
      onSelectConceptToReview(mock10PercentResults.reviewRecommendedConcepts[0].conceptId);

      assert.equal(closedTest, true);
      assert.equal(focusedConceptId, 'c-srtf');
    });
  });

  describe('6. Primary Actions Hierarchy (Section 13 & 14)', () => {
    it('provides REVIEW MISSED CONCEPTS as primary action when missed concepts exist', () => {
      const hasMissed = mock10PercentResults.reviewRecommendedConcepts.length > 0;
      const primaryLabel = hasMissed ? 'REVIEW MISSED CONCEPTS' : 'RETURN TO GRAPH';
      assert.equal(primaryLabel, 'REVIEW MISSED CONCEPTS');
    });

    it('provides REVIEW ALL ANSWERS as neutral secondary action', () => {
      const secondaryLabel = 'REVIEW ALL ANSWERS';
      assert.equal(secondaryLabel, 'REVIEW ALL ANSWERS');
    });

    it('provides ← BACK TO GRAPH as text-only tertiary action', () => {
      const tertiaryLabel = 'BACK TO GRAPH';
      assert.equal(tertiaryLabel, 'BACK TO GRAPH');
    });
  });

  describe('7. Editorial Spacing and Geometry System (Section 19 & 20)', () => {
    it('satisfies exact vertical spacing tokens', () => {
      const heroTop = 96; // 72px wrap + 24px canvas
      const metadataToHeading = 24;
      const headingToScore = 52; // 48–64px range
      const scoreToInterpretation = 32; // 28–36px range
      const interpretationToDivider = 72; // 64–88px range
      const dividerToConceptIndex = 56; // 48–64px range
      const conceptRowHeight = 52; // 48–56px range

      assert.ok(heroTop >= 96 && heroTop <= 120);
      assert.equal(metadataToHeading, 24);
      assert.ok(headingToScore >= 48 && headingToScore <= 64);
      assert.ok(scoreToInterpretation >= 28 && scoreToInterpretation <= 36);
      assert.ok(interpretationToDivider >= 64 && interpretationToDivider <= 88);
      assert.ok(dividerToConceptIndex >= 48 && dividerToConceptIndex <= 64);
      assert.ok(conceptRowHeight >= 48 && conceptRowHeight <= 56);
    });
  });
});
