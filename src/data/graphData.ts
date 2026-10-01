import type { GraphConceptData } from '../types/graph';
import type { Node, Edge } from '@xyflow/react';

export const initialConceptDetails: Record<string, GraphConceptData> = {
  'ml': {
    id: 'ml',
    label: 'Machine Learning',
    code: 'ML-01',
    category: 'Foundation',
    description: 'Algorithms that learn patterns from data rather than following explicit programmed rules.',
    prerequisites: ['Linear Algebra', 'Probability & Statistics'],
    relationships: [
      { type: 'generalizes', targetId: 'dl', targetName: 'Deep Learning', direction: 'outgoing' }
    ],
    confidence: 99,
    source: 'Stanford CS229.pdf',
    synapseCount: 1,
    isPrerequisite: true
  },
  'dl': {
    id: 'dl',
    label: 'Deep Learning',
    code: 'DL-02',
    category: 'Paradigm',
    description: 'Learns hierarchical representations through multiple neural network layers.',
    prerequisites: ['Machine Learning', 'Gradient Descent'],
    relationships: [
      { type: 'generalizes', targetId: 'ml', targetName: 'Machine Learning', direction: 'incoming' },
      { type: 'foundation of', targetId: 'nn', targetName: 'Neural Networks', direction: 'outgoing' },
      { type: 'uses', targetId: 'tf', targetName: 'Transformers', direction: 'outgoing' }
    ],
    confidence: 97,
    source: 'Lecture 04.pdf',
    synapseCount: 3,
    isPrerequisite: true
  },
  'nn': {
    id: 'nn',
    label: 'Neural Networks',
    code: 'NN-03',
    category: 'Architecture',
    description: 'Interconnected nodes that compute weighted sums with non-linear activation functions.',
    prerequisites: ['Deep Learning', 'Matrix Operations'],
    relationships: [
      { type: 'foundation of', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'is a type of', targetId: 'cnn', targetName: 'CNN', direction: 'outgoing' },
      { type: 'is a type of', targetId: 'rnn', targetName: 'RNN', direction: 'outgoing' },
      { type: 'integrates', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'outgoing' }
    ],
    confidence: 96,
    source: 'MIT 6.S191 Notes.pdf',
    synapseCount: 4,
    isPrerequisite: true
  },
  'cnn': {
    id: 'cnn',
    label: 'CNN',
    code: 'CNN-04',
    category: 'Architecture',
    description: 'Grid-focused architecture using convolutional kernels for spatial pattern extraction.',
    prerequisites: ['Neural Networks', 'Convolutions'],
    relationships: [
      { type: 'is a type of', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'powers', targetId: 'cv', targetName: 'Computer Vision', direction: 'outgoing' }
    ],
    confidence: 95,
    source: 'Stanford CS231n.pdf',
    synapseCount: 2,
    isMethod: true
  },
  'rnn': {
    id: 'rnn',
    label: 'RNN',
    code: 'RNN-05',
    category: 'Architecture',
    description: 'Sequential model maintaining hidden state across time steps for temporal data.',
    prerequisites: ['Neural Networks', 'Sequence Modeling'],
    relationships: [
      { type: 'is a type of', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'used in', targetId: 'nlp', targetName: 'Natural Language Processing', direction: 'outgoing' }
    ],
    confidence: 91,
    source: 'Stanford CS224n.pdf',
    synapseCount: 2,
    isMethod: true
  },
  'attn': {
    id: 'attn',
    label: 'Attention Mechanism',
    code: 'ATTN-06',
    category: 'Method',
    description: 'Dynamically weights input tokens to model long-range context without bottlenecks.',
    prerequisites: ['Deep Learning', 'Vector Dot Products'],
    relationships: [
      { type: 'integrates', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
      { type: 'core of', targetId: 'tf', targetName: 'Transformers', direction: 'outgoing' }
    ],
    confidence: 96,
    source: 'Bahdanau et al. (2014)',
    synapseCount: 2,
    isMethod: true
  },
  'tf': {
    id: 'tf',
    label: 'Transformers',
    code: 'TF-07',
    category: 'Architecture',
    description: 'Parallel attention-driven architecture removing sequential recurrence bottlenecks.',
    prerequisites: ['Neural Networks', 'Attention Mechanism'],
    relationships: [
      { type: 'core of', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'incoming' },
      { type: 'uses', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'powers', targetId: 'nlp', targetName: 'Natural Language Processing', direction: 'outgoing' }
    ],
    confidence: 94,
    source: 'Vaswani et al. (2017)',
    synapseCount: 3,
    isMethod: true
  },
  'cv': {
    id: 'cv',
    label: 'Computer Vision',
    code: 'CV-08',
    category: 'Application',
    description: 'Automated analysis and visual feature extraction from digital images and video.',
    prerequisites: ['CNN', 'Spatial Features'],
    relationships: [
      { type: 'powers', targetId: 'cnn', targetName: 'CNN', direction: 'incoming' }
    ],
    confidence: 98,
    source: 'CS231n Slides.pdf',
    synapseCount: 1,
    isApplication: true
  },
  'nlp': {
    id: 'nlp',
    label: 'Natural Language Processing',
    code: 'NLP-09',
    category: 'Application',
    description: 'Techniques for parsing, understanding, and generating human language.',
    prerequisites: ['Transformers', 'Tokenization'],
    relationships: [
      { type: 'powers', targetId: 'tf', targetName: 'Transformers', direction: 'incoming' },
      { type: 'used in', targetId: 'rnn', targetName: 'RNN', direction: 'incoming' }
    ],
    confidence: 97,
    source: 'Jurafsky & Martin (Ch. 3)',
    synapseCount: 2,
    isApplication: true
  }
};

// Initial Flow Nodes with generous, human-designed freeform coordinates
export const initialNodes: Node<GraphConceptData>[] = [
  {
    id: 'ml',
    type: 'conceptNode',
    position: { x: 50, y: 260 },
    data: initialConceptDetails['ml']
  },
  {
    id: 'dl',
    type: 'conceptNode',
    position: { x: 370, y: 260 },
    data: initialConceptDetails['dl']
  },
  {
    id: 'nn',
    type: 'conceptNode',
    position: { x: 690, y: 120 },
    data: initialConceptDetails['nn']
  },
  {
    id: 'attn',
    type: 'conceptNode',
    position: { x: 690, y: 430 },
    data: initialConceptDetails['attn']
  },
  {
    id: 'cnn',
    type: 'conceptNode',
    position: { x: 1010, y: 40 },
    data: initialConceptDetails['cnn']
  },
  {
    id: 'rnn',
    type: 'conceptNode',
    position: { x: 1010, y: 210 },
    data: initialConceptDetails['rnn']
  },
  {
    id: 'tf',
    type: 'conceptNode',
    position: { x: 1010, y: 430 },
    data: initialConceptDetails['tf']
  },
  {
    id: 'cv',
    type: 'conceptNode',
    position: { x: 1330, y: 40 },
    data: initialConceptDetails['cv']
  },
  {
    id: 'nlp',
    type: 'conceptNode',
    position: { x: 1330, y: 310 },
    data: initialConceptDetails['nlp']
  }
];

// Semantic directed relationships with natural human labels
export const initialEdges: Edge[] = [
  {
    id: 'e-ml-dl',
    source: 'ml',
    target: 'dl',
    type: 'custom',
    label: 'generalizes',
    data: { relation: 'generalizes' }
  },
  {
    id: 'e-dl-nn',
    source: 'dl',
    target: 'nn',
    type: 'custom',
    label: 'foundation of',
    data: { relation: 'foundation of' }
  },
  {
    id: 'e-dl-tf',
    source: 'dl',
    target: 'tf',
    type: 'custom',
    label: 'uses',
    data: { relation: 'uses' }
  },
  {
    id: 'e-nn-cnn',
    source: 'nn',
    target: 'cnn',
    type: 'custom',
    label: 'is a type of',
    data: { relation: 'is a type of' }
  },
  {
    id: 'e-nn-rnn',
    source: 'nn',
    target: 'rnn',
    type: 'custom',
    label: 'is a type of',
    data: { relation: 'is a type of' }
  },
  {
    id: 'e-nn-attn',
    source: 'nn',
    target: 'attn',
    type: 'custom',
    label: 'integrates',
    data: { relation: 'integrates' }
  },
  {
    id: 'e-attn-tf',
    source: 'attn',
    target: 'tf',
    type: 'custom',
    label: 'core of',
    data: { relation: 'core of' }
  },
  {
    id: 'e-cnn-cv',
    source: 'cnn',
    target: 'cv',
    type: 'custom',
    label: 'powers',
    data: { relation: 'powers' }
  },
  {
    id: 'e-tf-nlp',
    source: 'tf',
    target: 'nlp',
    type: 'custom',
    label: 'powers',
    data: { relation: 'powers' }
  },
  {
    id: 'e-rnn-nlp',
    source: 'rnn',
    target: 'nlp',
    type: 'custom',
    label: 'used in',
    data: { relation: 'used in' }
  }
];
