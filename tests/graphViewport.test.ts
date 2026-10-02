import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Node, Edge } from '@xyflow/react';
import type { GraphConceptData, ConceptCategory } from '../src/types/graph';
import type { KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import { calculateVisibleGraph, computeConceptPriority } from '../src/services/graphViewport';
import { computeGraphLayout } from '../src/services/graphLayout';

/**
 * Helper to build synthetic nodes for testing
 */
function createMockNode(
  id: string,
  label: string,
  category: ConceptCategory = 'Method',
  confidence = 90,
  pos = { x: 100, y: 100 }
): Node<GraphConceptData> {
  return {
    id,
    type: 'conceptNode',
    position: { ...pos },
    data: {
      id,
      label,
      code: id.toUpperCase(),
      category,
      description: `Description for ${label}`,
      prerequisites: [],
      relationships: [],
      confidence,
      source: 'Test Source',
      synapseCount: 0
    }
  };
}

/**
 * Helper to build synthetic edges for testing
 */
function createMockEdge(id: string, source: string, target: string, label = 'related-to'): Edge {
  return {
    id,
    source,
    target,
    type: 'custom',
    label,
    data: {
      id,
      relation: label
    }
  };
}

describe('Graph Viewport & Scalable Exploration System', () => {

  describe('1. Small Graph Natural Presentation (<= 20 concepts)', () => {
    test('renders all nodes naturally without artificial hiding when node count <= 20', () => {
      const nodes: Node<GraphConceptData>[] = [];
      const edges: Edge[] = [];

      for (let i = 1; i <= 12; i++) {
        nodes.push(createMockNode(`c${i}`, `Concept ${i}`, i <= 3 ? 'Foundation' : 'Method'));
      }
      edges.push(createMockEdge('e1-2', 'c1', 'c2'));
      edges.push(createMockEdge('e1-3', 'c1', 'c3'));

      const result = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced'
      });

      assert.strictEqual(result.isSubsetEnabled, false);
      assert.strictEqual(result.totalNodeCount, 12);
      assert.strictEqual(result.renderedNodeCount, 12);
      assert.strictEqual(result.visibleNodes.length, 12);
      assert.strictEqual(result.hiddenCount, 0);
    });

    test('highlights selected node and direct connections in small graph while dimming unrelated nodes', () => {
      const nodes = [
        createMockNode('c1', 'Concept 1', 'Foundation'),
        createMockNode('c2', 'Concept 2', 'Method'),
        createMockNode('c3', 'Concept 3', 'Application'),
        createMockNode('c4', 'Concept 4', 'Method')
      ];
      const edges = [
        createMockEdge('e1-2', 'c1', 'c2'),
        createMockEdge('e2-3', 'c2', 'c3')
      ];

      const result = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'c1',
        densityMode: 'balanced'
      });

      const n1 = result.visibleNodes.find(n => n.id === 'c1');
      const n2 = result.visibleNodes.find(n => n.id === 'c2');
      const n3 = result.visibleNodes.find(n => n.id === 'c3');

      assert.strictEqual(n1?.data.visibilityState, 'focused');
      assert.strictEqual(n1?.data.selected, true);
      assert.strictEqual(n1?.data.dimmed, false);

      assert.strictEqual(n2?.data.visibilityState, 'contextual');
      assert.strictEqual(n2?.data.highlighted, true);
      assert.strictEqual(n2?.data.dimmed, false);

      assert.strictEqual(n3?.data.dimmed, true);
    });
  });

  describe('2. Large Graph Initial View Composition (> 20 concepts)', () => {
    test('renders curated relevance subset in balanced mode for large graphs without simply slicing first N', () => {
      const nodes: Node<GraphConceptData>[] = [];
      const edges: Edge[] = [];

      // Generate 60 concepts: 5 foundations, 10 paradigms, 15 architectures, 15 methods, 15 applications
      for (let i = 1; i <= 60; i++) {
        let cat: ConceptCategory = 'Application';
        let conf = 70;
        if (i <= 5) { cat = 'Foundation'; conf = 98; }
        else if (i <= 15) { cat = 'Paradigm'; conf = 92; }
        else if (i <= 30) { cat = 'Architecture'; conf = 85; }
        else if (i <= 45) { cat = 'Method'; conf = 80; }

        nodes.push(createMockNode(`node_${i}`, `Concept ${i}`, cat, conf, { x: i * 20, y: i * 10 }));
      }

      // Link foundations to many nodes (high degree hubs)
      for (let i = 6; i <= 30; i++) {
        edges.push(createMockEdge(`e-1-${i}`, 'node_1', `node_${i}`));
      }

      const result = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced'
      });

      assert.strictEqual(result.isSubsetEnabled, true);
      assert.strictEqual(result.totalNodeCount, 60);
      assert.ok(result.renderedNodeCount <= 32, `Rendered count ${result.renderedNodeCount} should be <= 32 in balanced mode`);
      assert.ok(result.renderedNodeCount >= 20, `Rendered count ${result.renderedNodeCount} should be >= 20 in balanced mode`);

      // Major foundation hub node_1 MUST be visible
      const n1 = result.visibleNodes.find(n => n.id === 'node_1');
      assert.ok(n1, 'Central foundational hub node_1 must be included in the initial view');

      // The full graph in allNodes is preserved
      assert.strictEqual(nodes.length, 60);
    });
  });

  describe('3. Exploration Depth & Neighborhood Expansion', () => {
    test('selecting a concept reveals its direct neighbors (Depth 1) and contextual neighbors (Depth 2)', () => {
      const nodes: Node<GraphConceptData>[] = [];
      const edges: Edge[] = [];

      for (let i = 1; i <= 50; i++) {
        nodes.push(createMockNode(`n${i}`, `Concept ${i}`, i <= 5 ? 'Foundation' : 'Method', 75, { x: i * 10, y: i * 10 }));
      }

      // n45 is a deep node with neighbors n46, n47 (depth 1) and n48 (depth 2)
      edges.push(createMockEdge('e-45-46', 'n45', 'n46'));
      edges.push(createMockEdge('e-45-47', 'n45', 'n47'));
      edges.push(createMockEdge('e-46-48', 'n46', 'n48'));

      // In initial view with no selection, n45, n46, n47, n48 would likely be hidden because of low priority
      const initial = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced'
      });

      // Now user selects or searches n45:
      const explored = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'n45',
        densityMode: 'balanced'
      });

      const selected = explored.visibleNodes.find(n => n.id === 'n45');
      const d1_a = explored.visibleNodes.find(n => n.id === 'n46');
      const d1_b = explored.visibleNodes.find(n => n.id === 'n47');
      const d2 = explored.visibleNodes.find(n => n.id === 'n48');

      assert.ok(selected, 'Selected node n45 must be revealed in the viewport');
      assert.strictEqual(selected.data.visibilityState, 'focused');
      assert.strictEqual(selected.data.explorationDepth, 0);

      assert.ok(d1_a, 'Direct neighbor n46 must be revealed at Depth 1');
      assert.strictEqual(d1_a.data.explorationDepth, 1);
      assert.strictEqual(d1_a.data.highlighted, true);

      assert.ok(d1_b, 'Direct neighbor n47 must be revealed at Depth 1');
      assert.strictEqual(d1_b.data.explorationDepth, 1);

      assert.ok(d2, 'Secondary contextual neighbor n48 must be revealed at Depth 2');
      assert.strictEqual(d2.data.explorationDepth, 2);
    });

    test('preserves layout coordinates strictly so nodes do NOT jump around when revealed', () => {
      const nodes: Node<GraphConceptData>[] = [];
      const edges: Edge[] = [];

      for (let i = 1; i <= 40; i++) {
        nodes.push(createMockNode(`node_${i}`, `Concept ${i}`, 'Method', 80, { x: 300 + i * 15, y: 200 + i * 25 }));
      }
      edges.push(createMockEdge('e-1-35', 'node_1', 'node_35'));

      const initial = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'node_1',
        densityMode: 'focused'
      });

      const revealed = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'node_35',
        densityMode: 'balanced'
      });

      const posOriginal35 = nodes.find(n => n.id === 'node_35')!.position;
      const posRevealed35 = revealed.visibleNodes.find(n => n.id === 'node_35')!.position;

      assert.strictEqual(posRevealed35.x, posOriginal35.x);
      assert.strictEqual(posRevealed35.y, posOriginal35.y);
    });
  });

  describe('4. Density Modes (Focused, Balanced, Expanded)', () => {
    test('respects density budgets across modes on a large graph', () => {
      const nodes: Node<GraphConceptData>[] = [];
      const edges: Edge[] = [];

      for (let i = 1; i <= 80; i++) {
        nodes.push(createMockNode(`c_${i}`, `Concept ${i}`, 'Architecture', 80));
      }
      for (let i = 1; i <= 79; i++) {
        edges.push(createMockEdge(`e_${i}`, `c_${i}`, `c_${i + 1}`));
      }

      const focused = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'c_1',
        densityMode: 'focused'
      });

      const balanced = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'c_1',
        densityMode: 'balanced'
      });

      const expanded = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'c_1',
        densityMode: 'expanded'
      });

      assert.ok(focused.renderedNodeCount <= 16, `Focused mode should render <= 16 nodes, got ${focused.renderedNodeCount}`);
      assert.ok(balanced.renderedNodeCount > focused.renderedNodeCount, 'Balanced should render more than focused');
      assert.ok(expanded.renderedNodeCount > balanced.renderedNodeCount, 'Expanded should render more than balanced');
      assert.ok(expanded.renderedNodeCount <= 80, 'Expanded should stay within reasonable bounds');
    });
  });

  describe('5. Large Graph Layout Collision Avoidance & Determinism', () => {
    test('computes deterministic, overlap-free coordinates for 60 nodes', () => {
      const rawNodes: KnowledgeNode[] = [];
      const rawRels: KnowledgeRelationship[] = [];

      for (let i = 1; i <= 60; i++) {
        const type = i <= 5 ? 'foundation' : i <= 20 ? 'paradigm' : i <= 40 ? 'method' : 'application';
        rawNodes.push({
          id: `k_${i}`,
          name: `Knowledge Concept ${i}`,
          type,
          description: `Description ${i}`,
          sourceIds: ['src_1']
        });
      }

      // Add connections
      for (let i = 1; i <= 15; i++) {
        rawRels.push({
          id: `rel_${i}`,
          source: `k_${(i % 5) + 1}`,
          target: `k_${i + 5}`,
          type: 'related-to',
          sourceChunkIds: []
        });
      }

      const layout1 = computeGraphLayout(rawNodes, rawRels);
      const layout2 = computeGraphLayout(rawNodes, rawRels);

      // Verify determinism: layout1 and layout2 must produce exact same coordinates
      for (const [id, pos1] of layout1) {
        const pos2 = layout2.get(id);
        assert.ok(pos2, `Node ${id} missing in layout2`);
        assert.strictEqual(pos1.x, pos2.x, `Node ${id} X position must be deterministic`);
        assert.strictEqual(pos1.y, pos2.y, `Node ${id} Y position must be deterministic`);
      }

      // Verify collision avoidance: no two node cards should overlap
      const nodeWidth = 236;
      const nodeHeight = 124;
      const positions = Array.from(layout1.values());

      let overlapCount = 0;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = Math.abs(positions[i].x - positions[j].x);
          const dy = Math.abs(positions[i].y - positions[j].y);
          if (dx < nodeWidth && dy < nodeHeight) {
            overlapCount++;
          }
        }
      }

      assert.strictEqual(overlapCount, 0, 'Zero bounding-box overlaps should exist after relaxation pass');
    });
  });

});
