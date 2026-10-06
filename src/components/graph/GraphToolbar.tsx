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
import type { SearchResultItem, GraphDensityMode, StudyFilterMode } from '../../types/graph';

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
  studyFilterMode?: StudyFilterMode;
  onStudyFilterChange?: (mode: StudyFilterMode) => void;
  needsReviewCount?: number;
  totalConceptsCount?: number;
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
  onToggleStudyPanel,
  studyFilterMode = 'all',
  onStudyFilterChange,
  needsReviewCount = 0,
  totalConceptsCount = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

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
      if (legendRef.current && !legendRef.current.contains(target)) {
        setIsLegendOpen(false);
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
      setIsLegendOpen(false);
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
                  <div className="search-item-main-row">
                    {item.practiceStatus === 'understood' ? (
                      <span className="practice-status-pip practice-pip-understood" title="Understood" aria-hidden="true" />
                    ) : item.practiceStatus === 'needs-review' ? (
                      <span className="practice-status-pip practice-pip-needs-review" title="Needs review" aria-hidden="true" />
                    ) : item.practiceStatus === 'learning' ? (
                      <span className="practice-status-pip practice-pip-learning" title="Learning" aria-hidden="true" />
                    ) : null}
                    <span className="search-item-label">{item.label}</span>
                  </div>
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

      {/* Revision Filter: ALL | NEEDS REVIEW (Phase 3 Section 12) */}
      <div className="toolbar-study-filter-group" role="group" aria-label="Study filter">
        <button
          type="button"
          className={`study-filter-btn ${studyFilterMode === 'all' ? 'active' : ''}`}
          onClick={() => onStudyFilterChange?.('all')}
          title="Show all concepts"
          aria-pressed={studyFilterMode === 'all'}
        >
          All
        </button>
        <button
          type="button"
          className={`study-filter-btn ${studyFilterMode === 'needs-review' ? 'active' : ''}`}
          onClick={() => onStudyFilterChange?.('needs-review')}
          title={needsReviewCount > 0 ? `Show ${needsReviewCount} concepts to review` : 'Nothing needs review yet'}
          aria-pressed={studyFilterMode === 'needs-review'}
        >
          <span>Needs Review</span>
          {needsReviewCount > 0 && (
            <span className="study-filter-badge">{needsReviewCount}</span>
          )}
        </button>
      </div>

      <div className="toolbar-vertical-divider" />

      {/* Study State Legend / Summary Popover (Phase 3 Section 4 & 17) */}
      <div className="toolbar-legend-wrap" ref={legendRef}>
        <button
          type="button"
          className={`canvas-action-btn toolbar-legend-btn ${isLegendOpen ? 'active' : ''}`}
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          title="Study state summary & legend"
          aria-label="Study state legend"
          aria-expanded={isLegendOpen}
        >
          <span className="toolbar-legend-label">
            {needsReviewCount > 0 ? `${needsReviewCount} to review` : 'Study State'}
          </span>
        </button>
        {isLegendOpen && (
          <div className="study-state-legend-popover" role="dialog" aria-label="Study states legend">
            <div className="legend-popover-header">
              <span className="legend-popover-title">STUDY STATE</span>
              {totalConceptsCount > 0 && (
                <span className="legend-popover-count">
                  {totalConceptsCount} {totalConceptsCount === 1 ? 'concept' : 'concepts'}
                </span>
              )}
            </div>
            <div className="legend-popover-list">
              <div className="legend-popover-row">
                <span className="practice-status-pip practice-pip-understood" aria-hidden="true" />
                <div className="legend-row-text">
                  <span className="legend-row-label">Understood</span>
                  <span className="legend-row-desc">Practiced and understood</span>
                </div>
              </div>
              <div className="legend-popover-row">
                <span className="practice-status-pip practice-pip-needs-review" aria-hidden="true" />
                <div className="legend-row-text">
                  <span className="legend-row-label">Needs Review</span>
                  <span className="legend-row-desc">Marked for review</span>
                </div>
              </div>
              <div className="legend-popover-row">
                <span className="practice-status-pip practice-pip-learning" aria-hidden="true" />
                <div className="legend-row-text">
                  <span className="legend-row-label">Learning</span>
                  <span className="legend-row-desc">Currently studying</span>
                </div>
              </div>
              <div className="legend-popover-row">
                <span className="practice-status-pip practice-pip-unseen" aria-hidden="true" />
                <div className="legend-row-text">
                  <span className="legend-row-label">Unseen</span>
                  <span className="legend-row-desc">Not yet studied</span>
                </div>
              </div>
            </div>
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
