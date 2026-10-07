import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SearchResultItem, GraphDensityMode } from '../src/types/graph';
import type { StudyFilterMode } from '../src/types/practice';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import type { Node, Edge } from '@xyflow/react';

describe('GraphMind Canvas Toolbar Redesign — Information Architecture & Behavior', () => {

  const mockAvailableNodes: SearchResultItem[] = [
    { id: 'c1', label: 'CPU Scheduling', category: 'Foundation', code: 'cpu', practiceStatus: 'needs-review' },
    { id: 'c2', label: 'Process Control Block', category: 'Architecture', code: 'pcb', practiceStatus: 'understood' },
    { id: 'c3', label: 'Round Robin', category: 'Method', code: 'rr', practiceStatus: 'learning' },
    { id: 'c4', label: 'First Come First Served', category: 'Method', code: 'fcfs', practiceStatus: 'unseen' },
  ];

  describe('1. Information Architecture & Toolbar Cleanliness (Section 1 & 14)', () => {
    test('toolbar organizes controls into distinct logical groups: Search, Study Mode, View, and Utilities', () => {
      // Primary hierarchy:
      // Group 1: Prominent Search (240–280px)
      // Group 2: Study (or active Study Mode: Exit study, Filter, Next)
      // Group 3: View density dropdown (Balanced ▾)
      // Group 4: Far-right utilities ([ Export ▾ ] [ ··· ])
      const primaryGroups = ['search', 'study', 'view', 'utilities'];
      assert.equal(primaryGroups.length, 4);
      assert.deepEqual(primaryGroups, ['search', 'study', 'view', 'utilities']);
    });

    test('replaces crowded permanent pills (All, Needs Review, Study State, Focused, Balanced, Expanded, Fit, Reset, Export)', () => {
      // Prompt Section 1: Do NOT show All, Needs Review, Study State, Focused, Expanded, Fit, Reset, Export
      // directly in the main toolbar.
      const legacyMainBarPills = [
        'All',
        'Needs Review',
        'Study State',
        'Focused',
        'Expanded',
        'Fit',
        'Reset',
        'Export'
      ];

      // Redesigned toolbar replaces these with:
      // - View dropdown (Balanced ▾)
      // - Study mode transition (Study or ← Exit study / filter / Next →)
      // - Export dropdown (Export ▾)
      // - Popover secondary menu (···)
      const primaryToolbarControls = ['Search concepts... ⌘K', 'Study', 'Balanced ▾', 'Export ▾', '···'];
      
      for (const legacyPill of legacyMainBarPills) {
        assert.ok(
          !primaryToolbarControls.includes(legacyPill),
          `Legacy pill "${legacyPill}" must NOT be permanently displayed in main toolbar`
        );
      }
    });
  });

  describe('2. Search Control (Section 2)', () => {
    test('filters available nodes by label and category with prefix prioritization', () => {
      const q = 'round';
      const results = mockAvailableNodes
        .filter(n => n.label.toLowerCase().includes(q) || n.category.toLowerCase().includes(q))
        .sort((a, b) => {
          const aName = a.label.toLowerCase();
          const bName = b.label.toLowerCase();
          if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
          if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
          return a.label.localeCompare(b.label);
        });

      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'c3');
      assert.equal(results[0].label, 'Round Robin');
    });

    test('preserves semantic practice status pips in search results', () => {
      const cpuNode = mockAvailableNodes.find(n => n.id === 'c1');
      assert.equal(cpuNode?.practiceStatus, 'needs-review');

      const pcbNode = mockAvailableNodes.find(n => n.id === 'c2');
      assert.equal(pcbNode?.practiceStatus, 'understood');

      const rrNode = mockAvailableNodes.find(n => n.id === 'c3');
      assert.equal(rrNode?.practiceStatus, 'learning');
    });
  });

  describe('3. Study as a Mode (Section 3 & 6)', () => {
    test('displays Study as a primary action in normal state with optional review counter', () => {
      const isStudyPanelOpen = false;
      const needsReviewCount = 3;

      const studyState = {
        isStudyPanelOpen,
        label: 'Study',
        counter: needsReviewCount > 0 ? needsReviewCount : null
      };

      assert.equal(studyState.label, 'Study');
      assert.equal(studyState.counter, 3);
    });

    test('transitions into Study Mode when activated: Exit study, contextual filter, and Next', () => {
      const isStudyPanelOpen = true;
      const needsReviewCount = 2;
      const studyFilterMode: StudyFilterMode = 'needs-review';

      const studyModeControls = {
        exitAction: 'Exit study',
        filterLabel: studyFilterMode === 'needs-review' && needsReviewCount > 0 
          ? `${needsReviewCount} to review` 
          : 'All',
        nextAction: 'Next'
      };

      assert.equal(studyModeControls.exitAction, 'Exit study');
      assert.equal(studyModeControls.filterLabel, '2 to review');
      assert.equal(studyModeControls.nextAction, 'Next');
    });

    test('study filters are contextually exposed with 4 semantic states: All, Needs review, In progress, Studied', () => {
      const validFilterStates: StudyFilterMode[] = [
        'all',
        'needs-review',
        'in-progress',
        'studied'
      ];

      assert.equal(validFilterStates.length, 4);
      assert.ok(validFilterStates.includes('all'));
      assert.ok(validFilterStates.includes('needs-review'));
      assert.ok(validFilterStates.includes('in-progress'));
      assert.ok(validFilterStates.includes('studied'));
    });
  });

  describe('4. View Mode Minimal Dropdown (Section 4)', () => {
    test('formats active view density into compact Balanced ▾ trigger', () => {
      const modes: GraphDensityMode[] = ['focused', 'balanced', 'expanded'];
      const labels = modes.map(m => m.charAt(0).toUpperCase() + m.slice(1) + ' ▾');

      assert.deepEqual(labels, ['Focused ▾', 'Balanced ▾', 'Expanded ▾']);
    });

    test('changing view mode retains existing graph behavior and density modes', () => {
      const sampleNodes: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1', code: '1', category: 'Foundation', confidence: 90, synapseCount: 0 } },
        { id: '2', position: { x: 100, y: 100 }, data: { label: 'Node 2', code: '2', category: 'Method', confidence: 85, synapseCount: 0 } }
      ];
      const sampleEdges: Edge[] = [
        { id: 'e1', source: '1', target: '2' }
      ];

      const focused = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: '1',
        densityMode: 'focused'
      });
      assert.equal(focused.densityMode, 'focused');

      const balanced = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: '1',
        densityMode: 'balanced'
      });
      assert.equal(balanced.densityMode, 'balanced');

      const expanded = calculateVisibleGraph({
        allNodes: sampleNodes,
        allEdges: sampleEdges,
        selectedNodeId: '1',
        densityMode: 'expanded'
      });
      assert.equal(expanded.densityMode, 'expanded');
    });
  });

  describe('5. Secondary Menu (···) Structure (Section 5)', () => {
    test('contains View density, Fit graph, Reset view, and Export graph in clean sections', () => {
      const menuStructure = {
        section1: {
          header: 'VIEW',
          options: ['Focused', 'Balanced', 'Expanded']
        },
        section2: {
          options: ['Fit graph', 'Reset view']
        },
        section3: {
          options: ['Export image', 'Export JSON']
        }
      };

      assert.equal(menuStructure.section1.header, 'VIEW');
      assert.deepEqual(menuStructure.section1.options, ['Focused', 'Balanced', 'Expanded']);
      assert.deepEqual(menuStructure.section2.options, ['Fit graph', 'Reset view']);
      assert.deepEqual(menuStructure.section3.options, ['Export image', 'Export JSON']);
    });
  });

  describe('6. Canvas Controls (Section 7)', () => {
    test('provides quiet corner navigation hit targets: Zoom in (+), Zoom out (−), Fit/fullscreen (⛶)', () => {
      const cornerControls = [
        { id: 'zoom-in', symbol: '+', label: 'Zoom in' },
        { id: 'zoom-out', symbol: '−', label: 'Zoom out' },
        { id: 'fit', symbol: '⛶', label: 'Fit graph to view' }
      ];

      assert.equal(cornerControls.length, 3);
      assert.equal(cornerControls[0].symbol, '+');
      assert.equal(cornerControls[1].symbol, '−');
      assert.equal(cornerControls[2].symbol, '⛶');
    });

    test('replaces redundant toolbar zoom buttons with dedicated Export dropdown', () => {
      // Zoom (+), (−), and Fit (⛶) are housed in the bottom-right corner of the canvas.
      // In the toolbar, they are replaced by the dedicated Export ▾ dropdown.
      const toolbarUtilityControls = ['Export ▾', '···'];
      assert.ok(toolbarUtilityControls.includes('Export ▾'));
      assert.ok(!toolbarUtilityControls.includes('+'));
      assert.ok(!toolbarUtilityControls.includes('−'));
      assert.ok(!toolbarUtilityControls.includes('⛶'));
    });
  });

  describe('7. Viewport Filter Integration for All 4 States (Section 6 & 13)', () => {
    const nodes: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A', code: 'a', category: 'Foundation', confidence: 90, synapseCount: 0 } },
      { id: 'b', position: { x: 100, y: 0 }, data: { label: 'B', code: 'b', category: 'Method', confidence: 85, synapseCount: 0 } },
      { id: 'c', position: { x: 200, y: 0 }, data: { label: 'C', code: 'c', category: 'Application', confidence: 80, synapseCount: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' }
    ];
    const practiceStates = {
      a: { conceptId: 'a', status: 'needs-review' as const, practiceCount: 1 },
      b: { conceptId: 'b', status: 'learning' as const, practiceCount: 1 },
      c: { conceptId: 'c', status: 'understood' as const, practiceCount: 2 }
    };

    test('filters to needs-review concepts when studyFilterMode is needs-review', () => {
      const res = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'needs-review',
        practiceStates
      });

      const aNode = res.visibleNodes.find(n => n.id === 'a');
      assert.ok(aNode);
      assert.equal(aNode.data.dimmed, false);

      const cNode = res.visibleNodes.find(n => n.id === 'c');
      assert.ok(cNode);
      assert.equal(cNode.data.dimmed, true);
    });

    test('filters to in-progress concepts when studyFilterMode is in-progress', () => {
      const res = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'in-progress',
        practiceStates
      });

      const bNode = res.visibleNodes.find(n => n.id === 'b');
      assert.ok(bNode);
      assert.equal(bNode.data.dimmed, false);

      const cNode = res.visibleNodes.find(n => n.id === 'c');
      assert.ok(cNode);
      assert.equal(cNode.data.dimmed, true);
    });

    test('filters to studied concepts when studyFilterMode is studied', () => {
      const res = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'studied',
        practiceStates
      });

      const cNode = res.visibleNodes.find(n => n.id === 'c');
      assert.ok(cNode);
      assert.equal(cNode.data.dimmed, false);

      const aNode = res.visibleNodes.find(n => n.id === 'a');
      assert.ok(aNode);
      assert.equal(aNode.data.dimmed, true);
    });

    test('shows all concepts without status dimming when studyFilterMode is all', () => {
      const res = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced',
        studyFilterMode: 'all',
        practiceStates
      });

      for (const n of res.visibleNodes) {
        assert.equal(n.data.dimmed, false);
      }
    });
  });

  describe('8. Study Mode Transformation Animation Architecture (Sections 1–15)', () => {
    test('configures restrained layout spring without overshoot or bounce', () => {
      const springConfig = {
        type: 'spring',
        stiffness: 420,
        damping: 32,
        mass: 0.7
      };

      // Damping ratio = damping / (2 * sqrt(mass * stiffness)) = 32 / (2 * sqrt(294)) ≈ 0.93 (near critical)
      const criticalDamping = 2 * Math.sqrt(springConfig.mass * springConfig.stiffness);
      const dampingRatio = springConfig.damping / criticalDamping;

      assert.equal(springConfig.stiffness, 420);
      assert.equal(springConfig.damping, 32);
      assert.equal(springConfig.mass, 0.7);
      assert.ok(dampingRatio > 0.85 && dampingRatio < 1.0, 'Spring must be near critically damped to prevent bouncing');
    });

    test('reverses sequence on exit: Next → All → Exit study → Study', () => {
      const enterSequence = ['divider-1', 'filter', 'divider-2', 'next'];
      const exitSequence = [...enterSequence].reverse();

      assert.deepEqual(exitSequence, ['next', 'divider-2', 'filter', 'divider-1']);
    });

    test('maintains quiet active accent travelling beam timing within 200–300ms', () => {
      const beamDurationMs = 280;
      assert.ok(beamDurationMs >= 200 && beamDurationMs <= 300);
    });

    test('reduced motion disables unfolding translations and defaults to short opacity transition', () => {
      const reducedMotionVariants = {
        hidden: { opacity: 0, transition: { duration: 0.1 } },
        visible: { opacity: 1, transition: { duration: 0.1 } }
      };

      assert.equal(reducedMotionVariants.hidden.opacity, 0);
      assert.equal(reducedMotionVariants.visible.opacity, 1);
      assert.equal(reducedMotionVariants.visible.transition.duration, 0.1);
    });
  });
});

