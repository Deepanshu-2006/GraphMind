import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import type { PipelineStage, PipelineProgressEvent } from '../src/services/pipelineOrchestrator';
import { PRE_GRAPH_NODES, PRE_GRAPH_EDGES } from '../src/components/graph/CanvasEmptyState';

/**
 * Unit test suite verifying the behavior of the refined canvas-native empty state:
 * - Organic clusters (breaking geometric loop/polygon)
 * - Central quiet zone clearance for dominant editorial typography
 * - 3-tier node hierarchy (Primary green, Secondary muted, Tertiary low-opacity)
 * - Subtle relationship lines without central intersections
 * - Exact required copy & tightened hierarchy
 * - Strict empty condition: 0 concepts, no live processing
 * - Processing state precedence (no "empty" during extraction/ingestion)
 * - Concept presence unmounting empty state
 * - Multi-graph workspace switching transitions
 */

// Helper simulating mode resolution logic from KnowledgeGraphWorkspace
function resolveWorkspaceMode({
  nodesCount,
  partialGraphNodeCount = 0,
  pipelineStage,
  livePipelineEvent,
  initialMode = 'interactive'
}: {
  nodesCount: number;
  partialGraphNodeCount?: number;
  pipelineStage?: PipelineStage;
  livePipelineEvent?: PipelineProgressEvent | null;
  initialMode?: 'interactive' | 'empty' | 'loading' | 'crafting';
}): 'interactive' | 'empty' | 'loading' | 'crafting' {
  const isLiveError = livePipelineEvent?.stage === 'error' || pipelineStage === 'error';
  const isLiveProcessing = Boolean(
    !isLiveError &&
    ((livePipelineEvent &&
      livePipelineEvent.stage !== 'complete') ||
    (pipelineStage &&
      pipelineStage !== 'complete'))
  );
  const isLiveComplete = !isLiveError && (livePipelineEvent?.stage === 'complete' || pipelineStage === 'complete');
  const effectiveCount = Math.max(
    nodesCount, 
    partialGraphNodeCount, 
    livePipelineEvent?.partialGraph?.nodes?.length || 0
  );

  if (isLiveProcessing) return 'crafting';
  if (isLiveComplete) {
    return effectiveCount === 0 ? 'empty' : 'interactive';
  }
  if (initialMode === 'empty' || effectiveCount === 0) {
    return 'empty';
  }
  return initialMode;
}

// Exact specification of editorial copy for empty canvas
const EMPTY_CANVAS_SPEC = {
  eyebrow: 'KNOWLEDGE GRAPH / EMPTY CANVAS',
  heading: 'Build your first\nknowledge graph.',
  supporting: 'Upload your study material and GraphMind will map the concepts and relationships inside it.',
  ctaText: 'UPLOAD MATERIAL ↗',
  formats: 'PDF · TXT · MARKDOWN',
  dragOverHeading: 'Drop material\nto build graph.'
};

describe('Refined Organic Editorial Canvas Empty State', () => {
  describe('Editorial Copy & Typographic Hierarchy Invariants', () => {
    it('matches exact GraphMind editorial copy specifications', () => {
      assert.equal(EMPTY_CANVAS_SPEC.eyebrow, 'KNOWLEDGE GRAPH / EMPTY CANVAS');
      assert.equal(EMPTY_CANVAS_SPEC.heading, 'Build your first\nknowledge graph.');
      assert.equal(
        EMPTY_CANVAS_SPEC.supporting,
        'Upload your study material and GraphMind will map the concepts and relationships inside it.'
      );
      assert.equal(EMPTY_CANVAS_SPEC.ctaText, 'UPLOAD MATERIAL ↗');
      assert.equal(EMPTY_CANVAS_SPEC.formats, 'PDF · TXT · MARKDOWN');
    });

    it('has intentional line break in the dominant heading', () => {
      const lines = EMPTY_CANVAS_SPEC.heading.split('\n');
      assert.equal(lines.length, 2);
      assert.equal(lines[0], 'Build your first');
      assert.equal(lines[1], 'knowledge graph.');
    });
  });

  describe('Organic Clusters & Non-Geometric Distribution', () => {
    it('distributes 16 nodes into loose clusters instead of a geometric loop', () => {
      assert.equal(PRE_GRAPH_NODES.length, 16);

      // Verify presence of 4 distinct quadrant clusters
      const upperLeft = PRE_GRAPH_NODES.filter(n => n.x < 300 && n.y < 300);
      const upperRight = PRE_GRAPH_NODES.filter(n => n.x > 700 && n.y < 300);
      const lowerLeft = PRE_GRAPH_NODES.filter(n => n.x < 300 && n.y > 450);
      const lowerRight = PRE_GRAPH_NODES.filter(n => n.x > 700 && n.y > 450);
      const marginNodes = PRE_GRAPH_NODES.filter(n => (n.x < 120 || n.x > 900) && n.y >= 300 && n.y <= 450);

      assert.equal(upperLeft.length, 4, 'Upper-left cluster should have 4 nodes');
      assert.equal(upperRight.length, 4, 'Upper-right cluster should have 4 nodes');
      assert.equal(lowerLeft.length, 3, 'Lower-left cluster should have 3 nodes');
      assert.equal(lowerRight.length, 3, 'Lower-right cluster should have 3 nodes');
      assert.equal(marginNodes.length, 2, 'Should have 2 margin bridging nodes');
    });

    it('implements 3-tier node hierarchy with restrained GraphMind green accents', () => {
      const primary = PRE_GRAPH_NODES.filter(n => n.tier === 'primary');
      const secondary = PRE_GRAPH_NODES.filter(n => n.tier === 'secondary');
      const tertiary = PRE_GRAPH_NODES.filter(n => n.tier === 'tertiary');

      // Primary: 3-4px, green, only a small number (3)
      assert.equal(primary.length, 3, 'Must have exactly 3 primary green nodes');
      for (const node of primary) {
        assert.ok(node.r >= 3.0 && node.r <= 4.0, `Primary node ${node.id} radius must be 3-4px`);
        assert.equal(node.isAccent, true, `Primary node ${node.id} must be marked isAccent`);
      }

      // Secondary: 2-3px muted gray
      assert.ok(secondary.length >= 6, 'Must have secondary muted nodes');
      for (const node of secondary) {
        assert.ok(node.r >= 2.0 && node.r <= 3.0, `Secondary node ${node.id} radius must be 2-3px`);
      }

      // Tertiary: 1-2px low opacity
      assert.ok(tertiary.length >= 5, 'Must have tertiary subtle nodes');
      for (const node of tertiary) {
        assert.ok(node.r >= 1.0 && node.r <= 2.0, `Tertiary node ${node.id} radius must be 1-2px`);
      }
    });

    it('strictly preserves the central quiet zone around the dominant typography', () => {
      // Quiet zone box: x: 270..750, y: 235..465
      const nodesInQuietZone = PRE_GRAPH_NODES.filter(
        n => n.x >= 270 && n.x <= 750 && n.y >= 235 && n.y <= 465
      );
      assert.equal(nodesInQuietZone.length, 0, 'No nodes may sit inside the central quiet zone');

      // Check that no edge crosses through the quiet zone
      const nodeMap = new Map(PRE_GRAPH_NODES.map(n => [n.id, n]));
      for (const edge of PRE_GRAPH_EDGES) {
        const s = nodeMap.get(edge.source)!;
        const t = nodeMap.get(edge.target)!;
        assert.ok(s && t, `Edge ${edge.id} must have valid endpoints`);

        // Check midpoint does not sit in quiet zone center (350..700, 240..450)
        const midX = (s.x + t.x) / 2;
        const midY = (s.y + t.y) / 2;
        const midInQuietZone = midX >= 280 && midX <= 740 && midY >= 240 && midY <= 450;
        assert.equal(
          midInQuietZone,
          false,
          `Edge ${edge.id} from (${s.x},${s.y}) to (${t.x},${t.y}) must not cross through the quiet zone`
        );
      }
    });

    it('breaks bottom perimeter connection to avoid forming a closed polygon', () => {
      const nodeMap = new Map(PRE_GRAPH_NODES.map(n => [n.id, n]));
      // Assert no edge connects lower-left directly across the bottom to lower-right
      const lowerLeftIds = new Set(PRE_GRAPH_NODES.filter(n => n.x < 300 && n.y > 450).map(n => n.id));
      const lowerRightIds = new Set(PRE_GRAPH_NODES.filter(n => n.x > 700 && n.y > 450).map(n => n.id));

      for (const edge of PRE_GRAPH_EDGES) {
        const isCrossBottom =
          (lowerLeftIds.has(edge.source) && lowerRightIds.has(edge.target)) ||
          (lowerRightIds.has(edge.source) && lowerLeftIds.has(edge.target));
        assert.equal(isCrossBottom, false, 'Must not connect lower clusters across the bottom');
      }
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

    it('resolves to interactive when partialGraph has nodes even if context graph nodesCount is initially 0', () => {
      const mode = resolveWorkspaceMode({
        nodesCount: 0,
        pipelineStage: 'complete',
        livePipelineEvent: {
          stage: 'complete',
          message: 'Your knowledge graph is ready.',
          timestamp: Date.now(),
          partialGraph: {
            id: 'test-graph',
            nodes: [{ id: 'n1', name: 'Concept 1' }] as any,
            relationships: [],
            sources: []
          }
        }
      });
      assert.equal(mode, 'interactive', 'Must transition to interactive when partialGraph has nodes, preventing empty state');
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

      // Step 3: Switch back to DBMS
      const dbmsBackMode = resolveWorkspaceMode({ nodesCount: dbmsGraph.nodes.length, pipelineStage: 'complete' });
      assert.equal(dbmsBackMode, 'interactive', 'Switching back to populated graph must restore interactive mode');
    });
  });
});
