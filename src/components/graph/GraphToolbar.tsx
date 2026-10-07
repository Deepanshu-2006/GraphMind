import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  ImageIcon,
  FileJson,
  Download
} from 'lucide-react';
import type { SearchResultItem, GraphDensityMode, StudyFilterMode } from '../../types/graph';

export interface GraphToolbarProps {
  onSearchSelect: (nodeId: string) => void;
  onFitView: () => void;
  onResetView: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  availableNodes: SearchResultItem[];
  onExportImage: () => void;
  onExportJson: () => void;
  isExporting?: boolean;
  densityMode?: GraphDensityMode;
  onDensityChange?: (mode: GraphDensityMode) => void;
  isStudyPanelOpen?: boolean;
  selectedConceptLabel?: string | null;
  onToggleStudyPanel?: () => void;
  onNextConcept?: () => void;
  studyFilterMode?: StudyFilterMode;
  onStudyFilterChange?: (mode: StudyFilterMode) => void;
  needsReviewCount?: number;
  totalConceptsCount?: number;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  onSearchSelect,
  onFitView,
  onResetView,
  onZoomIn: _onZoomIn,
  onZoomOut: _onZoomOut,
  availableNodes,
  onExportImage,
  onExportJson,
  isExporting = false,
  densityMode = 'balanced',
  onDensityChange,
  isStudyPanelOpen = false,
  selectedConceptLabel,
  onToggleStudyPanel,
  onNextConcept,
  studyFilterMode = 'all',
  onStudyFilterChange,
  needsReviewCount = 0,
  totalConceptsCount = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStudyFilterMenuOpen, setIsStudyFilterMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const studyFilterRef = useRef<HTMLDivElement>(null);

  const filteredSearchResults = useMemo(() => {
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

  // Click outside listener for all dropdowns & popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsSearchOpen(false);
        setIsSearchFocused(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(target)) {
        setIsViewMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
      if (studyFilterRef.current && !studyFilterRef.current.contains(target)) {
        setIsStudyFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const activeEl = document.activeElement;
        // Don't hijack if user is typing in another input (unless it's already this one)
        if (activeEl?.tagName === 'INPUT' && activeEl !== searchInputRef.current) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleContainerClick = () => {
    searchInputRef.current?.focus();
  };

  const handleSelectResult = (nodeId: string) => {
    onSearchSelect(nodeId);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      setIsSearchOpen(false);
      setIsSearchFocused(false);
      setIsViewMenuOpen(false);
      setIsMoreMenuOpen(false);
      setIsStudyFilterMenuOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const viewModeLabel = densityMode.charAt(0).toUpperCase() + densityMode.slice(1);

  const getStudyFilterLabel = () => {
    if (studyFilterMode === 'needs-review') {
      return needsReviewCount > 0 ? `${needsReviewCount} to review` : 'Needs review';
    }
    if (studyFilterMode === 'in-progress') return 'In progress';
    if (studyFilterMode === 'studied') return 'Studied';
    return 'All';
  };

  return (
    <div className="canvas-floating-toolbar" role="toolbar" aria-label="Graph controls">
      {/* 1. PRIMARY SEARCH CONTROL (Same as topbar searchbar) */}
      <div 
        className={`topbar-search-control floating-search-wrap ${isSearchFocused ? 'focused' : ''} ${searchQuery.trim() ? 'has-query' : ''}`}
        ref={searchRef}
        onClick={handleContainerClick}
        role="search"
        aria-haspopup="listbox"
      >
        <Search
          size={14}
          strokeWidth={1.4}
          className="topbar-search-icon floating-search-icon"
          aria-hidden="true"
        />
        <input
          ref={searchInputRef}
          type="text"
          className="topbar-search-input floating-search-input"
          placeholder="Search concepts"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
            setIsSearchOpen(true);
          }}
          onFocus={() => {
            setIsSearchFocused(true);
            if (searchQuery.trim()) {
              setIsSearchOpen(true);
            }
          }}
          onBlur={() => {
            setIsSearchFocused(false);
          }}
          onKeyDown={handleSearchKeyDown}
          aria-label="Search concepts"
          role="combobox"
          aria-expanded={isSearchOpen}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="topbar-search-shortcut" aria-hidden="true">
          <span className="topbar-search-keycap">⌘</span>
          <span className="topbar-search-keycap">K</span>
        </div>

        <div className="topbar-search-focus-line" aria-hidden="true" />

        {isSearchOpen && searchQuery.trim() && (
          <div
            id="toolbar-search-results"
            className="topbar-search-dropdown floating-search-dropdown"
            role="listbox"
            aria-label="Matching concepts"
          >
            <div className="search-results-header">CONCEPTS</div>

            {filteredSearchResults.length > 0 ? (
              <div className="search-results-list">
                {filteredSearchResults.slice(0, 8).map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const indexStr = String(index + 1).padStart(2, '0');

                  return (
                    <div
                      key={item.id}
                      id={`toolbar-search-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`search-result-row ${isSelected ? 'selected' : ''}`}
                      style={{ animationDelay: `${index * 24}ms` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectResult(item.id);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="search-result-prefix">
                        {item.practiceStatus === 'understood' ? (
                          <span className="practice-status-pip practice-pip-understood" title="Understood" aria-hidden="true" />
                        ) : item.practiceStatus === 'needs-review' ? (
                          <span className="practice-status-pip practice-pip-needs-review" title="Needs review" aria-hidden="true" />
                        ) : item.practiceStatus === 'learning' ? (
                          <span className="practice-status-pip practice-pip-learning" title="Learning" aria-hidden="true" />
                        ) : (
                          <span className="search-result-green-dot" aria-hidden="true" />
                        )}
                        <span className="search-result-index">{indexStr}</span>
                      </div>
                      <div className="search-result-body">
                        <div className="search-result-title">{item.label}</div>
                        <div className="search-result-meta">{item.category}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="search-empty-state" role="status">
                <div className="search-empty-label">NO MATCHES</div>
                <div className="search-empty-text">
                  Nothing in this graph matches &ldquo;{searchQuery.trim()}&rdquo;.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-vertical-divider" />

      {/* 2. STUDY ACTION OR STUDY MODE (Section 3: Study as a mode, not a filter pill) */}
      {!isStudyPanelOpen ? (
        <button
          type="button"
          className="toolbar-text-btn toolbar-study-trigger"
          onClick={onToggleStudyPanel}
          title={selectedConceptLabel ? `Study ${selectedConceptLabel}` : 'Enter study mode'}
          aria-label="Study mode"
        >
          <span className="toolbar-btn-text">Study</span>
          {needsReviewCount > 0 && (
            <span className="toolbar-review-counter" title={`${needsReviewCount} concepts need review`}>
              {needsReviewCount}
            </span>
          )}
        </button>
      ) : (
        /* Active Study Mode: ← Exit study | Filter selector | Next → */
        <div className="toolbar-study-mode-container" role="region" aria-label="Study mode controls">
          <button
            type="button"
            className="toolbar-text-btn study-exit-btn"
            onClick={onToggleStudyPanel}
            title="Exit study mode"
            aria-label="Exit study mode"
          >
            <ArrowLeft size={12} className="study-exit-icon" aria-hidden="true" />
            <span className="toolbar-btn-text">Exit study</span>
          </button>

          <div className="toolbar-vertical-divider" />

          {/* Contextual Study Filter dropdown (Section 6) */}
          <div className="toolbar-dropdown-wrap" ref={studyFilterRef}>
            <button
              type="button"
              className={`toolbar-text-btn study-filter-trigger ${isStudyFilterMenuOpen ? 'active' : ''}`}
              onClick={() => {
                setIsStudyFilterMenuOpen(prev => !prev);
                setIsViewMenuOpen(false);
                setIsMoreMenuOpen(false);
                setIsExportMenuOpen(false);
              }}
              title="Filter study concepts"
              aria-label="Study filter"
              aria-haspopup="menu"
              aria-expanded={isStudyFilterMenuOpen}
            >
              <span className="toolbar-btn-text">{getStudyFilterLabel()}</span>
              <ChevronDown size={11} className={`toolbar-chevron ${isStudyFilterMenuOpen ? 'open' : ''}`} aria-hidden="true" />
            </button>

            {isStudyFilterMenuOpen && (
              <div className="toolbar-menu-popover study-filter-popover" role="menu">
                <div className="menu-section-header">STUDY FILTER</div>
                
                <button
                  type="button"
                  className={`toolbar-menu-item ${studyFilterMode === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    onStudyFilterChange?.('all');
                    setIsStudyFilterMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {studyFilterMode === 'all' && <span className="menu-active-dot" aria-hidden="true" />}
                    <span className="menu-item-label">All</span>
                  </span>
                  {totalConceptsCount > 0 && <span className="menu-item-count">{totalConceptsCount}</span>}
                </button>

                <button
                  type="button"
                  className={`toolbar-menu-item ${studyFilterMode === 'needs-review' ? 'active' : ''}`}
                  onClick={() => {
                    onStudyFilterChange?.('needs-review');
                    setIsStudyFilterMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {studyFilterMode === 'needs-review' && <span className="menu-active-dot" aria-hidden="true" />}
                    <span className="practice-status-pip practice-pip-needs-review" aria-hidden="true" />
                    <span className="menu-item-label">Needs review</span>
                  </span>
                  {needsReviewCount > 0 && <span className="menu-item-count review-count">{needsReviewCount}</span>}
                </button>

                <button
                  type="button"
                  className={`toolbar-menu-item ${studyFilterMode === 'in-progress' ? 'active' : ''}`}
                  onClick={() => {
                    onStudyFilterChange?.('in-progress');
                    setIsStudyFilterMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {studyFilterMode === 'in-progress' && <span className="menu-active-dot" aria-hidden="true" />}
                    <span className="practice-status-pip practice-pip-learning" aria-hidden="true" />
                    <span className="menu-item-label">In progress</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`toolbar-menu-item ${studyFilterMode === 'studied' ? 'active' : ''}`}
                  onClick={() => {
                    onStudyFilterChange?.('studied');
                    setIsStudyFilterMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {studyFilterMode === 'studied' && <span className="menu-active-dot" aria-hidden="true" />}
                    <span className="practice-status-pip practice-pip-understood" aria-hidden="true" />
                    <span className="menu-item-label">Studied</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="toolbar-vertical-divider" />

          {/* Next concept button */}
          <button
            type="button"
            className="toolbar-text-btn study-next-btn"
            onClick={onNextConcept}
            title="Next concept to study"
            aria-label="Next concept"
          >
            <span className="toolbar-btn-text">Next</span>
            <ArrowRight size={12} className="study-next-icon" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="toolbar-vertical-divider" />

      {/* 3. VIEW MODE DROPDOWN (Section 4: Replaces 3 pills with compact Balanced ▾) */}
      <div className="toolbar-dropdown-wrap" ref={viewMenuRef}>
        <button
          type="button"
          className={`toolbar-text-btn toolbar-view-trigger ${isViewMenuOpen ? 'active' : ''}`}
          onClick={() => {
            setIsViewMenuOpen(prev => !prev);
            setIsMoreMenuOpen(false);
            setIsStudyFilterMenuOpen(false);
            setIsExportMenuOpen(false);
          }}
          title={`Graph density: ${viewModeLabel}`}
          aria-label="View mode"
          aria-haspopup="menu"
          aria-expanded={isViewMenuOpen}
        >
          <span className="toolbar-btn-text">{viewModeLabel}</span>
          <ChevronDown size={11} className={`toolbar-chevron ${isViewMenuOpen ? 'open' : ''}`} aria-hidden="true" />
        </button>

        {isViewMenuOpen && (
          <div className="toolbar-menu-popover view-mode-popover" role="menu">
            {(['focused', 'balanced', 'expanded'] as GraphDensityMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`toolbar-menu-item ${densityMode === mode ? 'active' : ''}`}
                onClick={() => {
                  onDensityChange?.(mode);
                  setIsViewMenuOpen(false);
                }}
                role="menuitem"
              >
                <span className="menu-item-left">
                  {densityMode === mode && <span className="menu-active-dot" aria-hidden="true" />}
                  <span className="menu-item-label">
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-vertical-divider" />

      {/* 4. UTILITY & EXPORT CONTROLS: [ Export ▾ ] [ ··· ] */}
      <div className="toolbar-utility-group">
        {/* Export Dropdown (Replaces redundant - + ⛶ which are positioned in the bottom-right corner) */}
        <div className="toolbar-dropdown-wrap" ref={exportMenuRef}>
          <button
            type="button"
            className={`toolbar-text-btn toolbar-export-trigger ${isExportMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setIsExportMenuOpen(prev => !prev);
              setIsViewMenuOpen(false);
              setIsStudyFilterMenuOpen(false);
              setIsMoreMenuOpen(false);
            }}
            title="Export options"
            aria-label="Export options"
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
            disabled={isExporting}
          >
            <Download size={13} className="toolbar-export-icon" aria-hidden="true" />
            <span className="toolbar-btn-text">{isExporting ? 'Exporting…' : 'Export'}</span>
            <ChevronDown size={11} className={`toolbar-chevron ${isExportMenuOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>

          {isExportMenuOpen && (
            <div className="toolbar-menu-popover export-menu-popover" role="menu">
              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportImage();
                }}
                role="menuitem"
                disabled={isExporting}
              >
                <span className="menu-item-left">
                  <ImageIcon size={12} className="menu-item-sub-icon" aria-hidden="true" />
                  <span className="menu-item-label">{isExporting ? 'Exporting image…' : 'Export image (PNG)'}</span>
                </span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportJson();
                }}
                role="menuitem"
              >
                <span className="menu-item-left">
                  <FileJson size={12} className="menu-item-sub-icon" aria-hidden="true" />
                  <span className="menu-item-label">Export JSON</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 5. SECONDARY MENU (Section 5: ··· opens minimal menu with View, Fit, Reset, Export) */}
        <div className="toolbar-dropdown-wrap" ref={moreMenuRef}>
          <button
            type="button"
            className={`toolbar-icon-btn toolbar-more-btn ${isMoreMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setIsMoreMenuOpen(prev => !prev);
              setIsViewMenuOpen(false);
              setIsStudyFilterMenuOpen(false);
              setIsExportMenuOpen(false);
            }}
            title="More canvas actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={isMoreMenuOpen}
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </button>

          {isMoreMenuOpen && (
            <div className="toolbar-menu-popover canvas-more-popover" role="menu">
              <div className="menu-section-header">VIEW</div>
              {(['focused', 'balanced', 'expanded'] as GraphDensityMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`toolbar-menu-item ${densityMode === mode ? 'active' : ''}`}
                  onClick={() => {
                    onDensityChange?.(mode);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {densityMode === mode && <span className="menu-active-dot" aria-hidden="true" />}
                    <span className="menu-item-label">
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </span>
                  </span>
                </button>
              ))}

              <div className="menu-divider" />

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onFitView();
                }}
                role="menuitem"
              >
                <span className="menu-item-label">Fit graph</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onResetView();
                }}
                role="menuitem"
              >
                <span className="menu-item-label">Reset view</span>
              </button>

              <div className="menu-divider" />

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onExportImage();
                }}
                role="menuitem"
                disabled={isExporting}
              >
                <span className="menu-item-left">
                  <ImageIcon size={12} className="menu-item-sub-icon" aria-hidden="true" />
                  <span className="menu-item-label">{isExporting ? 'Exporting image…' : 'Export image'}</span>
                </span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onExportJson();
                }}
                role="menuitem"
              >
                <span className="menu-item-left">
                  <FileJson size={12} className="menu-item-sub-icon" aria-hidden="true" />
                  <span className="menu-item-label">Export JSON</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
