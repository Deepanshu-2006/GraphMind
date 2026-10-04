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

function formatGraphDate(dateStr?: string): string {
  if (!dateStr) return 'Oct 5, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Oct 5, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Oct 5, 2026';
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

  const graphName = activeGraphMeta?.name || 'Physics';
  const createdDate = formatGraphDate(activeGraphMeta?.createdAt);

  return (
    <div className="settings-page-wrapper">
      <div className="settings-container">
        {/* Header */}
        <header className="settings-header">
          <span className="settings-kicker">SETTINGS</span>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Control how GraphMind builds and presents your knowledge.
          </p>
        </header>

        {/* Section 1: GRAPH */}
        <section className="settings-section section-graph" aria-labelledby="section-graph-heading">
          <div className="settings-section-kicker" id="section-graph-heading">GRAPH</div>

          {/* Row 1: Concept Extraction */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Concept extraction</span>
              <span className="settings-row-desc">
                How aggressively GraphMind identifies concepts
              </span>
            </div>
            <div className="settings-control-cell" ref={extractionCellRef}>
              <button
                type="button"
                className="settings-value-trigger"
                onClick={() => setOpenPopover(prev => prev === 'extraction' ? null : 'extraction')}
                id="setting-concept-extraction"
                aria-haspopup="true"
                aria-expanded={openPopover === 'extraction'}
                title="Select concept extraction aggressiveness"
              >
                <span className="trigger-text">{conceptExtraction}</span>
                <span className="trigger-arrow" aria-hidden="true">→</span>
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

          <div className="settings-row-divider" aria-hidden="true" />

          {/* Row 2: Graph Layout */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Graph layout</span>
              <span className="settings-row-desc">
                How concepts are arranged in the canvas
              </span>
            </div>
            <div className="settings-control-cell" ref={layoutCellRef}>
              <button
                type="button"
                className="settings-value-trigger"
                onClick={() => setOpenPopover(prev => prev === 'layout' ? null : 'layout')}
                id="setting-graph-layout"
                aria-haspopup="true"
                aria-expanded={openPopover === 'layout'}
                title="Select graph layout"
              >
                <span className="trigger-text">{graphLayout}</span>
                <span className="trigger-arrow" aria-hidden="true">→</span>
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
        </section>

        {/* Section 2: WORKSPACE */}
        <section className="settings-section section-workspace" aria-labelledby="section-workspace-heading">
          <div className="settings-section-kicker" id="section-workspace-heading">WORKSPACE</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Keyboard shortcuts</span>
              <span className="settings-row-desc">
                Global shortcuts for navigating GraphMind.
              </span>
            </div>
            <div className="settings-control-cell">
              <div className="settings-shortcuts-grid">
                <div className="settings-shortcut-row">
                  <span className="settings-shortcut-label">Search</span>
                  <div className="settings-shortcut-keys">
                    <kbd className="settings-kbd">⌘</kbd>
                    <kbd className="settings-kbd">K</kbd>
                  </div>
                </div>
                <div className="settings-shortcut-row">
                  <span className="settings-shortcut-label">Settings</span>
                  <div className="settings-shortcut-keys">
                    <kbd className="settings-kbd">⌘</kbd>
                    <kbd className="settings-kbd">,</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: CURRENT GRAPH */}
        <section className="settings-section section-current-graph" aria-labelledby="section-current-graph-heading">
          <div className="settings-section-kicker" id="section-current-graph-heading">CURRENT GRAPH</div>

          <div className="settings-row">
            <div className="settings-row-info">
              {isRenaming ? (
                <form onSubmit={handleSaveRename} className="settings-rename-form">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    className="settings-rename-input"
                    placeholder="Graph name"
                    autoFocus
                  />
                  {renameError && (
                    <span className="settings-rename-error">{renameError}</span>
                  )}
                  <div className="settings-rename-actions">
                    <button type="submit" className="settings-btn-save">
                      Save
                    </button>
                    <button type="button" className="settings-btn-cancel" onClick={handleCancelRename}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="settings-graph-identity">
                  <div className="settings-graph-title">{graphName}</div>
                  <div className="settings-graph-created">Created {createdDate}</div>
                </div>
              )}
            </div>
            <div className="settings-control-cell">
              {!isRenaming && (
                <button
                  type="button"
                  className="settings-action-link"
                  onClick={handleStartRename}
                  id="btn-settings-rename-graph"
                  title={`Rename ${graphName}`}
                >
                  <span className="action-text">Rename</span>
                  <span className="action-arrow" aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Section 4: DANGER ZONE */}
        <section className="settings-section section-danger" aria-labelledby="section-danger-zone-heading">
          <div className="settings-section-kicker danger" id="section-danger-zone-heading">DANGER ZONE</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Delete this graph</span>
              <span className="settings-row-desc">
                Permanently remove {graphName} and its material.
              </span>
            </div>
            <div className="settings-control-cell">
              <button
                type="button"
                className="settings-danger-action"
                onClick={onOpenDeleteModal}
                id="btn-settings-delete-graph"
                title={`Delete ${graphName}`}
              >
                <span className="danger-text">Delete graph</span>
                <span className="danger-arrow" aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
