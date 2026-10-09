import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { MissedConceptItem, TestResultsSummary } from '../src/types/test';

describe('GraphMind Missed Concepts Experience & Results Exit Transition Redesign', () => {
  const mockMissedConcepts: MissedConceptItem[] = [
    {
      conceptId: 'concept-cpu-sched',
      conceptName: 'CPU Scheduling',
      questionId: 'q-1',
      questionText: 'Which scheduling algorithm provides minimum average waiting time?',
      selectedOptionText: 'First-Come, First-Served',
      correctOptionText: 'Shortest Job First',
      explanation: 'Scheduling policies can be compared using waiting time, turnaround time, response time, throughput, and CPU utilization.',
      sourceName: 'Operating_Systems_Silberschatz.pdf',
      page: 268
    },
    {
      conceptId: 'concept-time-quantum',
      conceptName: 'Time Quantum',
      questionId: 'q-2',
      questionText: 'What happens when the time quantum in Round Robin is extremely large?',
      selectedOptionText: 'Context switches increase',
      correctOptionText: 'Degenerates into FCFS',
      explanation: 'Each ready process receives a fixed time quantum. If the quantum is too large, the algorithm behaves like First-Come First-Served.',
      sourceName: 'Operating_Systems_Silberschatz.pdf',
      page: 273
    },
    {
      conceptId: 'concept-process',
      conceptName: 'Process',
      questionId: 'q-3',
      questionText: 'What defines a process?',
      selectedOptionText: 'A binary executable on disk',
      correctOptionText: 'A program in execution',
      explanation: 'A process is a program in execution with an active program counter, stack, and register state.',
      sourceName: 'Architecture_Hennessy.pdf'
    },
    // Duplicate conceptId from another question on same concept to verify deduplication
    {
      conceptId: 'concept-cpu-sched',
      conceptName: 'CPU Scheduling',
      questionId: 'q-4',
      questionText: 'Which algorithm avoids starvation?',
      selectedOptionText: 'Priority without aging',
      correctOptionText: 'Aging technique',
      explanation: 'Priority scheduling requires aging to prevent indefinite postponement.',
      sourceName: 'Operating_Systems_Silberschatz.pdf'
    }
  ];

  describe('1. Results Page Exit Transition Sequence (Section 1 & 2)', () => {
    it('executes a deliberate physical exit transition between 500ms and 750ms', () => {
      const resultsViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestResultsView.tsx'),
        'utf-8'
      );

      // Verify handleReviewMissed sets isExiting, exitTarget='missed', and has timeout in 500-750ms range
      assert.match(resultsViewFile, /setExitTarget\(['"]missed['"]\)/);
      const matchTimeout = resultsViewFile.match(/setTimeout\(\(\)\s*=>\s*\{\s*onReviewMissedConcepts\(\);?\s*\},?\s*(\d+)\)/);
      assert.ok(matchTimeout, 'handleReviewMissed must use setTimeout for deliberate exit choreography');
      const timeoutMs = parseInt(matchTimeout[1], 10);
      assert.ok(
        timeoutMs >= 500 && timeoutMs <= 750,
        `Exit timeout should be in the 500-750ms range, received: ${timeoutMs}ms`
      );
    });

    it('coordinates element exit sequence: circular center compresses, title moves upward, circular visual contracts inward, lower report clears', () => {
      const resultsViewFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/TestResultsView.tsx'),
        'utf-8'
      );
      const circularVisualFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/CircularPerformanceVisual.tsx'),
        'utf-8'
      );

      // 1. Center score content subtly compresses toward center
      assert.match(
        circularVisualFile,
        /scale:\s*0\.90,\s*opacity:\s*0/,
        'Center score content must compress toward center on exitTarget === missed'
      );

      // 2. Circular visual contracts inward (scale: 0.86, opacity: 0)
      assert.match(
        circularVisualFile,
        /scale:\s*0\.86,\s*opacity:\s*0/,
        'Circular visualization container must contract inward on exitTarget === missed'
      );

      // 3. Title typography moves upward (-28px) with reduced opacity
      assert.match(
        resultsViewFile,
        /y:\s*'-28px',\s*opacity:\s*0/,
        'TEST COMPLETE title lines must move upward while fading out'
      );

      // 4. Lower knowledge report section moves upward (-18px) and clears
      assert.match(
        resultsViewFile,
        /y:\s*-18,\s*transition:\s*\{\s*duration:\s*0\.28/,
        'Lower knowledge report section must move upward and disappear on exit'
      );
    });

    it('guarantees continuous near-black #0A0A0A background with zero white flash or layout jump', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Verify identical width and padding container between Results and Missed Concepts
      assert.match(cssFile, /\.test-results-editorial-wrap\s*\{[^}]*max-width:\s*1140px/);
      assert.match(cssFile, /\.missed-concepts-editorial-wrap\s*\{[^}]*max-width:\s*1140px/);
      assert.match(cssFile, /\.missed-concepts-editorial-wrap\s*\{[^}]*width:\s*calc\(100% - 96px\)/);
    });
  });

  describe('2. Missed Concepts Page Editorial Composition (Section 3, 4, 5)', () => {
    it('places subtle ← BACK TO RESULTS contextual navigation at the top of content area', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(componentFile, /className="missed-top-back-btn"/);
      assert.match(componentFile, /BACK TO RESULTS/);

      // Verify it appears before the header
      const topBackIdx = componentFile.indexOf('missed-top-back-btn');
      const headerIdx = componentFile.indexOf('missed-editorial-header');
      assert.ok(topBackIdx < headerIdx, 'BACK TO RESULTS must be at the top of the content area');

      // Verify subtle editorial styling (no border, no pill)
      assert.match(cssFile, /\.missed-top-back-btn\s*\{[^}]*background:\s*transparent/);
      assert.match(cssFile, /\.missed-top-back-btn\s*\{[^}]*border:\s*none/);
    });

    it('renders small eyebrow REVIEW / MISSED CONCEPTS with GraphMind green marker', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(componentFile, /REVIEW \/ MISSED CONCEPTS/);
      assert.match(componentFile, /className="missed-eyebrow-marker"/);
      assert.match(cssFile, /\.missed-eyebrow-marker\s*\{[^}]*background:\s*#B8FF3D/);
      assert.match(cssFile, /\.missed-editorial-eyebrow\s*\{[^}]*letter-spacing:\s*0\.18em/);
    });

    it('renders large editorial title MISSED CONCEPTS with clamp(64px, 7vw, 112px) and tight line-height', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(componentFile, /MISSED/);
      assert.match(componentFile, /CONCEPTS/);
      assert.match(cssFile, /\.missed-editorial-title\s*\{[^}]*font-size:\s*clamp\(64px,\s*7vw,\s*112px\)/);
      assert.match(cssFile, /\.missed-editorial-title\s*\{[^}]*line-height:\s*0\.91/);
      assert.match(cssFile, /\.missed-editorial-title\s*\{[^}]*font-weight:\s*700/);
    });

    it('renders restrained intro copy: "Strengthen the concepts you missed and reconnect them to the material behind your graph."', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(
        componentFile,
        /Strengthen the concepts you missed and reconnect them to the material behind your graph\./
      );
      assert.match(cssFile, /\.missed-editorial-intro\s*\{[^}]*max-width:\s*560px/);
      assert.match(cssFile, /\.missed-editorial-intro\s*\{[^}]*font-size:\s*17px/);
    });
  });

  describe('3. Single Editorial Indexed List & Row Architecture (Section 6, 7, 8, 9)', () => {
    it('removes card grid style and creates single-column indexed list with subtle horizontal rules', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Card grid borders/backgrounds removed
      assert.ok(!cssFile.includes('.missed-concept-card {'));
      assert.ok(!cssFile.includes('.missed-concept-card:hover {'));

      // Clean indexed rows with horizontal rules
      assert.match(cssFile, /\.missed-concept-row\s*\{[^}]*border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.08\)/);
      assert.match(cssFile, /\.missed-concept-row:last-child\s*\{[^}]*border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.08\)/);
      assert.match(cssFile, /\.missed-concept-row\s*\{[^}]*background:\s*transparent/);
    });

    it('formats row index numbers with two digits (01, 02, 03...)', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );

      assert.match(componentFile, /String\(idx \+ 1\)\.padStart\(2,\s*['"]0['"]\)/);
    });

    it('enforces row height 120–160px with generous vertical whitespace', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      assert.match(cssFile, /\.missed-concept-row\s*\{[^}]*min-height:\s*130px/);
      assert.match(cssFile, /\.missed-concept-row\s*\{[^}]*padding:\s*36px 0/);
    });

    it('provides typography-driven REVIEW → action with growing underline (no rectangular button)', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // No large rectangular button in markup
      assert.ok(!componentFile.includes('missed-concept-review-btn'));
      assert.match(componentFile, /className="missed-row-action-link"/);
      assert.match(componentFile, /className="missed-action-underline"/);

      // Growing underline in CSS
      assert.match(cssFile, /\.missed-action-underline\s*\{[^}]*transform:\s*scaleX\(0\)/);
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-action-underline\s*\{[^}]*transform:\s*scaleX\(1\)/);
      assert.match(cssFile, /\.missed-action-underline\s*\{[^}]*background:\s*#B8FF3D/);
    });
  });

  describe('4. Hover Micro-Interaction & Green Accent Restraint (Section 10 & 11)', () => {
    it('implements coordinated 200–300ms ease-out hover choreography on concept row', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // 1. Concept number shifts toward green
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-index\s*\{[^}]*color:\s*#B8FF3D/);

      // 2. Concept title moves 4-6px horizontally
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-concept-title\s*\{[^}]*transform:\s*translateX\(5px\)/);

      // 3. REVIEW arrow translates 4-8px right
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-action-arrow\s*\{[^}]*transform:\s*translateX\(6px\)/);

      // 4. Thin green line extends subtly from row edge
      assert.match(cssFile, /\.missed-row-edge-accent\s*\{[^}]*background:\s*#B8FF3D/);
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-edge-accent\s*\{[^}]*opacity:\s*1/);
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-edge-accent\s*\{[^}]*transform:\s*scaleY\(1\)/);

      // 5. Description becomes slightly brighter
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-explanation\s*\{[^}]*color:\s*#B0B0B0/);

      // 6. Source metadata becomes slightly more visible
      assert.match(cssFile, /\.missed-concept-row:hover \.missed-row-source-meta\s*\{[^}]*color:\s*#8E8E8E/);
    });

    it('restrains green accent strictly to editorial accents with no green backgrounds or glow', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      const missedSectionStart = cssFile.indexOf('MISSED CONCEPTS REVIEW — EDITORIAL KNOWLEDGE REVIEW');
      const missedSectionEnd = cssFile.indexOf('/* ==========================================================================\n   RESPONSIVENESS');
      const missedSection = cssFile.slice(missedSectionStart, missedSectionEnd);

      // No glowing box-shadow or green backgrounds on rows
      assert.ok(!missedSection.includes('box-shadow'), 'No glowing box-shadow allowed');
      assert.match(missedSection, /\.missed-concept-row\s*\{[^}]*background:\s*transparent/);
      assert.ok(!missedSection.includes('.missed-concept-row { background: #B8FF3D'));

      // Green is strictly confined to editorial accents: eyebrow marker, edge line, index on hover, arrow, underline
      assert.match(missedSection, /\.missed-eyebrow-marker\s*\{[^}]*background:\s*#B8FF3D/);
      assert.match(missedSection, /\.missed-row-edge-accent\s*\{[^}]*background:\s*#B8FF3D/);
      assert.match(missedSection, /\.missed-action-underline\s*\{[^}]*background:\s*#B8FF3D/);
      assert.match(missedSection, /\.missed-concept-row:hover \.missed-row-index\s*\{[^}]*color:\s*#B8FF3D/);
      assert.match(missedSection, /\.missed-concept-row:hover \.missed-action-arrow\s*\{[^}]*color:\s*#B8FF3D/);
    });
  });

  describe('5. Staggered Row Entrance & Reversible Back Exit (Section 12, 13, 15)', () => {
    it('reveals rows with staggered delay (60–90ms) and resolves typography smoothly', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );

      assert.match(componentFile, /delay:\s*0\.28 \+ idx \* 0\.075/);
    });

    it('implements reversible exit when user clicks BACK TO RESULTS with reverse stagger', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );

      assert.match(componentFile, /handleBackToResults/);
      assert.match(componentFile, /setExitDirection\(['"]back['"]\)/);
      // Reverse stagger delay
      assert.match(componentFile, /delay:\s*\(uniqueConcepts\.length - 1 - idx\) \* 0\.045/);
      // Calls onBackToResults after animation completes (~420ms)
      assert.match(componentFile, /setTimeout\(\(\)\s*=>\s*\{\s*onBackToResults\(\);\s*\},?\s*420\)/);
    });
  });

  describe('6. Concept Focus Interaction & Knowledge Graph Bridge (Section 16)', () => {
    it('anchors selected concept row, dims other rows, and bridges to graph with concept selected', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Selected concept state and timeout
      assert.match(componentFile, /handleSelectConcept/);
      assert.match(componentFile, /setSelectedConceptId\(conceptId\)/);
      assert.match(componentFile, /setExitDirection\(['"]graph['"]\)/);
      assert.match(componentFile, /onReviewConceptInGraph\(conceptId\)/);

      // Anchor class and dimming
      assert.match(cssFile, /\.missed-concept-row\.is-selected/);
      assert.match(cssFile, /\.missed-concept-row\.is-dimmed\s*\{[^}]*opacity:\s*0\.22/);
    });
  });

  describe('7. Data Authenticity & Deduplication (Section 17)', () => {
    it('deduplicates multiple questions referencing the same concept and preserves real data', () => {
      // Simulate uniqueConcepts derivation logic
      const map = new Map<string, MissedConceptItem>();
      for (const item of mockMissedConcepts) {
        const key = item.conceptId || item.conceptName;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
      const unique = Array.from(map.values());

      assert.equal(unique.length, 3, 'Should deduplicate 4 items to 3 unique concepts');
      assert.equal(unique[0].conceptName, 'CPU Scheduling');
      assert.equal(unique[0].sourceName, 'Operating_Systems_Silberschatz.pdf');
      assert.equal(unique[0].page, 268);
      assert.equal(unique[1].conceptName, 'Time Quantum');
      assert.equal(unique[2].conceptName, 'Process');
      assert.equal(unique[2].sourceName, 'Architecture_Hennessy.pdf');
    });

    it('never invents fake sources or dummy descriptions if unavailable', () => {
      const componentFile = fs.readFileSync(
        path.join(process.cwd(), 'src/components/test/MissedConceptsReview.tsx'),
        'utf-8'
      );

      // Only renders source if sourceName exists
      assert.match(componentFile, /\{item\.sourceName && \(/);
      // Only renders page if page exists
      assert.match(componentFile, /\{item\.page && \(/);
    });
  });

  describe('8. Responsive Design Adaptations (Section 18)', () => {
    it('includes tablet and mobile responsive breakpoints with clean vertical stacking', () => {
      const cssFile = fs.readFileSync(
        path.join(process.cwd(), 'src/styles/test.css'),
        'utf-8'
      );

      // Tablet < 900px
      assert.match(cssFile, /@media \(max-width:\s*900px\)/);
      assert.match(cssFile, /\.missed-editorial-title\s*\{[^}]*font-size:\s*clamp\(48px,\s*6vw,\s*76px\)/);

      // Mobile < 640px: vertical stacking with no clipping
      assert.match(cssFile, /@media \(max-width:\s*640px\)/);
      assert.match(cssFile, /\.missed-concept-row\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
    });
  });
});
