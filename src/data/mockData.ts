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
    summary: 'A field focused on learning patterns and relationships directly from data.',
    x: 18,
    y: 50,
    size: 26,
    accentColor: '#38bdf8',
    status: 'synapsed',
    documentsSourceCount: 18,
    connections: [
      { targetId: 'c6', targetName: 'Supervised Learning', relationType: 'generalizes', strength: 0.95 },
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'generalizes', strength: 0.96 },
      { targetId: 'c5', targetName: 'Computer Vision', relationType: 'utilizes', strength: 0.82 }
    ]
  },
  {
    id: 'c6',
    name: 'Supervised Learning',
    code: 'SL-06',
    category: 'Paradigm',
    depth: 2,
    synapseCount: 9,
    summary: 'Learning predictive mapping functions from labeled training data.',
    x: 44,
    y: 22,
    size: 22,
    accentColor: '#10b981',
    status: 'synapsed',
    documentsSourceCount: 12,
    connections: [
      { targetId: 'c1', targetName: 'Machine Learning', relationType: 'generalizes', strength: 0.95 }
    ]
  },
  {
    id: 'c3',
    name: 'Deep Learning',
    code: 'DL-03',
    category: 'Paradigm',
    depth: 2,
    synapseCount: 16,
    summary: 'Learning with multiple neural network layers to extract latent representations.',
    x: 48,
    y: 65,
    size: 28,
    accentColor: '#00f2fe',
    status: 'active',
    documentsSourceCount: 22,
    connections: [
      { targetId: 'c1', targetName: 'Machine Learning', relationType: 'generalizes', strength: 0.96 },
      { targetId: 'c2', targetName: 'Neural Networks', relationType: 'hierarchical', strength: 0.98 },
      { targetId: 'c4', targetName: 'Transformers', relationType: 'powers', strength: 0.94 },
      { targetId: 'c5', targetName: 'Computer Vision', relationType: 'powers', strength: 0.89 }
    ]
  },
  {
    id: 'c2',
    name: 'Neural Networks',
    code: 'NN-02',
    category: 'Architecture',
    depth: 3,
    synapseCount: 11,
    summary: 'Layered models used to learn representations through non-linear transformations.',
    x: 74,
    y: 38,
    size: 24,
    accentColor: '#818cf8',
    status: 'synapsed',
    documentsSourceCount: 14,
    connections: [
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'hierarchical', strength: 0.98 },
      { targetId: 'c4', targetName: 'Transformers', relationType: 'powers', strength: 0.92 }
    ]
  },
  {
    id: 'c4',
    name: 'Transformers',
    code: 'TF-04',
    category: 'Architecture',
    depth: 4,
    synapseCount: 19,
    summary: 'Self-attention based network structures processing parallel contextual sequences.',
    x: 92,
    y: 24,
    size: 23,
    accentColor: '#34d399',
    status: 'synapsed',
    documentsSourceCount: 16,
    connections: [
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'powers', strength: 0.94 },
      { targetId: 'c2', targetName: 'Neural Networks', relationType: 'powers', strength: 0.92 }
    ]
  },
  {
    id: 'c5',
    name: 'Computer Vision',
    code: 'CV-05',
    category: 'Application',
    depth: 3,
    synapseCount: 13,
    summary: 'Perceptual intelligence processing spatial structures and visual understanding.',
    x: 78,
    y: 80,
    size: 23,
    accentColor: '#fbbf24',
    status: 'referenced',
    documentsSourceCount: 11,
    connections: [
      { targetId: 'c1', targetName: 'Machine Learning', relationType: 'utilizes', strength: 0.82 },
      { targetId: 'c3', targetName: 'Deep Learning', relationType: 'powers', strength: 0.89 }
    ]
  }
];

export const mockRecentMaterials: RecentMaterial[] = [
  {
    id: 'rm-1',
    title: 'Attention Is All You Need',
    format: 'PDF',
    size: '1.4 MB',
    conceptsExtracted: 42,
    timestamp: 'Added 2 hours ago',
    status: 'Indexed'
  },
  {
    id: 'rm-2',
    title: 'Stanford CS231n: ConvNet Architectures for Visual Recognition',
    format: 'TRANSCRIPT',
    size: '840 KB',
    conceptsExtracted: 38,
    timestamp: 'Added 5 hours ago',
    status: 'Indexed'
  },
  {
    id: 'rm-3',
    title: 'Deep Residual Learning for Image Recognition (He et al.)',
    format: 'PDF',
    size: '2.1 MB',
    conceptsExtracted: 29,
    timestamp: 'Added 1 day ago',
    status: 'Indexed'
  },
  {
    id: 'rm-4',
    title: 'Self-Supervised Learning & Vision Transformer Notes',
    format: 'NOTE',
    size: '120 KB',
    conceptsExtracted: 18,
    timestamp: 'Added 2 days ago',
    status: 'Indexed'
  },
  {
    id: 'rm-5',
    title: 'LLM Reasoning via Chain-of-Thought Prompting.pdf',
    format: 'PDF',
    size: '620 KB',
    timestamp: 'Added 10 minutes ago',
    status: 'Processing'
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
