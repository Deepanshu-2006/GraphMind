import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus } from 'lucide-react';
import type { KnowledgeGraphMeta } from '../../types/knowledgeGraph';

interface GraphSwitcherProps {
  graphs: KnowledgeGraphMeta[];
  activeGraphId: string | null;
  activeGraphMeta: KnowledgeGraphMeta | null;
  onSelectGraph: (graphId: string) => void;
  onOpenNewGraph: () => void;
}

export const GraphSwitcher: React.FC<GraphSwitcherProps> = ({
  graphs,
  activeGraphId,
  activeGraphMeta,
  onSelectGraph,
  onOpenNewGraph
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
    }
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
      <button
        type="button"
        className={`topbar-graph-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={currentDisplayName}
        id="topbar-graph-switcher-button"
      >
        <span className="topbar-graph-current-name">{currentDisplayName}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.8}
          className={`topbar-graph-chevron ${isOpen ? 'open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
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
