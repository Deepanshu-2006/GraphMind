import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, Pencil } from 'lucide-react';
import type { KnowledgeGraphMeta } from '../../types/knowledgeGraph';
import { useOptionalGraph } from '../../context/GraphContext';

interface GraphSwitcherProps {
  graphs: KnowledgeGraphMeta[];
  activeGraphId: string | null;
  activeGraphMeta: KnowledgeGraphMeta | null;
  onSelectGraph: (graphId: string) => void;
  onOpenNewGraph: () => void;
  onRenameGraph?: (graphId: string, newName: string) => void;
}

export const GraphSwitcher: React.FC<GraphSwitcherProps> = ({
  graphs,
  activeGraphId,
  activeGraphMeta,
  onSelectGraph,
  onOpenNewGraph,
  onRenameGraph
}) => {
  const graphContext = useOptionalGraph();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel edit mode if active graph switches externally
  useEffect(() => {
    if (isEditing) {
      setIsEditing(false);
      setValidationError(null);
    }
  }, [activeGraphId]);

  // Close dropdown on outside click (only when dropdown is open and not editing)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
    }
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Close dropdown on Escape key when dropdown is open and not in inline edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isEditing) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing]);

  // Cleanup click debounce timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    };
  }, []);

  const startEditing = useCallback(() => {
    if (!activeGraphMeta) return;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setIsOpen(false);
    setDraftTitle(activeGraphMeta.name);
    setValidationError(null);
    setIsEditing(true);
  }, [activeGraphMeta]);

  // Automatically focus and select the entire title when editing begins
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [isEditing]);

  const handleCancel = useCallback(() => {
    if (!activeGraphMeta) return;
    setDraftTitle(activeGraphMeta.name);
    setValidationError(null);
    setIsEditing(false);
  }, [activeGraphMeta]);

  const handleSave = useCallback(() => {
    if (isSubmitting) return;
    if (!activeGraphId || !activeGraphMeta) return;

    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setValidationError("Graph name can't be empty.");
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    if (trimmed.length > 100) {
      setValidationError('Graph name must be 100 characters or less.');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      if (trimmed !== activeGraphMeta.name) {
        if (onRenameGraph) {
          onRenameGraph(activeGraphId, trimmed);
        } else if (graphContext?.renameGraph) {
          graphContext.renameGraph(activeGraphId, trimmed);
        }
      }
      setIsEditing(false);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to rename graph.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, activeGraphId, activeGraphMeta, draftTitle, onRenameGraph, graphContext]);

  // Input keyboard navigation & global hotkey shielding
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Tab') {
      // Tab navigates normally between input and Cancel/Save buttons
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftTitle(e.target.value);
    if (validationError && e.target.value.trim().length > 0) {
      setValidationError(null);
    }
  };

  // Single click vs double click on title text
  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setIsOpen(prev => !prev);
      clickTimeoutRef.current = null;
    }, 220);
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setIsOpen(false);
    startEditing();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setIsOpen(prev => !prev);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;
    if (e.key === 'F2') {
      e.preventDefault();
      startEditing();
    }
  };

  // First-time user experience: 0 graphs available
  if (graphs.length === 0) {
    return (
      <div className="topbar-graph-first-time">
        <button
          type="button"
          className="topbar-create-first-btn"
          onClick={onOpenNewGraph}
          id="btn-create-first-graph"
        >
          <Plus size={13} strokeWidth={2} aria-hidden="true" />
          <span>Create your first graph</span>
        </button>
      </div>
    );
  }

  const currentDisplayName = activeGraphMeta?.name || 'Select graph';

  return (
    <div className="topbar-graph-switcher-wrap" ref={containerRef}>
      <AnimatePresence initial={false} mode="sync">
        {isEditing ? (
          <motion.div
            key="inline-edit"
            className="topbar-inline-edit-wrap"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="topbar-inline-input-sizer">
              <span className="topbar-inline-input-ghost" aria-hidden="true">
                {draftTitle || ' '}
              </span>
              <input
                ref={inputRef}
                type="text"
                className={`topbar-inline-title-input ${validationError ? 'has-error' : ''}`}
                value={draftTitle}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                aria-label="Graph name"
                id="topbar-graph-title-input"
                maxLength={100}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {validationError && (
              <motion.div
                className="topbar-inline-error-tooltip"
                role="alert"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.14 }}
              >
                {validationError}
              </motion.div>
            )}

            <div className="topbar-inline-actions">
              <motion.button
                type="button"
                className="topbar-inline-cancel-btn"
                onClick={handleCancel}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                disabled={isSubmitting}
                title="Cancel editing (Esc)"
                id="btn-topbar-rename-cancel"
              >
                Cancel
              </motion.button>

              <motion.button
                type="button"
                className="topbar-inline-save-btn"
                onClick={handleSave}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.18, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                disabled={isSubmitting}
                title="Save changes (Enter)"
                id="btn-topbar-rename-save"
              >
                <span className="topbar-inline-save-label">Save</span>
                <span className="topbar-inline-save-arrow" aria-hidden="true">→</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="trigger-group"
            className="topbar-graph-trigger-group"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              className={`topbar-graph-trigger ${isOpen ? 'is-active' : ''}`}
              onClick={handleTitleClick}
              onDoubleClick={handleTitleDoubleClick}
              onKeyDown={handleTriggerKeyDown}
              aria-expanded={isOpen}
              aria-haspopup="true"
              title={`${currentDisplayName} (Double-click to rename)`}
              id="topbar-graph-switcher-button"
            >
              <span 
                className="topbar-graph-current-name"
                onDoubleClick={handleTitleDoubleClick}
              >
                {currentDisplayName}
              </span>
              <ChevronDown
                size={12}
                strokeWidth={1.8}
                className={`topbar-graph-chevron ${isOpen ? 'open' : ''}`}
                onClick={handleChevronClick}
                aria-hidden="true"
              />
            </button>

            {/* Unobtrusive accessible rename affordance */}
            <button
              type="button"
              className="topbar-graph-rename-affordance"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              aria-label={`Rename ${currentDisplayName}`}
              title="Rename graph (or double-click title)"
              id="btn-topbar-graph-rename"
            >
              <Pencil size={11} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && !isEditing && (
          <motion.div
            className="graph-switcher-dropdown"
            role="menu"
            aria-label="Your knowledge graphs"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="graph-switcher-header">YOUR GRAPHS</div>

            <div className="graph-switcher-list" role="none">
              {graphs.map((g) => {
                const isSelected = g.id === activeGraphId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="menuitem"
                    className={`graph-switcher-item ${isSelected ? 'is-active' : ''}`}
                    onClick={() => {
                      onSelectGraph(g.id);
                      setIsOpen(false);
                    }}
                    title={g.name}
                  >
                    <span className="graph-switcher-item-name">{g.name}</span>
                    {isSelected && (
                      <Check
                        size={12}
                        strokeWidth={2.2}
                        className="graph-switcher-check"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="graph-switcher-divider" role="separator" />

            <button
              type="button"
              className="graph-switcher-new-btn"
              onClick={() => {
                setIsOpen(false);
                onOpenNewGraph();
              }}
              id="btn-switcher-new-graph"
            >
              <Plus size={13} strokeWidth={2} aria-hidden="true" />
              <span>New graph</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
