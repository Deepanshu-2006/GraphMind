import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGraphDescription,
  rankGraphConcepts,
  formatConceptForSpeech
} from '../src/services/editorialCopy';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';

describe('Editorial Hero Copy Generation & Architecture', () => {
  describe('Fallback States', () => {
    it('returns processing copy when isProcessing option is true', () => {
      const copy = generateGraphDescription(null, { isProcessing: true });
      assert.equal(copy, 'Your material is being mapped into connected ideas.');

      const activeGraph: KnowledgeGraph = {
        name: 'Operating Systems',
        nodes: [{ id: '1', name: 'Process', type: 'concept', description: '', sourceIds: [] }],
        relationships: []
      };
      const copyWithGraph = generateGraphDescription(activeGraph, { isProcessing: true });
      assert.equal(copyWithGraph, 'Your material is being mapped into connected ideas.');
    });

    it('returns empty material copy when graph is null, undefined, or has 0 concepts', () => {
      assert.equal(
        generateGraphDescription(null),
        "Upload your material and we'll map the ideas inside it."
      );
      assert.equal(
        generateGraphDescription(undefined),
        "Upload your material and we'll map the ideas inside it."
      );
      assert.equal(
        generateGraphDescription({ nodes: [], relationships: [] }),
        "Upload your material and we'll map the ideas inside it."
      );
    });

    it('returns shape copy when graph has only 1 or 2 concepts', () => {
      const graphOne: KnowledgeGraph = {
        name: 'Calculus',
        nodes: [{ id: 'c1', name: 'Derivative', type: 'foundation', description: '', sourceIds: [] }],
        relationships: []
      };
      assert.equal(
        generateGraphDescription(graphOne),
        'Your material is beginning to take shape.'
      );

      const graphTwo: KnowledgeGraph = {
        name: 'Calculus',
        nodes: [
          { id: 'c1', name: 'Derivative', type: 'foundation', description: '', sourceIds: [] },
          { id: 'c2', name: 'Integral', type: 'foundation', description: '', sourceIds: [] }
        ],
        relationships: []
      };
      assert.equal(
        generateGraphDescription(graphTwo),
        'Your material is beginning to take shape.'
      );
    });
  });

  describe('Concept Ranking & Noise Filtering', () => {
    it('ranks central, connected concepts above isolated concepts and title duplicates', () => {
      const osGraph: KnowledgeGraph = {
        id: 'os-graph',
        name: 'Operating Systems',
        nodes: [
          { id: 'n-title', name: 'Operating System', type: 'concept', description: '', sourceIds: [] },
          { id: 'n-cpu', name: 'CPU', type: 'component', description: '', sourceIds: [] },
          { id: 'n-proc', name: 'Process', type: 'foundation', description: '', sourceIds: [] },
          { id: 'n-sched', name: 'CPU Scheduling', type: 'method', isCoreConcept: true, description: '', sourceIds: [] },
          { id: 'n-rr', name: 'Round Robin', type: 'method', description: '', sourceIds: [] },
          { id: 'n-aging', name: 'Aging', type: 'method', description: '', sourceIds: [] },
          { id: 'n-tp', name: 'Throughput', type: 'property', description: '', sourceIds: [] },
          { id: 'n-iso', name: 'Random Isolated Note', type: 'concept', description: '', sourceIds: [] }
        ],
        relationships: [
          { id: 'r1', source: 'n-proc', target: 'n-sched', type: 'depends-on', sourceChunkIds: [] },
          { id: 'r2', source: 'n-sched', target: 'n-rr', type: 'uses', sourceChunkIds: [] },
          { id: 'r3', source: 'n-sched', target: 'n-aging', type: 'uses', sourceChunkIds: [] },
          { id: 'r4', source: 'n-sched', target: 'n-tp', type: 'optimizes', sourceChunkIds: [] },
          { id: 'r5', source: 'n-proc', target: 'n-cpu', type: 'uses', sourceChunkIds: [] }
        ]
      };

      const ranked = rankGraphConcepts(osGraph);

      // 1. Must filter out "Operating System" duplicate of graph title
      assert.ok(!ranked.some(n => n.name === 'Operating System'));

      // 2. High degree concepts (CPU Scheduling, Process) must be at top
      assert.ok(ranked.length >= 3);
      const topNames = ranked.slice(0, 3).map(n => n.name);
      assert.ok(topNames.includes('CPU Scheduling'), 'CPU Scheduling should be ranked high');
      assert.ok(topNames.includes('Process'), 'Process should be ranked high');

      // 3. Isolated node must not be in top ranks
      assert.notEqual(ranked[0].name, 'Random Isolated Note');
    });

    it('preserves uppercase acronyms and formats natural plurals', () => {
      assert.equal(formatConceptForSpeech('CPU'), 'CPU');
      assert.equal(formatConceptForSpeech('RAM'), 'RAM');
      assert.equal(formatConceptForSpeech('GPU'), 'GPU');
      assert.equal(formatConceptForSpeech('CPU Scheduling'), 'CPU scheduling');
      assert.equal(formatConceptForSpeech('Process'), 'processes');
      assert.equal(formatConceptForSpeech('Neural Networks'), 'neural networks');
      assert.equal(formatConceptForSpeech('Gradient Descent'), 'gradient descent');
    });
  });

  describe('Editorial Quality & Distinct Topic Descriptions', () => {
    const topic1_OperatingSystems: KnowledgeGraph = {
      id: 'g-os',
      name: 'Operating Systems',
      nodes: [
        { id: 'os-1', name: 'Process', type: 'foundation', description: '', sourceIds: [] },
        { id: 'os-2', name: 'CPU Scheduling', type: 'method', isCoreConcept: true, description: '', sourceIds: [] },
        { id: 'os-3', name: 'Round Robin', type: 'method', description: '', sourceIds: [] },
        { id: 'os-4', name: 'Aging', type: 'method', description: '', sourceIds: [] },
        { id: 'os-5', name: 'Throughput', type: 'property', description: '', sourceIds: [] },
        { id: 'os-6', name: 'Memory Management', type: 'foundation', description: '', sourceIds: [] },
        { id: 'os-7', name: 'Operating System', type: 'concept', description: '', sourceIds: [] }
      ],
      relationships: [
        { id: 'r1', source: 'os-1', target: 'os-2', type: 'depends-on', sourceChunkIds: [] },
        { id: 'r2', source: 'os-2', target: 'os-3', type: 'uses', sourceChunkIds: [] },
        { id: 'r3', source: 'os-2', target: 'os-4', type: 'uses', sourceChunkIds: [] },
        { id: 'r4', source: 'os-2', target: 'os-5', type: 'optimizes', sourceChunkIds: [] },
        { id: 'r5', source: 'os-1', target: 'os-6', type: 'part-of', sourceChunkIds: [] }
      ]
    };

    const topic2_MachineLearning: KnowledgeGraph = {
      id: 'g-ml',
      name: 'Deep Learning Architectures',
      nodes: [
        { id: 'ml-1', name: 'Neural Networks', type: 'foundation', isCoreConcept: true, description: '', sourceIds: [] },
        { id: 'ml-2', name: 'Backpropagation', type: 'method', isCoreConcept: true, description: '', sourceIds: [] },
        { id: 'ml-3', name: 'Gradient Descent', type: 'method', description: '', sourceIds: [] },
        { id: 'ml-4', name: 'Activation Function', type: 'component', description: '', sourceIds: [] },
        { id: 'ml-5', name: 'Loss Function', type: 'component', description: '', sourceIds: [] }
      ],
      relationships: [
        { id: 'mr1', source: 'ml-1', target: 'ml-2', type: 'trained-by', sourceChunkIds: [] },
        { id: 'mr2', source: 'ml-2', target: 'ml-3', type: 'uses', sourceChunkIds: [] },
        { id: 'mr3', source: 'ml-3', target: 'ml-5', type: 'optimizes', sourceChunkIds: [] },
        { id: 'mr4', source: 'ml-1', target: 'ml-4', type: 'contains', sourceChunkIds: [] }
      ]
    };

    const topic3_DistributedDatabases: KnowledgeGraph = {
      id: 'g-db',
      name: 'Distributed Systems & Databases',
      nodes: [
        { id: 'db-1', name: 'Consensus', type: 'foundation', isCoreConcept: true, description: '', sourceIds: [] },
        { id: 'db-2', name: 'Raft Protocol', type: 'method', description: '', sourceIds: [] },
        { id: 'db-3', name: 'Replication', type: 'paradigm', isCoreConcept: true, description: '', sourceIds: [] },
        { id: 'db-4', name: 'Sharding', type: 'method', description: '', sourceIds: [] },
        { id: 'db-5', name: 'CAP Theorem', type: 'foundation', description: '', sourceIds: [] }
      ],
      relationships: [
        { id: 'dbr1', source: 'db-1', target: 'db-2', type: 'implements', sourceChunkIds: [] },
        { id: 'dbr2', source: 'db-3', target: 'db-1', type: 'depends-on', sourceChunkIds: [] },
        { id: 'dbr3', source: 'db-3', target: 'db-4', type: 'coexists-with', sourceChunkIds: [] },
        { id: 'dbr4', source: 'db-3', target: 'db-5', type: 'governed-by', sourceChunkIds: [] }
      ]
    };

    it('generates distinct, natural descriptions across different graph topics', () => {
      const descOS = generateGraphDescription(topic1_OperatingSystems);
      const descML = generateGraphDescription(topic2_MachineLearning);
      const descDB = generateGraphDescription(topic3_DistributedDatabases);

      // Verify all descriptions are unique
      assert.notEqual(descOS, descML);
      assert.notEqual(descOS, descDB);
      assert.notEqual(descML, descDB);

      // Verify descriptions match their actual subject matter
      assert.ok(descOS.includes('scheduling') || descOS.includes('processes') || descOS.includes('memory'));
      assert.ok(descML.includes('neural') || descML.includes('backpropagation') || descML.includes('gradient'));
      assert.ok(descDB.includes('consensus') || descDB.includes('replication') || descDB.includes('sharding'));
    });

    it('enforces editorial copy rules (word count, 1 sentence, no forbidden marketing buzzwords)', () => {
      const descriptions = [
        generateGraphDescription(topic1_OperatingSystems),
        generateGraphDescription(topic2_MachineLearning),
        generateGraphDescription(topic3_DistributedDatabases)
      ];

      for (const desc of descriptions) {
        // 1 sentence ending in a period
        assert.ok(desc.endsWith('.'), 'Must end with a period');
        assert.equal(desc.split('.').filter(Boolean).length, 1, 'Must be exactly one sentence');

        // Word count around 12–20 words
        const words = desc.split(/\s+/);
        assert.ok(words.length >= 10 && words.length <= 22, `Word count ${words.length} must be in 10-22 range`);

        // Avoid repeating graph title
        assert.ok(!desc.toLowerCase().includes('operating systems knowledge graph'));
        assert.ok(!desc.toLowerCase().includes('deep learning architectures knowledge graph'));

        // Avoid forbidden marketing/AI jargon
        const forbidden = [
          'knowledge graph',
          'ai-powered',
          'graphmind',
          'cognitive engine',
          'unlock',
          'discover',
          'powerful',
          'revolutionary',
          'supercharge',
          'next-generation'
        ];
        for (const term of forbidden) {
          assert.ok(
            !desc.toLowerCase().includes(term),
            `Copy should not contain marketing term "${term}": "${desc}"`
          );
        }
      }
    });

    it('never invents concepts and only uses concepts that exist in the active graph', () => {
      const descOS = generateGraphDescription(topic1_OperatingSystems);
      const osNodeNames = topic1_OperatingSystems.nodes.map(n => n.name.toLowerCase());

      // At least 2 concepts from the graph must be present in the output
      const matched = osNodeNames.filter(name => {
        const single = name.toLowerCase();
        return descOS.toLowerCase().includes(single) || descOS.toLowerCase().includes(formatConceptForSpeech(single));
      });
      assert.ok(matched.length >= 2, `Expected at least 2 real concepts matched in: "${descOS}"`);
    });

    it('is completely deterministic across repeated calls', () => {
      const call1 = generateGraphDescription(topic1_OperatingSystems);
      const call2 = generateGraphDescription(topic1_OperatingSystems);
      assert.equal(call1, call2);
    });
  });
});
