import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GraphConceptData } from '../../types/graph';

export const ConceptNode = memo(({ data, selected }: NodeProps) => {
  const concept = data as unknown as GraphConceptData;
  const isSelected = selected || concept.selected;
  const zoomLevel = concept.zoomLevel || 'standard';
  const visibilityState = concept.visibilityState || (isSelected ? 'focused' : 'visible');

  const practiceStatus = concept.practiceStatus || 'unseen';
  const isSessionRecalled = Boolean(concept.isSessionRecalled);
  const isSessionReview = Boolean(concept.isSessionReview);

  const isCore = Boolean(concept.isCoreConcept || concept.isPrerequisite || (concept as any).isCore);

  const nodeClasses = [
    'knowledge-node-card',
    isCore ? 'core-concept' : 'supporting-concept',
    `zoom-${zoomLevel}`,
    `state-${visibilityState}`,
    `practice-${practiceStatus}`,
    isSessionRecalled ? 'session-recalled' : '',
    isSessionReview ? 'session-review' : '',
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

  const sessionStatusText = isSessionRecalled ? ' Recalled in session.' : isSessionReview ? ' Marked for review.' : '';

  return (
    <div 
      className={nodeClasses}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Concept: ${concept.label}. ${concept.category}.${isSelected ? ' Selected.' : ''} Practice: ${practiceStatus}.${sessionStatusText} ${concept.description || ''}`}
      aria-pressed={Boolean(isSelected)}
      aria-current={isSelected ? 'true' : undefined}
      data-concept-id={concept.id}
    >
      {/* Handles on all 4 sides for natural organic connections without crossing */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="node-handle"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className="node-handle"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className="node-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
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
        position={Position.Top}
        id="source-top"
        className="node-handle"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className="node-handle"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="node-handle"
      />

      {/* 1. Header: TYPE metadata on left, state indicator dot on upper right */}
      <div className="node-card-header">
        <span className="node-card-type">{concept.category || 'CONCEPT'}</span>
        <span 
          className={`node-state-indicator ${
            isSessionReview
              ? 'practice-needs-review'
              : isSessionRecalled
              ? 'practice-understood'
              : practiceStatus !== 'unseen'
              ? `practice-${practiceStatus}`
              : ''
          }`} 
          aria-hidden="true" 
        />
      </div>

      {/* 2. Concept name row: Visual focal point */}
      <div className="node-card-name-row">
        <span className="node-card-name" title={concept.label}>{concept.label}</span>
      </div>

      {/* 3. Description: Supports concept without competing */}
      {concept.description && (
        <p className="node-card-brief" title={concept.description}>
          {concept.description}
        </p>
      )}
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
