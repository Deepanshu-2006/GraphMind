import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { ConceptNode } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  concepts: ConceptNode[];
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

  const filteredConcepts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return concepts;
    return concepts.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [concepts, query]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        setSelectedIndex(prev => (filteredConcepts.length > 0 ? (prev + 1) % filteredConcepts.length : 0));
      }
      if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        setSelectedIndex(prev => (filteredConcepts.length > 0 ? (prev - 1 + filteredConcepts.length) % filteredConcepts.length : 0));
      }
      if (e.key === 'Enter' && isOpen && filteredConcepts[selectedIndex]) {
        e.preventDefault();
        onSelectConcept(filteredConcepts[selectedIndex].id);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredConcepts, selectedIndex, onSelectConcept]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true" 
      aria-label="Command palette"
    >
      <div className="modal-dialog command-palette-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Search Bar */}
        <div className="command-search-bar">
          <Search size={16} className="command-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="command-input"
            placeholder="Search concepts, topics, or paths..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            aria-label="Search concepts, topics, or paths"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
          <kbd className="search-kbd" aria-hidden="true">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="command-results-list" role="listbox" aria-label="Matching concepts">
          <div className="command-list-header" id="command-list-header">
            Concepts ({filteredConcepts.length})
          </div>

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
              No matching concepts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
