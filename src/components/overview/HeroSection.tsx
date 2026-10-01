import React from 'react';
import { Sparkles, Network, ArrowUpRight, Activity, Cpu } from 'lucide-react';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  return (
    <section className="hero-section">
      {/* Editorial Meta Badge */}
      <div className="hero-meta-badge">
        <Sparkles className="badge-icon" />
        <span>Semantic Topology Engine • Latent Graph Synthesizer</span>
      </div>

      {/* Main Hero Headline */}
      <h1 className="hero-title">
        Turn scattered knowledge into a connected mind.
      </h1>

      {/* Supporting Editorial Subtitle */}
      <p className="hero-supporting">
        GraphMind transforms unstructured learning material into an interactive knowledge graph.
        Extract hidden conceptual hierarchies, latent relationships, and structured curriculum trajectories in real-time.
      </p>

      {/* Call to Actions */}
      <div className="hero-actions-row">
        <button 
          className="btn-primary"
          onClick={onCreateGraph}
          id="btn-create-knowledge-graph"
        >
          <Sparkles size={16} />
          <span>Create Knowledge Graph</span>
          <ArrowUpRight size={15} />
        </button>

        <button 
          className="btn-secondary"
          onClick={onExploreDemo}
          id="btn-explore-demo-graph"
        >
          <Network size={16} />
          <span>Explore Demo Graph</span>
        </button>
      </div>

      {/* Technical Telemetry Strip */}
      <div className="hero-telemetry-strip">
        <div className="telemetry-item">
          <Activity size={13} style={{ color: 'var(--accent-emerald)' }} />
          <span>Engine Status: <strong>Online (Low-latency)</strong></span>
        </div>
        <span style={{ color: 'var(--border-strong)' }}>•</span>
        <div className="telemetry-item">
          <Cpu size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>Extraction Precision: <strong>98.4% Confidence</strong></span>
        </div>
        <span style={{ color: 'var(--border-strong)' }}>•</span>
        <div className="telemetry-item">
          <span>Topology Density: <strong>3.06 links / concept</strong></span>
        </div>
      </div>
    </section>
  );
};
