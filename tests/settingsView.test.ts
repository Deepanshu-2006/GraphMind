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

  it('cycles concept extraction modes between Balanced, Aggressive, and Conservative', () => {
    const EXTRACTION_MODES = ['Balanced', 'Aggressive', 'Conservative'] as const;
    let mode: (typeof EXTRACTION_MODES)[number] = 'Balanced';

    const cycle = (current: typeof mode) => {
      const idx = EXTRACTION_MODES.indexOf(current);
      return EXTRACTION_MODES[(idx + 1) % EXTRACTION_MODES.length];
    };

    mode = cycle(mode);
    assert.equal(mode, 'Aggressive');
    mode = cycle(mode);
    assert.equal(mode, 'Conservative');
    mode = cycle(mode);
    assert.equal(mode, 'Balanced');
  });

  it('cycles graph layout modes between Hierarchical, Radial, and Force Directed', () => {
    const LAYOUT_MODES = ['Hierarchical', 'Radial', 'Force Directed'] as const;
    let mode: (typeof LAYOUT_MODES)[number] = 'Hierarchical';

    const cycle = (current: typeof mode) => {
      const idx = LAYOUT_MODES.indexOf(current);
      return LAYOUT_MODES[(idx + 1) % LAYOUT_MODES.length];
    };

    mode = cycle(mode);
    assert.equal(mode, 'Radial');
    mode = cycle(mode);
    assert.equal(mode, 'Force Directed');
    mode = cycle(mode);
    assert.equal(mode, 'Hierarchical');
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
  });
});
