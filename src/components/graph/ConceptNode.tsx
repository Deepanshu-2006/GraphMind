import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GraphConceptData } from '../../types/graph';

export const ConceptNode = memo(({ data, selected }: NodeProps) => {
  const concept = data as unknown as GraphConceptData;
  const isSelected = selected || concept.selected;
  const zoomLevel = concept.zoomLevel || 'standard';
  const visibilityState = concept.visibilityState || (isSelected ? 'focused' : 'visible');

  const nodeClasses = [
    'knowledge-node-card',
    `zoom-${zoomLevel}`,
    `state-${visibilityState}`,
    isSelected ? 'selected' : '',
    concept.highlighted ? 'highlighted' : '',
    concept.dimmed ? 'dimmed' : '',
    concept.craftingNew ? 'crafting-new' : '',
    concept.craftingActive ? 'crafting-active' : ''
  ].filter(Boolean).join(' ');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  };

  return (
    <div 
      className={nodeClasses}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Concept: ${concept.label}. ${concept.category}.${isSelected ? ' Selected.' : ''} ${concept.description || ''}`}
      aria-pressed={Boolean(isSelected)}
      aria-current={isSelected ? 'true' : undefined}
      data-concept-id={concept.id}
    >
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

      {/* 1. Header (Category type & status) */}
      {zoomLevel !== 'simplified' && (
        <div className="node-card-header">
          <span className="node-card-type">{concept.category}</span>
          {concept.craftingActive ? (
            <span className="node-crafting-pip" title="Synthesizing concept">
              <span className="crafting-pip-dot" />
              <span className="crafting-pip-text">Extracting</span>
            </span>
          ) : zoomLevel === 'detailed' && concept.synapseCount > 0 ? (
            <span className="node-synapse-badge" title={`${concept.synapseCount} connections`}>
              {concept.synapseCount} rel
            </span>
          ) : null}
        </div>
      )}

      {/* 2. Concept name row */}
      <div className="node-card-name-row">
        {zoomLevel === 'simplified' && (
          <span 
            className={`node-category-dot cat-${(concept.category || 'foundation').toLowerCase()}`} 
            title={concept.category}
          />
        )}
        <span className="node-card-name" title={concept.label}>{concept.label}</span>
        {isSelected && <span className="node-accent-pip" aria-hidden="true" />}
      </div>

      {/* 3. Description: Progressive disclosure based on zoom */}
      {zoomLevel !== 'simplified' && concept.description && (
        <p className="node-card-brief" title={concept.description}>
          {concept.description}
        </p>
      )}

      {/* 4. Rich contextual meta (Zoomed In only) */}
      {zoomLevel === 'detailed' && concept.source && (
        <div className="node-card-footer">
          <span className="node-source-preview" title={concept.source}>
            {concept.source}
          </span>
        </div>
      )}
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
