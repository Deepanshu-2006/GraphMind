import React from 'react';
import { Upload, ArrowRight, ChevronDown } from 'lucide-react';
import { KnowledgeParticleField } from './KnowledgeParticleField';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  return (
    <section className="overview-hero" aria-label="GraphMind hero">
      {/* Layer 1: 3D Interactive Spatial Knowledge Field */}
      <KnowledgeParticleField />

      {/* Layer 2: Subtle Depth & Readability Vignette */}
      <div className="overview-hero-vignette" aria-hidden="true" />

      {/* Layer 3: Editorial Typography & Actions */}
      <div className="overview-hero-content">
        <h1 className="overview-hero-title">
          <span className="hero-title-primary">Turn scattered knowledge</span>
          <span className="hero-title-secondary">
            into a <span className="hero-title-accent">connected mind.</span>
          </span>
        </h1>

        <p className="overview-hero-desc">
          GraphMind transforms unstructured learning material<br className="hero-desc-br" />
          into an interactive knowledge graph.
        </p>

        <div className="overview-hero-actions">
          <button 
            type="button"
            className="btn-primary hero-btn-primary"
            onClick={onCreateGraph}
            aria-label="Upload material"
            id="btn-overview-add-material"
          >
            <Upload size={14} strokeWidth={2} className="hero-btn-icon" />
            <span>Upload material</span>
          </button>

          <button 
            type="button"
            className="btn-secondary hero-btn-secondary"
            onClick={onExploreDemo}
            aria-label="Explore knowledge graph"
            id="btn-explore-demo-graph"
          >
            <span>Explore graph</span>
            <ArrowRight size={14} strokeWidth={2} className="hero-btn-icon" />
          </button>
        </div>
      </div>

      {/* Understated Bottom Scroll Cue */}
      <div className="overview-hero-cue" aria-hidden="true">
        <span className="hero-cue-text">Explore knowledge graph</span>
        <ChevronDown size={13} strokeWidth={1.8} className="hero-cue-icon" />
      </div>
    </section>
  );
};
