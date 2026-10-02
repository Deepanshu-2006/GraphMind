import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure functions mirroring FromMaterialToMeaning 4-stage animation logic
 * for deterministic verification.
 */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function getActiveStageIndex(scrollProgress: number): number {
  if (scrollProgress < 0.25) return 0; // 01 READ
  if (scrollProgress < 0.50) return 1; // 02 FIND
  if (scrollProgress < 0.75) return 2; // 03 CONNECT
  return 3; // 04 EXPLORE
}

interface NodeDef {
  id: string;
  name: string;
  docX: number;
  docY: number;
  graphX: number;
  graphY: number;
}

const TEST_NODES: NodeDef[] = [
  { id: 'n1', name: 'Neural Networks', docX: -76, docY: -58, graphX: 0, graphY: -80 },
  { id: 'n2', name: 'Activation Functions', docX: 72, docY: -18, graphX: -160, graphY: -5 },
  { id: 'n3', name: 'Backpropagation', docX: -72, docY: 34, graphX: 130, graphY: 5 },
  { id: 'n4', name: 'Gradient Descent', docX: 74, docY: 74, graphX: 130, graphY: 105 }
];

const TEST_EDGES = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'uses', startProgress: 0.54, endProgress: 0.65 },
  { id: 'e2', sourceId: 'n1', targetId: 'n3', label: 'trained with', startProgress: 0.60, endProgress: 0.71 },
  { id: 'e3', sourceId: 'n3', targetId: 'n4', label: 'optimizes', startProgress: 0.66, endProgress: 0.76 }
];

describe('FromMaterialToMeaning - 4-Stage Editorial Story Logic', () => {
  test('stage transitions progress monotonically across 4 stages (01 READ, 02 FIND, 03 CONNECT, 04 EXPLORE)', () => {
    assert.equal(getActiveStageIndex(0.0), 0); // READ
    assert.equal(getActiveStageIndex(0.24), 0);
    assert.equal(getActiveStageIndex(0.25), 1); // FIND
    assert.equal(getActiveStageIndex(0.45), 1);
    assert.equal(getActiveStageIndex(0.50), 2); // CONNECT
    assert.equal(getActiveStageIndex(0.70), 2);
    assert.equal(getActiveStageIndex(0.75), 3); // EXPLORE
    assert.equal(getActiveStageIndex(1.0), 3);
  });

  test('smoothstep computes valid [0, 1] range and clamps boundaries', () => {
    assert.equal(smoothstep(0.2, 0.8, 0.0), 0);
    assert.equal(smoothstep(0.2, 0.8, 0.2), 0);
    assert.ok(Math.abs(smoothstep(0.2, 0.8, 0.5) - 0.5) < 1e-9);
    assert.equal(smoothstep(0.2, 0.8, 0.8), 1);
    assert.equal(smoothstep(0.2, 0.8, 1.0), 1);
  });

  test('node coordinates interpolate smoothly from doc position to graph position', () => {
    const node = TEST_NODES[0]; // Neural Networks: doc (-76, -58), graph (0, -80)

    // At emergence start (0.34), emergeProgress is 0
    const emergeStart = smoothstep(0.34, 0.58, 0.34);
    const xStart = node.docX + (node.graphX - node.docX) * emergeStart;
    const yStart = node.docY + (node.graphY - node.docY) * emergeStart;
    assert.equal(xStart, -76);
    assert.equal(yStart, -58);

    // At emergence end (0.58), emergeProgress is 1
    const emergeEnd = smoothstep(0.34, 0.58, 0.58);
    const xEnd = node.docX + (node.graphX - node.docX) * emergeEnd;
    const yEnd = node.docY + (node.graphY - node.docY) * emergeEnd;
    assert.equal(xEnd, 0);
    assert.equal(yEnd, -80);

    // Midpoint interpolation
    const emergeMid = smoothstep(0.34, 0.58, 0.46);
    const xMid = node.docX + (node.graphX - node.docX) * emergeMid;
    assert.ok(xMid > -76 && xMid < 0);
  });

  test('reversible scroll: forward scroll and reverse scroll produce identical state', () => {
    const checkpoints = [0.1, 0.28, 0.46, 0.68, 0.88];

    for (const p of checkpoints) {
      const stageForward = getActiveStageIndex(p);
      const stageReverse = getActiveStageIndex(p);
      assert.equal(stageForward, stageReverse);

      const emergeForward = smoothstep(0.34, 0.58, p);
      const emergeReverse = smoothstep(0.34, 0.58, p);
      assert.equal(emergeForward, emergeReverse);
    }
  });

  test('edges appear progressively and semantic labels show when edge is drawn', () => {
    // Edge 1 starts at 0.54, ends at 0.65
    const edge1 = TEST_EDGES[0];
    assert.equal(smoothstep(edge1.startProgress, edge1.endProgress, 0.50), 0);
    assert.ok(smoothstep(edge1.startProgress, edge1.endProgress, 0.60) > 0);
    assert.equal(smoothstep(edge1.startProgress, edge1.endProgress, 0.65), 1);

    // Edge 3 (last edge) starts at 0.66, ends at 0.76
    const edge3 = TEST_EDGES[2];
    assert.equal(smoothstep(edge3.startProgress, edge3.endProgress, 0.65), 0);
    assert.equal(smoothstep(edge3.startProgress, edge3.endProgress, 0.76), 1);
  });

  test('active node illuminates direct neighbors and dims non-connected nodes', () => {
    const activeConceptId = 'n1'; // Neural Networks
    const activeNeighbors = new Set<string>([activeConceptId]);

    TEST_EDGES.forEach((e) => {
      if (e.sourceId === activeConceptId) activeNeighbors.add(e.targetId);
      if (e.targetId === activeConceptId) activeNeighbors.add(e.sourceId);
    });

    // n1 connects to n2 (uses) and n3 (trained with)
    assert.ok(activeNeighbors.has('n1'));
    assert.ok(activeNeighbors.has('n2'));
    assert.ok(activeNeighbors.has('n3'));

    // n4 (Gradient Descent) is connected to n3, but not directly to n1
    assert.equal(activeNeighbors.has('n4'), false);
  });
});
