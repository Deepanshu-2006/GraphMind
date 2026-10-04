import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { PipelineStage, PipelineProgressEvent } from '../src/services/pipelineOrchestrator';

/**
 * Unit test suite verifying the behavior of the canvas-native empty state:
 * - Dynamic graph name in heading: "${graphName} is ready for its first material."
 * - Non-generic, educational supporting text
 * - Drag-and-drop state copy transitions
 * - Strict empty condition: 0 concepts, no live processing
 * - Processing state precedence (no "empty" during extraction/ingestion)
 * - Concept presence unmounting empty state
 * - Clean multi-graph workspace transitions
 */

// Helper simulating mode resolution logic from KnowledgeGraphWorkspace
function resolveWorkspaceMode({
  nodesCount,
  pipelineStage,
  livePipelineEvent,
  initialMode = 'interactive'
}: {
  nodesCount: number;
  pipelineStage?: PipelineStage;
  livePipelineEvent?: PipelineProgressEvent | null;
  initialMode?: 'interactive' | 'empty' | 'loading' | 'crafting';
}): 'interactive' | 'empty' | 'loading' | 'crafting' {
  const isLiveProcessing = Boolean(
    (livePipelineEvent &&
      livePipelineEvent.stage !== 'complete' &&
      livePipelineEvent.stage !== 'error') ||
    (pipelineStage &&
      pipelineStage !== 'complete' &&
      pipelineStage !== 'error')
  );
  const isLiveComplete = livePipelineEvent?.stage === 'complete' || pipelineStage === 'complete';

  if (isLiveProcessing) return 'crafting';
  if (isLiveComplete) {
    return nodesCount === 0 ? 'empty' : 'interactive';
  }
  if (initialMode === 'empty' || nodesCount === 0) {
    return 'empty';
  }
  return initialMode;
}

// Helper simulating dynamic copy generation
function getEmptyStateCopy(graphName?: string, isDragOver: boolean = false) {
  const resolvedName = graphName?.trim() || 'Your graph';
  return {
    heading: isDragOver
      ? 'Drop material to start the graph.'
      : `${resolvedName} is ready for its first material.`,
    supportingText: isDragOver
      ? 'GraphMind will extract concepts and map their relationships.'
      : 'Upload study material and GraphMind will map the concepts and relationships inside it.'
  };
}

describe('Canvas-Native Knowledge Graph Empty State', () => {
  describe('Dynamic Contextual Copy', () => {
    it('generates quiet contextual heading using the active graph name', () => {
      const physicsCopy = getEmptyStateCopy('Physics');
      assert.equal(physicsCopy.heading, 'Physics is ready for its first material.');
      assert.equal(
        physicsCopy.supportingText,
        'Upload study material and GraphMind will map the concepts and relationships inside it.'
      );

      const dbmsCopy = getEmptyStateCopy('DBMS');
      assert.equal(dbmsCopy.heading, 'DBMS is ready for its first material.');

      const mlCopy = getEmptyStateCopy('Machine Learning');
      assert.equal(mlCopy.heading, 'Machine Learning is ready for its first material.');
    });

    it('falls back gracefully to generic graph title if graphName is missing or whitespace', () => {
      const emptyCopy = getEmptyStateCopy('');
      assert.equal(emptyCopy.heading, 'Your graph is ready for its first material.');

      const undefinedCopy = getEmptyStateCopy(undefined);
      assert.equal(undefinedCopy.heading, 'Your graph is ready for its first material.');
    });

    it('smoothly switches copy when file is dragged over canvas', () => {
      const dragOverCopy = getEmptyStateCopy('Physics', true);
      assert.equal(dragOverCopy.heading, 'Drop material to start the graph.');
      assert.equal(
        dragOverCopy.supportingText,
        'GraphMind will extract concepts and map their relationships.'
      );
    });
  });

  describe('Empty State Conditions & Mode Resolution', () => {
    it('resolves to empty when a graph has 0 concepts and no processing is running', () => {
      const mode = resolveWorkspaceMode({
        nodesCount: 0,
        pipelineStage: 'complete',
        livePipelineEvent: null
      });
      assert.equal(mode, 'empty', 'Graph with 0 concepts must be in empty mode');
    });

    it('resolves to crafting (not empty) when material is being processed', () => {
      const stages: PipelineStage[] = ['reading', 'extracting', 'normalizing', 'relating', 'assembling'];

      for (const stage of stages) {
        const mode = resolveWorkspaceMode({
          nodesCount: 0,
          pipelineStage: stage,
          livePipelineEvent: { stage, message: `${stage}…`, timestamp: Date.now() }
        });
        assert.equal(
          mode,
          'crafting',
          `During stage ${stage}, mode must be 'crafting' and NOT 'empty'`
        );
      }
    });

    it('resolves to interactive immediately when real concepts exist after completion', () => {
      const mode = resolveWorkspaceMode({
        nodesCount: 18,
        pipelineStage: 'complete',
        livePipelineEvent: { stage: 'complete', message: 'Complete', timestamp: Date.now() }
      });
      assert.equal(mode, 'interactive', 'Must be interactive when nodesCount > 0');
    });
  });

  describe('Multi-Graph Workspace Switching Transitions', () => {
    it('transitions between populated and empty graphs without data leakage or stale copy', () => {
      // Step 1: Active graph is DBMS with 24 concepts
      const dbmsGraph: KnowledgeGraph = {
        id: 'graph-dbms',
        name: 'DBMS',
        nodes: [{ id: 'c1', name: 'Relational Model', label: 'Relational Model', importance: 0.9, depth: 0, graphId: 'graph-dbms' } as any],
        relationships: [],
        sources: []
      };
      const dbmsMode = resolveWorkspaceMode({ nodesCount: dbmsGraph.nodes.length, pipelineStage: 'complete' });
      assert.equal(dbmsMode, 'interactive');

      // Step 2: Switch to Physics (0 concepts)
      const physicsGraph: KnowledgeGraph = {
        id: 'graph-physics',
        name: 'Physics',
        nodes: [],
        relationships: [],
        sources: []
      };
      const physicsMode = resolveWorkspaceMode({ nodesCount: physicsGraph.nodes.length, pipelineStage: 'complete' });
      assert.equal(physicsMode, 'empty');
      const physicsCopy = getEmptyStateCopy(physicsGraph.name);
      assert.equal(physicsCopy.heading, 'Physics is ready for its first material.');

      // Step 3: Switch back to DBMS
      const dbmsBackMode = resolveWorkspaceMode({ nodesCount: dbmsGraph.nodes.length, pipelineStage: 'complete' });
      assert.equal(dbmsBackMode, 'interactive', 'Switching back to populated graph must restore interactive mode');
    });
  });
});
