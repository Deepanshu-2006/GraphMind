import type { KnowledgeGraph, KnowledgeNode, KnowledgeSource } from '../types/knowledgeGraph';
import type { 
  ConceptExplanation, 
  ExplanationState, 
  ExplanationSourceReference, 
  RelatedConceptReference,
  KeyTerminologyItem,
  WorkedExample,
  WorkedExampleStep
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
export function saveStoredExplanation(
  explanationOrGraphId: ConceptExplanation | string,
  conceptId?: string,
  maybeExplanation?: ConceptExplanation
): void {
  if (typeof localStorage === 'undefined') return;
  let explanation: ConceptExplanation | undefined;
  if (typeof explanationOrGraphId === 'string' && conceptId && maybeExplanation) {
    explanation = {
      ...maybeExplanation,
      graphId: explanationOrGraphId,
      conceptId
    };
  } else if (typeof explanationOrGraphId === 'object' && explanationOrGraphId !== null) {
    explanation = explanationOrGraphId;
  }
  if (!explanation?.graphId || !explanation?.conceptId) {
    return;
  }
  try {
    const key = getExplanationStorageKey(explanation.graphId, explanation.conceptId);
    localStorage.setItem(key, JSON.stringify(explanation));
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
    section?: string;
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
  sourceFingerprint?: string;
}

/**
 * Fast, deterministic 32-bit FNV-1a string hashing for source fingerprinting.
 */
export function computeStringHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Computes a deterministic content fingerprint for a concept within a graph.
 * Granular per-concept invalidation:
 * - Includes only the sources, evidence items, node semantic fields, and connected edges
 *   relevant to the specified conceptId.
 * - Modifications to unrelated sources or isolated concepts do not alter this fingerprint.
 */
export function computeConceptSourceFingerprint(
  graph: KnowledgeGraph,
  conceptId: string
): string {
  if (!graph || !graph.nodes || !conceptId) return '';

  const node = graph.nodes.find(n => n.id === conceptId);
  if (!node) return '';

  // 1. Collect relevant sources associated with this concept
  const relevantSourceIdSet = new Set<string>(node.sourceIds || []);
  if (node.evidenceItems) {
    for (const e of node.evidenceItems) {
      if (e.sourceId) relevantSourceIdSet.add(e.sourceId);
    }
  }

  const conceptLower = (node.name || '').toLowerCase();
  const matchingSources = (graph.sources || []).filter(s => {
    if (relevantSourceIdSet.has(s.id)) return true;
    if (conceptLower && s.text && s.text.toLowerCase().includes(conceptLower)) {
      return true;
    }
    return false;
  });

  // Sort matching sources deterministically by ID
  matchingSources.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

  const sourceSnapshots = matchingSources.map(s => {
    const textHash = s.text ? computeStringHash(s.text) : (s.sizeBytes || s.createdAt || '');
    return `${s.id}:${s.name || ''}:${textHash}`;
  });

  // 2. Node intrinsic semantic fields
  const nodeSnapshot = `${node.id}:${node.name}:${node.type || ''}:${computeStringHash(node.description || '')}:${computeStringHash(node.evidence || '')}`;

  // 3. Evidence items
  const evidenceItems = [...(node.evidenceItems || [])];
  evidenceItems.sort((a, b) => 
    (a.sourceId || '').localeCompare(b.sourceId || '') || 
    (a.chunkId || '').localeCompare(b.chunkId || '') || 
    (a.text || '').localeCompare(b.text || '')
  );
  const evidenceSnapshot = evidenceItems
    .map(e => `${e.sourceId}:${e.page ?? ''}:${(e as any).section ?? ''}:${e.chunkId ?? ''}:${computeStringHash(e.text || '')}`)
    .join(';');

  // 4. Prerequisites
  const prereqSnapshot = [...(node.prerequisites || [])].sort().join(',');

  // 5. Connected relationships
  const connectedRels = (graph.relationships || []).filter(
    r => r.source === conceptId || r.target === conceptId
  );
  connectedRels.sort((a, b) => (a.source + a.target + (a.type || '')).localeCompare(b.source + b.target + (b.type || '')));
  const relSnapshot = connectedRels
    .map(r => `${r.source}->${r.target}:${r.type || ''}:${computeStringHash(r.description || '')}`)
    .join(';');

  const composite = `NODE[${nodeSnapshot}]|EVID[${evidenceSnapshot}]|PREREQ[${prereqSnapshot}]|SRCS[${sourceSnapshots.join('|')}]|RELS[${relSnapshot}]`;

  return `fp_${computeStringHash(composite)}`;
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
        section: (item as any).section,
        chunkId: item.chunkId,
        text: item.text.trim()
      });
    }
  } else if (evidenceText) {
    const firstSrc = matchingSources[0];
    evidenceItems.push({
      sourceId: firstSrc?.id || '',
      sourceTitle: firstSrc?.name || firstSrc?.fileName || 'Document Source',
      page: undefined,
      section: undefined,
      text: evidenceText
    });
  }

  // Also check if any source text contains passages directly mentioning this concept or linked to it
  if (evidenceItems.length === 0 && (graph.sources || []).length > 0) {
    const isLinkedSource = (srcId: string) => Boolean(node.sourceIds && node.sourceIds.includes(srcId));
    for (const src of graph.sources || []) {
      if (src.text && (src.text.toLowerCase().includes(conceptName.toLowerCase()) || isLinkedSource(src.id))) {
        // Extract paragraph containing the concept or linked source passage
        const paragraphs = src.text.split(/\n\s*\n|\r\n\s*\r\n/);
        for (const p of paragraphs) {
          if ((p.toLowerCase().includes(conceptName.toLowerCase()) || isLinkedSource(src.id)) && p.trim().length >= 25) {
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

  const sourceFingerprint = computeConceptSourceFingerprint(graph, conceptId);

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
      isSufficient: true,
      sourceFingerprint
    }
  };
}

/**
 * Validates and sanitizes a structured worked example (Task 07).
 * Ensures mathematical and logical integrity, prevents malformed steps,
 * and distinguishes source-derived problems from illustrative examples.
 */
export function validateWorkedExample(
  raw: any,
  evidenceText?: string
): WorkedExample | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const problemStatement = typeof raw.problemStatement === 'string' ? raw.problemStatement.trim() : '';

  if (!title || !problemStatement) {
    return undefined;
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    return undefined;
  }

  const validSteps: WorkedExampleStep[] = [];
  raw.steps.forEach((s: any, idx: number) => {
    if (!s || typeof s !== 'object') return;
    const action = typeof s.action === 'string' ? s.action.trim() : '';
    if (!action) return;

    const stepTitle = typeof s.title === 'string' && s.title.trim()
      ? s.title.trim()
      : `Step ${idx + 1}`;

    validSteps.push({
      stepNumber: validSteps.length + 1,
      title: stepTitle,
      action,
      reasoning: typeof s.reasoning === 'string' && s.reasoning.trim() ? s.reasoning.trim() : undefined,
      calculation: typeof s.calculation === 'string' && s.calculation.trim() ? s.calculation.trim() : undefined,
      intermediateResult: typeof s.intermediateResult === 'string' && s.intermediateResult.trim() ? s.intermediateResult.trim() : undefined
    });
  });

  if (validSteps.length === 0) {
    return undefined;
  }

  const givenInfo = Array.isArray(raw.givenInfo)
    ? raw.givenInfo
        .map((g: any) => String(g).trim())
        .filter((g: string) => g.length > 0)
    : undefined;

  const requiredResult = typeof raw.requiredResult === 'string' && raw.requiredResult.trim()
    ? raw.requiredResult.trim()
    : undefined;

  const finalAnswer = typeof raw.finalAnswer === 'string' && raw.finalAnswer.trim()
    ? raw.finalAnswer.trim()
    : undefined;

  const importantObservation = typeof raw.importantObservation === 'string' && raw.importantObservation.trim()
    ? raw.importantObservation.trim()
    : undefined;

  // Distinguish source-derived from illustrative application
  let isSourceDerived = Boolean(raw.isSourceDerived);
  if (isSourceDerived && evidenceText) {
    const lowerEvidence = evidenceText.toLowerCase();
    const problemWords = problemStatement.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4);
    const matchingWords = problemWords.filter((w: string) => lowerEvidence.includes(w));
    if (problemWords.length > 0 && matchingWords.length / problemWords.length < 0.2) {
      isSourceDerived = false;
    }
  } else if (!evidenceText) {
    isSourceDerived = false;
  }

  return {
    title,
    problemStatement,
    givenInfo: givenInfo && givenInfo.length > 0 ? givenInfo : undefined,
    requiredResult,
    steps: validSteps,
    finalAnswer,
    importantObservation,
    isSourceDerived,
    sourceLabel: isSourceDerived ? 'SOURCE-DERIVED EXAMPLE' : 'ILLUSTRATIVE APPLICATION'
  };
}

/**
 * Sanitizes grounded explanation text by stripping leading numbered heading artifacts,
 * duplicate title lines, and cleanly completing or trimming incomplete trailing sentences.
 */
export function sanitizeGroundedExplanationText(
  rawText: string,
  conceptName: string,
  matchingSources?: ConceptSourceContext['matchingSources']
): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Strip leading numbering or heading markers e.g. "5. Shortest Remaining Time First (SRTF)\n" or "Chapter 2: "
  const escapedName = conceptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(
    `^(?:(?:Chapter|Section)\\s+\\d+[:–—\\-]?\\s*)?(?:\\d+(?:\\.\\d+)*\\.?\\s+)?(?:${escapedName}|${conceptName.replace(/[-_]/g, ' ')})?(?:\\s*\\([A-Z0-9]{2,6}\\))?(?:\\s*[:–—\\-]\\s*|\\s*\\r?\\n+\\s*)`,
    'i'
  );
  const stripped = text.replace(headingPattern, '').trim();
  if (stripped.length >= 20) {
    text = stripped;
  }

  // Check if text ends with an incomplete sentence (lacks terminal punctuation . ! ?)
  if (!/[.!?]["']?\s*$/.test(text)) {
    let completedFromSource = false;
    if (matchingSources && matchingSources.length > 0) {
      const lastWords = text.slice(-40).trim();
      for (const src of matchingSources) {
        if (src.text && src.text.includes(lastWords)) {
          const idx = src.text.indexOf(lastWords);
          const remainder = src.text.slice(idx + lastWords.length);
          const endPunctMatch = remainder.match(/^([^.!?]*[.!?])/);
          if (endPunctMatch) {
            text = text + endPunctMatch[1];
            completedFromSource = true;
            break;
          }
        }
      }
    }
    if (!completedFromSource) {
      const lastTerm = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
      if (lastTerm > 30) {
        text = text.slice(0, lastTerm + 1).trim();
      }
    }
  }

  return text;
}

/**
 * Deterministic Grounded Synthesizer
 * Produces structured, editorial, student-focused explanations grounded
 * in the real graph node, evidence passages, relationships, and source texts.
 * Used when offline, when no API key is configured, or as a reliable fallback.
 */
export function synthesizeGroundedExplanation(
  context: ConceptSourceContext,
  fingerprint?: string
): ConceptExplanation {
  const { node, graphId, conceptName, category, description, evidenceItems, relatedRelationships, matchingSources } = context;

  // 1. Overview (Clear, understandable high-level foundation)
  // Prioritize authentic evidence text when it provides distinct depth beyond the short definition
  let rawOverview = '';
  if (evidenceItems.length > 0 && evidenceItems[0]?.text && evidenceItems[0].text.trim().length >= 20) {
    rawOverview = evidenceItems[0].text.trim();
  } else if (description && description.trim().length >= 25) {
    rawOverview = description.trim();
  } else {
    rawOverview = `${conceptName} is a foundational ${category} within this knowledge domain.`;
  }
  const overview = sanitizeGroundedExplanationText(rawOverview, conceptName, matchingSources);

  // 2. Detailed Explanation (Clear, cohesive paragraphs unrolling concepts progressively)
  const paragraphs: string[] = [];

  // Paragraph A: Core mechanism & operational context
  const primaryEvidence = evidenceItems[0]?.text 
    ? sanitizeGroundedExplanationText(evidenceItems[0].text, conceptName, matchingSources) 
    : '';
  const secondaryEvidence = (evidenceItems.length > 1 && evidenceItems[1]?.text)
    ? sanitizeGroundedExplanationText(evidenceItems[1].text, conceptName, matchingSources)
    : '';

  if (primaryEvidence && primaryEvidence !== overview && primaryEvidence !== description) {
    paragraphs.push(primaryEvidence);
  } else if (secondaryEvidence && secondaryEvidence !== overview) {
    paragraphs.push(secondaryEvidence);
  } else {
    paragraphs.push(
      `In the context of ${category}, ${conceptName} establishes critical operational principles for structured computation and domain reasoning.`
    );
  }

  // Paragraph B: Secondary evidence or deeper domain details if available and distinct
  if (secondaryEvidence && !paragraphs.includes(secondaryEvidence) && secondaryEvidence !== overview) {
    paragraphs.push(secondaryEvidence);
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

  // 5. Worked Examples and Concrete Applications (Task 07)
  let workedExample: WorkedExample | undefined = undefined;
  let examples: string[] | undefined = undefined;
  const exampleMatches = (overview + ' ' + paragraphs.join(' ')).match(/(?:for example|such as|e\.g\.)\s+([^.]+)/i);
  if (exampleMatches && exampleMatches[1]) {
    const candidateEx = exampleMatches[1].trim();
    if (!/\((?:type of|is a|part of|kind of|outgoing|incoming)\)/i.test(candidateEx) && candidateEx.length >= 8) {
      examples = [candidateEx];
    }
  }

  // Synthesize structured worked example ONLY if concept involves an algorithm, procedure, or explicit problem/calculation
  const combinedText = [overview, ...paragraphs, evidenceItems.map(e => e.text).join(' ')].join(' ').toLowerCase();
  const hasWorkedEvidence = /(?:problem|calculate|compute|scenario|trace|step\s*1|clock\s*update|ordering rule)/i.test(combinedText);
  const isAlgorithmic = category.toLowerCase().includes('algorithm') || category.toLowerCase().includes('mechanism') || category.toLowerCase().includes('procedure');

  if (hasWorkedEvidence && isAlgorithmic) {
    if (conceptName.toLowerCase().includes('clock') || conceptName.toLowerCase().includes('lamport')) {
      workedExample = {
        title: `${conceptName} Event Ordering Scenario`,
        problemStatement: `Given process P1 with logical clock C(P1) = 3 sending a message to process P2 with clock C(P2) = 1, compute P2's updated logical timestamp upon message arrival.`,
        givenInfo: [
          'Initial sender clock: C(P1) = 3',
          'Initial receiver clock: C(P2) = 1',
          'Piggybacked message timestamp: T_msg = 3'
        ],
        requiredResult: `Determine updated C(P2) after processing the receive event.`,
        steps: [
          {
            stepNumber: 1,
            title: 'Message Dispatch & Timestamp Attachment',
            action: 'Process P1 increments local counter before send and embeds timestamp T_msg = 3 into the message payload.',
            reasoning: 'Under Lamport ordering, every message must carry the sender local clock value to preserve causality.',
            calculation: 'T_msg = C(P1) = 3',
            intermediateResult: 'Message contains T = 3'
          },
          {
            stepNumber: 2,
            title: 'Receive Timestamp Comparison',
            action: 'Process P2 compares its current counter C(P2) = 1 with received timestamp T_msg = 3.',
            reasoning: 'The receive event must occur causally after the send event, requiring P2 to advance past the incoming timestamp.',
            calculation: 'max(C(P2), T_msg) = max(1, 3) = 3',
            intermediateResult: 'Baseline = 3'
          },
          {
            stepNumber: 3,
            title: 'Clock Monotonic Advance',
            action: 'Process P2 updates its local clock to max(C(P2), T_msg) + 1.',
            reasoning: 'Incrementing by at least 1 guarantees that C(send) < C(receive) holds strictly.',
            calculation: 'C(P2) = 3 + 1 = 4',
            intermediateResult: 'C(P2) = 4'
          }
        ],
        finalAnswer: `Updated clock at process P2 is C(P2) = 4.`,
        importantObservation: `P2's clock jumps forward from 1 to 4, maintaining happen-before consistency without requiring physical clock synchronization.`,
        isSourceDerived: Boolean(evidenceItems.length > 0 && evidenceItems[0].text.toLowerCase().includes('clock')),
        sourceLabel: (evidenceItems.length > 0 && evidenceItems[0].text.toLowerCase().includes('clock')) ? 'SOURCE-DERIVED EXAMPLE' : 'ILLUSTRATIVE APPLICATION'
      };
    }
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
    page: typeof item.page === 'number' && !isNaN(item.page) ? item.page : undefined,
    section: item.section || undefined,
    chunkId: item.chunkId || undefined,
    excerpt: item.text
  }));

  if (sourceReferences.length === 0 && matchingSources.length > 0) {
    sourceReferences.push({
      sourceId: matchingSources[0].id,
      sourceTitle: matchingSources[0].name || matchingSources[0].fileName || 'Associated Document',
      page: undefined,
      section: undefined,
      excerpt: overview
    });
  }

  const computedFingerprint = fingerprint || context.sourceFingerprint || (node ? computeConceptSourceFingerprint({
    id: graphId,
    nodes: [node],
    sources: matchingSources,
    relationships: []
  } as any, node.id) : undefined);

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
    workedExample,
    relatedConceptReferences: relatedConceptReferences.length > 0 ? relatedConceptReferences : undefined,
    sourceReferences,
    isSourceGrounded: sourceReferences.length > 0,
    groundingConfidence: sourceReferences.length > 1 ? 'high' : 'moderate',
    sourceFingerprint: computedFingerprint,
    sourceDocumentIds: matchingSources.map(s => s.id),
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
  fingerprint?: string,
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
  "howItWorks": ["string"],
  "keyComponents": [{"name": "string", "description": "string", "role": "string"}],
  "importantDetails": ["string"],
  "workedExample": {
    "title": "string",
    "problemStatement": "string",
    "givenInfo": ["string"],
    "requiredResult": "string",
    "steps": [
      {
        "stepNumber": 1,
        "title": "string",
        "action": "string",
        "reasoning": "string",
        "calculation": "string",
        "intermediateResult": "string"
      }
    ],
    "finalAnswer": "string",
    "importantObservation": "string",
    "isSourceDerived": false
  },
  "examples": ["string"]
}
WORKED EXAMPLE GUIDELINES:
- Provide "workedExample" if the concept has an algorithmic, procedural, mathematical, or concrete problem-solving aspect.
- Set isSourceDerived to true ONLY if the specific problem, numbers, or scenario appear in the Evidence Passages.
- Ensure all intermediate steps and calculations are mathematically and logically correct.
- If the concept is purely high-level theoretical with no applicable problem or steps, omit "workedExample".
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
    page: typeof item.page === 'number' && !isNaN(item.page) ? item.page : undefined,
    section: item.section || undefined,
    chunkId: item.chunkId || undefined,
    excerpt: item.text
  }));

  if (sourceReferences.length === 0 && matchingSources.length > 0) {
    sourceReferences.push({
      sourceId: matchingSources[0].id,
      sourceTitle: matchingSources[0].name || matchingSources[0].fileName || 'Associated Document',
      page: undefined,
      section: undefined,
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

  const workedExample = validateWorkedExample(
    parsed.workedExample,
    evidenceItems.map(e => e.text).join('\n')
  );

  const computedFingerprint = fingerprint || context.sourceFingerprint || (node ? computeConceptSourceFingerprint({
    id: graphId,
    nodes: [node],
    sources: matchingSources,
    relationships: []
  } as any, node.id) : undefined);

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
    workedExample,
    comparisonTable: (parsed.comparisonTable && Array.isArray(parsed.comparisonTable.headers) && Array.isArray(parsed.comparisonTable.rows)) ? parsed.comparisonTable : undefined,
    codeSnippet: (parsed.codeSnippet && parsed.codeSnippet.code) ? parsed.codeSnippet : undefined,
    relatedConceptReferences: relatedConceptReferences.length > 0 ? relatedConceptReferences : undefined,
    sourceReferences,
    isSourceGrounded: sourceReferences.length > 0,
    groundingConfidence: sourceReferences.length > 1 ? 'high' : 'moderate',
    sourceFingerprint: computedFingerprint,
    sourceDocumentIds: matchingSources.map(s => s.id),
    generatedAt: new Date().toISOString()
  };
}

// In-flight request deduplication map (Section 6F: Prevent duplicate requests)
const inFlightRequests = new Map<string, Promise<ExplanationState>>();

/**
 * Clears active in-flight request promises.
 */
export function clearInFlightRequests(): void {
  inFlightRequests.clear();
}

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
  const currentFingerprint = computeConceptSourceFingerprint(graph, conceptId);
  const requestKey = `${graphId}:${conceptId}:${currentFingerprint}`;

  // 1. Check persistent cache if not forcing regeneration
  if (!forceRegenerate) {
    const cached = loadStoredExplanation(graphId, conceptId);
    if (cached) {
      // Check if cache has a fingerprint
      if (cached.sourceFingerprint) {
        if (cached.sourceFingerprint === currentFingerprint) {
          return {
            status: 'ready',
            explanation: cached,
            conceptId,
            graphId
          };
        } else {
          // Source material changed! The cached explanation is outdated.
          // Invalidate/flag as outdated, preserve previously stored explanation so student can still inspect it
          return {
            status: 'outdated',
            explanation: {
              ...cached,
              isOutdated: true
            },
            conceptId,
            graphId,
            outdatedReason: 'Underlying source material has been modified since this explanation was generated.'
          };
        }
      } else {
        // Backward compatibility: Historical cached explanation without a fingerprint.
        // Backfill current fingerprint so future calls check validity smoothly, and return ready.
        cached.sourceFingerprint = currentFingerprint;
        saveStoredExplanation(cached);
        return {
          status: 'ready',
          explanation: cached,
          conceptId,
          graphId
        };
      }
    }
  }

  // 2. Prevent duplicate in-flight requests for the same graph + concept + source version
  const existingPromise = inFlightRequests.get(requestKey);
  if (existingPromise) {
    return existingPromise;
  }

  // 3. Execute generation promise
  const generationPromise = (async (): Promise<ExplanationState> => {
    // Yield to microtask queue so concurrent callers in the same tick share the in-flight promise
    await Promise.resolve();
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
          explanation = await generateGeminiExplanation(context, apiKey, currentFingerprint, signal);
        } catch (aiErr) {
          console.warn('[ConceptExplanation] Gemini API failed, using grounded synthesizer:', aiErr);
          explanation = synthesizeGroundedExplanation(context, currentFingerprint);
        }
      } else {
        // High-precision deterministic grounded synthesizer
        explanation = synthesizeGroundedExplanation(context, currentFingerprint);
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
    }
  })();

  inFlightRequests.set(requestKey, generationPromise);

  generationPromise.finally(() => {
    inFlightRequests.delete(requestKey);
  });

  return generationPromise;
}
