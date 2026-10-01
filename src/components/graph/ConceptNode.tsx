import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GraphConceptData } from '../../types/graph';
import { Network, CheckCircle2 } from 'lucide-react';

const categoryColorMap: Record<string, string> = {
  Foundation: '#00f2fe',
  Paradigm: '#818cf8',
  Architecture: '#10b981',
  Method: '#f59e0b',
  Application: '#f43f5e'
};

export const ConceptNode = memo(({ data, selected }: NodeProps) => {
  const concept = data as unknown as GraphConceptData;
  const accentColor = categoryColorMap[concept.category] || '#00f2fe';

  const cardClasses = [
    'concept-node-card',
    selected || concept.selected ? 'selected' : '',
    concept.highlighted ? 'highlighted' : '',
    concept.dimmed ? 'dimmed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      style={{ '--node-accent-color': accentColor } as React.CSSProperties}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ left: -5, background: accentColor }}
      />
      
      {/* Target Handle (Top - for flexible multi-direction connectivity) */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{ top: -5, background: accentColor }}
      />

      {/* Node Top Row: Category & Code */}
      <div className="node-card-top">
        <span className="node-category-pill">
          {concept.category}
        </span>
        <span className="node-code">{concept.code}</span>
      </div>

      {/* Node Concept Title */}
      <div className="node-card-title">
        {concept.label}
      </div>

      {/* Node Footer: Synapse count & Confidence Score */}
      <div className="node-card-footer">
        <div className="node-synapse-badge" title={`${concept.synapseCount} connected synapses`}>
          <Network size={11} style={{ color: accentColor }} />
          <span>{concept.synapseCount} {concept.synapseCount === 1 ? 'link' : 'links'}</span>
        </div>

        <div className="node-confidence-meter" title={`Confidence: ${concept.confidence}%`}>
          <CheckCircle2 size={11} />
          <span>{concept.confidence}%</span>
        </div>
      </div>

      {/* Source Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ right: -5, background: accentColor }}
      />

      {/* Source Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{ bottom: -5, background: accentColor }}
      />
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
