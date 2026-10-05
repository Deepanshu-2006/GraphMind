import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractTextFromPdfBytes } from '../src/services/textExtraction';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';
import type { KnowledgeSource, KnowledgeGraph, ConceptRelevanceReport } from '../src/types/knowledgeGraph';

const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/GraphMind_Concept_Extraction_Test.pdf');

describe('Operating Systems CPU Scheduling - Knowledge Graph Extraction Pipeline', () => {
  let graph: KnowledgeGraph;
  let relevanceReport: ConceptRelevanceReport;
  let extractedPdfText: string;

  before(async () => {
    assert.ok(fs.existsSync(FIXTURE_PATH), `Test PDF fixture must exist at: ${FIXTURE_PATH}`);
    const buffer = fs.readFileSync(FIXTURE_PATH);
    extractedPdfText = await extractTextFromPdfBytes(
      new Uint8Array(buffer),
      'GraphMind_Concept_Extraction_Test.pdf'
    );
    assert.ok(extractedPdfText.length > 3000, 'Extracted text should exceed 3000 chars');

    const source: KnowledgeSource = {
      id: 'src-cpu-scheduling-test',
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

    assert.equal(result.success, true, `Pipeline execution failed: ${result.error?.message}`);
    assert.ok(result.graph, 'Knowledge graph must be produced');
    assert.ok(result.relevanceReport, 'Relevance report must be produced');

    graph = result.graph!;
    relevanceReport = result.relevanceReport!;
  });

  test('1. Removes "round robin" duplicate and normalizes to canonical "Round Robin Scheduling"', () => {
    const nodeNames = graph.nodes.map(n => n.name);
    const lowerNames = nodeNames.map(n => n.toLowerCase());

    // Count concepts referring to Round Robin
    const rrNodes = graph.nodes.filter(n => n.name.toLowerCase().includes('round robin'));
    assert.equal(
      rrNodes.length,
      1,
      `Expected exactly ONE node for Round Robin, but found ${rrNodes.length}: ${rrNodes.map(n => n.name).join(', ')}`
    );

    const rrNode = rrNodes[0];
    assert.equal(
      rrNode.name,
      'Round Robin Scheduling',
      `Expected canonical name "Round Robin Scheduling", got "${rrNode.name}"`
    );

    // Verify lowercase "round robin" is tracked as alias or merged
    assert.ok(
      rrNode.aliases?.some(a => a.toLowerCase() === 'round robin') ||
      rrNode.aliases?.some(a => a.toLowerCase().includes('round robin')),
      'Original variant "round robin" should be retained in aliases'
    );

    // Ensure raw "round robin" does NOT exist as a separate node
    assert.ok(!lowerNames.includes('round robin'), '"round robin" must not exist as an independent bare node');
  });

  test('2. Rejects standalone bare "cpu" while preserving "CPU Scheduling" and "CPU Utilization"', () => {
    const nodeNames = graph.nodes.map(n => n.name);
    const lowerNames = nodeNames.map(n => n.toLowerCase());

    // Bare "cpu" must NOT be a node
    assert.ok(
      !lowerNames.includes('cpu'),
      'Standalone ungrounded "cpu" must be rejected from the graph'
    );

    // Qualified concepts containing CPU MUST be preserved
    assert.ok(
      nodeNames.some(n => n === 'CPU Scheduling'),
      'CPU Scheduling must be preserved as a canonical concept'
    );
    assert.ok(
      nodeNames.some(n => n === 'CPU Utilization'),
      'CPU Utilization must be preserved as a scheduling criterion'
    );
  });

  test('3. Rejects formatting artifacts like "Throughput Number" and table fragments', () => {
    const lowerNames = graph.nodes.map(n => n.name.toLowerCase());

    // Must NOT contain compound artifacts ending with generic nouns
    assert.ok(!lowerNames.includes('throughput number'), '"Throughput Number" artifact must be rejected');
    assert.ok(!lowerNames.includes('process number'), '"Process Number" artifact must be rejected');
    assert.ok(!lowerNames.includes('criterion meaning'), '"Criterion Meaning" table header must be rejected');
    assert.ok(!lowerNames.includes('for round robin'), '"For Round Robin" prepositional phrase must be rejected');
    assert.ok(!lowerNames.includes('p1'), 'Variable label "P1" must be rejected');
    assert.ok(!lowerNames.includes('p2'), 'Variable label "P2" must be rejected');

    // Genuine concept "Throughput" MUST be preserved
    assert.ok(
      graph.nodes.some(n => n.name === 'Throughput'),
      'Genuine concept "Throughput" must be extracted and preserved'
    );
  });

  test('4. Rejects generic academic words and non-concepts', () => {
    const lowerNames = graph.nodes.map(n => n.name.toLowerCase());
    const genericNoiseWords = [
      'example', 'problem', 'student', 'method', 'system',
      'time', 'number', 'table', 'chapter', 'section', 'computer',
      'important', 'use', 'state', 'process number'
    ];

    for (const word of genericNoiseWords) {
      assert.ok(
        !lowerNames.includes(word),
        `Generic word "${word}" should NOT be accepted into the knowledge graph`
      );
    }
  });

  test('5. Extracts essential domain concepts from the CPU scheduling lecture', () => {
    const nodeNames = graph.nodes.map(n => n.name);

    const requiredConcepts = [
      'Operating System',
      'Process',
      'CPU Scheduling',
      'First-Come, First-Served',
      'Shortest Job First',
      'Shortest Remaining Time First',
      'Priority Scheduling',
      'Round Robin Scheduling',
      'Time Quantum',
      'Waiting Time',
      'Turnaround Time',
      'Response Time',
      'Throughput',
      'CPU Utilization',
      'Starvation',
      'Aging',
      'Context Switch'
    ];

    for (const req of requiredConcepts) {
      assert.ok(
        nodeNames.includes(req),
        `Required domain concept "${req}" was missing from extracted graph. Extracted nodes: ${nodeNames.join(', ')}`
      );
    }
  });

  test('6. Strictly prevents over-merging of distinct concepts (Section 8)', () => {
    const nodeNames = graph.nodes.map(n => n.name);

    // CPU vs CPU Scheduling
    assert.ok(nodeNames.includes('CPU Scheduling'), 'CPU Scheduling exists');

    // Process vs CPU Scheduling
    assert.ok(nodeNames.includes('Process'), 'Process exists');
    assert.notEqual(
      graph.nodes.find(n => n.name === 'Process')?.id,
      graph.nodes.find(n => n.name === 'CPU Scheduling')?.id,
      'Process and CPU Scheduling must have distinct IDs'
    );

    // Waiting Time vs Turnaround Time
    assert.ok(nodeNames.includes('Waiting Time'), 'Waiting Time exists');
    assert.ok(nodeNames.includes('Turnaround Time'), 'Turnaround Time exists');
    assert.notEqual(
      graph.nodes.find(n => n.name === 'Waiting Time')?.id,
      graph.nodes.find(n => n.name === 'Turnaround Time')?.id,
      'Waiting Time and Turnaround Time must have distinct IDs'
    );

    // Starvation vs Aging
    assert.ok(nodeNames.includes('Starvation'), 'Starvation exists');
    assert.ok(nodeNames.includes('Aging'), 'Aging exists');
    assert.notEqual(
      graph.nodes.find(n => n.name === 'Starvation')?.id,
      graph.nodes.find(n => n.name === 'Aging')?.id,
      'Starvation and Aging must NOT be merged'
    );

    // Scheduling algorithms must remain distinct
    const algorithms = [
      'First-Come, First-Served',
      'Shortest Job First',
      'Shortest Remaining Time First',
      'Priority Scheduling',
      'Round Robin Scheduling'
    ];
    for (let i = 0; i < algorithms.length; i++) {
      for (let j = i + 1; j < algorithms.length; j++) {
        const idA = graph.nodes.find(n => n.name === algorithms[i])?.id;
        const idB = graph.nodes.find(n => n.name === algorithms[j])?.id;
        assert.notEqual(idA, idB, `${algorithms[i]} and ${algorithms[j]} must NOT be merged`);
      }
    }
  });

  test('7. Preserves source provenance on every node and relationship', () => {
    // Check nodes provenance
    for (const node of graph.nodes) {
      assert.ok(
        node.sourceIds && node.sourceIds.length > 0,
        `Node "${node.name}" must have non-empty sourceIds`
      );
      assert.ok(
        node.sourceChunkIds && node.sourceChunkIds.length > 0,
        `Node "${node.name}" must have non-empty sourceChunkIds`
      );
      assert.ok(
        node.evidence && node.evidence.trim().length > 0,
        `Node "${node.name}" must have grounded evidence text`
      );
    }

    // Check relationships provenance
    assert.ok(graph.relationships.length > 0, 'Graph must contain relationships');
    for (const rel of graph.relationships) {
      assert.ok(
        rel.sourceChunkIds && rel.sourceChunkIds.length > 0,
        `Relationship "${rel.source} -> ${rel.target}" must have sourceChunkIds`
      );
      assert.ok(
        rel.evidence && rel.evidence.trim().length > 0,
        `Relationship "${rel.source} -> ${rel.target}" must have evidence`
      );
      assert.ok(
        typeof rel.confidence === 'number' && rel.confidence >= 0.5,
        `Relationship "${rel.source} -> ${rel.target}" must have confidence >= 0.5`
      );
    }
  });

  test('8. Extracts meaningful, source-grounded semantic relationships', () => {
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n.name]));

    const relDescriptions = graph.relationships.map(r => ({
      source: nodeMap.get(r.source) || r.source,
      type: r.type,
      target: nodeMap.get(r.target) || r.target
    }));

    // Check for specific semantic relationship types (avoiding generic "related to")
    const relTypes = new Set(graph.relationships.map(r => r.type));
    assert.ok(!relTypes.has('related to'), 'Generic "related to" relationship should not be used when specific semantics apply');

    // 1. Aging reduces Starvation
    const agingReducesStarvation = relDescriptions.some(
      r => r.source === 'Aging' && r.target === 'Starvation' && r.type === 'reduces'
    );
    assert.ok(agingReducesStarvation, 'Expected: Aging --[reduces]--> Starvation');

    // 2. SJF optimizes Waiting Time
    const sjfOptimizesWait = relDescriptions.some(
      r => r.source === 'Shortest Job First' && r.target === 'Waiting Time' && r.type === 'optimizes'
    );
    assert.ok(sjfOptimizesWait, 'Expected: Shortest Job First --[optimizes]--> Waiting Time');

    // 3. Time Quantum causes Context Switch
    const quantumCausesSwitch = relDescriptions.some(
      r => r.source === 'Time Quantum' && r.target === 'Context Switch' && r.type === 'causes'
    );
    assert.ok(quantumCausesSwitch, 'Expected: Time Quantum --[causes]--> Context Switch');

    // 4. Shortest Remaining Time First type-of/extends Shortest Job First
    const srtfExtendsSjf = relDescriptions.some(
      r => r.source === 'Shortest Remaining Time First' && r.target === 'Shortest Job First' && (r.type === 'type-of' || r.type === 'extends')
    );
    assert.ok(srtfExtendsSjf, 'Expected: Shortest Remaining Time First --[type-of|extends]--> Shortest Job First');

    // 5. CPU Scheduling measured-by criteria
    const schedulingMeasuredBy = relDescriptions.filter(
      r => r.source === 'CPU Scheduling' && r.type === 'measured-by'
    );
    assert.ok(
      schedulingMeasuredBy.length >= 3,
      `Expected CPU Scheduling to have measured-by relationships to criteria, found ${schedulingMeasuredBy.length}`
    );

    // 6. Round Robin Scheduling uses Time Quantum
    const rrUsesQuantum = relDescriptions.some(
      r => r.source === 'Round Robin Scheduling' && r.target === 'Time Quantum' && r.type === 'uses'
    );
    assert.ok(rrUsesQuantum, 'Expected: Round Robin Scheduling --[uses]--> Time Quantum');

    // 7. Operating System uses CPU Scheduling
    const osUsesScheduling = relDescriptions.some(
      r => r.source === 'Operating System' && r.target === 'CPU Scheduling' && r.type === 'uses'
    );
    assert.ok(osUsesScheduling, 'Expected: Operating System --[uses]--> CPU Scheduling');
  });

  test('9. Classifies concepts into Core and Supporting categories', () => {
    const coreConcepts = graph.nodes.filter(n => n.isCoreConcept === true);
    const supportingConcepts = graph.nodes.filter(n => n.isCoreConcept === false);

    assert.ok(coreConcepts.length > 0, 'Must have CORE concepts identified');
    assert.ok(supportingConcepts.length > 0, 'Must have SUPPORTING concepts identified');

    const coreNames = coreConcepts.map(n => n.name);
    // Major topics should be core
    assert.ok(coreNames.includes('CPU Scheduling'), 'CPU Scheduling should be a CORE concept');
    assert.ok(coreNames.includes('Process'), 'Process should be a CORE concept');
    assert.ok(coreNames.includes('Operating System'), 'Operating System should be a CORE concept');
  });

  test('10. Descriptions are concise and grounded in source text', () => {
    for (const node of graph.nodes) {
      assert.ok(node.description && node.description.trim().length > 0, `Node "${node.name}" must have a description`);
      // Ensure description is not absurdly long (1-2 sentences target)
      assert.ok(
        node.description.length <= 400,
        `Description for "${node.name}" should be concise (<= 400 chars, got ${node.description.length})`
      );
    }
  });

  test('11. Relevance report tracks rejected candidates with clear reasons', () => {
    assert.ok(relevanceReport.rejectedCount > 0, 'Relevance report must track rejected candidates');
    assert.ok(relevanceReport.rejected.length > 0, 'Relevance report must contain rejected candidate items');

    const rejectedNames = relevanceReport.rejected.map(r => r.name.toLowerCase());

    // Verify rejected list includes expected noise
    assert.ok(
      rejectedNames.some(n => n.includes('system') || n.includes('example') || n.includes('cpu') || n.includes('number')),
      'Rejected items should include generic or ungrounded words'
    );

    // Each rejected item must have a specific reason
    for (const rejected of relevanceReport.rejected) {
      assert.ok(
        rejected.reason && rejected.reason.trim().length > 0,
        `Rejected candidate "${rejected.name}" must have a reason`
      );
    }
  });
});
