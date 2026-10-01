import type { Node, Edge } from '@xyflow/react';
import type { 
  KnowledgeGraph, 
  KnowledgeNode, 
  KnowledgeSource,
  ConceptCategory,
  GraphConceptData,
  ConceptRelationship,
  ConceptSourceReference
} from '../types';

export * from '../types/knowledgeGraph';

/**
 * ==================================================
 * CANONICAL KNOWLEDGE GRAPH (Day 2 Intelligence Model)
 * ==================================================
 * Structure:
 * SOURCE → CONCEPTS → RELATIONSHIPS → KNOWLEDGE GRAPH
 */
export const defaultKnowledgeGraph: KnowledgeGraph = {
  sources: [
    {
      id: 'src-stanford-cs229',
      name: 'Stanford CS229: Machine Learning Course Notes',
      type: 'pdf',
      fileName: 'Stanford CS229.pdf',
      text: 'Learning algorithms, empirical risk minimization, gradient descent, and supervised learning paradigms.',
      createdAt: '2026-09-10T10:00:00Z',
      size: '1.4 MB',
      status: 'Indexed',
      conceptsExtracted: 18
    },
    {
      id: 'src-lecture-04',
      name: 'Representation Learning & Deep Architectures',
      type: 'pdf',
      fileName: 'Lecture 04.pdf',
      text: 'A representation learning approach based on multiple layers of neural networks and non-linear feature maps.',
      createdAt: '2026-09-18T14:30:00Z',
      size: '840 KB',
      status: 'Indexed',
      conceptsExtracted: 24
    },
    {
      id: 'src-mit-6s191',
      name: 'MIT 6.S191: Introduction to Deep Learning',
      type: 'pdf',
      fileName: 'MIT 6.S191 Notes.pdf',
      text: 'Interconnected nodes computing weighted activations, backpropagation, and perceptron loss functions.',
      createdAt: '2026-09-20T09:15:00Z',
      size: '1.1 MB',
      status: 'Indexed',
      conceptsExtracted: 32
    },
    {
      id: 'src-stanford-cs231n',
      name: 'Stanford CS231n: Deep Learning for Computer Vision',
      type: 'pdf',
      fileName: 'Stanford CS231n.pdf',
      text: 'Convolutional spatial pattern extraction for visual grids, kernels, pooling, and image feature analysis.',
      createdAt: '2026-09-22T16:00:00Z',
      size: '2.1 MB',
      status: 'Indexed',
      conceptsExtracted: 29
    },
    {
      id: 'src-stanford-cs224n',
      name: 'Stanford CS224n: Natural Language Processing with Deep Learning',
      type: 'pdf',
      fileName: 'Stanford CS224n.pdf',
      text: 'Sequential modeling maintaining hidden states across time, recurrence equations, and sequence tagging.',
      createdAt: '2026-09-24T11:45:00Z',
      size: '1.8 MB',
      status: 'Indexed',
      conceptsExtracted: 22
    },
    {
      id: 'src-bahdanau-2014',
      name: 'Neural Machine Translation by Jointly Learning to Align and Translate',
      type: 'pdf',
      fileName: 'Bahdanau et al. (2014)',
      text: 'Dynamic token weighting across long-range context, soft alignment vectors, and encoder-decoder mechanisms.',
      createdAt: '2026-09-25T15:20:00Z',
      size: '480 KB',
      status: 'Indexed',
      conceptsExtracted: 14
    },
    {
      id: 'src-arxiv-attention',
      name: 'Attention Is All You Need (Vaswani et al.)',
      type: 'pdf',
      fileName: 'Attention Is All You Need.pdf',
      text: 'Attention-based parallel sequence architecture dispensing with recurrence and convolutions.',
      createdAt: '2026-09-28T08:00:00Z',
      size: '520 KB',
      status: 'Indexed',
      conceptsExtracted: 26
    },
    {
      id: 'src-cs231n-slides',
      name: 'Stanford CS231n Visual Recognition Course Slides',
      type: 'pdf',
      fileName: 'CS231n Slides.pdf',
      text: 'Visual understanding and automated image feature analysis, object detection, and spatial convolutions.',
      createdAt: '2026-09-28T18:00:00Z',
      size: '3.4 MB',
      status: 'Indexed',
      conceptsExtracted: 19
    },
    {
      id: 'src-jurafsky-martin',
      name: 'Speech and Language Processing (3rd ed.)',
      type: 'pdf',
      fileName: 'Jurafsky & Martin (Ch. 3)',
      text: 'Computational parsing, semantic extraction, and text generation using statistical and neural representations.',
      createdAt: '2026-09-29T12:00:00Z',
      size: '3.2 MB',
      status: 'Indexed',
      conceptsExtracted: 41
    }
  ],
  nodes: [
    {
      id: 'ml',
      name: 'Machine Learning',
      type: 'foundation',
      description: 'Learning algorithms from data without explicit programmed rules.',
      sourceIds: ['src-stanford-cs229'],
      position: { x: 80, y: 320 },
      code: 'ML-01',
      confidence: 99,
      prerequisites: ['Linear Algebra', 'Probability & Statistics']
    },
    {
      id: 'nn',
      name: 'Neural Networks',
      type: 'architecture',
      description: 'Interconnected nodes computing weighted activations.',
      sourceIds: ['src-mit-6s191'],
      position: { x: 440, y: 110 },
      code: 'NN-03',
      confidence: 96,
      prerequisites: ['Deep Learning', 'Matrix Operations']
    },
    {
      id: 'dl',
      name: 'Deep Learning',
      type: 'paradigm',
      description: 'A representation learning approach based on multiple layers of neural networks.',
      sourceIds: ['src-lecture-04'],
      position: { x: 500, y: 360 },
      code: 'DL-02',
      confidence: 97,
      prerequisites: ['Machine Learning', 'Gradient Descent']
    },
    {
      id: 'cnn',
      name: 'CNN',
      type: 'architecture',
      description: 'Convolutional spatial pattern extraction for visual grids.',
      sourceIds: ['src-stanford-cs231n'],
      position: { x: 860, y: 70 },
      code: 'CNN-04',
      confidence: 95,
      prerequisites: ['Neural Networks', 'Convolutions']
    },
    {
      id: 'rnn',
      name: 'RNN',
      type: 'architecture',
      description: 'Sequential modeling maintaining hidden states across time.',
      sourceIds: ['src-stanford-cs224n'],
      position: { x: 840, y: 250 },
      code: 'RNN-05',
      confidence: 91,
      prerequisites: ['Neural Networks', 'Sequence Modeling']
    },
    {
      id: 'attn',
      name: 'Attention Mechanism',
      type: 'method',
      description: 'Dynamic token weighting across long-range context.',
      sourceIds: ['src-bahdanau-2014'],
      position: { x: 380, y: 600 },
      code: 'ATTN-06',
      confidence: 96,
      prerequisites: ['Deep Learning', 'Vector Dot Products']
    },
    {
      id: 'tf',
      name: 'Transformers',
      type: 'architecture',
      description: 'Attention-based parallel sequence architecture.',
      sourceIds: ['src-arxiv-attention'],
      position: { x: 760, y: 520 },
      code: 'TF-07',
      confidence: 94,
      prerequisites: ['Neural Networks', 'Attention Mechanism']
    },
    {
      id: 'cv',
      name: 'Computer Vision',
      type: 'application',
      description: 'Visual understanding and automated image feature analysis.',
      sourceIds: ['src-cs231n-slides'],
      position: { x: 1220, y: 140 },
      code: 'CV-08',
      confidence: 98,
      prerequisites: ['CNN', 'Spatial Features']
    },
    {
      id: 'nlp',
      name: 'Natural Language Processing',
      type: 'application',
      description: 'Computational parsing, semantic extraction, and text generation.',
      sourceIds: ['src-jurafsky-martin'],
      position: { x: 1160, y: 400 },
      code: 'NLP-09',
      confidence: 97,
      prerequisites: ['Transformers', 'Tokenization']
    }
  ],
  relationships: [
    {
      id: 'rel-ml-dl',
      source: 'ml',
      target: 'dl',
      type: 'extends',
      label: 'extends',
      description: 'Deep learning extends machine learning into layered representations.',
      sourceChunkIds: ['chunk-01']
    },
    {
      id: 'rel-dl-nn',
      source: 'dl',
      target: 'nn',
      type: 'foundation-for',
      label: 'foundation of',
      description: 'Neural networks serve as the fundamental structural unit of deep learning.',
      sourceChunkIds: ['chunk-02']
    },
    {
      id: 'rel-dl-tf',
      source: 'dl',
      target: 'tf',
      type: 'uses',
      label: 'used in',
      description: 'Transformers utilize deep learning representation architectures.',
      sourceChunkIds: ['chunk-02']
    },
    {
      id: 'rel-nn-cnn',
      source: 'nn',
      target: 'cnn',
      type: 'part-of',
      label: 'contains',
      description: 'CNNs are specialized convolutional subsets of neural networks.',
      sourceChunkIds: ['chunk-03']
    },
    {
      id: 'rel-nn-rnn',
      source: 'nn',
      target: 'rnn',
      type: 'part-of',
      label: 'contains',
      description: 'RNNs are recurrent sequential architectural subsets of neural networks.',
      sourceChunkIds: ['chunk-03']
    },
    {
      id: 'rel-nn-attn',
      source: 'nn',
      target: 'attn',
      type: 'uses',
      label: 'integrates',
      description: 'Neural networks integrate dynamic token attention mechanisms.',
      sourceChunkIds: ['chunk-04']
    },
    {
      id: 'rel-attn-tf',
      source: 'attn',
      target: 'tf',
      type: 'foundation-for',
      label: 'core of',
      description: 'The attention mechanism is the core foundational primitive of transformers.',
      sourceChunkIds: ['chunk-04']
    },
    {
      id: 'rel-cnn-cv',
      source: 'cnn',
      target: 'cv',
      type: 'applied-to',
      label: 'powers',
      description: 'Convolutional neural networks are applied to computer vision tasks.',
      sourceChunkIds: ['chunk-05']
    },
    {
      id: 'rel-tf-nlp',
      source: 'tf',
      target: 'nlp',
      type: 'applied-to',
      label: 'powers',
      description: 'Transformers power state-of-the-art natural language processing applications.',
      sourceChunkIds: ['chunk-06']
    },
    {
      id: 'rel-rnn-nlp',
      source: 'rnn',
      target: 'nlp',
      type: 'applied-to',
      label: 'used in',
      description: 'Recurrent neural networks are used in sequential natural language processing.',
      sourceChunkIds: ['chunk-06']
    }
  ]
};

/**
 * Helper to convert lowercase semantic type into display ConceptCategory
 */
function normalizeCategory(type: string): ConceptCategory {
  const norm = type.toLowerCase();
  switch (norm) {
    case 'foundation': return 'Foundation';
    case 'paradigm': return 'Paradigm';
    case 'architecture': return 'Architecture';
    case 'method': return 'Method';
    case 'application': return 'Application';
    default: return 'Foundation';
  }
}

/**
 * Adapter: Converts canonical KnowledgeGraph into ReactFlow elements
 * and rich Concept Details map for inspector/search components.
 */
export function knowledgeGraphToReactFlow(graph: KnowledgeGraph): {
  nodes: Node<GraphConceptData>[];
  edges: Edge[];
  conceptDetails: Record<string, GraphConceptData>;
} {
  const nodeMap = new Map<string, KnowledgeNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  const sourceMap = new Map<string, KnowledgeSource>();
  for (const s of graph.sources) {
    sourceMap.set(s.id, s);
  }

  // Build relationship adjacency for every node
  const nodeRelMap = new Map<string, ConceptRelationship[]>();
  for (const n of graph.nodes) {
    nodeRelMap.set(n.id, []);
  }

  for (const rel of graph.relationships) {
    const srcNode = nodeMap.get(rel.source);
    const tgtNode = nodeMap.get(rel.target);
    const relLabel = rel.label || rel.type;

    const sourceNames: string[] = (rel.sourceIds || [])
      .map(id => sourceMap.get(id)?.fileName || sourceMap.get(id)?.name)
      .filter((name): name is string => Boolean(name));

    if (srcNode && tgtNode) {
      // Outgoing from source to target
      nodeRelMap.get(rel.source)?.push({
        id: rel.id,
        type: relLabel,
        targetId: rel.target,
        targetName: tgtNode.name,
        direction: 'outgoing',
        description: rel.description,
        sourceChunkIds: rel.sourceChunkIds,
        sourceNames
      });

      // Incoming into target from source
      nodeRelMap.get(rel.target)?.push({
        id: rel.id,
        type: relLabel,
        targetId: rel.source,
        targetName: srcNode.name,
        direction: 'incoming',
        description: rel.description,
        sourceChunkIds: rel.sourceChunkIds,
        sourceNames
      });
    }
  }

  // 1. Build Concept Details
  const conceptDetails: Record<string, GraphConceptData> = {};

  for (const n of graph.nodes) {
    const sourceRefs: ConceptSourceReference[] = [];
    for (const id of n.sourceIds || []) {
      const s = sourceMap.get(id);
      if (s) {
        sourceRefs.push({
          id: s.id,
          name: s.fileName || s.name,
          chunkIds: n.sourceChunkIds
        });
      }
    }

    const primarySource = sourceRefs[0]?.name || (n.sourceIds[0] ? sourceMap.get(n.sourceIds[0])?.name : undefined);
    const sourceDisplay = primarySource || 'Indexed Material';
    const category = normalizeCategory(n.type);
    const relationships = nodeRelMap.get(n.id) || [];

    conceptDetails[n.id] = {
      id: n.id,
      label: n.name,
      code: n.code || n.id.toUpperCase(),
      category,
      description: n.description,
      prerequisites: n.prerequisites || [],
      relationships,
      confidence: n.confidence || 95,
      source: sourceDisplay,
      sources: sourceRefs,
      sourceChunkIds: n.sourceChunkIds,
      synapseCount: relationships.length,
      isPrerequisite: category === 'Foundation' || category === 'Paradigm',
      isMethod: category === 'Method' || category === 'Architecture',
      isApplication: category === 'Application'
    };
  }

  // 2. Build ReactFlow Nodes (Visualization Layer assigns layout when semantic node has no hardcoded coordinates)
  const nodes: Node<GraphConceptData>[] = graph.nodes.map((n, index) => {
    let position = n.position;
    if (!position) {
      const angle = (2 * Math.PI * index) / Math.max(1, graph.nodes.length);
      const radius = 280 + (index % 3) * 70;
      position = {
        x: Math.round(450 + radius * Math.cos(angle)),
        y: Math.round(320 + radius * Math.sin(angle))
      };
    }

    return {
      id: n.id,
      type: 'conceptNode',
      position,
      data: conceptDetails[n.id]
    };
  });

  // 3. Build ReactFlow Edges
  const edges: Edge[] = graph.relationships.map(rel => {
    // Preserve progressive crafting edge ID conventions ('e-src-tgt')
    const edgeId = rel.id.startsWith('rel-') 
      ? rel.id.replace('rel-', 'e-') 
      : (rel.id.startsWith('e-') ? rel.id : `e-${rel.source}-${rel.target}`);
    const label = rel.label || rel.type;

    const sourceNames: string[] = (rel.sourceIds || [])
      .map(id => sourceMap.get(id)?.fileName || sourceMap.get(id)?.name)
      .filter((name): name is string => Boolean(name));

    return {
      id: edgeId,
      source: rel.source,
      target: rel.target,
      type: 'custom',
      label,
      data: { 
        id: rel.id,
        relation: label,
        description: rel.description,
        sourceIds: rel.sourceIds,
        sourceChunkIds: rel.sourceChunkIds,
        sourceNames
      }
    };
  });

  return { nodes, edges, conceptDetails };
}

// Derived visual representations from canonical model
const derivedElements = knowledgeGraphToReactFlow(defaultKnowledgeGraph);

export const initialNodes: Node<GraphConceptData>[] = derivedElements.nodes;
export const initialEdges: Edge[] = derivedElements.edges;
export const initialConceptDetails: Record<string, GraphConceptData> = derivedElements.conceptDetails;
