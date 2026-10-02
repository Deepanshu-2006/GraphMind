import React from 'react';
import { HeroSection } from './HeroSection';
import { ConnectedConcepts } from './ConnectedConcepts';
import { mockConnectedConcepts } from '../../data/mockData';
import { Plus } from 'lucide-react';

interface OverviewViewProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
  hasContent?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onCreateGraph,
  onExploreDemo,
  hasContent = true
}) => {
  return (
    <div className="overview-container">
      {/* 1. Full-Viewport Hero Experience */}
      <HeroSection 
        onCreateGraph={onCreateGraph}
        onExploreDemo={onExploreDemo}
      />

      {/* 2. Lower Page Content (Knowledge Graph Experience) */}
      <div className="overview-page">

      {!hasContent ? (
        /* Empty State */
        <section className="overview-empty-state">
          <div className="empty-state-card">
            <h2 className="empty-state-title">Your knowledge graph starts here.</h2>
            <p className="empty-state-desc">
              Upload your notes, papers, or lecture material and GraphMind will connect the ideas for you.
            </p>
            <div className="empty-state-actions">
              <button className="btn-primary" onClick={onCreateGraph}>
                <Plus size={14} />
                <span>Upload material</span>
              </button>
              <button 
                className="btn-secondary" 
                onClick={onExploreDemo}
              >
                <span>Explore demo graph</span>
              </button>
            </div>

            {/* Subtle miniature example graph preview */}
            <div className="empty-state-mini-graph">
              <svg width="100%" height="180" viewBox="0 0 600 180">
                <line x1="120" y1="90" x2="280" y2="50" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="120" y1="90" x2="280" y2="130" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="280" y1="50" x2="480" y2="40" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="280" y1="130" x2="480" y2="140" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="280" y1="50" x2="280" y2="130" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />

                <circle cx="120" cy="90" r="14" fill="#141414" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="120" cy="90" r="3.5" fill="var(--accent)" />
                <text x="120" y="120" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-body)">Machine Learning</text>

                <circle cx="280" cy="50" r="16" fill="#141414" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="280" cy="50" r="3.5" fill="var(--text-muted)" />
                <text x="280" y="80" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-body)">Deep Learning</text>

                <circle cx="280" cy="130" r="14" fill="#141414" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="280" cy="130" r="3.5" fill="var(--text-muted)" />
                <text x="280" y="160" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-body)">Neural Networks</text>

                <circle cx="480" cy="40" r="12" fill="#141414" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="480" cy="40" r="3" fill="var(--text-muted)" />
                <text x="480" y="68" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-body)">Transformers</text>

                <circle cx="480" cy="140" r="12" fill="#141414" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="480" cy="140" r="3" fill="var(--text-muted)" />
                <text x="480" y="168" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-body)">Computer Vision</text>
              </svg>
            </div>
          </div>
        </section>
      ) : (
        /* Populated Knowledge Graph State */
        <ConnectedConcepts 
          concepts={mockConnectedConcepts}
          onOpenExplore={onExploreDemo}
        />
      )}
      </div>
    </div>
  );
};
