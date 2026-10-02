import React from 'react';
import { HeroSection } from './HeroSection';
import { FromMaterialToMeaning } from './FromMaterialToMeaning';
import { Plus, ArrowUpRight } from 'lucide-react';

interface OverviewViewProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
  hasContent?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  return (
    <div className="overview-container">
      {/* 1. Full-Viewport Hero Experience */}
      <HeroSection 
        onCreateGraph={onCreateGraph}
        onExploreDemo={onExploreDemo}
      />

      {/* 2. Scroll-Driven Product Story: From Material to Meaning */}
      <FromMaterialToMeaning 
        onExploreWorkspace={onExploreDemo}
        onUploadMaterial={onCreateGraph}
      />

      {/* 3. Transition to Next Steps / Action */}
      <section className="overview-next-section">
        <div className="overview-next-card">
          <div className="overview-next-content">
            <span className="overview-next-eyebrow">Ready to map your material?</span>
            <h3 className="overview-next-heading">
              Transform your lectures, papers, and notes into living knowledge.
            </h3>
            <p className="overview-next-desc">
              Upload any document to extract core concepts, discover hidden connections, and navigate your study topics visually.
            </p>
          </div>
          <div className="overview-next-actions">
            <button className="btn-primary" onClick={onCreateGraph}>
              <Plus size={14} aria-hidden="true" />
              <span>Upload material</span>
            </button>
            <button className="btn-secondary" onClick={onExploreDemo}>
              <span>Open interactive workspace</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

