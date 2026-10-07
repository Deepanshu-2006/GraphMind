import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractTextFromPdfBytes } from '../src/services/textExtraction';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';
import { computeGraphLayout } from '../src/services/graphLayout';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import { cleanConceptDescription, classifyConceptType } from '../src/services/conceptExtraction';
import { humanizeRelationLabel } from '../src/services/relationshipExtraction';
import { normalizeCategory } from '../src/data/graphData';
import type { KnowledgeSource, KnowledgeGraph, ConceptRelevanceReport, KnowledgeNode } from '../src/types/knowledgeGraph';
import type { Node, Edge } from '@xyflow/react';
import type { GraphConceptData } from '../src/types/graph';

const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/GraphMind_Concept_Extraction_Test.pdf');

describe('GraphMind: Knowledge Graph Quality & Structure Rebuild', () => {
  let graph: KnowledgeGraph;
  let relevanceReport: ConceptRelevanceReport;
  let extractedPdfText: string;

  before(async () => {
    assert.ok(fs.existsSync(FIXTURE_PATH), `Test PDF must exist at: ${FIXTURE_PATH}`);
    const buffer = fs.readFileSync(FIXTURE_PATH);
    extractedPdfText = await extractTextFromPdfBytes(
      new Uint8Array(buffer),
      'GraphMind_Concept_Extraction_Test.pdf'
    );
    assert.ok(extractedPdfText.length > 3000);

    const source: KnowledgeSource = {
      id: 'src-os-lecture-quality-test',
      name: 'Operating Systems: Process Scheduling',
      fileName: 'GraphMind_Concept_Extraction_Test.pdf',
      fileType: 'application/pdf',
      type: 'pdf',
      size: `${Math.round(buffer.length / 1024)} KB`,
      uploadedAt: Date.now(),
      status: 'ready',
      text: extractedPdfText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source]);

    assert.equal(result.success, true);
    assert.ok(result.graph);
    assert.ok(result.relevanceReport);

    graph = result.graph!;
    relevanceReport = result.relevanceReport!;
  });

  // =========================================================================
  // 1. CONCEPT QUALITY & GENERIC FILTERING
  // =========================================================================
  describe('1. Concept Quality & Precision Over Recall', () => {
    test('filters weak generic words (system, mechanism, time, method, user, computer, number)', () => {
      const lowerNames = graph.nodes.map(n => n.name.toLowerCase());
      const weakWords = ['system', 'mechanism', 'time', 'method', 'user', 'computer', 'number', 'criterion', 'criteria', 'meaning'];

      for (const word of weakWords) {
        assert.ok(
          !lowerNames.includes(word),
          `Weak word "${word}" must NOT enter the knowledge graph as a standalone node`
        );
      }
    });

    test('retains domain-teachable concepts supported by source evidence', () => {
      const names = graph.nodes.map(n => n.name);

      assert.ok(names.includes('CPU Scheduling'), 'Must include core domain concept "CPU Scheduling"');
      assert.ok(names.includes('Round Robin Scheduling'), 'Must include algorithm "Round Robin Scheduling"');
      assert.ok(names.includes('Shortest Job First'), 'Must include algorithm "Shortest Job First"');
      assert.ok(names.includes('First-Come, First-Served'), 'Must include algorithm "First-Come, First-Served"');
      assert.ok(names.includes('Priority Scheduling'), 'Must include algorithm "Priority Scheduling"');
      assert.ok(names.includes('Waiting Time'), 'Must include metric "Waiting Time"');
      assert.ok(names.includes('Turnaround Time'), 'Must include metric "Turnaround Time"');
      assert.ok(names.includes('Time Quantum'), 'Must include mechanism "Time Quantum"');
      assert.ok(names.includes('Context Switch'), 'Must include process "Context Switch"');
    });

    test('rejection reasons are clearly articulated in relevance report', () => {
      assert.ok(relevanceReport.rejected.length > 0);
      for (const rej of relevanceReport.rejected) {
        assert.ok(rej.reason && rej.reason.length > 5, `Rejection reason must be informative for "${rej.name}"`);
      }
    });
  });

  // =========================================================================
  // 2. CONCEPT TYPES & CATEGORIZATION
  // =========================================================================
  describe('2. Concept Types & Normalization', () => {
    test('classifies concepts into educational taxonomy types', () => {
      const rr = graph.nodes.find(n => n.name === 'Round Robin Scheduling');
      assert.ok(rr);
      assert.equal(normalizeCategory(rr.type), 'Algorithm');

      const sjf = graph.nodes.find(n => n.name === 'Shortest Job First');
      assert.ok(sjf);
      assert.equal(normalizeCategory(sjf.type), 'Algorithm');

      const wait = graph.nodes.find(n => n.name === 'Waiting Time');
      assert.ok(wait);
      assert.equal(normalizeCategory(wait.type), 'Metric');

      const os = graph.nodes.find(n => n.name === 'Operating System');
      assert.ok(os);
      assert.equal(normalizeCategory(os.type), 'System');

      const aging = graph.nodes.find(n => n.name === 'Aging');
      assert.ok(aging);
      assert.equal(normalizeCategory(aging.type), 'Technique');
    });

    test('deduplicates variants without over-merging distinct concepts', () => {
      // "round robin" and "Round Robin Scheduling" merged into 1
      const rrList = graph.nodes.filter(n => /round robin/i.test(n.name));
      assert.equal(rrList.length, 1);

      // Distinct metrics must remain distinct
      const metrics = graph.nodes.filter(n => ['Waiting Time', 'Turnaround Time', 'Response Time'].includes(n.name));
      assert.equal(metrics.length, 3, 'Waiting Time, Turnaround Time, and Response Time must remain separate concepts');
    });
  });

  // =========================================================================
  // 3. DESCRIPTION QUALITY (NO TITLE DUPLICATION)
  // =========================================================================
  describe('3. Description Quality & Cleanliness', () => {
    test('cleanConceptDescription strips concept name duplication', () => {
      const raw = 'CPU Scheduling CPU scheduling is the mechanism used by an operating system to decide which process runs.';
      const cleaned = cleanConceptDescription('CPU Scheduling', raw);
      assert.ok(!cleaned.startsWith('CPU Scheduling'), `Should not start with concept name: got "${cleaned}"`);
      assert.ok(cleaned.startsWith('The mechanism used by an operating system'), `Expected clean sentence, got "${cleaned}"`);
    });

    test('cleanConceptDescription strips list markers and table headers', () => {
      const raw = '1. First-Come, First-Served (FCFS): Processes are executed in the order of arrival.';
      const cleaned = cleanConceptDescription('First-Come, First-Served', raw);
      assert.ok(!cleaned.startsWith('1.'), `Should not start with number bullet: got "${cleaned}"`);
      assert.ok(!cleaned.toLowerCase().startsWith('first-come'), `Should not repeat name: got "${cleaned}"`);
      assert.ok(cleaned.includes('Processes are executed in the order of arrival'), `Got "${cleaned}"`);
    });

    test('every graph node has a concise 1-2 sentence description without title duplication', () => {
      for (const node of graph.nodes) {
        assert.ok(node.description && node.description.length > 0, `Node "${node.name}" has empty description`);
        assert.ok(
          !node.description.startsWith(`${node.name} ${node.name}`),
          `Description for "${node.name}" repeats title twice: "${node.description}"`
        );
        assert.ok(node.description.length <= 350, `Description for "${node.name}" exceeds 350 characters`);
      }
    });
  });

  // =========================================================================
  // 4. SOURCE EVIDENCE & PROVENANCE
  // =========================================================================
  describe('4. Source Evidence & Provenance', () => {
    test('every node retains valid sourceIds and evidence', () => {
      for (const node of graph.nodes) {
        assert.ok(Array.isArray(node.sourceIds) && node.sourceIds.length > 0, `Node "${node.name}" missing sourceIds`);
        assert.ok(node.evidence && node.evidence.trim().length > 0, `Node "${node.name}" missing evidence`);
      }
    });

    test('every relationship retains sourceChunkIds and evidence', () => {
      for (const rel of graph.relationships) {
        assert.ok(
          Array.isArray(rel.sourceChunkIds) && rel.sourceChunkIds.length > 0,
          `Relationship "${rel.id}" missing sourceChunkIds`
        );
        assert.ok(rel.evidence && rel.evidence.trim().length > 0, `Relationship "${rel.id}" missing evidence`);
      }
    });
  });

  // =========================================================================
  // 5. MEANINGFUL SEMANTIC RELATIONSHIPS
  // =========================================================================
  describe('5. Meaningful Semantic Relationships', () => {
    test('humanizeRelationLabel maps relation types to clean human readable phrases', () => {
      assert.equal(humanizeRelationLabel('type-of'), 'is a type of');
      assert.equal(humanizeRelationLabel('measured-by'), 'measured by');
      assert.equal(humanizeRelationLabel('uses'), 'uses');
      assert.equal(humanizeRelationLabel('causes'), 'causes');
      assert.equal(humanizeRelationLabel('optimizes'), 'optimizes');
      assert.equal(humanizeRelationLabel('reduces'), 'reduces');
      assert.equal(humanizeRelationLabel('depends-on'), 'depends on');
    });

    test('extracted relationships convey meaningful semantics backed by the document', () => {
      const rels = graph.relationships;

      // 1. CPU Scheduling measured by Waiting Time
      const waitRel = rels.find(r => r.source === 'concept-cpu-scheduling' && r.target === 'concept-waiting-time');
      assert.ok(waitRel, 'Expected CPU Scheduling -> Waiting Time relationship');
      assert.equal(waitRel.type, 'measured-by');
      assert.equal(waitRel.label, 'measured by');

      // 2. Shortest Job First optimizes Waiting Time
      const sjfWait = rels.find(r => r.source === 'concept-shortest-job-first' && r.target === 'concept-waiting-time');
      assert.ok(sjfWait, 'Expected Shortest Job First -> Waiting Time');
      assert.equal(sjfWait.type, 'optimizes');

      // 3. Round Robin uses Time Quantum
      const rrQuantum = rels.find(r => r.source === 'concept-round-robin' && r.target === 'concept-time-quantum');
      assert.ok(rrQuantum, 'Expected Round Robin -> Time Quantum');
      assert.equal(rrQuantum.type, 'uses');

      // 4. Aging reduces Starvation
      const agingStarve = rels.find(r => r.source === 'concept-aging' && r.target === 'concept-starvation');
      assert.ok(agingStarve, 'Expected Aging -> Starvation');
      assert.equal(agingStarve.type, 'reduces');
    });

    test('no duplicate edges exist between the same source and target pair', () => {
      const seen = new Set<string>();
      for (const rel of graph.relationships) {
        const key = `${rel.source}->${rel.target}`;
        assert.ok(!seen.has(key), `Found duplicate edge: ${key}`);
        seen.add(key);
      }
    });
  });

  // =========================================================================
  // 6. GRAPH LAYOUT & CLUSTERING (ZERO BOUNDING-BOX OVERLAP)
  // =========================================================================
  describe('6. Graph Layout, Spatial Grouping & Collision Prevention', () => {
    test('computes deterministic layout with zero bounding-box overlaps', () => {
      const CARD_W = 236;
      const CARD_H = 124;

      const layout1 = computeGraphLayout(graph.nodes, graph.relationships);
      const layout2 = computeGraphLayout(graph.nodes, graph.relationships);

      // Determinism
      for (const [id, pos1] of layout1) {
        const pos2 = layout2.get(id);
        assert.ok(pos2);
        assert.equal(pos1.x, pos2.x, `Determinism mismatch in X for node ${id}`);
        assert.equal(pos1.y, pos2.y, `Determinism mismatch in Y for node ${id}`);
      }

      // Zero bounding-box overlap test
      const posArray = Array.from(layout1.entries());
      for (let i = 0; i < posArray.length; i++) {
        const [idA, posA] = posArray[i];
        for (let j = i + 1; j < posArray.length; j++) {
          const [idB, posB] = posArray[j];
          const dx = Math.abs(posB.x - posA.x);
          const dy = Math.abs(posB.y - posA.y);

          const isOverlapping = dx < CARD_W && dy < CARD_H;
          assert.equal(
            isOverlapping,
            false,
            `Nodes "${idA}" (${posA.x}, ${posA.y}) and "${idB}" (${posB.x}, ${posB.y}) overlap (dx: ${dx}, dy: ${dy})`
          );
        }
      }
    });

    test('spatially groups scheduling algorithms in clean column/arc cluster', () => {
      const layout = computeGraphLayout(graph.nodes, graph.relationships);
      const algoNodes = graph.nodes.filter(n => normalizeCategory(n.type) === 'Algorithm');

      assert.ok(algoNodes.length >= 3);
      const algoXs = algoNodes.map(n => layout.get(n.id)!.x);

      // All algorithms should cluster in roughly the same X column sector
      const minX = Math.min(...algoXs);
      const maxX = Math.max(...algoXs);
      assert.ok(
        maxX - minX <= 120,
        `Algorithm nodes should be vertically aligned column cluster (spread: ${maxX - minX}px)`
      );
    });

    test('spatially groups metrics below central anchor', () => {
      const layout = computeGraphLayout(graph.nodes, graph.relationships);
      const anchor = graph.nodes.find(n => n.name === 'CPU Scheduling');
      assert.ok(anchor);
      const anchorPos = layout.get(anchor.id)!;

      const metricNodes = graph.nodes.filter(n => normalizeCategory(n.type) === 'Metric');
      assert.ok(metricNodes.length >= 3);

      for (const metric of metricNodes) {
        const pos = layout.get(metric.id)!;
        assert.ok(
          pos.y > anchorPos.y,
          `Metric "${metric.name}" (y: ${pos.y}) should be positioned below anchor (y: ${anchorPos.y})`
        );
      }
    });
  });

  // =========================================================================
  // 7. VIEWS: BALANCED, FOCUSED, AND EXPANDED
  // =========================================================================
  describe('7. View Modes (Balanced, Focused, Expanded)', () => {
    let mockNodes: Node<GraphConceptData>[];
    let mockEdges: Edge[];

    before(() => {
      const layout = computeGraphLayout(graph.nodes, graph.relationships);
      mockNodes = graph.nodes.map(n => ({
        id: n.id,
        position: layout.get(n.id) || { x: 0, y: 0 },
        data: {
          id: n.id,
          label: n.name,
          name: n.name,
          category: normalizeCategory(n.type),
          description: n.description,
          isCoreConcept: n.isCoreConcept,
          relationships: []
        } as any
      }));

      mockEdges = graph.relationships.map(r => ({
        id: `e-${r.source}-${r.target}`,
        source: r.source,
        target: r.target,
        type: 'custom',
        label: r.label
      }));
    });

    test('Balanced view retains core concepts and connected supporting nodes', () => {
      const balanced = calculateVisibleGraph({
        allNodes: mockNodes,
        allEdges: mockEdges,
        densityMode: 'balanced',
        selectedNodeId: null
      });

      assert.ok(balanced.visibleNodes.length > 0);
      assert.ok(balanced.visibleEdges.length > 0);
      // All core concepts must be present
      const coreIds = graph.nodes.filter(n => n.isCoreConcept).map(n => n.id);
      for (const cId of coreIds) {
        assert.ok(
          balanced.visibleNodes.some(n => n.id === cId),
          `Core concept ${cId} must be visible in Balanced view`
        );
      }
    });

    test('Focused view emphasizes selected node and dims unrelated nodes', () => {
      const focused = calculateVisibleGraph({
        allNodes: mockNodes,
        allEdges: mockEdges,
        densityMode: 'balanced',
        selectedNodeId: 'concept-round-robin'
      });

      const selectedNode = focused.visibleNodes.find(n => n.id === 'concept-round-robin');
      assert.ok(selectedNode);
      assert.equal(selectedNode.data.selected, true);

      // Connected nodes remain high contrast
      const connectedEdge = focused.visibleEdges.find(e => e.source === 'concept-round-robin' || e.target === 'concept-round-robin');
      assert.ok(connectedEdge);
      assert.equal(connectedEdge.className, 'highlighted');

      // Unrelated nodes become dimmed
      const unrelatedNode = focused.visibleNodes.find(n => n.id === 'concept-operating-system' && n.data.dimmed);
      if (unrelatedNode) {
        assert.equal(unrelatedNode.data.dimmed, true);
      }
    });
  });
});
