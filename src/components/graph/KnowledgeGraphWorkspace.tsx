import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType
} from '@xyflow/react';
import type { Node, NodeMouseHandler } from '@xyflow/react';

import { ConceptNode } from './ConceptNode';
import { CustomEdge } from './CustomEdge';
import { GraphToolbar } from './GraphToolbar';
import { GraphSidebarLeft } from './GraphSidebarLeft';
import { NodeContextPanel } from './NodeContextPanel';

import { initialNodes, initialEdges, initialConceptDetails } from '../../data/graphData';
import type { FilterCategory, GraphLayoutMode, GraphConceptData } from '../../types/graph';

// Organic Layout Coordinates
const organicPositions: Record<string, { x: number; y: number }> = {
  'ml': { x: 120, y: 320 },
  'dl': { x: 440, y: 300 },
  'nn': { x: 740, y: 160 },
  'attn': { x: 740, y: 440 },
  'cnn': { x: 1040, y: 80 },
  'rnn': { x: 1040, y: 240 },
  'tf': { x: 1040, y: 440 },
  'cv': { x: 1320, y: 80 },
  'nlp': { x: 1320, y: 340 }
};

// Hierarchical Layout Coordinates
const hierarchicalPositions: Record<string, { x: number; y: number }> = {
  'ml': { x: 60, y: 240 },
  'dl': { x: 330, y: 240 },
  'nn': { x: 600, y: 130 },
  'attn': { x: 600, y: 360 },
  'cnn': { x: 880, y: 50 },
  'rnn': { x: 880, y: 200 },
  'tf': { x: 880, y: 360 },
  'cv': { x: 1160, y: 50 },
  'nlp': { x: 1160, y: 280 }
};

const nodeTypes = {
  conceptNode: ConceptNode
};

const edgeTypes = {
  custom: CustomEdge
};

function FlowCanvas() {
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphConceptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('tf'); // Default to Transformers as in example
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('hierarchical');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);

  // Selected concept details
  const activeConceptData = useMemo(() => {
    if (!selectedNodeId) return null;
    return initialConceptDetails[selectedNodeId] || null;
  }, [selectedNodeId]);

  // Compute connected nodes for highlighting
  const connectedNodeIds = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return new Set<string>();

    const connected = new Set<string>();
    connected.add(targetId);

    edges.forEach((edge) => {
      if (edge.source === targetId) connected.add(edge.target);
      if (edge.target === targetId) connected.add(edge.source);
    });

    return connected;
  }, [hoveredNodeId, selectedNodeId, edges]);

  // Apply node highlighting, dimming, and category filters
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isConnected = connectedNodeIds.has(node.id);
        const hasSelection = Boolean(hoveredNodeId || selectedNodeId);

        // Check filter matching
        let matchesFilter = true;
        if (activeFilter === 'CONCEPTS') {
          matchesFilter = node.data.category === 'Foundation' || node.data.category === 'Paradigm';
        } else if (activeFilter === 'PREREQUISITES') {
          matchesFilter = Boolean(node.data.isPrerequisite);
        } else if (activeFilter === 'APPLICATIONS') {
          matchesFilter = node.data.category === 'Application';
        } else if (activeFilter === 'METHODS') {
          matchesFilter = node.data.category === 'Method' || node.data.category === 'Architecture';
        }

        const dimmed = (hasSelection && !isConnected) || !matchesFilter;
        const highlighted = (hasSelection && isConnected && !isSelected) || (isSelected && matchesFilter);

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

    // Apply edge highlighting
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const targetId = hoveredNodeId || selectedNodeId;
        const isIncident = Boolean(targetId && (edge.source === targetId || edge.target === targetId));

        return {
          ...edge,
          selected: isIncident,
          animated: isIncident || edge.data?.relation === 'BASED_ON' || edge.data?.relation === 'USED_FOR',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isIncident ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.4)',
            width: 14,
            height: 14
          }
        };
      })
    );
  }, [selectedNodeId, hoveredNodeId, activeFilter, connectedNodeIds, setNodes, setEdges]);

  // Node Selection Handler
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setIsRightPanelCollapsed(false);
  }, []);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Pane Click (Deselection)
  const onPaneClick = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Smoothly focus on a node
  const handleFocusNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNodeId(nodeId);
      setIsRightPanelCollapsed(false);
      reactFlowInstance.setCenter(node.position.x + 110, node.position.y + 45, {
        zoom: 1.15,
        duration: 800
      });
    }
  }, [nodes, reactFlowInstance]);

  // Handle Layout Switch (Hierarchical vs Organic)
  const handleLayoutChange = useCallback((newLayout: GraphLayoutMode) => {
    setLayoutMode(newLayout);
    const coordsMap = newLayout === 'organic' ? organicPositions : hierarchicalPositions;

    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        position: coordsMap[node.id] || node.position
      }))
    );

    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.18, duration: 600 });
    }, 50);
  }, [setNodes, reactFlowInstance]);

  // Fit View
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.18, duration: 600 });
  }, [reactFlowInstance]);

  // Reset View
  const handleResetView = useCallback(() => {
    handleLayoutChange('hierarchical');
  }, [handleLayoutChange]);

  // Toggle Focus Mode (Canvas Only)
  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      const next = !prev;
      setIsLeftSidebarCollapsed(next);
      setIsRightPanelCollapsed(next);
      return next;
    });
  }, []);

  // Node color helper for MiniMap
  const nodeColor = useCallback((node: Node) => {
    const cat = (node.data as unknown as GraphConceptData)?.category;
    switch (cat) {
      case 'Foundation': return '#00f2fe';
      case 'Paradigm': return '#818cf8';
      case 'Architecture': return '#10b981';
      case 'Method': return '#f59e0b';
      case 'Application': return '#f43f5e';
      default: return '#64748b';
    }
  }, []);

  const allConceptDetailsList = useMemo(() => {
    return Object.values(initialConceptDetails);
  }, []);

  return (
    <div className="graph-page-container">
      {/* Top Toolbar */}
      <GraphToolbar
        onSearchSelect={handleFocusNode}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        currentLayout={layoutMode}
        onLayoutChange={handleLayoutChange}
        onFitView={handleFitView}
        onResetView={handleResetView}
        isFocusMode={isFocusMode}
        onToggleFocusMode={handleToggleFocusMode}
        availableNodes={allConceptDetailsList}
      />

      {/* 3-Pane Body: Left Sidebar + Center Hero Canvas + Right Context Panel */}
      <div className="graph-workspace-body">
        {/* Left Navigator Sidebar */}
        <GraphSidebarLeft
          concepts={allConceptDetailsList}
          selectedConceptId={selectedNodeId}
          onSelectConcept={handleFocusNode}
          isCollapsed={isLeftSidebarCollapsed}
          onToggleCollapse={() => setIsLeftSidebarCollapsed((prev) => !prev)}
        />

        {/* Center Interactive Canvas (HERO) */}
        <main className="graph-canvas-hero" id="knowledge-graph-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.3}
            maxZoom={2.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={28} 
              size={1} 
              color="rgba(255, 255, 255, 0.08)" 
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={2}
              zoomable
              pannable
            />
          </ReactFlow>
        </main>

        {/* Right Context Panel (Opens when node is selected) */}
        <NodeContextPanel
          concept={activeConceptData}
          onClose={() => setIsRightPanelCollapsed(true)}
          onSelectConcept={handleFocusNode}
          onFocusNode={handleFocusNode}
          isCollapsed={isRightPanelCollapsed}
        />
      </div>
    </div>
  );
}

export function KnowledgeGraphWorkspace() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}

export default KnowledgeGraphWorkspace;
