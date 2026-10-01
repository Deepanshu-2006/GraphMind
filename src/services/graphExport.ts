import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node, type Edge } from '@xyflow/react';
import type { KnowledgeGraph, GraphConceptData } from '../types';

export interface ExportedGraphJson {
  graphName: string;
  exportedAt: string;
  version: string;
  nodes: {
    id: string;
    name: string;
    type: string;
    description: string;
    sourceIds: string[];
    sources?: string[];
    confidence?: number;
    prerequisites?: string[];
  }[];
  relationships: {
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
    description?: string;
    sourceIds?: string[];
  }[];
  sources: {
    id: string;
    name: string;
    fileName: string;
    type: string;
    status: string;
    conceptsExtracted?: number;
  }[];
}

/**
 * Builds the canonical export JSON structure from graph data or ReactFlow nodes/edges.
 */
export function buildExportGraphJson(
  graph: KnowledgeGraph | null,
  effectiveNodes: Node<GraphConceptData>[] = [],
  effectiveEdges: Edge[] = []
): ExportedGraphJson {
  if (graph && graph.nodes) {
    const sourceMap = new Map<string, string>();
    for (const s of graph.sources || []) {
      sourceMap.set(s.id, s.fileName || s.name);
    }

    return {
      graphName: 'GraphMind Knowledge Graph',
      exportedAt: new Date().toISOString(),
      version: '1.0',
      nodes: graph.nodes.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        description: n.description,
        sourceIds: n.sourceIds || [],
        sources: (n.sourceIds || [])
          .map(id => sourceMap.get(id))
          .filter((name): name is string => Boolean(name)),
        confidence: n.confidence,
        prerequisites: n.prerequisites || []
      })),
      relationships: (graph.relationships || []).map(r => ({
        id: r.id,
        source: r.source,
        target: r.target,
        type: r.type,
        label: r.label || r.type,
        description: r.description,
        sourceIds: r.sourceIds || []
      })),
      sources: (graph.sources || []).map(s => ({
        id: s.id,
        name: s.name,
        fileName: s.fileName || s.name,
        type: s.type,
        status: s.status,
        conceptsExtracted: s.conceptsExtracted
      }))
    };
  }

  // Fallback: derive from effectiveNodes and effectiveEdges
  return {
    graphName: 'GraphMind Knowledge Graph',
    exportedAt: new Date().toISOString(),
    version: '1.0',
    nodes: effectiveNodes.map(n => {
      const d = n.data || {};
      return {
        id: n.id,
        name: d.label || n.id,
        type: d.category || 'concept',
        description: d.description || '',
        sourceIds: [],
        sources: d.source ? [d.source] : (d.sources || []).map(s => s.name),
        confidence: d.confidence,
        prerequisites: d.prerequisites || []
      };
    }),
    relationships: effectiveEdges.map(e => {
      const edgeData = (e.data as Record<string, unknown>) || {};
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: (e.label as string) || (edgeData.relation as string) || 'related-to',
        label: (e.label as string) || undefined,
        description: (edgeData.description as string) || undefined
      };
    }),
    sources: []
  };
}

/**
 * Exports graph data as structured JSON preserving:
 * concept IDs, concept names, types, descriptions, source references, and relationship types.
 */
export function exportKnowledgeGraphJson(
  graph: KnowledgeGraph | null,
  effectiveNodes: Node<GraphConceptData>[] = [],
  effectiveEdges: Edge[] = [],
  filename: string = 'graphmind-knowledge-graph.json'
): boolean {
  try {
    const payload = buildExportGraphJson(graph, effectiveNodes, effectiveEdges);

    if (typeof document !== 'undefined') {
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Exports current graph canvas as a clean PNG image.
 * Excludes browser controls, sidebar, search UI, temporary toolbars, and selection controls.
 */
export async function exportKnowledgeGraphPng(
  viewportElement: HTMLElement,
  nodes: Node<GraphConceptData>[],
  filename: string = 'graphmind-knowledge-graph.png'
): Promise<boolean> {
  if (!nodes || nodes.length === 0) {
    throw new Error('No nodes to export');
  }

  const nodesBounds = getNodesBounds(nodes);
  const padding = 70;
  const imageWidth = Math.max(900, Math.round(nodesBounds.width + padding * 2));
  const imageHeight = Math.max(650, Math.round(nodesBounds.height + padding * 2));

  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    0.15
  );

  viewportElement.classList.add('exporting-clean-canvas');

  const options = {
    backgroundColor: '#0A0C09',
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
    },
    filter: (domNode: Node | HTMLElement) => {
      if (domNode instanceof HTMLElement) {
        if (domNode.classList.contains('node-handle')) return false;
        if (domNode.classList.contains('canvas-floating-toolbar')) return false;
        if (domNode.classList.contains('floating-node-inspector')) return false;
        if (domNode.classList.contains('react-flow__controls')) return false;
        if (domNode.classList.contains('graph-canvas-overlay')) return false;
      }
      return true;
    }
  };

  try {
    let dataUrl: string;
    try {
      dataUrl = await toPng(viewportElement, options);
    } catch {
      // Retry with skipFonts in case of remote font CORS or security restrictions
      dataUrl = await toPng(viewportElement, { ...options, skipFonts: true });
    }

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    return true;
  } finally {
    viewportElement.classList.remove('exporting-clean-canvas');
  }
}
