import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Search, 
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  ImageIcon,
  FileJson,
  Download,
  Maximize,
  Minimize
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isTestMode?: boolean;
  onToggleTestMode?: () => void;
  testProgress?: { current: number; total: number } | null;
  onNextTestQuestion?: () => void;
  // Phase 5: Revision Mode
  isRevisionMode?: boolean;
  onToggleRevisionMode?: () => void;
  revisionProgress?: { current: number; total: number } | null;
  onPrevRevisionConcept?: () => void;
  onNextRevisionConcept?: () => void;
  hasPrevRevisionConcept?: boolean;
  hasNextRevisionConcept?: boolean;
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
  totalConceptsCount = 0,
  isFullscreen = false,
  onToggleFullscreen,
  isTestMode = false,
  onToggleTestMode,
  testProgress,
  onNextTestQuestion,
  isRevisionMode = false,
  onToggleRevisionMode,
  revisionProgress,
  onPrevRevisionConcept,
  onNextRevisionConcept,
  hasPrevRevisionConcept = false,
  hasNextRevisionConcept = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStudyFilterMenuOpen, setIsStudyFilterMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTransitionSettled, setIsTransitionSettled] = useState(true);
  const [showSignalRipple, setShowSignalRipple] = useState(false);
  const prevStudyPanelOpen = useRef(isStudyPanelOpen);

  const shouldReduceMotion = useReducedMotion();

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const studyFilterRef = useRef<HTMLDivElement>(null);

  // Trigger whisper-thin green signal ripple traveling across expanding toolbar on activation (Section 7)
  useEffect(() => {
    if (!prevStudyPanelOpen.current && isStudyPanelOpen) {
      setShowSignalRipple(true);
      const timer = setTimeout(() => setShowSignalRipple(false), 300);
      return () => clearTimeout(timer);
    }
    prevStudyPanelOpen.current = isStudyPanelOpen;
  }, [isStudyPanelOpen]);

  // Transition settled tracking for unclipped dropdown popovers
  useEffect(() => {
    setIsTransitionSettled(false);
    const timer = setTimeout(() => {
      setIsTransitionSettled(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [isStudyPanelOpen]);

  // Spring transition: stiffness: 440, damping: 34, mass: 0.7 (Section 17: restrained spring, near critically damped, no bounce)
  const toolbarSpringTransition = useMemo(() => {
    if (shouldReduceMotion) return { duration: 0.1 };
    return {
      type: 'spring',
      stiffness: 440,
      damping: 34,
      mass: 0.7
    } as const;
  }, [shouldReduceMotion]);

  const stripVariants = useMemo(() => ({
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
        staggerChildren: 0.045,
        staggerDirection: -1
      }
    },
    visible: {
      opacity: 1,
      transition: {
        when: 'beforeChildren',
        staggerChildren: 0.048,
        staggerDirection: 1,
        delayChildren: 0.035
      }
    }
  }), []);

  const itemVariants = useMemo(() => ({
    hidden: {
      opacity: 0,
      x: -10,
      scale: 0.98,
      transition: {
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  }), []);

  const dividerVariants = useMemo(() => ({
    hidden: {
      opacity: 0,
      scaleY: 0.5,
      transition: {
        duration: 0.16,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    visible: {
      opacity: 1,
      scaleY: 1,
      transition: {
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  }), []);

  const reducedStripVariants = useMemo(() => ({
    hidden: { opacity: 0, transition: { duration: 0.1 } },
    visible: { opacity: 1, transition: { duration: 0.1 } }
  }), []);

  const reducedItemVariants = useMemo(() => ({
    hidden: { opacity: 0, transition: { duration: 0.1 } },
    visible: { opacity: 1, transition: { duration: 0.1 } }
  }), []);

  const reducedDividerVariants = useMemo(() => ({
    hidden: { opacity: 0, transition: { duration: 0.1 } },
    visible: { opacity: 1, transition: { duration: 0.1 } }
  }), []);

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
    <motion.div 
      layout="size"
      transition={{ layout: toolbarSpringTransition }}
      className={`canvas-floating-toolbar ${isStudyPanelOpen ? 'in-study-mode' : ''}`} 
      role="toolbar" 
      aria-label="Graph controls"
    >
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

      {/* 2. STUDY ACTION OR STUDY MODE (Sections 1-7, 10, 12: Continuous Unfolding Transformation) */}
      <div className="toolbar-study-transform-wrap" role="region" aria-label="Study mode controls">
        {/* Subtle travelling green signal beam on activation (Section 7: 250-350ms, very low opacity) */}
        {showSignalRipple && !shouldReduceMotion && (
          <motion.div
            key="study-signal-beam"
            className="study-signal-beam"
            initial={{ scaleX: 0, opacity: 0.35, originX: 0 }}
            animate={{ scaleX: 1, opacity: [0.35, 0.3, 0] }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          />
        )}

        {/* Anchor button: Morphs between "Study" and "← Exit study" (Sections 1-6, 11, 19, 20) */}
        <motion.button
          layout="position"
          type="button"
          className={`toolbar-text-btn toolbar-study-anchor-btn ${isStudyPanelOpen ? 'study-exit-btn' : 'toolbar-study-trigger'}`}
          onClick={() => {
            setIsViewMenuOpen(false);
            setIsMoreMenuOpen(false);
            setIsStudyFilterMenuOpen(false);
            setIsExportMenuOpen(false);
            onToggleStudyPanel?.();
          }}
          title={isStudyPanelOpen ? "Exit study mode" : (selectedConceptLabel ? `Study ${selectedConceptLabel}` : 'Enter study mode')}
          aria-label={isStudyPanelOpen ? "Exit study mode" : "Study mode"}
          transition={shouldReduceMotion ? { duration: 0.1 } : { layout: toolbarSpringTransition }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isStudyPanelOpen ? (
              <motion.span
                key="exit-study-label"
                className="study-exit-label-wrap"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 7, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { 
                  opacity: 0, 
                  y: 7, 
                  scale: 0.97, 
                  transition: { duration: 0.22, delay: 0.1, ease: [0.22, 1, 0.36, 1] } 
                }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="study-active-indicator" aria-hidden="true" />
                <span className="study-exit-arrow" aria-hidden="true">
                  <ArrowLeft size={11.5} strokeWidth={1.8} />
                </span>
                <span className="study-exit-text">Exit study</span>
              </motion.span>
            ) : (
              <motion.span
                key="normal-study-label"
                className="study-normal-label-wrap"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.97 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1, 
                  transition: { duration: 0.26, delay: 0.12, ease: [0.16, 1, 0.3, 1] } 
                }}
                exit={shouldReduceMotion ? undefined : { 
                  opacity: 0, 
                  y: -6, 
                  scale: 0.97, 
                  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } 
                }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="toolbar-btn-text">Study</span>
                {needsReviewCount > 0 && (
                  <span className="toolbar-review-counter" title={`${needsReviewCount} concepts need review`}>
                    {needsReviewCount}
                  </span>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Emerging controls: Clipped masked reveal, staggered in, reverse out (Sections 4, 5, 6, 10) */}
        <AnimatePresence>
          {isStudyPanelOpen && (
            <motion.div
              key="study-emerging-strip"
              className={`study-emerging-strip ${isStudyFilterMenuOpen || isTransitionSettled ? 'strip-overflow-visible' : 'strip-overflow-masked'}`}
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              exit="hidden"
              variants={shouldReduceMotion ? reducedStripVariants : stripVariants}
              onAnimationComplete={() => setIsTransitionSettled(true)}
            >
              <motion.div 
                className="toolbar-vertical-divider" 
                variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
              />

              {/* Contextual Study Filter dropdown (Section 6) */}
              <motion.div 
                className="toolbar-dropdown-wrap" 
                ref={studyFilterRef}
                variants={shouldReduceMotion ? reducedItemVariants : itemVariants}
              >
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
              </motion.div>

              <motion.div 
                className="toolbar-vertical-divider" 
                variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
              />

              {/* Active Recall / Test action in Study Toolbar (Phase 4 Sections 13 & 14) */}
              <motion.button
                type="button"
                className={`toolbar-text-btn study-test-btn ${isTestMode ? 'active' : ''}`}
                onClick={onToggleTestMode}
                title={isTestMode ? "Return to concept details" : (selectedConceptLabel ? `Test yourself on ${selectedConceptLabel}` : "Test yourself")}
                aria-label={isTestMode ? "Return to concept details" : "Test yourself"}
                aria-pressed={isTestMode}
                variants={shouldReduceMotion ? reducedItemVariants : itemVariants}
              >
                <span className="toolbar-btn-text">{isTestMode ? 'Learn' : 'Test'}</span>
              </motion.button>

              <motion.div 
                className="toolbar-vertical-divider" 
                variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
              />

              {/* Revision Mode action in Study Toolbar (Phase 5 Section 1) */}
              <motion.button
                type="button"
                className={`toolbar-text-btn study-revise-btn ${isRevisionMode ? 'active' : ''}`}
                onClick={onToggleRevisionMode}
                title={isRevisionMode ? "Exit revision mode" : "Start guided exam revision through graph"}
                aria-label={isRevisionMode ? "Exit revision mode" : "Start revision"}
                aria-pressed={isRevisionMode}
                variants={shouldReduceMotion ? reducedItemVariants : itemVariants}
              >
                <span className="toolbar-btn-text">Revise</span>
              </motion.button>

              {/* If Revision Mode is active: subtle editorial progress (e.g. 04 / 12) + Prev / Next (Section 8 & 9) */}
              {isRevisionMode && revisionProgress && (
                <>
                  <motion.div 
                    className="toolbar-vertical-divider" 
                    variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
                  />
                  <div className="toolbar-revision-nav" aria-label="Revision navigation">
                    <button
                      type="button"
                      className="toolbar-text-btn toolbar-revision-nav-btn"
                      onClick={onPrevRevisionConcept}
                      disabled={!hasPrevRevisionConcept}
                      title="Previous revision concept"
                      aria-label="Previous concept in revision"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <span className="toolbar-revision-counter" aria-live="polite">
                      {String(revisionProgress.current).padStart(2, '0')} / {String(revisionProgress.total).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className="toolbar-text-btn toolbar-revision-nav-btn"
                      onClick={onNextRevisionConcept}
                      disabled={!hasNextRevisionConcept}
                      title="Next revision concept"
                      aria-label="Next concept in revision"
                    >
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </>
              )}

              {/* If Test Mode is active: subtle editorial progress (e.g. TEST 01 / 05 NEXT →) (Requirement 20) */}
              {isTestMode && testProgress && (
                <>
                  <motion.div 
                    className="toolbar-vertical-divider" 
                    variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
                  />
                  <div className="toolbar-test-nav" aria-label="Test progression">
                    <span className="toolbar-test-badge">TEST</span>
                    <span className="toolbar-test-counter" aria-live="polite">
                      {String(testProgress.current).padStart(2, '0')} / {String(testProgress.total).padStart(2, '0')}
                    </span>
                    {onNextTestQuestion && (
                      <button
                        type="button"
                        className="toolbar-text-btn toolbar-test-next-btn"
                        onClick={onNextTestQuestion}
                        title="Next test question"
                        aria-label="Next test question"
                      >
                        <span>NEXT</span>
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </>
              )}

              {!isRevisionMode && !isTestMode && (
                <>
                  <motion.div 
                    className="toolbar-vertical-divider" 
                    variants={shouldReduceMotion ? reducedDividerVariants : dividerVariants} 
                  />

                  {/* Next concept button */}
                  <motion.button
                    type="button"
                    className="toolbar-text-btn study-next-btn"
                    onClick={onNextConcept}
                    title="Next concept to study"
                    aria-label="Next concept"
                    variants={shouldReduceMotion ? reducedItemVariants : itemVariants}
                  >
                    <span className="toolbar-btn-text">Next</span>
                    <ArrowRight size={11.5} className="study-next-icon" aria-hidden="true" />
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div layout="position" className="toolbar-vertical-divider" />

      {/* 3. VIEW MODE DROPDOWN (Section 4: Replaces 3 pills with compact Balanced ▾) */}
      <motion.div layout="position" className="toolbar-dropdown-wrap" ref={viewMenuRef}>
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
      </motion.div>

      <motion.div layout="position" className="toolbar-vertical-divider" />

      {/* 4. UTILITY & EXPORT CONTROLS: [ Export ▾ ] [ ··· ] */}
      <motion.div layout="position" className="toolbar-utility-group">
        {/* Export Dropdown */}
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

              {onToggleFullscreen && (
                <button
                  type="button"
                  className="toolbar-menu-item"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onToggleFullscreen();
                  }}
                  role="menuitem"
                >
                  <span className="menu-item-left">
                    {isFullscreen ? (
                      <Minimize size={12} className="menu-item-sub-icon" aria-hidden="true" />
                    ) : (
                      <Maximize size={12} className="menu-item-sub-icon" aria-hidden="true" />
                    )}
                    <span className="menu-item-label">
                      {isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                    </span>
                  </span>
                </button>
              )}

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

        {/* 6. IMMERSIVE FULLSCREEN EXIT CONTROL (Section 7, 16, 17) */}
        {isFullscreen && onToggleFullscreen && (
          <>
            <motion.div layout="position" className="toolbar-vertical-divider" />
            <motion.button
              layout="position"
              type="button"
              className="toolbar-icon-btn toolbar-fullscreen-btn active"
              onClick={onToggleFullscreen}
              title="Exit full screen"
              aria-label="Exit full screen"
            >
              <Minimize size={14} aria-hidden="true" />
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};
