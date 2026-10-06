import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Maximize, 
  RotateCcw, 
  Plus, 
  Minus,
  Download,
  Image as ImageIcon,
  FileJson
} from 'lucide-react';
import type { SearchResultItem, GraphDensityMode } from '../../types/graph';

interface GraphToolbarProps {
  onSearchSelect: (nodeId: string) => void;
  onFitView: () => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  availableNodes: SearchResultItem[];
  onExportImage: () => void;
  onExportJson: () => void;
  isExporting?: boolean;
  densityMode?: GraphDensityMode;
  onDensityChange?: (mode: GraphDensityMode) => void;
  isStudyPanelOpen?: boolean;
  selectedConceptLabel?: string | null;
  onToggleStudyPanel?: () => void;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  onSearchSelect,
  onFitView,
  onResetView,
  onZoomIn,
  onZoomOut,
  availableNodes,
  onExportImage,
  onExportJson,
  isExporting = false,
  densityMode = 'balanced',
  onDensityChange,
  isStudyPanelOpen = false,
  selectedConceptLabel,
  onToggleStudyPanel
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

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
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setIsExportOpen(false);
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
      setIsExportOpen(false);
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

      {/* Lightweight Graph Density Control (Focused | Balanced | Expanded) */}
      <div className="toolbar-density-pill-group" role="group" aria-label="Graph density control">
        <button
          type="button"
          className={`density-pill-btn ${densityMode === 'focused' ? 'active' : ''}`}
          onClick={() => onDensityChange?.('focused')}
          title="Focused: Show selected concept and immediate neighborhood"
          aria-pressed={densityMode === 'focused'}
        >
          Focused
        </button>
        <button
          type="button"
          className={`density-pill-btn ${densityMode === 'balanced' ? 'active' : ''}`}
          onClick={() => onDensityChange?.('balanced')}
          title="Balanced: Curated overview of major concepts across the graph"
          aria-pressed={densityMode === 'balanced'}
        >
          Balanced
        </button>
        <button
          type="button"
          className={`density-pill-btn ${densityMode === 'expanded' ? 'active' : ''}`}
          onClick={() => onDensityChange?.('expanded')}
          title="Expanded: Reveal more of the underlying graph"
          aria-pressed={densityMode === 'expanded'}
        >
          Expanded
        </button>
      </div>

      {onToggleStudyPanel && (
        <>
          <div className="toolbar-vertical-divider" />
          <button
            type="button"
            className={`canvas-action-btn toolbar-study-btn ${isStudyPanelOpen ? 'active' : ''}`}
            onClick={onToggleStudyPanel}
            title={isStudyPanelOpen ? 'Close study panel' : `Study ${selectedConceptLabel || 'concept'}`}
            aria-label="Study mode"
            aria-pressed={isStudyPanelOpen}
          >
            <span className={`study-status-dot ${isStudyPanelOpen ? 'active' : ''}`} aria-hidden="true" />
            <span className="study-btn-label">Study</span>
          </button>
        </>
      )}

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

      <div className="toolbar-vertical-divider" />

      {/* Export Menu (Prompt 27: small menu with Export image and Export JSON) */}
      <div className="toolbar-export-wrap" ref={exportRef}>
        <button
          type="button"
          className={`canvas-action-btn export-trigger-btn ${isExportOpen ? 'active' : ''}`}
          onClick={() => setIsExportOpen(prev => !prev)}
          title="Export graph"
          aria-label="Export graph"
          aria-haspopup="menu"
          aria-expanded={isExportOpen}
          disabled={isExporting}
        >
          <Download size={13} aria-hidden="true" />
          <span className="export-btn-label">{isExporting ? 'Exporting…' : 'Export'}</span>
        </button>

        {isExportOpen && (
          <div className="export-dropdown-menu" role="menu">
            <button
              type="button"
              className="export-dropdown-item"
              onClick={() => {
                setIsExportOpen(false);
                onExportImage();
              }}
              role="menuitem"
            >
              <ImageIcon size={13} className="export-item-icon" aria-hidden="true" />
              <span>Export image</span>
            </button>
            <button
              type="button"
              className="export-dropdown-item"
              onClick={() => {
                setIsExportOpen(false);
                onExportJson();
              }}
              role="menuitem"
            >
              <FileJson size={13} className="export-item-icon" aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
