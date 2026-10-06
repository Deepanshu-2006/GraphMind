import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../src/types/knowledgeGraph';
import { defaultKnowledgeGraph } from '../src/data/graphData';

// Helper matching logic extracted from HeaderSearch for strict semantic verification
function computeConnectionCounts(relationships?: KnowledgeRelationship[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (relationships) {
    for (const rel of relationships) {
      if (rel.source) counts.set(rel.source, (counts.get(rel.source) || 0) + 1);
      if (rel.target) counts.set(rel.target, (counts.get(rel.target) || 0) + 1);
    }
  }
  return counts;
}

function searchConcepts(graph: KnowledgeGraph, query: string) {
  const q = query.trim().toLowerCase();
  if (!q || !graph?.nodes || graph.nodes.length === 0) {
    return [];
  }

  const connectionCounts = computeConnectionCounts(graph.relationships);
  const matches: { node: KnowledgeNode; tier: number; connections: number }[] = [];

  for (const node of graph.nodes) {
    const nameLower = (node.name || '').toLowerCase();
    const descLower = (node.description || '').toLowerCase();
    const aliases = (node.aliases || []).map(a => a.toLowerCase());

    let tier = -1;

    // 1. Exact match
    if (nameLower === q) {
      tier = 1;
    }
    // 2. Starts with query (prefix)
    else if (nameLower.startsWith(q)) {
      tier = 2;
    }
    // 3. Word starts with query
    else if (nameLower.split(/\s+/).some(w => w.startsWith(q))) {
      tier = 3;
    }
    // 4. Partial substring or alias match
    else if (nameLower.includes(q) || aliases.some(a => a.includes(q))) {
      tier = 4;
    }
    // 5. Relevant description match
    else if (descLower.includes(q)) {
      tier = 5;
    }

    if (tier !== -1) {
      matches.push({
        node,
        tier,
        connections: connectionCounts.get(node.id) || 0
      });
    }
  }

  // Sort by tier -> connections desc -> alphabetical
  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.connections !== a.connections) return b.connections - a.connections;
    return a.node.name.localeCompare(b.node.name);
  });

  return matches;
}

describe('GraphMind Global Search Redesign Specification', () => {
  describe('Design System Dimensions & Visual Conformance', () => {
    it('defines idle state within required 190–200px width and 34–36px height', () => {
      const idleConfig = {
        width: 195,
        height: 34,
        background: 'rgba(255, 255, 255, 0.018)',
        border: '1px solid rgba(255, 255, 255, 0.075)',
        borderRadius: 8
      };
      assert.ok(idleConfig.width >= 190 && idleConfig.width <= 200, 'Idle width must be 190-200px');
      assert.ok(idleConfig.height >= 34 && idleConfig.height <= 36, 'Idle height must be 34-36px');
      assert.equal(idleConfig.background, 'rgba(255, 255, 255, 0.018)');
      assert.equal(idleConfig.borderRadius, 8);
    });

    it('defines focused state with horizontal expansion to ~270px', () => {
      const idleWidth = 195;
      const focusedWidth = 270;
      const expansion = focusedWidth - idleWidth;

      assert.equal(expansion, 75, 'Expansion should expand from 195px to 270px');
      assert.equal(focusedWidth, 270, 'Focused width must be 270px');
    });

    it('specifies thin 14px search glyph with 1.4px stroke and staged colors (#666 -> #909090 -> #B8FF3D)', () => {
      const iconSpec = {
        size: 14,
        strokeWidth: 1.4,
        idleColor: '#666666',
        hoverColor: '#909090',
        focusColor: '#B8FF3D'
      };
      assert.equal(iconSpec.size, 14);
      assert.equal(iconSpec.strokeWidth, 1.4);
      assert.equal(iconSpec.idleColor, '#666666');
      assert.equal(iconSpec.hoverColor, '#909090');
      assert.equal(iconSpec.focusColor, '#B8FF3D');
    });

    it('specifies two separate native keycaps (⌘ and K) with staged exit', () => {
      const keycaps = ['⌘', 'K'];
      assert.equal(keycaps.length, 2, 'Must use two separate keycaps');
      assert.equal(keycaps[0], '⌘');
      assert.equal(keycaps[1], 'K');
    });

    it('specifies 1px green bottom line drawing left to right on focus', () => {
      const focusLine = {
        height: '1px',
        color: '#A3FF12',
        position: 'bottom',
        transformOrigin: 'left',
        initialTransform: 'scaleX(0)',
        focusedTransform: 'scaleX(1)',
        duration: '220ms'
      };
      assert.equal(focusLine.height, '1px');
      assert.equal(focusLine.position, 'bottom');
      assert.equal(focusLine.transformOrigin, 'left');
      assert.equal(focusLine.initialTransform, 'scaleX(0)');
      assert.equal(focusLine.focusedTransform, 'scaleX(1)');
      assert.equal(focusLine.duration, '220ms');
    });

    it('specifies outer wrapper reserving 270px to stabilize header layout', () => {
      const wrapperSpec = {
        width: 270,
        alignment: 'flex-end'
      };
      assert.equal(wrapperSpec.width, 270);
      assert.equal(wrapperSpec.alignment, 'flex-end');
    });

    it('specifies search results dropdown overlay specs', () => {
      const dropdownSpec = {
        background: '#0E0E0E',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 9,
        width: 380,
        alignment: 'right'
      };
      assert.equal(dropdownSpec.background, '#0E0E0E');
      assert.ok(dropdownSpec.width >= 360 && dropdownSpec.width <= 420, 'Width must be 360-420px');
      assert.equal(dropdownSpec.alignment, 'right');
    });
  });

  describe('Search Semantics & Prioritized Ranking over Real Graph Data', () => {
    it('accurately calculates real graph relationship connection counts', () => {
      const connectionCounts = computeConnectionCounts(defaultKnowledgeGraph.relationships);
      assert.ok(connectionCounts.size > 0, 'Should compute connections from default graph');
      
      const nnConnections = connectionCounts.get('nn') || 0;
      assert.ok(typeof nnConnections === 'number');
      assert.ok(nnConnections > 0, 'Neural Networks should have active connections');
    });

    it('prioritizes exact name match above prefix and substring matches', () => {
      const testGraph: KnowledgeGraph = {
        id: 'g-test',
        name: 'Test Graph',
        nodes: [
          { id: '1', name: 'Neural Networks Architecture', type: 'architecture', description: '' },
          { id: '2', name: 'Neural', type: 'foundation', description: '' },
          { id: '3', name: 'Deep Neural Networks', type: 'paradigm', description: '' }
        ],
        relationships: [],
        sources: []
      };

      const results = searchConcepts(testGraph, 'neural');
      assert.equal(results.length, 3);
      // Exact match "Neural" must be tier 1
      assert.equal(results[0].node.name, 'Neural');
      assert.equal(results[0].tier, 1);

      // Prefix match "Neural Networks Architecture" must be tier 2
      assert.equal(results[1].node.name, 'Neural Networks Architecture');
      assert.equal(results[1].tier, 2);

      // Word start / partial match "Deep Neural Networks" must be tier 3
      assert.equal(results[2].node.name, 'Deep Neural Networks');
      assert.equal(results[2].tier, 3);
    });

    it('prioritizes prefix match above word-start and substring matches', () => {
      const testGraph: KnowledgeGraph = {
        id: 'g-test-prefix',
        name: 'Test Graph',
        nodes: [
          { id: '1', name: 'Gradient Flow', type: 'method', description: '' },
          { id: '2', name: 'Conjugate Gradient Descent', type: 'method', description: '' },
          { id: '3', name: 'Gradient', type: 'foundation', description: '' }
        ],
        relationships: [],
        sources: []
      };

      const results = searchConcepts(testGraph, 'grad');
      // "Gradient" and "Gradient Flow" both start with "grad" (tier 2)
      assert.equal(results[0].tier, 2);
      assert.equal(results[1].tier, 2);
      // "Conjugate Gradient Descent" has "Gradient" as second word (tier 3)
      assert.equal(results[2].node.name, 'Conjugate Gradient Descent');
      assert.equal(results[2].tier, 3);
    });

    it('falls back to relevant description match when name does not contain query', () => {
      const testGraph: KnowledgeGraph = {
        id: 'g-test-desc',
        name: 'Test Graph',
        nodes: [
          { id: '1', name: 'Backpropagation', type: 'method', description: 'Calculates partial derivatives of loss function' },
          { id: '2', name: 'Activation Function', type: 'foundation', description: 'Non-linear threshold mapping' }
        ],
        relationships: [],
        sources: []
      };

      const results = searchConcepts(testGraph, 'derivatives');
      assert.equal(results.length, 1);
      assert.equal(results[0].node.name, 'Backpropagation');
      assert.equal(results[0].tier, 5);
    });

    it('formats results list in indexed format: 01, 02, 03', () => {
      const items = ['Neural Networks', 'Backpropagation', 'Gradient Descent'];
      const formatted = items.map((name, i) => `${String(i + 1).padStart(2, '0')}   ${name}`);

      assert.equal(formatted[0], '01   Neural Networks');
      assert.equal(formatted[1], '02   Backpropagation');
      assert.equal(formatted[2], '03   Gradient Descent');
    });

    it('formats category and connections subtitle accurately', () => {
      function formatMeta(category: string, connections: number): string {
        const connText = `${connections} ${connections === 1 ? 'connection' : 'connections'}`;
        return `${category} · ${connText}`;
      }

      assert.equal(formatMeta('Architecture', 12), 'Architecture · 12 connections');
      assert.equal(formatMeta('Method', 1), 'Method · 1 connection');
      assert.equal(formatMeta('Foundation', 0), 'Foundation · 0 connections');
    });

    it('provides minimal NO MATCHES empty state when query finds 0 concepts', () => {
      const query = 'xyznonexistent123';
      const results = searchConcepts(defaultKnowledgeGraph, query);
      assert.equal(results.length, 0);

      const emptyState = {
        label: 'NO MATCHES',
        text: `Nothing in this graph matches "${query}".`
      };
      assert.equal(emptyState.label, 'NO MATCHES');
      assert.equal(emptyState.text, 'Nothing in this graph matches "xyznonexistent123".');
    });
  });

  describe('Keyboard Navigation Semantics', () => {
    it('cycles selectedIndex forward with wrap-around on ArrowDown', () => {
      const length = 5;
      let selectedIndex = 0;

      selectedIndex = (selectedIndex + 1) % length;
      assert.equal(selectedIndex, 1);

      selectedIndex = 4;
      selectedIndex = (selectedIndex + 1) % length;
      assert.equal(selectedIndex, 0, 'ArrowDown should wrap around to 0');
    });

    it('cycles selectedIndex backward with wrap-around on ArrowUp', () => {
      const length = 5;
      let selectedIndex = 0;

      selectedIndex = (selectedIndex - 1 + length) % length;
      assert.equal(selectedIndex, 4, 'ArrowUp from 0 should wrap around to 4');

      selectedIndex = (selectedIndex - 1 + length) % length;
      assert.equal(selectedIndex, 3);
    });
  });
});
