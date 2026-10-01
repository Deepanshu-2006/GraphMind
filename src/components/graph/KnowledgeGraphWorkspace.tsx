import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType
} from '@xyflow/react';
import type { Node, NodeMouseHandler } from '@xyflow/react';
import { UploadCloud } from 'lucide-react';

import { ConceptNode } from './ConceptNode';
import { CustomEdge } from './CustomEdge';
import { GraphToolbar } from './GraphToolbar';
import { NodeContextPanel } from './NodeContextPanel';

import { initialNodes, initialEdges, initialConceptDetails } from '../../data/graphData';
import type { GraphConceptData } from '../../types/graph';

const nodeTypes = {
  conceptNode: ConceptNode
};

const edgeTypes = {
  custom: CustomEdge
};

interface KnowledgeGraphWorkspaceProps {
  onOpenUpload?: () => void;
}

function FlowCanvas({ onOpenUpload }: KnowledgeGraphWorkspaceProps) {
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphConceptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('dl'); // Deep Learning selected initially as hero example
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // Selected concept data
  const activeConceptData = useMemo(() => {
    if (!selectedNodeId) return null;
    return initialConceptDetails[selectedNodeId] || null;
  }, [selectedNodeId]);

  // Apply node and edge focus states (Section 5, 6, 8)
  useEffect(() => {
    const connected = new Set<string>();
    if (selectedNodeId) {
      connected.add(selectedNodeId);
      initialEdges.forEach((edge) => {
        if (edge.source === selectedNodeId) connected.add(edge.target);
        if (edge.target === selectedNodeId) connected.add(edge.source);
      });
    }

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isConnected = connected.has(node.id);
        const hasSelection = Boolean(selectedNodeId);

        const dimmed = hasSelection && !isConnected;
        const highlighted = hasSelection && isConnected && !isSelected;

        return {
          ...node,
          selected: isSelected,
          data: {
            ...node.data,
            selected: isSelected,
            dimmed,
            highlighted
          }
        };
      })
    );

    // Apply edge highlighting with subtle green for active paths (Section 6)
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const isIncident = Boolean(
          selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
        );
        const hasSelection = Boolean(selectedNodeId);
        const isDimmed = hasSelection && !isIncident;

        return {
          ...edge,
          selected: isIncident,
          style: {
            stroke: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.08)' : '#333333',
            strokeWidth: isIncident ? 1.75 : 1.25,
            opacity: isDimmed ? 0.3 : 1
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isIncident ? '#A3FF12' : isDimmed ? '#262626' : '#3E3E3E',
            width: 12,
            height: 12
          }
        };
      })
    );
  }, [selectedNodeId, setNodes, setEdges]);

  // Node Click Selection
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setIsInspectorOpen(true);
  }, []);

  // Background Click (Deselection)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
  }, []);

  // Focus on a specific node smoothly
  const handleFocusNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      setIsInspectorOpen(true);
      reactFlowInstance.setCenter(node.position.x + 110, node.position.y + 45, {
        zoom: 1.05,
        duration: 500
      });
    }
  }, [nodes, reactFlowInstance]);

  // Fit View (Section 8: automatically position and scale so relevant nodes are visible with comfortable padding)
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.22, duration: 350 });
  }, [reactFlowInstance]);

  // Reset View (Section 9: restore default graph camera position without resetting node positions)
  const handleResetView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.22, duration: 350 });
  }, [reactFlowInstance]);

  // Zoom In / Out (Section 7: 200ms smooth incremental zoom)
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn({ duration: 200 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut({ duration: 200 });
  }, [reactFlowInstance]);

  const searchItems = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      category: n.data.category,
      code: n.data.code
    }));
  }, [nodes]);

  // Empty state (Section 15: "Build your knowledge graph")
  if (nodes.length === 0) {
    return (
      <div className="graph-empty-canvas-container">
        <div className="graph-empty-box">
          <h2 className="graph-empty-title">Build your knowledge graph</h2>
          <p className="graph-empty-desc">
            Upload a paper, lecture, notes, or other learning material and GraphMind will map the concepts and relationships for you.
          </p>
          <button 
            className="btn-primary"
            onClick={onOpenUpload || handleResetView}
          >
            <UploadCloud size={14} />
            <span>Upload material</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="freeform-graph-container" id="knowledge-graph-workspace">
      {/* Minimal Floating Toolbar (Section 7 & 11) */}
      <GraphToolbar
        onSearchSelect={handleFocusNode}
        onFitView={handleFitView}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        availableNodes={searchItems}
      />

      {/* Dominant Freeform Canvas (Section 1 & 14) */}
      <main className="freeform-canvas-hero">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          // Interaction Configuration (Sections 1, 2, 3, 11)
          panOnDrag={true}
          panOnScroll={false}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          preventScrolling={true}
          nodesDraggable={true}
          nodeDragThreshold={2}
          selectNodesOnDrag={false}
          elementsSelectable={true}
          // Zoom bounds & fit options
          minZoom={0.25}
          maxZoom={2.0}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'custom' }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={32} 
            size={1} 
            color="rgba(255, 255, 255, 0.04)" 
          />
        </ReactFlow>
      </main>

      {/* Compact Floating Contextual Inspector (Section 9) */}
      <NodeContextPanel
        concept={activeConceptData}
        onClose={() => setIsInspectorOpen(false)}
        onSelectConcept={handleFocusNode}
        onFocusNode={handleFocusNode}
        isCollapsed={!isInspectorOpen || !selectedNodeId}
      />
    </div>
  );
}

export function KnowledgeGraphWorkspace({ onOpenUpload }: KnowledgeGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas onOpenUpload={onOpenUpload} />
    </ReactFlowProvider>
  );
}

export default KnowledgeGraphWorkspace;
