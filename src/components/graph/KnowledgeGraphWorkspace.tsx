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

  // Compute connected node IDs for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();

    const connected = new Set<string>();
    connected.add(selectedNodeId);

    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) connected.add(edge.target);
      if (edge.target === selectedNodeId) connected.add(edge.source);
    });

    return connected;
  }, [selectedNodeId, edges]);

  // Apply node and edge focus states (Section 7 & 9)
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isConnected = connectedNodeIds.has(node.id);
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

    // Apply edge highlighting with directional arrows and green active states
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
            stroke: isIncident ? '#B7FF2A' : isDimmed ? 'rgba(255, 255, 255, 0.05)' : '#303030',
            strokeWidth: isIncident ? 1.75 : 1.25,
            opacity: isDimmed ? 0.2 : 1
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isIncident ? '#B7FF2A' : '#383838',
            width: 12,
            height: 12
          }
        };
      })
    );
  }, [selectedNodeId, connectedNodeIds, setNodes, setEdges]);

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
      reactFlowInstance.setCenter(node.position.x + 120, node.position.y + 65, {
        zoom: 1.1,
        duration: 600
      });
    }
  }, [nodes, reactFlowInstance]);

  // Fit View
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
  }, [reactFlowInstance]);

  // Reset View
  const handleResetView = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId('dl');
    setIsInspectorOpen(true);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 600 });
    }, 50);
  }, [setNodes, setEdges, reactFlowInstance]);

  // Zoom In / Out
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn({ duration: 300 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut({ duration: 300 });
  }, [reactFlowInstance]);

  // Add concept node freely to canvas (Section 12)
  const handleAddNode = useCallback(() => {
    const newId = `concept-${Date.now().toString().slice(-4)}`;
    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });

    const newNode: Node<GraphConceptData> = {
      id: newId,
      type: 'conceptNode',
      position: { x: center.x - 120, y: center.y - 65 },
      data: {
        id: newId,
        label: 'New Concept',
        code: 'NEW',
        category: 'Method',
        description: 'Double click to edit or define relationship linkages to other concepts on the canvas.',
        prerequisites: [],
        relationships: [],
        confidence: 90,
        source: 'User Note.txt',
        synapseCount: 0
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
    setIsInspectorOpen(true);
  }, [reactFlowInstance, setNodes]);

  const searchItems = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      category: n.data.category,
      code: n.data.code
    }));
  }, [nodes]);

  // Empty state handling (Section 13)
  if (nodes.length === 0) {
    return (
      <div className="graph-empty-canvas-container">
        <div className="graph-empty-box">
          <h2 className="graph-empty-title">Your knowledge graph is empty.</h2>
          <p className="graph-empty-desc">
            Upload your notes, lecture slides, PDFs, or text and GraphMind will turn them into connected concepts.
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
      {/* Minimal Floating Toolbar (Section 12) */}
      <GraphToolbar
        onSearchSelect={handleFocusNode}
        onFitView={handleFitView}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onAddNode={handleAddNode}
        availableNodes={searchItems}
      />

      {/* Dominant Freeform Canvas (Section 1 & 3) */}
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
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.25}
          maxZoom={2.4}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'custom' }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={32} 
            size={1} 
            color="rgba(255, 255, 255, 0.05)" 
          />
        </ReactFlow>
      </main>

      {/* Compact Floating Contextual Inspector (Section 7) */}
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
