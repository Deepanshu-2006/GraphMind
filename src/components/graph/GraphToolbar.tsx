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
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredSearchResults = availableNodes.filter(node =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.category.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="canvas-floating-toolbar" role="toolbar" aria-label="Graph controls">
      {/* Optional Search */}
      <div className="floating-search-wrap" ref={searchRef}>
        <Search size={13} className="floating-search-icon" />
        <input
          type="text"
          className="floating-search-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          aria-label="Search concepts"
        />

        {isDropdownOpen && searchQuery && (
          <div className="floating-search-dropdown">
            {filteredSearchResults.length > 0 ? (
              filteredSearchResults.map((item) => (
                <div
                  key={item.id}
                  className="floating-search-item"
                  onClick={() => handleSelectResult(item.id)}
                >
                  <span className="search-item-label">{item.label}</span>
                  <span className="search-item-category">{item.category}</span>
                </div>
              ))
            ) : (
              <div className="floating-search-empty">No concepts found</div>
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
