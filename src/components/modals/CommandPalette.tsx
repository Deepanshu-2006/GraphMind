import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredConcepts = concepts.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.summary.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog command-palette-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Search Bar */}
        <div className="command-search-bar">
          <Search size={16} className="command-search-icon" />
          <input
            type="text"
            className="command-input"
            placeholder="Search concepts, topics, or paths..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="search-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="command-results-list">
          <div className="command-list-header">
            Concepts ({filteredConcepts.length})
          </div>

          {filteredConcepts.map((concept) => (
            <div
              key={concept.id}
              className="command-item"
              onClick={() => {
                onSelectConcept(concept.id);
                onClose();
              }}
            >
              <div className="command-item-left">
                <span className="command-item-dot" />
                <div>
                  <div className="command-item-title">{concept.name}</div>
                  <div className="command-item-category">{concept.category}</div>
                </div>
              </div>
            </div>
          ))}

          {filteredConcepts.length === 0 && (
            <div className="command-empty">
              No matching concepts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
