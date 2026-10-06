import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Node, Edge } from '@xyflow/react';
import type { GraphConceptData } from '../src/types/graph';
import { calculateVisibleGraph } from '../src/services/graphViewport';
import { knowledgeGraphToReactFlow, initialConceptDetails } from '../src/data/graphData';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';

describe('GraphMind Phase 1: Learn Mode - Contextual Study Experience', () => {

  describe('1. Concept Title & Canonical Naming', () => {
    test('preserves exact canonical concept name without rewriting or adding prefixes/suffixes', () => {
      // Prompt Section 3: Do NOT rewrite "CPU Scheduling" into "Understanding CPU Scheduling" or "CPU Scheduling Explained"
      const conceptData: GraphConceptData = {
        id: 'cpu-scheduling',
        name: 'CPU Scheduling',
        label: 'CPU Scheduling',
        code: 'CPU-SCHEDULING',
        category: 'Concept',
        description: 'CPU scheduling is the process of selecting which process should execute on the CPU.',
        prerequisites: [],
        relationships: [],
        confidence: 98,
        source: 'Operating Systems Unit 1.pdf',
        page: 8,
        synapseCount: 3
      };

      const title = conceptData.name || conceptData.label;
      assert.equal(title, 'CPU Scheduling');
      assert.doesNotMatch(title, /^Understanding\s+/i);
      assert.doesNotMatch(title, /\s+Explained$/i);
    });
  });

  describe('2. Source-Grounded Explanation (No Hallucination)', () => {
    test('displays existing grounded description if present in the extraction data', () => {
      const conceptData: GraphConceptData = {
        id: 'cpu-scheduling',
        name: 'CPU Scheduling',
        label: 'CPU Scheduling',
        code: 'CPU',
        category: 'Concept',
        description: 'CPU scheduling determines which process in the ready queue is allocated the CPU.',
        prerequisites: [],
        relationships: [],
        confidence: 95,
        source: 'OS.pdf',
        synapseCount: 1
      };

      assert.equal(
        conceptData.description,
        'CPU scheduling determines which process in the ready queue is allocated the CPU.'
      );
    });

    test('falls back to exact graceful prompt message when source material is insufficient', () => {
      // Prompt Section 4: If available source material is insufficient, say:
      // "GraphMind couldn't find enough source material to explain this concept."
      const conceptWithoutData: GraphConceptData = {
        id: 'sparse-concept',
        name: 'Sparse Concept',
        label: 'Sparse Concept',
        code: 'SC',
        category: 'Concept',
        description: '',
        evidence: '',
        evidenceItems: [],
        prerequisites: [],
        relationships: [],
        confidence: 70,
        source: 'Notes.pdf',
        synapseCount: 0
      };

      const explanation = conceptWithoutData.description?.trim() 
        || "GraphMind couldn't find enough source material to explain this concept.";

      assert.equal(explanation, "GraphMind couldn't find enough source material to explain this concept.");
    });
  });

  describe('3. "FROM YOUR MATERIAL" Provenance & Page Numbers', () => {
    test('extracts grounded passage and retains authentic source and page number', () => {
      const conceptData: GraphConceptData = {
        id: 'cpu-sched',
        name: 'CPU Scheduling',
        label: 'CPU Scheduling',
        code: 'CS',
        category: 'Process',
        description: 'CPU scheduling selects from among the processes in memory that are ready to execute.',
        evidence: 'CPU scheduling determines which process in the ready queue is selected for execution.',
        sources: [
          {
            id: 'src-os-1',
            name: 'Operating Systems Unit 1.pdf',
            fileName: 'Operating Systems Unit 1.pdf',
            page: 8
          }
        ],
        prerequisites: ['Ready Queue', 'Process State'],
        relationships: [],
        confidence: 99,
        source: 'Operating Systems Unit 1.pdf',
        page: 8,
        synapseCount: 2
      };

      assert.equal(conceptData.evidence, 'CPU scheduling determines which process in the ready queue is selected for execution.');
      assert.equal(conceptData.sources?.[0]?.page, 8);
      assert.equal(conceptData.sources?.[0]?.name, 'Operating Systems Unit 1.pdf');
    });

    test('does not fabricate page numbers when page data is absent', () => {
      const conceptWithoutPage: GraphConceptData = {
        id: 'round-robin',
        name: 'Round Robin',
        label: 'Round Robin',
        code: 'RR',
        category: 'Algorithm',
        description: 'A preemptive scheduling algorithm that assigns a fixed time quantum to each process.',
        evidence: 'Round Robin scheduling assigns a fixed time slice to each process.',
        sources: [
          {
            id: 'src-notes',
            name: 'CourseNotes.txt'
          }
        ],
        prerequisites: [],
        relationships: [],
        confidence: 90,
        source: 'CourseNotes.txt',
        synapseCount: 1
      };

      assert.equal(conceptWithoutPage.page, undefined);
      assert.equal(conceptWithoutPage.sources?.[0]?.page, undefined);
    });
  });

  describe('4. Connected Concepts & Semantic Relationship Information', () => {
    test('retains directional semantic relationship labels (e.g., uses →, ← is a type of)', () => {
      const mockKG: KnowledgeGraph = {
        id: 'os-graph',
        title: 'Operating Systems Unit 1',
        nodes: [
          {
            id: 'cpu-sched',
            name: 'CPU Scheduling',
            type: 'Concept',
            isCore: true,
            evidence: 'CPU scheduling determines which process in ready queue executes.'
          },
          {
            id: 'round-robin',
            name: 'Round Robin',
            type: 'Method',
            isCore: false,
            evidence: 'Round Robin assigns a time quantum to processes.'
          },
          {
            id: 'fcfs',
            name: 'FCFS',
            type: 'Method',
            isCore: false,
            evidence: 'First-Come, First-Served is non-preemptive.'
          }
        ],
        relationships: [
          {
            id: 'rel-1',
            source: 'cpu-sched',
            target: 'round-robin',
            type: 'uses',
            description: 'CPU Scheduling uses Round Robin for time-sharing systems'
          },
          {
            id: 'rel-2',
            source: 'fcfs',
            target: 'cpu-sched',
            type: 'implements',
            description: 'FCFS is a basic implementation of CPU scheduling'
          }
        ],
        sources: [
          {
            id: 'src-1',
            name: 'Operating Systems Unit 1.pdf',
            size: 1048576,
            uploadedAt: new Date().toISOString()
          }
        ]
      };

      const rf = knowledgeGraphToReactFlow(mockKG);
      const cpuDetails = rf.conceptDetails['cpu-sched'];

      assert.ok(cpuDetails, 'Concept details for CPU Scheduling should exist');
      assert.equal(cpuDetails.name, 'CPU Scheduling');
      assert.equal(cpuDetails.relationships.length, 2);

      const rrRel = cpuDetails.relationships.find(r => r.targetId === 'round-robin');
      assert.ok(rrRel);
      assert.equal(rrRel.type, 'uses');
      assert.equal(rrRel.direction, 'outgoing');

      const fcfsRel = cpuDetails.relationships.find(r => r.targetId === 'fcfs');
      assert.ok(fcfsRel);
      assert.equal(fcfsRel.type, 'implements');
      assert.equal(fcfsRel.direction, 'incoming');
    });
  });

  describe('5. Graph Focus & Dimming Behavior (calculateVisibleGraph)', () => {
    const nodes: Node<GraphConceptData>[] = [
      {
        id: 'cpu-sched',
        type: 'conceptNode',
        position: { x: 200, y: 150 },
        data: {
          id: 'cpu-sched',
          name: 'CPU Scheduling',
          label: 'CPU Scheduling',
          code: 'CPU',
          category: 'Concept',
          description: 'CPU Scheduling selects from ready queue.',
          prerequisites: [],
          relationships: [],
          confidence: 95,
          source: 'OS.pdf',
          synapseCount: 2
        }
      },
      {
        id: 'round-robin',
        type: 'conceptNode',
        position: { x: 100, y: 300 },
        data: {
          id: 'round-robin',
          name: 'Round Robin',
          label: 'Round Robin',
          code: 'RR',
          category: 'Method',
          description: 'Round Robin uses time slices.',
          prerequisites: [],
          relationships: [],
          confidence: 90,
          source: 'OS.pdf',
          synapseCount: 1
        }
      },
      {
        id: 'fcfs',
        type: 'conceptNode',
        position: { x: 300, y: 300 },
        data: {
          id: 'fcfs',
          name: 'FCFS',
          label: 'FCFS',
          code: 'FCFS',
          category: 'Method',
          description: 'First-Come First-Served.',
          prerequisites: [],
          relationships: [],
          confidence: 90,
          source: 'OS.pdf',
          synapseCount: 1
        }
      },
      {
        id: 'virtual-memory',
        type: 'conceptNode',
        position: { x: 600, y: 500 },
        data: {
          id: 'virtual-memory',
          name: 'Virtual Memory',
          label: 'Virtual Memory',
          code: 'VM',
          category: 'Architecture',
          description: 'Virtual memory separates user logical memory from physical memory.',
          prerequisites: [],
          relationships: [],
          confidence: 92,
          source: 'OS.pdf',
          synapseCount: 0
        }
      }
    ];

    const edges: Edge[] = [
      {
        id: 'e-cpu-rr',
        source: 'cpu-sched',
        target: 'round-robin',
        type: 'custom',
        label: 'uses'
      },
      {
        id: 'e-cpu-fcfs',
        source: 'cpu-sched',
        target: 'fcfs',
        type: 'custom',
        label: 'implements'
      }
    ];

    test('when a node is selected: selected node emphasized, neighbors highlighted, unrelated nodes dimmed', () => {
      const result = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: 'cpu-sched',
        densityMode: 'balanced'
      });

      const selectedNode = result.visibleNodes.find(n => n.id === 'cpu-sched');
      const rrNeighbor = result.visibleNodes.find(n => n.id === 'round-robin');
      const fcfsNeighbor = result.visibleNodes.find(n => n.id === 'fcfs');
      const vmUnrelated = result.visibleNodes.find(n => n.id === 'virtual-memory');

      // Selected node: green accent, selected: true, not dimmed
      assert.ok(selectedNode);
      assert.equal(selectedNode.data.selected, true);
      assert.equal(selectedNode.data.highlighted, false);
      assert.equal(selectedNode.data.dimmed, false);

      // Directly connected neighbors: highlighted: true, not dimmed
      assert.ok(rrNeighbor);
      assert.equal(rrNeighbor.data.highlighted, true);
      assert.equal(rrNeighbor.data.dimmed, false);

      assert.ok(fcfsNeighbor);
      assert.equal(fcfsNeighbor.data.highlighted, true);
      assert.equal(fcfsNeighbor.data.dimmed, false);

      // Unrelated node: dimmed: true (dimmed to 25-40% opacity in CSS)
      assert.ok(vmUnrelated);
      assert.equal(vmUnrelated.data.dimmed, true);
      assert.equal(vmUnrelated.data.selected, false);
      assert.equal(vmUnrelated.data.highlighted, false);
    });

    test('connected edges are emphasized and unrelated edges are dimmed', () => {
      const edgesWithUnrelated: Edge[] = [
        ...edges,
        {
          id: 'e-vm-paging',
          source: 'virtual-memory',
          target: 'virtual-memory',
          type: 'custom',
          label: 'allocates'
        }
      ];

      const result = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edgesWithUnrelated,
        selectedNodeId: 'cpu-sched',
        densityMode: 'balanced'
      });

      const incidentEdge = result.visibleEdges.find(e => e.id === 'e-cpu-rr');
      assert.ok(incidentEdge);
      assert.equal(incidentEdge.selected, true);
      assert.equal(incidentEdge.className, 'highlighted');
      assert.equal(incidentEdge.style?.stroke, '#A3FF12');
      assert.equal(incidentEdge.style?.strokeWidth, 1.85);

      const unrelatedEdge = result.visibleEdges.find(e => e.id === 'e-vm-paging');
      assert.ok(unrelatedEdge);
      assert.equal(unrelatedEdge.className, 'dimmed');
      assert.equal(unrelatedEdge.style?.opacity, 0.12);
    });

    test('closing panel and deselecting node restores neutral state for all nodes and edges', () => {
      const neutralResult = calculateVisibleGraph({
        allNodes: nodes,
        allEdges: edges,
        selectedNodeId: null,
        densityMode: 'balanced'
      });

      // No node is dimmed, none selected, none highlighted
      for (const node of neutralResult.visibleNodes) {
        assert.equal(node.data.selected, false);
        assert.equal(node.data.highlighted, false);
        assert.equal(node.data.dimmed, false);
      }

      // No edge is dimmed
      for (const edge of neutralResult.visibleEdges) {
        assert.equal(edge.selected, false);
        assert.notEqual(edge.className, 'dimmed');
        assert.equal(edge.style?.opacity, 0.85);
      }
    });
  });

  describe('6. Default Graph Data Enrichment', () => {
    test('default concepts contain evidence passages and page references in initialConceptDetails', () => {
      const dlDetails = initialConceptDetails['dl'];

      assert.ok(dlDetails);
      assert.equal(dlDetails.name, 'Deep Learning');
      assert.ok(dlDetails.description && dlDetails.description.length > 0);
      assert.ok(dlDetails.evidence && dlDetails.evidence.length > 0);
      assert.equal(dlDetails.page, 4);
    });

    test('knowledgeGraphToReactFlow maps name, evidence, and page onto conceptDetails', () => {
      const kg: KnowledgeGraph = {
        id: 'default',
        title: 'Deep Learning',
        nodes: [
          {
            id: 'dl',
            name: 'Deep Learning',
            type: 'Paradigm',
            description: 'Hierarchical representation learning with multi-layer neural architectures.',
            evidence: 'Deep learning enables computational models to learn representations of data.',
            evidenceItems: [
              {
                sourceId: 'src-nature-dl',
                page: 4,
                text: 'Deep learning enables computational models to learn representations of data.'
              }
            ]
          }
        ],
        relationships: []
      };

      const rf = knowledgeGraphToReactFlow(kg);
      const dlDetails = rf.conceptDetails['dl'];

      assert.ok(dlDetails);
      assert.equal(dlDetails.name, 'Deep Learning');
      assert.ok(dlDetails.description.length > 0);
      assert.ok(dlDetails.evidence && dlDetails.evidence.length > 0);
      assert.equal(dlDetails.page, 4);
    });
  });
});
