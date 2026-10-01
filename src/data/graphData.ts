import type { GraphConceptData } from '../types/graph';
import type { Node, Edge } from '@xyflow/react';

export const initialConceptDetails: Record<string, GraphConceptData> = {
  'ml': {
    id: 'ml',
    label: 'Machine Learning',
    code: 'ML-01',
    category: 'Foundation',
    description: 'Learning algorithms from data without explicit programmed rules.',
    prerequisites: ['Linear Algebra', 'Probability & Statistics'],
    relationships: [
      { type: 'extends', targetId: 'dl', targetName: 'Deep Learning', direction: 'outgoing' }
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
    description: 'A representation learning approach based on multiple layers of neural networks.',
    prerequisites: ['Machine Learning', 'Gradient Descent'],
    relationships: [
      { type: 'extends', targetId: 'ml', targetName: 'Machine Learning', direction: 'incoming' },
      { type: 'foundation of', targetId: 'nn', targetName: 'Neural Networks', direction: 'outgoing' },
      { type: 'used in', targetId: 'tf', targetName: 'Transformers', direction: 'outgoing' }
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
    description: 'Interconnected nodes computing weighted activations.',
    prerequisites: ['Deep Learning', 'Matrix Operations'],
    relationships: [
      { type: 'foundation of', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'contains', targetId: 'cnn', targetName: 'CNN', direction: 'outgoing' },
      { type: 'contains', targetId: 'rnn', targetName: 'RNN', direction: 'outgoing' },
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
    description: 'Convolutional spatial pattern extraction for visual grids.',
    prerequisites: ['Neural Networks', 'Convolutions'],
    relationships: [
      { type: 'contains', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
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
    description: 'Sequential modeling maintaining hidden states across time.',
    prerequisites: ['Neural Networks', 'Sequence Modeling'],
    relationships: [
      { type: 'contains', targetId: 'nn', targetName: 'Neural Networks', direction: 'incoming' },
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
    description: 'Dynamic token weighting across long-range context.',
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
    description: 'Attention-based parallel sequence architecture.',
    prerequisites: ['Neural Networks', 'Attention Mechanism'],
    relationships: [
      { type: 'core of', targetId: 'attn', targetName: 'Attention Mechanism', direction: 'incoming' },
      { type: 'used in', targetId: 'dl', targetName: 'Deep Learning', direction: 'incoming' },
      { type: 'powers', targetId: 'nlp', targetName: 'Natural Language Processing', direction: 'outgoing' }
    ],
    confidence: 94,
    source: 'Attention Is All You Need.pdf',
    synapseCount: 3,
    isMethod: true
  },
  'cv': {
    id: 'cv',
    label: 'Computer Vision',
    code: 'CV-08',
    category: 'Application',
    description: 'Visual understanding and automated image feature analysis.',
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
    description: 'Computational parsing, semantic extraction, and text generation.',
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

// Organic freeform spatial layout with generous breathing room (Prompt 3 - Section 7)
// Non-grid, discovered topology avoiding rigid columns
export const initialNodes: Node<GraphConceptData>[] = [
  {
    id: 'ml',
    type: 'conceptNode',
    position: { x: 80, y: 320 },
    data: initialConceptDetails['ml']
  },
  {
    id: 'nn',
    type: 'conceptNode',
    position: { x: 440, y: 110 },
    data: initialConceptDetails['nn']
  },
  {
    id: 'dl',
    type: 'conceptNode',
    position: { x: 500, y: 360 },
    data: initialConceptDetails['dl']
  },
  {
    id: 'cnn',
    type: 'conceptNode',
    position: { x: 860, y: 70 },
    data: initialConceptDetails['cnn']
  },
  {
    id: 'rnn',
    type: 'conceptNode',
    position: { x: 840, y: 250 },
    data: initialConceptDetails['rnn']
  },
  {
    id: 'attn',
    type: 'conceptNode',
    position: { x: 380, y: 600 },
    data: initialConceptDetails['attn']
  },
  {
    id: 'tf',
    type: 'conceptNode',
    position: { x: 760, y: 520 },
    data: initialConceptDetails['tf']
  },
  {
    id: 'cv',
    type: 'conceptNode',
    position: { x: 1220, y: 140 },
    data: initialConceptDetails['cv']
  },
  {
    id: 'nlp',
    type: 'conceptNode',
    position: { x: 1160, y: 400 },
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
    label: 'extends',
    data: { relation: 'extends' }
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
    label: 'used in',
    data: { relation: 'used in' }
  },
  {
    id: 'e-nn-cnn',
    source: 'nn',
    target: 'cnn',
    type: 'custom',
    label: 'contains',
    data: { relation: 'contains' }
  },
  {
    id: 'e-nn-rnn',
    source: 'nn',
    target: 'rnn',
    type: 'custom',
    label: 'contains',
    data: { relation: 'contains' }
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
