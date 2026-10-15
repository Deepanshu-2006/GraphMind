import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { 
  RevisionWorkspace, 
  EditorialFormattedContent, 
  normalizeSourceMarkdown 
} from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph, KnowledgeNode } from '../src/types/knowledgeGraph';
import { extractConceptSourceContext, synthesizeGroundedExplanation } from '../src/services/conceptExplanation';

const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

describe('Revision Workspace Typography Consistency & Content Renderer', () => {
  const sampleNodes: KnowledgeNode[] = [
    {
      id: 'c-cpu-sched',
      name: 'CPU Scheduling',
      type: 'process',
      description: 'The mechanism used by an operating system to select a process for execution when multiple processes are ready to run.',
      sourceIds: ['src-test'],
      evidence: 'CPU scheduling is the mechanism used by an operating system to select a process for execution when multiple processes are ready to run. A scheduling algorithm defines the rule used to make this selection.'
    },
    {
      id: 'c-fcfs',
      name: 'First-Come, First-Served',
      type: 'algorithm',
      description: 'Scheduling assigns the CPU to processes in the order in which they enter the ready queue.',
      sourceIds: ['src-test'],
      evidence: 'First-Come, First-Served scheduling assigns the CPU to processes in the order in which they enter the ready queue. FCFS is simple and non-preemptive. However, a long process at the front of the queue can make shorter processes wait for a long time.'
    },
    {
      id: 'c-sjf',
      name: 'Shortest Job First',
      type: 'algorithm',
      description: 'Selects the ready process with the smallest expected CPU burst.',
      sourceIds: ['src-test'],
      evidence: 'Shortest Job First selects the ready process with the smallest expected CPU burst. SJF can minimize average waiting time when burst lengths are known or estimated accurately.'
    },
    {
      id: 'c-srtf',
      name: 'Shortest Remaining Time First',
      type: 'algorithm',
      description: 'The preemptive form of Shortest Job First.',
      sourceIds: ['src-test'],
      evidence: 'Shortest Remaining Time First is the preemptive form of Shortest Job First. When a new process arrives with a shorter remaining CPU burst than the currently running process, the scheduler can preempt the current process and execute the new one.'
    },
    {
      id: 'c-rr',
      name: 'Round Robin Scheduling',
      type: 'algorithm',
      description: 'Is designed for time-sharing systems.',
      sourceIds: ['src-test'],
      evidence: 'Round Robin scheduling is designed for time-sharing systems where each ready process receives a fixed time quantum.'
    }
  ];

  const testGraph: KnowledgeGraph = {
    id: 'graph-test-sched',
    name: 'Operating Systems',
    nodes: sampleNodes,
    sources: [
      {
        id: 'src-test',
        name: 'Operating System Principles',
        fileName: 'os.pdf',
        fileType: 'application/pdf',
        type: 'pdf',
        size: '100 KB',
        uploadedAt: Date.now(),
        status: 'ready'
      }
    ],
    relationships: [
      {
        id: 'rel-1',
        source: 'c-fcfs',
        target: 'c-cpu-sched',
        type: 'type-of',
        sourceChunkIds: []
      }
    ]
  };

  describe('1. Global Typography Hierarchy & CSS Tokens', () => {
    test('A. Concept title has Level 1 visual prominence (approx 24-34px desktop, semibold, primary white)', () => {
      const match = cssContent.match(/\.revision-concept-title\s*\{([^}]*)\}/);
      assert.ok(match, 'CSS must define .revision-concept-title');
      const body = match[1];
      assert.ok(body.includes('clamp(30px') || body.includes('30px'), 'Title desktop size in 24-34px range');
      assert.ok(body.includes('font-weight: 600'), 'Title must be semibold (600)');
      assert.ok(body.includes('color: #FFFFFF'), 'Title must be primary white');
    });

    test('B. Section heading is uppercase lime accent in 12-13px range', () => {
      const match = cssContent.match(/\.revision-section-heading\s*\{([^}]*)\}/);
      assert.ok(match, 'CSS must define .revision-section-heading');
      const body = match[1];
      assert.ok(body.includes('font-size: 12.5px') || body.includes('font-size: 12px') || body.includes('font-size: 13px'), 'Heading must be 12-13px');
      assert.ok(body.includes('text-transform: uppercase'), 'Heading must be uppercase');
      assert.ok(body.includes('color: var(--accent, #A3FF12)'), 'Heading must use lime accent');
      assert.ok(body.includes('letter-spacing: 0.08em'), 'Heading must have consistent letter-spacing');
    });

    test('C. Explanatory subheading has distinct styling (17-19px, medium weight, distinct white)', () => {
      const match = cssContent.match(/\.revision-editorial-subheading\s*\{([^}]*)\}/);
      assert.ok(match, 'CSS must define .revision-editorial-subheading');
      const body = match[1];
      assert.ok(body.includes('font-size: 18px'), 'Subheading must be 18px (in 17-19px range)');
      assert.ok(body.includes('font-weight: 500'), 'Subheading must have medium weight (500)');
      assert.ok(body.includes('color: #F9FAFB') || body.includes('color: #FFFFFF'), 'Subheading must be primary light color');
    });

    test('D. Body paragraphs and lead paragraphs share identical size, weight, line-height, and color', () => {
      const leadMatch = cssContent.match(/\.revision-explanation-lead\s*\{([^}]*)\}/);
      const paraMatch = cssContent.match(/\.revision-explanation-paragraph\s*\{([^}]*)\}/);
      const editorialPMatch = cssContent.match(/\.revision-editorial-p\s*\{([^}]*)\}/);

      assert.ok(leadMatch, '.revision-explanation-lead must exist');
      assert.ok(paraMatch, '.revision-explanation-paragraph must exist');
      assert.ok(editorialPMatch, '.revision-editorial-p must exist');

      // Lead must no longer be 19px or bold/medium
      assert.ok(!leadMatch[1].includes('font-size: 19px'), 'Lead paragraph must NOT be enlarged to 19px');
      assert.ok(leadMatch[1].includes('font-size: 16.5px'), 'Lead paragraph must match 16.5px body font-size');
      assert.ok(leadMatch[1].includes('font-weight: 400'), 'Lead paragraph must use regular weight (400)');
      assert.ok(leadMatch[1].includes('color: #D1D5DB'), 'Lead paragraph must use uniform #D1D5DB text color');

      // Paragraph must match
      assert.ok(paraMatch[1].includes('font-size: 16.5px'), 'Explanation paragraph must use 16.5px');
      assert.ok(paraMatch[1].includes('font-weight: 400'), 'Explanation paragraph must use 400 weight');
      assert.ok(paraMatch[1].includes('color: #D1D5DB'), 'Explanation paragraph must use #D1D5DB');

      // Editorial P must match
      assert.ok(editorialPMatch[1].includes('font-size: 16.5px'), 'Editorial P must use 16.5px');
      assert.ok(editorialPMatch[1].includes('font-weight: 400'), 'Editorial P must use 400 weight');
      assert.ok(editorialPMatch[1].includes('color: #D1D5DB'), 'Editorial P must use #D1D5DB');
    });
  });

  describe('2. Consistency Across Key Scheduling Concepts', () => {
    test('renders identical typography hierarchy for CPU Scheduling, FCFS, SJF, SRTF, and Round Robin', () => {
      const conceptIds = ['c-cpu-sched', 'c-fcfs', 'c-sjf', 'c-srtf', 'c-rr'];

      for (const conceptId of conceptIds) {
        const node = sampleNodes.find(n => n.id === conceptId)!;
        const html = renderToString(
          React.createElement(RevisionWorkspace, {
            graph: testGraph,
            graphName: 'Operating Systems',
            initialConceptId: conceptId,
            onBackToGraph: () => {}
          })
        );

        // Concept title is rendered
        assert.ok(html.includes('revision-concept-title'), `Title rendered for ${node.name}`);
        assert.ok(html.includes(node.name), `Name rendered for ${node.name}`);

        // Section 01 heading is rendered
        assert.ok(html.includes('Understanding the concept'), `Understanding heading rendered for ${node.name}`);

        // Ensure no unexpected oversized headings (e.g. h1, h2) are injected inside the body
        const understandingSection = html.slice(html.indexOf('id="section-understanding"'));
        const nextSectionIdx = understandingSection.indexOf('class="revision-section');
        const sectionContent = nextSectionIdx > 0 ? understandingSection.slice(0, nextSectionIdx) : understandingSection;

        // No rogue h1 or h2 inside section body
        assert.ok(!sectionContent.includes('<h1'), 'No rogue h1 in body');
      }
    });
  });

  describe('3. Content Renderer & Semantic Parsing', () => {
    test('normalizes source HTML and strips arbitrary inline styles that could override typography', () => {
      const dirtyHtml = '<p style="font-size: 36px; font-weight: 900; color: red;">Important explanation text.</p>';
      const normalized = normalizeSourceMarkdown(dirtyHtml);
      assert.ok(!normalized.includes('style='), 'Inline styles must be stripped');
      assert.ok(!normalized.includes('font-size: 36px'), 'Custom font-size must be stripped');
      assert.equal(normalized, 'Important explanation text.');
    });

    test('preserves explicit semantic subheadings (###) and renders them as .revision-editorial-subheading', () => {
      const content = `First introductory paragraph.\n\n### Core Scheduling Mechanism\n\nSecond detailed paragraph.`;
      const html = renderToString(
        React.createElement(EditorialFormattedContent, { content })
      );

      assert.ok(html.includes('<h3 class="revision-editorial-subheading">Core Scheduling Mechanism</h3>'), 'Explicit subheading rendered as h3');
      assert.ok(html.includes('First introductory paragraph.'), 'First paragraph rendered');
      assert.ok(html.includes('Second detailed paragraph.'), 'Second paragraph rendered');
    });

    test('renders markdown lists, blockquotes, code blocks, and tables within multi-block content', () => {
      const richContent = `Introductory text.\n\n- Non-preemptive policy\n- Context switch cost\n\n> Verified by operating system reference materials.\n\n\`\`\`c\nvoid schedule() {}\n\`\`\``;
      const html = renderToString(
        React.createElement(EditorialFormattedContent, { content: richContent })
      );

      assert.ok(html.includes('revision-unordered-list'), 'Must render unordered list');
      assert.ok(html.includes('Non-preemptive policy'), 'List item rendered');
      assert.ok(html.includes('revision-editorial-blockquote'), 'Must render blockquote');
      assert.ok(html.includes('revision-code-block'), 'Must render code block');
    });

    test('does NOT turn a plain opening sentence into a subheading', () => {
      const plainContent = 'CPU scheduling is the mechanism used by an operating system to select a process for execution.';
      const html = renderToString(
        React.createElement(EditorialFormattedContent, { content: plainContent })
      );

      assert.ok(!html.includes('revision-editorial-subheading'), 'Plain opening sentence must NOT be inferred as a subheading');
      assert.ok(html.includes('CPU scheduling is the mechanism'), 'Text is preserved');
    });
  });
});
