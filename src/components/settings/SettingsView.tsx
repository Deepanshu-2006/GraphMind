import React, { useState, useCallback } from 'react';
import { useGraph } from '../../context/GraphContext';

export interface SettingsViewProps {
  onOpenDeleteModal: () => void;
}

type ConceptExtractionMode = 'Conservative' | 'Balanced' | 'Aggressive';
type GraphLayoutMode = 'Hierarchical' | 'Radial' | 'Force Directed';

const EXTRACTION_MODES: ConceptExtractionMode[] = ['Balanced', 'Aggressive', 'Conservative'];
const LAYOUT_MODES: GraphLayoutMode[] = ['Hierarchical', 'Radial', 'Force Directed'];

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
      if (stored === 'Conservative' || stored === 'Balanced' || stored === 'Aggressive') {
        return stored;
      }
    }
    return 'Balanced';
  });

  const [graphLayout, setGraphLayout] = useState<GraphLayoutMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('graphmind_pref_graph_layout');
      if (stored === 'Hierarchical' || stored === 'Radial' || stored === 'Force Directed') {
        return stored;
      }
    }
    return 'Hierarchical';
  });

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState(activeGraphMeta?.name || '');
  const [renameError, setRenameError] = useState<string | null>(null);

  const cycleExtraction = useCallback(() => {
    setConceptExtraction((prev) => {
      const currentIndex = EXTRACTION_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % EXTRACTION_MODES.length;
      const nextMode = EXTRACTION_MODES[nextIndex];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('graphmind_pref_concept_extraction', nextMode);
      }
      return nextMode;
    });
  }, []);

  const cycleLayout = useCallback(() => {
    setGraphLayout((prev) => {
      const currentIndex = LAYOUT_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % LAYOUT_MODES.length;
      const nextMode = LAYOUT_MODES[nextIndex];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('graphmind_pref_graph_layout', nextMode);
      }
      return nextMode;
    });
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
    <div className="page-container">
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
        <section className="settings-section" aria-labelledby="section-graph-heading">
          <div className="settings-section-kicker" id="section-graph-heading">GRAPH</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Concept extraction</span>
              <span className="settings-row-desc">
                How aggressively GraphMind identifies concepts
              </span>
            </div>
            <button
              type="button"
              className="settings-value-trigger"
              onClick={cycleExtraction}
              id="setting-concept-extraction"
              title="Click to cycle extraction aggressiveness"
            >
              <span>{conceptExtraction}</span>
              <span className="trigger-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Graph layout</span>
              <span className="settings-row-desc">
                How concepts are arranged in the canvas
              </span>
            </div>
            <button
              type="button"
              className="settings-value-trigger"
              onClick={cycleLayout}
              id="setting-graph-layout"
              title="Click to cycle graph canvas layout"
            >
              <span>{graphLayout}</span>
              <span className="trigger-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* Section 2: WORKSPACE */}
        <section className="settings-section" aria-labelledby="section-workspace-heading">
          <div className="settings-section-kicker" id="section-workspace-heading">WORKSPACE</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Keyboard shortcuts</span>
            </div>
            <div className="settings-shortcuts-list">
              <div className="settings-shortcut-item">
                <span className="settings-shortcut-label">Search</span>
                <div className="settings-shortcut-keys">
                  <kbd className="settings-kbd">⌘</kbd>
                  <kbd className="settings-kbd">K</kbd>
                </div>
              </div>
              <div className="settings-shortcut-item">
                <span className="settings-shortcut-label">Settings</span>
                <div className="settings-shortcut-keys">
                  <kbd className="settings-kbd">⌘</kbd>
                  <kbd className="settings-kbd">,</kbd>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: CURRENT GRAPH */}
        <section className="settings-section" aria-labelledby="section-current-graph-heading">
          <div className="settings-section-kicker" id="section-current-graph-heading">CURRENT GRAPH</div>

          <div className="settings-graph-card">
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
                  <span style={{ fontSize: '12px', color: '#ef4444' }}>{renameError}</span>
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
              <>
                <div>
                  <div className="settings-graph-name">{graphName}</div>
                  <div className="settings-graph-date">Created {createdDate}</div>
                </div>
                <button
                  type="button"
                  className="settings-rename-btn"
                  onClick={handleStartRename}
                  id="btn-settings-rename-graph"
                >
                  [ Rename ]
                </button>
              </>
            )}
          </div>
        </section>

        {/* Section 4: DANGER ZONE */}
        <section className="settings-section" aria-labelledby="section-danger-zone-heading">
          <div className="settings-section-kicker danger" id="section-danger-zone-heading">DANGER ZONE</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Delete this graph</span>
              <span className="settings-row-desc">
                Permanently remove {graphName} and its material.
              </span>
            </div>
            <button
              type="button"
              className="settings-danger-btn"
              onClick={onOpenDeleteModal}
              id="btn-settings-delete-graph"
            >
              Delete graph
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
