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
      <span className="overview-hero-label">Overview</span>

      <h1 className="overview-hero-title">
        Turn scattered knowledge<br />into a connected mind.
      </h1>

      <p className="overview-hero-desc">
        GraphMind transforms unstructured learning material into an interactive knowledge graph.
      </p>

      <div className="overview-hero-actions">
        <button 
          className="btn-primary"
          onClick={onCreateGraph}
          id="btn-upload-material"
        >
          <span>Upload material</span>
        </button>

        <button 
          className="btn-secondary"
          onClick={onExploreDemo}
          id="btn-explore-demo-graph"
        >
          <span>Explore demo graph</span>
        </button>
      </div>
    </section>
  );
};
