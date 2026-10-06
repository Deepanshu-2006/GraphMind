import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import { useGraph } from '../../context/GraphContext';

export interface HeaderSearchProps {
  activeGraph?: KnowledgeGraph | null;
  onSelectConcept?: (conceptId: string) => void;
  className?: string;
}

export interface ConceptSearchResult {
  id: string;
  name: string;
  category: string;
  description: string;
  connections: number;
}

function formatCategory(type?: string): string {
  if (!type) return 'Concept';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({
  activeGraph,
  onSelectConcept,
  className = ''
}) => {
  const { activeGraph: contextGraph } = useGraph();
  const graph = activeGraph !== undefined ? activeGraph : contextGraph;

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Compute connections per concept from active graph relationships
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (graph?.relationships && Array.isArray(graph.relationships)) {
      for (const rel of graph.relationships) {
        if (rel.source) {
          counts.set(rel.source, (counts.get(rel.source) || 0) + 1);
        }
        if (rel.target) {
          counts.set(rel.target, (counts.get(rel.target) || 0) + 1);
        }
      }
    }
    return counts;
  }, [graph?.relationships]);

  // Semantic concept search matching exact, prefix, word-start, partial, and description
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !graph?.nodes || graph.nodes.length === 0) {
      return [];
    }

    const matches: { item: ConceptSearchResult; tier: number }[] = [];

    for (const node of graph.nodes) {
      const nameLower = (node.name || '').toLowerCase();
      const descLower = (node.description || '').toLowerCase();
      const aliases = (node.aliases || []).map((a) => a.toLowerCase());

      let tier = -1;

      // 1. Exact name match
      if (nameLower === q) {
        tier = 1;
      }
      // 2. Prefix match
      else if (nameLower.startsWith(q)) {
        tier = 2;
      }
      // 3. Word starts with query
      else if (nameLower.split(/\s+/).some((w) => w.startsWith(q))) {
        tier = 3;
      }
      // 4. Partial name match or alias match
      else if (nameLower.includes(q) || aliases.some((a) => a.includes(q))) {
        tier = 4;
      }
      // 5. Relevant description match
      else if (descLower.includes(q)) {
        tier = 5;
      }

      if (tier !== -1) {
        const connections = connectionCounts.get(node.id) || 0;
        matches.push({
          item: {
            id: node.id,
            name: node.name,
            category: formatCategory(node.type),
            description: node.description || '',
            connections
          },
          tier
        });
      }
    }

    // Sort: Tier -> Connection count (descending) -> Alphabetical
    matches.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (b.item.connections !== a.item.connections) {
        return b.item.connections - a.item.connections;
      }
      return a.item.name.localeCompare(b.item.name);
    });

    return matches.map((m) => m.item);
  }, [query, graph?.nodes, connectionCounts]);

  // Concept selection handler
  const handleSelectConcept = useCallback((conceptId: string) => {
    if (onSelectConcept) {
      onSelectConcept(conceptId);
    }
    setQuery('');
    setIsOpen(false);
    setIsFocused(false);
    setSelectedIndex(0);
    inputRef.current?.blur();
  }, [onSelectConcept]);

  // Click outside listener to collapse search and close results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          // Toggle close if already focused
          setIsOpen(false);
          setIsFocused(false);
          inputRef.current?.blur();
        } else {
          // Activate, expand and focus
          inputRef.current?.focus();
          setIsFocused(true);
          if (query.trim().length > 0) {
            setIsOpen(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [query]);

  // Scroll active item into view within dropdown
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  const handleContainerClick = () => {
    if (document.activeElement !== inputRef.current) {
      inputRef.current?.focus();
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (query.trim().length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(0);
    if (val.trim().length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || filteredResults.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredResults[selectedIndex];
      if (selected) {
        handleSelectConcept(selected.id);
      }
    }
  };

  const hasQuery = query.trim().length > 0;
  const activeItemId = isOpen && filteredResults[selectedIndex] ? `search-item-${filteredResults[selectedIndex].id}` : undefined;

  return (
    <div
      ref={containerRef}
      className={`topbar-search-control topbar-search-trigger ${isFocused ? 'focused' : ''} ${hasQuery ? 'has-query' : ''} ${className}`}
      onClick={handleContainerClick}
      role="search"
      aria-haspopup="listbox"
    >
      {/* 14px thin search glyph, stroke 1.3px, transitions to #A8A8A8 */}
      <Search
        size={14}
        strokeWidth={1.3}
        className="topbar-search-icon"
        aria-hidden="true"
      />

      {/* Accessible real input */}
      <input
        ref={inputRef}
        type="text"
        className="topbar-search-input"
        placeholder={isFocused ? 'Search concepts…' : 'Search concepts'}
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        aria-label="Search concepts"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="header-search-results"
        aria-activedescendant={activeItemId}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Keyboard Shortcut Keycaps: Two subtle native keycaps (⌘ and K) */}
      <div className="topbar-search-shortcut" aria-hidden="true">
        <span className="topbar-search-keycap">⌘</span>
        <span className="topbar-search-keycap">K</span>
      </div>

      {/* Focus accent: 1px GraphMind green line drawing from left to right */}
      <div className="topbar-search-accent-line" aria-hidden="true" />

      {/* Search Results Dropdown Overlay */}
      {isOpen && (
        <div
          id="header-search-results"
          className="topbar-search-dropdown"
          role="listbox"
          aria-label="Matching concepts"
        >
          <div className="search-results-header">CONCEPTS</div>

          {filteredResults.length > 0 ? (
            <div ref={listRef} className="search-results-list">
              {filteredResults.slice(0, 8).map((concept, index) => {
                const isSelected = index === selectedIndex;
                const indexStr = String(index + 1).padStart(2, '0');
                const connText = `${concept.connections} ${concept.connections === 1 ? 'connection' : 'connections'}`;

                return (
                  <div
                    key={concept.id}
                    id={`search-item-${concept.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`search-result-row ${isSelected ? 'selected' : ''}`}
                    style={{ animationDelay: `${index * 24}ms` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectConcept(concept.id);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="search-result-prefix">
                      <span className="search-result-green-dot" aria-hidden="true" />
                      <span className="search-result-index">{indexStr}</span>
                    </div>
                    <div className="search-result-body">
                      <div className="search-result-title">{concept.name}</div>
                      <div className="search-result-meta">
                        {concept.category} · {connText}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="search-empty-state" role="status">
              <div className="search-empty-label">NO MATCHES</div>
              <div className="search-empty-text">
                Nothing in this graph matches &ldquo;{query.trim()}&rdquo;.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
