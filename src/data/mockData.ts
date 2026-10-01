import type { ConceptNode, MetricItem, ProjectWorkspace, RecentMaterial } from '../types';

export const mockProjectWorkspace: ProjectWorkspace = {
  id: 'proj_01',
  name: 'Neural & Cognitive Architectures',
  code: 'GM-NEURO-88',
  domain: 'Advanced AI Systems • Spring 2026',
  activeNodes: 418,
  density: '3.06 links / concept',
  lastUpdated: 'Just now'
};

export const mockMetrics: MetricItem[] = [
  {
    id: 'm1',
    label: 'Documents',
    value: '24',
    numericalValue: 24,
    unit: 'documents',
    delta: '+6 this week',
    deltaDirection: 'up',
    subtitle: 'Indexed sources'
  },
  {
    id: 'm2',
    label: 'Concepts',
    value: '418',
    numericalValue: 418,
    unit: 'concepts',
    delta: '+92 recent',
    deltaDirection: 'up',
    subtitle: 'Extracted concepts'
  },
  {
    id: 'm3',
    label: 'Relationships',
    value: '1,280',
    numericalValue: 1280,
    unit: 'relationships',
    delta: '3.06 links / concept',
    deltaDirection: 'up',
    subtitle: 'Mapped links'
  },
  {
    id: 'm4',
    label: 'Learning paths',
    value: '6',
    numericalValue: 6,
    unit: 'paths',
    delta: '2 in progress',
    deltaDirection: 'stable',
    subtitle: 'Curated curricula'
  }
];

export const mockConnectedConcepts: ConceptNode[] = [
  {
    id: 'c1',
    name: 'Machine Learning',
    code: 'ML-01',
    category: 'Foundation',
    depth: 1,
    synapseCount: 14,
    summary: 'The meta-algorithmic discipline of systems improving automatically through statistical experience and pattern recognition.',
    x: 20,
    y: 35,
    size: 28,
    accentColor: '#38bdf8', // crisp cyan
    status: 'synapsed',
    documentsSourceCount: 18,
    connections: [
      { targetId: 'c2', targetName: 'Neural Networks', relationType: 'generalizes', strength: 0.95 },
      { targetId: 'c5', targetName: 'Computer Vision', relationType: 'utilizes', strength: 0.82 }
    ]
  },
  {
    id: 'c2',
    name: 'Neural Networks',
    code: 'NN-02',
    category: 'Architecture',
    depth: 2,
    synapseCount: 11,
    summary: 'Layered computational graphs modeled after biological synapses, performing parameterized non-linear transformations.',
    x: 42,
    y: 22,
    size: 26,
    accentColor: '#818cf8', // sleek indigo
    status: 'synapsed',
    documentsSourceCount: 14,
    connections: [
      { targetId: 'c1', targetName: 'Machine Learning', relationType: 'generalizes', strength: 0.95 },
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'hierarchical', strength: 0.98 }
    ]
  },
  {
    id: 'c3',
    name: 'Deep Learning',
    code: 'DL-03',
    category: 'Paradigm',
    depth: 3,
    synapseCount: 16,
    summary: 'Multi-tiered hierarchical representation learning capable of extracting latent feature manifolds without manual engineering.',
    x: 55,
    y: 60,
    size: 30,
    accentColor: '#00f2fe', // neon cyan
    status: 'active',
    documentsSourceCount: 22,
    connections: [
      { targetId: 'c2', targetName: 'Neural Networks', relationType: 'hierarchical', strength: 0.98 },
      { targetId: 'c4', targetName: 'Transformers', relationType: 'powers', strength: 0.94 },
      { targetId: 'c5', targetName: 'Computer Vision', relationType: 'powers', strength: 0.89 }
    ]
  },
  {
    id: 'c4',
    name: 'Transformers',
    code: 'TF-04',
    category: 'Architecture',
    depth: 4,
    synapseCount: 19,
    summary: 'Self-attention based network structures processing entire context windows in parallel without recurrence limitations.',
    x: 80,
    y: 32,
    size: 27,
    accentColor: '#34d399', // emerald
    status: 'synapsed',
    documentsSourceCount: 16,
    connections: [
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'powers', strength: 0.94 },
      { targetId: 'c5', targetName: 'Computer Vision', relationType: 'synthesizes', strength: 0.78 }
    ]
  },
  {
    id: 'c5',
    name: 'Computer Vision',
    code: 'CV-05',
    category: 'Application',
    depth: 3,
    synapseCount: 13,
    summary: 'High-dimensional perceptual intelligence processing spatial convolutions, image segmentations, and visual understanding.',
    x: 75,
    y: 78,
    size: 25,
    accentColor: '#fbbf24', // amber
    status: 'referenced',
    documentsSourceCount: 11,
    connections: [
      { targetId: 'c1', targetName: 'Machine Learning', relationType: 'utilizes', strength: 0.82 },
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'powers', strength: 0.89 },
      { targetId: 'c4', targetName: 'Transformers', relationType: 'synthesizes', strength: 0.78 }
    ]
  }
];

export const mockRecentMaterials: RecentMaterial[] = [
  {
    id: 'rm-1',
    title: 'Attention Is All You Need (Vaswani et al.)',
    format: 'PDF',
    size: '1.4 MB',
    conceptsExtracted: 42,
    timestamp: '2h ago',
    status: 'synced'
  },
  {
    id: 'rm-2',
    title: 'Stanford CS231n: ConvNet Architectures',
    format: 'TRANSCRIPT',
    size: '840 KB',
    conceptsExtracted: 38,
    timestamp: '5h ago',
    status: 'synced'
  },
  {
    id: 'rm-3',
    title: 'Deep Residual Learning for Image Rec (He et al.)',
    format: 'ARXIV',
    size: '2.1 MB',
    conceptsExtracted: 29,
    timestamp: '1d ago',
    status: 'synced'
  },
  {
    id: 'rm-4',
    title: 'Self-Supervised Learning & ViT Foundations',
    format: 'NOTE',
    size: '120 KB',
    conceptsExtracted: 18,
    timestamp: '2d ago',
    status: 'synced'
  }
];

export const mockLearningPaths = [
  {
    id: 'lp-1',
    title: 'Attention Mechanisms to Foundation Models',
    progress: 68,
    nodeCount: 18,
    estimatedHours: '4.5 hrs',
    status: 'In progress'
  },
  {
    id: 'lp-2',
    title: 'Visual Representation: ConvNets to ViT',
    progress: 35,
    nodeCount: 14,
    estimatedHours: '3.0 hrs',
    status: 'In progress'
  },
  {
    id: 'lp-3',
    title: 'Loss Landscapes & Optimization Dynamics',
    progress: 0,
    nodeCount: 12,
    estimatedHours: '2.5 hrs',
    status: 'Planned'
  }
];
