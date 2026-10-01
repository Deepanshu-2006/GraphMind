import React from 'react';
import type { MetricItem } from '../../types';

interface MetricsGridProps {
  metrics: MetricItem[];
}

export const MetricsGrid: React.FC<MetricsGridProps> = () => {
  return (
    <div className="quiet-project-summary">
      <span className="summary-item">24 documents</span>
      <span className="summary-separator">·</span>
      <span className="summary-item">418 concepts</span>
      <span className="summary-separator">·</span>
      <span className="summary-item">1,280 relationships</span>
    </div>
  );
};
