import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { ThinkingOrb } from 'thinking-orbs';
import { Plus, Minus, Maximize, Minimize } from 'lucide-react';

import { ConceptNode } from './ConceptNode';
import { CustomEdge } from './CustomEdge';
import { GraphToolbar } from './GraphToolbar';
import { NodeContextPanel } from './NodeContextPanel';
import { CanvasEmptyState } from './CanvasEmptyState';
import { TestWorkspace } from '../test/TestWorkspace';

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
import type { PracticeStatus, ConceptPracticeState, StudyFilterMode, RevisionPathStep, ActiveRecallQuestion } from '../../types/practice';
import { loadConceptPracticeStates, updateConceptPracticeState, recordConceptStudy } from '../../services/storage';
import type { PipelineStage, PipelineProgressEvent } from '../../services/pipelineOrchestrator';
import { exportKnowledgeGraphJson, exportKnowledgeGraphPng } from '../../services/graphExport';
import { calculateVisibleGraph } from '../../services/graphViewport';
import { findNextRecallConceptId } from '../../services/practiceQuestionGenerator';
import { generateRevisionPath } from '../../services/revisionPathGenerator';

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
  graphName?: string;
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
  onFilesDropped?: (files: File[]) => void;
  isGraphFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
  graphName: _graphName,
  pipelineStage,
  pipelineStatusMessage,
  pipelineError,
  onClearError,
  livePipelineEvent,
  focusedNodeId,
  onClearFocusedNode,
  onSelectSource,
  onFilesDropped,
  isGraphFullscreen: isGraphFullscreenProp,
  onToggleFullscreen: onToggleFullscreenProp
}: KnowledgeGraphWorkspaceProps) {
  const reactFlowInstance = useReactFlow();

  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isGraphFullscreen = isGraphFullscreenProp !== undefined ? isGraphFullscreenProp : internalFullscreen;
  const savedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // Synchronize document.body class with fullscreen state
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('graph-fullscreen-active', isGraphFullscreen);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('graph-fullscreen-active');
      }
    };
  }, [isGraphFullscreen]);

  const [practiceStates, setPracticeStates] = useState<Record<string, ConceptPracticeState>>(() => {
    return loadConceptPracticeStates(graph?.id);
  });

  useEffect(() => {
    setPracticeStates(loadConceptPracticeStates(graph?.id));
  }, [graph?.id]);

  const { effectiveNodes, effectiveEdges, effectiveConceptDetails } = useMemo(() => {
    const activeGraphSource = (graph && graph.nodes && graph.nodes.length > 0)
      ? graph
      : (livePipelineEvent?.partialGraph && livePipelineEvent.partialGraph.nodes && livePipelineEvent.partialGraph.nodes.length > 0)
      ? livePipelineEvent.partialGraph
      : null;

    let baseNodes = initialNodes;
    let baseEdges = initialEdges;
    let baseDetails = initialConceptDetails;

    if (activeGraphSource) {
      const rf = knowledgeGraphToReactFlow(activeGraphSource);
      baseNodes = rf.nodes;
      baseEdges = rf.edges;
      baseDetails = rf.conceptDetails;
    } else if (graph) {
      const rf = knowledgeGraphToReactFlow(graph);
      baseNodes = rf.nodes;
      baseEdges = rf.edges;
      baseDetails = rf.conceptDetails;
    }

    // Attach current practice status to nodes
    const nodesWithPractice = baseNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        practiceStatus: practiceStates[n.id]?.status || 'unseen',
        practiceState: practiceStates[n.id]
      }
    }));

    return {
      effectiveNodes: nodesWithPractice,
      effectiveEdges: baseEdges,
      effectiveConceptDetails: baseDetails
    };
  }, [graph, livePipelineEvent?.partialGraph, practiceStates]);

  const [internalMode, setMode] = useState<WorkspaceMode>(initialMode);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const displayStatusMessage = livePipelineEvent?.message || statusMessage || pipelineStatusMessage || '';

  const isLiveError = livePipelineEvent?.stage === 'error' || pipelineStage === 'error' || Boolean(pipelineError);
  const isLiveProcessing = Boolean(
    !isLiveError &&
    ((livePipelineEvent &&
      livePipelineEvent.stage !== 'complete') ||
    (pipelineStage &&
      pipelineStage !== 'complete'))
  );
  const isLiveComplete = !isLiveError && (livePipelineEvent?.stage === 'complete' || pipelineStage === 'complete');

  // Drag and drop states on canvas
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (onFilesDropped) {
        onFilesDropped(files);
      } else if (onOpenUpload) {
        onOpenUpload();
      }
    }
  }, [onFilesDropped, onOpenUpload]);

  const [isLoadingOrbVisible, setIsLoadingOrbVisible] = useState<boolean>(false);
  const [isOverlayMounted, setIsOverlayMounted] = useState<boolean>(false);
  const [isCanvasDimmed, setIsCanvasDimmed] = useState<boolean>(false);

  const effectiveOverlayMounted = (isLiveProcessing || isLiveError) ? true : isOverlayMounted;
  const effectiveLoadingOrbVisible = (isLiveProcessing || isLiveError) ? true : isLoadingOrbVisible;
  const effectiveCanvasDimmed = isLiveProcessing ? true : isCanvasDimmed;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphConceptData>>(effectiveNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(effectiveEdges);

  const hasAnyNodes = (effectiveNodes && effectiveNodes.length > 0) || (nodes && nodes.length > 0);

  const mode: WorkspaceMode = isLiveProcessing
    ? 'crafting'
    : isLiveComplete
    ? (hasAnyNodes ? 'interactive' : 'empty')
    : isLiveError
    ? (hasAnyNodes ? 'interactive' : 'empty')
    : internalMode;

  useEffect(() => {
    if (initialMode && initialMode !== internalMode && !isLiveProcessing && !isLiveError) {
      setMode(initialMode);
    }
  }, [initialMode, isLiveProcessing, isLiveError, internalMode]);
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
  const [studyFilterMode, setStudyFilterMode] = useState<StudyFilterMode>('all');

  // Active Recall In-Memory Session State (Phase 4 Section 12)
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [recallSession, setRecallSession] = useState<{
    testedConceptIds: Set<string>;
    recalledConceptIds: Set<string>;
    reviewConceptIds: Set<string>;
    currentConceptId: string | null;
  }>({
    testedConceptIds: new Set<string>(),
    recalledConceptIds: new Set<string>(),
    reviewConceptIds: new Set<string>(),
    currentConceptId: null
  });

  // Revision In-Memory Session State (Phase 5)
  const [isRevisionMode, setIsRevisionMode] = useState<boolean>(false);
  const [revisionPath, setRevisionPath] = useState<RevisionPathStep[]>([]);
  const [revisionIndex, setRevisionIndex] = useState<number>(0);
  const [revisionVisitedIds, setRevisionVisitedIds] = useState<Set<string>>(new Set());

  // Active Recall Dynamic Graph Testing State (Phase 4 Polish)
  const [testActiveQuestion, setTestActiveQuestion] = useState<ActiveRecallQuestion | null>(null);
  const [testConcealedNodeId, setTestConcealedNodeId] = useState<string | null>(null);
  const [testMaterializingNodeId, setTestMaterializingNodeId] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState<{ current: number; total: number } | null>(null);

  const handleTestStateUpdate = useCallback((state: {
    activeQuestion: ActiveRecallQuestion | null;
    concealedNodeId: string | null;
    isMaterializing: boolean;
    progress: { current: number; total: number } | null;
  }) => {
    setTestActiveQuestion(prev => (prev?.id === state.activeQuestion?.id ? prev : state.activeQuestion));
    setTestConcealedNodeId(prev => (prev === state.concealedNodeId ? prev : state.concealedNodeId));
    setTestProgress(prev => (
      prev?.current === state.progress?.current && prev?.total === state.progress?.total
        ? prev
        : state.progress
    ));
    if (state.isMaterializing && state.activeQuestion?.concealedNodeId) {
      setTestMaterializingNodeId(state.activeQuestion.concealedNodeId);
      setTimeout(() => {
        setTestMaterializingNodeId(null);
      }, 700);
    } else {
      setTestMaterializingNodeId(null);
    }
  }, []);

  // Memoized graph concepts for questions and testing
  const allGraphConcepts = useMemo(() => {
    return effectiveNodes.map(n => ({
      id: n.id,
      name: n.data.name || n.data.label,
      category: n.data.category,
      description: n.data.description
    }));
  }, [effectiveNodes]);

  // Intelligent Graph Viewport Presentation: computes visible subset, visibility states & exploration depths
  const viewportResult = useMemo(() => {
    if (mode !== 'interactive') return null;
    return calculateVisibleGraph({
      allNodes: effectiveNodes,
      allEdges: effectiveEdges,
      selectedNodeId,
      densityMode,
      zoomLevel: zoomDisclosureLevel,
      studyFilterMode,
      practiceStates,
      recalledConceptIds: recallSession.recalledConceptIds,
      reviewConceptIds: recallSession.reviewConceptIds,
      isRevisionMode,
      revisionCurrentConceptId: isRevisionMode && revisionPath[revisionIndex] ? revisionPath[revisionIndex].conceptId : null,
      revisionVisitedConceptIds: revisionVisitedIds
    });
  }, [
    mode,
    effectiveNodes,
    effectiveEdges,
    selectedNodeId,
    densityMode,
    zoomDisclosureLevel,
    studyFilterMode,
    practiceStates,
    recallSession.recalledConceptIds,
    recallSession.reviewConceptIds,
    isRevisionMode,
    revisionPath,
    revisionIndex,
    revisionVisitedIds
  ]);

  // Sync state whenever viewport presentation changes in interactive mode
  useEffect(() => {
    if (mode === 'interactive' && viewportResult) {
      if (!isTestMode) {
        setNodes(viewportResult.visibleNodes);
        setEdges(viewportResult.visibleEdges);
        return;
      }

      // Test Mode Active: Conceal tested concept/relationship, dim unrelated nodes
      const activeConceptId = testActiveQuestion?.conceptId || selectedNodeId || (effectiveNodes[0]?.id || null);
      const targetConceptId = testActiveQuestion?.relatedConceptId || testConcealedNodeId;

      const styledNodes = viewportResult.visibleNodes.map(node => {
        const isConcealed = Boolean(testConcealedNodeId && node.id === testConcealedNodeId);
        const isMaterializing = Boolean(testMaterializingNodeId && node.id === testMaterializingNodeId);
        const isFocus = Boolean((activeConceptId && node.id === activeConceptId) || (targetConceptId && node.id === targetConceptId));
        const isNeighbor = Boolean(activeConceptId && effectiveEdges.some(e =>
          (e.source === activeConceptId && e.target === node.id) ||
          (e.target === activeConceptId && e.source === node.id)
        ));

        return {
          ...node,
          data: {
            ...node.data,
            isTestConcealed: isConcealed,
            isTestMaterializing: isMaterializing,
            highlighted: isFocus || isNeighbor,
            dimmed: !isFocus && !isNeighbor
          }
        };
      });

      const styledEdges = viewportResult.visibleEdges.map(edge => {
        const isIncident = (activeConceptId && targetConceptId)
          ? ((edge.source === activeConceptId && edge.target === targetConceptId) ||
             (edge.target === activeConceptId && edge.source === targetConceptId))
          : (activeConceptId ? (edge.source === activeConceptId || edge.target === activeConceptId) : false);

        return {
          ...edge,
          data: {
            ...edge.data,
            isTestActive: isIncident,
            isTestConcealed: isIncident && Boolean(testConcealedNodeId),
            isTestMaterializing: isIncident && Boolean(testMaterializingNodeId)
          },
          style: {
            ...edge.style,
            opacity: isIncident ? 1 : 0.22,
            stroke: isIncident ? '#A3FF12' : edge.style?.stroke
          }
        };
      });

      setNodes(styledNodes);
      setEdges(styledEdges);
    }
  }, [
    mode,
    viewportResult,
    isTestMode,
    testConcealedNodeId,
    testMaterializingNodeId,
    testActiveQuestion,
    selectedNodeId,
    effectiveEdges,
    effectiveNodes,
    setNodes,
    setEdges
  ]);

  // Viewport zoom tracker for progressive detail disclosure (simplified, standard, detailed)
  const handleViewportMove = useCallback((_: unknown, viewport: { zoom: number }) => {
    const z = viewport.zoom;
    const nextLevel: ZoomDisclosureLevel = z < 0.68 ? 'simplified' : z > 1.25 ? 'detailed' : 'standard';
    setZoomDisclosureLevel((prev) => (prev !== nextLevel ? nextLevel : prev));
  }, []);

  // Meaningful study interaction tracking: unseen -> learning (Phase 3 Section 8)
  useEffect(() => {
    if (!selectedNodeId || !isInspectorOpen || mode !== 'interactive') return;
    const currentStatus = practiceStates[selectedNodeId]?.status;
    if (!currentStatus || currentStatus === 'unseen') {
      const updated = recordConceptStudy(graph?.id, selectedNodeId);
      setPracticeStates(prev => ({
        ...prev,
        [selectedNodeId]: updated
      }));
      setNodes(prev => prev.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              practiceStatus: updated.status,
              practiceState: updated,
              knowledgeState: updated
            }
          };
        }
        return n;
      }));
    }
  }, [selectedNodeId, isInspectorOpen, mode, graph?.id, practiceStates]);

  // Active concept data for inspector: strictly based on selectedNodeId (Prompt 26, Requirement 5 & 8)
  const activeConceptData = useMemo(() => {
    if (!selectedNodeId) return null;
    let base: GraphConceptData | null = null;
    if (effectiveConceptDetails[selectedNodeId]) {
      base = effectiveConceptDetails[selectedNodeId];
    } else {
      const fallbackNode = effectiveNodes.find(n => n.id === selectedNodeId);
      base = fallbackNode?.data || null;
    }
    if (!base) return null;
    const pState = practiceStates[selectedNodeId];
    return {
      ...base,
      practiceStatus: pState?.status || 'unseen',
      practiceState: pState,
      knowledgeState: pState
    };
  }, [selectedNodeId, effectiveConceptDetails, effectiveNodes, practiceStates]);

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
        setMode('interactive');
        setTimeout(() => {
          setSelectedNodeId(rf.nodes[0]?.id || null);
          setIsInspectorOpen(true);
        }, 50);
      } else {
        setMode('interactive');
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

  // When initialMode or effectiveNodes changes
  useEffect(() => {
    if (livePipelineEvent || isLiveProcessing || isLiveError) return;

    const timer = setTimeout(() => {
      if (initialMode === 'loading') {
        handleStartFullSequence();
      } else if (initialMode === 'crafting') {
        runCraftingAnimation(true);
      } else if (effectiveNodes.length > 0) {
        setNodes(effectiveNodes);
        setEdges(effectiveEdges);
        setIsLoadingOrbVisible(false);
        setIsOverlayMounted(false);
        setIsCanvasDimmed(false);
        setMode('interactive');
      } else if (initialMode === 'empty' || (!graph?.nodes?.length && nodes.length === 0)) {
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
  }, [initialMode, livePipelineEvent, isLiveProcessing, isLiveError, handleStartFullSequence, runCraftingAnimation, setEdges, setNodes, effectiveNodes, effectiveEdges, graph?.nodes?.length, nodes.length]);

  // Smooth Camera & Node Focus with history tracking (Prompt 25 & Prompt 26, Requirements 2 & 6)
  // When a concept is selected or searched, it becomes Depth 0 (focused) and automatically reveals its
  // Depth 1 & 2 neighborhood in calculateVisibleGraph with perfectly stable coordinates.
  const focusNodeOnCanvas = useCallback((nodeId: string, pushHistory = true, customDuration?: number) => {
    if (pushHistory && selectedNodeId && selectedNodeId !== nodeId) {
      setNavHistory((prev) => [...prev, selectedNodeId]);
    }
    setSelectedRelationship(null);
    setSelectedNodeId(nodeId);
    setIsInspectorOpen(true);

    const targetNode = effectiveNodes.find((n) => n.id === nodeId);
    if (targetNode) {
      const duration = customDuration !== undefined ? customDuration : isRevisionMode ? 300 : 650;
      try {
        reactFlowInstance.setCenter(targetNode.position.x + 100, targetNode.position.y + 45, {
          zoom: Math.max(reactFlowInstance.getZoom(), 1.05),
          duration
        });
      } catch (err) {
        console.warn('Could not center canvas on node:', err);
      }
    }
  }, [selectedNodeId, effectiveNodes, reactFlowInstance, isRevisionMode]);

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

  // Node Double Click handler (Requirement 11: keep existing graph behavior / keep node selected)
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (mode !== 'interactive') return;
      focusNodeOnCanvas(node.id, false);
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

  // Fullscreen toggle handler with continuous viewport preservation (Section 3, 5, 8, 9)
  const handleToggleFullscreen = useCallback((forcedState?: boolean) => {
    try {
      const currentVp = reactFlowInstance.getViewport();
      savedViewportRef.current = currentVp;
    } catch {
      // safe fallback if getViewport is not available
    }

    const nextState = typeof forcedState === 'boolean'
      ? forcedState
      : !isGraphFullscreen;

    if (onToggleFullscreenProp) {
      onToggleFullscreenProp();
    } else {
      setInternalFullscreen(nextState);
    }

    if (typeof document !== 'undefined') {
      document.body.classList.toggle('graph-fullscreen-active', nextState);
    }

    // Preserve exact viewport across container layout transition (Section 9)
    requestAnimationFrame(() => {
      if (savedViewportRef.current) {
        try {
          reactFlowInstance.setViewport(savedViewportRef.current);
        } catch {
          // fallback
        }
      }
    });

    setTimeout(() => {
      if (savedViewportRef.current) {
        try {
          reactFlowInstance.setViewport(savedViewportRef.current);
        } catch {
          // fallback
        }
      }
    }, 320);
  }, [isGraphFullscreen, onToggleFullscreenProp, reactFlowInstance]);

  // Escape Key Handler (Section 12: Exits fullscreen without deselecting node or resetting context)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || mode !== 'interactive') return;

      // 1. If text input or textarea currently has focus, preserve default input behavior
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // 2. If a modal dialog is open, let modal handle Escape
      if (document.querySelector('.modal-backdrop, [role="dialog"]')) {
        return;
      }

      // 3. If in test mode, exit test mode back to concept details (Phase 4 Section 15)
      if (isTestMode) {
        e.preventDefault();
        setIsTestMode(false);
        return;
      }

      // 4. If in fullscreen mode, exit fullscreen and PRESERVE selected node and detail panel context
      if (isGraphFullscreen) {
        e.preventDefault();
        handleToggleFullscreen(false);
        return;
      }

      // 5. Otherwise, deselect node and close inspector
      setSelectedRelationship(null);
      setSelectedNodeId(null);
      setIsInspectorOpen(false);
      setIsTestMode(false);
      setNavHistory([]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isGraphFullscreen, isTestMode, handleToggleFullscreen]);

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

  const needsReviewCount = useMemo(() => {
    return Object.values(practiceStates).filter(s => s.status === 'needs-review').length;
  }, [practiceStates]);

  const totalConceptsCount = effectiveNodes.length;

  const searchItems = useMemo(() => {
    return effectiveNodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      category: n.data.category,
      code: n.data.code,
      practiceStatus: practiceStates[n.id]?.status || 'unseen'
    }));
  }, [effectiveNodes, practiceStates]);

  const handleNextStudyConcept = useCallback(() => {
    // 1. If we have concepts needing review, prioritize cycling through review concepts
    if (studyFilterMode === 'needs-review' || needsReviewCount > 0) {
      const reviewNodes = effectiveNodes.filter(n => {
        const s = practiceStates[n.id]?.status || n.data.practiceStatus;
        return s === 'needs-review';
      });
      if (reviewNodes.length > 0) {
        const currentIdx = reviewNodes.findIndex(n => n.id === selectedNodeId);
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % reviewNodes.length : 0;
        focusNodeOnCanvas(reviewNodes[nextIdx].id, true);
        return;
      }
    }

    // 2. If in-progress filter is active
    if (studyFilterMode === 'in-progress') {
      const inProgNodes = effectiveNodes.filter(n => {
        const s = practiceStates[n.id]?.status || n.data.practiceStatus;
        return s === 'learning';
      });
      if (inProgNodes.length > 0) {
        const currentIdx = inProgNodes.findIndex(n => n.id === selectedNodeId);
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % inProgNodes.length : 0;
        focusNodeOnCanvas(inProgNodes[nextIdx].id, true);
        return;
      }
    }

    // 3. If currently selected node has connected neighbors, jump to first connected neighbor
    if (activeConceptData?.relationships && activeConceptData.relationships.length > 0) {
      const targets = activeConceptData.relationships
        .map(r => r.targetId)
        .filter(id => id !== selectedNodeId && effectiveNodes.some(n => n.id === id));
      if (targets.length > 0) {
        focusNodeOnCanvas(targets[0], true);
        return;
      }
    }

    // 4. Default: cycle through effective nodes
    if (effectiveNodes.length > 0) {
      const currentIdx = effectiveNodes.findIndex(n => n.id === selectedNodeId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % effectiveNodes.length : 0;
      focusNodeOnCanvas(effectiveNodes[nextIdx].id, true);
    }
  }, [studyFilterMode, needsReviewCount, effectiveNodes, practiceStates, selectedNodeId, activeConceptData, focusNodeOnCanvas]);

  // Active Recall Session Handlers (Phase 4 Sections 8, 9, 11, 12)
  const handleToggleTestMode = useCallback((targetMode?: boolean) => {
    const nextMode = targetMode !== undefined ? targetMode : !isTestMode;
    setIsTestMode(nextMode);

    if (nextMode) {
      setIsInspectorOpen(false);
      const targetId = (selectedNodeId && effectiveNodes.some(n => n.id === selectedNodeId))
        ? selectedNodeId
        : (effectiveNodes.length > 0 ? effectiveNodes[0].id : null);
      if (targetId) {
        setSelectedNodeId(targetId);
        focusNodeOnCanvas(targetId, true);
      }
    }
  }, [isTestMode, selectedNodeId, effectiveNodes, focusNodeOnCanvas]);

  const refreshPracticeStates = useCallback(() => {
    const loaded = loadConceptPracticeStates(graph?.id);
    setPracticeStates(loaded);
    setNodes(prev => prev.map(n => {
      const pState = loaded[n.id];
      if (pState) {
        return {
          ...n,
          data: {
            ...n.data,
            practiceStatus: pState.status,
            practiceState: pState,
            knowledgeState: pState
          }
        };
      }
      return n;
    }));
  }, [graph?.id, setNodes]);

  const handleRecordSessionRecalled = useCallback((conceptId: string) => {
    setRecallSession(prev => {
      const nextTested = new Set(prev.testedConceptIds).add(conceptId);
      const nextRecalled = new Set(prev.recalledConceptIds).add(conceptId);
      const nextReview = new Set(prev.reviewConceptIds);
      nextReview.delete(conceptId);
      return {
        testedConceptIds: nextTested,
        recalledConceptIds: nextRecalled,
        reviewConceptIds: nextReview,
        currentConceptId: conceptId
      };
    });
  }, []);

  const handleRecordSessionReview = useCallback((conceptId: string) => {
    setRecallSession(prev => {
      const nextTested = new Set(prev.testedConceptIds).add(conceptId);
      const nextReview = new Set(prev.reviewConceptIds).add(conceptId);
      const nextRecalled = new Set(prev.recalledConceptIds);
      nextRecalled.delete(conceptId);
      return {
        testedConceptIds: nextTested,
        recalledConceptIds: nextRecalled,
        reviewConceptIds: nextReview,
        currentConceptId: conceptId
      };
    });
  }, []);

  const handleNextRecallConcept = useCallback(() => {
    const nextId = findNextRecallConceptId({
      currentConceptId: selectedNodeId || '',
      allNodes: effectiveNodes,
      allEdges: effectiveEdges,
      testedConceptIds: recallSession.testedConceptIds,
      reviewConceptIds: recallSession.reviewConceptIds,
      recalledConceptIds: recallSession.recalledConceptIds,
      practiceStates
    });

    if (nextId) {
      focusNodeOnCanvas(nextId, true);
    }
  }, [selectedNodeId, effectiveNodes, effectiveEdges, recallSession, practiceStates, focusNodeOnCanvas]);

  const nextRecallConceptName = useMemo(() => {
    if (!selectedNodeId) return null;
    const nextId = findNextRecallConceptId({
      currentConceptId: selectedNodeId,
      allNodes: effectiveNodes,
      allEdges: effectiveEdges,
      testedConceptIds: recallSession.testedConceptIds,
      reviewConceptIds: recallSession.reviewConceptIds,
      recalledConceptIds: recallSession.recalledConceptIds,
      practiceStates
    });
    if (!nextId || nextId === selectedNodeId) return null;
    return effectiveConceptDetails[nextId]?.label ||
      effectiveNodes.find(n => n.id === nextId)?.data?.label ||
      null;
  }, [selectedNodeId, effectiveNodes, effectiveEdges, recallSession, practiceStates, effectiveConceptDetails]);

  // Revision Session Handlers (Phase 5)
  const handleToggleRevisionMode = useCallback((forceState?: boolean, startNodeId?: string) => {
    const nextState = forceState !== undefined ? forceState : !isRevisionMode;
    if (nextState) {
      const reviewIds = new Set<string>();
      recallSession.reviewConceptIds.forEach(id => reviewIds.add(id));
      Object.entries(practiceStates).forEach(([id, st]) => {
        if (st.status === 'needs-review') reviewIds.add(id);
      });

      const anchorNodeId = startNodeId || selectedNodeId || null;
      const hasReviewItems = reviewIds.size > 0;

      const path = generateRevisionPath({
        allNodes: effectiveNodes,
        allEdges: effectiveEdges,
        reviewConceptIds: reviewIds,
        testedConceptIds: recallSession.testedConceptIds,
        practiceStates,
        startConceptId: anchorNodeId,
        onlyReviewQueue: !anchorNodeId && !hasReviewItems
      });

      setRevisionPath(path);
      setRevisionIndex(0);
      setRevisionVisitedIds(new Set());
      setIsRevisionMode(true);
      setIsTestMode(false);
      setIsInspectorOpen(true);

      if (path.length > 0) {
        focusNodeOnCanvas(path[0].conceptId, true, 300);
      }
    } else {
      setIsRevisionMode(false);
      setRevisionPath([]);
      setRevisionIndex(0);
    }
  }, [isRevisionMode, recallSession, practiceStates, selectedNodeId, effectiveNodes, effectiveEdges, focusNodeOnCanvas]);

  const handleStartCoreRevision = useCallback(() => {
    const path = generateRevisionPath({
      allNodes: effectiveNodes,
      allEdges: effectiveEdges,
      reviewConceptIds: new Set<string>(),
      testedConceptIds: recallSession.testedConceptIds,
      practiceStates,
      startConceptId: selectedNodeId || (effectiveNodes[0]?.id ?? null),
      onlyReviewQueue: false
    });

    setRevisionPath(path);
    setRevisionIndex(0);
    setRevisionVisitedIds(new Set());
    setIsRevisionMode(true);
    setIsTestMode(false);
    setIsInspectorOpen(true);

    if (path.length > 0) {
      focusNodeOnCanvas(path[0].conceptId, true, 300);
    }
  }, [effectiveNodes, effectiveEdges, recallSession.testedConceptIds, practiceStates, selectedNodeId, focusNodeOnCanvas]);

  const handlePrevRevisionConcept = useCallback(() => {
    if (!isRevisionMode || revisionIndex <= 0) return;
    const prevIdx = revisionIndex - 1;
    setRevisionIndex(prevIdx);
    const prevStep = revisionPath[prevIdx];
    if (prevStep) {
      focusNodeOnCanvas(prevStep.conceptId, true, 300);
    }
  }, [isRevisionMode, revisionIndex, revisionPath, focusNodeOnCanvas]);

  const handleNextRevisionConcept = useCallback(() => {
    if (!isRevisionMode) return;
    if (revisionIndex < revisionPath.length - 1) {
      const currentStep = revisionPath[revisionIndex];
      if (currentStep) {
        setRevisionVisitedIds(prev => new Set(prev).add(currentStep.conceptId));
      }
      const nextIdx = revisionIndex + 1;
      setRevisionIndex(nextIdx);
      const nextStep = revisionPath[nextIdx];
      if (nextStep) {
        focusNodeOnCanvas(nextStep.conceptId, true, 300);
      }
    }
  }, [isRevisionMode, revisionIndex, revisionPath, focusNodeOnCanvas]);

  const handleRevisionKnowIt = useCallback((conceptId: string) => {
    setRecallSession(prev => {
      const nextRecalled = new Set(prev.recalledConceptIds).add(conceptId);
      const nextReview = new Set(prev.reviewConceptIds);
      nextReview.delete(conceptId);
      const nextTested = new Set(prev.testedConceptIds).add(conceptId);
      return {
        ...prev,
        recalledConceptIds: nextRecalled,
        reviewConceptIds: nextReview,
        testedConceptIds: nextTested
      };
    });

    const updated = updateConceptPracticeState(conceptId, 'understood', graph?.id);
    setPracticeStates(prev => ({
      ...prev,
      [conceptId]: updated
    }));

    setRevisionVisitedIds(prev => new Set(prev).add(conceptId));

    if (revisionIndex < revisionPath.length - 1) {
      const nextIdx = revisionIndex + 1;
      setRevisionIndex(nextIdx);
      focusNodeOnCanvas(revisionPath[nextIdx].conceptId, true, 300);
    }
  }, [graph?.id, revisionIndex, revisionPath, focusNodeOnCanvas]);

  const handleRevisionReviewAgain = useCallback((conceptId: string) => {
    setRecallSession(prev => {
      const nextReview = new Set(prev.reviewConceptIds).add(conceptId);
      const nextTested = new Set(prev.testedConceptIds).add(conceptId);
      return {
        ...prev,
        reviewConceptIds: nextReview,
        testedConceptIds: nextTested
      };
    });

    const updated = updateConceptPracticeState(conceptId, 'needs-review', graph?.id);
    setPracticeStates(prev => ({
      ...prev,
      [conceptId]: updated
    }));

    setRevisionPath(prev => {
      const last = prev[prev.length - 1];
      if (last && last.conceptId === conceptId && prev.length === 1) {
        return prev;
      }
      const currentNode = effectiveNodes.find(n => n.id === conceptId);
      const name = currentNode?.data?.name || currentNode?.data?.label || conceptId;
      return [
        ...prev,
        {
          conceptId,
          conceptName: name,
          reason: 'review-again' as const,
          explanation: 'Re-queued for review'
        }
      ];
    });

    setRevisionVisitedIds(prev => new Set(prev).add(conceptId));

    if (revisionIndex < revisionPath.length - 1) {
      const nextIdx = revisionIndex + 1;
      setRevisionIndex(nextIdx);
      focusNodeOnCanvas(revisionPath[nextIdx].conceptId, true, 300);
    }
  }, [graph?.id, effectiveNodes, revisionIndex, revisionPath, focusNodeOnCanvas]);

  const revisionProgress = useMemo(() => {
    if (!isRevisionMode) return null;
    const total = revisionPath.length;
    const current = total > 0 ? revisionIndex + 1 : 0;
    return { current, total };
  }, [isRevisionMode, revisionIndex, revisionPath.length]);

  const isStudyActive = Boolean(isInspectorOpen && (activeConceptData || selectedRelationship || isRevisionMode));

  return (
    <div className={`freeform-graph-container ${isStudyActive ? 'in-study-mode' : ''} ${isGraphFullscreen ? 'is-fullscreen' : ''}`} id="knowledge-graph-workspace">
      {/* 1. Processing Status Banner (shown once loading orb dissolves or in direct crafting without central overlay) */}
      {mode === 'crafting' && !effectiveOverlayMounted && displayStatusMessage && (
        <div className="graph-crafting-indicator" role="status" aria-live="polite">
          <span className="crafting-indicator-dot" />
          <span className="crafting-indicator-text">{displayStatusMessage}</span>
        </div>
      )}

      {/* Floating Toolbar (Redesigned Editorial Canvas Toolbar) */}
      <AnimatePresence>
        {!isTestMode && (
          <motion.div
            key="graph-toolbar"
            className="graph-toolbar-animated-wrapper"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
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
              studyFilterMode={studyFilterMode}
              onStudyFilterChange={setStudyFilterMode}
              needsReviewCount={needsReviewCount}
              totalConceptsCount={totalConceptsCount}
              isFullscreen={isGraphFullscreen}
              onToggleFullscreen={() => handleToggleFullscreen()}
              isStudyPanelOpen={isInspectorOpen && Boolean(activeConceptData || selectedRelationship || isRevisionMode || isTestMode)}
              selectedConceptLabel={activeConceptData?.label || activeConceptData?.name || null}
              isTestMode={isTestMode}
              onToggleTestMode={() => handleToggleTestMode()}
              testProgress={testProgress}
              onNextTestQuestion={handleNextRecallConcept}
              isRevisionMode={isRevisionMode}
              onToggleRevisionMode={() => handleToggleRevisionMode()}
              revisionProgress={revisionProgress}
              onPrevRevisionConcept={handlePrevRevisionConcept}
              onNextRevisionConcept={handleNextRevisionConcept}
              hasPrevRevisionConcept={isRevisionMode && revisionIndex > 0}
              hasNextRevisionConcept={isRevisionMode && revisionIndex < revisionPath.length - 1}
              onNextConcept={isRevisionMode ? handleNextRevisionConcept : isTestMode ? handleNextRecallConcept : handleNextStudyConcept}
              onToggleStudyPanel={() => {
                if (isInspectorOpen) {
                  setIsInspectorOpen(false);
                  setIsTestMode(false);
                  setIsRevisionMode(false);
                  setSelectedRelationship(null);
                  setSelectedNodeId(null);
                  setNavHistory([]);
                } else if (selectedNodeId) {
                  setIsInspectorOpen(true);
                } else if (effectiveNodes.length > 0) {
                  focusNodeOnCanvas(effectiveNodes[0].id, true);
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State Notice for Needs Review filter (Phase 3 Section 26) */}
      {mode === 'interactive' && studyFilterMode === 'needs-review' && needsReviewCount === 0 && (
        <div className="study-empty-review-banner" role="status" aria-live="polite">
          <span className="empty-review-text">Nothing needs review yet.</span>
          <button 
            type="button" 
            className="empty-review-action"
            onClick={() => setStudyFilterMode('all')}
          >
            Show all
          </button>
        </div>
      )}

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

      {/* Continuous ReactFlow Canvas with reduced opacity while loading orb is active or dedicated test mode */}
      <div className={`freeform-canvas-wrapper ${effectiveCanvasDimmed ? 'dimmed-crafting' : ''} ${isTestMode ? 'graph-receded' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onMove={handleViewportMove}
          defaultViewport={{ x: 100, y: 80, zoom: 0.88 }}
          minZoom={0.2}
          maxZoom={2.4}
          panOnScroll={false}
          zoomOnScroll={true}
          panOnDrag={mode === 'interactive' && !isTestMode}
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

      {/* Subtle Canvas Corner Navigation Controls (Section 7: Bottom-right, quiet 32px targets) */}
      {mode === 'interactive' && !isTestMode && (
        <div className="canvas-corner-controls" role="group" aria-label="Canvas zoom and fit controls">
          <button
            type="button"
            className="corner-control-btn"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="corner-control-btn"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`corner-control-btn ${isGraphFullscreen ? 'active' : ''}`}
            onClick={() => handleToggleFullscreen()}
            title={isGraphFullscreen ? 'Exit full screen' : 'Enter full screen'}
            aria-label={isGraphFullscreen ? 'Exit full screen' : 'Enter full screen'}
          >
            {isGraphFullscreen ? (
              <Minimize size={14} aria-hidden="true" />
            ) : (
              <Maximize size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {/* 2. CANVAS-NATIVE EMPTY STATE (Quiet, Editorial, Spatial) */}
      {mode === 'empty' && (
        <CanvasEmptyState
          onOpenUpload={onOpenUpload}
          isDragOver={isDragOver}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
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
                state={isLiveError ? 'breathing' : 'connecting'} 
                paused={isLiveError}
                size={32} 
                theme="dark" 
                color={isLiveError ? '#FF5555' : '#A3FF12'} 
                speed={0.85} 
              />
              <div className="orb-ambient-glow" aria-hidden="true" />
            </div>

            <div className="hud-pill-divider" aria-hidden="true" />

            <div className="graph-loading-text-group">
              <div className="hud-pill-title-row">
                <span className="graph-loading-title">
                  {isLiveError ? 'Processing error' : 'GraphMind is getting ready'}
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
                <span className={`badge-pulse-dot ${isLiveError ? 'error-dot' : ''}`} />
                <span className="badge-text">
                  {pipelineError || displayStatusMessage || 'Reading your material…'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 4. Study / Inspector Context Panel (Interactive mode only: Concept or Relationship or Revision) */}
      <AnimatePresence>
        {mode === 'interactive' && isInspectorOpen && !isTestMode && (activeConceptData || selectedRelationship || isRevisionMode) && (
          <NodeContextPanel
            concept={activeConceptData}
            selectedRelationship={selectedRelationship}
            previousConceptName={previousConceptName}
            onGoBack={handleGoBack}
            onClose={() => {
              setIsInspectorOpen(false);
              setIsTestMode(false);
              setIsRevisionMode(false);
              setSelectedRelationship(null);
              setSelectedNodeId(null);
              setNavHistory([]);
            }}
            onSelectConcept={(conceptId) => focusNodeOnCanvas(conceptId, true)}
            onFocusNode={(conceptId) => focusNodeOnCanvas(conceptId, true)}
            onSelectSource={onSelectSource}
            isCollapsed={!isInspectorOpen}
            allGraphConcepts={allGraphConcepts}
            onUpdatePracticeState={(conceptId: string, status: PracticeStatus) => {
              const updated = updateConceptPracticeState(conceptId, status, graph?.id);
              setPracticeStates(prev => ({
                ...prev,
                [conceptId]: updated
              }));
              setNodes(prev => prev.map(n => {
                if (n.id === conceptId) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      practiceStatus: status,
                      practiceState: updated,
                      knowledgeState: updated
                    }
                  };
                }
                return n;
              }));
            }}
            isTestMode={isTestMode}
            onToggleTestMode={handleToggleTestMode}
            onTestStateUpdate={handleTestStateUpdate}
            onRecordSessionRecalled={handleRecordSessionRecalled}
            onRecordSessionReview={handleRecordSessionReview}
            onNextConcept={isRevisionMode ? handleNextRevisionConcept : handleNextRecallConcept}
            nextConceptName={isRevisionMode ? (revisionPath[revisionIndex + 1]?.conceptName || null) : nextRecallConceptName}
            isRevisionMode={isRevisionMode}
            onToggleRevisionMode={handleToggleRevisionMode}
            revisionProgress={revisionProgress}
            onPrevRevisionConcept={handlePrevRevisionConcept}
            onNextRevisionConcept={handleNextRevisionConcept}
            hasPrevRevisionConcept={isRevisionMode && revisionIndex > 0}
            hasNextRevisionConcept={isRevisionMode && revisionIndex < revisionPath.length - 1}
            onMarkRevisionKnowIt={handleRevisionKnowIt}
            onMarkRevisionReviewAgain={handleRevisionReviewAgain}
            onStartCoreRevision={handleStartCoreRevision}
          />
        )}
      </AnimatePresence>

      {/* 5. Dedicated Academic Examination Test Workspace */}
      <AnimatePresence>
        {mode === 'interactive' && isTestMode && (
          <TestWorkspace
            graph={graph}
            onClose={() => {
              setIsTestMode(false);
            }}
            onFocusConceptInGraph={(conceptId) => {
              setIsTestMode(false);
              setSelectedNodeId(conceptId);
              setIsInspectorOpen(true);
              focusNodeOnCanvas(conceptId, true);
            }}
            onPracticeStatesUpdated={refreshPracticeStates}
          />
        )}
      </AnimatePresence>
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
