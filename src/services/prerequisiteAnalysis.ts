/**
 * Prerequisite-Aware Learning Service
 * GraphMind Phase 4 — Prompt 17
 * 
 * Analyzes GraphMind knowledge graphs to identify relevant foundational and
 * prerequisite concepts for a target concept, combining topological relationships
 * with actual student assessment and mastery evidence.
 * 
 * Deterministic Rules:
 * 1. Prioritize explicit prerequisites (node.prerequisites, 'depends-on', 'foundation-for', 'prerequisite').
 * 2. Identify source-supported foundational concepts (node.type === 'foundation').
 * 3. General graph edges are labeled strictly as "Related Concept in Graph" (never false prerequisites).
 * 4. Combine with actual learning evidence (needs-review, observed-difficulty, not-assessed, demonstrated).
 * 5. Do not invent prerequisites or edges. Omit sections cleanly when no data exists.
 */

import type { KnowledgeGraph, KnowledgeNode } from '../types/knowledgeGraph';
import type { RevisionSessionState } from '../types/practice';
import type {
  ConceptFoundationsReport,
  FoundationalConceptRecommendation,
  PrerequisiteCategory,
  PrerequisiteEvidenceStatus
} from '../types/prerequisites';
import { loadStoredKnowledgeCheck } from './knowledgeCheck';
import { getAssessmentAttempts } from './assessmentHistory';
import { calculateConceptMastery, loadStoredMastery } from './conceptMastery';
import { loadConceptPracticeStates } from './storage';

export interface AnalyzeFoundationsParams {
  graph: KnowledgeGraph;
  conceptId: string;
  activeSession?: RevisionSessionState | null;
  forceRefresh?: boolean;
}

// In-memory cache for prerequisite reports
const foundationsCache = new Map<string, { report: ConceptFoundationsReport; cachedAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Invalidate cached foundation reports for a graph or all graphs.
 */
export function invalidatePrerequisiteCache(graphId?: string): void {
  if (!graphId) {
    foundationsCache.clear();
    return;
  }
  for (const key of foundationsCache.keys()) {
    if (key.startsWith(`${graphId}:`)) {
      foundationsCache.delete(key);
    }
  }
}

interface RawCandidate {
  node: KnowledgeNode;
  category: PrerequisiteCategory;
  prerequisiteCategory: PrerequisiteCategory;
  categoryLabel: string;
  provenance: 'explicit-node-prerequisite' | 'graph-relationship-edge' | 'source-foundation-node';
  relationshipType?: string;
  relationshipDescription?: string;
  direction: 'incoming' | 'outgoing';
}

/**
 * Extracts and classifies candidate foundational and related concepts for a given node.
 */
function extractCandidateFoundations(
  graph: KnowledgeGraph,
  targetNode: KnowledgeNode
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const seenIds = new Set<string>();
  seenIds.add(targetNode.id);

  const nodeMap = new Map<string, KnowledgeNode>();
  (graph.nodes || []).forEach(n => {
    if (n && n.id) {
      nodeMap.set(n.id, n);
      nodeMap.set(n.name.toLowerCase(), n);
    }
  });

  // 1. Explicit prerequisites on the node itself (node.prerequisites)
  if (Array.isArray(targetNode.prerequisites)) {
    for (const prereqRef of targetNode.prerequisites) {
      if (!prereqRef || typeof prereqRef !== 'string') continue;
      const matchedNode = nodeMap.get(prereqRef) || nodeMap.get(prereqRef.toLowerCase());
      if (matchedNode && !seenIds.has(matchedNode.id)) {
        seenIds.add(matchedNode.id);
        candidates.push({
          node: matchedNode,
          category: 'confirmed-prerequisite',
          prerequisiteCategory: 'confirmed-prerequisite',
          categoryLabel: 'Confirmed Prerequisite',
          provenance: 'explicit-node-prerequisite',
          relationshipType: 'prerequisite',
          relationshipDescription: `Explicit prerequisite for ${targetNode.name}`,
          direction: 'incoming'
        });
      }
    }
  }

  // 2. Explicit graph relationships and edges
  const allEdges: any[] = [
    ...(Array.isArray(graph.relationships) ? graph.relationships : []),
    ...(Array.isArray((graph as any).edges) ? (graph as any).edges : [])
  ];

  for (const rel of allEdges) {
    if (!rel) continue;
    const sourceId = rel.source || rel.from;
    const targetId = rel.target || rel.to;
    if (!sourceId || !targetId) continue;

    const relType = ((rel.type || rel.label || '') as string).toLowerCase();
    const relDesc = rel.description || rel.evidence;

    // Case A: rel.target === targetNode.id (Incoming connection to target)
    if (targetId === targetNode.id) {
      const sourceNode = nodeMap.get(sourceId);
      if (sourceNode && !seenIds.has(sourceNode.id)) {
        seenIds.add(sourceNode.id);

        const isConfirmedPrereq =
          relType === 'foundation-for' ||
          relType === 'prerequisite' ||
          relType === 'depends-on';

        const isSourceFoundation =
          !isConfirmedPrereq && (sourceNode.type === 'foundation' || (sourceNode as any).category === 'Foundation');

        let category: PrerequisiteCategory = 'related-concept';
        let categoryLabel = 'Related Concept in Graph';
        let provenance: RawCandidate['provenance'] = 'graph-relationship-edge';

        if (isConfirmedPrereq) {
          category = 'confirmed-prerequisite';
          categoryLabel = 'Confirmed Prerequisite';
          provenance = 'graph-relationship-edge';
        } else if (isSourceFoundation) {
          category = 'source-foundation';
          categoryLabel = 'Source-Supported Foundation';
          provenance = 'source-foundation-node';
        }

        candidates.push({
          node: sourceNode,
          category,
          prerequisiteCategory: category,
          categoryLabel,
          provenance,
          relationshipType: rel.type || rel.label,
          relationshipDescription: relDesc,
          direction: 'incoming'
        });
      }
    }

    // Case B: rel.source === targetNode.id (Outgoing connection from target)
    if (sourceId === targetNode.id) {
      const targetOtherNode = nodeMap.get(targetId);
      if (targetOtherNode && !seenIds.has(targetOtherNode.id)) {
        seenIds.add(targetOtherNode.id);

        const isConfirmedPrereq = relType === 'depends-on' || relType === 'prerequisite';

        const isSourceFoundation =
          !isConfirmedPrereq && (targetOtherNode.type === 'foundation' || (targetOtherNode as any).category === 'Foundation');

        let category: PrerequisiteCategory = 'related-concept';
        let categoryLabel = 'Related Concept in Graph';
        let provenance: RawCandidate['provenance'] = 'graph-relationship-edge';

        if (isConfirmedPrereq) {
          category = 'confirmed-prerequisite';
          categoryLabel = 'Confirmed Prerequisite';
          provenance = 'graph-relationship-edge';
        } else if (isSourceFoundation) {
          category = 'source-foundation';
          categoryLabel = 'Source-Supported Foundation';
          provenance = 'source-foundation-node';
        }

        candidates.push({
          node: targetOtherNode,
          category,
          prerequisiteCategory: category,
          categoryLabel,
          provenance,
          relationshipType: rel.type || rel.label,
          relationshipDescription: relDesc,
          direction: 'outgoing'
        });
      }
    }
  }

  // 3. Node-embedded relationships
  if (Array.isArray((targetNode as any).relationships)) {
    for (const rel of (targetNode as any).relationships) {
      if (!rel) continue;
      const otherId = rel.targetId || rel.target || rel.conceptId || rel.id;
      if (!otherId || seenIds.has(otherId)) continue;

      const otherNode = nodeMap.get(otherId);
      if (otherNode) {
        seenIds.add(otherNode.id);
        const relType = ((rel.type || rel.label || '') as string).toLowerCase();
        const isConfirmedPrereq = relType === 'foundation-for' || relType === 'prerequisite' || relType === 'depends-on';
        const isSourceFoundation = !isConfirmedPrereq && (otherNode.type === 'foundation' || (otherNode as any).category === 'Foundation');

        let category: PrerequisiteCategory = 'related-concept';
        let categoryLabel = 'Related Concept in Graph';
        let provenance: RawCandidate['provenance'] = 'graph-relationship-edge';

        if (isConfirmedPrereq) {
          category = 'confirmed-prerequisite';
          categoryLabel = 'Confirmed Prerequisite';
        } else if (isSourceFoundation) {
          category = 'source-foundation';
          categoryLabel = 'Source-Supported Foundation';
          provenance = 'source-foundation-node';
        }

        candidates.push({
          node: otherNode,
          category,
          prerequisiteCategory: category,
          categoryLabel,
          provenance,
          relationshipType: rel.type || rel.label,
          relationshipDescription: rel.description,
          direction: 'outgoing'
        });
      }
    }
  }

  return candidates;
}

/**
 * Evaluates student assessment evidence for a specific concept node.
 */
function evaluateNodeEvidence(
  graphId: string,
  concept: KnowledgeNode
): {
  status: PrerequisiteEvidenceStatus;
  statusLabel: string;
  totalAnswered: number;
  totalIncorrect: number;
  consecutiveIncorrect: number;
  mastery: any;
} {
  const storedMastery = loadStoredMastery(graphId, concept.id);
  const kcState = loadStoredKnowledgeCheck(graphId, concept.id);
  const attempts = getAssessmentAttempts({ graphId });
  const practiceStates = loadConceptPracticeStates(graphId);

  // Formative attempts
  const rawAttempts = Array.isArray(kcState?.attempts)
    ? kcState.attempts
    : Object.values(kcState?.attempts || {});

  let formativeCorrect = 0;
  let formativeIncorrect = 0;
  let validFormativeCount = 0;

  for (const att of rawAttempts) {
    if (!att || typeof att !== 'object') continue;
    validFormativeCount++;
    const isCorrect = att.evaluation?.isCorrect !== undefined
      ? att.evaluation.isCorrect
      : att.isCorrect !== undefined
        ? att.isCorrect
        : (att.score && att.score > 0);

    if (isCorrect) {
      formativeCorrect++;
    } else {
      formativeIncorrect++;
    }
  }

  // Summative attempts
  let summativeCorrect = 0;
  let summativeIncorrect = 0;
  const summativeQuestions: Array<{ isCorrect: boolean }> = [];

  for (const att of attempts) {
    if (!att || !Array.isArray(att.questions) || !att.userAnswers) continue;
    for (const q of att.questions) {
      if (!Array.isArray(q.conceptIds) || !q.conceptIds.includes(concept.id)) continue;
      const selected = att.userAnswers[q.id];
      if (!selected) continue;

      const isCorrect = selected === q.correctOptionId;
      summativeQuestions.push({ isCorrect });
      if (isCorrect) {
        summativeCorrect++;
      } else {
        summativeIncorrect++;
      }
    }
  }

  const totalAnswered = validFormativeCount + summativeQuestions.length;
  const totalCorrect = formativeCorrect + summativeCorrect;
  const totalIncorrect = formativeIncorrect + summativeIncorrect;

  // Calculate consecutive incorrect
  let consecutiveIncorrect = 0;
  for (let i = summativeQuestions.length - 1; i >= 0; i--) {
    if (!summativeQuestions[i].isCorrect) {
      consecutiveIncorrect++;
    } else {
      break;
    }
  }

  // Calculate concept mastery
  const calculatedMastery = calculateConceptMastery({
    graphId,
    conceptId: concept.id,
    conceptName: concept.name,
    knowledgeCheckState: kcState,
    practiceState: practiceStates[concept.id]
  });

  const effectiveMastery = storedMastery || calculatedMastery;

  // Determine evidence status
  if (totalAnswered === 0 && !storedMastery) {
    if (practiceStates[concept.id]?.status === 'needs-review') {
      return {
        status: 'needs-review',
        statusLabel: 'Needs review',
        totalAnswered: 0,
        totalIncorrect: 0,
        consecutiveIncorrect: 0,
        mastery: effectiveMastery
      };
    }
    return {
      status: 'not-assessed',
      statusLabel: 'Not assessed yet',
      totalAnswered: 0,
      totalIncorrect: 0,
      consecutiveIncorrect: 0,
      mastery: effectiveMastery
    };
  }

  // Demonstrated condition
  if (
    effectiveMastery.status === 'understanding-demonstrated' ||
    (totalCorrect >= 1 && totalIncorrect === 0)
  ) {
    return {
      status: 'demonstrated',
      statusLabel: 'Demonstrated understanding',
      totalAnswered,
      totalIncorrect,
      consecutiveIncorrect,
      mastery: effectiveMastery
    };
  }

  // Needs review condition (2+ errors or consecutive errors or explicit flag)
  if (
    consecutiveIncorrect >= 2 ||
    totalIncorrect >= 2 ||
    practiceStates[concept.id]?.status === 'needs-review'
  ) {
    return {
      status: 'needs-review',
      statusLabel: 'Needs review',
      totalAnswered,
      totalIncorrect,
      consecutiveIncorrect,
      mastery: effectiveMastery
    };
  }

  // Single error: observed-difficulty
  if (totalIncorrect === 1) {
    return {
      status: 'observed-difficulty',
      statusLabel: 'Difficulty observed',
      totalAnswered,
      totalIncorrect,
      consecutiveIncorrect,
      mastery: effectiveMastery
    };
  }

  if (effectiveMastery.status === 'needs-review') {
    return {
      status: 'needs-review',
      statusLabel: 'Needs review',
      totalAnswered,
      totalIncorrect,
      consecutiveIncorrect,
      mastery: effectiveMastery
    };
  }

  return {
    status: 'not-assessed',
    statusLabel: 'Not assessed yet',
    totalAnswered,
    totalIncorrect,
    consecutiveIncorrect,
    mastery: effectiveMastery
  };
}

/**
 * Generates an objective, observation-based explanation of why reviewing
 * a foundation helps with understanding the target concept.
 */
function buildWhyItHelpsText(
  prereqCategory: PrerequisiteCategory,
  evidenceStatus: PrerequisiteEvidenceStatus,
  targetConceptName: string,
  _candidateNode: KnowledgeNode,
  relationshipDescription?: string
): string {
  if (evidenceStatus === 'needs-review') {
    if (prereqCategory === 'confirmed-prerequisite') {
      return `You recently encountered difficulty with this prerequisite. Reviewing it first will help clarify ${targetConceptName}.`;
    }
    if (prereqCategory === 'source-foundation') {
      return `Difficulty was recorded on this foundational topic. Strengthening it will provide clearer context for ${targetConceptName}.`;
    }
    return `Directly related concept in the knowledge graph with recorded review recommended.`;
  }

  if (evidenceStatus === 'observed-difficulty') {
    if (prereqCategory === 'confirmed-prerequisite') {
      return `A recent error or difficulty was recorded on this explicit prerequisite. A brief review will reinforce the foundation for ${targetConceptName}.`;
    }
    if (prereqCategory === 'source-foundation') {
      return `A recent error or difficulty was recorded on this foundational topic. A quick review may clarify ${targetConceptName}.`;
    }
    return `Directly related concept in the knowledge graph with observed difficulty.`;
  }

  if (relationshipDescription && relationshipDescription.trim().length > 0 && !relationshipDescription.startsWith('Explicit prerequisite')) {
    return relationshipDescription;
  }

  switch (prereqCategory) {
    case 'confirmed-prerequisite':
      if (evidenceStatus === 'not-assessed') {
        return `Explicit prerequisite that has not been assessed yet. Reviewing its key ideas will help build a strong foundation for ${targetConceptName}.`;
      }
      return `Confirmed prerequisite for ${targetConceptName}. Your understanding is currently solid.`;

    case 'source-foundation':
      if (evidenceStatus === 'not-assessed') {
        return `Source-supported foundational concept connected to ${targetConceptName}. Reviewing it can provide helpful preliminary context.`;
      }
      return `Source-supported foundational concept for ${targetConceptName}.`;

    case 'related-concept':
    default:
      if (evidenceStatus === 'not-assessed') {
        return `Directly related concept in the knowledge graph that has not been assessed yet.`;
      }
      return `Directly related concept connected in the knowledge graph.`;
  }
}

/**
 * Analyzes the knowledge graph and student learning records to produce
 * a prioritized, prerequisite-aware report for a specific concept.
 */
export function analyzeConceptFoundations({
  graph,
  conceptId,
  activeSession,
  forceRefresh = false
}: AnalyzeFoundationsParams): ConceptFoundationsReport {
  const safeGraphId = graph?.id || 'default_graph';
  const cacheKey = `${safeGraphId}:${conceptId}`;

  if (!forceRefresh) {
    const cached = foundationsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.report;
    }
  }

  const nodes = graph?.nodes || [];
  const targetNode = nodes.find(n => n && n.id === conceptId);

  // Fallback Rule: Missing concept, empty graph, or deleted concept
  if (!targetNode) {
    const emptyReport: ConceptFoundationsReport = {
      conceptId,
      conceptName: conceptId,
      hasFoundations: false,
      summaryText: 'No prerequisite or foundational relationships recorded for this concept.',
      items: [],
      confirmedPrerequisitesCount: 0,
      sourceFoundationsCount: 0,
      relatedConceptsCount: 0,
      reviewRecommendedCount: 0,
      unassessedCount: 0,
      demonstratedCount: 0
    };
    return emptyReport;
  }

  const rawCandidates = extractCandidateFoundations(graph, targetNode);

  if (rawCandidates.length === 0) {
    const emptyReport: ConceptFoundationsReport = {
      conceptId: targetNode.id,
      conceptName: targetNode.name,
      hasFoundations: false,
      summaryText: 'No prerequisite or foundational relationships recorded for this concept.',
      items: [],
      confirmedPrerequisitesCount: 0,
      sourceFoundationsCount: 0,
      relatedConceptsCount: 0,
      reviewRecommendedCount: 0,
      unassessedCount: 0,
      demonstratedCount: 0
    };
    foundationsCache.set(cacheKey, { report: emptyReport, cachedAt: Date.now() });
    return emptyReport;
  }

  // Evaluate student evidence for each candidate
  const sessionConceptIds = activeSession?.conceptIds || [];

  const items: FoundationalConceptRecommendation[] = rawCandidates.map(cand => {
    const evidence = evaluateNodeEvidence(safeGraphId, cand.node);
    const sessionIdx = sessionConceptIds.indexOf(cand.node.id);
    const isInSession = sessionIdx >= 0;

    const whyItHelps = buildWhyItHelpsText(
      cand.prerequisiteCategory,
      evidence.status,
      targetNode.name,
      cand.node,
      cand.relationshipDescription
    );

    return {
      conceptId: cand.node.id,
      conceptName: cand.node.name,
      category: cand.category,
      description: cand.node.description,
      prerequisiteCategory: cand.prerequisiteCategory,
      categoryLabel: cand.categoryLabel,
      provenance: cand.provenance,
      relationshipType: cand.relationshipType,
      relationshipDescription: cand.relationshipDescription,
      direction: cand.direction,
      evidenceStatus: evidence.status,
      evidenceStatusLabel: evidence.statusLabel,
      whyItHelps,
      isInCurrentSession: isInSession,
      sessionIndex: isInSession ? sessionIdx : undefined,
      masteryState: evidence.mastery
    };
  });

  // Prioritization score:
  // 1. Confirmed prerequisites that need review (priority 100)
  // 2. Confirmed prerequisites with observed difficulty (priority 95)
  // 3. Confirmed prerequisites unassessed (priority 90)
  // 4. Source-supported foundations needing review (priority 80)
  // 5. Confirmed prerequisites demonstrated (priority 70)
  // 6. Source-supported foundations unassessed (priority 60)
  // 7. Source-supported foundations demonstrated (priority 50)
  // 8. Related concepts needing review (priority 40)
  // 9. Other related concepts (priority 10)
  const getPriorityScore = (item: FoundationalConceptRecommendation): number => {
    let score = 0;
    if (item.prerequisiteCategory === 'confirmed-prerequisite') {
      if (item.evidenceStatus === 'needs-review') score = 100;
      else if (item.evidenceStatus === 'observed-difficulty') score = 95;
      else if (item.evidenceStatus === 'not-assessed') score = 90;
      else score = 70;
    } else if (item.prerequisiteCategory === 'source-foundation') {
      if (item.evidenceStatus === 'needs-review') score = 80;
      else if (item.evidenceStatus === 'observed-difficulty') score = 75;
      else if (item.evidenceStatus === 'not-assessed') score = 60;
      else score = 50;
    } else {
      if (item.evidenceStatus === 'needs-review') score = 40;
      else if (item.evidenceStatus === 'observed-difficulty') score = 30;
      else if (item.evidenceStatus === 'not-assessed') score = 20;
      else score = 10;
    }
    return score;
  };

  items.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  // Limit to at most 5 recommendations to keep suggestions focused and avoid overwhelming students
  const limitedItems = items.slice(0, 5);

  let confirmedPrerequisitesCount = 0;
  let sourceFoundationsCount = 0;
  let relatedConceptsCount = 0;
  let reviewRecommendedCount = 0;
  let unassessedCount = 0;
  let demonstratedCount = 0;

  for (const item of limitedItems) {
    if (item.prerequisiteCategory === 'confirmed-prerequisite') confirmedPrerequisitesCount++;
    else if (item.prerequisiteCategory === 'source-foundation') sourceFoundationsCount++;
    else relatedConceptsCount++;

    if (item.evidenceStatus === 'needs-review' || item.evidenceStatus === 'observed-difficulty') {
      reviewRecommendedCount++;
    } else if (item.evidenceStatus === 'not-assessed') {
      unassessedCount++;
    } else if (item.evidenceStatus === 'demonstrated') {
      demonstratedCount++;
    }
  }

  const report: ConceptFoundationsReport = {
    conceptId: targetNode.id,
    conceptName: targetNode.name,
    hasFoundations: limitedItems.length > 0,
    summaryText: limitedItems.length > 0
      ? `Identified ${limitedItems.length} foundational ${limitedItems.length === 1 ? 'concept' : 'concepts'} for ${targetNode.name}.`
      : 'No prerequisite or foundational relationships recorded for this concept.',
    items: limitedItems,
    confirmedPrerequisitesCount,
    sourceFoundationsCount,
    relatedConceptsCount,
    reviewRecommendedCount,
    unassessedCount,
    demonstratedCount
  };

  foundationsCache.set(cacheKey, { report, cachedAt: Date.now() });
  return report;
}
