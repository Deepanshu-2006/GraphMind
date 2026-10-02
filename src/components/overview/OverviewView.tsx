import React, { useState } from 'react';
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
  const [selectedConceptId, setSelectedConceptId] = useState<string>('c3');

  return (
    <div className="overview-page">
      {/* 1. Page Header / Hero Section */}
      <HeroSection 
        onCreateGraph={onCreateGraph}
        onExploreDemo={onExploreDemo}
        selectedConceptId={selectedConceptId}
        onSelectConcept={setSelectedConceptId}
      />

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
          </div>
        </section>
      ) : (
        /* Populated Knowledge Graph State */
        <ConnectedConcepts 
          concepts={mockConnectedConcepts}
          onOpenExplore={onExploreDemo}
          selectedConceptId={selectedConceptId}
          onSelectConcept={setSelectedConceptId}
        />
      )}
    </div>
  );
};
