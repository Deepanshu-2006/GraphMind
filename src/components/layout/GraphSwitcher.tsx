import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, PenLine } from 'lucide-react';
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

type EditPhase = 'idle' | 'editing' | 'saved' | 'settling' | 'cancelling';

const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;

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
  const [editPhase, setEditPhase] = useState<EditPhase>('idle');
  const [draftTitle, setDraftTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitDirectionRef = useRef<-6 | 6>(6);

  const clearAnimTimeout = useCallback(() => {
    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
  }, []);

  const prevActiveGraphIdRef = useRef(activeGraphId);
  // Cancel edit mode only if active graph switches to a different graph externally
  useEffect(() => {
    if (prevActiveGraphIdRef.current !== activeGraphId) {
      prevActiveGraphIdRef.current = activeGraphId;
      if (isEditing) {
        clearAnimTimeout();
        setIsEditing(false);
        setEditPhase('idle');
        setValidationError(null);
      }
    }
  }, [activeGraphId, clearAnimTimeout, isEditing]);

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clearAnimTimeout();
    };
  }, [clearAnimTimeout]);

  const resolveActiveMeta = useCallback(() => {
    return activeGraphMeta || graphs.find(g => g.id === activeGraphId) || (graphs.length > 0 ? graphs[0] : null);
  }, [activeGraphMeta, activeGraphId, graphs]);

  const startEditing = useCallback(() => {
    const meta = resolveActiveMeta();
    if (!meta) return;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clearAnimTimeout();
    setIsOpen(false);
    setDraftTitle(meta.name);
    setValidationError(null);
    setEditPhase('editing');
    setIsEditing(true);
  }, [resolveActiveMeta, clearAnimTimeout]);

  // Automatically focus and place caret at the end of text
  useEffect(() => {
    if (isEditing && editPhase === 'editing') {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      });
    }
  }, [isEditing, editPhase]);

  const handleCancel = useCallback(() => {
    const meta = resolveActiveMeta();
    if (!meta || editPhase !== 'editing') return;
    clearAnimTimeout();
    exitDirectionRef.current = -6;
    setEditPhase('cancelling');
    setDraftTitle(meta.name);
    setValidationError(null);

    // Allow reverse animation to complete (underline contract + action slide-out)
    animTimeoutRef.current = setTimeout(() => {
      setIsEditing(false);
      setEditPhase('idle');
    }, 240);
  }, [resolveActiveMeta, clearAnimTimeout, editPhase]);

  const handleSave = useCallback(() => {
    const meta = resolveActiveMeta();
    const targetGraphId = activeGraphId || meta?.id;
    if (!targetGraphId || !meta || editPhase !== 'editing') return;

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

    clearAnimTimeout();
    exitDirectionRef.current = 6;
    setValidationError(null);

    try {
      if (trimmed !== meta.name) {
        if (onRenameGraph) {
          onRenameGraph(targetGraphId, trimmed);
        } else if (graphContext?.renameGraph) {
          graphContext.renameGraph(targetGraphId, trimmed);
        }
      }

      // Step 1: Smooth transition to "Saved ✓" confirmation
      setEditPhase('saved');

      // Step 2: Keep confirmation visible for 300ms, then initiate settling
      animTimeoutRef.current = setTimeout(() => {
        setEditPhase('settling');

        // Step 3: Allow underline contract + action fade-away + title settle to finish
        animTimeoutRef.current = setTimeout(() => {
          setIsEditing(false);
          setEditPhase('idle');
        }, 220);
      }, 300);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to rename graph.');
      setEditPhase('editing');
    }
  }, [activeGraphId, resolveActiveMeta, editPhase, draftTitle, clearAnimTimeout, onRenameGraph, graphContext]);

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
    if (editPhase !== 'editing') return;
    setDraftTitle(e.target.value);
    if (validationError && e.target.value.trim().length > 0) {
      setValidationError(null);
    }
  };

  // Single click vs double click on title text
  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Catch double-click directly via native event detail counter
    if (e.detail === 2) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      setIsOpen(false);
      startEditing();
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setIsOpen(prev => !prev);
      clickTimeoutRef.current = null;
    }, 280);
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

  const currentDisplayName = resolveActiveMeta()?.name || 'Select graph';
  const isActionExit = editPhase === 'settling' || editPhase === 'cancelling';
  const isUnderlineExpanded = editPhase === 'editing' || editPhase === 'saved';
  const underlineOrigin = editPhase === 'saved' || editPhase === 'settling' ? 'right' : 'left';

  return (
    <div className="topbar-graph-switcher-wrap" ref={containerRef}>
      <AnimatePresence mode="sync">
        {isEditing ? (
          <motion.div
            key="inline-edit"
            className="topbar-inline-edit-wrap"
            initial={{ opacity: 0.85, y: 2, scale: 0.995 }}
            animate={{
              opacity: isActionExit ? 0 : 1,
              y: isActionExit ? 0 : 0,
              scale: isActionExit ? 0.995 : 1
            }}
            exit={{ opacity: 0, y: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.2, ease: EDITORIAL_EASE }}
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
                disabled={editPhase !== 'editing'}
              />

              {/* Subtle green editing underline with editorial left->right expansion & right->left contract */}
              <motion.div
                className={`topbar-inline-underline ${validationError ? 'has-error' : ''}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isUnderlineExpanded ? 1 : 0 }}
                style={{
                  originX: underlineOrigin === 'right' ? 1 : 0,
                  transformOrigin: underlineOrigin === 'right' ? 'right' : 'left'
                }}
                transition={{
                  duration: isUnderlineExpanded ? 0.25 : 0.22,
                  ease: EDITORIAL_EASE
                }}
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

            <AnimatePresence>
              {!isActionExit && (
                <motion.div
                  className="topbar-inline-actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    x: -6,
                    transition: { duration: 0.2, ease: EDITORIAL_EASE }
                  }}
                >
                  <motion.button
                    type="button"
                    className="topbar-inline-cancel-btn"
                    onClick={handleCancel}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.07, ease: EDITORIAL_EASE }}
                    disabled={editPhase !== 'editing'}
                    title="Cancel editing (Esc)"
                    id="btn-topbar-rename-cancel"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    type="button"
                    className="topbar-inline-save-btn"
                    onClick={handleSave}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.12, ease: EDITORIAL_EASE }}
                    disabled={editPhase !== 'editing'}
                    title="Save changes (Enter)"
                    id="btn-topbar-rename-save"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {editPhase === 'saved' ? (
                        <motion.span
                          key="saved"
                          className="topbar-inline-save-content"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.15 }}
                        >
                          <span>Saved</span>
                          <Check size={11} strokeWidth={2.4} className="topbar-inline-saved-check" aria-hidden="true" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="save"
                          className="topbar-inline-save-content"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.15 }}
                        >
                          <span>Save</span>
                          <span className="topbar-inline-save-arrow" aria-hidden="true">→</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="trigger-group"
            className="topbar-graph-trigger-group"
            initial={{ opacity: 0.9, y: 1 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.2, ease: EDITORIAL_EASE }}
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
              <PenLine size={12} strokeWidth={1.6} aria-hidden="true" />
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
