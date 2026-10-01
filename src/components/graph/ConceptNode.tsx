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
    concept.dimmed ? 'dimmed' : '',
    concept.craftingNew ? 'crafting-new' : '',
    concept.craftingActive ? 'crafting-active' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={nodeClasses}>
      {/* Handles on all 4 sides for natural organic connections */}
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

      {/* 1. Concept-type label + Active crafting pip */}
      <div className="node-card-header">
        <span className="node-card-type">{concept.category}</span>
        {concept.craftingActive && (
          <span className="node-crafting-pip" title="Synthesizing concept">
            <span className="crafting-pip-dot" />
            <span className="crafting-pip-text">Extracting</span>
          </span>
        )}
      </div>

      {/* 2. Concept name */}
      <div className="node-card-name-row">
        <span className="node-card-name">{concept.label}</span>
        {isSelected && <span className="node-accent-pip" />}
      </div>

      {/* 3. One-line short description / brief */}
      <p className="node-card-brief" title={concept.description}>
        {concept.description}
      </p>
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
