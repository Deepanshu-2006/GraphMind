
import type { GraphConceptData } from '../../types/graph';
import { ChevronLeft, ChevronRight, Network } from 'lucide-react';

interface GraphSidebarLeftProps {
  concepts: GraphConceptData[];
  selectedConceptId: string | null;
  onSelectConcept: (conceptId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const categoryDotColor: Record<string, string> = {
  Foundation: '#00f2fe',
  Paradigm: '#818cf8',
  Architecture: '#10b981',
  Method: '#f59e0b',
  Application: '#f43f5e'
};

export const GraphSidebarLeft: React.FC<GraphSidebarLeftProps> = ({
  concepts,
  selectedConceptId,
  onSelectConcept,
  isCollapsed,
  onToggleCollapse
}) => {
  return (
    <>
      {/* Floating Toggle Button when collapsed */}
      {isCollapsed && (
        <button
          className="sidebar-collapse-trigger"
          onClick={onToggleCollapse}
          title="Expand Navigator"
          aria-label="Expand Navigator"
        >
          <ChevronRight size={16} />
        </button>
      )}

      <aside className={`graph-sidebar-left ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div className="left-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span className="left-sidebar-title">Graph Navigator</span>
          </div>
          <button
            className="topbar-action-btn"
            style={{ width: '26px', height: '26px' }}
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="left-sidebar-content">
          {/* Topology Stats Tile */}
          <div className="graph-stats-tile">
            <div className="stat-item">
              <span className="stat-val">{concepts.length}</span>
              <span className="stat-lbl">Active Nodes</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">10</span>
              <span className="stat-lbl">Directed Links</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">96.2%</span>
              <span className="stat-lbl">Confidence</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">3.2x</span>
              <span className="stat-lbl">Density</span>
            </div>
          </div>

          {/* Quick Concept Jump list */}
          <div className="concept-quicklist">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px 4px' }}>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Concepts ({concepts.length})
              </span>
              <span className="mono" style={{ fontSize: '9px', color: 'var(--accent-cyan)' }}>
                LATENT MAP
              </span>
            </div>

            {concepts.map((concept) => {
              const isSelected = concept.id === selectedConceptId;
              const dotColor = categoryDotColor[concept.category] || '#00f2fe';

              return (
                <div
                  key={concept.id}
                  className={`quicklist-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectConcept(concept.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: dotColor,
                        boxShadow: isSelected ? `0 0 8px ${dotColor}` : 'none'
                      }} 
                    />
                    <span style={{ fontWeight: isSelected ? 600 : 450 }}>
                      {concept.label}
                    </span>
                  </div>

                  <span className="mono" style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                    {concept.code}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
};
