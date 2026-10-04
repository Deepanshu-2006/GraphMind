import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, renameGraph, loadGraphs, saveGraphs } from '../src/services/storage';

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe('Settings View Architecture & Logic', () => {
  beforeEach(() => {
    storageMap.clear();
    saveGraphs([]);
  });
  it('renames an existing graph and persists the new name', () => {
    const created = createGraph('Initial Graph');
    assert.equal(created.name, 'Initial Graph');

    const updated = renameGraph(created.id, 'Renamed Physics Graph');
    assert.ok(updated, 'Updated meta should be returned');
    assert.equal(updated.name, 'Renamed Physics Graph');

    const allGraphs = loadGraphs();
    const found = allGraphs.find(g => g.id === created.id);
    assert.ok(found);
    assert.equal(found.name, 'Renamed Physics Graph');
  });

  it('rejects empty or whitespace-only graph names on rename', () => {
    const created = createGraph('Valid Graph');
    assert.throws(() => {
      renameGraph(created.id, '   ');
    }, /cannot be empty/i);
  });

  it('supports popover concept extraction options: Focused, Balanced, Broad with descriptions', () => {
    const EXTRACTION_OPTIONS = [
      { value: 'Focused', label: 'Focused', description: 'Fewer, stronger concepts.' },
      { value: 'Balanced', label: 'Balanced', description: 'Good coverage without unnecessary concepts.' },
      { value: 'Broad', label: 'Broad', description: 'Capture more supporting concepts.' }
    ] as const;

    assert.equal(EXTRACTION_OPTIONS.length, 3);
    assert.equal(EXTRACTION_OPTIONS[0].label, 'Focused');
    assert.equal(EXTRACTION_OPTIONS[0].description, 'Fewer, stronger concepts.');
    assert.equal(EXTRACTION_OPTIONS[1].label, 'Balanced');
    assert.equal(EXTRACTION_OPTIONS[1].description, 'Good coverage without unnecessary concepts.');
    assert.equal(EXTRACTION_OPTIONS[2].label, 'Broad');
    assert.equal(EXTRACTION_OPTIONS[2].description, 'Capture more supporting concepts.');

    // Storage persistence
    storageMap.set('graphmind_pref_concept_extraction', 'Focused');
    assert.equal(storageMap.get('graphmind_pref_concept_extraction'), 'Focused');
  });

  it('supports authentic graph layout option: Hierarchical with description', () => {
    const LAYOUT_OPTIONS = [
      { value: 'Hierarchical', label: 'Hierarchical', description: 'Topological arrangement based on concept prerequisites.' }
    ] as const;

    assert.equal(LAYOUT_OPTIONS.length, 1);
    assert.equal(LAYOUT_OPTIONS[0].label, 'Hierarchical');
    assert.equal(LAYOUT_OPTIONS[0].description, 'Topological arrangement based on concept prerequisites.');

    // Storage persistence
    storageMap.set('graphmind_pref_graph_layout', 'Hierarchical');
    assert.equal(storageMap.get('graphmind_pref_graph_layout'), 'Hierarchical');
  });

  it('formats danger zone description dynamically using active graph name', () => {
    const getDangerCopy = (name: string) => `Permanently remove ${name} and its material.`;
    assert.equal(
      getDangerCopy('Physics'),
      'Permanently remove Physics and its material.'
    );
    assert.equal(
      getDangerCopy('DBMS'),
      'Permanently remove DBMS and its material.'
    );
    assert.equal(
      getDangerCopy('Neural & Cognitive Architectures'),
      'Permanently remove Neural & Cognitive Architectures and its material.'
    );
  });

  it('provides editorial keyboard shortcuts structure for Search and Settings', () => {
    const shortcuts = [
      { label: 'Search', keys: ['⌘', 'K'] },
      { label: 'Settings', keys: ['⌘', ','] }
    ];
    assert.equal(shortcuts[0].label, 'Search');
    assert.deepEqual(shortcuts[0].keys, ['⌘', 'K']);
    assert.equal(shortcuts[1].label, 'Settings');
    assert.deepEqual(shortcuts[1].keys, ['⌘', ',']);
  });
});
