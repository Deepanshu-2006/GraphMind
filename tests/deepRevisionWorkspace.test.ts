import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  RevisionWorkspace,
  WORKSPACE_EASING,
  createWorkspaceArrivalVariants,
  createSessionMetadataVariants,
  createConceptBadgeVariants,
  createConceptTitleVariants,
  createConceptDescriptionVariants,
  createNavigationVariants,
  createConceptCanvasVariants
} from '../src/components/revision/RevisionWorkspace';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { RevisionSessionState } from '../src/types/practice';
import {
  createRevisionSession,
  validateRevisionSession,
  canNavigatePrev,
  canNavigateNext,
  navigatePrev,
  navigateNext,
  jumpToIndex,
  jumpToConceptId,
  loadRevisionSession,
  saveRevisionSession,
  clearRevisionSession,
  markEntryAnimationPlayed
} from '../src/services/revisionSession';
import { ASSESSMENT_HISTORY_STORAGE_KEY } from '../src/services/assessmentHistory';

// In-memory backing store for localStorage & sessionStorage simulation in Node test runner
const storageMap = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };
}

const sessionStoreMap = new Map<string, string>();
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => sessionStoreMap.get(key) || null,
    setItem: (key: string, val: string) => sessionStoreMap.set(key, String(val)),
    removeItem: (key: string) => sessionStoreMap.delete(key),
    clear: () => sessionStoreMap.clear()
  };
}

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

  describe('8. Task 02: Typography & Visual Hierarchy Refinements', () => {
    test('concept badge features subtle lime-green accent dot', () => {
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('revision-concept-badge-dot'), 'Must render .revision-concept-badge-dot');
      assert.ok(cssContent.includes('.revision-concept-badge-dot'), 'CSS must define .revision-concept-badge-dot');
      assert.ok(cssContent.includes('background-color: var(--accent, #A3FF12)'), 'Dot must use lime-green accent');
    });

    test('concept title styling enforces dominant hierarchy and overflow protection', () => {
      assert.ok(cssContent.includes('line-height: 1.12'), 'Title line-height must be tightened (1.12)');
      assert.ok(cssContent.includes('letter-spacing: -0.035em'), 'Title letter-spacing must be tight (-0.035em)');
      assert.ok(cssContent.includes('word-break: break-word'), 'Title must handle long words with word-break');
      assert.ok(cssContent.includes('overflow-wrap: break-word'), 'Title must include overflow-wrap protection');
    });

    test('renders long concept names cleanly without throwing', () => {
      const longTitleGraph: KnowledgeGraph = {
        id: 'graph-long-titles',
        name: 'Advanced Systems',
        nodes: [
          {
            id: 'c-long',
            name: 'Hierarchical Multi-Level Feedback Queue Scheduling and Priority Inversion Prevention Mechanism',
            type: 'algorithm',
            description: 'Advanced CPU scheduling combining multiple priority queues with dynamic aging.',
            sourceIds: []
          }
        ],
        relationships: [],
        sources: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: longTitleGraph,
          graphName: 'Advanced Systems',
          onBackToGraph: () => {}
        })
      );

      assert.ok(
        html.includes('Hierarchical Multi-Level Feedback Queue Scheduling and Priority Inversion Prevention Mechanism'),
        'Long title must render completely in DOM'
      );
    });

    test('handles missing concept descriptions gracefully without empty paragraph tags', () => {
      const noDescGraph: KnowledgeGraph = {
        id: 'graph-no-desc',
        name: 'Minimal Graph',
        nodes: [
          {
            id: 'c-bare',
            name: 'Bare Concept',
            type: 'foundation',
            sourceIds: []
          }
        ],
        relationships: [],
        sources: []
      };

      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: noDescGraph,
          graphName: 'Minimal Graph',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Bare Concept'), 'Concept title must render');
      assert.ok(
        !html.includes('class="revision-concept-description"'),
        'Must not render empty description paragraph when description is absent'
      );
    });

    test('concept description uses comfortable reading measure max-width: 65ch', () => {
      assert.ok(cssContent.includes('max-width: 65ch'), 'Description must enforce 65ch reading measure');
    });

    test('bottom navigation links include accessible concept titles in tooltips', () => {
      const htmlFirst = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          revisionIndex: 0,
          onBackToGraph: () => {}
        })
      );

      assert.ok(htmlFirst.includes('title="Next: Process Management (→)"'), 'Next button must indicate next concept name');

      const htmlLast = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          revisionIndex: 2,
          onBackToGraph: () => {}
        })
      );

      assert.ok(htmlLast.includes('title="Previous: Process Management (←)"'), 'Previous button must indicate previous concept name');
    });

    test('mobile responsive rules scale concept headings down for narrow viewports', () => {
      assert.ok(cssContent.includes('@media (max-width: 640px)'), 'CSS must include mobile breakpoint');
      assert.ok(cssContent.includes('clamp(26px, 7vw, 34px)'), 'Mobile title font size must scale cleanly with clamp');
    });
  });

  describe('9. Task 03: Revision Session State', () => {
    beforeEach(() => {
      storageMap.clear();
    });

    // Realistic second graph for testing multi-graph isolation
    const neuralGraph: KnowledgeGraph = {
      id: 'graph-neural-core',
      name: 'Neural Architectures',
      description: 'Foundations of artificial neural networks',
      nodes: [
        {
          id: 'c-perceptron',
          name: 'Single Layer Perceptron',
          type: 'foundation',
          description: 'Linear binary classifier model.',
          sourceIds: ['src-n1']
        },
        {
          id: 'c-backprop',
          name: 'Backpropagation',
          type: 'algorithm',
          description: 'Gradient calculation through chain rule.',
          sourceIds: ['src-n2']
        }
      ],
      relationships: [
        {
          id: 'rel-perc-backprop',
          source: 'c-perceptron',
          target: 'c-backprop',
          type: 'leads-to',
          sourceChunkIds: []
        }
      ],
      sources: []
    };

    test('1. Session Model: identifies graph ID, ordered concept IDs, current index, total, timestamps, and progress', () => {
      const session = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 0,
        currentConceptId: 'c-cpu-sched'
      });

      assert.equal(session.graphId, 'graph-os-core', 'Session must identify graphId');
      assert.deepEqual(session.conceptIds, ['c-cpu-sched', 'c-process', 'c-virtual-mem'], 'Must store ordered concept IDs');
      assert.equal(session.totalConcepts, 3, 'Must identify total concepts');
      assert.equal(session.currentIndex, 0, 'Must identify current index');
      assert.equal(session.currentConceptId, 'c-cpu-sched', 'Must identify current concept ID');
      assert.ok(session.createdAt, 'Must identify createdAt timestamp');
      assert.ok(session.updatedAt, 'Must identify updatedAt timestamp');
      assert.ok(Array.isArray(session.reviewedConceptIds), 'Must track reviewedConceptIds');
      assert.ok(Array.isArray(session.markedForReviewIds), 'Must track markedForReviewIds');

      // Verify stable concept IDs as references, not duplicating graph node objects
      assert.equal(typeof session.conceptIds[0], 'string', 'Concept list must contain stable string IDs');
      assert.equal(typeof session.conceptIds[1], 'string', 'Concept list must contain stable string IDs');
    });

    test('2. Navigation: sequentially advances with Next and retreats with Previous', () => {
      const session = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem']
      });

      // At start: Previous is disabled, Next is enabled
      assert.equal(canNavigatePrev(session), false, 'Previous must be disabled at start');
      assert.equal(canNavigateNext(session), true, 'Next must be enabled at start');

      // Attempting to retreat does not change index or become negative
      const retreated = navigatePrev(session);
      assert.equal(retreated.currentIndex, 0, 'Index must not become negative');

      // Advance to concept 2
      const step1 = navigateNext(session);
      assert.equal(step1.currentIndex, 1, 'Next must advance to index 1');
      assert.equal(step1.currentConceptId, 'c-process', 'Next must point to concept c-process');
      assert.ok(step1.reviewedConceptIds.includes('c-cpu-sched'), 'Must track preceding concept in reviewed list');

      // Advance to concept 3
      const step2 = navigateNext(step1);
      assert.equal(step2.currentIndex, 2, 'Next must advance to index 2');
      assert.equal(step2.currentConceptId, 'c-virtual-mem', 'Next must point to concept c-virtual-mem');

      // At end: Next is disabled, Previous is enabled
      assert.equal(canNavigateNext(step2), false, 'Next must be disabled at final concept');
      assert.equal(canNavigatePrev(step2), true, 'Previous must be enabled at final concept');

      // Attempting to advance past end keeps index clamped
      const overAdvanced = navigateNext(step2);
      assert.equal(overAdvanced.currentIndex, 2, 'Index must not exceed session length');

      // Retreat to concept 2
      const backStep = navigatePrev(step2);
      assert.equal(backStep.currentIndex, 1, 'Previous must return to index 1');
      assert.equal(backStep.currentConceptId, 'c-process', 'Previous must point to concept c-process');
    });

    test('3. Single-Concept Sessions: disables both Previous and Next navigation and preserves index 0', () => {
      const singleNodeGraph: KnowledgeGraph = {
        id: 'graph-single-node',
        name: 'Single Concept Curriculum',
        nodes: [
          {
            id: 'c-isolated',
            name: 'Isolated Concept',
            type: 'foundation',
            description: 'Sole concept in this graph.',
            sourceIds: []
          }
        ],
        relationships: [],
        sources: []
      };

      const session = createRevisionSession({
        graphId: 'graph-single-node',
        conceptIds: ['c-isolated']
      });

      assert.equal(session.totalConcepts, 1, 'Total concepts must be 1');
      assert.equal(canNavigatePrev(session), false, 'Previous must be disabled for single-concept session');
      assert.equal(canNavigateNext(session), false, 'Next must be disabled for single-concept session');

      const nextAttempt = navigateNext(session);
      assert.equal(nextAttempt.currentIndex, 0, 'Index must remain 0 on Next');

      const prevAttempt = navigatePrev(session);
      assert.equal(prevAttempt.currentIndex, 0, 'Index must remain 0 on Previous');

      // Render check: DOM must disable both links
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: singleNodeGraph,
          graphName: 'Single Concept Curriculum',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('01 / 01'), 'Must render "01 / 01" progress');
      assert.ok(html.includes('revision-nav-prev disabled'), 'Previous link must have disabled class');
      assert.ok(html.includes('revision-nav-next disabled'), 'Next link must have disabled class');
    });

    test('4. Session Preservation: persists minimal session to storage without duplicated graph objects', () => {
      const session = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 1,
        currentConceptId: 'c-process',
        reviewedConceptIds: ['c-cpu-sched']
      });

      saveRevisionSession(session, 'graph-os-core');

      // Verify raw storage payload is minimal (only IDs, index, timestamps)
      const rawStored = storageMap.get('graphmind_revision_session_v1_graph-os-core');
      assert.ok(rawStored, 'Session must be stored in localStorage');
      const parsed = JSON.parse(rawStored!);

      assert.equal(parsed.graphId, 'graph-os-core');
      assert.equal(parsed.currentIndex, 1);
      assert.equal(parsed.currentConceptId, 'c-process');
      assert.deepEqual(parsed.conceptIds, ['c-cpu-sched', 'c-process', 'c-virtual-mem']);
      assert.deepEqual(parsed.reviewedConceptIds, ['c-cpu-sched']);
      assert.equal(parsed.nodes, undefined, 'Must not duplicate full graph nodes in session storage');
      assert.equal(parsed.relationships, undefined, 'Must not duplicate graph relationships in session storage');

      // Load back and verify fidelity
      const loaded = loadRevisionSession('graph-os-core');
      assert.ok(loaded, 'Must load session from storage');
      assert.equal(loaded?.currentIndex, 1);
      assert.equal(loaded?.currentConceptId, 'c-process');
      assert.equal(loaded?.totalConcepts, 3);
    });

    test('5. Graph Exploration & Return: restores exact concept position without resetting to concept 01', () => {
      // Simulate user having progressed to Concept 02 (c-process) in OS graph
      const session = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 1,
        currentConceptId: 'c-process'
      });
      saveRevisionSession(session, 'graph-os-core');

      // User explores graph, then returns to RevisionWorkspace (uncontrolled index)
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );

      // Must restore Concept 02 ("Process Management") and counter "02 / 03"
      assert.ok(html.includes('02 / 03'), 'Must restore concept position "02 / 03"');
      assert.ok(html.includes('CONCEPT 02'), 'Must restore badge "CONCEPT 02"');
      assert.ok(html.includes('Process Management'), 'Must restore concept title for position 02');
      assert.ok(
        !html.includes('CONCEPT 01'),
        'Must NOT reset to CONCEPT 01 when returning from graph exploration'
      );
    });

    test('6. Graph Selection Changes: strictly isolates sessions and never combines concepts from different graphs', () => {
      // Save OS session
      const osSession = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 2,
        currentConceptId: 'c-virtual-mem'
      });
      saveRevisionSession(osSession, 'graph-os-core');

      // Validate OS session against Neural Graph: must be rejected (null)
      const crossGraphValidation = validateRevisionSession(osSession, neuralGraph);
      assert.equal(crossGraphValidation, null, 'Must reject session originating from a different graph');

      // Load session for Neural Graph: must not contain OS concepts
      const neuralLoaded = loadRevisionSession('graph-neural-core');
      assert.equal(neuralLoaded, null, 'Neural graph must not load OS graph session');

      // Render Neural Graph in RevisionWorkspace: starts fresh for Neural Graph
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: neuralGraph,
          graphName: 'Neural Architectures',
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('Single Layer Perceptron'), 'Must render Neural Graph concept');
      assert.ok(html.includes('01 / 02'), 'Must show Neural Graph progress "01 / 02"');
      assert.ok(!html.includes('CPU Scheduling'), 'Must never leak concepts from OS graph');
      assert.ok(!html.includes('Virtual Memory'), 'Must never leak concepts from OS graph');
    });

    test('7. Deleted or Missing Concepts: recovers position gracefully without throwing', () => {
      // Graph where c-process was deleted by user
      const prunedGraph: KnowledgeGraph = {
        id: 'graph-os-core',
        name: 'Operating Systems',
        nodes: [
          {
            id: 'c-cpu-sched',
            name: 'CPU Scheduling',
            type: 'algorithm',
            sourceIds: []
          },
          {
            id: 'c-virtual-mem',
            name: 'Virtual Memory',
            type: 'system',
            sourceIds: []
          }
        ],
        relationships: [],
        sources: []
      };

      // Stored session still referenced the deleted concept c-process at index 1
      const staleSession: RevisionSessionState = {
        isActive: true,
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 1,
        currentConceptId: 'c-process',
        totalConcepts: 3,
        createdAt: new Date().toISOString(),
        reviewedConceptIds: [],
        markedForReviewIds: []
      };

      const validated = validateRevisionSession(staleSession, prunedGraph);
      assert.ok(validated, 'Must successfully sanitize stale session');
      assert.deepEqual(validated?.conceptIds, ['c-cpu-sched', 'c-virtual-mem'], 'Must filter out deleted concept');
      assert.equal(validated?.totalConcepts, 2, 'Total must update to 2');
      assert.ok(validated!.currentIndex < 2, 'Index must be safely clamped within valid concepts');

      // When rendered with pruned graph: handles without throwing and renders a valid concept
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: prunedGraph,
          session: validated,
          onBackToGraph: () => {}
        })
      );

      assert.ok(html.includes('01 / 02') || html.includes('02 / 02'), 'Renders valid bounded progress');
      assert.ok(!html.includes('c-process'), 'Deleted concept is not rendered');
    });

    test('8. Empty and Missing Graphs: renders calm guidance and graph selection action', () => {
      // A. Empty graph (0 concepts)
      const emptyGraph: KnowledgeGraph = {
        id: 'graph-empty',
        name: 'Empty Graph',
        nodes: [],
        relationships: [],
        sources: []
      };

      const htmlEmpty = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: emptyGraph,
          onBackToGraph: () => {}
        })
      );
      assert.ok(htmlEmpty.includes('No concepts available for revision'));
      assert.ok(htmlEmpty.includes('Add materials or create concepts to begin studying.'));

      // B. Missing/null graph with onSelectGraph action
      let selectGraphCalled = false;
      const htmlNull = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: null,
          onBackToGraph: () => {},
          onSelectGraph: () => { selectGraphCalled = true; }
        })
      );

      assert.ok(htmlNull.includes('No graph selected'));
      assert.ok(htmlNull.includes('Select knowledge graph'));
      assert.ok(htmlNull.includes('Return to knowledge graph'));
    });

    test('9. Malformed / Invalid Persisted State: validates data safely and prevents workspace crash', () => {
      // A. Malformed non-JSON stored in localStorage
      storageMap.set('graphmind_revision_session_v1_graph-os-core', '{ broken: json :::');
      const corruptedLoad = loadRevisionSession('graph-os-core');
      assert.equal(corruptedLoad, null, 'Must return null for broken JSON');

      // B. Stored data with invalid types
      storageMap.set(
        'graphmind_revision_session_v1_graph-os-core',
        JSON.stringify({
          graphId: 'graph-os-core',
          conceptIds: 'not an array',
          currentIndex: -50
        })
      );
      const invalidTypesLoad = loadRevisionSession('graph-os-core');
      assert.equal(invalidTypesLoad, null, 'Must reject invalid types and return null');

      // C. RevisionWorkspace renders without throwing despite corrupted storage
      assert.doesNotThrow(() => {
        renderToString(
          React.createElement(RevisionWorkspace, {
            graph: mockGraph,
            onBackToGraph: () => {}
          })
        );
      }, 'RevisionWorkspace must never crash due to corrupted storage');
    });

    test('10. Assessment State & History: remains completely unaffected by revision sessions', () => {
      assert.equal(
        ASSESSMENT_HISTORY_STORAGE_KEY,
        'graphmind_assessment_attempts_v1',
        'Assessment storage key must remain unchanged'
      );

      // Verify clearing revision session does not touch assessment storage
      storageMap.set(ASSESSMENT_HISTORY_STORAGE_KEY, JSON.stringify([{ id: 'attempt-1' }]));
      saveRevisionSession(
        createRevisionSession({ graphId: 'graph-os-core', conceptIds: ['c-1'] }),
        'graph-os-core'
      );

      clearRevisionSession('graph-os-core');
      assert.equal(loadRevisionSession('graph-os-core'), null, 'Revision session must be cleared');
      assert.ok(
        storageMap.has(ASSESSMENT_HISTORY_STORAGE_KEY),
        'Assessment history storage must be completely untouched'
      );
    });
  });

  describe('10. Cinematic Workspace Entry & Concept Motion (Task 04)', () => {
    test('1. Stage 1 Workspace Arrival: transitions reading area with subtle displacement and no large scaling', () => {
      const variants = createWorkspaceArrivalVariants(false);
      assert.ok(variants.hidden, 'Arrival variants must define hidden initial state');
      assert.ok(variants.settled, 'Arrival variants must define settled final state');

      // Subtle displacement and opacity
      assert.equal((variants.hidden as any).opacity, 0);
      assert.equal((variants.hidden as any).y, 12, 'Arrival hidden state displacement must be subtle (12px)');
      assert.equal((variants.hidden as any).scale, undefined, 'Must avoid large scaling effects');

      // Settled transition
      assert.equal((variants.settled as any).opacity, 1);
      assert.equal((variants.settled as any).y, 0);
      assert.deepEqual(
        (variants.settled as any).transition.ease,
        [0.16, 1, 0.3, 1],
        'Must use GraphMind editorial cubic-bezier easing curve'
      );
      assert.ok(
        (variants.settled as any).transition.duration <= 0.4,
        'Arrival transition must be restrained (<= 0.4s)'
      );

      // DOM render check
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );
      assert.ok(html.includes('revision-reading-column'), 'Rendered workspace must include reading column');
      assert.ok(cssContent.includes('--ease-editorial: cubic-bezier(0.16, 1, 0.3, 1)'), 'CSS must define --ease-editorial token');
    });

    test('2. Stage 2 Session Metadata: reveals progress kicker and indicator with restrained delay', () => {
      const variants = createSessionMetadataVariants(false, false);
      assert.equal((variants.hidden as any).opacity, 0);
      assert.equal((variants.hidden as any).y, 8, 'Metadata hidden displacement must be 8px');
      assert.equal((variants.settled as any).opacity, 1);
      assert.equal((variants.settled as any).y, 0);

      const transition = (variants.settled as any).transition;
      assert.equal(transition.delay, 0.08, 'Metadata must reveal with restrained delay of 0.08s');
      assert.equal(transition.duration, 0.28, 'Metadata duration must be 0.28s');
      assert.deepEqual(transition.ease, [0.16, 1, 0.3, 1]);
    });

    test('3. Stage 3 Concept Introduction: enforces strict visual hierarchy (Badge -> Title -> Description)', () => {
      const badgeVariants = createConceptBadgeVariants(false, false);
      const titleVariants = createConceptTitleVariants(false, false);
      const descVariants = createConceptDescriptionVariants(false, false);

      const badgeDelay = (badgeVariants.settled as any).transition.delay;
      const titleDelay = (titleVariants.settled as any).transition.delay;
      const descDelay = (descVariants.settled as any).transition.delay;

      const titleDuration = (titleVariants.settled as any).transition.duration;
      const badgeDuration = (badgeVariants.settled as any).transition.duration;
      const descDuration = (descVariants.settled as any).transition.duration;

      // 1. Badge reveals first
      assert.equal(badgeDelay, 0.14, 'Concept badge identifier must reveal first (0.14s delay)');

      // 2. Title reveals second
      assert.equal(titleDelay, 0.20, 'Concept title must reveal after identifier (0.20s delay)');
      assert.ok(badgeDelay < titleDelay, 'Badge must appear before title');

      // 3. Description reveals finally
      assert.equal(descDelay, 0.28, 'Concept description must reveal after title (0.28s delay)');
      assert.ok(titleDelay < descDelay, 'Title must appear before description');

      // 4. Concept title receives most visual attention (longer, deliberate reveal)
      assert.ok(
        titleDuration > badgeDuration,
        `Title duration (${titleDuration}s) must be longer than badge duration (${badgeDuration}s) for emphasis`
      );
      assert.ok(
        titleDuration > descDuration,
        `Title duration (${titleDuration}s) must be longer than description duration (${descDuration}s) for emphasis`
      );
      assert.equal((titleVariants.hidden as any).y, 10, 'Title uses slightly larger displacement (10px) for deliberate reveal');
    });

    test('4. Stage 4 Navigation: reveals previous/next controls after main content settles without blocking clicks', () => {
      const navVariants = createNavigationVariants(false, false);
      const descVariants = createConceptDescriptionVariants(false, false);

      const navDelay = (navVariants.settled as any).transition.delay;
      const descDelay = (descVariants.settled as any).transition.delay;

      assert.equal(navDelay, 0.36, 'Navigation controls reveal after main content settles (0.36s delay)');
      assert.ok(navDelay > descDelay, 'Navigation must reveal after description has started settling');

      // Render verification: navigation buttons are rendered without artificial pointer lockout
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          onBackToGraph: () => {}
        })
      );
      assert.ok(html.includes('revision-concept-navigation'), 'Must include revision navigation container');
      assert.ok(!html.includes('pointer-events: none'), 'Must never block user interaction during entry');
    });

    test('5. Direction-Aware Concept Transitions: forward progress enters from +14px and backward reverses it', () => {
      const canvasVariants = createConceptCanvasVariants(false);

      // Forward navigation (Next concept: dir = 1)
      const forwardEnter = (canvasVariants.enter as any)(1);
      const forwardExit = (canvasVariants.exit as any)(1);
      assert.equal(forwardEnter.opacity, 0);
      assert.equal(forwardEnter.x, 14, 'Forward entrance must enter from +14px to suggest forward progress');
      assert.equal(forwardExit.x, -14, 'Forward exit must glide to -14px');

      // Backward navigation (Previous concept: dir = -1)
      const backwardEnter = (canvasVariants.enter as any)(-1);
      const backwardExit = (canvasVariants.exit as any)(-1);
      assert.equal(backwardEnter.opacity, 0);
      assert.equal(backwardEnter.x, -14, 'Backward entrance must enter from -14px (reversed direction)');
      assert.equal(backwardExit.x, 14, 'Backward exit must glide to +14px (reversed direction)');

      // Center state settles at x = 0 with opacity 1
      assert.equal((canvasVariants.center as any).opacity, 1);
      assert.equal((canvasVariants.center as any).x, 0);

      // Header remains stable (not wrapped in concept canvas)
      assert.ok(
        cssContent.includes('.revision-workspace-header'),
        'Workspace header must remain stable without whole-app shell animation'
      );
    });

    test('6. Avoid Replaying Entry Animation: returning from graph exploration preserves session and skips entry delays', () => {
      // When entry animation has already played:
      const metaSettled = createSessionMetadataVariants(false, true);
      const titleSettled = createConceptTitleVariants(false, true);
      const descSettled = createConceptDescriptionVariants(false, true);
      const navSettled = createNavigationVariants(false, true);

      // All entry delays must be 0s so returning is instant and stable
      assert.equal((metaSettled.settled as any).transition.delay, 0, 'Metadata delay must be 0 on return');
      assert.equal((titleSettled.settled as any).transition.delay, 0, 'Title delay must be 0 on return');
      assert.equal((descSettled.settled as any).transition.delay, 0, 'Description delay must be 0 on return');
      assert.equal((navSettled.settled as any).transition.delay, 0, 'Navigation delay must be 0 on return');

      // markEntryAnimationPlayed sets entryAnimationPlayed: true
      const session = createRevisionSession({ graphId: 'graph-os-core', conceptIds: ['c-cpu-sched'] });
      assert.equal(session.entryAnimationPlayed, false, 'Fresh session must start with entryAnimationPlayed false');
      const marked = markEntryAnimationPlayed(session);
      assert.equal(marked.entryAnimationPlayed, true, 'markEntryAnimationPlayed must set flag to true');

      // When rendered with skipEntryAnimation or returning session, renders settled content
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          graphName: 'Operating Systems',
          skipEntryAnimation: true,
          onBackToGraph: () => {}
        })
      );
      assert.ok(html.includes('Operating Systems'));
      assert.ok(html.includes('CPU Scheduling'));
    });

    test('7. Progress Indicator Fluid Animation: remains synchronized with current index and avoids division by zero', () => {
      // Boundary 1: First concept (0 of 3) => 33.33%
      const total3 = 3;
      const idx0 = 0;
      const pct0 = total3 > 0 ? ((idx0 + 1) / total3) * 100 : 0;
      assert.ok(Math.abs(pct0 - 33.333) < 0.01, 'First concept of 3 must be 33.33%');

      // Boundary 2: Last concept (2 of 3) => 100%
      const idx2 = 2;
      const pct2 = total3 > 0 ? ((idx2 + 1) / total3) * 100 : 0;
      assert.equal(pct2, 100, 'Last concept must be exactly 100%');

      // Boundary 3: Single-concept session (0 of 1) => 100%
      const total1 = 1;
      const pctSingle = total1 > 0 ? ((0 + 1) / total1) * 100 : 0;
      assert.equal(pctSingle, 100, 'Single-concept session must be 100%');

      // Boundary 4: Zero concepts (empty graph) => 0% without NaN or dividing by zero
      const total0 = 0;
      const pctEmpty = total0 > 0 ? ((0 + 1) / total0) * 100 : 0;
      assert.equal(pctEmpty, 0, 'Zero concepts must safely evaluate to 0%');
      assert.ok(!isNaN(pctEmpty), 'Zero concepts must not yield NaN');

      // Render check: progress fill element is present with role progressbar
      const html = renderToString(
        React.createElement(RevisionWorkspace, {
          graph: mockGraph,
          revisionIndex: 1,
          onBackToGraph: () => {}
        })
      );
      assert.ok(html.includes('revision-progress-track'), 'Track must exist');
      assert.ok(html.includes('revision-progress-fill'), 'Fill indicator must exist');
      assert.ok(html.includes('aria-valuenow="2"'), 'Synchronized aria-valuenow must be 2');
    });

    test('8. Accessibility: respects prefers-reduced-motion in Framer Motion variants and CSS', () => {
      // Reduced motion variants
      const reducedArrival = createWorkspaceArrivalVariants(true);
      const reducedMeta = createSessionMetadataVariants(true, false);
      const reducedBadge = createConceptBadgeVariants(true, false);
      const reducedTitle = createConceptTitleVariants(true, false);
      const reducedDesc = createConceptDescriptionVariants(true, false);
      const reducedNav = createNavigationVariants(true, false);
      const reducedCanvas = createConceptCanvasVariants(true);

      // Displacements are removed (y = 0, x = 0)
      assert.equal((reducedArrival.hidden as any).y, 0, 'Arrival y displacement must be 0 for reduced motion');
      assert.equal((reducedMeta.hidden as any).y, 0, 'Metadata y displacement must be 0 for reduced motion');
      assert.equal((reducedBadge.hidden as any).y, 0, 'Badge y displacement must be 0 for reduced motion');
      assert.equal((reducedTitle.hidden as any).y, 0, 'Title y displacement must be 0 for reduced motion');
      assert.equal((reducedDesc.hidden as any).y, 0, 'Description y displacement must be 0 for reduced motion');
      assert.equal((reducedNav.hidden as any).y, 0, 'Navigation y displacement must be 0 for reduced motion');

      const reducedEnterFwd = (reducedCanvas.enter as any)(1);
      const reducedEnterBwd = (reducedCanvas.enter as any)(-1);
      assert.equal(reducedEnterFwd.x, 0, 'Canvas x displacement must be 0 for reduced motion');
      assert.equal(reducedEnterBwd.x, 0, 'Canvas x displacement must be 0 for reduced motion');

      // Staged delays are removed (delay = 0)
      assert.equal((reducedMeta.settled as any).transition.delay, 0, 'Metadata delay must be 0');
      assert.equal((reducedTitle.settled as any).transition.delay, 0, 'Title delay must be 0');
      assert.equal((reducedNav.settled as any).transition.delay, 0, 'Navigation delay must be 0');

      // Durations are zeroed out
      assert.equal((reducedArrival.settled as any).transition.duration, 0);
      assert.equal((reducedTitle.settled as any).transition.duration, 0);

      // CSS verification
      assert.ok(
        cssContent.includes('@media (prefers-reduced-motion: reduce)'),
        'revision.css must include @media (prefers-reduced-motion: reduce)'
      );
      assert.ok(
        cssContent.includes('transform: none !important'),
        'CSS must disable transforms when reduced motion is preferred'
      );
      assert.ok(
        cssContent.includes('animation: none !important'),
        'CSS must disable animations when reduced motion is preferred'
      );
    });

    test('9. Interaction Responsiveness: rapid navigation never desynchronizes state or resets session', () => {
      let currentSession = createRevisionSession({
        graphId: 'graph-os-core',
        conceptIds: ['c-cpu-sched', 'c-process', 'c-virtual-mem'],
        currentIndex: 0
      });

      // Rapid consecutive Next clicks (0 -> 1 -> 2 -> 2 clamped)
      currentSession = navigateNext(currentSession);
      assert.equal(currentSession.currentIndex, 1);
      currentSession = navigateNext(currentSession);
      assert.equal(currentSession.currentIndex, 2);
      currentSession = navigateNext(currentSession);
      assert.equal(currentSession.currentIndex, 2, 'Must safely clamp at last concept');

      // Rapid consecutive Prev clicks (2 -> 1 -> 0 -> 0 clamped)
      currentSession = navigatePrev(currentSession);
      assert.equal(currentSession.currentIndex, 1);
      currentSession = navigatePrev(currentSession);
      assert.equal(currentSession.currentIndex, 0);
      currentSession = navigatePrev(currentSession);
      assert.equal(currentSession.currentIndex, 0, 'Must safely clamp at first concept');

      // Concept direction correctly reflects navigation intent
      const canvasVariants = createConceptCanvasVariants(false);
      assert.equal(((canvasVariants.enter as any)(1)).x, 14, 'Forward intent retains forward entry');
      assert.equal(((canvasVariants.enter as any)(-1)).x, -14, 'Backward intent retains backward entry');
    });
  });
});


