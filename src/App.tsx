import { useState, useEffect, useMemo } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/overview/OverviewView';
import { KnowledgeGraphWorkspace } from './components/graph/KnowledgeGraphWorkspace';
import type { WorkspaceMode } from './components/graph/KnowledgeGraphWorkspace';
import { CreateGraphModal } from './components/modals/CreateGraphModal';
import { NewGraphModal } from './components/modals/NewGraphModal';
import { DeleteGraphModal } from './components/modals/DeleteGraphModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { SourcesView } from './components/sources/SourcesView';
import { LearningPathsView } from './components/paths/LearningPathsView';
import { normalizeCategory, demoKnowledgeGraph } from './data/graphData';
import type { KnowledgeSource, KnowledgeGraph } from './types/knowledgeGraph';
import { sourceToRecentMaterial } from './services/sourceIngestion';
import { pipelineOrchestrator, type PipelineStage, type PipelineProgressEvent } from './services/pipelineOrchestrator';
import { DEFAULT_MIGRATION_GRAPH_ID } from './services/storage';
import { generateLearningPaths } from './services/learningPathGeneration';
import { GraphProvider, useGraph } from './context/GraphContext';
import type { NavSection, RecentMaterial, ProjectWorkspace } from './types';

export function AppContent() {
  const getInitialSection = (): NavSection => {
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    if (path === 'graph') return 'graph';
    if (path === 'paths') return 'paths';
    if (path === 'sources') return 'sources';
    if (path === 'settings') return 'settings';
    return 'overview';
  };

  const [currentSection, setCurrentSection] = useState<NavSection>(getInitialSection);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [canvasDroppedFiles, setCanvasDroppedFiles] = useState<File[]>([]);
  const [newGraphModalOpen, setNewGraphModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [focusedConceptId, setFocusedConceptId] = useState<string | null>(null);

  const getInitialMode = (): WorkspaceMode => {
    const modeParam = new URLSearchParams(window.location.search).get('mode');
    if (modeParam === 'loading' || modeParam === 'crafting' || modeParam === 'empty') {
      return modeParam;
    }
    return 'interactive';
  };

  const [graphMode, setGraphMode] = useState<WorkspaceMode>(getInitialMode);

  // Consume central graph context (Prompt Requirements 1–25)
  const {
    graphs,
    activeGraphId,
    activeGraphMeta,
    activeGraph: contextActiveGraph,
    activeSources,
    activeCompletedConceptIds,
    createGraph,
    switchGraph,
    deleteGraph,
    updateActiveGraph,
    updateActiveSources,
    toggleCompleteConcept
  } = useGraph();

  // Pipeline processing state (scoped to active graph operations)
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('complete');
  const [pipelineStatusMessage, setPipelineStatusMessage] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<string | undefined>(undefined);
  const [livePipelineEvent, setLivePipelineEvent] = useState<PipelineProgressEvent | null>(null);

  // Separate demo mode state (only used if user specifically explores demo)
  const [isExploringDemo, setIsExploringDemo] = useState(false);

  // Active graph: strictly contextActiveGraph if in user mode, demoGraph only if exploring demo
  const effectiveGraph = useMemo<KnowledgeGraph>(() => {
    if (isExploringDemo) return demoKnowledgeGraph;
    if (contextActiveGraph) return contextActiveGraph;
    return { nodes: [], relationships: [], sources: [] };
  }, [isExploringDemo, contextActiveGraph]);

  // Project workspace metadata derived strictly from the active graph
  const projectWorkspace = useMemo<ProjectWorkspace>(() => {
    const nodeCount = effectiveGraph.nodes?.length || 0;
    const relCount = effectiveGraph.relationships?.length || 0;
    const density = nodeCount > 0
      ? `${(relCount / nodeCount).toFixed(2)} links / concept`
      : '0 links / concept';

    return {
      id: activeGraphMeta?.id || 'default_graph',
      name: activeGraphMeta?.name || 'Knowledge Graph',
      code: activeGraphMeta?.name ? activeGraphMeta.name.substring(0, 3).toUpperCase() : 'GM',
      domain: activeGraphMeta?.description || 'Knowledge Graph',
      activeNodes: nodeCount,
      density,
      lastUpdated: activeGraphMeta?.updatedAt ? 'Recently' : 'Just now',
      description: activeGraphMeta?.description,
      createdAt: activeGraphMeta?.createdAt,
      updatedAt: activeGraphMeta?.updatedAt
    };
  }, [activeGraphMeta, effectiveGraph]);

  // Real Learning Paths derivation (Requirements 2, 3, 14, 25):
  // Derived strictly from the active knowledge graph without cross-graph pollution
  const learningPathResult = useMemo(() => {
    return generateLearningPaths(contextActiveGraph, activeCompletedConceptIds);
  }, [contextActiveGraph, activeCompletedConceptIds]);

  const handleToggleCompleteConcept = (conceptId: string) => {
    toggleCompleteConcept(conceptId);
  };

  const handleExploreConceptInGraph = (conceptId: string) => {
    setFocusedConceptId(conceptId);
    navigateToSection('graph');
  };

  // Searchable concepts dynamically derived strictly from the active graph (Prompt 25)
  const searchableConcepts = useMemo(() => {
    if (effectiveGraph && effectiveGraph.nodes && effectiveGraph.nodes.length > 0) {
      return effectiveGraph.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        category: node.type ? normalizeCategory(node.type) : 'Concept',
        summary: node.description || ''
      }));
    }
    return [];
  }, [effectiveGraph]);

  const recentMaterials = useMemo<RecentMaterial[]>(() => {
    return activeSources.map(sourceToRecentMaterial);
  }, [activeSources]);

  const navigateToSection = (section: NavSection) => {
    setCurrentSection(section);
    const targetPath = section === 'overview' ? '/' : `/${section}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  // Sync route on browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentSection(getInitialSection());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global hotkeys (Cmd+K / Ctrl+K and Cmd+,)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigateToSection('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Graph Switching Handler (Requirement 7)
  const handleSelectGraph = (graphId: string) => {
    setIsExploringDemo(false);
    switchGraph(graphId);
  };

  // Graph Creation Handler (Requirement 8 & 9)
  const handleCreateNewGraph = (name: string, description?: string) => {
    setIsExploringDemo(false);
    createGraph(name, description);
    setGraphMode('empty');
  };

  // Ingestion handler: accepts newly uploaded material and tags with activeGraphId
  const handleCreateSuccess = async (
    newSources: KnowledgeSource[],
    onModalProgress?: (event: PipelineProgressEvent) => void
  ): Promise<boolean> => {
    setCreateModalOpen(false);
    setIsExploringDemo(false);
    setPipelineError(undefined);
    setPipelineStage('reading');
    setPipelineStatusMessage('Reading your material…');
    setLivePipelineEvent({
      stage: 'reading',
      message: 'Reading your material…',
      timestamp: Date.now()
    });
    setGraphMode('crafting');
    navigateToSection('graph');

    const targetGraphId = activeGraphId || DEFAULT_MIGRATION_GRAPH_ID;

    // Tag newly uploaded sources with activeGraphId (Requirement 10)
    const initialNewSources: KnowledgeSource[] = newSources.map(s => ({
      ...s,
      graphId: targetGraphId,
      status: 'processing' as const,
      processingStage: 'reading' as const
    }));

    // Combine ONLY with current active graph sources
    const targetUserSources = [...initialNewSources, ...activeSources];
    updateActiveSources(targetUserSources);

    // Execute complete end-to-end pipeline scoped to activeGraphId:
    try {
      const result = await pipelineOrchestrator.execute(targetUserSources, {
        graphId: targetGraphId,
        onProgress: (evt) => {
          setPipelineStage(evt.stage);
          setPipelineStatusMessage(evt.message);
          setLivePipelineEvent(evt);
          onModalProgress?.(evt);

          // Update active processing stage on the newly added sources
          const updated = targetUserSources.map(s => {
            if (newSources.some(ns => ns.id === s.id)) {
              return {
                ...s,
                status: (evt.stage === 'error' ? 'failed' : evt.stage === 'complete' ? 'ready' : 'processing') as KnowledgeSource['status'],
                processingStage: evt.stage
              };
            }
            return s;
          });
          updateActiveSources(updated);
        }
      });

      if (result.success && result.graph && result.graph.nodes.length > 0) {
        // Tag finalized provenance on sources for this graph
        const finalizedSources: KnowledgeSource[] = targetUserSources.map(s => {
          const matchingNodes = result.graph!.nodes.filter(n => n.sourceIds && n.sourceIds.includes(s.id));
          const conceptIds = matchingNodes.map(n => n.id);
          return {
            ...s,
            graphId: targetGraphId,
            status: 'ready' as const,
            processingStage: 'complete' as const,
            conceptIds,
            conceptsExtracted: conceptIds.length
          };
        });

        const scopedGraph: KnowledgeGraph = {
          ...result.graph,
          id: targetGraphId,
          nodes: result.graph.nodes.map(n => ({ ...n, graphId: targetGraphId })),
          relationships: result.graph.relationships.map(r => ({ ...r, graphId: targetGraphId })),
          sources: finalizedSources
        };

        updateActiveSources(finalizedSources);
        updateActiveGraph(scopedGraph);

        setPipelineStage('complete');
        setPipelineStatusMessage('Your knowledge graph is ready.');
        setLivePipelineEvent({
          stage: 'complete',
          message: 'Your knowledge graph is ready.',
          timestamp: Date.now(),
          partialGraph: scopedGraph
        });
        setGraphMode('interactive');
        return true;
      } else {
        const errorMsg = result.error?.message || 'Failed to construct knowledge graph from uploaded material.';
        const failedSources: KnowledgeSource[] = targetUserSources.map(s => {
          if (newSources.some(ns => ns.id === s.id)) {
            return {
              ...s,
              status: 'failed' as const,
              processingStage: 'error' as const,
              error: errorMsg
            };
          }
          return s;
        });
        updateActiveSources(failedSources);

        setPipelineStage('error');
        setPipelineError(errorMsg);
        setPipelineStatusMessage(errorMsg);
        setLivePipelineEvent({
          stage: 'error',
          message: errorMsg,
          timestamp: Date.now()
        });
        return false;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during processing.';
      const failedSources: KnowledgeSource[] = targetUserSources.map(s => {
        if (newSources.some(ns => ns.id === s.id)) {
          return {
            ...s,
            status: 'failed' as const,
            processingStage: 'error' as const,
            error: errorMsg
          };
        }
        return s;
      });
      updateActiveSources(failedSources);

      setPipelineStage('error');
      setPipelineError(errorMsg);
      setPipelineStatusMessage(errorMsg);
      setLivePipelineEvent({
        stage: 'error',
        message: errorMsg,
        timestamp: Date.now()
      });
      return false;
    }
  };

  const handleRemoveSource = (sourceId: string) => {
    const nextSources = activeSources.filter(s => s.id !== sourceId);
    updateActiveSources(nextSources);

    if (contextActiveGraph) {
      // Clean up graph provenance:
      // Keep nodes that either don't have this sourceId, or are shared across multiple sources
      const updatedNodes = contextActiveGraph.nodes
        .filter(n => {
          if (!n.sourceIds || !n.sourceIds.includes(sourceId)) return true;
          return n.sourceIds.length > 1; // Preserve shared concepts
        })
        .map(n => {
          if (n.sourceIds && n.sourceIds.includes(sourceId)) {
            return {
              ...n,
              sourceIds: n.sourceIds.filter(id => id !== sourceId)
            };
          }
          return n;
        });

      const validNodeIds = new Set(updatedNodes.map(n => n.id));
      const updatedRelationships = contextActiveGraph.relationships
        .filter(r => validNodeIds.has(r.source) && validNodeIds.has(r.target))
        .map(r => {
          if (r.sourceIds && r.sourceIds.includes(sourceId)) {
            return {
              ...r,
              sourceIds: r.sourceIds.filter(id => id !== sourceId)
            };
          }
          return r;
        });

      const updatedGraphSources = contextActiveGraph.sources.filter(s => s.id !== sourceId);

      if (updatedNodes.length === 0 || nextSources.length === 0) {
        updateActiveGraph(null);
      } else {
        const nextGraph: KnowledgeGraph = {
          id: activeGraphId || undefined,
          nodes: updatedNodes,
          relationships: updatedRelationships,
          sources: updatedGraphSources
        };
        updateActiveGraph(nextGraph);
      }
    }
  };

  const handleConfirmDeleteActiveGraph = () => {
    if (!activeGraphId) return;
    deleteGraph(activeGraphId);
  };

  return (
    <>
      <AppShell
        currentSection={currentSection}
        onSelectSection={navigateToSection}
        project={projectWorkspace}
        recentMaterials={recentMaterials}
        graphs={graphs}
        activeGraphId={activeGraphId}
        activeGraphMeta={activeGraphMeta}
        onSelectGraph={handleSelectGraph}
        onOpenNewGraphModal={() => setNewGraphModalOpen(true)}
        onOpenSearch={() => setSearchPaletteOpen(true)}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      >
        {/* Overview View */}
        {currentSection === 'overview' && (
          <OverviewView
            onCreateGraph={() => setCreateModalOpen(true)}
            onExploreDemo={() => {
              setIsExploringDemo(true);
              navigateToSection('graph');
            }}
            hasContent={(contextActiveGraph?.nodes?.length || 0) > 0}
            graphMeta={activeGraphMeta}
            sourceCount={activeSources.length}
            conceptCount={contextActiveGraph?.nodes?.length || 0}
            relationshipCount={contextActiveGraph?.relationships?.length || 0}
          />
        )}

        {/* Dedicated Knowledge Graph Workspace (/graph) */}
        {currentSection === 'graph' && (
          <KnowledgeGraphWorkspace 
            onOpenUpload={() => setCreateModalOpen(true)} 
            onFilesDropped={(files) => {
              setCanvasDroppedFiles(files);
              setCreateModalOpen(true);
            }}
            initialMode={graphMode}
            graph={effectiveGraph}
            graphName={activeGraphMeta?.name || 'Your graph'}
            graphSourceType={isExploringDemo ? 'demo' : 'user'}
            onSwitchGraphSource={(type) => setIsExploringDemo(type === 'demo')}
            hasUserGraph={contextActiveGraph !== null && contextActiveGraph.nodes.length > 0}
            pipelineStage={pipelineStage}
            pipelineStatusMessage={pipelineStatusMessage}
            pipelineError={pipelineError}
            livePipelineEvent={livePipelineEvent}
            focusedNodeId={focusedConceptId}
            onClearFocusedNode={() => setFocusedConceptId(null)}
            onSelectSource={() => navigateToSection('sources')}
            onClearError={() => {
              setPipelineError(undefined);
              setPipelineStage('complete');
              setLivePipelineEvent(null);
            }}
          />
        )}

        {/* Learning Paths View */}
        {currentSection === 'paths' && (
          <LearningPathsView 
            paths={learningPathResult.paths}
            totalConceptsInGraph={contextActiveGraph?.nodes?.length || 0}
            totalRelationshipsInGraph={contextActiveGraph?.relationships?.length || 0}
            isLoading={pipelineStage !== 'complete' && pipelineStage !== 'error' && activeSources.some(s => s.status === 'processing')}
            loadingMessage={pipelineStatusMessage}
            onSelectPath={(pathId) => {
              if (!pathId) {
                navigateToSection('graph');
              }
            }}
            onOpenUpload={() => setCreateModalOpen(true)}
            onToggleCompleteConcept={handleToggleCompleteConcept}
            onExploreConceptInGraph={handleExploreConceptInGraph}
            sources={activeSources}
          />
        )}

        {/* Sources View */}
        {currentSection === 'sources' && (
          <SourcesView
            sources={activeSources}
            activeGraph={contextActiveGraph}
            onAddSource={() => setCreateModalOpen(true)}
            onRemoveSource={handleRemoveSource}
          />
        )}

        {/* Settings View (Accessible via ⌘,) */}
        {currentSection === 'settings' && (
          <div className="page-container">
            <header className="page-header">
              <div className="page-header-left">
                <span className="page-kicker">Preferences</span>
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">
                  Knowledge graph preferences and workspace management.
                </p>
              </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Concept extraction sensitivity</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Threshold for connecting concepts</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>0.85</span>
              </div>

              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Default graph layout</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Hierarchical layout for structured understanding</div>
                </div>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Hierarchical</span>
              </div>

              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Keyboard shortcuts</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Global hotkeys for navigation</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px' }}>⌘K Search</kbd>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px' }}>⌘, Settings</kbd>
                </div>
              </div>

              {/* Graph Management Section (Requirement 17) */}
              {activeGraphMeta && (
                <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Manage graph: {activeGraphMeta.name}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Permanently remove this graph and all of its associated sources and progress.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.10)',
                      border: '1px solid rgba(239, 68, 68, 0.28)',
                      color: '#f87171',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'background-color 140ms ease'
                    }}
                    id="btn-settings-delete-graph"
                  >
                    Delete graph…
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AppShell>

      {/* Upload Material Modal */}
      <CreateGraphModal
        isOpen={createModalOpen}
        initialFiles={canvasDroppedFiles}
        onClose={() => {
          setCreateModalOpen(false);
          setCanvasDroppedFiles([]);
        }}
        onSuccess={handleCreateSuccess}
        existingSources={activeSources}
      />

      {/* New Graph Creation Modal */}
      <NewGraphModal
        isOpen={newGraphModalOpen}
        onClose={() => setNewGraphModalOpen(false)}
        onCreate={handleCreateNewGraph}
        existingNames={graphs.map(g => g.name)}
      />

      {/* Secondary Graph Deletion Confirmation Dialog */}
      <DeleteGraphModal
        isOpen={deleteModalOpen}
        graphName={activeGraphMeta?.name || 'this graph'}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteActiveGraph}
      />

      {/* Global Command Palette (Cmd + K) */}
      <CommandPalette
        isOpen={searchPaletteOpen}
        onClose={() => setSearchPaletteOpen(false)}
        concepts={searchableConcepts}
        onSelectConcept={(conceptId) => {
          setFocusedConceptId(conceptId);
          navigateToSection('graph');
        }}
      />
    </>
  );
}

export function App() {
  return (
    <GraphProvider>
      <AppContent />
    </GraphProvider>
  );
}

export default App;
