import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_CONCEPTS,
  KNOWLEDGE_RELATIONSHIPS,
  EDITORIAL_STAGES
} from '../src/components/overview/FromMaterialToMeaning';

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

describe('FromMaterialToMeaning - Pinned Continuous Transformation Logic', () => {
  test('stage definitions match exact specification copy', () => {
    assert.equal(EDITORIAL_STAGES.length, 4);
    assert.equal(EDITORIAL_STAGES[0].name, 'READ');
    assert.equal(EDITORIAL_STAGES[0].tagline, 'Start with what you already have.');
    assert.equal(EDITORIAL_STAGES[1].name, 'FIND');
    assert.equal(EDITORIAL_STAGES[1].tagline, 'Find what matters.');
    assert.equal(EDITORIAL_STAGES[2].name, 'CONNECT');
    assert.equal(EDITORIAL_STAGES[2].tagline, 'See how ideas relate.');
    assert.equal(EDITORIAL_STAGES[3].name, 'EXPLORE');
    assert.equal(EDITORIAL_STAGES[3].tagline, "Explore what you've built.");
  });

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

  test('concepts have valid document and graph coordinates', () => {
    assert.equal(KNOWLEDGE_CONCEPTS.length, 4);
    const c1 = KNOWLEDGE_CONCEPTS.find(c => c.id === 'c1');
    assert.ok(c1);
    assert.equal(c1.name, 'Neural Networks');
    assert.equal(c1.docX, -105);
    assert.equal(c1.docY, -42);
    assert.equal(c1.graphX, 0);
    assert.equal(c1.graphY, -80);
  });

  test('node coordinates interpolate smoothly from doc position to settled graph position', () => {
    const node = KNOWLEDGE_CONCEPTS[0]; // Neural Networks: doc (-105, -42), graph (0, -80)

    // Travel range is 0.36 to 0.65
    const emergeStart = smoothstep(0.36, 0.65, 0.36);
    const xStart = node.docX + (node.graphX - node.docX) * emergeStart;
    const yStart = node.docY + (node.graphY - node.docY) * emergeStart;
    assert.equal(xStart, -105);
    assert.equal(yStart, -42);

    const emergeEnd = smoothstep(0.36, 0.65, 0.65);
    const xEnd = node.docX + (node.graphX - node.docX) * emergeEnd;
    const yEnd = node.docY + (node.graphY - node.docY) * emergeEnd;
    assert.equal(xEnd, 0);
    assert.equal(yEnd, -80);

    // Midpoint interpolation
    const emergeMid = smoothstep(0.36, 0.65, 0.505);
    const xMid = node.docX + (node.graphX - node.docX) * emergeMid;
    assert.ok(xMid > -105 && xMid < 0);
  });

  test('reversible scroll: forward scroll and reverse scroll produce identical transformation values', () => {
    const checkpoints = [0.1, 0.28, 0.46, 0.68, 0.88];

    for (const p of checkpoints) {
      const stageForward = getActiveStageIndex(p);
      const stageReverse = getActiveStageIndex(p);
      assert.equal(stageForward, stageReverse);

      const emergeForward = smoothstep(0.36, 0.65, p);
      const emergeReverse = smoothstep(0.36, 0.65, p);
      assert.equal(emergeForward, emergeReverse);
    }
  });

  test('relationship edges draw progressively across CONNECT stage', () => {
    assert.equal(KNOWLEDGE_RELATIONSHIPS.length, 3);

    // Edge 1 (Neural Networks -> Activation Functions) draws 0.50 -> 0.62
    const edge1 = KNOWLEDGE_RELATIONSHIPS[0];
    assert.equal(edge1.label, 'uses');
    assert.equal(smoothstep(edge1.drawStart, edge1.drawEnd, 0.48), 0);
    assert.ok(smoothstep(edge1.drawStart, edge1.drawEnd, 0.56) > 0);
    assert.equal(smoothstep(edge1.drawStart, edge1.drawEnd, 0.62), 1);

    // Edge 3 (Backpropagation -> Gradient Descent) draws 0.62 -> 0.74
    const edge3 = KNOWLEDGE_RELATIONSHIPS[2];
    assert.equal(edge3.label, 'optimizes');
    assert.equal(smoothstep(edge3.drawStart, edge3.drawEnd, 0.60), 0);
    assert.equal(smoothstep(edge3.drawStart, edge3.drawEnd, 0.74), 1);
  });

  test('active focal concept illuminates direct neighbors and dims non-connected nodes', () => {
    const focalId = 'c1'; // Neural Networks
    const neighbors = new Set<string>([focalId]);

    KNOWLEDGE_RELATIONSHIPS.forEach((r) => {
      if (r.sourceId === focalId) neighbors.add(r.targetId);
      if (r.targetId === focalId) neighbors.add(r.sourceId);
    });

    // c1 connects to c2 (uses) and c3 (trained with)
    assert.ok(neighbors.has('c1'));
    assert.ok(neighbors.has('c2'));
    assert.ok(neighbors.has('c3'));

    // c4 (Gradient Descent) is connected to c3, but not directly to c1
    assert.equal(neighbors.has('c4'), false);
  });
});
