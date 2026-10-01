import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Maximize, 
  RotateCcw, 
  Layers, 
  Eye, 
  Minimize2, 
  LayoutGrid
} from 'lucide-react';
import type { FilterCategory, GraphLayoutMode, SearchResultItem } from '../../types/graph';

interface GraphToolbarProps {
  onSearchSelect: (nodeId: string) => void;
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  currentLayout: GraphLayoutMode;
  onLayoutChange: (layout: GraphLayoutMode) => void;
  onFitView: () => void;
  onResetView: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  availableNodes: SearchResultItem[];
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  onSearchSelect,
  activeFilter,
  onFilterChange,
  currentLayout,
  onLayoutChange,
  onFitView,
  onResetView,
  isFocusMode,
  onToggleFocusMode,
  availableNodes
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredSearchResults = availableNodes.filter(node =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (nodeId: string) => {
    onSearchSelect(nodeId);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const filterButtons: { id: FilterCategory; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'CONCEPTS', label: 'Concepts' },
    { id: 'PREREQUISITES', label: 'Prerequisites' },
    { id: 'APPLICATIONS', label: 'Applications' },
    { id: 'METHODS', label: 'Methods' }
  ];

  return (
    <div className="graph-toolbar">
      {/* Left: Concept Search & Category Filters */}
      <div className="toolbar-left">
        {/* Search */}
        <div className="graph-search-container" ref={searchRef}>
          <Search size={14} className="graph-search-icon" />
          <input
            type="text"
            className="graph-search-input"
            placeholder="Find concept in graph..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />

          {isDropdownOpen && searchQuery && (
            <div className="graph-search-dropdown">
              {filteredSearchResults.length > 0 ? (
                filteredSearchResults.map((item) => (
                  <div
                    key={item.id}
                    className="search-dropdown-item"
                    onClick={() => handleSelectResult(item.id)}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 550, color: 'var(--text-primary)' }}>
                        {item.label}
                      </div>
                      <div className="mono" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                        {item.code} • {item.category}
                      </div>
                    </div>
                    <span className="node-category-pill" style={{ fontSize: '8.5px' }}>
                      Focus
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No concept found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="toolbar-filters">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              className={`filter-pill-btn ${activeFilter === btn.id ? 'active' : ''}`}
              onClick={() => onFilterChange(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Layout Switcher, View Controls, AI Indicator, Focus Mode */}
      <div className="toolbar-right">
        {/* AI Generated Indicator */}
        <div className="ai-indicator-chip" title="Latent conceptual extraction powered by GraphMind semantic pipeline">
          <span className="ai-indicator-dot" />
          <span>AI Synapse Active</span>
        </div>

        {/* Layout Switcher */}
        <div className="toolbar-btn-group">
          <button
            className={`toolbar-btn ${currentLayout === 'hierarchical' ? 'active' : ''}`}
            onClick={() => onLayoutChange('hierarchical')}
            title="Hierarchical Tiered Layout"
          >
            <Layers size={13} />
            <span>Hierarchy</span>
          </button>
          <button
            className={`toolbar-btn ${currentLayout === 'organic' ? 'active' : ''}`}
            onClick={() => onLayoutChange('organic')}
            title="Organic Radial Layout"
          >
            <LayoutGrid size={13} />
            <span>Organic</span>
          </button>
        </div>

        {/* View Controls: Fit View, Reset, Focus Mode */}
        <div className="toolbar-btn-group">
          <button
            className="toolbar-btn"
            onClick={onFitView}
            title="Fit graph in view"
          >
            <Maximize size={13} />
            <span>Fit View</span>
          </button>

          <button
            className="toolbar-btn"
            onClick={onResetView}
            title="Reset zoom & pan position"
          >
            <RotateCcw size={13} />
          </button>

          <button
            className={`toolbar-btn ${isFocusMode ? 'active' : ''}`}
            onClick={onToggleFocusMode}
            title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode (Full Canvas)'}
          >
            {isFocusMode ? <Minimize2 size={13} /> : <Eye size={13} />}
            <span>{isFocusMode ? 'Canvas Only' : 'Focus Mode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
