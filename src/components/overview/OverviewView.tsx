import React from 'react';
import { HeroSection } from './HeroSection';
import { FromMaterialToMeaning } from './FromMaterialToMeaning';
import { EditorialCTASection } from './EditorialCTASection';
import { FooterSection } from './FooterSection';

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

      {/* 3. Final Typographic Editorial Composition */}
      <EditorialCTASection 
        onUploadMaterial={onCreateGraph}
        onExploreWorkspace={onExploreDemo}
      />

      {/* 4. Editorial Typographic Footer — Giant GRAPHMIND Wordmark */}
      <FooterSection
        onUploadMaterial={onCreateGraph}
      />
    </div>
  );
};

