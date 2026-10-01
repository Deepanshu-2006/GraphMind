import type { GraphConceptData } from '../types/graph';
import type { Node, Edge } from '@xyflow/react';

export const initialConceptDetails: Record<string, GraphConceptData> = {
  'ml': {
    id: 'ml',
    label: 'Machine Learning',
    code: 'ML-01',
    category: 'Foundation',
    description: 'The mathematical and algorithmic discipline where computational systems acquire inductive inferences from statistical data rather than explicit programming.',
    prerequisites: ['Linear Algebra', 'Multivariate Calculus', 'Probability & Statistics'],
    relationships: [
      { type: 'SUBFIELD_OF', targetId: 'dl', targetName: 'Deep Learning', direction: 'outgoing' }
    ],
    confidence: 99,
    source: 'Stanford CS229: Machine Learning Course Reader (p. 4–12)',
    synapseCount: 1,
    isPrerequisite: true
  },
  'dl': {
    id: 'dl',
    label: 'Deep Learning',
    code: 'DL-02',
    category: 'Paradigm',
    description: 'Hierarchical representation learning utilizing stacked non-linear processing layers to extract latent feature manifolds directly from raw inputs.',
    prerequisites: ['Machine Learning', 'Gradient Descent Optimization'],
    relationships: [
      { type: 'BASED_ON', targetId: 'ml', targetName: 'Machine Learning', direction: 'incoming' },
      { type: 'SPECIALIZES', targetId: 'nn', targetName: 'Neural Networks', direction: 'outgoing' },
      { type: 'EXTENDS', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'outgoing' }
    ],
    confidence: 97,
    source: 'Goodfellow et al. — Deep Learning Textbook (MIT Press, Ch. 1)',
    synapseCount: 3,
    isPrerequisite: true
  },
  'nn': {
    id: 'nn',
    label: 'Neural Networks',
    code: 'NN-03',
    category: 'Architecture',
    description: 'Computational networks of interconnected artificial neurons computing weighted sums followed by non-linear activation functions, parameterized via backpropagation.',
    prerequisites: ['Deep Learning', 'Matrix Calculus'],
    relationships: [
      { type: 'BASED_ON', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'SPECIALIZES', targetId: 'cnn', targetName: 'CNN', direction: 'outgoing' },
      { type: 'SPECIALIZES', targetId: 'rnn', targetName: 'RNN', direction: 'outgoing' },
      { type: 'INTEGRATES', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'outgoing' }
    ],
    confidence: 96,
    source: 'Lecture Notes — Neural Foundations & Backprop (MIT 6.S191)',
    synapseCount: 4,
    isPrerequisite: true
  },
  'cnn': {
    id: 'cnn',
    label: 'CNN',
    code: 'CNN-04',
    category: 'Architecture',
    description: 'Convolutional Neural Networks leveraging spatial weight-sharing kernels and pooling operations for translation-invariant grid topology perception.',
    prerequisites: ['Neural Networks', 'Discrete Convolutions'],
    relationships: [
      { type: 'SPECIALIZES', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'USED_FOR', targetId: 'cv', targetName: 'Computer Vision', direction: 'outgoing' }
    ],
    confidence: 95,
    source: 'Stanford CS231n: Convolutional Neural Networks for Visual Recognition',
    synapseCount: 2,
    isMethod: true
  },
  'rnn': {
    id: 'rnn',
    label: 'RNN',
    code: 'RNN-05',
    category: 'Architecture',
    description: 'Recurrent Neural Networks maintaining an internal hidden state memory across sequential time-steps for temporal and sequence modeling.',
    prerequisites: ['Neural Networks', 'Sequential Data Structures'],
    relationships: [
      { type: 'SPECIALIZES', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'USED_FOR', targetId: 'nlp', targetName: 'Natural Language Processing', direction: 'outgoing' }
    ],
    confidence: 91,
    source: 'Stanford CS224n: Natural Language Processing with Deep Learning',
    synapseCount: 2,
    isMethod: true
  },
  'attn': {
    id: 'attn',
    label: 'Attention Mechanism',
    code: 'ATTN-06',
    category: 'Method',
    description: 'Dynamic query-key-value weighting mechanism computing contextual cross-correlations without bottleneck compression across receptive fields.',
    prerequisites: ['Deep Learning', 'Dot-Product Scaling'],
    relationships: [
      { type: 'EXTENDS', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'INTEGRATES', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'BASED_ON', targetId: 'tf', targetName: 'Transformers', direction: 'outgoing' }
    ],
    confidence: 96,
    source: 'Bahdanau et al. & Vaswani et al. — Neural Machine Translation Papers',
    synapseCount: 3,
    isMethod: true
  },
  'tf': {
    id: 'tf',
    label: 'Transformers',
    code: 'TF-07',
    category: 'Architecture',
    description: 'A neural architecture based on attention mechanisms for modeling relationships between sequence elements in parallel without recurrence limitations.',
    prerequisites: ['Neural Networks', 'Attention Mechanism'],
    relationships: [
      { type: 'BASED_ON', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'incoming' },
      { type: 'USED_FOR', targetId: 'nlp', targetName: 'Natural Language Processing', direction: 'outgoing' }
    ],
    confidence: 94,
    source: 'Lecture Notes — Deep Learning.pdf (Vaswani et al. 2017)',
    synapseCount: 2,
    isMethod: true
  },
  'cv': {
    id: 'cv',
    label: 'Computer Vision',
    code: 'CV-08',
    category: 'Application',
    description: 'Automated extraction of high-level semantic abstractions from digital images, video streams, and volumetric sensory telemetry.',
    prerequisites: ['CNN', 'Spatial Manifolds', 'Image Processing'],
    relationships: [
      { type: 'USED_FOR', targetId: 'cnn', targetName: 'CNN', direction: 'incoming' }
    ],
    confidence: 98,
    source: 'Szeliski — Computer Vision: Algorithms and Applications',
    synapseCount: 1,
    isApplication: true
  },
  'nlp': {
    id: 'nlp',
    label: 'Natural Language Processing',
    code: 'NLP-09',
    category: 'Application',
    description: 'Computational linguistics enabling software to parse syntax, extract latent intent, perform semantic translation, and generate coherent human discourse.',
    prerequisites: ['Transformers', 'Tokenization', 'Latent Semantics'],
    relationships: [
      { type: 'USED_FOR', targetId: 'tf', targetName: 'Transformers', direction: 'incoming' },
      { type: 'USED_FOR', targetId: 'rnn', targetName: 'RNN', direction: 'incoming' }
    ],
    confidence: 97,
    source: 'Jurafsky & Martin — Speech and Language Processing (3rd ed.)',
    synapseCount: 2,
    isApplication: true
  }
};

// Initial Flow Nodes with bespoke hierarchical layout coordinates
export const initialNodes: Node<GraphConceptData>[] = [
  {
    id: 'ml',
    type: 'conceptNode',
    position: { x: 50, y: 240 },
    data: initialConceptDetails['ml']
  },
  {
    id: 'dl',
    type: 'conceptNode',
    position: { x: 320, y: 240 },
    data: initialConceptDetails['dl']
  },
  {
    id: 'nn',
    type: 'conceptNode',
    position: { x: 590, y: 130 },
    data: initialConceptDetails['nn']
  },
  {
    id: 'attn',
    type: 'conceptNode',
    position: { x: 590, y: 360 },
    data: initialConceptDetails['attn']
  },
  {
    id: 'cnn',
    type: 'conceptNode',
    position: { x: 870, y: 50 },
    data: initialConceptDetails['cnn']
  },
  {
    id: 'rnn',
    type: 'conceptNode',
    position: { x: 870, y: 200 },
    data: initialConceptDetails['rnn']
  },
  {
    id: 'tf',
    type: 'conceptNode',
    position: { x: 870, y: 360 },
    data: initialConceptDetails['tf']
  },
  {
    id: 'cv',
    type: 'conceptNode',
    position: { x: 1160, y: 50 },
    data: initialConceptDetails['cv']
  },
  {
    id: 'nlp',
    type: 'conceptNode',
    position: { x: 1160, y: 280 },
    data: initialConceptDetails['nlp']
  }
];

// Meaningful directed edges with relationship labels
export const initialEdges: Edge[] = [
  {
    id: 'e-ml-dl',
    source: 'ml',
    target: 'dl',
    type: 'custom',
    label: 'FOUNDATION_FOR',
    animated: true,
    data: { relation: 'FOUNDATION_FOR' }
  },
  {
    id: 'e-dl-nn',
    source: 'dl',
    target: 'nn',
    type: 'custom',
    label: 'UTILIZES_CORE',
    animated: true,
    data: { relation: 'UTILIZES_CORE' }
  },
  {
    id: 'e-dl-attn',
    source: 'dl',
    target: 'attn',
    type: 'custom',
    label: 'EXTENDS',
    animated: false,
    data: { relation: 'EXTENDS' }
  },
  {
    id: 'e-nn-cnn',
    source: 'nn',
    target: 'cnn',
    type: 'custom',
    label: 'SPECIALIZES',
    animated: true,
    data: { relation: 'SPECIALIZES' }
  },
  {
    id: 'e-nn-rnn',
    source: 'nn',
    target: 'rnn',
    type: 'custom',
    label: 'SPECIALIZES',
    animated: true,
    data: { relation: 'SPECIALIZES' }
  },
  {
    id: 'e-nn-attn',
    source: 'nn',
    target: 'attn',
    type: 'custom',
    label: 'INTEGRATES',
    animated: false,
    data: { relation: 'INTEGRATES' }
  },
  {
    id: 'e-attn-tf',
    source: 'attn',
    target: 'tf',
    type: 'custom',
    label: 'BASED_ON',
    animated: true,
    data: { relation: 'BASED_ON' }
  },
  {
    id: 'e-cnn-cv',
    source: 'cnn',
    target: 'cv',
    type: 'custom',
    label: 'USED_FOR',
    animated: true,
    data: { relation: 'USED_FOR' }
  },
  {
    id: 'e-tf-nlp',
    source: 'tf',
    target: 'nlp',
    type: 'custom',
    label: 'USED_FOR',
    animated: true,
    data: { relation: 'USED_FOR' }
  },
  {
    id: 'e-rnn-nlp',
    source: 'rnn',
    target: 'nlp',
    type: 'custom',
    label: 'USED_FOR',
    animated: false,
    data: { relation: 'USED_FOR' }
  }
];
