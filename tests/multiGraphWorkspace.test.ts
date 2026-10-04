import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGraphs,
  saveGraphs,
  loadActiveGraphId,
  saveActiveGraphId,
  createGraph,
  deleteGraph,
  loadGraphData,
  saveGraphData,
  loadUserSources,
  saveUserSources,
  loadCompletedConceptIds,
  saveCompletedConceptIds,
  DEFAULT_MIGRATION_GRAPH_ID,
  DEFAULT_MIGRATION_GRAPH_NAME
} from '../src/services/storage';
import { generateLearningPaths } from '../src/services/learningPathGeneration';
import { buildKnowledgeGraph } from '../src/services/graphBuilder';
import type { KnowledgeSource, KnowledgeGraph } from '../src/types/knowledgeGraph';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('Multi-Graph & Workspace Architecture', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  describe('TEST 1: Create DBMS graph and upload material', () => {
    it('creates DBMS graph, associates sources, concepts and generates scoped paths', () => {
      saveGraphs([]);

      // 1. Create DBMS graph
      const dbmsGraphMeta = createGraph('DBMS', 'Database Management Systems workspace');
      assert.ok(dbmsGraphMeta.id.startsWith('graph-dbms-'), 'Expected stable unique ID');
      assert.equal(dbmsGraphMeta.name, 'DBMS');

      // Verify activeGraphId was switched to DBMS
      assert.equal(loadActiveGraphId(), dbmsGraphMeta.id);

      // 2. Upload DBMS_Unit_1.pdf and DBMS_Unit_2.pdf
      const dbmsSource1: KnowledgeSource = {
        id: 'src-dbms-1',
        graphId: dbmsGraphMeta.id,
        name: 'DBMS_Unit_1.pdf',
        fileName: 'DBMS_Unit_1.pdf',
        type: 'pdf',
        createdAt: new Date().toISOString(),
        status: 'ready'
      };

      const dbmsSource2: KnowledgeSource = {
        id: 'src-dbms-2',
        graphId: dbmsGraphMeta.id,
        name: 'DBMS_Unit_2.pdf',
        fileName: 'DBMS_Unit_2.pdf',
        type: 'pdf',
        createdAt: new Date().toISOString(),
        status: 'ready'
      };

      saveUserSources([dbmsSource1, dbmsSource2], dbmsGraphMeta.id);

      // Verify Sources shows 2 for DBMS
      const dbmsSources = loadUserSources(dbmsGraphMeta.id);
      assert.equal(dbmsSources.length, 2);
      assert.equal(dbmsSources[0].name, 'DBMS_Unit_1.pdf');
      assert.equal(dbmsSources[1].name, 'DBMS_Unit_2.pdf');

      // 3. Build and save DBMS graph
      const dbmsConcepts = [
        { id: 'rel-model', name: 'Relational Model', type: 'concept', description: 'Tables and schemas', sourceIds: [dbmsSource1.id], sourceChunkIds: [], occurrences: 5, confidence: 0.98 },
        { id: 'sql-queries', name: 'SQL Queries', type: 'method', description: 'Structured query language', sourceIds: [dbmsSource1.id], sourceChunkIds: [], occurrences: 6, confidence: 0.96 },
        { id: 'indexing', name: 'B-Tree Indexing', type: 'technique', description: 'Optimized lookups', sourceIds: [dbmsSource2.id], sourceChunkIds: [], occurrences: 4, confidence: 0.95 },
        { id: 'transactions', name: 'ACID Transactions', type: 'concept', description: 'Atomicity and consistency', sourceIds: [dbmsSource2.id], sourceChunkIds: [], occurrences: 4, confidence: 0.95 }
      ];

      const dbmsRels = [
        { id: 'r1', source: 'rel-model', target: 'sql-queries', type: 'foundation-for', sourceChunkIds: [] },
        { id: 'r2', source: 'sql-queries', target: 'indexing', type: 'uses', sourceChunkIds: [] },
        { id: 'r3', source: 'indexing', target: 'transactions', type: 'part-of', sourceChunkIds: [] }
      ];

      const dbmsGraph = buildKnowledgeGraph(dbmsConcepts, dbmsRels, [dbmsSource1, dbmsSource2], {
        graphId: dbmsGraphMeta.id,
        filterNoiseNodes: false
      });

      saveGraphData(dbmsGraphMeta.id, dbmsGraph);

      // Verify Knowledge Graph shows DBMS concepts
      const loadedDbmsGraph = loadGraphData(dbmsGraphMeta.id);
      assert.ok(loadedDbmsGraph);
      assert.equal(loadedDbmsGraph.nodes.length, 4);
      assert.ok(loadedDbmsGraph.nodes.every(n => n.graphId === dbmsGraphMeta.id));

      // Verify Learning Paths use DBMS concepts
      const dbmsPaths = generateLearningPaths(loadedDbmsGraph, []);
      assert.ok(dbmsPaths.paths.length > 0);
      assert.ok(dbmsPaths.paths[0].title.includes('Relational Model'));
    });
  });

  describe('TEST 2: Create Machine Learning graph and verify clean empty states', () => {
    it('creates Machine Learning graph and confirms 0 sources, 0 concepts, 0 learning paths without demo data leakage', () => {
      saveGraphs([]);

      // Setup DBMS first to ensure multi-graph presence
      const dbms = createGraph('DBMS');
      saveUserSources([{ id: 'src-1', graphId: dbms.id, name: 'dbms.pdf', type: 'pdf', createdAt: '', status: 'ready' }], dbms.id);

      // Create Machine Learning
      const mlGraphMeta = createGraph('Machine Learning', 'ML workspace');
      assert.equal(mlGraphMeta.name, 'Machine Learning');
      assert.equal(loadActiveGraphId(), mlGraphMeta.id);

      // Verify Sources is empty for Machine Learning
      const mlSources = loadUserSources(mlGraphMeta.id);
      assert.equal(mlSources.length, 0, 'New graph sources must be empty');

      // Verify Knowledge Graph is empty
      const mlGraph = loadGraphData(mlGraphMeta.id);
      assert.equal(mlGraph, null, 'New graph data must be null');

      // Verify Learning Paths is empty
      const mlPaths = generateLearningPaths(mlGraph, []);
      assert.equal(mlPaths.paths.length, 0, 'New graph learning paths must be empty');
      assert.equal(mlPaths.state, 'empty');
    });
  });

  describe('TEST 3: Upload ML_Unit_1.pdf into Machine Learning graph', () => {
    it('verifies Machine Learning contains only ML material and DBMS is not contaminated', () => {
      saveGraphs([]);

      const dbms = createGraph('DBMS');
      saveUserSources([{ id: 'src-dbms', graphId: dbms.id, name: 'DBMS.pdf', type: 'pdf', createdAt: '', status: 'ready' }], dbms.id);

      const ml = createGraph('Machine Learning');
      const mlSource: KnowledgeSource = {
        id: 'src-ml-1',
        graphId: ml.id,
        name: 'ML_Unit_1.pdf',
        fileName: 'ML_Unit_1.pdf',
        type: 'pdf',
        createdAt: new Date().toISOString(),
        status: 'ready'
      };
      saveUserSources([mlSource], ml.id);

      // Verify ML has only ML material
      const mlSources = loadUserSources(ml.id);
      assert.equal(mlSources.length, 1);
      assert.equal(mlSources[0].name, 'ML_Unit_1.pdf');
      assert.equal(mlSources[0].graphId, ml.id);

      // Verify DBMS still has only its own material
      const dbmsSources = loadUserSources(dbms.id);
      assert.equal(dbmsSources.length, 1);
      assert.equal(dbmsSources[0].name, 'DBMS.pdf');
    });
  });

  describe('TEST 4 & TEST 5: Switching between graphs', () => {
    it('switches DBMS → Machine Learning → DBMS without data corruption', () => {
      saveGraphs([]);

      const dbms = createGraph('DBMS');
      const ml = createGraph('Machine Learning');

      // Populate DBMS with 2 sources
      saveUserSources([
        { id: 'dbms-1', graphId: dbms.id, name: 'dbms1.pdf', type: 'pdf', createdAt: '', status: 'ready' },
        { id: 'dbms-2', graphId: dbms.id, name: 'dbms2.pdf', type: 'pdf', createdAt: '', status: 'ready' }
      ], dbms.id);

      // Populate ML with 1 source
      saveUserSources([
        { id: 'ml-1', graphId: ml.id, name: 'ml1.pdf', type: 'pdf', createdAt: '', status: 'ready' }
      ], ml.id);

      // Switch to ML
      saveActiveGraphId(ml.id);
      assert.equal(loadActiveGraphId(), ml.id);
      assert.equal(loadUserSources(ml.id).length, 1);

      // Switch to DBMS
      saveActiveGraphId(dbms.id);
      assert.equal(loadActiveGraphId(), dbms.id);
      const restoredDbmsSources = loadUserSources(dbms.id);
      assert.equal(restoredDbmsSources.length, 2);
      assert.equal(restoredDbmsSources[0].name, 'dbms1.pdf');
      assert.equal(restoredDbmsSources[1].name, 'dbms2.pdf');
    });
  });

  describe('TEST 6: Refresh simulation and persistence', () => {
    it('persists graph list, selected graph, and scoped data across reloads', () => {
      saveGraphs([]);

      const dbms = createGraph('DBMS');
      const ml = createGraph('Machine Learning');
      saveActiveGraphId(ml.id);

      saveUserSources([
        { id: 'ml-s1', graphId: ml.id, name: 'gradient_descent.pdf', type: 'pdf', createdAt: '', status: 'ready' }
      ], ml.id);

      // Simulate browser reload: re-read from storage
      const reloadedGraphs = loadGraphs();
      assert.equal(reloadedGraphs.length, 2);
      assert.ok(reloadedGraphs.some(g => g.name === 'DBMS'));
      assert.ok(reloadedGraphs.some(g => g.name === 'Machine Learning'));

      const reloadedActiveId = loadActiveGraphId();
      assert.equal(reloadedActiveId, ml.id);

      const reloadedSources = loadUserSources(reloadedActiveId!);
      assert.equal(reloadedSources.length, 1);
      assert.equal(reloadedSources[0].name, 'gradient_descent.pdf');
    });
  });

  describe('TEST 7: Graph deletion with safe fallback', () => {
    it('deletes Machine Learning, leaves DBMS intact, and safely falls back activeGraphId', () => {
      saveGraphs([]);

      const dbms = createGraph('DBMS');
      const ml = createGraph('Machine Learning');

      saveUserSources([{ id: 'dbms-s', graphId: dbms.id, name: 'dbms.pdf', type: 'pdf', createdAt: '', status: 'ready' }], dbms.id);
      saveUserSources([{ id: 'ml-s', graphId: ml.id, name: 'ml.pdf', type: 'pdf', createdAt: '', status: 'ready' }], ml.id);

      saveActiveGraphId(ml.id);

      // Delete ML graph
      const { remainingGraphs, nextActiveId } = deleteGraph(ml.id);

      // Verify ML disappeared and DBMS remains untouched
      assert.equal(remainingGraphs.length, 1);
      assert.equal(remainingGraphs[0].id, dbms.id);
      assert.equal(remainingGraphs[0].name, 'DBMS');

      // Verify fallback active graph is DBMS
      assert.equal(nextActiveId, dbms.id);
      assert.equal(loadActiveGraphId(), dbms.id);

      // Verify ML sources were removed from storage
      const mlSources = loadUserSources(ml.id);
      assert.equal(mlSources.length, 0);

      // Verify DBMS sources are untouched
      const dbmsSources = loadUserSources(dbms.id);
      assert.equal(dbmsSources.length, 1);
      assert.equal(dbmsSources[0].name, 'dbms.pdf');
    });
  });

  describe('TEST 8: Legacy Data Migration', () => {
    it('migrates unassigned sources and graph data into Neural & Cognitive Architectures without data loss', () => {
      // Simulate legacy unmigrated data in localStorage
      const legacySources = [
        { id: 'src-legacy-1', name: 'Hopfield_Networks.pdf', fileName: 'Hopfield_Networks.pdf', type: 'pdf', createdAt: '2026-03-01T00:00:00Z', status: 'ready' }
      ];
      const legacyGraph: KnowledgeGraph = {
        nodes: [
          { id: 'node-1', name: 'Hopfield Network', type: 'architecture', description: 'Associative memory', sourceIds: ['src-legacy-1'] }
        ],
        relationships: [],
        sources: legacySources
      };

      storageMap.set('graphmind_user_sources_v1', JSON.stringify(legacySources));
      storageMap.set('graphmind_user_graph_v1', JSON.stringify(legacyGraph));

      // Trigger loadGraphs (which executes migration)
      const graphs = loadGraphs();
      assert.equal(graphs.length, 1);
      assert.equal(graphs[0].id, DEFAULT_MIGRATION_GRAPH_ID);
      assert.equal(graphs[0].name, DEFAULT_MIGRATION_GRAPH_NAME);

      // Verify sources were tagged with the default graph ID
      const migratedSources = loadUserSources(DEFAULT_MIGRATION_GRAPH_ID);
      assert.equal(migratedSources.length, 1);
      assert.equal(migratedSources[0].name, 'Hopfield_Networks.pdf');
      assert.equal(migratedSources[0].graphId, DEFAULT_MIGRATION_GRAPH_ID);

      // Verify graph data was migrated
      const migratedGraph = loadGraphData(DEFAULT_MIGRATION_GRAPH_ID);
      assert.ok(migratedGraph);
      assert.equal(migratedGraph.nodes.length, 1);
      assert.equal(migratedGraph.nodes[0].graphId, DEFAULT_MIGRATION_GRAPH_ID);
    });
  });

  describe('TEST 9: Zero Graphs First-Time Experience', () => {
    it('handles 0 graphs state safely when all graphs are removed', () => {
      saveGraphs([]);
      saveActiveGraphId(null);

      const graphs = loadGraphs();
      assert.equal(graphs.length, 0);

      const activeId = loadActiveGraphId();
      assert.equal(activeId, null);

      const sources = loadUserSources();
      assert.equal(sources.length, 0);
    });
  });

  describe('TEST 10: Name Validation & Protection', () => {
    it('validates graph names strictly', () => {
      assert.throws(() => createGraph(''), /Graph name is required/);
      assert.throws(() => createGraph('   '), /Graph name is required/);
      assert.throws(() => createGraph('A'.repeat(101)), /100 characters or less/);

      const valid = createGraph('  Operating Systems  ');
      assert.equal(valid.name, 'Operating Systems');
    });
  });
});
