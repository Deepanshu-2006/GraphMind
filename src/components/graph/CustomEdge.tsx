import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

export const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
  data
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);
  const edgeData = data as Record<string, unknown> | undefined;
  const isHighlighted = Boolean(selected || edgeData?.isHighlighted || edgeData?.highlighted || edgeData?.selected);

  // Prevent text overlap: Only render edge label badges when actively selected/highlighted or hovered.
  // Never render 40 unselected badges across the whole canvas.
  const shouldRenderLabel = Boolean(label) && (isHighlighted || isHovered);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke: isHighlighted ? '#A3FF12' : 'rgba(255, 255, 255, 0.12)',
          strokeWidth: isHighlighted ? 1.5 : 1,
          opacity: isHighlighted ? 1 : 0.85,
          transition: 'stroke 180ms ease, stroke-width 180ms ease, opacity 180ms ease',
          ...style,
        }}
      />
      {/* Invisible wider hit area for smooth hover interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {shouldRenderLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: isHighlighted ? 'all' : 'none',
              zIndex: isHighlighted ? 25 : 15,
              opacity: style?.opacity !== undefined ? style.opacity : 1,
              transition: 'opacity 180ms ease'
            }}
            className={`edge-semantic-badge ${isHighlighted ? 'active' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
