import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Maximize, 
  RotateCcw, 
  Plus, 
  Minus
} from 'lucide-react';
import type { SearchResultItem } from '../../types/graph';

interface GraphToolbarProps {
  onSearchSelect: (nodeId: string) => void;
  onFitView: () => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  availableNodes: SearchResultItem[];
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  onSearchSelect,
  onFitView,
  onResetView,
  onZoomIn,
  onZoomOut,
  availableNodes
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredSearchResults = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return availableNodes
      .filter(node =>
        node.label.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aName = a.label.toLowerCase();
        const bName = b.label.toLowerCase();
        if (aName === q && bName !== q) return -1;
        if (aName !== q && bName === q) return 1;
        if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
        if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [availableNodes, searchQuery]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredSearchResults.length > 0 ? (prev + 1) % filteredSearchResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredSearchResults.length > 0 ? (prev - 1 + filteredSearchResults.length) % filteredSearchResults.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSearchResults[selectedIndex]) {
        handleSelectResult(filteredSearchResults[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="canvas-floating-toolbar" role="toolbar" aria-label="Graph controls">
      {/* Search concepts */}
      <div className="floating-search-wrap" ref={searchRef}>
        <Search size={13} className="floating-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="floating-search-input"
          placeholder="Search concepts"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
            setIsDropdownOpen(true);
          }}
          onFocus={() => {
            if (searchQuery.trim()) {
              setIsDropdownOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search concepts"
          role="combobox"
          aria-expanded={isDropdownOpen}
        />

        {isDropdownOpen && searchQuery.trim() && (
          <div className="floating-search-dropdown" role="listbox">
            {filteredSearchResults.length > 0 ? (
              filteredSearchResults.map((item, idx) => (
                <div
                  key={item.id}
                  className={`floating-search-item ${idx === selectedIndex ? 'active' : ''}`}
                  onClick={() => handleSelectResult(item.id)}
                  role="option"
                  aria-selected={idx === selectedIndex}
                >
                  <span className="search-item-label">{item.label}</span>
                  <span className="search-item-category">{item.category}</span>
                </div>
              ))
            ) : (
              <div className="floating-search-empty" role="status">No concepts found.</div>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-vertical-divider" />

      {/* Navigation Controls: Zoom In, Zoom Out, Fit, Reset */}
      <div className="toolbar-actions-group">
        <button
          type="button"
          className="canvas-action-btn"
          onClick={onZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="canvas-action-btn"
          onClick={onZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="canvas-action-btn"
          onClick={onFitView}
          title="Fit to view"
          aria-label="Fit graph to view"
        >
          <Maximize size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="canvas-action-btn"
          onClick={onResetView}
          title="Reset view"
          aria-label="Reset view"
        >
          <RotateCcw size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
