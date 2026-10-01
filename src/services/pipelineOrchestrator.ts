import type { 
  KnowledgeSource, 
  KnowledgeGraph, 
  TextChunk, 
  ConceptCandidate, 
  CanonicalConcept, 
  KnowledgeRelationship 
} from '../types/knowledgeGraph';
import { createSourcesFromFiles } from './sourceIngestion';
import { extractText } from './textExtraction';
import { extractConceptsFromChunks, type ConceptExtractionOptions } from './conceptExtraction';
import { normalizeConcepts } from './conceptNormalization';
import { extractRelationshipsFromChunks, type RelationshipExtractionOptions } from './relationshipExtraction';
import { buildKnowledgeGraph, type GraphBuilderOptions } from './graphBuilder';

/**
 * =========================================================================
 * PIPELINE ORCHESTRATOR (Day 2, Step 9 - Prompt 21)
 * 
 * Coherent end-to-end pipeline:
 * UPLOAD
 *  ↓
 * SOURCE
 *  ↓
 * TEXT EXTRACTION
 *  ↓
 * TEXT CLEANING
 *  ↓
 * CHUNKING
 *  ↓
 * CONCEPT EXTRACTION
 *  ↓
 * CONCEPT NORMALIZATION
 *  ↓
 * RELATIONSHIP EXTRACTION
 *  ↓
 * GRAPH CONSTRUCTION
 *  ↓
 * KNOWLEDGE GRAPH
 *  ↓
 * VISUALIZATION
 * =========================================================================
 */

export type PipelineStage = 
  | 'reading'
  | 'extracting-concepts'
  | 'normalizing'
  | 'mapping-relationships'
  | 'building-graph'
  | 'complete'
  | 'error';

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  'reading': 'Reading your material…',
  'extracting-concepts': 'Finding concepts…',
  'normalizing': 'Connecting ideas…',
  'mapping-relationships': 'Connecting ideas…',
  'building-graph': 'Crafting your knowledge graph…',
  'complete': 'Graph ready.',
  'error': 'Failed to process learning material.'
};

export interface PipelineProgressEvent {
  stage: PipelineStage;
  message: string;
  sourceCount?: number;
  currentSourceName?: string;
  conceptsExtracted?: number;
  relationshipsMapped?: number;
  timestamp: number;
  intermediateCanonicalConcepts?: CanonicalConcept[];
  newlyAddedConceptIds?: string[];
  intermediateRelationships?: KnowledgeRelationship[];
  partialGraph?: KnowledgeGraph;
}

export type PipelineErrorCode = 
  | 'EMPTY_INPUT'
  | 'UNSUPPORTED_FORMAT'
  | 'TEXT_EXTRACTION_FAILED'
  | 'NO_CONCEPTS_FOUND'
  | 'NO_CANONICAL_ENTITIES'
  | 'GRAPH_BUILD_FAILED'
  | 'INTERNAL_ERROR';

export interface PipelineError {
  stage: PipelineStage;
  code: PipelineErrorCode;
  message: string;
  sourceName?: string;
  details?: string;
}

export interface PipelineMetrics {
  durationMs: number;
  sourcesProcessed: number;
  chunksCount: number;
  rawConceptsCount: number;
  canonicalConceptsCount: number;
  relationshipsCount: number;
  nodesCount: number;
}

export interface PipelineResult {
  success: boolean;
  stage: PipelineStage;
  graph?: KnowledgeGraph;
  sources?: KnowledgeSource[];
  error?: PipelineError;
  metrics?: PipelineMetrics;
}

export interface PipelineOrchestratorOptions {
  onProgress?: (event: PipelineProgressEvent) => void;
  conceptExtraction?: ConceptExtractionOptions;
  relationshipExtraction?: RelationshipExtractionOptions;
  graphBuilder?: GraphBuilderOptions;
  existingSources?: KnowledgeSource[];
}

export type PipelineOptions = PipelineOrchestratorOptions;

export class PipelineOrchestrator {
  /**
   * Executes the complete processing pipeline starting from raw Files or existing KnowledgeSources.
   */
  async execute(
    input: File[] | KnowledgeSource[],
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const { onProgress } = options;

    const notify = (stage: PipelineStage, message: string, extra: Partial<PipelineProgressEvent> = {}) => {
      if (onProgress) {
        onProgress({
          stage,
          message,
          timestamp: Date.now(),
          ...extra
        });
      }
    };

    try {
      // -----------------------------------------------------------------------
      // STAGE 0: UPLOAD & SOURCE CREATION
      // -----------------------------------------------------------------------
      if (!input || input.length === 0) {
        const error: PipelineError = {
          stage: 'error',
          code: 'EMPTY_INPUT',
          message: 'Please provide at least one learning document (PDF, TXT, or Markdown).'
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      let validSources: KnowledgeSource[] = [];

      // Check if input is File[]
      if (input[0] instanceof File) {
        const fileBatch = input as File[];
        const batchResult = await createSourcesFromFiles(fileBatch, options.existingSources || []);

        if (batchResult.successful.length === 0 && batchResult.errors.length > 0) {
          const firstErr = batchResult.errors[0];
          const error: PipelineError = {
            stage: 'error',
            code: 'UNSUPPORTED_FORMAT',
            message: firstErr.error || 'Failed to accept uploaded document.',
            sourceName: firstErr.fileName
          };
          notify('error', error.message);
          return { success: false, stage: 'error', error };
        }

        validSources = batchResult.successful;
      } else {
        // Input is already KnowledgeSource[]
        validSources = input as KnowledgeSource[];
      }

      if (validSources.length === 0) {
        const error: PipelineError = {
          stage: 'error',
          code: 'EMPTY_INPUT',
          message: 'No valid learning sources were available to process.'
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      // Deduplicate sources by ID to avoid processing the same source multiple times
      const sourceMap = new Map<string, KnowledgeSource>();
      for (const s of validSources) {
        if (s && s.id && !sourceMap.has(s.id)) {
          sourceMap.set(s.id, s);
        }
      }
      const uniqueSources = Array.from(sourceMap.values());

      // -----------------------------------------------------------------------
      // STAGE 1 & 2: TEXT EXTRACTION, CLEANING & CHUNKING ('reading')
      // -----------------------------------------------------------------------
      notify('reading', PIPELINE_STAGE_LABELS['reading'], {
        sourceCount: uniqueSources.length,
        currentSourceName: uniqueSources[0]?.fileName || uniqueSources[0]?.name
      });

      const allChunks: TextChunk[] = [];
      const successfullyExtractedSources: KnowledgeSource[] = [];
      const extractionFailures: { name: string; error: string }[] = [];

      for (const source of uniqueSources) {
        try {
          const textResult = await extractText(source);
          if (!textResult.success || !textResult.chunks || textResult.chunks.length === 0) {
            extractionFailures.push({
              name: source.fileName || source.name,
              error: textResult.error || 'Could not extract readable text.'
            });
            continue;
          }

          // Cache extracted text onto the source
          source.text = textResult.cleanText;
          source.status = 'ready';
          successfullyExtractedSources.push(source);
          allChunks.push(...textResult.chunks);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Text extraction failed.';
          extractionFailures.push({
            name: source.fileName || source.name,
            error: message
          });
        }
      }

      if (allChunks.length === 0) {
        const failedName = extractionFailures[0]?.name;
        const error: PipelineError = {
          stage: 'reading',
          code: 'TEXT_EXTRACTION_FAILED',
          message: extractionFailures[0]?.error || 
            `Unable to extract readable text from ${failedName || 'the uploaded material'}. Please ensure the file contains selectable text.`,
          sourceName: failedName
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      // -----------------------------------------------------------------------
      // STAGE 3: CONCEPT EXTRACTION ('extracting-concepts')
      // -----------------------------------------------------------------------
      notify('extracting-concepts', PIPELINE_STAGE_LABELS['extracting-concepts'], {
        sourceCount: successfullyExtractedSources.length
      });

      let rawCandidates: ConceptCandidate[] = [];
      try {
        const seenKeys = new Set<string>();
        // Process chunks with incremental live candidate emission
        for (let i = 0; i < allChunks.length; i++) {
          const chunk = allChunks[i];
          const chunkCandidates = await extractConceptsFromChunks([chunk], options.conceptExtraction);
          const newlyAdded: ConceptCandidate[] = [];

          for (const cand of chunkCandidates) {
            const key = cand.name.toLowerCase().trim();
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              rawCandidates.push(cand);
              newlyAdded.push(cand);
            }
          }

          if (newlyAdded.length > 0) {
            // Progressive batching so user visually watches concepts emerge
            const batchSize = typeof window !== 'undefined' ? 2 : newlyAdded.length;
            for (let b = 0; b < newlyAdded.length; b += batchSize) {
              const currentSlice = newlyAdded.slice(b, b + batchSize);
              const sliceLast = currentSlice[currentSlice.length - 1];
              const runningCandidates = rawCandidates.slice(
                0,
                rawCandidates.indexOf(sliceLast) + 1
              );
              const intermediateCanonical = normalizeConcepts(runningCandidates);

              notify('extracting-concepts', PIPELINE_STAGE_LABELS['extracting-concepts'], {
                conceptsExtracted: intermediateCanonical.length,
                intermediateCanonicalConcepts: intermediateCanonical,
                newlyAddedConceptIds: currentSlice.map((c) => c.name)
              });

              if (typeof window !== 'undefined') {
                await new Promise((res) => setTimeout(res, 280));
              }
            }
          }
        }
      } catch {
        rawCandidates = [];
      }

      if (rawCandidates.length === 0) {
        const error: PipelineError = {
          stage: 'extracting-concepts',
          code: 'NO_CONCEPTS_FOUND',
          message: 'No meaningful technical concepts could be identified from your learning material.'
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      // -----------------------------------------------------------------------
      // STAGE 4: CONCEPT NORMALIZATION ('normalizing')
      // -----------------------------------------------------------------------
      const canonicalConcepts: CanonicalConcept[] = normalizeConcepts(rawCandidates);

      notify('normalizing', PIPELINE_STAGE_LABELS['normalizing'], {
        conceptsExtracted: canonicalConcepts.length,
        intermediateCanonicalConcepts: canonicalConcepts
      });
      if (typeof window !== 'undefined') {
        await new Promise((res) => setTimeout(res, 300));
      }

      if (canonicalConcepts.length === 0) {
        const error: PipelineError = {
          stage: 'normalizing',
          code: 'NO_CANONICAL_ENTITIES',
          message: 'Could not consolidate extracted concepts into canonical entities.'
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      // -----------------------------------------------------------------------
      // STAGE 5: RELATIONSHIP EXTRACTION ('mapping-relationships')
      // -----------------------------------------------------------------------
      notify('mapping-relationships', PIPELINE_STAGE_LABELS['mapping-relationships'], {
        conceptsExtracted: canonicalConcepts.length
      });

      let relationships: KnowledgeRelationship[] = [];
      try {
        relationships = await extractRelationshipsFromChunks(
          canonicalConcepts,
          allChunks,
          options.relationshipExtraction
        );

        if (relationships.length > 0) {
          const relBatchSize = typeof window !== 'undefined' ? 2 : relationships.length;
          for (let r = 0; r < relationships.length; r += relBatchSize) {
            const currentRels = relationships.slice(0, r + relBatchSize);
            notify('mapping-relationships', PIPELINE_STAGE_LABELS['mapping-relationships'], {
              conceptsExtracted: canonicalConcepts.length,
              relationshipsMapped: currentRels.length,
              intermediateCanonicalConcepts: canonicalConcepts,
              intermediateRelationships: currentRels
            });
            if (typeof window !== 'undefined') {
              await new Promise((res) => setTimeout(res, 300));
            }
          }
        }
      } catch {
        // Continue even if relationship extraction yields 0 connections
        relationships = [];
      }

      // -----------------------------------------------------------------------
      // STAGE 6: GRAPH CONSTRUCTION ('building-graph')
      // -----------------------------------------------------------------------
      const graph = buildKnowledgeGraph(
        canonicalConcepts,
        relationships,
        successfullyExtractedSources,
        options.graphBuilder
      );

      notify('building-graph', PIPELINE_STAGE_LABELS['building-graph'], {
        conceptsExtracted: canonicalConcepts.length,
        relationshipsMapped: graph.relationships.length,
        partialGraph: graph
      });
      if (typeof window !== 'undefined') {
        await new Promise((res) => setTimeout(res, 400));
      }

      if (!graph || graph.nodes.length === 0) {
        const error: PipelineError = {
          stage: 'building-graph',
          code: 'GRAPH_BUILD_FAILED',
          message: 'Failed to construct a valid knowledge graph from your material.'
        };
        notify('error', error.message);
        return { success: false, stage: 'error', error };
      }

      // -----------------------------------------------------------------------
      // STAGE 7: COMPLETE ('complete')
      // -----------------------------------------------------------------------
      const endTime = Date.now();
      const metrics: PipelineMetrics = {
        durationMs: endTime - startTime,
        sourcesProcessed: successfullyExtractedSources.length,
        chunksCount: allChunks.length,
        rawConceptsCount: rawCandidates.length,
        canonicalConceptsCount: canonicalConcepts.length,
        relationshipsCount: graph.relationships.length,
        nodesCount: graph.nodes.length
      };

      notify('complete', PIPELINE_STAGE_LABELS['complete'], {
        conceptsExtracted: graph.nodes.length,
        relationshipsMapped: graph.relationships.length,
        partialGraph: graph
      });

      return {
        success: true,
        stage: 'complete',
        graph,
        sources: successfullyExtractedSources,
        metrics
      };
    } catch (err: unknown) {
      // Top-level error safety: NEVER crash, NEVER show stack traces to user
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during processing.';
      const cleanMessage = message.includes('\n') ? message.split('\n')[0] : message;

      const error: PipelineError = {
        stage: 'error',
        code: 'INTERNAL_ERROR',
        message: cleanMessage || 'Failed to complete knowledge graph generation. Please try again.'
      };

      notify('error', error.message);
      return {
        success: false,
        stage: 'error',
        error
      };
    }
  }

  /**
   * Helper to execute directly from browser File objects (e.g. upload dropzone).
   */
  async executeFromFiles(files: File[], options?: PipelineOptions): Promise<PipelineResult> {
    return this.execute(files, options);
  }

  /**
   * Helper to execute from already registered KnowledgeSources.
   */
  async executeFromSources(sources: KnowledgeSource[], options?: PipelineOptions): Promise<PipelineResult> {
    return this.execute(sources, options);
  }
}

// Global Singleton Instance
export const pipelineOrchestrator = new PipelineOrchestrator();

/**
 * Convenience function for running the pipeline
 */
export async function runPipeline(
  input: File[] | KnowledgeSource[],
  options?: PipelineOptions
): Promise<PipelineResult> {
  return pipelineOrchestrator.execute(input, options);
}
