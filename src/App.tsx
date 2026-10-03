import { useState, useEffect, useMemo } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/overview/OverviewView';
import { KnowledgeGraphWorkspace } from './components/graph/KnowledgeGraphWorkspace';
import type { WorkspaceMode } from './components/graph/KnowledgeGraphWorkspace';
import { CreateGraphModal } from './components/modals/CreateGraphModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { SourcesView } from './components/sources/SourcesView';
import { LearningPathsView } from './components/paths/LearningPathsView';
import { 
  mockProjectWorkspace, 
  mockLearningPaths 
} from './data/mockData';
import { demoKnowledgeGraph, normalizeCategory } from './data/graphData';
import type { KnowledgeSource, KnowledgeGraph } from './types/knowledgeGraph';
import { sourceToRecentMaterial } from './services/sourceIngestion';
import { pipelineOrchestrator, type PipelineStage, type PipelineProgressEvent } from './services/pipelineOrchestrator';
import { 
  loadUserSources, 
  saveUserSources, 
  loadUserGraph, 
  saveUserGraph, 
  loadGraphSourceType, 
  saveGraphSourceType 
} from './services/storage';
import type { NavSection, RecentMaterial } from './types';

export function App() {
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
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [hasGraphContent, setHasGraphContent] = useState(true);
  const getInitialMode = (): WorkspaceMode => {
    const modeParam = new URLSearchParams(window.location.search).get('mode');
    if (modeParam === 'loading' || modeParam === 'crafting' || modeParam === 'empty') {
      return modeParam;
    }
    return 'interactive';
  };

  // Demo vs User-generated graph separation
  const [demoGraph] = useState<KnowledgeGraph>(demoKnowledgeGraph);
  const [userGraph, setUserGraph] = useState<KnowledgeGraph | null>(() => loadUserGraph());
  const [userSources, setUserSources] = useState<KnowledgeSource[]>(() => loadUserSources());
  const [graphSourceType, setGraphSourceType] = useState<'demo' | 'user'>(() => loadGraphSourceType());
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('complete');
  const [pipelineStatusMessage, setPipelineStatusMessage] = useState<string>('');
  const [pipelineError, setPipelineError] = useState<string | undefined>(undefined);
  const [livePipelineEvent, setLivePipelineEvent] = useState<PipelineProgressEvent | null>(null);
  const [focusedConceptId, setFocusedConceptId] = useState<string | null>(null);

  // Active graph: strictly userGraph when in 'user' mode and userGraph exists, demoGraph when in 'demo' mode
  const activeGraph = graphSourceType === 'user' && userGraph ? userGraph : demoGraph;

  // Searchable concepts dynamically derived from the active knowledge graph (Prompt 25)
  const searchableConcepts = useMemo(() => {
    if (activeGraph && activeGraph.nodes && activeGraph.nodes.length > 0) {
      return activeGraph.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        category: node.type ? normalizeCategory(node.type) : 'Concept',
        summary: node.description || ''
      }));
    }
    return [];
  }, [activeGraph]);

  const [canonicalSources, setCanonicalSources] = useState<KnowledgeSource[]>(() => loadUserSources());
  const [sources, setSources] = useState<RecentMaterial[]>(() => {
    return loadUserSources().map(sourceToRecentMaterial);
  });
  const [graphMode, setGraphMode] = useState<WorkspaceMode>(getInitialMode);

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

  // Ingestion handler: accepts newly created real KnowledgeSources
  const handleCreateSuccess = async (
    newSources: KnowledgeSource[],
    onModalProgress?: (event: PipelineProgressEvent) => void
  ): Promise<boolean> => {
    setCreateModalOpen(false);
    setHasGraphContent(true);
    setPipelineError(undefined);
    setPipelineStage('reading');
    setPipelineStatusMessage('Reading your material…');
    setLivePipelineEvent({
      stage: 'reading',
      message: 'Reading your material…',
      timestamp: Date.now()
    });
    setGraphMode('crafting');
    setGraphSourceType('user');
    saveGraphSourceType('user');
    navigateToSection('graph');

    // Mark newly uploaded sources as pending/reading
    const initialNewSources: KnowledgeSource[] = newSources.map(s => ({
      ...s,
      status: 'processing' as const,
      processingStage: 'reading' as const
    }));

    // Combine ONLY with previously uploaded user sources (never with demo sources!)
    const targetUserSources = [...initialNewSources, ...userSources];
    setUserSources(targetUserSources);
    setCanonicalSources(targetUserSources);
    setSources(targetUserSources.map(sourceToRecentMaterial));
    saveUserSources(targetUserSources);

    // Execute complete end-to-end pipeline via orchestrator:
    try {
      const result = await pipelineOrchestrator.execute(targetUserSources, {
        onProgress: (evt) => {
          setPipelineStage(evt.stage);
          setPipelineStatusMessage(evt.message);
          setLivePipelineEvent(evt);
          onModalProgress?.(evt);

          // Update active processing stage on the newly added sources
          setUserSources(prev => {
            const updated = prev.map(s => {
              if (newSources.some(ns => ns.id === s.id)) {
                return {
                  ...s,
                  status: (evt.stage === 'error' ? 'failed' : evt.stage === 'complete' ? 'ready' : 'processing') as KnowledgeSource['status'],
                  processingStage: evt.stage
                };
              }
              return s;
            });
            saveUserSources(updated);
            return updated;
          });
          setSources(prev => prev.map(s => {
            if (newSources.some(ns => ns.id === s.id)) {
              return {
                ...s,
                status: (evt.stage === 'error' ? 'failed' : evt.stage === 'complete' ? 'ready' : 'processing') as RecentMaterial['status']
              };
            }
            return s;
          }));
        }
      });

      if (result.success && result.graph && result.graph.nodes.length > 0) {
        // Compute provenance for each source from the actual resulting graph
        const finalizedSources: KnowledgeSource[] = targetUserSources.map(s => {
          const matchingNodes = result.graph!.nodes.filter(n => n.sourceIds && n.sourceIds.includes(s.id));
          const conceptIds = matchingNodes.map(n => n.id);
          return {
            ...s,
            status: 'ready' as const,
            processingStage: 'complete' as const,
            conceptIds,
            conceptsExtracted: conceptIds.length
          };
        });

        setUserSources(finalizedSources);
        setCanonicalSources(finalizedSources);
        setSources(finalizedSources.map(sourceToRecentMaterial));
        saveUserSources(finalizedSources);

        setUserGraph(result.graph);
        saveUserGraph(result.graph);
        setGraphSourceType('user');
        saveGraphSourceType('user');

        setPipelineStage('complete');
        setPipelineStatusMessage('Your knowledge graph is ready.');
        setLivePipelineEvent({
          stage: 'complete',
          message: 'Your knowledge graph is ready.',
          timestamp: Date.now(),
          partialGraph: result.graph
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
        setUserSources(failedSources);
        setCanonicalSources(failedSources);
        setSources(failedSources.map(sourceToRecentMaterial));
        saveUserSources(failedSources);

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
      setUserSources(failedSources);
      setCanonicalSources(failedSources);
      setSources(failedSources.map(sourceToRecentMaterial));
      saveUserSources(failedSources);

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
    const nextSources = userSources.filter(s => s.id !== sourceId);
    setCanonicalSources(nextSources);
    setUserSources(nextSources);
    setSources(nextSources.map(sourceToRecentMaterial));
    saveUserSources(nextSources);

    if (userGraph) {
      // Clean up graph provenance:
      // Keep nodes that either don't have this sourceId, or are shared across multiple sources
      const updatedNodes = userGraph.nodes
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
      const updatedRelationships = userGraph.relationships
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

      const updatedGraphSources = userGraph.sources.filter(s => s.id !== sourceId);

      if (updatedNodes.length === 0 || nextSources.length === 0) {
        setUserGraph(null);
        saveUserGraph(null);
        setGraphSourceType('demo');
        saveGraphSourceType('demo');
      } else {
        const nextGraph: KnowledgeGraph = {
          nodes: updatedNodes,
          relationships: updatedRelationships,
          sources: updatedGraphSources
        };
        setUserGraph(nextGraph);
        saveUserGraph(nextGraph);
      }
    }
  };

  return (
    <>
      <AppShell
        currentSection={currentSection}
        onSelectSection={navigateToSection}
        project={mockProjectWorkspace}
        recentMaterials={sources}
        onOpenSearch={() => setSearchPaletteOpen(true)}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      >
        {/* Overview View */}
        {currentSection === 'overview' && (
          <OverviewView
            onCreateGraph={() => setCreateModalOpen(true)}
            onExploreDemo={() => {
              setGraphSourceType('demo');
              setHasGraphContent(true);
              navigateToSection('graph');
            }}
            hasContent={hasGraphContent}
          />
        )}

        {/* Dedicated Knowledge Graph Workspace (/graph) */}
        {currentSection === 'graph' && (
          <KnowledgeGraphWorkspace 
            onOpenUpload={() => setCreateModalOpen(true)} 
            initialMode={graphMode}
            graph={activeGraph}
            graphSourceType={graphSourceType}
            onSwitchGraphSource={(type) => setGraphSourceType(type)}
            hasUserGraph={userGraph !== null && userGraph.nodes.length > 0}
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
            paths={mockLearningPaths}
            onSelectPath={() => navigateToSection('graph')}
          />
        )}

        {/* Sources View */}
        {currentSection === 'sources' && (
          <SourcesView
            sources={userSources}
            activeGraph={userGraph}
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
                  Knowledge graph preferences and keyboard shortcuts.
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
            </div>
          </div>
        )}
      </AppShell>

      {/* Upload Material Modal */}
      <CreateGraphModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        existingSources={canonicalSources}
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

export default App;
