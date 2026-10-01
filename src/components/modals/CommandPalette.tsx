import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';

export interface SearchConceptItem {
  id: string;
  name: string;
  category: string;
  summary?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  concepts: SearchConceptItem[];
  onSelectConcept: (conceptId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  concepts,
  onSelectConcept
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  const handleSelect = useCallback((conceptId: string) => {
    onSelectConcept(conceptId);
    setQuery('');
    setSelectedIndex(0);
    onClose();
  }, [onSelectConcept, onClose]);

  // Exact, prefix, word-start, and substring matching (case-insensitive)
  const filteredConcepts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return concepts.slice(0, 40);
    }

    return concepts
      .filter((c) => {
        const nameLower = c.name.toLowerCase();
        const catLower = c.category.toLowerCase();
        const summaryLower = (c.summary || '').toLowerCase();
        return (
          nameLower.includes(q) ||
          catLower.includes(q) ||
          summaryLower.includes(q)
        );
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // 1. Exact match priority
        const aExact = aName === q;
        const bExact = bName === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // 2. Starts with query priority
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 3. Any word starts with query priority
        const aWordStarts = aName.split(/\s+/).some((w) => w.startsWith(q));
        const bWordStarts = bName.split(/\s+/).some((w) => w.startsWith(q));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;

        return a.name.localeCompare(b.name);
      });
  }, [concepts, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) handleClose();
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredConcepts.length > 0 ? (prev + 1) % filteredConcepts.length : 0));
      }
      if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredConcepts.length > 0 ? (prev - 1 + filteredConcepts.length) % filteredConcepts.length : 0));
      }
      if (e.key === 'Enter' && isOpen && filteredConcepts[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredConcepts[selectedIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleSelect, filteredConcepts, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={handleClose} 
      role="dialog" 
      aria-modal="true" 
      aria-label="Search concepts"
    >
      <div className="modal-dialog command-palette-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Minimal Search Bar */}
        <div className="command-search-bar">
          <Search size={15} className="command-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="command-input"
            placeholder="Search concepts"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            aria-label="Search concepts"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
          <kbd className="search-kbd" aria-hidden="true">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="command-results-list" role="listbox" aria-label="Matching concepts">
          {filteredConcepts.map((concept, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={concept.id}
                className={`command-item ${isSelected ? 'active' : ''}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => {
                  onSelectConcept(concept.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSelectConcept(concept.id);
                    onClose();
                  }
                }}
              >
                <div className="command-item-left">
                  <span className="command-item-dot" aria-hidden="true" />
                  <div>
                    <div className="command-item-title">{concept.name}</div>
                    <div className="command-item-category">{concept.category}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredConcepts.length === 0 && (
            <div className="command-empty" role="status">
              No concepts found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
