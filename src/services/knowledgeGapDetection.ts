/**
 * GraphMind Knowledge Gap Detection Service (Phase 4 — Prompt 16)
 * 
 * Implements deterministic, evidence-grounded knowledge-gap detection using:
 * - Personal Learning Profile / Assessment History (formative checks + summative tests)
 * - Concept Mastery states (never building a parallel mastery system)
 * - Actual Graph Concept Relationships (prerequisites vs general connections)
 * - Source-Grounded Explanations & Worked Examples
 * 
 * Rules:
 * - Repeated incorrect answers flag a concept for review.
 * - One isolated mistake is classified as 'observed-difficulty', NOT as a persistent gap.
 * - Unassessed concepts remain 'insufficient-evidence'; never labeled as an active gap.
 * - Unanswered questions are NOT treated as incorrect answers.
 * - Reading time is NEVER used as proof of poor understanding.
 * - Graph relationships are checked only through actual existing edges/prerequisites.
 * - General relationships are described as 'Related concept in graph', never as prerequisites.
 * - Tone describes observed performance respectfully; never labels a student as weak or incapable.
 */

import type { KnowledgeGraph, KnowledgeNode } from '../types/knowledgeGraph';
import type { ConceptKnowledgeCheckState, KnowledgeCheckAttempt } from '../types/knowledgeCheck';
import type { AssessmentAttempt } from '../types/test';
import type { ConceptMasterySummary } from '../types/mastery';
import type {
  KnowledgeGapState,
  DetectedKnowledgeGap,
  KnowledgeGapEvidenceItem,
  KnowledgeGapAction,
  RelatedConceptGapInfo,
  GraphKnowledgeGapsReport,
  GapPreferences
} from '../types/knowledgeGap';
import { calculateConceptMastery } from './conceptMastery';
import { loadConceptPracticeStates } from './storage';
import { loadStoredKnowledgeCheck } from './knowledgeCheck';
import { getAssessmentAttempts } from './assessmentHistory';
import { getCurrentUserId } from './auth';

// Storage keys for gap user preferences (dismissals & deferrals)
export const STORAGE_GAP_DISMISSED_PREFIX = 'graphmind_gap_dismissed_v1_';
export const STORAGE_GAP_DEFERRED_PREFIX = 'graphmind_gap_deferred_v1_';

export function getDismissedStorageKey(graphId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  return `${STORAGE_GAP_DISMISSED_PREFIX}${safeGraph}`;
}

export function getDeferredStorageKey(graphId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  return `${STORAGE_GAP_DEFERRED_PREFIX}${safeGraph}`;
}

/**
 * Human-centered display labels for each gap state.
 */
export function formatGapStateLabel(state: KnowledgeGapState): string {
  switch (state) {
    case 'observed-difficulty':
      return 'Observed difficulty';
    case 'insufficient-evidence':
      return 'Insufficient evidence';
    case 'potential-foundational-gap':
      return 'Potential foundational gap';
    case 'review-recommended':
      return 'Review recommended';
    case 'understanding-demonstrated':
      return 'Understanding demonstrated';
    default:
      return 'Insufficient evidence';
  }
}

/**
 * Loads student preferences (dismissed and deferred gaps) for a graph.
 */
export function loadGapPreferences(graphId: string): GapPreferences {
  if (typeof localStorage === 'undefined') {
    return { dismissedConceptIds: [], deferredMap: {} };
  }

  let dismissedConceptIds: string[] = [];
  let deferredMap: Record<string, string> = {};

  try {
    const rawDismissed = localStorage.getItem(getDismissedStorageKey(graphId));
    if (rawDismissed) {
      const parsed = JSON.parse(rawDismissed);
      if (Array.isArray(parsed)) {
        dismissedConceptIds = parsed.filter(id => typeof id === 'string');
      }
    }
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to read dismissed gaps:', err);
  }

  try {
    const rawDeferred = localStorage.getItem(getDeferredStorageKey(graphId));
    if (rawDeferred) {
      const parsed = JSON.parse(rawDeferred);
      if (parsed && typeof parsed === 'object') {
        const now = Date.now();
        // Filter out expired deferrals
        for (const [conceptId, expiryIso] of Object.entries(parsed)) {
          if (typeof expiryIso === 'string') {
            const expiryTime = new Date(expiryIso).getTime();
            if (expiryTime > now) {
              deferredMap[conceptId] = expiryIso;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to read deferred gaps:', err);
  }

  return { dismissedConceptIds, deferredMap };
}

/**
 * Dismisses a knowledge gap recommendation for a concept.
 */
export function dismissKnowledgeGap(graphId: string, conceptId: string): void {
  if (typeof localStorage === 'undefined' || !graphId || !conceptId) return;
  try {
    const prefs = loadGapPreferences(graphId);
    if (!prefs.dismissedConceptIds.includes(conceptId)) {
      prefs.dismissedConceptIds.push(conceptId);
      localStorage.setItem(
        getDismissedStorageKey(graphId),
        JSON.stringify(prefs.dismissedConceptIds)
      );
    }
    invalidateKnowledgeGapsCache(graphId);
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to persist gap dismissal:', err);
  }
}

/**
 * Defers a knowledge gap recommendation for a specified duration in hours (default 24h).
 */
export function deferKnowledgeGap(
  graphId: string,
  conceptId: string,
  durationHours: number = 24
): void {
  if (typeof localStorage === 'undefined' || !graphId || !conceptId) return;
  try {
    const prefs = loadGapPreferences(graphId);
    const expiryDate = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    prefs.deferredMap[conceptId] = expiryDate;
    localStorage.setItem(
      getDeferredStorageKey(graphId),
      JSON.stringify(prefs.deferredMap)
    );
    invalidateKnowledgeGapsCache(graphId);
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to persist gap deferral:', err);
  }
}

/**
 * Restores a dismissed or deferred knowledge gap.
 */
export function restoreKnowledgeGap(graphId: string, conceptId: string): void {
  if (typeof localStorage === 'undefined' || !graphId || !conceptId) return;
  try {
    const prefs = loadGapPreferences(graphId);
    const updatedDismissed = prefs.dismissedConceptIds.filter(id => id !== conceptId);
    delete prefs.deferredMap[conceptId];

    localStorage.setItem(
      getDismissedStorageKey(graphId),
      JSON.stringify(updatedDismissed)
    );
    localStorage.setItem(
      getDeferredStorageKey(graphId),
      JSON.stringify(prefs.deferredMap)
    );
    invalidateKnowledgeGapsCache(graphId);
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to restore gap:', err);
  }
}

/**
 * Clears all gap preferences for a graph.
 */
export function clearGapPreferences(graphId: string): void {
  if (typeof localStorage === 'undefined' || !graphId) return;
  try {
    localStorage.removeItem(getDismissedStorageKey(graphId));
    localStorage.removeItem(getDeferredStorageKey(graphId));
    invalidateKnowledgeGapsCache(graphId);
  } catch (err) {
    console.warn('[KnowledgeGap] Failed to clear gap preferences:', err);
  }
}

// In-memory caching for performance & avoiding redundant recalculations on every render
interface CacheEntry {
  cacheKey: string;
  report: GraphKnowledgeGapsReport;
}

const gapsReportCache = new Map<string, CacheEntry>();

export function invalidateKnowledgeGapsCache(graphId?: string): void {
  if (graphId) {
    gapsReportCache.delete(graphId);
  } else {
    gapsReportCache.clear();
  }
}

export interface DetectKnowledgeGapsOptions {
  graph: KnowledgeGraph;
  userId?: string | null;
  forceRefresh?: boolean;
}

interface ConceptPerformanceEvidence {
  conceptId: string;
  conceptName: string;
  formativeAttempts: KnowledgeCheckAttempt[];
  summativeQuestions: Array<{
    attemptId: string;
    attemptDate: string;
    questionId: string;
    questionText: string;
    isCorrect: boolean;
    userAnswerText?: string;
    correctAnswerText?: string;
  }>;
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  consecutiveIncorrect: number;
  hasUncertainEvaluation: boolean;
  latestAssessedAt?: string;
  evidenceItems: KnowledgeGapEvidenceItem[];
}

/**
 * Extracts student assessment and practice evidence for a single concept.
 */
function extractConceptEvidence(
  concept: KnowledgeNode,
  kcState: ConceptKnowledgeCheckState | null,
  assessmentAttempts: AssessmentAttempt[]
): ConceptPerformanceEvidence {
  const evidenceItems: KnowledgeGapEvidenceItem[] = [];

  // 1. Formative assessments (Knowledge Checks)
  const rawAttempts: KnowledgeCheckAttempt[] = Object.values(kcState?.attempts || {});
  const validAttempts = rawAttempts.filter(
    att => att && typeof att === 'object' && att.questionId && att.evaluation
  );

  // Sort chronologically ascending
  const sortedFormative = [...validAttempts].sort((a, b) => {
    const tA = new Date(a.attemptedAt || 0).getTime();
    const tB = new Date(b.attemptedAt || 0).getTime();
    return tA - tB;
  });

  let formativeCorrect = 0;
  let formativeIncorrect = 0;
  let hasUncertain = false;

  for (const att of sortedFormative) {
    const isCorrect = Boolean(att.evaluation?.isCorrect);
    const isUncertain = att.evaluation?.evaluationConfidence === 'uncertain';
    if (isUncertain) hasUncertain = true;

    if (isCorrect) {
      formativeCorrect++;
    } else {
      formativeIncorrect++;
      evidenceItems.push({
        id: `formative-${att.questionId}-${att.attemptedAt || Date.now()}`,
        sourceType: isUncertain ? 'uncertain-evaluation' : 'formative-check',
        description: isUncertain
          ? `Formative response evaluated with uncertain confidence: "${att.evaluation?.feedback || 'Uncertain evaluation'}"`
          : `Formative check question answered incorrectly: "${att.evaluation?.feedback || 'Incorrect response'}"`,
        timestamp: att.attemptedAt,
        score: att.evaluation?.score,
        questionId: att.questionId,
        details: att.evaluation?.misconceptionGuidance
      });
    }
  }

  // Consecutive incorrect in formative checks backwards from latest
  let formativeConsecutiveIncorrect = 0;
  for (let i = sortedFormative.length - 1; i >= 0; i--) {
    if (!sortedFormative[i].evaluation?.isCorrect) {
      formativeConsecutiveIncorrect++;
    } else {
      break;
    }
  }

  // 2. Summative assessments (AssessmentAttempts)
  const summativeQuestions: ConceptPerformanceEvidence['summativeQuestions'] = [];
  let summativeCorrect = 0;
  let summativeIncorrect = 0;

  // Process assessment attempts ordered chronologically ascending
  const sortedAttempts = [...assessmentAttempts].sort((a, b) => {
    const tA = new Date(a.completedAt || 0).getTime();
    const tB = new Date(b.completedAt || 0).getTime();
    return tA - tB;
  });

  for (const attempt of sortedAttempts) {
    if (!Array.isArray(attempt.questions)) continue;

    for (const q of attempt.questions) {
      const isTargetConcept =
        q.conceptIds?.includes(concept.id) ||
        q.conceptNames?.some(name => name.toLowerCase() === concept.name.toLowerCase());

      if (!isTargetConcept) continue;

      // RULE: Do not interpret unanswered questions as incorrect answers
      const userAnswerId = attempt.userAnswers?.[q.id];
      if (userAnswerId === undefined || userAnswerId === null || userAnswerId.trim() === '') {
        // Question was skipped or not answered; do not record as incorrect
        continue;
      }

      const isCorrect = userAnswerId === q.correctOptionId;
      const userOpt = q.options?.find(o => o.id === userAnswerId);
      const correctOpt = q.options?.find(o => o.id === q.correctOptionId);

      summativeQuestions.push({
        attemptId: attempt.id,
        attemptDate: attempt.completedAt,
        questionId: q.id,
        questionText: q.question,
        isCorrect,
        userAnswerText: userOpt?.text,
        correctAnswerText: correctOpt?.text
      });

      if (isCorrect) {
        summativeCorrect++;
      } else {
        summativeIncorrect++;
        evidenceItems.push({
          id: `summative-${attempt.id}-${q.id}`,
          sourceType: 'summative-test',
          description: `Missed in assessment: "${q.question}"`,
          timestamp: attempt.completedAt,
          attemptId: attempt.id,
          questionId: q.id,
          questionText: q.question,
          details: q.explanation
        });
      }
    }
  }

  // Consecutive incorrect summative questions backwards from latest
  let summativeConsecutiveIncorrect = 0;
  for (let i = summativeQuestions.length - 1; i >= 0; i--) {
    if (!summativeQuestions[i].isCorrect) {
      summativeConsecutiveIncorrect++;
    } else {
      break;
    }
  }

  const totalAnswered = sortedFormative.length + summativeQuestions.length;
  const totalCorrect = formativeCorrect + summativeCorrect;
  const totalIncorrect = formativeIncorrect + summativeIncorrect;

  // Calculate overall consecutive incorrect answers across combined recent activity
  let consecutiveIncorrect = 0;
  // If the latest activity was formative or summative
  const latestFormativeTime = sortedFormative.length > 0
    ? new Date(sortedFormative[sortedFormative.length - 1].attemptedAt || 0).getTime()
    : 0;
  const latestSummativeTime = summativeQuestions.length > 0
    ? new Date(summativeQuestions[summativeQuestions.length - 1].attemptDate || 0).getTime()
    : 0;

  if (latestFormativeTime >= latestSummativeTime) {
    consecutiveIncorrect = formativeConsecutiveIncorrect;
  } else {
    consecutiveIncorrect = summativeConsecutiveIncorrect;
  }

  const latestAssessedAt =
    latestFormativeTime > 0 || latestSummativeTime > 0
      ? new Date(Math.max(latestFormativeTime, latestSummativeTime)).toISOString()
      : undefined;

  return {
    conceptId: concept.id,
    conceptName: concept.name,
    formativeAttempts: sortedFormative,
    summativeQuestions,
    totalAnswered,
    totalCorrect,
    totalIncorrect,
    consecutiveIncorrect,
    hasUncertainEvaluation: hasUncertain,
    latestAssessedAt,
    evidenceItems
  };
}

/**
 * Identifies confirmed prerequisites and general related concepts from actual graph data.
 * Does NOT invent edges or assume every connected concept is a prerequisite.
 */
function findConnectedConceptRelationships(
  concept: KnowledgeNode,
  graph: KnowledgeGraph
): Array<{
  targetId: string;
  relationshipType: string;
  isPrerequisite: boolean;
  relationshipLabel: string;
}> {
  const result: Array<{
    targetId: string;
    relationshipType: string;
    isPrerequisite: boolean;
    relationshipLabel: string;
  }> = [];

  const seenIds = new Set<string>();

  // 1. Explicit prerequisites declared on the node itself
  if (Array.isArray(concept.prerequisites)) {
    for (const prereqIdentifier of concept.prerequisites) {
      if (!prereqIdentifier) continue;
      // Resolve ID or match by name
      const matchedNode = graph.nodes.find(
        n => n.id === prereqIdentifier || n.name.toLowerCase() === prereqIdentifier.toLowerCase()
      );
      if (matchedNode && matchedNode.id !== concept.id && !seenIds.has(matchedNode.id)) {
        seenIds.add(matchedNode.id);
        result.push({
          targetId: matchedNode.id,
          relationshipType: 'prerequisite',
          isPrerequisite: true,
          relationshipLabel: 'Confirmed Prerequisite'
        });
      }
    }
  }

  // 2. Explicit graph relationships
  if (Array.isArray(graph.relationships)) {
    for (const rel of graph.relationships) {
      if (!rel || !rel.source || !rel.target) continue;

      const relType = (rel.type || '').toLowerCase();

      // Case A: rel.target is this concept (incoming edges)
      if (rel.target === concept.id) {
        const sourceId = rel.source;
        if (sourceId === concept.id || seenIds.has(sourceId)) continue;

        // Is it a foundation/prerequisite edge?
        // e.g. "foundation-for", "depends-on", "prerequisite"
        const isFoundation =
          relType === 'foundation-for' ||
          relType === 'prerequisite' ||
          relType === 'depends-on';

        seenIds.add(sourceId);
        result.push({
          targetId: sourceId,
          relationshipType: rel.type || 'related-to',
          isPrerequisite: isFoundation,
          relationshipLabel: isFoundation
            ? 'Confirmed Prerequisite'
            : 'Related concept in graph'
        });
      }

      // Case B: rel.source is this concept (outgoing edges)
      if (rel.source === concept.id) {
        const targetId = rel.target;
        if (targetId === concept.id || seenIds.has(targetId)) continue;

        // If concept "depends-on" targetId, targetId is prerequisite
        const isPrereq = relType === 'depends-on' || relType === 'prerequisite';

        seenIds.add(targetId);
        result.push({
          targetId,
          relationshipType: rel.type || 'related-to',
          isPrerequisite: isPrereq,
          relationshipLabel: isPrereq
            ? 'Confirmed Prerequisite'
            : 'Related concept in graph'
        });
      }
    }
  }

  return result;
}

/**
 * Builds helpful, actionable next steps for a detected knowledge gap.
 */
function buildGapActions(
  concept: KnowledgeNode,
  gapState: KnowledgeGapState,
  foundationalPrereq?: { id: string; name: string }
): { primaryAction: KnowledgeGapAction; secondaryActions: KnowledgeGapAction[] } {
  let primaryAction: KnowledgeGapAction;
  const secondaryActions: KnowledgeGapAction[] = [];

  switch (gapState) {
    case 'potential-foundational-gap':
      if (foundationalPrereq) {
        primaryAction = {
          id: `act-review-prereq-${concept.id}`,
          label: `Review foundational concept (${foundationalPrereq.name})`,
          type: 'open-related-concept',
          conceptId: concept.id,
          conceptName: concept.name,
          targetConceptId: foundationalPrereq.id,
          targetConceptName: foundationalPrereq.name,
          description: `Examine ${foundationalPrereq.name} first to build required understanding for ${concept.name}.`,
          isPrimary: true
        };
        secondaryActions.push({
          id: `act-reopen-explanation-${concept.id}`,
          label: `Reopen ${concept.name} explanation`,
          type: 'reopen-explanation',
          conceptId: concept.id,
          conceptName: concept.name,
          description: 'Study the full concept explanation and source citations.'
        });
      } else {
        primaryAction = {
          id: `act-reopen-explanation-${concept.id}`,
          label: 'Reopen concept explanation',
          type: 'reopen-explanation',
          conceptId: concept.id,
          conceptName: concept.name,
          description: 'Study the full concept explanation and source citations.',
          isPrimary: true
        };
      }
      break;

    case 'review-recommended':
      primaryAction = {
        id: `act-reopen-explanation-${concept.id}`,
        label: 'Reopen concept explanation',
        type: 'reopen-explanation',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Review core definitions, mechanisms, and source excerpts.',
        isPrimary: true
      };
      secondaryActions.push({
        id: `act-review-worked-example-${concept.id}`,
        label: 'Review worked example',
        type: 'review-worked-example',
        conceptId: concept.id,
        conceptName: concept.name,
        targetSectionId: 'section-worked-example',
        description: 'Step through the verified problem-solving example.'
      });
      secondaryActions.push({
        id: `act-retry-kc-${concept.id}`,
        label: 'Retry knowledge check',
        type: 'retry-knowledge-check',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Test understanding with an interactive check.'
      });
      break;

    case 'observed-difficulty':
      primaryAction = {
        id: `act-retry-kc-${concept.id}`,
        label: 'Retry knowledge check',
        type: 'retry-knowledge-check',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Attempt another question to clarify understanding.',
        isPrimary: true
      };
      secondaryActions.push({
        id: `act-reopen-explanation-${concept.id}`,
        label: 'Reopen explanation',
        type: 'reopen-explanation',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Review key concept details.'
      });
      break;

    case 'insufficient-evidence':
    default:
      primaryAction = {
        id: `act-take-kc-${concept.id}`,
        label: 'Attempt knowledge check',
        type: 'retry-knowledge-check',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Answer questions to evaluate and establish your understanding.',
        isPrimary: true
      };
      secondaryActions.push({
        id: `act-reopen-explanation-${concept.id}`,
        label: 'Open explanation',
        type: 'reopen-explanation',
        conceptId: concept.id,
        conceptName: concept.name,
        description: 'Read the source-grounded concept explanation.'
      });
      break;
  }

  // Defer & Dismiss secondary controls
  secondaryActions.push({
    id: `act-defer-${concept.id}`,
    label: 'Defer for 24h',
    type: 'defer',
    conceptId: concept.id,
    conceptName: concept.name,
    description: 'Hide this suggestion for 24 hours.'
  });

  secondaryActions.push({
    id: `act-dismiss-${concept.id}`,
    label: 'Dismiss',
    type: 'dismiss',
    conceptId: concept.id,
    conceptName: concept.name,
    description: 'Dismiss this recommendation.'
  });

  return { primaryAction, secondaryActions };
}

/**
 * Evaluates knowledge gaps for all concepts in a knowledge graph.
 */
export function detectKnowledgeGaps(options: DetectKnowledgeGapsOptions): GraphKnowledgeGapsReport {
  const { graph, forceRefresh = false } = options;
  const safeGraphId = graph?.id || 'default_graph';
  const graphName = graph?.name || 'Knowledge Graph';
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  const targetUserId = options.userId !== undefined ? options.userId : getCurrentUserId();

  // Load persistent attempts for this graph & user
  const assessmentAttempts = getAssessmentAttempts({
    graphId: safeGraphId,
    userId: targetUserId
  });

  const prefs = loadGapPreferences(safeGraphId);
  const practiceStates = loadConceptPracticeStates(safeGraphId);

  // Compute a stable cache token
  const lastAttemptIso = assessmentAttempts.length > 0 ? assessmentAttempts[0].completedAt : 'none';
  const dismissedHash = prefs.dismissedConceptIds.sort().join(',');
  const deferredHash = Object.keys(prefs.deferredMap).sort().join(',');
  const cacheKey = `${safeGraphId}_${nodes.length}_${(graph?.relationships || []).length}_${assessmentAttempts.length}_${lastAttemptIso}_${dismissedHash}_${deferredHash}`;

  if (!forceRefresh) {
    const cached = gapsReportCache.get(safeGraphId);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.report;
    }
  }

  // Pass 1: Extract evidence and compute provisional gap state for each concept
  const provisionalGaps: Map<
    string,
    {
      concept: KnowledgeNode;
      evidence: ConceptPerformanceEvidence;
      mastery: ConceptMasterySummary;
      provisionalState: KnowledgeGapState;
      reason: string;
    }
  > = new Map();

  for (const concept of nodes) {
    if (!concept || !concept.id) continue;

    const kcState = loadStoredKnowledgeCheck(safeGraphId, concept.id);
    const evidence = extractConceptEvidence(concept, kcState, assessmentAttempts);

    const mastery = calculateConceptMastery({
      graphId: safeGraphId,
      conceptId: concept.id,
      conceptName: concept.name,
      knowledgeCheckState: kcState,
      practiceState: practiceStates[concept.id]
    });

    let provisionalState: KnowledgeGapState;
    let reason: string;

    // RULE 1: Unassessed concepts have insufficient evidence
    if (evidence.totalAnswered === 0) {
      if (mastery.status === 'needs-review') {
        // Explicitly marked for review without assessment
        provisionalState = 'review-recommended';
        reason = 'Marked for review by student.';
      } else {
        provisionalState = 'insufficient-evidence';
        reason = 'Your understanding of this concept is not yet established because there is insufficient assessment evidence.';
      }
    }
    // RULE 2: Repeated incorrect answers or persistent difficulty (>= 2 incorrect answers or >= 2 consecutive)
    else if (
      evidence.consecutiveIncorrect >= 2 ||
      evidence.totalIncorrect >= 2
    ) {
      provisionalState = 'review-recommended';
      if (evidence.consecutiveIncorrect >= 2) {
        reason = `Consider reviewing this concept again because ${evidence.consecutiveIncorrect} recent answers were incorrect.`;
      } else if (evidence.totalIncorrect >= 2) {
        reason = `Consider reviewing this concept again because ${evidence.totalIncorrect} recorded answers were incorrect.`;
      } else {
        reason = 'Recorded responses indicate persistent difficulty with this concept.';
      }
    }
    // RULE 3: One isolated mistake or uncertain evaluation
    // RULE: Do not treat a single mistake as proof of a persistent gap!
    else if (evidence.totalIncorrect === 1 || evidence.hasUncertainEvaluation) {
      provisionalState = 'observed-difficulty';
      if (evidence.totalIncorrect === 1) {
        reason = 'A recent answer was incorrect, but there is not yet evidence of a persistent gap.';
      } else {
        reason = 'A recent formative answer was evaluated with uncertain confidence; review recommended.';
      }
    }
    // RULE 4: Verified understanding demonstrated
    else {
      provisionalState = 'understanding-demonstrated';
      reason = 'Formative and summative assessments demonstrate verified understanding.';
    }

    provisionalGaps.set(concept.id, {
      concept,
      evidence,
      mastery,
      provisionalState,
      reason
    });
  }

  // Pass 2: Graph-Aware Analysis (investigate actual foundational and prerequisite links)
  const items: DetectedKnowledgeGap[] = [];

  let flaggedGapsCount = 0;
  let reviewRecommendedCount = 0;
  let observedDifficultyCount = 0;
  let potentialFoundationalCount = 0;
  let insufficientEvidenceCount = 0;
  let understandingDemonstratedCount = 0;

  for (const concept of nodes) {
    if (!concept || !concept.id) continue;
    const entry = provisionalGaps.get(concept.id);
    if (!entry) continue;

    let finalGapState = entry.provisionalState;
    let finalReason = entry.reason;
    let primaryPrereqFound: { id: string; name: string } | undefined;

    // Check connected concepts via actual graph relationships
    const connectedRels = findConnectedConceptRelationships(concept, graph);
    const relatedConceptInfos: RelatedConceptGapInfo[] = [];

    // Only investigate foundational gap if this concept itself has difficulty (not unassessed!)
    const studentStrugglesWithThisConcept =
      entry.provisionalState === 'review-recommended' ||
      entry.provisionalState === 'observed-difficulty';

    for (const rel of connectedRels) {
      const neighborEntry = provisionalGaps.get(rel.targetId);
      if (!neighborEntry) continue; // Deleted or missing concept handled gracefully

      const neighborHasDifficulty =
        neighborEntry.provisionalState === 'review-recommended' ||
        neighborEntry.provisionalState === 'observed-difficulty' ||
        neighborEntry.provisionalState === 'potential-foundational-gap';

      let evidenceSummary: string;
      if (neighborHasDifficulty) {
        evidenceSummary = `Struggles recorded: ${neighborEntry.evidence.totalIncorrect} incorrect answer${neighborEntry.evidence.totalIncorrect === 1 ? '' : 's'}.`;
      } else if (neighborEntry.provisionalState === 'insufficient-evidence') {
        evidenceSummary = 'No assessment evidence recorded yet.';
      } else {
        evidenceSummary = 'Understanding demonstrated in assessments.';
      }

      relatedConceptInfos.push({
        conceptId: neighborEntry.concept.id,
        conceptName: neighborEntry.concept.name,
        relationshipType: rel.relationshipType,
        isPrerequisite: rel.isPrerequisite,
        relationshipLabel: rel.relationshipLabel,
        gapState: neighborEntry.provisionalState,
        hasDifficulty: neighborHasDifficulty,
        evidenceSummary
      });

      // RULE: Potential foundational gap triggers when:
      // 1. Student struggles with concept A
      // 2. An actual CONFIRMED prerequisite concept B has independent difficulty
      // RULE: Do not assume every connected concept is a prerequisite!
      if (studentStrugglesWithThisConcept && rel.isPrerequisite && neighborHasDifficulty) {
        finalGapState = 'potential-foundational-gap';
        finalReason = `Difficulty with ${concept.name} may be related to foundational prerequisite '${neighborEntry.concept.name}', which also has recorded incorrect answers.`;
        primaryPrereqFound = {
          id: neighborEntry.concept.id,
          name: neighborEntry.concept.name
        };

        // Add supporting evidence item citing the foundational concept's difficulty
        entry.evidence.evidenceItems.unshift({
          id: `foundational-${neighborEntry.concept.id}`,
          sourceType: 'graph-prerequisite',
          description: `Foundational prerequisite '${neighborEntry.concept.name}' also has recorded difficulty (${neighborEntry.evidence.totalIncorrect} incorrect answers).`,
          timestamp: neighborEntry.evidence.latestAssessedAt,
          details: `Connected via prerequisite relationship in knowledge graph.`
        });
      }
    }

    const { primaryAction, secondaryActions } = buildGapActions(
      concept,
      finalGapState,
      primaryPrereqFound
    );

    const isDismissed = prefs.dismissedConceptIds.includes(concept.id);
    const isDeferred = Boolean(prefs.deferredMap[concept.id]);
    const deferredUntil = prefs.deferredMap[concept.id];

    const detectedItem: DetectedKnowledgeGap = {
      conceptId: concept.id,
      conceptName: concept.name,
      category: concept.type || 'Concept',
      gapState: finalGapState,
      statusLabel: formatGapStateLabel(finalGapState),
      reason: finalReason,
      supportingEvidence: entry.evidence.evidenceItems,
      recommendedAction: primaryAction,
      secondaryActions,
      relatedConcepts: relatedConceptInfos,
      isDismissed,
      isDeferred,
      deferredUntil,
      totalAssessedQuestions: entry.evidence.totalAnswered,
      correctAnswersCount: entry.evidence.totalCorrect,
      incorrectAnswersCount: entry.evidence.totalIncorrect,
      consecutiveIncorrectCount: entry.evidence.consecutiveIncorrect,
      hasUncertainEvaluation: entry.evidence.hasUncertainEvaluation,
      lastAssessedAt: entry.evidence.latestAssessedAt,
      detectedAt: new Date().toISOString()
    };

    items.push(detectedItem);

    // Update tallies
    switch (finalGapState) {
      case 'review-recommended':
        reviewRecommendedCount++;
        flaggedGapsCount++;
        break;
      case 'potential-foundational-gap':
        potentialFoundationalCount++;
        flaggedGapsCount++;
        break;
      case 'observed-difficulty':
        observedDifficultyCount++;
        flaggedGapsCount++;
        break;
      case 'insufficient-evidence':
        insufficientEvidenceCount++;
        break;
      case 'understanding-demonstrated':
        understandingDemonstratedCount++;
        break;
    }
  }

  // Active gaps: flagged items that are neither dismissed nor deferred
  const activeGaps = items.filter(
    item =>
      (item.gapState === 'review-recommended' ||
        item.gapState === 'potential-foundational-gap' ||
        item.gapState === 'observed-difficulty') &&
      !item.isDismissed &&
      !item.isDeferred
  );

  const report: GraphKnowledgeGapsReport = {
    graphId: safeGraphId,
    graphName,
    generatedAt: new Date().toISOString(),
    totalConcepts: nodes.length,
    flaggedGapsCount,
    reviewRecommendedCount,
    observedDifficultyCount,
    potentialFoundationalCount,
    insufficientEvidenceCount,
    understandingDemonstratedCount,
    items,
    activeGaps,
    dismissedCount: prefs.dismissedConceptIds.length,
    deferredCount: Object.keys(prefs.deferredMap).length
  };

  gapsReportCache.set(safeGraphId, {
    cacheKey,
    report
  });

  return report;
}
