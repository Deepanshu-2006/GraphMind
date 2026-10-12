import type { KnowledgeGraph, KnowledgeNode, KnowledgeSource } from '../types/knowledgeGraph';
import type { 
  ConceptExplanation, 
  ExplanationState, 
  ExplanationSourceReference, 
  RelatedConceptReference,
  KeyTerminologyItem 
} from '../types/explanation';
import { getGeminiApiKey } from './conceptExtraction';

export const STORAGE_EXPLANATION_PREFIX = 'graphmind_concept_explanation_v1_';

/**
 * Resolves the persistent cache key for a concept explanation.
 * Strictly scopes by both graphId and conceptId to prevent cross-graph leakage.
 */
export function getExplanationStorageKey(graphId: string, conceptId: string): string {
  return `${STORAGE_EXPLANATION_PREFIX}${graphId}_${conceptId}`;
}

/**
 * Loads a cached concept explanation from persistence.
 */
export function loadStoredExplanation(graphId: string, conceptId: string): ConceptExplanation | null {
  if (typeof localStorage === 'undefined' || !graphId || !conceptId) return null;
  try {
    const raw = localStorage.getItem(getExplanationStorageKey(graphId, conceptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConceptExplanation;
    // Security check: ensure stored explanation belongs strictly to the requested graph and concept
    if (parsed && parsed.graphId === graphId && parsed.conceptId === conceptId) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[ConceptExplanation] Error loading stored explanation:', err);
    return null;
  }
}

/**
 * Saves a concept explanation to persistent cache.
 */
export function saveStoredExplanation(explanation: ConceptExplanation): void {
  if (typeof localStorage === 'undefined' || !explanation?.graphId || !explanation?.conceptId) return;
  try {
    localStorage.setItem(
      getExplanationStorageKey(explanation.graphId, explanation.conceptId),
      JSON.stringify(explanation)
    );
  } catch (err) {
    console.warn('[ConceptExplanation] Error saving stored explanation:', err);
  }
}

/**
 * Clears all cached explanations associated with a specific knowledge graph.
 */
export function clearStoredExplanations(graphId: string): void {
  if (typeof localStorage === 'undefined' || !graphId) return;
  try {
    const prefix = `${STORAGE_EXPLANATION_PREFIX}${graphId}_`;
    const keysToRemove: string[] = [];
    if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
    }
    if (keysToRemove.length === 0 && typeof Object.keys === 'function') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(prefix)) keysToRemove.push(k);
      });
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[ConceptExplanation] Error clearing explanations for graph:', err);
  }
}

/**
 * Extracted context for a concept grounded in the graph and sources.
 */
export interface ConceptSourceContext {
  node: KnowledgeNode;
  graphId: string;
  conceptName: string;
  category: string;
  description: string;
  evidenceText: string;
  evidenceItems: Array<{
    sourceId: string;
    sourceTitle: string;
    page?: number;
    chunkId?: string;
    text: string;
  }>;
  relatedRelationships: Array<{
    targetId: string;
    targetName: string;
    type: string;
    description?: string;
    direction: 'outgoing' | 'incoming';
  }>;
  matchingSources: KnowledgeSource[];
  isSufficient: boolean;
  missingReason?: string;
}

/**
 * Extracts and verifies source context for a given concept in a knowledge graph.
 */
export function extractConceptSourceContext(
  graph: KnowledgeGraph,
  conceptId: string
): { status: 'found'; context: ConceptSourceContext } | { status: 'empty' } | { status: 'insufficient'; reason: string } {
  if (!graph || !graph.nodes || graph.nodes.length === 0 || !conceptId) {
    return { status: 'empty' };
  }

  const node = graph.nodes.find(n => n.id === conceptId);
  if (!node || !node.name || node.name.trim().length === 0) {
    return { status: 'empty' };
  }

  const graphId = graph.id || 'default_graph';
  const conceptName = node.name.trim();
  const category = node.type || 'concept';
  const description = node.description ? node.description.trim() : '';
  const evidenceText = node.evidence ? node.evidence.trim() : '';

  // Gather matching sources from the graph
  const sourceIdSet = new Set(node.sourceIds || []);
  const matchingSources = (graph.sources || []).filter(s => sourceIdSet.has(s.id));

  // Build evidence items with real source titles
  const evidenceItems: ConceptSourceContext['evidenceItems'] = [];
  if (node.evidenceItems && node.evidenceItems.length > 0) {
    for (const item of node.evidenceItems) {
      const src = (graph.sources || []).find(s => s.id === item.sourceId);
      evidenceItems.push({
        sourceId: item.sourceId || '',
        sourceTitle: src?.name || src?.fileName || 'Document Source',
        page: item.page,
        chunkId: item.chunkId,
        text: item.text.trim()
      });
    }
  } else if (evidenceText) {
    const firstSrc = matchingSources[0];
    evidenceItems.push({
      sourceId: firstSrc?.id || '',
      sourceTitle: firstSrc?.name || firstSrc?.fileName || 'Document Source',
      text: evidenceText
    });
  }

  // Also check if any source text contains passages directly mentioning this concept
  if (evidenceItems.length === 0 && (graph.sources || []).length > 0) {
    for (const src of graph.sources || []) {
      if (src.text && src.text.toLowerCase().includes(conceptName.toLowerCase())) {
        // Extract paragraph containing the concept
        const paragraphs = src.text.split(/\n\s*\n|\r\n\s*\r\n/);
        for (const p of paragraphs) {
          if (p.toLowerCase().includes(conceptName.toLowerCase()) && p.trim().length >= 25) {
            evidenceItems.push({
              sourceId: src.id,
              sourceTitle: src.name || src.fileName || 'Document Source',
              text: p.trim()
            });
            break;
          }
        }
      }
    }
  }

  // Gather connected relationships
  const relatedRelationships: ConceptSourceContext['relatedRelationships'] = [];
  for (const rel of graph.relationships || []) {
    if (rel.source === conceptId) {
      const targetNode = graph.nodes.find(n => n.id === rel.target);
      relatedRelationships.push({
        targetId: rel.target,
        targetName: targetNode?.name || rel.target,
        type: rel.type || rel.label || 'related-to',
        description: rel.description,
        direction: 'outgoing'
      });
    } else if (rel.target === conceptId) {
      const sourceNode = graph.nodes.find(n => n.id === rel.source);
      relatedRelationships.push({
        targetId: rel.source,
        targetName: sourceNode?.name || rel.source,
        type: rel.type || rel.label || 'related-to',
        description: rel.description,
        direction: 'incoming'
      });
    }
  }

  // Determine material sufficiency (Section 3: Grounding in real sources)
  const hasSubstantialDesc = description.length >= 20;
  const hasDirectEvidence = evidenceItems.length > 0 || evidenceText.length >= 20;
  const hasRelevantRels = relatedRelationships.length > 0 && (description.length > 0 || evidenceText.length > 0);

  const isSufficient = hasDirectEvidence || hasSubstantialDesc || hasRelevantRels;

  if (!isSufficient) {
    const missingReason = `The learning materials associated with this knowledge graph do not contain sufficient documented definitions, text passages, or verified relationships for "${conceptName}".`;
    return {
      status: 'insufficient',
      reason: missingReason
    };
  }

  return {
    status: 'found',
    context: {
      node,
      graphId,
      conceptName,
      category,
      description,
      evidenceText,
      evidenceItems,
      relatedRelationships,
      matchingSources,
      isSufficient: true
    }
  };
}

/**
 * Deterministic Grounded Synthesizer
 * Produces structured, editorial, student-focused explanations grounded
 * in the real graph node, evidence passages, relationships, and source texts.
 * Used when offline, when no API key is configured, or as a reliable fallback.
 */
export function synthesizeGroundedExplanation(context: ConceptSourceContext): ConceptExplanation {
  const { node, graphId, conceptName, category, description, evidenceItems, relatedRelationships, matchingSources } = context;

  // 1. Overview (Clear, understandable high-level foundation)
  let overview = description;
  if (!overview || overview.length < 25) {
    if (evidenceItems.length > 0 && evidenceItems[0].text) {
      overview = evidenceItems[0].text;
    } else {
      overview = `${conceptName} is a foundational ${category} within this knowledge domain.`;
    }
  }

  // 2. Detailed Explanation (Clear, cohesive paragraphs unrolling concepts progressively)
  const paragraphs: string[] = [];

  // Paragraph A: Core mechanism & operational context
  const primaryEvidence = evidenceItems[0]?.text;
  if (primaryEvidence && primaryEvidence !== overview) {
    paragraphs.push(primaryEvidence);
  } else if (description && description !== overview) {
    paragraphs.push(description);
  } else {
    paragraphs.push(
      `In the context of ${category}, ${conceptName} establishes critical operational principles for structured computation and domain reasoning.`
    );
  }

  // Paragraph B: Structural relationships & dependencies
  if (relatedRelationships.length > 0) {
    const outgoing = relatedRelationships.filter(r => r.direction === 'outgoing');
    const incoming = relatedRelationships.filter(r => r.direction === 'incoming');

    const relSentences: string[] = [];
    if (outgoing.length > 0) {
      const formatted = outgoing.slice(0, 3).map(r => `${r.type.replace(/-/g, ' ')} ${r.targetName}`).join(', ');
      relSentences.push(`${conceptName} directly connects to other key domain ideas, specifically through ${formatted}.`);
    }
    if (incoming.length > 0) {
      const formatted = incoming.slice(0, 2).map(r => `${r.targetName} (${r.type.replace(/-/g, ' ')})`).join(', ');
      relSentences.push(`It is supported by foundational concepts including ${formatted}.`);
    }

    if (relSentences.length > 0) {
      paragraphs.push(relSentences.join(' '));
    }
  }

  // Paragraph C: Secondary evidence or deeper details if available
  if (evidenceItems.length > 1) {
    const secondaryEvidence = evidenceItems[1].text;
    if (secondaryEvidence && !paragraphs.includes(secondaryEvidence)) {
      paragraphs.push(secondaryEvidence);
    }
  }

  // 3. Key Terminology (Extracted from node prerequisites, aliases, and evidence)
  const keyTerminology: KeyTerminologyItem[] = [];
  if (node.prerequisites && node.prerequisites.length > 0) {
    node.prerequisites.forEach(prereq => {
      keyTerminology.push({
        term: prereq,
        definition: `Prerequisite concept necessary for understanding ${conceptName}.`,
        context: `${conceptName} builds directly upon this foundation.`
      });
    });
  }

  // 4. Important Points
  const importantPoints: string[] = [];
  importantPoints.push(`Core classification: ${category.charAt(0).toUpperCase() + category.slice(1)}.`);
  if (node.isCoreConcept) {
    importantPoints.push('Identified as a core curricular concept in this knowledge graph.');
  }
  if (evidenceItems.length > 0) {
    importantPoints.push('Directly substantiated by verified text passages in uploaded learning materials.');
  }
  if (relatedRelationships.length > 0) {
    importantPoints.push(`Maintains ${relatedRelationships.length} verified semantic relationships in this knowledge graph.`);
  }

  // 5. Examples (Only include if evidence or description contains concrete instances)
  let examples: string[] | undefined = undefined;
  const exampleMatches = (overview + ' ' + paragraphs.join(' ')).match(/(?:for example|such as|e\.g\.|including)\s+([^.]+)/i);
  if (exampleMatches && exampleMatches[1]) {
    examples = [exampleMatches[1].trim()];
  }

  // 6. Related Concept References
  const relatedConceptReferences: RelatedConceptReference[] = relatedRelationships.slice(0, 5).map(r => ({
    conceptId: r.targetId,
    conceptName: r.targetName,
    relationshipType: r.type,
    context: r.direction === 'outgoing' 
      ? `${conceptName} ${r.type.replace(/-/g, ' ')} ${r.targetName}`
      : `${r.targetName} ${r.type.replace(/-/g, ' ')} ${conceptName}`
  }));

  // 7. Source References (Grounded in real documents)
  const sourceReferences: ExplanationSourceReference[] = evidenceItems.map(item => ({
    sourceId: item.sourceId,
    sourceTitle: item.sourceTitle,
    page: item.page,
    chunkId: item.chunkId,
    excerpt: item.text
  }));

  if (sourceReferences.length === 0 && matchingSources.length > 0) {
    sourceReferences.push({
      sourceId: matchingSources[0].id,
      sourceTitle: matchingSources[0].name || matchingSources[0].fileName || 'Associated Document',
      excerpt: overview
    });
  }

  return {
    graphId,
    conceptId: node.id,
    conceptName,
    category,
    overview,
    detailedExplanation: paragraphs,
    keyTerminology: keyTerminology.length > 0 ? keyTerminology : undefined,
    importantPoints: importantPoints.length > 0 ? importantPoints : undefined,
    examples,
    relatedConceptReferences: relatedConceptReferences.length > 0 ? relatedConceptReferences : undefined,
    sourceReferences,
    isSourceGrounded: sourceReferences.length > 0,
    groundingConfidence: sourceReferences.length > 1 ? 'high' : 'moderate',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generates an explanation using the Gemini LLM when an API key is available,
 * with prompt injection protection and strict JSON response validation.
 */
async function generateGeminiExplanation(
  context: ConceptSourceContext,
  apiKey: string,
  signal?: AbortSignal
): Promise<ConceptExplanation> {
  const { graphId, node, conceptName, category, description, evidenceItems, relatedRelationships, matchingSources } = context;

  // Untrusted document content sanitization (Section 7: Security)
  const safeEvidenceList = evidenceItems.map(e => ({
    source: e.sourceTitle.replace(/[\r\n]+/g, ' ').slice(0, 100),
    page: e.page,
    quote: e.text.replace(/[\r\n]+/g, ' ').slice(0, 800)
  }));

  const safeRelList = relatedRelationships.map(r => ({
    target: r.targetName.slice(0, 80),
    type: r.type.slice(0, 40),
    direction: r.direction
  }));

  const systemInstruction = `
You are GraphMind's Deep Revision Explanation Engine.
Your task is to generate a student-centered, rigorous, highly understandable concept explanation.
CRITICAL GROUNDING RULES:
1. Ground strictly in the provided reference materials and graph relationships.
2. DO NOT fabricate quotations, citations, page numbers, or external facts.
3. If an example is not directly supported by the text, omit the "examples" array.
4. Begin with an understandable conceptual overview.
5. Provide 2-3 clear, well-structured paragraphs in "detailedExplanation".
6. Avoid repetitive definitions, motivational fluff, or generic filler.
7. Return strictly valid JSON matching the schema:
{
  "overview": "string",
  "detailedExplanation": ["string"],
  "keyTerminology": [{"term": "string", "definition": "string"}],
  "importantPoints": ["string"],
  "examples": ["string"]
}
`.trim();

  const userPrompt = `
Concept Name: ${conceptName}
Category: ${category}
Existing Description: ${description || 'None'}
Evidence Passages:
${JSON.stringify(safeEvidenceList, null, 2)}
Graph Relationships:
${JSON.stringify(safeRelList, null, 2)}

Synthesize a clear, source-grounded explanation for this concept.
`.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini response contained no content part');
  }

  const parsed = JSON.parse(rawText);
  if (!parsed.overview || !Array.isArray(parsed.detailedExplanation) || parsed.detailedExplanation.length === 0) {
    throw new Error('Gemini response missing required overview or detailedExplanation');
  }

  // Build verified source references
  const sourceReferences: ExplanationSourceReference[] = evidenceItems.map(item => ({
    sourceId: item.sourceId,
    sourceTitle: item.sourceTitle,
    page: item.page,
    chunkId: item.chunkId,
    excerpt: item.text
  }));

  if (sourceReferences.length === 0 && matchingSources.length > 0) {
    sourceReferences.push({
      sourceId: matchingSources[0].id,
      sourceTitle: matchingSources[0].name || matchingSources[0].fileName || 'Associated Document',
      excerpt: parsed.overview
    });
  }

  // Related concept references from graph
  const relatedConceptReferences: RelatedConceptReference[] = relatedRelationships.slice(0, 5).map(r => ({
    conceptId: r.targetId,
    conceptName: r.targetName,
    relationshipType: r.type,
    context: r.direction === 'outgoing'
      ? `${conceptName} ${r.type.replace(/-/g, ' ')} ${r.targetName}`
      : `${r.targetName} ${r.type.replace(/-/g, ' ')} ${conceptName}`
  }));

  return {
    graphId,
    conceptId: node.id,
    conceptName,
    category,
    overview: parsed.overview.trim(),
    detailedExplanation: Array.isArray(parsed.detailedExplanation) ? parsed.detailedExplanation.map((p: string) => p.trim()) : undefined,
    howItWorks: Array.isArray(parsed.howItWorks) && parsed.howItWorks.length > 0 ? parsed.howItWorks.map((s: string) => s.trim()) : undefined,
    keyComponents: Array.isArray(parsed.keyComponents) && parsed.keyComponents.length > 0 ? parsed.keyComponents : undefined,
    keyTerminology: Array.isArray(parsed.keyTerminology) && parsed.keyTerminology.length > 0 ? parsed.keyTerminology : undefined,
    importantDetails: Array.isArray(parsed.importantDetails) && parsed.importantDetails.length > 0 ? parsed.importantDetails.map((s: string) => s.trim()) : undefined,
    importantPoints: Array.isArray(parsed.importantPoints) && parsed.importantPoints.length > 0 ? parsed.importantPoints : undefined,
    examples: Array.isArray(parsed.examples) && parsed.examples.length > 0 ? parsed.examples : undefined,
    comparisonTable: (parsed.comparisonTable && Array.isArray(parsed.comparisonTable.headers) && Array.isArray(parsed.comparisonTable.rows)) ? parsed.comparisonTable : undefined,
    codeSnippet: (parsed.codeSnippet && parsed.codeSnippet.code) ? parsed.codeSnippet : undefined,
    relatedConceptReferences: relatedConceptReferences.length > 0 ? relatedConceptReferences : undefined,
    sourceReferences,
    isSourceGrounded: sourceReferences.length > 0,
    groundingConfidence: sourceReferences.length > 1 ? 'high' : 'moderate',
    generatedAt: new Date().toISOString()
  };
}

// In-flight request deduplication map (Section 6F: Prevent duplicate requests)
const inFlightRequests = new Map<string, Promise<ExplanationState>>();

export interface FetchExplanationOptions {
  graph: KnowledgeGraph;
  conceptId: string;
  forceRegenerate?: boolean;
  signal?: AbortSignal;
}

/**
 * Primary entry point: Retrieves or generates a source-grounded concept explanation.
 * - Handles cached retrieval
 * - Handles sufficiency verification
 * - Deduplicates in-flight calls
 * - Invokes AI with deterministic fallback
 */
export async function getOrGenerateConceptExplanation(
  options: FetchExplanationOptions
): Promise<ExplanationState> {
  const { graph, conceptId, forceRegenerate = false, signal } = options;

  if (!graph || !conceptId) {
    return { status: 'empty', conceptId };
  }

  const graphId = graph.id || 'default_graph';
  const requestKey = `${graphId}:${conceptId}`;

  // 1. Check persistent cache if not forcing regeneration
  if (!forceRegenerate) {
    const cached = loadStoredExplanation(graphId, conceptId);
    if (cached) {
      return {
        status: 'ready',
        explanation: cached,
        conceptId,
        graphId
      };
    }
  }

  // 2. Prevent duplicate in-flight requests for the same graph + concept
  const existingPromise = inFlightRequests.get(requestKey);
  if (existingPromise) {
    return existingPromise;
  }

  // 3. Execute generation promise
  const generationPromise = (async (): Promise<ExplanationState> => {
    try {
      // Step A: Extract and verify source context
      const contextResult = extractConceptSourceContext(graph, conceptId);

      if (contextResult.status === 'empty') {
        return { status: 'empty', conceptId, graphId };
      }

      if (contextResult.status === 'insufficient') {
        return {
          status: 'insufficient',
          conceptId,
          graphId,
          insufficientReason: contextResult.reason
        };
      }

      const context = contextResult.context;

      // Step B: Attempt AI generation if API key is configured
      const apiKey = getGeminiApiKey();
      let explanation: ConceptExplanation;

      if (apiKey) {
        try {
          explanation = await generateGeminiExplanation(context, apiKey, signal);
        } catch (aiErr) {
          console.warn('[ConceptExplanation] Gemini API failed, using grounded synthesizer:', aiErr);
          explanation = synthesizeGroundedExplanation(context);
        }
      } else {
        // High-precision deterministic grounded synthesizer
        explanation = synthesizeGroundedExplanation(context);
      }

      // Step C: Persist generated explanation to scoped storage
      saveStoredExplanation(explanation);

      return {
        status: 'ready',
        explanation,
        conceptId,
        graphId
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { status: 'idle', conceptId, graphId };
      }
      return {
        status: 'error',
        errorMessage: err?.message || 'Failed to generate concept explanation.',
        conceptId,
        graphId
      };
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, generationPromise);
  return generationPromise;
}
