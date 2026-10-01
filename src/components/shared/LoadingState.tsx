import React from 'react';
import { Cpu } from 'lucide-react';

export const LoadingState: React.FC = () => {
  return (
    <div className="loading-state-wrapper" id="loading-state-view">
      <div className="loading-graph-spinner" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <span className="loading-text">SYNTHESIZING GRAPH TOPOLOGY...</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <Cpu size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>Vectorizing semantic embeddings • Extracting entity synapses</span>
        </div>
      </div>
    </div>
  );
};
