import React, { useState } from 'react';
import { HeroSection } from './HeroSection';
import { MetricsGrid } from './MetricsGrid';
import { ConnectedConcepts } from './ConnectedConcepts';
import { EmptyState } from '../shared/EmptyState';
import { LoadingState } from '../shared/LoadingState';
import { mockMetrics, mockConnectedConcepts } from '../../data/mockData';
import { Eye } from 'lucide-react';

interface OverviewViewProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  // Demonstration state switcher to verify empty and loading states requested in prompt
  const [viewState, setViewState] = useState<'loaded' | 'empty' | 'loading'>('loaded');

  return (
    <div className="overview-container">
      {/* State Switcher Bar for UI Demonstration & Testing */}
      <div className="state-control-strip">
        <div className="state-strip-label">
          <Eye size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>Interactive State Mode:</span>
        </div>
        <div className="state-pills-group">
          <button
            className={`state-toggle-pill ${viewState === 'loaded' ? 'active' : ''}`}
            onClick={() => setViewState('loaded')}
            id="state-toggle-loaded"
          >
            Active Knowledge Base
          </button>
          <button
            className={`state-toggle-pill ${viewState === 'loading' ? 'active' : ''}`}
            onClick={() => setViewState('loading')}
            id="state-toggle-loading"
          >
            Synthesis Loading State
          </button>
          <button
            className={`state-toggle-pill ${viewState === 'empty' ? 'active' : ''}`}
            onClick={() => setViewState('empty')}
            id="state-toggle-empty"
          >
            Empty State Preview
          </button>
        </div>
      </div>

      {/* Main View Content based on state */}
      {viewState === 'loading' && <LoadingState />}

      {viewState === 'empty' && (
        <EmptyState 
          onAction={onCreateGraph}
          onLoadDemo={() => setViewState('loaded')}
        />
      )}

      {viewState === 'loaded' && (
        <>
          {/* Hero Section */}
          <HeroSection 
            onCreateGraph={onCreateGraph}
            onExploreDemo={onExploreDemo}
          />

          {/* Project Overview Metrics (4 realistic demo values) */}
          <MetricsGrid metrics={mockMetrics} />

          {/* Recent Knowledge: Connected Concepts */}
          <ConnectedConcepts 
            concepts={mockConnectedConcepts}
            onOpenExplore={onExploreDemo}
          />
        </>
      )}
    </div>
  );
};
