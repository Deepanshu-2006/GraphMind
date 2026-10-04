import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGraph } from '../../context/GraphContext';

export interface SettingsViewProps {
  onOpenDeleteModal: () => void;
}

export type ConceptExtractionMode = 'Focused' | 'Balanced' | 'Broad';
export type GraphLayoutMode = 'Hierarchical';

interface ExtractionOption {
  value: ConceptExtractionMode;
  label: string;
  description: string;
}

interface LayoutOption {
  value: GraphLayoutMode;
  label: string;
  description: string;
}

const EXTRACTION_OPTIONS: ExtractionOption[] = [
  {
    value: 'Focused',
    label: 'Focused',
    description: 'Fewer, stronger concepts.'
  },
  {
    value: 'Balanced',
    label: 'Balanced',
    description: 'Good coverage without unnecessary concepts.'
  },
  {
    value: 'Broad',
    label: 'Broad',
    description: 'Capture more supporting concepts.'
  }
];

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    value: 'Hierarchical',
    label: 'Hierarchical',
    description: 'Topological arrangement based on concept prerequisites.'
  }
];

function formatGraphDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return null;
  }
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenDeleteModal }) => {
  const { activeGraphMeta, renameGraph } = useGraph();

  // Settings State with localStorage persistence
  const [conceptExtraction, setConceptExtraction] = useState<ConceptExtractionMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('graphmind_pref_concept_extraction');
      if (stored === 'Focused' || stored === 'Balanced' || stored === 'Broad') {
        return stored;
      }
    }
    return 'Balanced';
  });

  const [graphLayout, setGraphLayout] = useState<GraphLayoutMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('graphmind_pref_graph_layout');
      if (stored === 'Hierarchical') {
        return stored;
      }
    }
    return 'Hierarchical';
  });

  // Active Popover State
  const [openPopover, setOpenPopover] = useState<'extraction' | 'layout' | null>(null);
  const extractionCellRef = useRef<HTMLDivElement>(null);
  const layoutCellRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside or Escape
  useEffect(() => {
    if (!openPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        openPopover === 'extraction' &&
        extractionCellRef.current &&
        !extractionCellRef.current.contains(target)
      ) {
        setOpenPopover(null);
      } else if (
        openPopover === 'layout' &&
        layoutCellRef.current &&
        !layoutCellRef.current.contains(target)
      ) {
        setOpenPopover(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPopover(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPopover]);

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState(activeGraphMeta?.name || '');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Close rename on Escape
  useEffect(() => {
    if (!isRenaming) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRenaming(false);
        setRenameError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRenaming]);

  const handleSelectExtraction = useCallback((mode: ConceptExtractionMode) => {
    setConceptExtraction(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('graphmind_pref_concept_extraction', mode);
    }
    setOpenPopover(null);
  }, []);

  const handleSelectLayout = useCallback((mode: GraphLayoutMode) => {
    setGraphLayout(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('graphmind_pref_graph_layout', mode);
    }
    setOpenPopover(null);
  }, []);

  const handleStartRename = useCallback(() => {
    setRenameInput(activeGraphMeta?.name || '');
    setRenameError(null);
    setIsRenaming(true);
  }, [activeGraphMeta]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameError(null);
  }, []);

  const handleSaveRename = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGraphMeta) return;

    const trimmed = renameInput.trim();
    if (!trimmed) {
      setRenameError('Graph name cannot be empty.');
      return;
    }
    if (trimmed.length > 100) {
      setRenameError('Graph name must be 100 characters or less.');
      return;
    }

    try {
      renameGraph(activeGraphMeta.id, trimmed);
      setIsRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename graph.');
    }
  }, [activeGraphMeta, renameInput, renameGraph]);

  const graphName = activeGraphMeta?.name || 'Knowledge Graph';
  const createdDate = formatGraphDate(activeGraphMeta?.createdAt);

  return (
    <div className="settings-page-wrapper">
      <div className="settings-editorial-canvas">
        {/* Left Column: Visual Anchor & Identity */}
        <aside className="settings-anchor-col">
          <div className="settings-anchor-sticky">
            <span className="settings-anchor-kicker">SETTINGS</span>
            <h1 className="settings-anchor-title">Settings</h1>
            <p className="settings-anchor-desc">
              Control how GraphMind builds and presents your knowledge.
            </p>
          </div>
        </aside>

        {/* Right Column: Settings Chapters */}
        <main className="settings-content-col">
          {/* Chapter 1: GRAPH */}
          <section className="settings-chapter" aria-labelledby="chapter-graph">
            <header className="settings-chapter-header">
              <span className="settings-chapter-kicker" id="chapter-graph">GRAPH</span>
            </header>

            <div className="settings-chapter-body">
              {/* Setting 1: Concept extraction */}
              <div className="settings-entry">
                <div className="settings-entry-meta">
                  <span className="settings-entry-title">Concept extraction</span>
                  <p className="settings-entry-desc">
                    How aggressively GraphMind identifies concepts.
                  </p>
                </div>
                <div className="settings-entry-control" ref={extractionCellRef}>
                  <button
                    type="button"
                    className="settings-action-trigger"
                    onClick={() => setOpenPopover(prev => prev === 'extraction' ? null : 'extraction')}
                    id="setting-concept-extraction"
                    aria-haspopup="true"
                    aria-expanded={openPopover === 'extraction'}
                    title="Select concept extraction aggressiveness"
                  >
                    <span className="trigger-val">{conceptExtraction}</span>
                    <span className="trigger-arr" aria-hidden="true">→</span>
                  </button>

                  {openPopover === 'extraction' && (
                    <div className="settings-popover" role="menu" aria-label="Concept extraction options">
                      {EXTRACTION_OPTIONS.map(opt => {
                        const isSelected = opt.value === conceptExtraction;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className="settings-popover-item"
                            onClick={() => handleSelectExtraction(opt.value)}
                            role="menuitemradio"
                            aria-checked={isSelected}
                          >
                            <div className="settings-popover-dot-wrap" aria-hidden="true">
                              {isSelected && <span className="settings-popover-dot" />}
                            </div>
                            <div className="settings-popover-content">
                              <span className="settings-popover-label">{opt.label}</span>
                              <span className="settings-popover-desc">{opt.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Setting 2: Graph layout (Separated by vertical rhythm, NO horizontal rule) */}
              <div className="settings-entry">
                <div className="settings-entry-meta">
                  <span className="settings-entry-title">Graph layout</span>
                  <p className="settings-entry-desc">
                    How concepts are arranged in the canvas.
                  </p>
                </div>
                <div className="settings-entry-control" ref={layoutCellRef}>
                  <button
                    type="button"
                    className="settings-action-trigger"
                    onClick={() => setOpenPopover(prev => prev === 'layout' ? null : 'layout')}
                    id="setting-graph-layout"
                    aria-haspopup="true"
                    aria-expanded={openPopover === 'layout'}
                    title="Select graph layout"
                  >
                    <span className="trigger-val">{graphLayout}</span>
                    <span className="trigger-arr" aria-hidden="true">→</span>
                  </button>

                  {openPopover === 'layout' && (
                    <div className="settings-popover" role="menu" aria-label="Graph layout options">
                      {LAYOUT_OPTIONS.map(opt => {
                        const isSelected = opt.value === graphLayout;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className="settings-popover-item"
                            onClick={() => handleSelectLayout(opt.value)}
                            role="menuitemradio"
                            aria-checked={isSelected}
                          >
                            <div className="settings-popover-dot-wrap" aria-hidden="true">
                              {isSelected && <span className="settings-popover-dot" />}
                            </div>
                            <div className="settings-popover-content">
                              <span className="settings-popover-label">{opt.label}</span>
                              <span className="settings-popover-desc">{opt.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Major Section Divider before WORKSPACE */}
          <div className="settings-chapter-divider" aria-hidden="true" />

          {/* Chapter 2: WORKSPACE */}
          <section className="settings-chapter" aria-labelledby="chapter-workspace">
            <header className="settings-chapter-header">
              <span className="settings-chapter-kicker" id="chapter-workspace">WORKSPACE</span>
            </header>

            <div className="settings-chapter-body">
              <div className="settings-entry">
                <div className="settings-entry-meta">
                  <span className="settings-entry-title">Keyboard shortcuts</span>
                  <p className="settings-entry-desc">
                    Global shortcuts for navigating GraphMind.
                  </p>
                </div>
                <div className="settings-entry-control">
                  <div className="settings-shortcuts-stack">
                    <div className="settings-shortcut-item">
                      <span className="shortcut-name">Search</span>
                      <div className="shortcut-caps">
                        <kbd className="settings-key">⌘</kbd>
                        <kbd className="settings-key">K</kbd>
                      </div>
                    </div>
                    <div className="settings-shortcut-item">
                      <span className="shortcut-name">Settings</span>
                      <div className="shortcut-caps">
                        <kbd className="settings-key">⌘</kbd>
                        <kbd className="settings-key">,</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Major Section Divider before CURRENT GRAPH */}
          <div className="settings-chapter-divider" aria-hidden="true" />

          {/* Chapter 3: CURRENT GRAPH — Level 2 Focal Hierarchy */}
          <section className="settings-chapter chapter-current-graph" aria-labelledby="chapter-current-graph">
            <header className="settings-chapter-header">
              <span className="settings-chapter-kicker" id="chapter-current-graph">CURRENT GRAPH</span>
            </header>

            <div className="settings-chapter-body">
              <div className="settings-graph-focus-block">
                {isRenaming ? (
                  <form onSubmit={handleSaveRename} className="settings-rename-box">
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      className="settings-rename-field"
                      placeholder="Graph name"
                      autoFocus
                    />
                    {renameError && (
                      <span className="settings-rename-msg">{renameError}</span>
                    )}
                    <div className="settings-rename-btns">
                      <button type="submit" className="settings-save-btn">
                        Save
                      </button>
                      <button type="button" className="settings-cancel-btn" onClick={handleCancelRename}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="settings-graph-hero">
                    <div className="settings-graph-name-wrap">
                      <h2 className="settings-graph-display-name">{graphName}</h2>
                      {createdDate && (
                        <span className="settings-graph-meta-date">Created {createdDate}</span>
                      )}
                    </div>
                    <div className="settings-graph-action-wrap">
                      <button
                        type="button"
                        className="settings-text-action"
                        onClick={handleStartRename}
                        id="btn-settings-rename-graph"
                        title={`Rename ${graphName}`}
                      >
                        <span className="action-label">Rename</span>
                        <span className="action-arrow" aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Major Section Divider before DANGER */}
          <div className="settings-chapter-divider" aria-hidden="true" />

          {/* Chapter 4: DANGER — Restrained */}
          <section className="settings-chapter chapter-danger" aria-labelledby="chapter-danger">
            <header className="settings-chapter-header">
              <span className="settings-chapter-kicker danger" id="chapter-danger">DANGER</span>
            </header>

            <div className="settings-chapter-body">
              <div className="settings-entry">
                <div className="settings-entry-meta">
                  <span className="settings-entry-title">Delete this graph</span>
                  <p className="settings-entry-desc">
                    Permanently remove {graphName} and its associated material.
                  </p>
                </div>
                <div className="settings-entry-control">
                  <button
                    type="button"
                    className="settings-danger-link"
                    onClick={onOpenDeleteModal}
                    id="btn-settings-delete-graph"
                    title={`Delete ${graphName}`}
                  >
                    <span className="danger-label">Delete graph</span>
                    <span className="danger-arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
