import type { 
  CanonicalConcept, 
  KnowledgeRelationship, 
  KnowledgeGraph, 
  KnowledgeNode, 
  KnowledgeSource, 
  TextChunk, 
  SemanticRelationType,
  RelationshipExtractionResult 
} from '../types/knowledgeGraph';
import { getGeminiApiKey } from './conceptExtraction';

/**
 * =========================================================================
 * SEMANTIC RELATIONSHIP EXTRACTION SERVICE (Day 2, Step 6)
 * Pipeline: CONCEPTS + SOURCE TEXT → RELATIONSHIPS → KNOWLEDGE GRAPH
 * =========================================================================
 */

export interface RelationshipExtractionOptions {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  modelName?: string;
  minConfidence?: number;
}

export interface RelationshipExtractionProvider {
  name: string;
  extractRelationships(concepts: CanonicalConcept[], chunk: TextChunk): Promise<KnowledgeRelationship[]>;
}

// -------------------------------------------------------------------------
// 1. CONTROLLED VOCABULARY & NORMALIZATION HELPERS
// Controlled types: related-to, part-of, foundation-for, depends-on, extends, uses, applied-to, instance-of
// -------------------------------------------------------------------------

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[-_–—/]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a robust regex pattern for a canonical concept that matches:
 * - The canonical name
 * - All recorded aliases and abbreviations
 * - Plural and singular variations (e.g. Transformer vs Transformers)
 */
export function buildConceptRegexPattern(concept: CanonicalConcept): string {
  const allNames = [concept.name, ...(concept.aliases || [])];
  const patterns = new Set<string>();

  for (const name of allNames) {
    const norm = normalizeForMatching(name);
    if (!norm) continue;
    const escaped = escapeRegex(norm);
    if (!norm.endsWith('s')) {
      patterns.add(`${escaped}(?:s|es)?`);
    } else {
      patterns.add(escaped);
    }
  }

  if (patterns.size === 0) {
    return escapeRegex(normalizeForMatching(concept.name));
  }

  const sorted = Array.from(patterns).sort((a, b) => b.length - a.length);
  return `(?:${sorted.join('|')})`;
}

/**
 * Checks whether a candidate concept is mentioned in a normalized sentence.
 * Inspects both canonical name and all recorded aliases and plural forms.
 */
export function conceptMatchesSentence(concept: CanonicalConcept, sentenceNorm: string): boolean {
  const pattern = buildConceptRegexPattern(concept);
  const regex = new RegExp(`\\b${pattern}\\b`, 'i');
  return regex.test(sentenceNorm);
}

const RELATION_SPECIFICITY_RANK: Record<string, number> = {
  'reduces': 10,
  'optimizes': 10,
  'causes': 10,
  'foundation-for': 10,
  'depends-on': 9,
  'extends': 9,
  'type-of': 9,
  'part-of': 8,
  'measured-by': 8,
  'uses': 7,
  'enables': 6,
  'applied-to': 5,
  'instance-of': 4,
  'related-to': 1
};

/**
 * Normalizes relationship type into a clean, human-readable semantic label:
 * e.g. "is a type of", "measured by", "uses", "causes", "optimizes", "reduces", "depends on"
 */
export function humanizeRelationLabel(type: string): string {
  const norm = (type || '').toLowerCase().trim();
  switch (norm) {
    case 'type-of':
    case 'is-a':
    case 'instance-of':
      return 'is a type of';
    case 'measured-by':
      return 'measured by';
    case 'optimizes':
      return 'optimizes';
    case 'causes':
      return 'causes';
    case 'reduces':
      return 'reduces';
    case 'improves':
      return 'improves';
    case 'uses':
      return 'uses';
    case 'depends-on':
      return 'depends on';
    case 'part-of':
    case 'consists-of':
      return 'consists of';
    case 'foundation-for':
      return 'foundation for';
    case 'enables':
      return 'enables';
    case 'requires':
      return 'requires';
    case 'precedes':
      return 'precedes';
    case 'contrasts-with':
      return 'contrasts with';
    case 'example-of':
      return 'example of';
    case 'applied-to':
      return 'applied to';
    case 'related-to':
    default:
      return 'related to';
  }
}

/**
 * Discovers if the source sentence establishes a semantic relationship between conceptA and conceptB.
 * Controlled vocabulary:
 * - foundation-for
 * - part-of
 * - depends-on
 * - extends
 * - uses
 * - applied-to
 * - instance-of
 * - related-to
 */
export function findSemanticRelation(
  sentence: string,
  conceptA: CanonicalConcept,
  conceptB: CanonicalConcept,
  chunkId: string,
  sourceId?: string
): KnowledgeRelationship | null {
  if (conceptA.id === conceptB.id) return null;

  const sNorm = normalizeForMatching(sentence);

  // Both concepts must appear in the same sentence
  if (!conceptMatchesSentence(conceptA, sNorm) || !conceptMatchesSentence(conceptB, sNorm)) {
    return null;
  }

  // Prevent connecting concepts across distant clauses or unrelated contexts in long compound sentences
  const aNorm = normalizeForMatching(conceptA.name);
  const bNorm = normalizeForMatching(conceptB.name);
  const aIdx = sNorm.indexOf(aNorm);
  const bIdx = sNorm.indexOf(bNorm);
  if (aIdx >= 0 && bIdx >= 0) {
    if (Math.abs(aIdx - bIdx) > 130) {
      return null;
    }
    // Disallow bridging across strong punctuation boundaries (; or :)
    const minIdx = Math.min(aIdx, bIdx);
    const maxIdx = Math.max(aIdx, bIdx);
    const intermediate = sentence.slice(minIdx, maxIdx);
    if (/[;:]/.test(intermediate)) {
      return null;
    }
  }

  let cleanDescription = sentence
    .replace(/\[\d+(?:[,\s–-]+\d+)*\]/g, '')
    .replace(/\([A-Z][A-Za-z\s.,]+(?:et\s+al\.)?,\s*\d{4}[a-z]?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleanDescription.length > 165) {
    cleanDescription = `${cleanDescription.substring(0, 162).replace(/\s+\S*$/, '')}...`;
  }

  // Helper to build a validated relationship object
  const buildRel = (
    src: CanonicalConcept, 
    tgt: CanonicalConcept, 
    type: SemanticRelationType, 
    confidence = 0.92
  ): KnowledgeRelationship => ({
    id: `rel-${src.id}-${type}-${tgt.id}`,
    source: src.id,
    target: tgt.id,
    type,
    label: humanizeRelationLabel(type),
    description: cleanDescription,
    sourceChunkIds: [chunkId],
    sourceIds: sourceId ? [sourceId] : [],
    confidence,
    evidence: sentence.trim(),
    evidenceItems: [
      {
        sourceId: sourceId || '',
        chunkId,
        text: sentence.trim()
      }
    ]
  });

  const aPat = buildConceptRegexPattern(conceptA);
  const bPat = buildConceptRegexPattern(conceptB);

  // 1a. REDUCES (A reduces / mitigates B)
  // e.g. "Aging is a technique used to reduce starvation."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is an? )?(?:technique|mechanism|method|strategy)?\\s*used to reduce|reduce[s]?|minimizes the risk of|mitigate[s]?|prevent[s]?|alleviate[s]?)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'reduces', 0.96);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) (?:reduced|mitigated|prevented) by)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'reduces', 0.96);
  }

  // 1b. OPTIMIZES (A minimizes / maximizes / optimizes B)
  // e.g. "SJF can minimize average waiting time..."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:can minimize|minimize[s]?|maximize[s]?|optimize[s]?|improve[s]?|minimizes average|maximizes average|optimizes average)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'optimizes', 0.95);
  }

  // 1c. CAUSES (A causes / leads to B)
  // e.g. "A very small time quantum can cause frequent context switches."
  // e.g. "The algorithm may cause starvation..."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:can cause|cause[s]?|may cause|lead[s]? to|result[s]? in|trigger[s]?)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'causes', 0.94);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) caused by)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'causes', 0.94);
  }

  // 1d. MEASURED-BY (A is evaluated/compared/measured by criterion B)
  // e.g. "Scheduling policies can be compared using waiting time, turnaround time, response time, throughput, and CPU utilization."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,100}\\b(?:can be (?:compared|evaluated|measured|assessed) using|(?:is|are) (?:compared|evaluated|measured|assessed) (?:using|by)|measured by|evaluated by|monitored by)\\b[\\s\\w,]{0,100}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'measured-by', 0.93);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,100}\\b(?:can be (?:compared|evaluated|measured|assessed) using|(?:is|are) (?:compared|evaluated|measured|assessed) (?:using|by)|measured by|evaluated by|monitored by)\\b[\\s\\w,]{0,100}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptB, conceptA, 'measured-by', 0.93);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,50}\\b(?:(?:is|are) (?:a |an )?(?:scheduling criterion|criterion for|metric for|performance measure for)|affect[s]? (?:responsiveness,|the )?)\\b[\\s\\w,]{0,50}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptB, conceptA, 'measured-by', 0.93);
  }

  // 1e. TYPE-OF (A is a type/form/variant of B)
  // e.g. "Shortest Remaining Time First is the preemptive form of Shortest Job First."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) (?:the |a )?(?:preemptive |non-preemptive )?(?:form|type|kind|variant|algorithm|policy|class) of)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'type-of', 0.95);
  }

  // 1f. TYPE-OF: Algorithm to CPU Scheduling
  // e.g. "how scheduling algorithms can produce different execution orders. For FCFS..."
  // e.g. "First-Come, First-Served scheduling assigns the CPU to processes..."
  // e.g. "Round Robin scheduling is designed for time-sharing systems."
  if (conceptB.id === 'concept-cpu-scheduling' || conceptB.name.toLowerCase() === 'cpu scheduling') {
    if (
      new RegExp(`\\b(?:scheduling (?:algorithm|policy|policies)|CPU scheduling)\\b[\\s\\w,]{0,60}\\b(?:for|including|such as|namely)\\s+${aPat}\\b`, 'i').test(sNorm) ||
      new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,35}\\b(?:is a|is an)?\\s*(?:scheduling (?:algorithm|policy)|CPU scheduling)\\b`, 'i').test(sNorm)
    ) {
      return buildRel(conceptA, conceptB, 'type-of', 0.94);
    }
  }

  // 1. EXTENDS (A extends B)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:adds preemption to|extend[s]?|expand[s]? upon|build[s]? upon|enhance[s]?|variant of|generalization of|specialization of|extension of|improve[s]? upon)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'extends', 0.95);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) (?:extended|expanded|generalized) by)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'extends', 0.95);
  }

  // 2. PART-OF (A is part of B / B consists of A)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) )?(?:an? )?(?:[\\w]+\\s+)?(?:component|part|layer|module|subnetwork|constituent|submodule|block|mechanism|unit) (?:of|in)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'part-of', 0.95);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:consist[s]? of|contain[s]?|comprise[s]?|(?:is|are) composed of|incorporate[s]? as a component)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'part-of', 0.95);
  }

  // 3. FOUNDATION-FOR (A foundation for B / B based on A)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:enable[s]?|underpin[s]?|power[s]?|(?:is|are) foundational to|(?:is|are) (?:the|a) foundation of|serve[s]? as (?:the|a) (?:basis|foundation) for|provide[s]? (?:the|a) (?:basis|foundation) for|form[s]? (?:the|a) (?:basis|foundation) of|underlie[s]?)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'foundation-for', 0.94);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) (?:based|built|founded|powered)(?:\\s+\\w+)?\\s+on)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'foundation-for', 0.94);
  }

  // 4. DEPENDS-ON (A depends on B / B is prerequisite for A)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:depend[s]? on|rel(?:y|ies) on|require[s]?|necessitate[s]?|(?:is|are) dependent on|(?:has|have) a prerequisite of)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'depends-on', 0.93);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) (?:required|essential|necessary|a prerequisite) for)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'depends-on', 0.93);
  }

  // 5. APPLIED-TO (A applied to B / A evaluated on B)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,50}\\b(?:applied to|used (?:for|in)|benchmarked on|evaluated on|trained on|tested on|deployed in|adapted for|across [\\w\\s]+ tasks of|in tasks of)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'applied-to', 0.93);
  }

  // 6. USES (A uses B / A utilizes B)
  if ((conceptA.name.toLowerCase().includes('round robin') && conceptB.name.toLowerCase().includes('time quantum')) ||
      (conceptB.name.toLowerCase().includes('round robin') && conceptA.name.toLowerCase().includes('time quantum'))) {
    const rr = conceptA.name.toLowerCase().includes('round robin') ? conceptA : conceptB;
    const tq = conceptA.name.toLowerCase().includes('round robin') ? conceptB : conceptA;
    if (new RegExp(`(?:\\b(?:quantum|time quantum)\\b[\\s\\w,]{0,60}\\b(?:round robin)\\b|\\b(?:round robin)\\b[\\s\\w,]{0,60}\\b(?:quantum|time quantum)\\b)`, 'i').test(sNorm)) {
      return buildRel(rr, tq, 'uses', 0.94);
    }
  }

  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:use[s]?|utilize[s]?|employ[s]?|incorporate[s]?|leverage[s]?|appl(?:y|ies)|computes using|rel(?:y|ies) on the mechanism of|adopt[s]?|receives a fixed)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'uses', 0.91);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:(?:is|are) )?(?:used by|allocated to)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'uses', 0.91);
  }

  // 7. INSTANCE-OF (A is an instance/example of B)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,30}\\b(?:(?:is|are) (?:an? )?(?:instance|example|type|kind|category|variety|form) of)\\b[\\s\\w,]{0,30}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'instance-of', 0.92);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,30}\\b(?:such as|for example|including|namely)\\b[\\s\\w,]{0,30}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'instance-of', 0.92);
  }

  // 7b. INSTANCE-OF / SUBTYPE: A <GeneralConcept> ... is called a <SpecificConcept>
  // e.g. "A spherical mirror whose reflecting surface is curved inwards... is called a concave mirror."
  // e.g. "A spherical mirror whose reflecting surface is curved outwards is called a convex mirror."
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,120}\\b(?:(?:is|are) (?:called|termed|known as))\\s+(?:an?|the)?\\s*${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptB, conceptA, 'instance-of', 0.95);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,120}\\b(?:(?:is|are) (?:called|termed|known as))\\s+(?:an?|the)?\\s*${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'instance-of', 0.95);
  }

  // 8. PART-OF (Constituent attribute or structural component)
  // Requires explicit partitive phrases: "consists of", "is composed of", "component of", "constituent of", "part of"
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,30}\\b(?:consist[s]? of|(?:is|are) composed of|comprise[s]?|(?:is|are) made up of)\\b[\\s\\w,]{0,30}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'part-of', 0.94);
  }
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,30}\\b(?:(?:is|are) (?:a |an )?(?:component|constituent|part|element|subsystem|feature) of|forms? (?:a |an )?part of)\\b[\\s\\w,]{0,30}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'part-of', 0.94);
  }
  // Optical / physics specific constituent attribute: e.g. "focal length of a spherical mirror", "centre of curvature of a spherical mirror"
  if (new RegExp(`\\b(?:focal length|radius of curvature|centre of curvature|pole|principal axis|aperture)\\b[\\s\\w,]{0,15}\\b(?:of (?:a|the|this)?|in (?:a|the|this)?)\\b[\\s\\w,]{0,15}\\b${bPat}\\b`, 'i').test(sNorm) &&
      new RegExp(`\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'part-of', 0.92);
  }

  // 8b. PART-OF (ACID constituents / named principle composition)
  // e.g. "ACID properties ensure reliable transaction processing" and Atomicity/Consistency/Isolation/Durability
  const isAcidA = /\bacid\b/i.test(conceptA.name);
  const isAcidB = /\bacid\b/i.test(conceptB.name);
  const acidParts = new Set(['atomicity', 'consistency', 'isolation', 'durability']);
  if (isAcidA && acidParts.has(conceptB.name.toLowerCase())) {
    return buildRel(conceptB, conceptA, 'part-of', 0.96);
  }
  if (isAcidB && acidParts.has(conceptA.name.toLowerCase())) {
    return buildRel(conceptA, conceptB, 'part-of', 0.96);
  }

  // 9. DEPENDS-ON / FORMULA GOVERNANCE
  if (new RegExp(`\\b(?:relationship between|relates|relate|equation for|formula for)\\b[\\s\\w,]{0,40}\\b${aPat}\\b[\\s\\w,]{0,40}\\b(?:and|to|with)?\\s*${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'depends-on', 0.90);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,35}\\b(?:governs|describes|computes|determines|expresses|relates)\\b[\\s\\w,]{0,35}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'depends-on', 0.90);
  }

  // 9b. GOVERNANCE / GUARANTEES: A ensures/governs/controls B
  // e.g. "ACID properties ensure reliable transaction processing"
  // e.g. "Atomicity ensures that a transaction is treated as a single unit"
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,45}\\b(?:ensure[s]?|preserves?|controls?|governs?|guarantee[s]?)\\b[\\s\\w,]{0,45}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'enables', 0.92);
  }
  if (new RegExp(`\\b${bPat}\\b[\\s\\w,]{0,45}\\b(?:ensure[s]?|preserves?|controls?|governs?|guarantee[s]?)\\b[\\s\\w,]{0,45}\\b${aPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptB, conceptA, 'enables', 0.92);
  }

  // 10. RELATED-TO (Conservative clause-level association)
  if (new RegExp(`\\b${aPat}\\b[\\s\\w,]{0,30}\\b(?:(?:is|are) (?:closely )?related to|associated with|operates? in conjunction with|connects to|pertains to)\\b[\\s\\w,]{0,30}\\b${bPat}\\b`, 'i').test(sNorm)) {
    return buildRel(conceptA, conceptB, 'related-to', 0.85);
  }

  return null;
}

// -------------------------------------------------------------------------
// 2. DEDUPLICATION & MERGING ENGINE
// -------------------------------------------------------------------------

/**
 * Merges duplicate relationships that connect the same source and target.
 * Resolves parallel edges by prioritizing higher specificity semantic types over generic 'related-to'.
 * Preserves all supporting source chunk references (sourceChunkIds) and document IDs (sourceIds).
 */
export function deduplicateRelationships(relationships: KnowledgeRelationship[]): KnowledgeRelationship[] {
  const pairMap = new Map<string, KnowledgeRelationship>();

  for (const rel of relationships) {
    if (!rel.source || !rel.target || !rel.type) continue;
    // Disallow self-loops
    if (rel.source === rel.target) continue;

    // Use unordered pair key to resolve competing or reciprocal edges between the same 2 concepts
    const pairKey = [rel.source, rel.target].sort().join('<->');
    const existing = pairMap.get(pairKey);

    if (!existing) {
      pairMap.set(pairKey, {
        id: rel.id || `rel-${rel.source}-${rel.type}-${rel.target}`,
        source: rel.source,
        target: rel.target,
        type: rel.type,
        label: rel.label || rel.type,
        description: rel.description?.trim() || '',
        sourceChunkIds: [...(rel.sourceChunkIds || [])],
        sourceIds: [...(rel.sourceIds || [])],
        confidence: rel.confidence || 0.90,
        evidence: rel.evidence,
        evidenceItems: rel.evidenceItems ? [...rel.evidenceItems] : []
      });
    } else {
      // Merge sourceChunkIds
      for (const cId of rel.sourceChunkIds || []) {
        if (!existing.sourceChunkIds.includes(cId)) {
          existing.sourceChunkIds.push(cId);
        }
      }

      // Merge sourceIds
      for (const sId of rel.sourceIds || []) {
        if (!existing.sourceIds) existing.sourceIds = [];
        if (!existing.sourceIds.includes(sId)) {
          existing.sourceIds.push(sId);
        }
      }

      // Merge evidence items
      if (rel.evidenceItems) {
        if (!existing.evidenceItems) existing.evidenceItems = [];
        for (const item of rel.evidenceItems) {
          if (!existing.evidenceItems.some(e => e.chunkId === item.chunkId && e.text === item.text)) {
            existing.evidenceItems.push(item);
          }
        }
      }
      if (!existing.evidence && rel.evidence) {
        existing.evidence = rel.evidence;
      }

      const existingRank = RELATION_SPECIFICITY_RANK[existing.type] || 2;
      const currentRank = RELATION_SPECIFICITY_RANK[rel.type] || 2;

      // Upgrade relation if the current one has higher semantic specificity or confidence
      if (currentRank > existingRank || (currentRank === existingRank && (rel.confidence || 0) > (existing.confidence || 0))) {
        existing.source = rel.source;
        existing.target = rel.target;
        existing.type = rel.type;
        existing.label = humanizeRelationLabel(rel.label || rel.type);
        existing.id = `rel-${rel.source}-${rel.type}-${rel.target}`;
        if (rel.description) existing.description = rel.description.trim();
      } else if ((rel.description || '').length > (existing.description || '').length && currentRank === existingRank) {
        existing.description = rel.description?.trim() || existing.description;
      }

      existing.confidence = Math.min(0.99, Math.max(existing.confidence || 0.90, rel.confidence || 0.90) + 0.02);
    }
  }

  return Array.from(pairMap.values());
}

// -------------------------------------------------------------------------
// 3. BUILT-IN PROVIDERS: HEURISTIC & LLM
// -------------------------------------------------------------------------

/**
 * Built-in Heuristic Relationship Extractor
 * High-precision syntactic/semantic pattern engine with zero external dependencies.
 */
export class HeuristicRelationshipExtractor implements RelationshipExtractionProvider {
  name = 'heuristic';

  async extractRelationships(concepts: CanonicalConcept[], chunk: TextChunk): Promise<KnowledgeRelationship[]> {
    if (!concepts || concepts.length < 2 || !chunk.text) {
      return [];
    }

    const paragraphs = chunk.text.split(/\n\s*\n+/);
    const sentences: string[] = [];
    for (const p of paragraphs) {
      const singleLine = p.replace(/\n+/g, ' ').trim();
      for (const sent of singleLine.split(/(?<=[.!?])\s+/)) {
        const s = sent.trim();
        if (s.length > 15) {
          sentences.push(s);
        }
      }
    }

    const extracted: KnowledgeRelationship[] = [];

    for (const sentence of sentences) {
      // Only examine concept pairs that both match this sentence
      const presentConcepts = concepts.filter(c => conceptMatchesSentence(c, normalizeForMatching(sentence)));
      if (presentConcepts.length < 2) continue;

      for (let i = 0; i < presentConcepts.length; i++) {
        for (let j = 0; j < presentConcepts.length; j++) {
          if (i === j) continue;
          const conceptA = presentConcepts[i];
          const conceptB = presentConcepts[j];

          const relation = findSemanticRelation(sentence, conceptA, conceptB, chunk.chunkId, chunk.sourceId);
          if (relation) {
            extracted.push(relation);
          }
        }
      }
    }

    return extracted;
  }
}

/**
 * Pluggable LLM Relationship Extractor
 * Extracts semantic relationships from chunks using structured JSON schema.
 * Falls back to HeuristicRelationshipExtractor if unavailable or unconfigured.
 */
export class LLMRelationshipExtractor implements RelationshipExtractionProvider {
  name = 'llm';
  private fallbackProvider = new HeuristicRelationshipExtractor();
  private options: {
    apiKey?: string;
    endpoint?: string;
    modelName?: string;
  };

  constructor(
    options: {
      apiKey?: string;
      endpoint?: string;
      modelName?: string;
    } = {}
  ) {
    this.options = options;
  }

  async extractRelationships(concepts: CanonicalConcept[], chunk: TextChunk): Promise<KnowledgeRelationship[]> {
    const apiKey = this.options.apiKey || getGeminiApiKey();

    if (!apiKey && !this.options.endpoint) {
      return this.fallbackProvider.extractRelationships(concepts, chunk);
    }

    const conceptListStr = concepts.map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const systemPrompt = `You are a semantic relationship extractor for a knowledge graph.
Given a list of identified concepts and a text chunk, extract only semantic relationships directly established by the source text.
Do NOT connect every concept to every other concept. Only extract pairs with clear semantic evidence.

Permitted relationship types (controlled vocabulary only):
'related-to' | 'part-of' | 'foundation-for' | 'depends-on' | 'extends' | 'uses' | 'applied-to' | 'instance-of'

Return a structured JSON array of relationship objects:
[
  {
    "source": "<source concept id>",
    "target": "<target concept id>",
    "type": "<one of permitted types>",
    "description": "<exact 1-sentence quote or short explanation from text>"
  }
]`;

    try {
      const endpoint = this.options.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${this.options.modelName || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nCONCEPTS:\n${conceptListStr}\n\nTEXT CHUNK:\n${chunk.text}`
            }]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        return this.fallbackProvider.extractRelationships(concepts, chunk);
      }

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        return this.fallbackProvider.extractRelationships(concepts, chunk);
      }

      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return this.fallbackProvider.extractRelationships(concepts, chunk);
      }

      const validConceptsById = new Set(concepts.map(c => c.id));
      const validTypes = new Set([
        'related-to', 'part-of', 'foundation-for', 'depends-on', 'extends', 'uses', 'applied-to', 'instance-of'
      ]);

      const validRels: KnowledgeRelationship[] = [];
      for (const item of parsed) {
        if (
          item.source && item.target && item.type &&
          item.source !== item.target &&
          validConceptsById.has(item.source) &&
          validConceptsById.has(item.target) &&
          validTypes.has(item.type)
        ) {
          validRels.push({
            id: `rel-${item.source}-${item.type}-${item.target}`,
            source: item.source,
            target: item.target,
            type: item.type as SemanticRelationType,
            description: item.description?.trim() || '',
            sourceChunkIds: [chunk.chunkId],
            sourceIds: chunk.sourceId ? [chunk.sourceId] : [],
            confidence: 0.95
          });
        }
      }

      return validRels.length > 0 ? validRels : this.fallbackProvider.extractRelationships(concepts, chunk);
    } catch {
      return this.fallbackProvider.extractRelationships(concepts, chunk);
    }
  }
}

// -------------------------------------------------------------------------
// 4. SERVICE REGISTRY & MASTER PIPELINE ENTRY POINTS
// -------------------------------------------------------------------------

export class RelationshipExtractionService {
  private providers = new Map<string, RelationshipExtractionProvider>();
  private defaultProviderName = 'heuristic';

  constructor() {
    this.registerProvider(new HeuristicRelationshipExtractor());
    this.registerProvider(new LLMRelationshipExtractor());
  }

  registerProvider(provider: RelationshipExtractionProvider) {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string) {
    if (this.providers.has(name)) {
      this.defaultProviderName = name;
    }
  }

  getProvider(name?: string): RelationshipExtractionProvider {
    const key = getGeminiApiKey();
    const targetName = name || (key ? 'llm' : this.defaultProviderName);
    return this.providers.get(targetName) || this.providers.get('heuristic')!;
  }

  async extractFromChunks(
    concepts: CanonicalConcept[],
    chunks: TextChunk[],
    options: RelationshipExtractionOptions = {}
  ): Promise<KnowledgeRelationship[]> {
    if (!concepts || concepts.length < 2 || !chunks || chunks.length === 0) {
      return [];
    }

    const provider = this.getProvider(options.provider);
    const allRelationships: KnowledgeRelationship[] = [];

    for (const chunk of chunks) {
      try {
        const chunkRels = await provider.extractRelationships(concepts, chunk);
        allRelationships.push(...chunkRels);
      } catch {
        // Continue extracting from remaining chunks
      }
    }

    return deduplicateRelationships(allRelationships);
  }
}

// Global default service instance
export const relationshipExtractionService = new RelationshipExtractionService();

/**
 * Convenience function: extract semantic relationships directly from canonical concepts and text chunks.
 */
export async function extractRelationshipsFromChunks(
  concepts: CanonicalConcept[],
  chunks: TextChunk[],
  options: RelationshipExtractionOptions = {}
): Promise<KnowledgeRelationship[]> {
  return relationshipExtractionService.extractFromChunks(concepts, chunks, options);
}

/**
 * Structured Relationship Extraction Result wrapper.
 */
export async function extractRelationships(
  concepts: CanonicalConcept[],
  chunks: TextChunk[],
  options: RelationshipExtractionOptions = {}
): Promise<RelationshipExtractionResult> {
  try {
    const relationships = await extractRelationshipsFromChunks(concepts, chunks, options);
    return {
      success: true,
      relationships,
      conceptCount: concepts.length,
      sourceChunkCount: chunks.length
    };
  } catch (err: unknown) {
    return {
      success: false,
      relationships: [],
      conceptCount: concepts.length,
      sourceChunkCount: chunks.length,
      error: err instanceof Error ? err.message : 'Relationship extraction failed.'
    };
  }
}

/**
 * Assembles a complete, commit-ready KnowledgeGraph from sources, canonical concepts, and relationships.
 * Converts CanonicalConcepts to KnowledgeNodes while arranging positions harmoniously.
 */
export function assembleKnowledgeGraph(
  sources: KnowledgeSource[],
  concepts: CanonicalConcept[],
  relationships: KnowledgeRelationship[]
): KnowledgeGraph {
  const cleanRelationships = deduplicateRelationships(relationships);

  const nodes: KnowledgeNode[] = concepts.map((c, index) => {
    // Distribute nodes in a clean circular / organic layout for initial rendering
    const angle = (2 * Math.PI * index) / Math.max(1, concepts.length);
    const radius = 250 + (index % 3) * 60;
    const x = Math.round(400 + radius * Math.cos(angle));
    const y = Math.round(300 + radius * Math.sin(angle));

    return {
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      sourceIds: c.sourceIds || [],
      position: { x, y },
      confidence: c.confidence
    };
  });

  return {
    nodes,
    relationships: cleanRelationships,
    sources
  };
}

/**
 * Master Pipeline Integration:
 * CONCEPTS + SOURCE TEXT (Chunks) → RELATIONSHIPS → KNOWLEDGE GRAPH
 */
export async function buildKnowledgeGraphFromConceptsAndChunks(
  sources: KnowledgeSource[],
  concepts: CanonicalConcept[],
  chunks: TextChunk[],
  options: RelationshipExtractionOptions = {}
): Promise<KnowledgeGraph> {
  const relationships = await extractRelationshipsFromChunks(concepts, chunks, options);
  return assembleKnowledgeGraph(sources, concepts, relationships);
}

