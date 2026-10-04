import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { KnowledgeGraph, KnowledgeGraphMeta, KnowledgeSource } from '../types/knowledgeGraph';
import {
  loadGraphs,
  loadActiveGraphId,
  saveActiveGraphId,
  createGraph as createGraphStorage,
  deleteGraph as deleteGraphStorage,
  loadGraphData,
  saveGraphData,
  loadUserSources,
  saveUserSources,
  loadCompletedConceptIds,
  renameGraph as renameGraphStorage,
  toggleCompletedConceptId as toggleCompletedConceptIdStorage
} from '../services/storage';

export interface GraphContextValue {
  graphs: KnowledgeGraphMeta[];
  activeGraphId: string | null;
  activeGraphMeta: KnowledgeGraphMeta | null;
  activeGraph: KnowledgeGraph | null;
  activeSources: KnowledgeSource[];
  activeCompletedConceptIds: string[];
  createGraph: (name: string, description?: string) => KnowledgeGraphMeta;
  renameGraph: (graphId: string, newName: string) => KnowledgeGraphMeta | null;
  switchGraph: (graphId: string) => void;
  deleteGraph: (graphId: string) => void;
  updateActiveGraph: (graph: KnowledgeGraph | null) => void;
  updateActiveSources: (sources: KnowledgeSource[]) => void;
  toggleCompleteConcept: (conceptId: string) => string[];
  refreshGraphs: () => void;
}

const GraphContext = createContext<GraphContextValue | null>(null);

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [graphs, setGraphs] = useState<KnowledgeGraphMeta[]>(() => loadGraphs());
  const [activeGraphId, setActiveGraphId] = useState<string | null>(() => loadActiveGraphId());

  // Derive metadata of the active graph
  const activeGraphMeta = useMemo(() => {
    if (!activeGraphId) return null;
    return graphs.find(g => g.id === activeGraphId) || null;
  }, [graphs, activeGraphId]);

  // Active graph contents (scoped to activeGraphId)
  const [activeGraph, setActiveGraph] = useState<KnowledgeGraph | null>(() => {
    const id = loadActiveGraphId();
    return id ? loadGraphData(id) : null;
  });

  // Active graph sources (scoped to activeGraphId)
  const [activeSources, setActiveSources] = useState<KnowledgeSource[]>(() => {
    const id = loadActiveGraphId();
    return id ? loadUserSources(id) : [];
  });

  // Active completed concept IDs (scoped to activeGraphId)
  const [activeCompletedConceptIds, setActiveCompletedConceptIds] = useState<string[]>(() => {
    const id = loadActiveGraphId();
    return id ? loadCompletedConceptIds(id) : [];
  });

  // Keep state synchronized whenever activeGraphId changes
  const loadScopedDataForGraph = useCallback((graphId: string | null) => {
    if (!graphId) {
      setActiveGraph(null);
      setActiveSources([]);
      setActiveCompletedConceptIds([]);
      return;
    }

    const loadedGraph = loadGraphData(graphId);
    const loadedSources = loadUserSources(graphId);
    const loadedCompleted = loadCompletedConceptIds(graphId);

    setActiveGraph(loadedGraph);
    setActiveSources(loadedSources);
    setActiveCompletedConceptIds(loadedCompleted);
  }, []);

  const switchGraph = useCallback((graphId: string) => {
    if (!graphId) return;
    saveActiveGraphId(graphId);
    setActiveGraphId(graphId);
    loadScopedDataForGraph(graphId);
  }, [loadScopedDataForGraph]);

  const createGraph = useCallback((name: string, description?: string) => {
    const newMeta = createGraphStorage(name, description);
    const updatedGraphs = loadGraphs();
    setGraphs(updatedGraphs);
    setActiveGraphId(newMeta.id);
    setActiveGraph(null);
    setActiveSources([]);
    setActiveCompletedConceptIds([]);
    return newMeta;
  }, []);

  const renameGraph = useCallback((graphId: string, newName: string) => {
    const updated = renameGraphStorage(graphId, newName);
    if (updated) {
      setGraphs(prev => prev.map(g => g.id === graphId ? updated! : g));
      if (graphId === activeGraphId) {
        setActiveGraph(prev => prev ? { ...prev, name: updated!.name } : null);
      }
    }
    return updated;
  }, [activeGraphId]);

  const deleteGraph = useCallback((graphId: string) => {
    const { remainingGraphs, nextActiveId } = deleteGraphStorage(graphId);
    setGraphs(remainingGraphs);
    setActiveGraphId(nextActiveId);
    loadScopedDataForGraph(nextActiveId);
  }, [loadScopedDataForGraph]);

  const updateActiveGraph = useCallback((graph: KnowledgeGraph | null) => {
    if (!activeGraphId) return;
    setActiveGraph(graph);
    saveGraphData(activeGraphId, graph);
  }, [activeGraphId]);

  const updateActiveSources = useCallback((sources: KnowledgeSource[]) => {
    if (!activeGraphId) return;
    setActiveSources(sources);
    saveUserSources(sources, activeGraphId);
  }, [activeGraphId]);

  const toggleCompleteConcept = useCallback((conceptId: string) => {
    if (!activeGraphId) return [];
    const updated = toggleCompletedConceptIdStorage(conceptId, activeGraphId);
    setActiveCompletedConceptIds(updated);
    return updated;
  }, [activeGraphId]);

  const refreshGraphs = useCallback(() => {
    const loaded = loadGraphs();
    setGraphs(loaded);
    const currentActive = loadActiveGraphId();
    setActiveGraphId(currentActive);
    loadScopedDataForGraph(currentActive);
  }, [loadScopedDataForGraph]);

  // Sync on storage change (across windows/tabs)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'graphmind_graphs_v1' ||
        e.key === 'graphmind_active_graph_id_v1' ||
        (e.key && e.key.startsWith('graphmind_'))
      ) {
        refreshGraphs();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshGraphs]);

  const value = useMemo<GraphContextValue>(() => ({
    graphs,
    activeGraphId,
    activeGraphMeta,
    activeGraph,
    activeSources,
    activeCompletedConceptIds,
    createGraph,
    renameGraph,
    switchGraph,
    deleteGraph,
    updateActiveGraph,
    updateActiveSources,
    toggleCompleteConcept,
    refreshGraphs
  }), [
    graphs,
    activeGraphId,
    activeGraphMeta,
    activeGraph,
    activeSources,
    activeCompletedConceptIds,
    createGraph,
    renameGraph,
    switchGraph,
    deleteGraph,
    updateActiveGraph,
    updateActiveSources,
    toggleCompleteConcept,
    refreshGraphs
  ]);

  return (
    <GraphContext.Provider value={value}>
      {children}
    </GraphContext.Provider>
  );
};

export function useGraph(): GraphContextValue {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
}
