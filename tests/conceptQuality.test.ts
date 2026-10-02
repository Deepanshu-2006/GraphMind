import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  isGenericConceptPhrase,
  analyzeCandidateOccurrences,
  scoreCandidate,
  evaluateAndFilterCandidates,
  getAdaptiveMaxConcepts
} from '../src/services/conceptRelevance';

import {
  DEFAULT_CONCEPT_QUALITY_CONFIG,
  type ConceptQualityConfig
} from '../src/config/conceptQuality';

import {
  normalizeConcepts,
  generateCanonicalKey,
  toCanonicalDisplayName
} from '../src/services/conceptNormalization';

import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';
import type { ConceptCandidate, TextChunk, KnowledgeSource } from '../src/types/knowledgeGraph';

describe('Concept Relevance & Quality Filtering', () => {

  describe('1. Generic Term Identification (Linguistic & Lexical Filtering)', () => {
    const genericTermsToReject = [
      'system',
      'data',
      'method',
      'important',
      'example',
      'process',
      'use',
      'information',
      'systems',
      'methods',
      'useful',
      'good',
      'different',
      'analysis',
      'approach',
      'technique',
      'figure',
      'table',
      'chapter',
      'section'
    ];

    for (const term of genericTermsToReject) {
      test(`rejects standalone generic term: "${term}"`, () => {
        const result = isGenericConceptPhrase(term);
        assert.equal(
          result.isGeneric,
          true,
          `Expected "${term}" to be flagged as generic, but got reason: ${result.reason}`
        );
      });
    }

    const allGenericCompoundPhrases = [
      'important method',
      'system data',
      'example process',
      'general information',
      'new approach',
      'useful technique',
      'main result'
    ];

    for (const phrase of allGenericCompoundPhrases) {
      test(`rejects all-generic compound phrase: "${phrase}"`, () => {
        const result = isGenericConceptPhrase(phrase);
        assert.equal(
          result.isGeneric,
          true,
          `Expected "${phrase}" to be flagged as generic compound, but got reason: ${result.reason}`
        );
      });
    }

    const domainConceptsToPreserve = [
      'Operating System',
      'Virtual Memory',
      'Machine Learning',
      'Convolutional Neural Network',
      'Distributed Systems',
      'Relational Database',
      'CPU Scheduling',
      'Memory Management Unit',
      'Inter-Process Communication',
      'Transformer Architecture',
      'Backpropagation',
      'Gradient Descent'
    ];

    for (const concept of domainConceptsToPreserve) {
      test(`preserves domain qualified concept: "${concept}"`, () => {
        const result = isGenericConceptPhrase(concept);
        assert.equal(
          result.isGeneric,
          false,
          `Expected "${concept}" NOT to be flagged as generic, but got reason: ${result.reason}`
        );
      });
    }

    const domainAcronyms = ['CPU', 'MMU', 'IPC', 'OS', 'CNN', 'RNN', 'LLM', 'API', 'SQL', 'RAM', 'GPU'];
    for (const acronym of domainAcronyms) {
      test(`preserves technical domain acronym: "${acronym}"`, () => {
        const result = isGenericConceptPhrase(acronym);
        assert.equal(
          result.isGeneric,
          false,
          `Expected acronym "${acronym}" NOT to be flagged as generic, but got reason: ${result.reason}`
        );
      });
    }
  });

  describe('2. Candidate Occurrence & Contextual Analysis', () => {
    const mockChunks: TextChunk[] = [
      {
        chunkId: 'chunk-1',
        sourceId: 'src-1',
        index: 0,
        text: 'Operating Systems manage computer hardware and software resources. Virtual Memory is an essential memory management technique. Data can be stored in RAM.',
        heading: 'Introduction to Operating Systems'
      },
      {
        chunkId: 'chunk-2',
        sourceId: 'src-1',
        index: 1,
        text: 'The Memory Management Unit translates virtual addresses into physical addresses. Virtual Memory enables process isolation. Important methods are used here.',
        heading: 'Virtual Memory & Address Translation'
      }
    ];

    test('correctly analyzes frequency, dispersion, and heading presence', () => {
      const vmAnalysis = analyzeCandidateOccurrences('Virtual Memory', mockChunks);
      assert.equal(vmAnalysis.frequency, 2);
      assert.equal(vmAnalysis.chunkIds.length, 2);
      assert.ok(vmAnalysis.headings.length > 0, 'Virtual Memory should be detected in heading');
      assert.equal(vmAnalysis.hasDefinitionEvidence, true, 'Virtual Memory is defined with "is an essential..."');
      assert.ok(vmAnalysis.contextSentences.length >= 2, 'Should capture contextual sentences');
    });

    test('flags sentence-initial only capitalized generic words', () => {
      const dataAnalysis = analyzeCandidateOccurrences('Data', mockChunks);
      assert.equal(dataAnalysis.frequency, 1);
      assert.equal(dataAnalysis.onlySentenceInitial, true, '"Data" only appears at the start of sentence');
    });
  });

  describe('3. Relevance Scoring System', () => {
    const mockChunks: TextChunk[] = [
      {
        chunkId: 'chunk-1',
        sourceId: 'src-1',
        index: 0,
        text: 'An Operating System provides an abstract interface to hardware. The CPU executes instructions. Data is processed continuously.',
        heading: 'Operating System Fundamentals'
      },
      {
        chunkId: 'chunk-2',
        sourceId: 'src-1',
        index: 1,
        text: 'Processes communicate using Inter-Process Communication (IPC). The CPU interacts with the Memory Management Unit. The system uses methods to schedule tasks.',
        heading: 'Process Management and IPC'
      }
    ];

    test('scores technical domain concepts above acceptance threshold', () => {
      const candidate: ConceptCandidate = {
        name: 'Operating System',
        type: 'foundation',
        sourceId: 'src-1',
        sourceChunkId: 'chunk-1'
      };

      const scored = scoreCandidate(candidate, mockChunks, 80, DEFAULT_CONCEPT_QUALITY_CONFIG);
      assert.equal(scored.isAccepted, true, `Expected Operating System to be accepted (score: ${scored.relevanceScore})`);
      assert.ok(scored.relevanceScore >= DEFAULT_CONCEPT_QUALITY_CONFIG.minRelevanceScore);
      assert.equal(scored.isGeneric, false);
      assert.equal(scored.isTechnicalOrTopic, true);
    });

    test('scores and discards generic standalone words even if mentioned in text', () => {
      const genericCandidate: ConceptCandidate = {
        name: 'system',
        type: 'concept',
        sourceId: 'src-1',
        sourceChunkId: 'chunk-2'
      };

      const scored = scoreCandidate(genericCandidate, mockChunks, 80, DEFAULT_CONCEPT_QUALITY_CONFIG);
      assert.equal(scored.isAccepted, false, `Expected generic "system" to be rejected (score: ${scored.relevanceScore})`);
      assert.equal(scored.isGeneric, true);
      assert.ok(scored.rejectionReason?.includes('Generic standalone noun'));
    });

    test('discards single mentions with no contextual evidence', () => {
      const weakCandidate: ConceptCandidate = {
        name: 'important',
        type: 'concept',
        sourceId: 'src-1',
        sourceChunkId: 'chunk-1'
      };

      const scored = scoreCandidate(weakCandidate, mockChunks, 80, DEFAULT_CONCEPT_QUALITY_CONFIG);
      assert.equal(scored.isAccepted, false, 'Expected "important" to be rejected');
    });
  });

  describe('4. Batch Evaluation, Filtering, and Internal Debug Report', () => {
    const mockChunks: TextChunk[] = [
      {
        chunkId: 'chunk-1',
        sourceId: 'src-1',
        index: 0,
        text: 'Convolutional Neural Networks are deep neural network architectures used in computer vision. Backpropagation computes gradients efficiently. Data is passed through layers. The method is important.',
        heading: 'Convolutional Neural Networks Overview'
      },
      {
        chunkId: 'chunk-2',
        sourceId: 'src-1',
        index: 1,
        text: 'A Convolutional Neural Network consists of convolutional layers, pooling layers, and fully connected layers. Gradient Descent updates weights. Process details are given in the example.',
        heading: 'CNN Architecture Components'
      }
    ];

    const rawCandidates: ConceptCandidate[] = [
      { name: 'Convolutional Neural Networks', type: 'architecture', sourceId: 'src-1', sourceChunkId: 'chunk-1' },
      { name: 'Backpropagation', type: 'algorithm', sourceId: 'src-1', sourceChunkId: 'chunk-1' },
      { name: 'Gradient Descent', type: 'algorithm', sourceId: 'src-1', sourceChunkId: 'chunk-2' },
      { name: 'data', type: 'concept', sourceId: 'src-1', sourceChunkId: 'chunk-1' },
      { name: 'method', type: 'concept', sourceId: 'src-1', sourceChunkId: 'chunk-1' },
      { name: 'important', type: 'concept', sourceId: 'src-1', sourceChunkId: 'chunk-1' },
      { name: 'process', type: 'concept', sourceId: 'src-1', sourceChunkId: 'chunk-2' },
      { name: 'example', type: 'concept', sourceId: 'src-1', sourceChunkId: 'chunk-2' }
    ];

    test('filters out all generic keywords while preserving domain concepts', () => {
      const { acceptedCandidates, report } = evaluateAndFilterCandidates(rawCandidates, mockChunks);

      const acceptedNames = acceptedCandidates.map(c => c.name.toLowerCase());
      assert.ok(acceptedNames.some(n => n.includes('convolutional neural network')));
      assert.ok(acceptedNames.includes('backpropagation'));
      assert.ok(acceptedNames.includes('gradient descent'));

      // Verify generic words are rejected
      assert.ok(!acceptedNames.includes('data'));
      assert.ok(!acceptedNames.includes('method'));
      assert.ok(!acceptedNames.includes('important'));
      assert.ok(!acceptedNames.includes('process'));
      assert.ok(!acceptedNames.includes('example'));

      // Verify debug report structure
      assert.equal(report.totalCandidates, 8);
      assert.equal(report.acceptedCount, 3);
      assert.equal(report.rejectedCount, 5);
      assert.equal(report.rejected.length, 5);

      const dataRejection = report.rejected.find(r => r.name.toLowerCase() === 'data');
      assert.ok(dataRejection, 'Debug report should contain rejection entry for "data"');
      assert.ok(dataRejection.reason.length > 0, 'Rejection should provide clear reason');
    });

    test('preserves source traceability on accepted candidates', () => {
      const { acceptedCandidates } = evaluateAndFilterCandidates(rawCandidates, mockChunks);
      const cnn = acceptedCandidates.find(c => c.name.toLowerCase().includes('convolutional'));
      assert.ok(cnn);
      assert.ok(cnn.sourceChunkIds && cnn.sourceChunkIds.length > 0, 'Must have sourceChunkIds');
      assert.ok(cnn.frequency && cnn.frequency >= 1, 'Must have frequency');
      assert.ok(cnn.contextualSentences && cnn.contextualSentences.length > 0, 'Must have contextualSentences');
      assert.ok(cnn.relevanceScore && cnn.relevanceScore > 0.5, 'Must have relevanceScore');
    });
  });

  describe('5. Normalization After Filtering & Non-Collapse Rules', () => {
    test('merges case and hyphenation variants of the same concept', () => {
      const variants: ConceptCandidate[] = [
        { name: 'machine learning', type: 'concept', sourceId: 'src-1', sourceChunkId: 'c1' },
        { name: 'Machine Learning', type: 'concept', sourceId: 'src-1', sourceChunkId: 'c2' },
        { name: 'machine-learning', type: 'concept', sourceId: 'src-1', sourceChunkId: 'c3' }
      ];

      const canonical = normalizeConcepts(variants);
      assert.equal(canonical.length, 1, 'Should consolidate all 3 variants into 1 concept');
      assert.equal(canonical[0].name, 'Machine Learning');
      assert.equal(canonical[0].occurrences, 3);
      assert.equal(canonical[0].sourceChunkIds?.length, 3);
    });

    test('does NOT collapse "learning" and "machine learning" into the same concept', () => {
      const candidates: ConceptCandidate[] = [
        { name: 'Machine Learning', type: 'concept', sourceId: 'src-1', sourceChunkId: 'c1' },
        { name: 'Learning', type: 'concept', sourceId: 'src-1', sourceChunkId: 'c2' }
      ];

      const canonical = normalizeConcepts(candidates);
      assert.equal(canonical.length, 2, 'Should keep "Machine Learning" and "Learning" separate');
      const names = canonical.map(c => c.name);
      assert.ok(names.includes('Machine Learning'));
      assert.ok(names.includes('Learning'));
    });

    test('does NOT strip domain compound "System Architecture" into bare generic "System"', () => {
      const displayName = toCanonicalDisplayName('System Architecture');
      assert.equal(displayName, 'System Architecture');

      const canonicalKey = generateCanonicalKey('System Architecture');
      assert.equal(canonicalKey, 'system architecture');
    });
  });

  describe('6. Adaptive Concept Limits', () => {
    const config = DEFAULT_CONCEPT_QUALITY_CONFIG;

    test('computes appropriate max concepts according to document size', () => {
      const small = getAdaptiveMaxConcepts(2, 800, config);
      assert.equal(small, config.adaptiveLimits.smallDocument.maxConcepts);

      const medium = getAdaptiveMaxConcepts(8, 4000, config);
      assert.equal(medium, config.adaptiveLimits.mediumDocument.maxConcepts);

      const large = getAdaptiveMaxConcepts(25, 20000, config);
      assert.equal(large, config.adaptiveLimits.largeDocument.maxConcepts);
    });

    test('respects configurable max concepts override', () => {
      const customConfig: ConceptQualityConfig = {
        ...config,
        maxConceptsOverride: 10
      };
      const result = getAdaptiveMaxConcepts(50, 50000, customConfig);
      assert.equal(result, 10);
    });
  });

  describe('7. End-to-End Pipeline with Realistic Educational Material', () => {
    const lectureNoteText = `
# Operating Systems: Virtual Memory and Process Scheduling

An Operating System (OS) is software that manages computer hardware and system resources.
The Operating System provides services such as Process Scheduling, Memory Management, and File System access.

## Process Scheduling
Process Scheduling is an essential mechanism used by the Operating System to allocate the Central Processing Unit (CPU) to active processes.
Common algorithms include Round Robin, Shortest Job First, and Priority Scheduling.
Each process maintains a Process Control Block (PCB).
Inter-Process Communication (IPC) enables cooperative processes to exchange data and synchronization signals.

## Virtual Memory
Virtual Memory is a memory management technique that creates an illusion of a large contiguous address space.
The Memory Management Unit (MMU) translates virtual addresses to physical RAM addresses.
Paging divides memory into fixed-size pages and page frames.
When a requested page is not in physical memory, a Page Fault exception occurs.
The Translation Lookaside Buffer (TLB) is a hardware cache that accelerates address translation.

## Notes and Considerations
This data is very important for system performance.
Users use various methods to analyze information.
The example shows how processes run in a real system.
`;

    test('processes educational notes, filtering generic words and producing a connected knowledge graph', async () => {
      const source: KnowledgeSource = {
        id: 'source-os-lecture',
        name: 'OS Lecture Notes',
        fileName: 'os_lecture.txt',
        fileType: 'text/plain',
        size: lectureNoteText.length,
        uploadedAt: Date.now(),
        status: 'ready',
        text: lectureNoteText
      };

      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.execute([source]);

      assert.equal(result.success, true, `Pipeline execution failed: ${result.error?.message}`);
      assert.ok(result.graph, 'Knowledge graph must be present');
      assert.ok(result.metrics, 'Metrics must be present');
      assert.ok(result.relevanceReport, 'Internal relevance debug report must be present');

      const graph = result.graph!;
      const nodeNames = graph.nodes.map(n => n.name.toLowerCase());

      // 1. Verify generic words are NOT present as nodes
      const genericWords = ['system', 'data', 'method', 'important', 'example', 'process', 'use', 'information'];
      for (const generic of genericWords) {
        assert.ok(
          !nodeNames.includes(generic),
          `Generic word "${generic}" should NOT become a graph node!`
        );
      }

      // 2. Verify legitimate domain concepts ARE present as nodes
      assert.ok(nodeNames.some(n => n.includes('virtual memory')), 'Virtual Memory should be a node');
      assert.ok(nodeNames.some(n => n.includes('operating system')), 'Operating System should be a node');
      assert.ok(nodeNames.some(n => n.includes('process scheduling')), 'Process Scheduling should be a node');

      // 3. Verify relationships were constructed between valid nodes
      assert.ok(graph.relationships.length > 0, 'Should extract relationships between concepts');
      const validNodeIds = new Set(graph.nodes.map(n => n.id));
      for (const rel of graph.relationships) {
        assert.ok(validNodeIds.has(rel.source), `Relationship source ${rel.source} must exist in nodes`);
        assert.ok(validNodeIds.has(rel.target), `Relationship target ${rel.target} must exist in nodes`);
      }

      // 4. Verify source traceability
      for (const node of graph.nodes) {
        assert.ok(node.sourceIds.length > 0, `Node "${node.name}" must have sourceIds`);
        assert.ok(node.sourceChunkIds && node.sourceChunkIds.length > 0, `Node "${node.name}" must have sourceChunkIds`);
      }

      // 5. Verify debug report contains rejected candidates with clear reasons
      assert.ok(result.relevanceReport!.rejectedCount > 0, 'Should report rejected candidates');
      const rejectedGeneric = result.relevanceReport!.rejected.find(r => r.name.toLowerCase() === 'system');
      if (rejectedGeneric) {
        assert.equal(rejectedGeneric.isGeneric, true);
      }
    });
  });
});
