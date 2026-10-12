import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RevisionWorkspace } from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';

describe('GraphMind Feature: Deep Revision Workspace (Phase 1 — Foundation)', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/revision/RevisionWorkspace.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/styles/revision.css');
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const kgWorkspacePath = path.resolve(process.cwd(), 'src/components/graph/KnowledgeGraphWorkspace.tsx');

  const componentContent = fs.readFileSync(componentPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');
  const kgWorkspaceContent = fs.readFileSync(kgWorkspacePath, 'utf8');

  // Realistic knowledge graph with real concepts and relationships
  const mockGraph: KnowledgeGraph = {
    id: 'graph-os-core',
    name: 'Operating Systems',
    description: 'Core concepts in modern operating systems',
    nodes: [
      {
        id: 'c-cpu-sched',
        name: 'CPU Scheduling',
        type: 'algorithm',
        description: 'Process allocation mechanism determining CPU core access time.',
        sourceIds: ['src-1'],
        isCoreConcept: true
      },
      {
        id: 'c-process',
        name: 'Process Management',
        type: 'foundation',
        description: 'Active execution context maintaining registers, stack, and address space.',
        sourceIds: ['src-1']
      },
      {
        id: 'c-virtual-mem',
        name: 'Virtual Memory',
        type: 'system',
        description: 'Memory management technique providing idealized storage abstraction.',
        sourceIds: ['src-2']
      }
    ],
    relationships: [
      {
        id: 'rel-sched-process',
        source: 'c-cpu-sched',
        target: 'c-process',
        type: 'allocates-to',
        sourceChunkIds: []
      }
    ],
    sources: []
  };

  describe('1. Workspace Layout & Top Header (Section 2 & 7)', () => {
    test('renders top workspace header with Back to graph (left), Graph name (center), and View graph (right)', () => {
      let backCalled = false;
      let viewCalled = false;

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => { backCalled = true; },
          onViewGraph: () => { viewCalled = true; }
        })
      );

      // Left: Back to graph
      assert.ok(html.includes('Back to graph'), 'Header must contain "Back to graph" action');
      assert.ok(html.includes('revision-back-action'), 'Header must include revision-back-action button');

      // Center: Knowledge graph name
      assert.ok(html.includes('Operating Systems'), 'Header must display the current knowledge graph name');
      assert.ok(html.includes('revision-graph-name'), 'Header must have .revision-graph-name element');

      // Right: View graph action
      assert.ok(html.includes('View graph'), 'Header must contain "View graph" action');
      assert.ok(html.includes('revision-view-graph-action'), 'Header must include revision-view-graph-action button');

      // Divider below header
      assert.ok(html.includes('revision-header-divider'), 'Header must include subtle horizontal divider');
    });

    test('enforces centered reading column between 760px and 820px in revision.css', () => {
      assert.ok(
        cssContent.includes('.revision-reading-column'),
        'CSS must define .revision-reading-column'
      );
      // Verify max-width is set within 760-820px
      const maxWidthMatch = cssContent.match(/\.revision-reading-column\s*\{[^}]*max-width:\s*(\d+)px/);
      assert.ok(maxWidthMatch, 'Must define max-width in pixels for .revision-reading-column');
      const maxWidthPx = parseInt(maxWidthMatch[1], 10);
      assert.ok(
        maxWidthPx >= 760 && maxWidthPx <= 820,
        `Reading column max-width must be between 760px and 820px, got ${maxWidthPx}px`
      );
    });

    test('preserves editorial Swiss typography and avoids cards/gradients/glassmorphism', () => {
      assert.ok(!cssContent.includes('backdrop-filter: blur'), 'Must avoid glassmorphism in revision styles');
      assert.ok(!cssContent.includes('box-shadow: 0 20px'), 'Must avoid heavy decorative box shadows');
      assert.ok(!cssContent.includes('linear-gradient'), 'Must avoid decorative gradient backgrounds');
    });
  });

  describe('2. Revision Progress Header (Section 3)', () => {
    test('renders REVISION SESSION kicker and formatted zero-padded concept progress (e.g. 01 / 03)', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('REVISION SESSION'), 'Must display "REVISION SESSION" uppercase label');
      assert.ok(html.includes('01 / 03'), 'Must display zero-padded concept progress "01 / 03"');
      assert.ok(html.includes('revision-progress-track'), 'Must contain progress track');
      assert.ok(html.includes('revision-progress-fill'), 'Must contain progress fill indicator');
    });

    test('uses GraphMind lime-green accent for thin progress indicator', () => {
      assert.ok(
        cssContent.includes('.revision-progress-track'),
        'CSS must define .revision-progress-track'
      );
      assert.ok(
        cssContent.includes('.revision-progress-fill'),
        'CSS must define .revision-progress-fill'
      );
      assert.ok(
        cssContent.includes('var(--accent, #A3FF12)'),
        'Progress fill must use GraphMind lime-green accent token'
      );
    });
  });

  describe('3. Concept Introduction (Section 4)', () => {
    test('renders CONCEPT 01 badge, bold concept title, and existing short description', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      // Small uppercase badge
      assert.ok(html.includes('CONCEPT 01'), 'Must render "CONCEPT 01" label');

      // Strong title
      assert.ok(html.includes('CPU Scheduling'), 'Must display current concept title');
      assert.ok(html.includes('revision-concept-title'), 'Title must use .revision-concept-title');

      // Short description
      assert.ok(
        html.includes('Process allocation mechanism determining CPU core access time.'),
        'Must display real concept description'
      );
      assert.ok(html.includes('revision-concept-description'), 'Description must use .revision-concept-description');
    });

    test('does not invent artificial deep explanations or fake text', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      assert.ok(!html.includes('Lorem ipsum'), 'Must never render lorem ipsum placeholder text');
      assert.ok(!html.includes('This section explains in deep detail'), 'Must not render artificial filler');
    });
  });

  describe('4. Content Structure & Placeholder Rules (Section 5)', () => {
    test('prepares semantic sections and keeps unavailable slots hidden without artificial text', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      // Related concepts renders because mockGraph has a relationship from c-cpu-sched to c-process
      assert.ok(html.includes('Related concepts'), 'Must render Related concepts section when real relationships exist');
      assert.ok(html.includes('Process Management'), 'Must render related target concept name');

      // Unavailable sections remain cleanly hidden
      assert.ok(!html.includes('How it works'), 'Phase 2 "How it works" slot must remain hidden when no data');
      assert.ok(!html.includes('Important details'), 'Phase 2 "Important details" slot must remain hidden when no data');
      assert.ok(!html.includes('Knowledge checks'), 'Phase 2 "Knowledge checks" slot must remain hidden when no data');
    });

    test('renders extra key ideas and evidence in Understanding section only when present', () => {
      const conceptDetailsWithEvidence = {
        'c-cpu-sched': {
          id: 'c-cpu-sched',
          label: 'CPU Scheduling',
          code: 'CS',
          category: 'Algorithm',
          description: 'Process allocation mechanism determining CPU core access time.',
          confidence: 95,
          source: 'src-1',
          synapseCount: 4,
          prerequisites: [],
          relationships: [],
          keyIdeas: ['Preemptive vs Non-preemptive', 'Turnaround time minimization'],
          evidence: 'OS textbook chapter 5 on scheduling.'
        }
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          conceptDetails: conceptDetailsWithEvidence,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Understanding the concept'), 'Renders Understanding section when extra ideas or evidence exist');
      assert.ok(html.includes('Turnaround time minimization'), 'Renders real key ideas from concept data');
      assert.ok(html.includes('OS textbook chapter 5 on scheduling.'), 'Renders real evidence text');
    });
  });

  describe('5. Concept Navigation (Section 6)', () => {
    test('renders text-based previous and next links without large filled buttons', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Previous concept'), 'Must contain "Previous concept" text link');
      assert.ok(html.includes('Next concept'), 'Must contain "Next concept" text link');
      assert.ok(html.includes('revision-nav-link'), 'Must use .revision-nav-link text styling');
    });

    test('disables Previous on the first concept (index 0)', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          revisionIndex: 0,
          onBackToGraph: () => {}
        })
      );

      // Verify disabled attribute or class on Previous concept
      assert.ok(
        html.includes('disabled=""') || html.includes('disabled'),
        'Previous link must be disabled on the first concept'
      );
      assert.ok(html.includes('revision-nav-prev'), 'Previous button has .revision-nav-prev class');
    });

    test('disables Next on the last concept (index 2 for 3 concepts)', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          revisionIndex: 2,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-nav-next'), 'Next button has .revision-nav-next class');
      assert.ok(
        html.includes('disabled=""') || html.includes('disabled'),
        'Next link must be disabled on the last concept'
      );
    });

    test('CSS defines subtle green text and animated underline on hover', () => {
      assert.ok(
        cssContent.includes('.revision-nav-link:hover:not(:disabled)'),
        'CSS must define hover state for active nav links'
      );
      assert.ok(
        cssContent.includes('transform: scaleX(1)'),
        'CSS must include underline expansion animation on hover'
      );
    });
  });

  describe('6. State Management & Error Handling (Section 9)', () => {
    test('handles empty graph without throwing and renders calm editorial empty state', () => {
      const emptyGraph: KnowledgeGraph = {
        id: 'graph-empty',
        name: 'Empty Curriculum',
        nodes: [],
        relationships: [],
        sources: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: emptyGraph,
          graphName: 'Empty Curriculum',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('No concepts available for revision'), 'Must display empty concepts message');
      assert.ok(html.includes('Return to knowledge graph'), 'Must provide return button in empty state');
    });

    test('handles null/missing graph gracefully with guidance message', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: null,
          graphName: 'No Graph',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Please select a knowledge graph to begin a deep revision session.'));
    });

    test('handles loading state with calm loading indicator', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          isLoading: true,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Loading revision material…'), 'Must show calm loading screen when isLoading is true');
    });
  });

  describe('7. Routing & Application Integration (Section 1 & 11)', () => {
    test('App.tsx routing architecture includes /revision route', () => {
      assert.ok(appContent.includes("if (path === 'revision') return 'revision';"), 'App.tsx must handle /revision in getInitialSection');
      assert.ok(appContent.includes("currentSection === 'revision'"), 'App.tsx must render RevisionWorkspace when currentSection is revision');
    });

    test('KnowledgeGraphWorkspace mounts RevisionWorkspace when isRevisionMode is true', () => {
      assert.ok(kgWorkspaceContent.includes('<RevisionWorkspace'), 'KnowledgeGraphWorkspace must mount RevisionWorkspace');
      assert.ok(kgWorkspaceContent.includes('isRevisionMode && !isTestMode'), 'RevisionWorkspace is active during revision mode');
      assert.ok(!kgWorkspaceContent.includes('isRevisionMode) && (\n          <NodeContextPanel'), 'NodeContextPanel does not render during revision mode');
    });

    test('KnowledgeGraphToolbar Revise action triggers revision mode without regressions', () => {
      assert.ok(kgWorkspaceContent.includes('onToggleRevisionMode={handleToggleRevisionMode}'), 'KnowledgeGraphWorkspace wires onToggleRevisionMode');
      assert.ok(kgWorkspaceContent.includes('setIsRevisionMode(true)'), 'Enters revision mode');
    });
  });
});
