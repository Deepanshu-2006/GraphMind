import type { MetricItem } from '../../types';
import { FileText, Cpu, Network, GitPullRequest, ArrowUpRight } from 'lucide-react';

interface MetricsGridProps {
  metrics: MetricItem[];
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const getMetricIcon = (id: string) => {
    switch (id) {
      case 'm1': return <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />;
      case 'm2': return <Cpu size={16} style={{ color: 'var(--accent-indigo)' }} />;
      case 'm3': return <Network size={16} style={{ color: 'var(--accent-emerald)' }} />;
      case 'm4': return <GitPullRequest size={16} style={{ color: 'var(--accent-amber)' }} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <section className="metrics-section">
      <div className="section-label-row">
        <span className="section-label">Project Knowledge Topology</span>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          REALTIME INDEXING ACTIVE
        </span>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.id} className="metric-card" id={`metric-card-${metric.id}`}>
            <div className="metric-header">
              <span className="metric-telemetry">{metric.telemetryCode}</span>
              <span className={`metric-delta ${metric.deltaDirection}`}>
                {metric.deltaDirection === 'up' && <ArrowUpRight size={12} />}
                <span>{metric.delta}</span>
              </span>
            </div>

            <div className="metric-body">
              <div className="metric-value-row">
                <span className="metric-value">{metric.value}</span>
                {metric.unit && <span className="metric-unit">{metric.unit}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                {getMetricIcon(metric.id)}
                <span className="metric-label">{metric.label}</span>
              </div>
            </div>

            <div className="metric-footer">
              <span>{metric.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
