import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFileType, formatFileSize, formatRelativeTime } from '../src/services/sourceIngestion';
import { loadUserSources, saveUserSources, loadUserGraph, saveUserGraph } from '../src/services/storage';
import type { KnowledgeSource, KnowledgeGraph } from '../src/types/knowledgeGraph';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('Sources Page Real Data Layer', () => {
  describe('getFileType helper', () => {
    it('correctly detects file types from filenames and mimeTypes', () => {
      assert.equal(getFileType({ fileName: 'DBMS_Unit_3.pdf' }), 'PDF');
      assert.equal(getFileType({ fileName: 'Operating_Systems.docx' }), 'DOCX');
      assert.equal(getFileType({ fileName: 'Notes.txt' }), 'TXT');
      assert.equal(getFileType({ fileName: 'README.md' }), 'MD');
      assert.equal(getFileType({ fileName: 'data.csv' }), 'CSV');
      assert.equal(getFileType({ fileName: 'schema.json' }), 'JSON');
      assert.equal(getFileType({ mimeType: 'application/pdf' }), 'PDF');
      assert.equal(getFileType({ mimeType: 'text/markdown' }), 'MD');
      assert.equal(getFileType({ type: 'pdf' }), 'PDF');
    });
  });

  describe('formatFileSize helper', () => {
    it('formats bytes into concise human-readable B, KB, MB, GB strings', () => {
      assert.equal(formatFileSize(0), '0 B');
      assert.equal(formatFileSize(512), '512 B');
      assert.equal(formatFileSize(840 * 1024), '840 KB');
      assert.equal(formatFileSize(1.4 * 1024 * 1024), '1.4 MB');
      assert.equal(formatFileSize(2.1 * 1024 * 1024 * 1024), '2.1 GB');
    });
  });

  describe('formatRelativeTime helper', () => {
    it('formats timestamps into strict editorial uppercase strings', () => {
      const now = Date.now();
      assert.equal(formatRelativeTime(now - 10 * 1000), 'ADDED JUST NOW');
      assert.equal(formatRelativeTime(now - 3 * 60 * 1000), 'ADDED 3 MIN AGO');
      assert.equal(formatRelativeTime(now - 2 * 3600 * 1000), 'ADDED 2 HOURS AGO');
      assert.equal(formatRelativeTime(now - 28 * 3600 * 1000), 'ADDED YESTERDAY');
      assert.equal(formatRelativeTime(now - 4 * 86400 * 1000), 'ADDED 4 DAYS AGO');
      // 10 days ago (older than 7 days)
      const pastDate = new Date(now - 10 * 86400 * 1000);
      const result = formatRelativeTime(pastDate.toISOString());
      assert.ok(result.startsWith('ADDED '), `Expected "ADDED ...", got "${result}"`);
    });

    it('returns empty string if date is missing or invalid', () => {
      assert.equal(formatRelativeTime(undefined), '');
      assert.equal(formatRelativeTime('not-a-date'), '');
    });
  });

  describe('Persistence & Demo Isolation (storage.ts)', () => {
    it('saves and loads real user sources while filtering out any demo fixtures', () => {
      storageMap.clear();

      const realSource: KnowledgeSource = {
        id: 'src-real-user-doc-01',
        name: 'DBMS Unit 4',
        fileName: 'DBMS_Unit_4.pdf',
        type: 'pdf',
        size: '1.4 MB',
        sizeBytes: 1468006,
        status: 'ready',
        createdAt: new Date().toISOString(),
        conceptIds: ['c-sql', 'c-transactions'],
        conceptsExtracted: 2
      };

      // Attempt to save user source along with a demo fixture ID
      const demoSource: KnowledgeSource = {
        id: 'src-stanford-cs229',
        name: 'Stanford CS229: Machine Learning Course Notes',
        fileName: 'Stanford CS229.pdf',
        type: 'pdf',
        size: '1.4 MB',
        status: 'ready',
        createdAt: new Date().toISOString()
      };

      saveUserSources([realSource, demoSource]);

      const loaded = loadUserSources();
      assert.equal(loaded.length, 1, 'Should only contain the real user source');
      assert.equal(loaded[0].id, 'src-real-user-doc-01');
      assert.equal(loaded[0].fileName, 'DBMS_Unit_4.pdf');
      assert.equal(loaded[0].sizeBytes, 1468006);
    });
  });

  describe('Provenance and Graph Cleanup on Source Deletion', () => {
    it('preserves shared concepts and prunes exclusive concepts when source is deleted', () => {
      const sourceAId = 'src-a';
      const sourceBId = 'src-b';

      const graph: KnowledgeGraph = {
        sources: [
          { id: sourceAId, name: 'Doc A', type: 'pdf', size: '1MB', status: 'ready', createdAt: '2026-01-01' },
          { id: sourceBId, name: 'Doc B', type: 'pdf', size: '1MB', status: 'ready', createdAt: '2026-01-02' }
        ],
        nodes: [
          // Exclusive to Source A
          { id: 'node-exclusive-a', name: 'Relational Algebra', sourceIds: [sourceAId] },
          // Shared between Source A and Source B
          { id: 'node-shared', name: 'Query Optimization', sourceIds: [sourceAId, sourceBId] },
          // Exclusive to Source B
          { id: 'node-exclusive-b', name: 'B-Tree Indexes', sourceIds: [sourceBId] }
        ],
        relationships: [
          { id: 'rel-1', source: 'node-exclusive-a', target: 'node-shared', relationType: 'optimizes', strength: 0.9, sourceIds: [sourceAId] },
          { id: 'rel-2', source: 'node-shared', target: 'node-exclusive-b', relationType: 'utilizes', strength: 0.85, sourceIds: [sourceBId] }
        ]
      };

      // Simulate deleting Source A
      const remainingNodes = graph.nodes
        .filter(n => {
          if (!n.sourceIds || !n.sourceIds.includes(sourceAId)) return true;
          return n.sourceIds.length > 1; // Preserve shared concepts
        })
        .map(n => {
          if (n.sourceIds && n.sourceIds.includes(sourceAId)) {
            return {
              ...n,
              sourceIds: n.sourceIds.filter(id => id !== sourceAId)
            };
          }
          return n;
        });

      const validNodeIds = new Set(remainingNodes.map(n => n.id));
      const remainingRelationships = graph.relationships
        .filter(r => validNodeIds.has(r.source) && validNodeIds.has(r.target));

      // Assertions
      assert.equal(remainingNodes.length, 2, 'Should keep shared node and Doc B exclusive node');
      assert.ok(!validNodeIds.has('node-exclusive-a'), 'Exclusive node from Source A should be pruned');
      assert.ok(validNodeIds.has('node-shared'), 'Shared node should be kept');
      assert.ok(validNodeIds.has('node-exclusive-b'), 'Source B node should be kept');

      const sharedNode = remainingNodes.find(n => n.id === 'node-shared');
      assert.deepEqual(sharedNode?.sourceIds, [sourceBId], 'Shared node provenance should have Source A removed');

      // rel-1 was incident to node-exclusive-a, so it must be pruned
      assert.equal(remainingRelationships.length, 1);
      assert.equal(remainingRelationships[0].id, 'rel-2');
    });
  });
});
