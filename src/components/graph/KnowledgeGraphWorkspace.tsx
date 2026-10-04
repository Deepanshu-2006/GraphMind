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
import type { Node, Edge, NodeMouseHandler, EdgeMouseHandler } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';

import { ConceptNode } from './ConceptNode';
import { CustomEdge } from './CustomEdge';
import { GraphToolbar } from './GraphToolbar';
import { NodeContextPanel } from './NodeContextPanel';

import { 
  initialNodes, 
  initialEdges, 
  initialConceptDetails,
  knowledgeGraphToReactFlow,
  normalizeCategory 
} from '../../data/graphData';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { 
  GraphConceptData, 
  SelectedRelationshipData, 
  GraphDensityMode, 
  ZoomDisclosureLevel 
} from '../../types/graph';
import type { PipelineStage, PipelineProgressEvent } from '../../services/pipelineOrchestrator';
import { exportKnowledgeGraphJson, exportKnowledgeGraphPng } from '../../services/graphExport';
import { calculateVisibleGraph } from '../../services/graphViewport';

const nodeTypes = {
  conceptNode: ConceptNode
};

const edgeTypes = {
  custom: CustomEdge
};

export type WorkspaceMode = 'interactive' | 'empty' | 'loading' | 'crafting';

export interface KnowledgeGraphWorkspaceProps {
  onOpenUpload?: () => void;
  initialMode?: WorkspaceMode;
  graph?: KnowledgeGraph;
  graphSourceType?: 'demo' | 'user';
  onSwitchGraphSource?: (type: 'demo' | 'user') => void;
  hasUserGraph?: boolean;
  pipelineStage?: PipelineStage;
  pipelineStatusMessage?: string;
  pipelineError?: string;
  onClearError?: () => void;
  livePipelineEvent?: PipelineProgressEvent | null;
  focusedNodeId?: string | null;
  onClearFocusedNode?: () => void;
  onSelectSource?: (sourceNameOrId?: string) => void;
}

// Progressive Crafting Steps (Prompt 22: Contextual processing copy)
const DEFAULT_CRAFTING_SEQUENCE = [
  {
    stage: 0,
    status: 'Reading your material…',
    nodeIds: ['ml', 'dl'],
    edgeIds: ['e-ml-dl'],
    newNodes: ['ml', 'dl'],
    activeNodeId: 'ml',
    duration: 2400
  },
  {
    stage: 1,
    status: 'Finding concepts…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn'],
    newNodes: ['nn', 'cnn', 'rnn'],
    activeNodeId: 'nn',
    duration: 2600
  },
  {
    stage: 2,
    status: 'Connecting ideas…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn'],
    newNodes: [],
    activeNodeId: 'dl',
    duration: 2200
  },
  {
    stage: 3,
    status: 'Building your knowledge graph…',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn', 'attn', 'tf', 'cv', 'nlp'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn', 'e-attn-tf', 'e-dl-tf', 'e-tf-nlp', 'e-cnn-cv'],
    newNodes: ['attn', 'tf', 'cv', 'nlp'],
    activeNodeId: 'tf',
    duration: 2400
  },
  {
    stage: 4,
    status: 'Your knowledge graph is ready.',
    nodeIds: ['ml', 'dl', 'nn', 'cnn', 'rnn', 'attn', 'tf', 'cv', 'nlp'],
    edgeIds: ['e-ml-dl', 'e-dl-nn', 'e-nn-cnn', 'e-nn-rnn', 'e-attn-tf', 'e-dl-tf', 'e-tf-nlp', 'e-cnn-cv'],
    newNodes: [],
    activeNodeId: 'dl',
    duration: 1500
  }
];

function FlowCanvas({
  onOpenUpload,
  initialMode = 'interactive',
  graph,
  pipelineStage,
  pipelineStatusMessage,
  pipelineError,
  onClearError,
  livePipelineEvent,
  focusedNodeId,
  onClearFocusedNode,
  onSelectSource
}: KnowledgeGraphWorkspaceProps) {
  const reactFlowInstance = useReactFlow();

  const { effectiveNodes, effectiveEdges, effectiveConceptDetails } = useMemo(() => {
    if (graph) {
      const rf = knowledgeGraphToReactFlow(graph);
      return {
        effectiveNodes: rf.nodes,
        effectiveEdges: rf.edges,
        effectiveConceptDetails: rf.conceptDetails
      };
    }
    return {
      effectiveNodes: initialNodes,
      effectiveEdges: initialEdges,
      effectiveConceptDetails: initialConceptDetails
    };
  }, [graph]);

  const [internalMode, setMode] = useState<WorkspaceMode>(initialMode);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const displayStatusMessage = livePipelineEvent?.message || statusMessage || pipelineStatusMessage || '';

  const isLiveProcessing = Boolean(
    livePipelineEvent &&
    livePipelineEvent.stage !== 'complete' &&
    livePipelineEvent.stage !== 'error'
  );
  const isLiveComplete = livePipelineEvent?.stage === 'complete';

  const mode: WorkspaceMode = isLiveProcessing
    ? 'crafting'
    : isLiveComplete
    ? 'interactive'
    : internalMode;

  const [isLoadingOrbVisible, setIsLoadingOrbVisible] = useState<boolean>(false);
  const [isOverlayMounted, setIsOverlayMounted] = useState<boolean>(false);
  const [isCanvasDimmed, setIsCanvasDimmed] = useState<boolean>(false);

  const effectiveOverlayMounted = isLiveProcessing ? true : isOverlayMounted;
  const effectiveLoadingOrbVisible = isLiveProcessing ? true : isLoadingOrbVisible;
  const effectiveCanvasDimmed = isLiveProcessing ? true : isCanvasDimmed;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphConceptData>>(effectiveNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(effectiveEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => effectiveNodes[0]?.id || 'dl');
  const [selectedRelationship, setSelectedRelationship] = useState<SelectedRelationshipData | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);

  const craftingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [densityMode, setDensityMode] = useState<GraphDensityMode>('balanced');
  const [zoomDisclosureLevel, setZoomDisclosureLevel] = useState<ZoomDisclosureLevel>('standard');

  // Intelligent Graph Viewport Presentation: computes visible subset, visibility states & exploration depths
  const viewportResult = useMemo(() => {
    if (mode !== 'interactive') return null;
    return calculateVisibleGraph({
      allNodes: effectiveNodes,
      allEdges: effectiveEdges,
      selectedNodeId,
      densityMode,
      zoomLevel: zoomDisclosureLevel
    });
  }, [mode, effectiveNodes, effectiveEdges, selectedNodeId, densityMode, zoomDisclosureLevel]);

  // Sync state whenever viewport presentation changes in interactive mode
  useEffect(() => {
    if (mode === 'interactive' && viewportResult) {
      setNodes(viewportResult.visibleNodes);
      setEdges(viewportResult.visibleEdges);
    }
  }, [mode, viewportResult, setNodes, setEdges]);

  // Viewport zoom tracker for progressive detail disclosure (simplified, standard, detailed)
  const handleViewportMove = useCallback((_: unknown, viewport: { zoom: number }) => {
    const z = viewport.zoom;
    const nextLevel: ZoomDisclosureLevel = z < 0.68 ? 'simplified' : z > 1.25 ? 'detailed' : 'standard';
    setZoomDisclosureLevel((prev) => (prev !== nextLevel ? nextLevel : prev));
  }, []);

  // Active concept data for inspector: strictly based on selectedNodeId (Prompt 26, Requirement 5 & 8)
  const activeConceptData = useMemo(() => {
    if (!selectedNodeId) return null;
    if (effectiveConceptDetails[selectedNodeId]) {
      return effectiveConceptDetails[selectedNodeId];
    }
    const fallbackNode = effectiveNodes.find(n => n.id === selectedNodeId);
    return fallbackNode?.data || null;
  }, [selectedNodeId, effectiveConceptDetails, effectiveNodes]);

  // Previous concept name for subtle back navigation (Prompt 26, Requirement 6)
  const previousNodeId = navHistory.length > 0 ? navHistory[navHistory.length - 1] : null;
  const previousConceptName = useMemo(() => {
    if (!previousNodeId) return null;
    return effectiveConceptDetails[previousNodeId]?.label || 
           effectiveNodes.find(n => n.id === previousNodeId)?.data?.label || 
           null;
  }, [previousNodeId, effectiveConceptDetails, effectiveNodes]);

  // Crafting Animation Runner
  // Runs progressive crafting directly behind the loading orb with reduced opacity
  // Loading state remains present until crafting is completely completed
  const runCraftingAnimation = useCallback((withLoadingOrb: boolean = true) => {
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
    const totalNodes = effectiveNodes.length;

    const stage0Count = Math.max(1, Math.min(2, totalNodes));
    const stage1Count = Math.max(stage0Count, Math.min(5, Math.ceil(totalNodes * 0.6)));

    const sequenceToRun = totalNodes > 0 ? [
      {
        stage: 0,
        status: 'Reading your material…',
        nodeIds: effectiveNodes.slice(0, stage0Count).map((n) => n.id),
        edgeIds: [],
        newNodes: effectiveNodes.slice(0, stage0Count).map((n) => n.id),
        activeNodeId: effectiveNodes[0]?.id,
        duration: 2000
      },
      {
        stage: 1,
        status: 'Finding concepts…',
        nodeIds: effectiveNodes.slice(0, stage1Count).map((n) => n.id),
        edgeIds: effectiveEdges.slice(0, Math.min(1, effectiveEdges.length)).map((e) => e.id),
        newNodes: effectiveNodes.slice(stage0Count, stage1Count).map((n) => n.id),
        activeNodeId: effectiveNodes[Math.min(1, totalNodes - 1)]?.id,
        duration: 2400
      },
      {
        stage: 2,
        status: 'Connecting ideas…',
        nodeIds: effectiveNodes.map((n) => n.id),
        edgeIds: effectiveEdges.slice(0, Math.ceil(effectiveEdges.length * 0.7)).map((e) => e.id),
        newNodes: effectiveNodes.slice(stage1Count).map((n) => n.id),
        activeNodeId: effectiveNodes[0]?.id,
        duration: 2400
      },
      {
        stage: 3,
        status: 'Building your knowledge graph…',
        nodeIds: effectiveNodes.map((n) => n.id),
        edgeIds: effectiveEdges.map((e) => e.id),
        newNodes: [],
        activeNodeId: effectiveNodes[effectiveNodes.length - 1]?.id,
        duration: 2400
      },
      {
        stage: 4,
        status: 'Your knowledge graph is ready.',
        nodeIds: effectiveNodes.map((n) => n.id),
        edgeIds: effectiveEdges.map((e) => e.id),
        newNodes: [],
        activeNodeId: effectiveNodes[0]?.id,
        duration: 1500
      }
    ] : DEFAULT_CRAFTING_SEQUENCE;

    const executeStep = (stepIdx: number) => {
      const step = sequenceToRun[stepIdx];
      setStatusMessage(step.status);

      // Loading state remains visible through all steps (0 through 4)
      // until crafting is completely completed at the end of the sequence.

      // Build active subset of nodes
      const activeNodeMap = new Set(step.nodeIds);
      const newNodesSet = new Set(step.newNodes);

      const nextNodes: Node<GraphConceptData>[] = effectiveNodes
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

      // Build active subset of edges
      const activeEdgeMap = new Set(step.edgeIds);
      const isSettled = stepIdx >= 4;
      const isFilament = stepIdx < 3;

      const nextEdges = effectiveEdges
        .filter((e) => activeEdgeMap.has(e.id))
        .map((edge) => {
          return {
            ...edge,
            className: isFilament ? 'crafting-filament-edge' : '',
            style: {
              stroke: isSettled ? '#333333' : '#A3FF12',
              strokeWidth: isSettled ? 1.25 : 1.75,
              opacity: isSettled ? 1 : 0.95
            },
            markerEnd: isFilament
              ? undefined
              : {
                  type: MarkerType.ArrowClosed,
                  width: 14,
                  height: 14,
                  color: isSettled ? '#444444' : '#A3FF12'
                }
          };
        });

      setNodes(nextNodes);
      setEdges(nextEdges);

      // Camera stabilization with generous padding while HUD is open
      setTimeout(() => {
        const hudPadding = withLoadingOrb ? 0.38 : 0.22;
        reactFlowInstance.fitView({ padding: hudPadding, duration: 800 });
      }, 50);

      // Schedule next step
      if (stepIdx < sequenceToRun.length - 1) {
        craftingTimerRef.current = setTimeout(() => {
          executeStep(stepIdx + 1);
        }, step.duration);
      } else {
        // Final transition: only dissolves once crafting is completely finished
        craftingTimerRef.current = setTimeout(() => {
          setStatusMessage('');
          setIsLoadingOrbVisible(false);
          setIsCanvasDimmed(false);
          fadeTimerRef.current = setTimeout(() => {
            setIsOverlayMounted(false);
          }, 700);
          setMode('interactive');
          setSelectedNodeId(effectiveNodes[0]?.id || null);
          setIsInspectorOpen(true);

          // Restore normal edges and node styling
          setEdges(effectiveEdges);
          reactFlowInstance.fitView({ padding: 0.22, duration: 700 });
        }, step.duration);
      }
    };

    executeStep(currentStep);
  }, [reactFlowInstance, setEdges, setNodes, effectiveNodes, effectiveEdges]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // REAL PROCESSING PIPELINE TO VISUAL CRAFTING (Prompt 22)
  // Maps actual pipeline stages to visual events with zero fake progress:
  // reading -> initial canvas preparation
  // extracting-concepts -> concepts begin appearing progressively
  // normalizing -> duplicate concepts merge/refine
  // mapping-relationships -> relationships appear with GraphMind green accent
  // building-graph -> nodes settle into final spatial structure
  // complete -> final graph becomes interactive, selection & inspector enabled
  // -----------------------------------------------------------------------
  const livePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!livePipelineEvent) return;

    const { stage, intermediateCanonicalConcepts, newlyAddedConceptIds, intermediateRelationships, partialGraph } = livePipelineEvent;

    if (stage === 'reading') {
      // 1. reading → initial canvas preparation
      if (craftingTimerRef.current) clearTimeout(craftingTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      livePositionsRef.current.clear();
      setNodes([]);
      setEdges([]);
    } else if (stage === 'extracting-concepts') {
      // 2. extracting concepts → concepts begin appearing progressively
      if (intermediateCanonicalConcepts && intermediateCanonicalConcepts.length > 0) {
        const newlyAddedSet = new Set(newlyAddedConceptIds || []);
        const centerX = 480;
        const centerY = 320;

        const progressiveNodes: Node<GraphConceptData>[] = intermediateCanonicalConcepts.map((concept, index) => {
          let pos = livePositionsRef.current.get(concept.id) || livePositionsRef.current.get(concept.name.toLowerCase());
          if (!pos) {
            // Natural golden-ratio spiral distribution around center
            const goldenAngle = 2.39996;
            const angle = index * goldenAngle;
            const radius = 150 + Math.sqrt(index + 1) * 75;
            pos = {
              x: Math.round(centerX + radius * Math.cos(angle)),
              y: Math.round(centerY + radius * Math.sin(angle) * 0.75)
            };
            livePositionsRef.current.set(concept.id, pos);
            livePositionsRef.current.set(concept.name.toLowerCase(), pos);
          }

          const category = normalizeCategory(concept.type);
          const isNew = newlyAddedSet.has(concept.name) || newlyAddedSet.has(concept.id);

          return {
            id: concept.id,
            type: 'conceptNode',
            position: pos,
            data: {
              id: concept.id,
              label: concept.name,
              code: concept.id.toUpperCase(),
              category,
              description: concept.description,
              prerequisites: [],
              relationships: [],
              confidence: 96,
              source: concept.sourceIds?.[0] || 'Uploaded Material',
              synapseCount: 0,
              isPrerequisite: category === 'Foundation' || category === 'Paradigm',
              isMethod: category === 'Method' || category === 'Architecture',
              isApplication: category === 'Application',
              craftingNew: isNew,
              craftingActive: false,
              selected: false,
              highlighted: false,
              dimmed: false
            }
          };
        });

        setNodes(progressiveNodes);

        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.35, duration: 600 });
        }, 50);
      }
    } else if (stage === 'normalizing') {
      // 3. normalizing concepts → duplicate concepts merge/refine
      if (intermediateCanonicalConcepts && intermediateCanonicalConcepts.length > 0) {
        setNodes((prevNodes) => {
          const canonicalMap = new Map(intermediateCanonicalConcepts.map((c) => [c.id, c]));
          return prevNodes
            .filter((n) => canonicalMap.has(n.id))
            .map((n) => {
              const canon = canonicalMap.get(n.id)!;
              return {
                ...n,
                data: {
                  ...n.data,
                  label: canon.name,
                  category: normalizeCategory(canon.type),
                  description: canon.description,
                  craftingNew: false
                }
              };
            });
        });
      }
    } else if (stage === 'mapping-relationships') {
      // 4. mapping relationships → relationships begin appearing with GraphMind green accent
      if (intermediateRelationships && intermediateRelationships.length > 0) {
        const liveEdges: Edge[] = intermediateRelationships.map((rel) => {
          const edgeId = rel.id.startsWith('rel-')
            ? rel.id.replace('rel-', 'e-')
            : (rel.id.startsWith('e-') ? rel.id : `e-${rel.source}-${rel.target}`);
          const label = rel.label || rel.type;

          return {
            id: edgeId,
            source: rel.source,
            target: rel.target,
            type: 'custom',
            label,
            className: 'crafting-filament-edge',
            style: {
              stroke: '#A3FF12',
              strokeWidth: 1.75,
              opacity: 0.95
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: '#A3FF12'
            },
            data: {
              id: rel.id,
              relation: label,
              description: rel.description,
              sourceIds: rel.sourceIds,
              sourceChunkIds: rel.sourceChunkIds
            }
          };
        });

        setEdges(liveEdges);
      }
    } else if (stage === 'building-graph') {
      // 5. building graph → nodes settle into their final spatial structure
      if (partialGraph && partialGraph.nodes.length > 0) {
        const rf = knowledgeGraphToReactFlow(partialGraph);
        setNodes(
          rf.nodes.map((n) => ({
            ...n,
            data: {
              ...n.data,
              craftingNew: false,
              craftingActive: false
            }
          }))
        );
        setEdges(
          rf.edges.map((e) => ({
            ...e,
            className: 'crafting-filament-edge',
            style: {
              stroke: '#A3FF12',
              strokeWidth: 1.75,
              opacity: 0.95
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: '#A3FF12'
            }
          }))
        );

        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.28, duration: 750 });
        }, 50);
      }
    } else if (stage === 'complete') {
      // 6. complete → final graph becomes interactive, settled, edges return to normal
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setIsOverlayMounted(false);
        setIsLoadingOrbVisible(false);
        setIsCanvasDimmed(false);
      }, 700);

      const targetGraph = partialGraph || graph;
      if (targetGraph && targetGraph.nodes.length > 0) {
        const rf = knowledgeGraphToReactFlow(targetGraph);
        setNodes(rf.nodes);
        setEdges(rf.edges);
        setTimeout(() => {
          setSelectedNodeId(rf.nodes[0]?.id || null);
          setIsInspectorOpen(true);
        }, 50);
      }

      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.22, duration: 600 });
      }, 80);
    } else if (stage === 'error') {
      // 7. error → preserve useful error state created earlier
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          className: '',
          style: { stroke: '#333333', strokeWidth: 1.25 }
        }))
      );
    }
  }, [livePipelineEvent, graph, reactFlowInstance, setNodes, setEdges]);

  // Full Loading Orb with crafting visible behind at less opacity -> progressive crafting -> interactive
  const handleStartFullSequence = useCallback(() => {
    runCraftingAnimation(true);
  }, [runCraftingAnimation]);

  // When initialMode changes
  useEffect(() => {
    if (livePipelineEvent) return;

    const timer = setTimeout(() => {
      if (initialMode === 'loading') {
        handleStartFullSequence();
      } else if (initialMode === 'crafting') {
        runCraftingAnimation(true);
      } else if (initialMode === 'empty' || effectiveNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        setIsLoadingOrbVisible(false);
        setIsOverlayMounted(false);
        setIsCanvasDimmed(false);
        setMode('empty');
      } else {
        setNodes(effectiveNodes);
        setEdges(effectiveEdges);
        setIsLoadingOrbVisible(false);
        setIsOverlayMounted(false);
        setIsCanvasDimmed(false);
        setMode('interactive');
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [initialMode, livePipelineEvent, handleStartFullSequence, runCraftingAnimation, setEdges, setNodes, effectiveNodes, effectiveEdges]);

  // Smooth Camera & Node Focus with history tracking (Prompt 25 & Prompt 26, Requirements 2 & 6)
  // When a concept is selected or searched, it becomes Depth 0 (focused) and automatically reveals its
  // Depth 1 & 2 neighborhood in calculateVisibleGraph with perfectly stable coordinates.
  const focusNodeOnCanvas = useCallback((nodeId: string, pushHistory = true) => {
    if (pushHistory && selectedNodeId && selectedNodeId !== nodeId) {
      setNavHistory((prev) => [...prev, selectedNodeId]);
    }
    setSelectedRelationship(null);
    setSelectedNodeId(nodeId);
    setIsInspectorOpen(true);

    const targetNode = effectiveNodes.find((n) => n.id === nodeId);
    if (targetNode) {
      reactFlowInstance.setCenter(targetNode.position.x + 100, targetNode.position.y + 45, {
        zoom: Math.max(reactFlowInstance.getZoom(), 1.05),
        duration: 650
      });
    }
  }, [selectedNodeId, effectiveNodes, reactFlowInstance]);

  // Return to previous concept (Prompt 26, Requirement 6: subtle navigation without breadcrumb clutter)
  const handleGoBack = useCallback(() => {
    if (navHistory.length === 0) return;
    const prevId = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));
    if (prevId) {
      focusNodeOnCanvas(prevId, false);
    }
  }, [navHistory, focusNodeOnCanvas]);

  // Node Click handler (Prompt 26, Requirement 2: select node, smoothly focus, update context & relationships)
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (mode !== 'interactive') return;
      focusNodeOnCanvas(node.id, true);
    },
    [mode, focusNodeOnCanvas]
  );

  // Edge / Relationship Click handler (Prompt 20, Requirement 4)
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      if (mode !== 'interactive') return;
      const srcNode = effectiveNodes.find(n => n.id === edge.source);
      const tgtNode = effectiveNodes.find(n => n.id === edge.target);
      const edgeData = edge.data as Record<string, unknown> | undefined;

      setSelectedRelationship({
        id: edge.id,
        sourceId: edge.source,
        sourceName: srcNode?.data?.label || edge.source,
        targetId: edge.target,
        targetName: tgtNode?.data?.label || edge.target,
        type: (edge.label as string) || (edgeData?.relation as string) || 'related-to',
        description: edgeData?.description as string | undefined,
        sourceNames: edgeData?.sourceNames as string[] | undefined,
        sourceChunkIds: edgeData?.sourceChunkIds as string[] | undefined
      });
      setIsInspectorOpen(true);
    },
    [mode, effectiveNodes]
  );

  // Pane Click handler (Prompt 26, Requirement 8: clean deselecting)
  const handlePaneClick = useCallback(() => {
    if (mode !== 'interactive') return;
    setSelectedRelationship(null);
    setSelectedNodeId(null);
    setIsInspectorOpen(false);
    setNavHistory([]);
  }, [mode]);

  // Handle external search selection request
  useEffect(() => {
    if (focusedNodeId && mode === 'interactive') {
      const timer = setTimeout(() => {
        focusNodeOnCanvas(focusedNodeId, true);
        onClearFocusedNode?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [focusedNodeId, mode, focusNodeOnCanvas, onClearFocusedNode]);

  // Escape Key to deselect (Prompt 26, Requirement 8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'interactive') {
        setSelectedRelationship(null);
        setSelectedNodeId(null);
        setIsInspectorOpen(false);
        setNavHistory([]);
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

  // Export Canvas as clean PNG Image (Prompt 27 Section 2 & 5)
  const handleExportImage = useCallback(async () => {
    if (nodes.length === 0) {
      setExportErrorMessage("Couldn't export the graph.\nTry again.");
      setTimeout(() => setExportErrorMessage(null), 3500);
      return;
    }

    try {
      setIsExporting(true);
      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement | null;
      if (!viewportElement) {
        throw new Error('Viewport element not found');
      }

      const success = await exportKnowledgeGraphPng(viewportElement, nodes);
      if (!success) {
        throw new Error('Export returned false');
      }
    } catch {
      setExportErrorMessage("Couldn't export the graph.\nTry again.");
      setTimeout(() => setExportErrorMessage(null), 3500);
    } finally {
      setIsExporting(false);
    }
  }, [nodes]);

  // Export Graph Data as structured JSON (Prompt 27 Section 3 & 5)
  const handleExportJson = useCallback(() => {
    try {
      const success = exportKnowledgeGraphJson(graph || null, effectiveNodes, effectiveEdges);
      if (!success) {
        throw new Error('Export returned false');
      }
    } catch {
      setExportErrorMessage("Couldn't export the graph.\nTry again.");
      setTimeout(() => setExportErrorMessage(null), 3500);
    }
  }, [graph, effectiveNodes, effectiveEdges]);

  const searchItems = useMemo(() => {
    return effectiveNodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      category: n.data.category,
      code: n.data.code
    }));
  }, [effectiveNodes]);

  return (
    <div className="freeform-graph-container" id="knowledge-graph-workspace">
      {/* 1. Processing Status Banner (shown once loading orb dissolves or in direct crafting without central overlay) */}
      {mode === 'crafting' && !effectiveOverlayMounted && displayStatusMessage && (
        <div className="graph-crafting-indicator" role="status" aria-live="polite">
          <span className="crafting-indicator-dot" />
          <span className="crafting-indicator-text">{displayStatusMessage}</span>
        </div>
      )}

      {/* Floating Toolbar (with Search, Density, Nav, Export image & Export JSON) */}
      <GraphToolbar
        onSearchSelect={focusNodeOnCanvas}
        onFitView={handleResetView}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        availableNodes={searchItems}
        onExportImage={handleExportImage}
        onExportJson={handleExportJson}
        isExporting={isExporting}
        densityMode={densityMode}
        onDensityChange={setDensityMode}
      />

      {/* Subtle Understated Contextual Indicator (when presentation subset is active) */}
      {mode === 'interactive' && viewportResult?.isSubsetEnabled && viewportResult?.contextualHint && (
        <div className="graph-presentation-hint" role="status" aria-live="polite">
          <span className="presentation-hint-dot" aria-hidden="true" />
          <span className="presentation-hint-text">{viewportResult.contextualHint}</span>
        </div>
      )}

      {/* Export Error Message Toast (Prompt 27 Section 5) */}
      {exportErrorMessage && (
        <div className="canvas-export-error-toast" role="alert">
          <span className="export-error-line1">Couldn't export the graph.</span>
          <span className="export-error-line2">Try again.</span>
        </div>
      )}

      {/* Continuous ReactFlow Canvas with reduced opacity while loading orb is active */}
      <div className={`freeform-canvas-wrapper ${effectiveCanvasDimmed ? 'dimmed-crafting' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onMove={handleViewportMove}
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
            <h2 className="graph-empty-title">Your graph is empty</h2>
            <p className="graph-empty-desc">
              Upload material to begin mapping your concepts.
            </p>
            <button 
              type="button"
              className="btn-primary"
              onClick={onOpenUpload}
              id="btn-empty-add-sources"
            >
              <Plus size={14} />
              <span>Upload material</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. LOADING STATE OVERLAY (Sleek horizontal glass pill HUD with unobstructed crafting constellation weaving behind) */}
      {effectiveOverlayMounted && (
        <div 
          className={`graph-canvas-overlay loading-overlay ${!effectiveLoadingOrbVisible ? 'fade-out' : ''}`} 
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
                <span className="graph-loading-title">
                  {pipelineStage === 'error' ? 'Processing error' : 'GraphMind is getting ready'}
                </span>
                {pipelineError && onClearError && (
                  <button
                    type="button"
                    className="mode-btn"
                    onClick={onClearError}
                    style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px' }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
              <div className="graph-loading-badge">
                <span className={`badge-pulse-dot ${pipelineStage === 'error' ? 'error-dot' : ''}`} />
                <span className="badge-text">
                  {pipelineError || pipelineStatusMessage || statusMessage || 'Reading your material…'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 4. Inspector Context Panel (Interactive mode only: Concept or Relationship) */}
      {mode === 'interactive' && isInspectorOpen && (activeConceptData || selectedRelationship) && (
        <NodeContextPanel
          concept={activeConceptData}
          selectedRelationship={selectedRelationship}
          previousConceptName={previousConceptName}
          onGoBack={handleGoBack}
          onClose={() => {
            setIsInspectorOpen(false);
            setSelectedRelationship(null);
            setSelectedNodeId(null);
            setNavHistory([]);
          }}
          onSelectConcept={(conceptId) => focusNodeOnCanvas(conceptId, true)}
          onFocusNode={(conceptId) => focusNodeOnCanvas(conceptId, true)}
          onSelectSource={onSelectSource}
          isCollapsed={!isInspectorOpen}
        />
      )}
    </div>
  );
}

export function KnowledgeGraphWorkspace(props: KnowledgeGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
