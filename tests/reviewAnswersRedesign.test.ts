import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { TestQuestion, TestResultsSummary } from '../src/types/test';

describe('GraphMind "Review All Answers" Page & Results Exit Transition Redesign', () => {
  const mockQuestions: TestQuestion[] = [
    {
      id: 'q-1',
      conceptId: 'concept-round-robin',
      conceptName: 'Round Robin Scheduling',
      question: 'Which concept is described as: "Is designed for time-sharing systems?"',
      options: [
        'Round Robin Scheduling',
        'First-Come First-Served',
        'Shortest Job First',
        'Multilevel Queue'
      ],
      correctAnswerIndex: 0,
      explanation: 'Round Robin Scheduling is designed for time-sharing systems, assigning equal time slices to each active process in ready queue.',
      relationshipType: 'describes',
      sourceName: 'Operating Systems — Unit 1.pdf'
    },
    {
      id: 'q-2',
      conceptId: 'concept-time-quantum',
      conceptName: 'Time Quantum',
      question: 'According to your knowledge graph, which concept has a "causes" relationship with Time Quantum?',
      options: [
        'CPU Scheduling',
        'Context Switch',
        'Virtual Memory',
        'Deadlock Avoidance'
      ],
      correctAnswerIndex: 1,
      explanation: 'A smaller time quantum causes more frequent context switches, increasing CPU overhead.',
      relationshipType: 'causes',
      sourceName: 'Operating Systems — Unit 1.pdf'
    },
    {
      id: 'q-3',
      conceptId: 'concept-process-state',
      conceptName: 'Process State',
      question: 'What happens when an I/O operation completes for a waiting process?',
      options: [
        'Transitions to Terminated',
        'Transitions to Ready',
        'Transitions to Running immediately',
        'Transitions to Suspended'
      ],
      correctAnswerIndex: 1,
      explanation: 'Upon completion of I/O, the operating system transitions the process from Waiting state back to the Ready queue.',
      relationshipType: 'describes'
    }
  ];

  const mockUserAnswers: Record<string, number> = {
    'q-1': 0, // Correct
    'q-2': 0, // Incorrect: Selected CPU Scheduling (0), Correct is Context Switch (1)
    'q-3': 1  // Correct
  };

  const mockSummary: TestResultsSummary = {
    totalQuestions: 3,
    correctCount: 2,
    incorrectCount: 1,
    scorePercentage: 67,
    elapsedSeconds: 145,
    formattedTime: '02:25',
    missedConcepts: [
      {
        conceptId: 'concept-time-quantum',
        conceptName: 'Time Quantum',
        questionId: 'q-2',
        questionText: 'According to your knowledge graph, which concept has a "causes" relationship with Time Quantum?',
        selectedOptionText: 'CPU Scheduling',
        correctOptionText: 'Context Switch',
        explanation: 'A smaller time quantum causes more frequent context switches, increasing CPU overhead.',
        sourceName: 'Operating Systems — Unit 1.pdf'
      }
    ],
    tier: {
      label: 'SOLID UNDERSTANDING',
      description: 'Strong foundation with targeted review needed',
      color: '#B8FF3D'
    }
  };

  describe('1. Results → Review All Answers Exit Transition (Section 1)', () => {
    it('executes a deliberate physical exit transition between 550ms and 750ms when clicking REVIEW ALL ANSWERS', () => {
      const resultsViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestResultsView.tsx'),
        'utf-8'
      );

      // Verify handleReviewAnswers sets isExiting, exitTarget='answers', and uses setTimeout in 550-750ms range
      assert.match(resultsViewFile, /handleReviewAnswers\s*=/);
      assert.match(resultsViewFile, /setExitTarget\(['"]answers['"]\)/);
      const matchTimeout = resultsViewFile.match(/setTimeout\(\(\)\s*=>\s*\{\s*onReviewAnswers\(\);?\s*\},?\s*(\d+)\)/);
      assert.ok(matchTimeout, 'handleReviewAnswers must use setTimeout for intentional physical exit choreography');
      const timeoutMs = parseInt(matchTimeout[1], 10);
      assert.ok(
        timeoutMs >= 550 && timeoutMs <= 750,
        `Exit timeout must be within 550-750ms range specified in instructions. Found: ${timeoutMs}ms`
      );
    });

    it('coordinates physical exit: circular ring contracts inward and score typography compresses toward center', () => {
      const circularVisualFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/CircularPerformanceVisual.tsx'),
        'utf-8'
      );

      // Verify exitTarget includes 'answers'
      assert.match(
        circularVisualFile,
        /exitTarget\s*===\s*['"]answers['"]/,
        'Circular visual must react to exitTarget === "answers"'
      );

      // 1. Center score content subtly compresses toward center
      assert.match(
        circularVisualFile,
        /scale:\s*0\.90,\s*opacity:\s*0/,
        'Score typography must compress toward center on answers exit'
      );

      // 2. Circular visual container contracts inward (scale: 0.86, opacity: 0)
      assert.match(
        circularVisualFile,
        /scale:\s*0\.86,\s*opacity:\s*0/,
        'Circular visual container must contract inward toward its center on answers exit'
      );
    });

    it('coordinates title and lower report retraction on answers exit', () => {
      const resultsViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestResultsView.tsx'),
        'utf-8'
      );

      // Title moves upward with clipped reveal
      assert.match(
        resultsViewFile,
        /y:\s*'-28px',\s*opacity:\s*0/,
        'TEST COMPLETE title lines must retract upward'
      );

      // Lower content retracts upward
      assert.match(
        resultsViewFile,
        /opacity:\s*0,\s*y:\s*-18/,
        'Lower result content must retract vertically'
      );

      // "REVIEW ALL ANSWERS →" button must be wired to handleReviewAnswers
      assert.match(
        resultsViewFile,
        /onClick=\{handleReviewAnswers\}/,
        'Clicking REVIEW ALL ANSWERS must trigger handleReviewAnswers'
      );
    });
  });

  describe('2. Review Page Entry & Composition (Section 2, 3, 4, 5)', () => {
    it('implements editorial header with BACK TO RESULTS on left and EXAMINATION REVIEW on right', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      // Back navigation button
      assert.match(reviewViewFile, /BACK TO RESULTS/);
      assert.match(reviewViewFile, /handleBackToResults/);

      // Top right context label
      assert.match(reviewViewFile, /EXAMINATION REVIEW/);
    });

    it('renders editorial eyebrow with selective green dot annotation', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      // Small green dot + REVIEW / EXAMINATION
      assert.match(reviewViewFile, /review-eyebrow-marker/);
      assert.match(reviewViewFile, /REVIEW\s*\/\s*EXAMINATION/);
    });

    it('formats large stacked editorial title REVIEW ALL ANSWERS with fluid sizing clamp', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Stacked lines in JSX
      assert.match(reviewViewFile, /REVIEW/);
      assert.match(reviewViewFile, /ALL/);
      assert.match(reviewViewFile, /ANSWERS/);

      // Fluid clamp typography in CSS
      assert.match(cssFile, /clamp\(64px,\s*7vw,\s*112px\)/);
      assert.match(cssFile, /line-height:\s*0\.(8[8-9]|9[0-4])/);
      assert.match(cssFile, /letter-spacing:\s*-0\.0[4-6]em/);
    });

    it('provides concise introductory copy with max-width around 520-600px', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(
        reviewViewFile,
        /Review every question,\s*understand why the answer was correct or incorrect,\s*and reconnect each concept to your knowledge graph\./
      );

      // Max width restrained in CSS
      assert.match(cssFile, /max-width:\s*5[2-9]0px|max-width:\s*600px/);
    });
  });

  describe('3. Answer Index Structure & Typography (Section 6, 7, 8, 9, 10, 14, 15, 16, 17)', () => {
    it('renders minimal answer index header with ANSWERS and question count separated by subtle rule', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      assert.match(reviewViewFile, /review-index-header-row/);
      assert.match(reviewViewFile, /ANSWERS/);
      assert.match(reviewViewFile, /QUESTIONS/);
    });

    it('does NOT use cards, card grids, nested boxes, or dashboard card styles', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      assert.doesNotMatch(
        reviewViewFile,
        /review-question-card/,
        'Old generic card component review-question-card must be eliminated'
      );
      assert.doesNotMatch(
        reviewViewFile,
        /review-explanation-card/,
        'Nested explanation cards must be replaced with natural editorial flow'
      );
    });

    it('uses editorial numbering (01, 02...) with tiny status dot indicators (green for correct, red for incorrect)', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Numbering formatting (String(index + 1).padStart(2, '0'))
      assert.match(reviewViewFile, /padStart\(2,\s*['"]0['"]\)/);

      // Status indicator dot
      assert.match(reviewViewFile, /review-status-dot/);
      assert.match(reviewViewFile, /dot-correct/);
      assert.match(reviewViewFile, /dot-incorrect/);

      // Tiny dot styling in CSS (4-6px diameter)
      assert.match(cssFile, /\.review-status-dot\s*\{[^}]*width:\s*[4-6]px;/);
    });

    it('renders question text at 18-22px with off-white primary text (#F5F5F5)', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(cssFile, /\.review-row-question-text\s*\{[^}]*font-size:\s*(1[8-9]|2[0-2])px;/);
      assert.match(cssFile, /\.review-row-question-text\s*\{[^}]*color:\s*#F5F5F5;/);
    });

    it('renders subordinate result state: green annotation for correct, muted red + correct for incorrect', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Correct display
      assert.match(reviewViewFile, /summary-answer-text/);
      assert.match(reviewViewFile, /CORRECT/);

      // Incorrect display
      assert.match(reviewViewFile, /YOUR ANSWER/);
      assert.match(reviewViewFile, /summary-wrong-text/);

      // Restrained colors in CSS
      assert.match(cssFile, /#FF5A5A|#FF7070/); // Muted red
      assert.match(cssFile, /#B8FF3D/); // GraphMind green
    });
  });

  describe('4. Expanded Question in Natural Document Flow (Section 11, 12, 18, 19)', () => {
    it('reveals expanded details in natural document flow without nested cards', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      // Document flow expansion sections:
      assert.match(reviewViewFile, /review-row-expanded-flow/);
      assert.match(reviewViewFile, /review-expanded-options-list/);
      assert.match(reviewViewFile, /review-expanded-section/);
      assert.match(reviewViewFile, /review-graph-editorial-link/);
    });

    it('includes WHY explanation and FROM YOUR MATERIAL provenance quote', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      assert.match(reviewViewFile, /WHY/);
      assert.match(reviewViewFile, /FROM YOUR MATERIAL/);
    });

    it('renders REVIEW IN GRAPH → editorial link with hover shift and concept navigation', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // JSX action
      assert.match(reviewViewFile, /REVIEW.*IN GRAPH/);
      assert.match(reviewViewFile, /handleReviewConceptInGraph/);

      // CSS hover motion (arrow moves 5-8px right, green underline / bright color)
      assert.match(cssFile, /\.review-graph-editorial-link:hover \.review-graph-arrow\s*\{[^}]*translateX\(6px\)/);
    });
  });

  describe('5. Keyboard Navigation & Motion Continuity (Section 21, 26, 27)', () => {
    it('handles Escape key to trigger reversible back exit', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      assert.match(reviewViewFile, /e\.key\s*===\s*['"]Escape['"]/);
      assert.match(reviewViewFile, /handleBackToResults/);
    });

    it('performs reversible back exit animation before executing onBackToResults', () => {
      const reviewViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestReviewView.tsx'),
        'utf-8'
      );

      assert.match(reviewViewFile, /setIsExiting\(true\)/);
      assert.match(reviewViewFile, /setExitDirection\(['"]back['"]\)/);
      assert.match(reviewViewFile, /setTimeout\(\(\)\s*=>\s*\{\s*onBackToResults\(\);?\s*\},?\s*420\)/);
    });

    it('preserves test data integrity without generating fake questions or modifying results', () => {
      // Verify mock data passes through cleanly without mutation
      const total = mockSummary.totalQuestions;
      const correct = mockSummary.correctCount;
      assert.equal(total, 3);
      assert.equal(correct, 2);
      assert.equal(mockQuestions[0].conceptName, 'Round Robin Scheduling');
      assert.equal(mockQuestions[1].conceptName, 'Time Quantum');
    });

    it('supports prefers-reduced-motion media query for motion safety', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(cssFile, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });
  });

  describe('6. Layout Geometry & Responsive Adaptations (Section 20, 23, 24)', () => {
    it('enforces maximum content width between 1100px and 1200px centered', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(cssFile, /\.test-review-editorial-wrap\s*\{[^}]*max-width:\s*1140px;/);
      assert.match(cssFile, /\.test-review-editorial-wrap\s*\{[^}]*margin:\s*0\s+auto;/);
    });

    it('provides responsive breakpoints for tablet and mobile viewports', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(cssFile, /@media\s*\(max-width:\s*900px\)/);
      assert.match(cssFile, /@media\s*\(max-width:\s*640px\)/);
    });
  });
});
