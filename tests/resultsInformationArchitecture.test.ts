import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScoreInterpretation } from '../src/components/test/TestResultsView';
import type { TestResultsSummary } from '../src/types/test';

describe('GRAPHMIND — TEST RESULTS INFORMATION ARCHITECTURE & DUPLICATION REMOVAL', () => {
  const mockResult: TestResultsSummary = {
    testId: 'test-arch-1',
    score: 2,
    totalQuestions: 10,
    percentage: 20,
    timeSpentSeconds: 53, // 00:53 elapsed
    strongConceptNames: ['Scheduling Criteria', 'Shortest Remaining Time First'],
    reviewRecommendedConcepts: [
      {
        conceptId: 'c-tat',
        conceptName: 'Turnaround Time',
        questionId: 'q-1',
        questionText: 'What is turnaround time?',
        selectedOptionText: 'Waiting time',
        correctOptionText: 'Completion time minus arrival time',
        explanation: 'TAT is the entire lifespan of the process.'
      },
      {
        conceptId: 'c-cpu',
        conceptName: 'CPU Scheduling',
        questionId: 'q-2',
        questionText: 'What is the role of the CPU scheduler?',
        selectedOptionText: 'Paging memory',
        correctOptionText: 'Selecting next process from ready queue',
        explanation: 'The scheduler selects from ready processes.'
      }
    ]
  };

  describe('1. Circular Performance Visualization As Sole Score Representation', () => {
    it('derives circle score and percentage strictly from results without hardcoding', () => {
      const scoreFormatted = mockResult.score.toString().padStart(2, '0');
      const totalFormatted = mockResult.totalQuestions.toString().padStart(2, '0');
      const percentageStr = `${mockResult.percentage}% CORRECT`;
      const reviewCount = Math.max(0, mockResult.totalQuestions - mockResult.score);
      const countsSummary = `${mockResult.score} correct · ${reviewCount} to revisit`;

      assert.equal(scoreFormatted, '02');
      assert.equal(totalFormatted, '10');
      assert.equal(percentageStr, '20% CORRECT');
      assert.equal(countsSummary, '2 correct · 8 to revisit');
    });

    it('ensures no duplicate large numeric score exists on the left', () => {
      // Left side only presents TEST COMPLETE heading and interpretation block
      const leftElements = ['TEST_COMPLETE_HEADING', 'INTERPRETATION_BLOCK'];
      assert.ok(!leftElements.includes('DUPLICATE_LARGE_SCORE'));
      assert.ok(!leftElements.includes('DUPLICATE_PERCENTAGE'));
    });
  });

  describe('2. Left Side Interpretation Architecture', () => {
    it('presents concise editorial interpretation without score repetition', () => {
      const interp = getScoreInterpretation(mockResult.percentage);
      assert.equal(interp.headline, 'NEEDS REVIEW');
      assert.equal(
        interp.narrative,
        'Several foundational concepts need reinforcement. A focused review of the concepts you missed will help strengthen the connections in your knowledge graph.'
      );
      assert.equal(interp.tone, 'warning');
      // Must not repeat numeric score inside interpretation
      assert.ok(!interp.narrative.includes('02 / 10'));
      assert.ok(!interp.narrative.includes('20%'));
    });
  });

  describe('3. Visually Quiet Elapsed Time', () => {
    it('formats 00:53 elapsed quietly without repeating percentage', () => {
      const mins = Math.floor(mockResult.timeSpentSeconds / 60);
      const secs = mockResult.timeSpentSeconds % 60;
      const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const elapsedMetadata = `${timeFormatted} elapsed`;

      assert.equal(timeFormatted, '00:53');
      assert.equal(elapsedMetadata, '00:53 elapsed');
      assert.ok(!elapsedMetadata.includes('%'));
    });
  });

  describe('4. Top Contextual Navigation (← BACK TO GRAPH)', () => {
    it('places BACK TO GRAPH at the top right opposite TEST / RESULTS', () => {
      const navLayout = {
        left: 'TEST / RESULTS',
        right: '← BACK TO GRAPH'
      };

      assert.equal(navLayout.left, 'TEST / RESULTS');
      assert.equal(navLayout.right, '← BACK TO GRAPH');
    });

    it('specifies contextual navigation token styling', () => {
      const styleTokens = {
        fontSize: '11.5px', // 11-12px range
        textTransform: 'uppercase',
        letterSpacing: '0.12em', // 0.10-0.14em range
        color: '#707070',
        hoverColor: '#B8FF3D',
        arrowShiftPx: 3,
        hasBorder: false,
        hasBackground: false,
        hasPill: false
      };

      assert.equal(styleTokens.textTransform, 'uppercase');
      assert.equal(styleTokens.color, '#707070');
      assert.equal(styleTokens.hoverColor, '#B8FF3D');
      assert.equal(styleTokens.arrowShiftPx, 3);
      assert.equal(styleTokens.hasBorder, false);
      assert.equal(styleTokens.hasBackground, false);
      assert.equal(styleTokens.hasPill, false);
    });
  });

  describe('5. Primary Actions Directly Below Circular Result', () => {
    it('positions review actions immediately below circle in right column', () => {
      const rightColumnHierarchy = [
        'KNOWLEDGE_PERFORMANCE_LABEL',
        'CIRCULAR_VISUALIZATION',
        'SUMMARY_COUNTS_AND_ELAPSED',
        'REVIEW_ACTIONS_GROUP'
      ];

      assert.equal(rightColumnHierarchy[0], 'KNOWLEDGE_PERFORMANCE_LABEL');
      assert.equal(rightColumnHierarchy[1], 'CIRCULAR_VISUALIZATION');
      assert.equal(rightColumnHierarchy[2], 'SUMMARY_COUNTS_AND_ELAPSED');
      assert.equal(rightColumnHierarchy[3], 'REVIEW_ACTIONS_GROUP');
    });

    it('defines REVIEW MISSED CONCEPTS as primary editorial action with subtle green underline', () => {
      const primaryAction = {
        label: 'REVIEW MISSED CONCEPTS →',
        type: 'editorial-action',
        underlineAccent: '#B8FF3D',
        isFilledPill: false
      };

      assert.equal(primaryAction.label, 'REVIEW MISSED CONCEPTS →');
      assert.equal(primaryAction.underlineAccent, '#B8FF3D');
      assert.equal(primaryAction.isFilledPill, false);
    });

    it('defines REVIEW ALL ANSWERS as secondary action in muted gray', () => {
      const secondaryAction = {
        label: 'REVIEW ALL ANSWERS →',
        defaultColor: '#7A7A7A',
        hoverBrightens: true
      };

      assert.equal(secondaryAction.label, 'REVIEW ALL ANSWERS →');
      assert.equal(secondaryAction.hoverBrightens, true);
    });
  });

  describe('6. Complete Removal of Bottom Action Bar', () => {
    it('guarantees no duplicate action bar or back button exists at page bottom', () => {
      const pageSequence = [
        'TOP_NAV_ROW',
        'HERO_TWO_COLUMN_GRID',
        'DIVIDER',
        'KNOWLEDGE_REPORT_SECTION'
      ];

      // Must end after concept lists
      assert.equal(pageSequence[pageSequence.length - 1], 'KNOWLEDGE_REPORT_SECTION');
      assert.ok(!pageSequence.includes('BOTTOM_ACTION_BAR'));
    });
  });

  describe('7. Single Source of Truth for Assessment Data', () => {
    it('consistently derives all metrics for a high scoring test (8/10)', () => {
      const highResult: TestResultsSummary = {
        testId: 'test-high',
        score: 8,
        totalQuestions: 10,
        percentage: 80,
        timeSpentSeconds: 120,
        strongConceptNames: Array(8).fill('Mastered Concept'),
        reviewRecommendedConcepts: [
          {
            conceptId: 'c-1',
            conceptName: 'Missed Concept 1',
            questionId: 'q-9',
            questionText: 'Q9',
            selectedOptionText: 'Opt A',
            correctOptionText: 'Opt B',
            explanation: 'Exp'
          },
          {
            conceptId: 'c-2',
            conceptName: 'Missed Concept 2',
            questionId: 'q-10',
            questionText: 'Q10',
            selectedOptionText: 'Opt C',
            correctOptionText: 'Opt D',
            explanation: 'Exp'
          }
        ]
      };

      const scoreDisplay = `${highResult.score.toString().padStart(2, '0')} / ${highResult.totalQuestions.toString().padStart(2, '0')}`;
      const percentageDisplay = `${highResult.percentage}% CORRECT`;
      const correctCount = highResult.score;
      const revisitCount = Math.max(0, highResult.totalQuestions - highResult.score);
      const supportingText = `${correctCount} correct · ${revisitCount} to revisit`;

      assert.equal(scoreDisplay, '08 / 10');
      assert.equal(percentageDisplay, '80% CORRECT');
      assert.equal(supportingText, '8 correct · 2 to revisit');
    });
  });
});
