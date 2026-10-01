import { useState, useEffect } from 'react';
import { Search, Network, CornerDownLeft } from 'lucide-react';
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
          <Search size={18} style={{ color: 'var(--accent-cyan)' }} />
          <input
            type="text"
            className="command-input"
            placeholder="Type a concept, paper name, or relationship..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ESC to close</span>
        </div>

        {/* Results List */}
        <div className="command-results-list">
          <div style={{ padding: '6px 12px', fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            CONCEPTS ({filteredConcepts.length})
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
                <Network size={16} style={{ color: concept.accentColor }} />
                <div>
                  <div className="command-item-title">{concept.name}</div>
                  <div className="command-item-category">{concept.category} • {concept.synapseCount} Synapses</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                <span className="mono" style={{ fontSize: '10px' }}>Jump</span>
                <CornerDownLeft size={12} />
              </div>
            </div>
          ))}

          {filteredConcepts.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No concepts matching "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
