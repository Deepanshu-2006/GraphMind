import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { Plus } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

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

export type WorkspaceMode = 'interactive' | 'empty' | 'loading' | 'crafting';

interface KnowledgeGraphWorkspaceProps {
  onOpenUpload?: () => void;
  initialMode?: WorkspaceMode;
}

// Progressive Crafting Steps (Prompt 8, Section 3 & 5)
const CRAFTING_SEQUENCE = [
  {
    stage: 0,
    status: 'Reading your sources…',
    nodeIds: ['ml', 'dl'],
    edgeIds: ['e-ml-dl'],
    newNodes: ['ml', 'dl'],
    activeNodeId: 'ml',
    duration: 3200
  },
  {
    stage: 1,
    status: 'Discovering core concepts…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn'],
    newNodes: ['nn', 'cnn', 'rnn'],
    activeNodeId: 'nn',
    duration: 3500
  },
  {
    stage: 2,
    status: 'Connecting relationships…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn'],
    newNodes: [],
    activeNodeId: 'dl',
    duration: 3000
  },
  {
    stage: 3,
    status: 'Crafting your knowledge graph…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn', 'attn', 'tf', 'cv', 'nlp'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn', 'e-attn-tf', 'e-dl-tf', 'e-tf-nlp', 'e-cnn-cv'],
    newNodes: ['attn', 'tf', 'cv', 'nlp'],
    activeNodeId: 'tf',
    duration: 3200
  },
  {
    stage: 4,
    status: 'Graph ready.',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn', 'attn', 'tf', 'cv', 'nlp'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn', 'e-attn-tf', 'e-dl-tf', 'e-tf-nlp', 'e-cnn-cv'],
    newNodes: [],
    activeNodeId: 'dl',
    duration: 1800
  }
];

function FlowCanvas({ onOpenUpload, initialMode = 'interactive' }: KnowledgeGraphWorkspaceProps) {
  const reactFlowInstance = useReactFlow();

  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoadingOrbVisible, setIsLoadingOrbVisible] = useState<boolean>(false);
  const [isOverlayMounted, setIsOverlayMounted] = useState<boolean>(false);
  const [isCanvasDimmed, setIsCanvasDimmed] = useState<boolean>(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphConceptData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('dl');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  const craftingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected concept data for inspector
  const activeConceptData = useMemo(() => {
    if (!selectedNodeId) return null;
    return initialConceptDetails[selectedNodeId] || null;
  }, [selectedNodeId]);

  // Crafting Animation Runner (Prompt 8, Section 3 & User Iteration)
  // Runs progressive crafting directly behind the loading orb with reduced opacity
  const runCraftingAnimation = useCallback((withLoadingOrb: boolean = false) => {
    if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setMode('crafting');
    setSelectedNodeId(null);
    setIsInspectorOpen(false);

    if (withLoadingOrb) {
      setIsLoadingOrbVisible(true);
      setIsOverlayMounted(true);
      setIsCanvasDimmed(true);
    } else {
      setIsLoadingOrbVisible(false);
      setIsOverlayMounted(false);
      setIsCanvasDimmed(false);
    }

    let currentStep = 0;

    const executeStep = (stepIdx: number) => {
      const step = CRAFTING_SEQUENCE[stepIdx];
      setStatusMessage(step.status);

      // At Step 2 (Relationships connecting), smoothly dissolve the loading orb overlay and brighten canvas
      if (stepIdx === 2) {
        setIsLoadingOrbVisible(false);
        setIsCanvasDimmed(false);
        fadeTimerRef.current = setTimeout(() => {
          setIsOverlayMounted(false);
        }, 750);
      }

      // Build active subset of nodes
      const activeNodeMap = new Set(step.nodeIds);
      const newNodesSet = new Set(step.newNodes);

      const nextNodes: Node<GraphConceptData>[] = initialNodes
        .filter((n) => activeNodeMap.has(n.id))
        .map((n) => ({
          ...n,
          data: {
            ...n.data,
            craftingNew: newNodesSet.has(n.id),
            craftingActive: n.id === step.activeNodeId,
            selected: false,
            highlighted: false,
            dimmed: false
          }
        }));

      // Build active subset of edges (animated dashed filaments during loading/discovery, solid arrows during crafting)
      const activeEdgeMap = new Set(step.edgeIds);
      const nextEdges = initialEdges
        .filter((e) => activeEdgeMap.has(e.id))
        .map((edge) => {
          const isFilament = stepIdx < 2;
          return {
            ...edge,
            className: isFilament ? 'crafting-filament-edge' : '',
            style: {
              stroke: isFilament ? 'rgba(163, 255, 18, 0.45)' : '#A3FF12',
              strokeWidth: isFilament ? 1.5 : 1.75,
              opacity: isFilament ? 0.75 : 1
            },
            markerEnd: isFilament
              ? undefined
              : {
                  type: MarkerType.ArrowClosed,
                  width: 14,
                  height: 14,
                  color: '#A3FF12'
                }
          };
        });

      setNodes(nextNodes);
      setEdges(nextEdges);

      // Camera stabilization with generous padding while HUD is open so nodes never touch the HUD
      setTimeout(() => {
        const hudPadding = stepIdx < 2 ? 0.46 : 0.22;
        reactFlowInstance.fitView({ padding: hudPadding, duration: 800 });
      }, 50);

      // Schedule next step
      if (stepIdx < CRAFTING_SEQUENCE.length - 1) {
        craftingTimerRef.current = setTimeout(() => {
          executeStep(stepIdx + 1);
        }, step.duration);
      } else {
        // Section 6: Final transition
        craftingTimerRef.current = setTimeout(() => {
          setStatusMessage('');
          setIsLoadingOrbVisible(false);
          setIsOverlayMounted(false);
          setIsCanvasDimmed(false);
          setMode('interactive');
          setSelectedNodeId('dl');
          setIsInspectorOpen(true);

          // Restore normal edges and node styling
          setEdges(initialEdges);
          reactFlowInstance.fitView({ padding: 0.22, duration: 700 });
        }, step.duration);
      }
    };

    executeStep(currentStep);
  }, [reactFlowInstance, setEdges, setNodes]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // Full Loading Orb with crafting visible behind at less opacity -> progressive crafting -> interactive
  const handleStartFullSequence = useCallback(() => {
    runCraftingAnimation(true);
  }, [runCraftingAnimation]);

  // When initialMode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialMode === 'loading') {
        handleStartFullSequence();
      } else if (initialMode === 'crafting') {
        runCraftingAnimation(false);
      } else if (initialMode === 'empty') {
        setNodes([]);
        setEdges([]);
        setIsLoadingOrbVisible(false);
        setIsOverlayMounted(false);
        setIsCanvasDimmed(false);
        setMode('empty');
      } else {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setIsLoadingOrbVisible(false);
        setIsOverlayMounted(false);
        setIsCanvasDimmed(false);
        setMode('interactive');
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [initialMode, handleStartFullSequence, runCraftingAnimation, setEdges, setNodes]);

  // Apply node focus states in interactive mode
  useEffect(() => {
    if (mode !== 'interactive') return;

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

        return {
          ...node,
          selected: isSelected,
          data: {
            ...node.data,
            craftingNew: false,
            craftingActive: false,
            selected: isSelected,
            dimmed: hasSelection && !isConnected,
            highlighted: hasSelection && isConnected && !isSelected
          }
        };
      })
    );

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
            width: 14,
            height: 14,
            color: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.15)' : '#444444'
          }
        };
      })
    );
  }, [selectedNodeId, mode, setNodes, setEdges]);

  // Node Click handler
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (mode !== 'interactive') return;
      setSelectedNodeId(node.id);
      setIsInspectorOpen(true);
    },
    [mode]
  );

  // Pane Click handler
  const handlePaneClick = useCallback(() => {
    if (mode !== 'interactive') return;
    setSelectedNodeId(null);
  }, [mode]);

  // Escape Key to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'interactive') {
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Toolbar actions
  const handleResetView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.22, duration: 350 });
  }, [reactFlowInstance]);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn({ duration: 200 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut({ duration: 200 });
  }, [reactFlowInstance]);

  const searchItems = useMemo(() => {
    return initialNodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      category: n.data.category,
      code: n.data.code
    }));
  }, []);

  const handleSwitchToEmpty = () => {
    if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setStatusMessage('');
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
    setIsLoadingOrbVisible(false);
    setIsOverlayMounted(false);
    setIsCanvasDimmed(false);
    setMode('empty');
  };

  const handleSwitchToInteractive = () => {
    if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setStatusMessage('');
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId('dl');
    setIsInspectorOpen(true);
    setIsLoadingOrbVisible(false);
    setIsOverlayMounted(false);
    setIsCanvasDimmed(false);
    setMode('interactive');
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.22, duration: 400 });
    }, 50);
  };

  const handleSwitchToLoading = () => {
    runCraftingAnimation(true);
  };

  return (
    <div className="freeform-graph-container" id="knowledge-graph-workspace">
      {/* 1. Processing Status Banner (Prompt 8, Section 5 - shown once loading orb dissolves or in direct crafting) */}
      {mode === 'crafting' && !isLoadingOrbVisible && statusMessage && (
        <div className="graph-crafting-indicator" role="status" aria-live="polite">
          <span className="crafting-indicator-dot" />
          <span className="crafting-indicator-text">{statusMessage}</span>
        </div>
      )}

      {/* Floating Toolbar */}
      <GraphToolbar
        onSearchSelect={(nodeId) => {
          setSelectedNodeId(nodeId);
          setIsInspectorOpen(true);
        }}
        onFitView={handleResetView}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        availableNodes={searchItems}
      />

      {/* Mode Controls Pill Group (Left-aligned next to toolbar for seamless inspection) */}
      <div className="workspace-mode-controls">
        <button
          type="button"
          className={`mode-btn ${mode === 'interactive' ? 'active' : ''}`}
          onClick={handleSwitchToInteractive}
          title="Interactive graph exploration"
        >
          Interactive
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'crafting' && !isOverlayMounted ? 'active' : ''}`}
          onClick={() => runCraftingAnimation(false)}
          title="Play progressive graph crafting animation"
        >
          Craft graph
        </button>
        <button
          type="button"
          className={`mode-btn ${isOverlayMounted || (mode === 'crafting' && isLoadingOrbVisible) ? 'active' : ''}`}
          onClick={handleSwitchToLoading}
          title="Loading orb with crafting visible behind"
        >
          Loading
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'empty' ? 'active' : ''}`}
          onClick={handleSwitchToEmpty}
          title="Empty canvas state"
        >
          Empty
        </button>
      </div>

      {/* Continuous ReactFlow Canvas with reduced opacity while loading orb is active */}
      <div className={`freeform-canvas-wrapper ${isCanvasDimmed ? 'dimmed-crafting' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          defaultViewport={{ x: 100, y: 80, zoom: 0.88 }}
          minZoom={0.2}
          maxZoom={2.4}
          panOnScroll={false}
          zoomOnScroll={true}
          panOnDrag={mode === 'interactive'}
          preventScrolling={true}
          attributionPosition="bottom-left"
          fitView={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#1C1D1C"
          />
        </ReactFlow>
      </div>

      {/* 2. EMPTY STATE OVERLAY (Prompt 8, Section 1) */}
      {mode === 'empty' && (
        <div className="graph-canvas-overlay empty-overlay" id="graph-empty-overlay">
          {/* Subtle ghost constellation wireframe */}
          <svg className="empty-canvas-ghost-svg" aria-hidden="true" viewBox="0 0 700 450">
            <g stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" opacity="0.25">
              <line x1="140" y1="200" x2="280" y2="140" />
              <line x1="280" y1="140" x2="420" y2="180" />
              <line x1="280" y1="140" x2="340" y2="300" />
              <line x1="420" y1="180" x2="540" y2="240" />
            </g>
            <g fill="#141414" stroke="var(--border-default)" strokeWidth="1" opacity="0.4">
              <circle cx="140" cy="200" r="16" />
              <circle cx="280" cy="140" r="20" />
              <circle cx="420" cy="180" r="18" />
              <circle cx="340" cy="300" r="15" />
              <circle cx="540" cy="240" r="16" />
            </g>
          </svg>

          <div className="graph-empty-box">
            <h2 className="graph-empty-title">Your knowledge graph will appear here.</h2>
            <p className="graph-empty-desc">
              Upload a paper, lecture, note, or transcript to begin.
            </p>
            <button 
              type="button"
              className="btn-primary"
              onClick={onOpenUpload}
              id="btn-empty-add-sources"
            >
              <Plus size={14} />
              <span>Add sources</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. LOADING STATE OVERLAY (Sleek horizontal glass pill HUD with unobstructed crafting constellation weaving behind) */}
      {isOverlayMounted && (
        <div 
          className={`graph-canvas-overlay loading-overlay ${!isLoadingOrbVisible ? 'fade-out' : ''}`} 
          id="graph-loading-overlay"
        >
          <div className="graph-loading-hud-pill">
            <div className="graph-loading-orb-wrap">
              <ThinkingOrb 
                state="connecting" 
                size={32} 
                theme="dark" 
                color="#A3FF12" 
                speed={0.85} 
              />
              <div className="orb-ambient-glow" aria-hidden="true" />
            </div>

            <div className="hud-pill-divider" aria-hidden="true" />

            <div className="graph-loading-text-group">
              <div className="hud-pill-title-row">
                <span className="graph-loading-title">GraphMind is getting ready</span>
              </div>
              <div className="graph-loading-badge">
                <span className="badge-pulse-dot" />
                <span className="badge-text">
                  {statusMessage || 'Reading your sources…'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 4. Inspector Context Panel (Interactive mode only) */}
      {mode === 'interactive' && isInspectorOpen && activeConceptData && (
        <NodeContextPanel
          concept={activeConceptData}
          onClose={() => setIsInspectorOpen(false)}
          onSelectConcept={(conceptId) => setSelectedNodeId(conceptId)}
          onFocusNode={(conceptId) => {
            setSelectedNodeId(conceptId);
            reactFlowInstance.fitView({ padding: 0.22, duration: 400 });
          }}
          isCollapsed={!isInspectorOpen}
        />
      )}
    </div>
  );
}

export function KnowledgeGraphWorkspace({
  onOpenUpload,
  initialMode = 'interactive'
}: KnowledgeGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas onOpenUpload={onOpenUpload} initialMode={initialMode} />
    </ReactFlowProvider>
  );
}
