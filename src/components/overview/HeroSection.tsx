import React from 'react';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  return (
    <section className="overview-hero">
      <h1 className="overview-hero-title">
        Turn scattered knowledge<br />into a connected mind.
      </h1>

      <p className="overview-hero-desc">
        GraphMind transforms unstructured learning material into an interactive knowledge graph.
      </p>

      <div className="overview-hero-actions">
        <button 
          type="button"
          className="btn-primary"
          onClick={onCreateGraph}
          aria-label="Add learning material"
          id="btn-overview-add-material"
        >
          <span>Add material</span>
        </button>

        <button 
          type="button"
          className="btn-secondary"
          onClick={onExploreDemo}
          aria-label="Explore knowledge graph"
          id="btn-explore-demo-graph"
        >
          <span>Explore graph</span>
        </button>
      </div>
    </section>
  );
};
