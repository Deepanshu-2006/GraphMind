import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator.js';
import { buildKnowledgeGraph } from '../src/services/graphBuilder.js';
import { KnowledgeSource } from '../src/types/knowledgeGraph.js';

describe('Strict Evidence-Based Concept Extraction Pipeline (Specification Cases)', () => {

  // -------------------------------------------------------------------------
  // TEST CASE 1 (SECTION 39): Operating Systems Context
  // -------------------------------------------------------------------------
  it('SECTION 39: OS Text extracts domain concepts and rejects generic words', async () => {
    const osText = `Operating System is system software that manages computer hardware and software resources.

A process is a program in execution.

The process scheduler determines which process runs next.`;

    const source: KnowledgeSource = {
      id: 'os-doc-1',
      name: 'Operating Systems Overview',
      fileName: 'os_intro.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: osText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-os',
      text: osText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true, `Pipeline execution failed: ${result.error?.message}`);
    assert.ok(result.graph, 'Result must contain graph');
    const graph = result.graph!;
    const nodeNames = graph.nodes.map(n => n.name.toLowerCase());

    // 1. MUST extract genuine concepts: Operating System, Process, Process Scheduler
    assert.ok(
      nodeNames.some(n => n.includes('operating system')),
      `Expected "Operating System" in nodes, found: ${nodeNames.join(', ')}`
    );
    assert.ok(
      nodeNames.some(n => n === 'process' || n.includes('process')),
      `Expected "Process" in nodes, found: ${nodeNames.join(', ')}`
    );
    assert.ok(
      nodeNames.some(n => n.includes('process scheduler') || n.includes('scheduler') || n.includes('scheduling')),
      `Expected "Process Scheduler" in nodes, found: ${nodeNames.join(', ')}`
    );

    // 2. MUST NOT extract generic words: system, software, resources, program, execution, next
    const rejectedWords = ['system', 'software', 'resources', 'program', 'execution', 'next'];
    for (const word of rejectedWords) {
      assert.ok(
        !nodeNames.includes(word),
        `Generic word "${word}" must NOT become a standalone concept node!`
      );
    }

    // 3. Every node must have evidence
    for (const node of graph.nodes) {
      assert.ok(node.evidence && node.evidence.trim().length > 0, `Node ${node.name} must have evidence`);
      assert.ok(node.sourceIds.includes('os-doc-1'), `Node ${node.name} must reference sourceId os-doc-1`);
      assert.ok(node.importance === 'core' || node.importance === 'supporting', `Node ${node.name} must have core/supporting importance`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST CASE 2 (SECTION 40): DBMS ACID Properties & Relationships
  // -------------------------------------------------------------------------
  it('SECTION 40: DBMS ACID Text extracts ACID Properties, constituents, and evidence-grounded relationships', async () => {
    const dbmsText = `ACID properties ensure reliable transaction processing.

Atomicity ensures that a transaction is treated as a single unit.
Consistency preserves database constraints.
Isolation controls the visibility of concurrent transactions.
Durability ensures committed changes survive failures.`;

    const source: KnowledgeSource = {
      id: 'dbms-doc-1',
      name: 'DBMS ACID Properties',
      fileName: 'acid_notes.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: dbmsText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-dbms',
      text: dbmsText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true, `Pipeline execution failed: ${result.error?.message}`);
    assert.ok(result.graph, 'Result must contain graph');
    const graph = result.graph!;
    const nodeNames = graph.nodes.map(n => n.name.toLowerCase());

    // Expected concepts: ACID Properties, Atomicity, Consistency, Isolation, Durability, Transaction
    assert.ok(nodeNames.some(n => n.includes('acid')), 'ACID Properties should be present');
    assert.ok(nodeNames.some(n => n.includes('atomicity')), 'Atomicity should be present');
    assert.ok(nodeNames.some(n => n.includes('consistency')), 'Consistency should be present');
    assert.ok(nodeNames.some(n => n.includes('isolation')), 'Isolation should be present');
    assert.ok(nodeNames.some(n => n.includes('durability')), 'Durability should be present');
    assert.ok(nodeNames.some(n => n.includes('transaction')), 'Transaction should be present');

    // Relationships: ACID Properties with its constituent properties or Transaction
    assert.ok(graph.relationships.length > 0, 'Should extract relationships between ACID and constituents');
    for (const rel of graph.relationships) {
      assert.ok(rel.evidence && rel.evidence.trim().length > 0, `Relationship ${rel.source} -> ${rel.target} must have evidence`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST CASE 3 (SECTION 41): Random Word Protection & Honest Abstention
  // -------------------------------------------------------------------------
  it('SECTION 41: Random Word Protection rejects all generic academic words when domain evidence is absent', async () => {
    const genericText = `Chapter 4

The following example demonstrates the algorithm.

The student can observe the result in the table below.

This method provides a better approach to solving the problem.`;

    const source: KnowledgeSource = {
      id: 'generic-doc-1',
      name: 'Generic Academic Text',
      fileName: 'generic.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: genericText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-generic',
      text: genericText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true);
    assert.ok(result.graph);
    const graph = result.graph!;
    const nodeNames = graph.nodes.map(n => n.name.toLowerCase());

    const badWords = [
      'chapter', 'chapter 4', 'example', 'algorithm', 'student',
      'result', 'table', 'method', 'approach', 'problem'
    ];

    for (const bad of badWords) {
      assert.ok(
        !nodeNames.includes(bad),
        `Generic word "${bad}" without domain-specific evidence MUST be rejected! Current nodes: ${nodeNames.join(', ')}`
      );
    }

    // The system should honestly produce 0 concepts rather than hallucinating
    assert.equal(
      graph.nodes.length,
      0,
      `Should produce 0 concepts for purely generic text, got: ${nodeNames.join(', ')}`
    );
  });

  // -------------------------------------------------------------------------
  // TEST CASE 4: Mandatory Evidence Requirement
  // -------------------------------------------------------------------------
  it('SECTION 24 & 25: Concepts without source evidence are rejected by graph builder', () => {
    const ungroundedConcept = {
      id: 'ghost-concept',
      name: 'Hallucinated Idea',
      type: 'concept' as const,
      description: '',
      sourceIds: [],
      sourceChunkIds: [],
      confidence: 0.99,
      // No evidence, no chunks, no sources
    };

    const graph = buildKnowledgeGraph([ungroundedConcept], [], []);
    assert.equal(graph.nodes.length, 0, 'Ungrounded concept without evidence must be rejected');
  });

  // -------------------------------------------------------------------------
  // TEST CASE 5: Multi-source provenance preservation
  // -------------------------------------------------------------------------
  it('SECTION 20: Merges concepts across multiple sources while preserving all source provenance', () => {
    const conceptFromSourceA = {
      id: 'atomicity',
      name: 'Atomicity',
      type: 'property' as const,
      description: 'Transaction treated as single unit',
      sourceIds: ['source-a'],
      sourceChunkIds: ['chunk-1'],
      evidence: 'Atomicity ensures single unit',
      confidence: 0.95,
      importance: 'core' as const
    };

    const conceptFromSourceB = {
      id: 'atomicity',
      name: 'Atomicity',
      type: 'property' as const,
      description: 'Transaction treated as single unit',
      sourceIds: ['source-b'],
      sourceChunkIds: ['chunk-99'],
      evidence: 'Atomicity guarantees all-or-nothing execution',
      confidence: 0.98,
      importance: 'core' as const
    };

    const graph = buildKnowledgeGraph([conceptFromSourceA, conceptFromSourceB], [], []);
    assert.equal(graph.nodes.length, 1, 'Duplicate concept across sources must resolve to 1 canonical node');
    const atomicityNode = graph.nodes[0];
    assert.ok(atomicityNode.sourceIds.includes('source-a'));
    assert.ok(atomicityNode.sourceIds.includes('source-b'));
    assert.ok(atomicityNode.sourceChunkIds?.includes('chunk-1'));
    assert.ok(atomicityNode.sourceChunkIds?.includes('chunk-99'));
    assert.equal(atomicityNode.importance, 'core');
  });

  // -------------------------------------------------------------------------
  // TEST CASE 6 (SECTION 1 & 14): Frequency alone must never create a concept
  // -------------------------------------------------------------------------
  it('SECTION 1 & 14: Repeated generic words (e.g. system, data appearing 7x) must not become concepts', async () => {
    const repetitiveText = `The system is currently running.
The system updates data continuously.
The system monitors data integrity.
The data is stored reliably by the system.
The system processes data upon request.
Authorized users access the system directly.
The data is available throughout the system.`;

    const source: KnowledgeSource = {
      id: 'repetitive-doc-1',
      name: 'Repetitive Generic Words',
      fileName: 'system_data.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: repetitiveText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-freq',
      text: repetitiveText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true);
    const nodeNames = (result.graph?.nodes || []).map(n => n.name.toLowerCase());
    assert.ok(!nodeNames.includes('system'), 'Repeated word "system" must NOT become a concept!');
    assert.ok(!nodeNames.includes('data'), 'Repeated word "data" must NOT become a concept!');
    assert.ok(!nodeNames.includes('user'), 'Repeated word "user" must NOT become a concept!');
  });

  // -------------------------------------------------------------------------
  // TEST CASE 7: Single defined domain concept MUST survive
  // -------------------------------------------------------------------------
  it('SECTION 14 & 43: A genuinely defined domain concept MUST survive extraction even if it appears only once', async () => {
    const singleMentionText = `The Translation Lookaside Buffer is a hardware cache that accelerates virtual memory address translation.`;

    const source: KnowledgeSource = {
      id: 'single-def-doc',
      name: 'TLB Overview',
      fileName: 'tlb.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: singleMentionText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-single-def',
      text: singleMentionText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true);
    assert.ok(result.graph);
    const nodeNames = result.graph.nodes.map(n => n.name.toLowerCase());
    assert.ok(
      nodeNames.some(n => n.includes('translation lookaside buffer')),
      `Expected "Translation Lookaside Buffer" to survive single-mention extraction, got: ${nodeNames.join(', ')}`
    );
  });

  // -------------------------------------------------------------------------
  // TEST CASE 8 (SECTION 3): Hallucination Protection
  // -------------------------------------------------------------------------
  it('SECTION 3: Pipeline does not hallucinate unmentioned external concepts', async () => {
    const cnnText = `Convolutional Neural Networks apply convolutional filters to process spatial grid data.
Convolutional layers extract local image features using learned kernels.`;

    const source: KnowledgeSource = {
      id: 'cnn-doc',
      name: 'CNN Intro',
      fileName: 'cnn.txt',
      fileType: 'text/plain',
      mimeType: 'text/plain',
      size: cnnText.length,
      createdAt: new Date().toISOString(),
      status: 'ready',
      graphId: 'test-graph-cnn',
      text: cnnText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source], {
      minConfidence: 0.65,
      filterNoiseNodes: false
    });

    assert.equal(result.success, true);
    const nodeNames = (result.graph?.nodes || []).map(n => n.name.toLowerCase());

    // Should NOT contain unmentioned entities from general AI knowledge
    const hallucinatedCandidates = ['resnet', 'alexnet', 'imagenet', 'transformer', 'transformers', 'backpropagation'];
    for (const h of hallucinatedCandidates) {
      assert.ok(!nodeNames.includes(h), `Hallucinated concept "${h}" must NOT appear in graph!`);
    }
  });

});

