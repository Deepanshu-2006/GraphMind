import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GraphConceptData } from '../../types/graph';

export const ConceptNode = memo(({ data, selected }: NodeProps) => {
  const concept = data as unknown as GraphConceptData;
  const isSelected = selected || concept.selected;

  const nodeClasses = [
    'knowledge-node-card',
    isSelected ? 'selected' : '',
    concept.highlighted ? 'highlighted' : '',
    concept.dimmed ? 'dimmed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={nodeClasses}>
      {/* Target Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="node-handle"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="node-handle"
      />

      {/* Header: Title + Category */}
      <div className="node-card-header">
        <div className="node-title-row">
          <span className="node-card-title">{concept.label}</span>
          {isSelected && <span className="node-accent-pip" />}
        </div>
        <span className="node-card-category">{concept.category}</span>
      </div>

      {/* Short 2-3 line explanation */}
      <p className="node-card-desc">
        {concept.description}
      </p>

      {/* Source Citation */}
      <div className="node-card-source">
        <span>{concept.source}</span>
      </div>

      {/* Source Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="node-handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="node-handle"
      />
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
