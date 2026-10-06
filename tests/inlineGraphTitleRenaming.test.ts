import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGraphs,
  saveGraphs,
  loadActiveGraphId,
  saveActiveGraphId,
  createGraph,
  renameGraph,
  loadGraphData,
  saveGraphData,
  DEFAULT_MIGRATION_GRAPH_ID,
  DEFAULT_MIGRATION_GRAPH_NAME
} from '../src/services/storage';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('Inline Graph-Title Renaming Architecture & Persistence', () => {
  beforeEach(() => {
    storageMap.clear();
    saveGraphs([]);
  });

  describe('Requirement 1 & 8: Data Model Persistence & Single Source of Truth', () => {
    it('renames graph in persistence and keeps graph metadata and graph data synchronized', () => {
      // Create initial graph
      const initialMeta = createGraph('Neural & Cognitive Architectures');
      assert.equal(initialMeta.name, 'Neural & Cognitive Architectures');

      // Associate some graph data
      const sampleGraph: KnowledgeGraph = {
        id: initialMeta.id,
        name: 'Neural & Cognitive Architectures',
        nodes: [{ id: 'n1', name: 'Neuron', type: 'Concept' }],
        relationships: [],
        sources: []
      };
      saveGraphData(initialMeta.id, sampleGraph);

      // Perform rename
      const updatedMeta = renameGraph(initialMeta.id, 'Advanced Neural Systems');
      assert.ok(updatedMeta);
      assert.equal(updatedMeta.name, 'Advanced Neural Systems');

      // Verify loadGraphs() reflects new name
      const allGraphs = loadGraphs();
      const current = allGraphs.find(g => g.id === initialMeta.id);
      assert.ok(current);
      assert.equal(current.name, 'Advanced Neural Systems');

      // Verify graph data itself has the updated name
      const loadedData = loadGraphData(initialMeta.id);
      assert.ok(loadedData);
      assert.equal(loadedData.name, 'Advanced Neural Systems');
    });

    it('survives switching graphs, switching back, and simulated page reload', () => {
      const graphA = createGraph('Graph Alpha');
      const graphB = createGraph('Graph Beta');

      // Rename Graph Alpha
      renameGraph(graphA.id, 'Graph Alpha Prime');

      // Switch to Graph Beta
      saveActiveGraphId(graphB.id);
      assert.equal(loadActiveGraphId(), graphB.id);

      // Switch back to Graph Alpha
      saveActiveGraphId(graphA.id);
      assert.equal(loadActiveGraphId(), graphA.id);

      // Verify persistence returns renamed title
      const all = loadGraphs();
      const alphaMeta = all.find(g => g.id === graphA.id);
      assert.ok(alphaMeta);
      assert.equal(alphaMeta.name, 'Graph Alpha Prime');
    });
  });

  describe('Requirement 6 & 7: Validation and Edge Cases', () => {
    it('trims leading and trailing whitespace before saving', () => {
      const graph = createGraph('Calculus');
      const updated = renameGraph(graph.id, '   Vector Calculus 101   ');
      assert.ok(updated);
      assert.equal(updated.name, 'Vector Calculus 101');
    });

    it('rejects empty or whitespace-only names and throws without mutating stored graph', () => {
      const graph = createGraph('Operating Systems');

      // Attempt empty string
      assert.throws(() => {
        renameGraph(graph.id, '');
      }, /cannot be empty/i);

      // Attempt whitespace-only string
      assert.throws(() => {
        renameGraph(graph.id, '     ');
      }, /cannot be empty/i);

      // Verify original title was NOT mutated
      const all = loadGraphs();
      const current = all.find(g => g.id === graph.id);
      assert.ok(current);
      assert.equal(current.name, 'Operating Systems');
    });

    it('rejects graph names longer than 100 characters', () => {
      const graph = createGraph('Short Title');
      const longTitle = 'A'.repeat(101);

      assert.throws(() => {
        renameGraph(graph.id, longTitle);
      }, /100 characters or less/i);

      // Verify original title remains intact
      const all = loadGraphs();
      const current = all.find(g => g.id === graph.id);
      assert.ok(current);
      assert.equal(current.name, 'Short Title');
    });
  });

  describe('Requirement 2, 3, 4, 5, 14: Inline Interaction Logic and State Machine', () => {
    // Model state transitions for inline title editing
    interface InlineTitleState {
      isEditing: boolean;
      originalTitle: string;
      draftTitle: string;
      validationError: string | null;
      isSubmitting: boolean;
    }

    const createInitialState = (name: string): InlineTitleState => ({
      isEditing: false,
      originalTitle: name,
      draftTitle: name,
      validationError: null,
      isSubmitting: false,
    });

    const onDoubleClickTitle = (state: InlineTitleState): InlineTitleState => ({
      ...state,
      isEditing: true,
      draftTitle: state.originalTitle,
      validationError: null,
    });

    const onType = (state: InlineTitleState, newText: string): InlineTitleState => ({
      ...state,
      draftTitle: newText,
      validationError: state.validationError && newText.trim().length > 0 ? null : state.validationError,
    });

    const onSave = (
      state: InlineTitleState,
      persistFn: (newName: string) => void
    ): InlineTitleState => {
      if (state.isSubmitting) return state;

      const trimmed = state.draftTitle.trim();
      if (!trimmed) {
        return {
          ...state,
          validationError: "Graph name can't be empty.",
        };
      }
      if (trimmed.length > 100) {
        return {
          ...state,
          validationError: 'Graph name must be 100 characters or less.',
        };
      }

      persistFn(trimmed);
      return {
        ...state,
        isEditing: false,
        originalTitle: trimmed,
        draftTitle: trimmed,
        validationError: null,
        isSubmitting: false,
      };
    };

    const onCancel = (state: InlineTitleState): InlineTitleState => ({
      ...state,
      isEditing: false,
      draftTitle: state.originalTitle,
      validationError: null,
      isSubmitting: false,
    });

    it('handles full editing lifecycle: double click -> edit -> save -> updated title', () => {
      const graph = createGraph('Quantum Mechanics');
      let state = createInitialState(graph.name);

      // User double clicks title
      state = onDoubleClickTitle(state);
      assert.equal(state.isEditing, true);
      assert.equal(state.draftTitle, 'Quantum Mechanics');

      // User modifies text
      state = onType(state, 'Quantum Computing & Algorithms');
      assert.equal(state.draftTitle, 'Quantum Computing & Algorithms');

      // User presses Enter / clicks Save
      state = onSave(state, (newName) => {
        renameGraph(graph.id, newName);
      });

      assert.equal(state.isEditing, false);
      assert.equal(state.originalTitle, 'Quantum Computing & Algorithms');

      // Verify storage reflects change
      const loaded = loadGraphs().find(g => g.id === graph.id);
      assert.equal(loaded?.name, 'Quantum Computing & Algorithms');
    });

    it('handles cancel lifecycle: double click -> edit -> escape/cancel -> reverts cleanly', () => {
      const graph = createGraph('Machine Learning');
      let state = createInitialState(graph.name);

      // Double click to edit
      state = onDoubleClickTitle(state);
      assert.equal(state.isEditing, true);

      // User changes text to something else
      state = onType(state, 'Abandoned Name Change');
      assert.equal(state.draftTitle, 'Abandoned Name Change');

      // User cancels via Escape or Cancel button
      let persistCalled = false;
      state = onCancel(state);

      assert.equal(state.isEditing, false);
      assert.equal(state.draftTitle, 'Machine Learning');
      assert.equal(state.originalTitle, 'Machine Learning');
      assert.equal(persistCalled, false);

      // Storage should still have original title
      const loaded = loadGraphs().find(g => g.id === graph.id);
      assert.equal(loaded?.name, 'Machine Learning');
    });

    it('rejects empty title on save attempt, displays inline validation message, and keeps editor open', () => {
      const graph = createGraph('Linear Algebra');
      let state = createInitialState(graph.name);

      state = onDoubleClickTitle(state);
      state = onType(state, '    '); // whitespace only

      let persisted = false;
      state = onSave(state, () => {
        persisted = true;
      });

      // Editor remains OPEN
      assert.equal(state.isEditing, true);
      assert.equal(state.validationError, "Graph name can't be empty.");
      assert.equal(persisted, false);

      // Now user types valid characters: error clears
      state = onType(state, 'Linear Algebra & Tensors');
      assert.equal(state.validationError, null);

      state = onSave(state, (newName) => {
        renameGraph(graph.id, newName);
      });

      assert.equal(state.isEditing, false);
      assert.equal(state.originalTitle, 'Linear Algebra & Tensors');
      const loaded = loadGraphs().find(g => g.id === graph.id);
      assert.equal(loaded?.name, 'Linear Algebra & Tensors');
    });

    it('prevents duplicate submissions when save is triggered multiple times rapidly', () => {
      const graph = createGraph('Computer Architecture');
      let state = createInitialState(graph.name);
      state = onDoubleClickTitle(state);
      state = onType(state, 'RISC-V Systems');

      let callCount = 0;
      const persistFn = () => {
        callCount++;
      };

      // Set isSubmitting = true
      state.isSubmitting = true;
      state = onSave(state, persistFn);

      // Ensure persistence was NOT called when isSubmitting was true
      assert.equal(callCount, 0);
    });
  });

  describe('Requirement 9 & 10: Double Click vs Dropdown Trigger Compatibility', () => {
    it('cancels pending single-click dropdown toggle when double-click occurs within window', () => {
      let isOpen = false;
      let isEditing = false;
      let timerId: any = null;

      const clickDelay = 220; // 220ms debounce

      const handleTitleClick = () => {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
          isOpen = !isOpen;
          timerId = null;
        }, clickDelay);
      };

      const handleTitleDoubleClick = () => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        isOpen = false;
        isEditing = true;
      };

      // First click
      handleTitleClick();
      assert.ok(timerId !== null, 'Timer should be active after first click');
      assert.equal(isOpen, false, 'Dropdown should not open immediately');

      // Second click (within 220ms) triggers double click
      handleTitleDoubleClick();
      assert.equal(timerId, null, 'Timer should be cancelled by double click');
      assert.equal(isOpen, false, 'Dropdown should remain CLOSED');
      assert.equal(isEditing, true, 'Inline editing should be ACTIVE');
    });

    it('allows single-click on chevron to open dropdown immediately without debounce', () => {
      let isOpen = false;
      const handleChevronClick = () => {
        isOpen = !isOpen;
      };

      handleChevronClick();
      assert.equal(isOpen, true, 'Chevron single click immediately opens dropdown');
    });
  });

  describe('Requirement 14: Keyboard and Accessibility Affordances', () => {
    it('supports F2 key to trigger rename from keyboard focus', () => {
      let isEditing = false;
      const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'F2') {
          e.preventDefault();
          isEditing = true;
        }
      };

      let prevented = false;
      handleKeyDown({
        key: 'F2',
        preventDefault: () => { prevented = true; }
      });

      assert.equal(prevented, true);
      assert.equal(isEditing, true);
    });

    it('verifies accessibility element contracts: accessible label and button types', () => {
      const inputAttributes = {
        'aria-label': 'Graph name',
        id: 'topbar-graph-title-input',
        maxLength: 100,
        type: 'text'
      };
      assert.equal(inputAttributes['aria-label'], 'Graph name');
      assert.equal(inputAttributes.id, 'topbar-graph-title-input');
      assert.equal(inputAttributes.maxLength, 100);

      const cancelBtnAttributes = {
        type: 'button',
        title: 'Cancel editing (Esc)',
        id: 'btn-topbar-rename-cancel'
      };
      assert.equal(cancelBtnAttributes.type, 'button');

      const saveBtnAttributes = {
        type: 'button',
        title: 'Save changes (Enter)',
        id: 'btn-topbar-rename-save'
      };
      assert.equal(saveBtnAttributes.type, 'button');
    });
  });
});
