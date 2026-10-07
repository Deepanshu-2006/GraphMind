import type { 
  PracticeQuestion, 
  QuestionGenerationContext,
  ActiveRecallQuestion
} from '../types/practice';

/**
 * Strips raw markdown artifacts and extracts clean sentences.
 */
function extractSentences(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/^#+\s+[^\n]+\n*/gm, ' ')
    .replace(/^[-*•]\s+/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches) return [cleaned].filter(s => s.length > 15);
  return matches.map(s => s.trim()).filter(s => s.length > 15);
}

/**
 * Determines whether the available material is sufficient to generate a trustworthy question.
 */
export function hasSufficientMaterial(ctx: QuestionGenerationContext): boolean {
  const hasDesc = Boolean(ctx.description && ctx.description.trim().length >= 20);
  const hasEvidence = Boolean(ctx.evidence && ctx.evidence.trim().length >= 20);
  const hasKeyIdeas = Boolean(ctx.keyIdeas && ctx.keyIdeas.length > 0);
  const hasRelationships = Boolean(ctx.relationships && ctx.relationships.length > 0);

  return hasDesc || hasEvidence || hasKeyIdeas || (hasRelationships && (hasDesc || hasEvidence));
}

/**
 * Shuffles an array deterministically with a simple seed or random index.
 */
function shuffleOptions<T>(array: T[], seed = 42): T[] {
  const copy = [...array];
  let m = copy.length;
  let s = seed;
  while (m) {
    s = (s * 9301 + 49297) % 233280;
    const i = Math.floor((s / 233280) * m--);
    const t = copy[m];
    copy[m] = copy[i];
    copy[i] = t;
  }
  return copy;
}

/**
 * Formats relationship labels into natural language phrases.
 */
function formatRelationshipPhrase(relType?: string, source: string = 'this concept', target: string = 'related concept'): string {
  const cleanType = (relType || 'connects to').replace(/-/g, ' ').toLowerCase();
  switch (cleanType) {
    case 'uses':
      return `${source} uses ${target}`;
    case 'is a':
    case 'is a type of':
    case 'instance of':
      return `${source} is a type of ${target}`;
    case 'part of':
      return `${source} is a component of ${target}`;
    case 'depends on':
      return `${source} depends on ${target}`;
    case 'implements':
      return `${source} implements ${target}`;
    case 'extends':
      return `${source} extends ${target}`;
    case 'applied to':
      return `${source} is applied to ${target}`;
    case 'foundation for':
      return `${source} serves as a foundation for ${target}`;
    default:
      return `${source} is related to ${target} via ${cleanType}`;
  }
}

/**
 * Generates an array of high-quality, source-grounded candidate questions for a concept.
 */
export function generateCandidateQuestions(ctx: QuestionGenerationContext): PracticeQuestion[] {
  if (!hasSufficientMaterial(ctx)) {
    return [];
  }

  const questions: PracticeQuestion[] = [];
  const conceptName = ctx.conceptName;
  const sourceName = ctx.sourceName || 'Uploaded Material';
  const page = ctx.page;
  const sourceIds = ctx.sourceIds;
  const sourceChunkIds = ctx.sourceChunkIds;

  const rawEvidence = ctx.evidence || ctx.description || '';
  const sentences = extractSentences(rawEvidence);
  const primarySentence = sentences[0] || ctx.description || '';

  // Other concepts in the graph to use as authentic non-hallucinated distractors
  const otherConcepts = (ctx.allGraphConcepts || [])
    .filter(c => c.name.toLowerCase() !== conceptName.toLowerCase())
    .map(c => c.name);

  // -------------------------------------------------------------------------
  // 1. CONCEPT RELATIONSHIP QUESTION (Priority: tests graph knowledge directly)
  // -------------------------------------------------------------------------
  if (ctx.relationships && ctx.relationships.length > 0) {
    for (const rel of ctx.relationships.slice(0, 2)) {
      const targetName = rel.targetName;
      if (!targetName) continue;

      const isOutgoing = rel.direction !== 'incoming';
      const source = isOutgoing ? conceptName : targetName;
      const target = isOutgoing ? targetName : conceptName;
      const correctPhrase = formatRelationshipPhrase(rel.type, source, target);

      // Generate authentic distractors based on alternative relationship semantics
      const distractorTypes = ['replaces', 'is unrelated to', 'contradicts', 'is a subtype of', 'depends on']
        .filter(t => t !== rel.type.toLowerCase().replace(/-/g, ' '));

      const distractorPhrases = distractorTypes.slice(0, 3).map(dt => {
        if (dt === 'is unrelated to') return `${source} and ${target} are completely independent`;
        if (dt === 'replaces') return `${source} replaces ${target} entirely`;
        return `${target} ${dt} ${source}`;
      });

      const options = shuffleOptions([correctPhrase, ...distractorPhrases], conceptName.length + 1);

      questions.push({
        id: `q-rel-${ctx.conceptId}-${rel.targetId}-${rel.type}`,
        conceptId: ctx.conceptId,
        conceptName,
        type: 'concept-relationship',
        question: `What is the architectural or conceptual relationship between ${conceptName} and ${targetName}?`,
        options,
        correctAnswer: correctPhrase,
        explanation: rel.description 
          ? `${rel.description}. According to your material, ${correctPhrase}.`
          : `According to your study material, ${correctPhrase}.`,
        passage: primarySentence,
        sourceName,
        page,
        sourceIds,
        sourceChunkIds
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. MULTIPLE CHOICE QUESTION (Grounding: concept definition / core property)
  // -------------------------------------------------------------------------
  if (primarySentence && primarySentence.length >= 25 && otherConcepts.length >= 2) {
    // Check if sentence starts with or contains concept name
    const nameRegex = new RegExp(`\\b${conceptName}\\b`, 'i');
    let questionText = '';
    
    if (nameRegex.test(primarySentence)) {
      // Form a fill-in/identification question
      questionText = primarySentence.replace(nameRegex, '______');
      if (!questionText.endsWith('?')) {
        questionText = `Which concept correctly completes this principle from your material: "${questionText}"?`;
      }
    } else {
      questionText = `Which concept corresponds to the following definition from your material: "${primarySentence}"?`;
    }

    // Pick 3 authentic distractors from other concepts in the user's graph
    const chosenDistractors = otherConcepts.slice(0, 3);
    const options = shuffleOptions([conceptName, ...chosenDistractors], conceptName.length + 7);

    questions.push({
      id: `q-mcq-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      type: 'multiple-choice',
      question: questionText,
      options,
      correctAnswer: conceptName,
      explanation: `${conceptName} is defined in your material as: "${primarySentence}".`,
      passage: primarySentence,
      sourceName,
      page,
      sourceIds,
      sourceChunkIds
    });
  }

  // -------------------------------------------------------------------------
  // 3. COMPARISON QUESTION (Grounding: if neighboring concepts exist)
  // -------------------------------------------------------------------------
  if (ctx.neighborConcepts && ctx.neighborConcepts.length > 0) {
    const neighbor = ctx.neighborConcepts[0];
    if (neighbor && neighbor.description && ctx.description) {
      const correctComparison = `${conceptName} focuses on ${ctx.description.toLowerCase().replace(/\.$/, '')}, whereas ${neighbor.name} focuses on ${neighbor.description.toLowerCase().replace(/\.$/, '')}.`;
      
      const distractorA = `Both ${conceptName} and ${neighbor.name} perform identical operations and are interchangeable.`;
      const distractorB = `${conceptName} is a legacy algorithm completely replaced by ${neighbor.name}.`;
      const distractorC = `${neighbor.name} is a prerequisite that must execute prior to ${conceptName}.`;

      const options = shuffleOptions([correctComparison, distractorA, distractorB, distractorC], conceptName.length + 13);

      questions.push({
        id: `q-comp-${ctx.conceptId}-${neighbor.id}`,
        conceptId: ctx.conceptId,
        conceptName,
        type: 'comparison',
        question: `How does ${conceptName} differ from ${neighbor.name} according to your material?`,
        options,
        correctAnswer: correctComparison,
        explanation: `In your study material, ${conceptName} and ${neighbor.name} are distinct concepts with complementary roles.`,
        passage: primarySentence,
        sourceName,
        page,
        sourceIds,
        sourceChunkIds
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. TRUE / FALSE QUESTION (Grounding: factual property in evidence)
  // -------------------------------------------------------------------------
  if (primarySentence && primarySentence.length >= 30) {
    questions.push({
      id: `q-tf-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      type: 'true-false',
      question: `True or False: According to your material, ${primarySentence}`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: `This is directly stated in your material: "${primarySentence}".`,
      passage: primarySentence,
      sourceName,
      page,
      sourceIds,
      sourceChunkIds
    });
  }

  // -------------------------------------------------------------------------
  // 5. SHORT ANSWER QUESTION (Grounding: concise definitional retrieval)
  // -------------------------------------------------------------------------
  if (ctx.description && ctx.description.trim().length >= 20) {
    questions.push({
      id: `q-sa-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      type: 'short-answer',
      question: `In your own words, what is ${conceptName} and how does it function in your material?`,
      correctAnswer: ctx.description.trim(),
      explanation: `Expected definition from your material: "${ctx.description.trim()}".`,
      passage: primarySentence,
      sourceName,
      page,
      sourceIds,
      sourceChunkIds
    });
  }

  // -------------------------------------------------------------------------
  // 6. NUMERICAL / PROCEDURAL (If evidence contains numbers or formulas)
  // -------------------------------------------------------------------------
  const formulaMatch = rawEvidence.match(/(\d+[\s\w=+\-*/<>]+|\b[a-zA-Z]\s*=\s*\d+)/);
  if (formulaMatch && formulaMatch[0].length >= 4) {
    const formulaSnippet = formulaMatch[0].trim();
    questions.push({
      id: `q-num-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      type: 'numerical-procedural',
      question: `Consider the rule or formula identified in your material for ${conceptName}: "${formulaSnippet}". How is this applied?`,
      correctAnswer: primarySentence,
      explanation: `This calculation is defined in your material: "${primarySentence}".`,
      passage: primarySentence,
      sourceName,
      page,
      sourceIds,
      sourceChunkIds
    });
  }

  return questions;
}

/**
 * Selects the optimal question for a concept, respecting deduplication history.
 */
export function getPracticeQuestionForConcept(
  ctx: QuestionGenerationContext,
  previouslyAnsweredQuestionIds?: Set<string> | string[]
): PracticeQuestion | null {
  const candidates = generateCandidateQuestions(ctx);
  if (candidates.length === 0) {
    return null;
  }

  const answeredSet = previouslyAnsweredQuestionIds instanceof Set 
    ? previouslyAnsweredQuestionIds 
    : new Set(previouslyAnsweredQuestionIds || []);

  // 1. Prefer unpracticed questions
  const unpracticed = candidates.filter(q => !answeredSet.has(q.id));
  if (unpracticed.length > 0) {
    return unpracticed[0];
  }

  // 2. If all have been practiced, cycle cleanly to the first valid candidate
  return candidates[0];
}

/**
 * Evaluates a student's answer against the correct answer.
 */
export function evaluateAnswer(
  question: PracticeQuestion,
  studentAnswer: string
): { isCorrect: boolean; feedback: string } {
  if (!studentAnswer || !studentAnswer.trim()) {
    return { isCorrect: false, feedback: 'Please provide an answer before checking.' };
  }

  const cleanStudent = studentAnswer.trim().toLowerCase();
  const cleanCorrect = question.correctAnswer.trim().toLowerCase();

  // 1. Multiple Choice / True-False / Relationship / Comparison: Direct match or option key match
  if (
    question.type === 'multiple-choice' ||
    question.type === 'true-false' ||
    question.type === 'concept-relationship' ||
    question.type === 'comparison'
  ) {
    const isExact = cleanStudent === cleanCorrect;
    return {
      isCorrect: isExact,
      feedback: isExact ? 'Correct' : 'Not quite'
    };
  }

  // 2. Short Answer / Procedural: Semantic overlap check (no rigid punctuation requirements)
  const studentTokens = new Set(
    cleanStudent.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );
  const correctTokens = cleanCorrect
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (correctTokens.length === 0) {
    return { isCorrect: true, feedback: 'Correct' };
  }

  let matchCount = 0;
  for (const token of correctTokens) {
    if (studentTokens.has(token)) {
      matchCount++;
    }
  }

  const overlapRatio = matchCount / correctTokens.length;
  // If > 40% keyword overlap, consider conceptually correct
  const isSemanticMatch = overlapRatio >= 0.4 || cleanStudent.includes(cleanCorrect) || cleanCorrect.includes(cleanStudent);

  return {
    isCorrect: isSemanticMatch,
    feedback: isSemanticMatch ? 'Correct' : 'Not quite'
  };
}

/**
 * =========================================================================
 * PHASE 4: ACTIVE RECALL / TEST YOURSELF ENGINE
 * =========================================================================
 */

/**
 * Phase 4 Active Recall Question Patterns:
 * A. Definition recall: "What is {Concept}?"
 * B. Explanation recall: "Explain why {Concept} is important."
 * C. Relationship recall: "What is the relationship between {Concept} and {Target}?"
 * D. Connection recall: "Which concept is associated with {Concept} through '{relType}'?"
 */
export function generateActiveRecallQuestions(ctx: QuestionGenerationContext): ActiveRecallQuestion[] {
  if (!hasSufficientMaterial(ctx)) {
    return [];
  }

  const questions: ActiveRecallQuestion[] = [];
  const conceptName = ctx.conceptName;
  const sourceName = ctx.sourceName || 'Uploaded Material';
  const page = ctx.page;

  const rawEvidence = ctx.evidence || ctx.description || '';
  const sentences = extractSentences(rawEvidence);
  const primarySentence = sentences[0] || ctx.description || '';

  // -------------------------------------------------------------------------
  // A. DEFINITION RECALL ("What is Process?")
  // -------------------------------------------------------------------------
  const definitionText = ctx.description?.trim() || primarySentence;
  if (definitionText && definitionText.length >= 15) {
    questions.push({
      id: `recall-def-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      pattern: 'definition',
      question: `What is ${conceptName}?`,
      answer: definitionText,
      explanation: `${conceptName} is defined in your material as: "${definitionText}".`,
      passage: primarySentence,
      sourceName,
      page
    });

    questions.push({
      id: `recall-def-direct-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      pattern: 'definition',
      question: `Define ${conceptName}.`,
      answer: definitionText,
      explanation: `${conceptName}: "${definitionText}".`,
      passage: primarySentence,
      sourceName,
      page
    });
  }

  // -------------------------------------------------------------------------
  // B. EXPLANATION RECALL ("Explain why CPU Scheduling is important.")
  // -------------------------------------------------------------------------
  if (definitionText && definitionText.length >= 25) {
    const isWhyQuestion = /\b(important|critical|essential|allows|enables|serves|optimizes|manages|ensures|key)\b/i.test(definitionText);
    const questionText = isWhyQuestion
      ? `Explain why ${conceptName} is important.`
      : `Explain the core role of ${conceptName} according to your material.`;

    questions.push({
      id: `recall-exp-${ctx.conceptId}`,
      conceptId: ctx.conceptId,
      conceptName,
      pattern: 'explanation',
      question: questionText,
      answer: definitionText,
      explanation: `From your study material: ${definitionText}`,
      passage: primarySentence,
      sourceName,
      page
    });
  }

  // -------------------------------------------------------------------------
  // C. RELATIONSHIP RECALL ("What is the relationship between Process and CPU Scheduling?")
  // -------------------------------------------------------------------------
  if (ctx.relationships && ctx.relationships.length > 0) {
    for (const rel of ctx.relationships.slice(0, 3)) {
      const targetName = rel.targetName;
      if (!targetName) continue;

      const isOutgoing = rel.direction !== 'incoming';
      const source = isOutgoing ? conceptName : targetName;
      const target = isOutgoing ? targetName : conceptName;
      const relationshipPhrase = formatRelationshipPhrase(rel.type, source, target);
      const answerText = rel.description
        ? `${rel.description}. According to your material, ${relationshipPhrase}.`
        : `According to your material, ${relationshipPhrase}.`;

      questions.push({
        id: `recall-rel-${ctx.conceptId}-${rel.targetId}-${rel.type}`,
        conceptId: ctx.conceptId,
        conceptName,
        pattern: 'relationship',
        question: `What is the relationship between ${conceptName} and ${targetName}?`,
        answer: answerText,
        explanation: answerText,
        passage: primarySentence,
        sourceName,
        page,
        relatedConceptId: rel.targetId,
        relatedConceptName: targetName,
        relationshipType: rel.type
      });

      // Exam prompt variation: "Explain the relationship between X and Y."
      questions.push({
        id: `recall-rel-explain-${ctx.conceptId}-${rel.targetId}-${rel.type}`,
        conceptId: ctx.conceptId,
        conceptName,
        pattern: 'relationship',
        question: `Explain the relationship between ${conceptName} and ${targetName}.`,
        answer: answerText,
        explanation: answerText,
        passage: primarySentence,
        sourceName,
        page,
        relatedConceptId: rel.targetId,
        relatedConceptName: targetName,
        relationshipType: rel.type
      });

      // If relation is part-of or uses, generate role question
      if (/part|role|uses|manages|component/i.test(rel.type)) {
        questions.push({
          id: `recall-rel-role-${ctx.conceptId}-${rel.targetId}-${rel.type}`,
          conceptId: ctx.conceptId,
          conceptName,
          pattern: 'relationship',
          question: `What role does ${conceptName} play in ${targetName}?`,
          answer: answerText,
          explanation: answerText,
          passage: primarySentence,
          sourceName,
          page,
          relatedConceptId: rel.targetId,
          relatedConceptName: targetName,
          relationshipType: rel.type
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // D. CONNECTION RECALL ("Which concept is associated with Process through 'depends on'?")
  // -------------------------------------------------------------------------
  if (ctx.relationships && ctx.relationships.length > 0) {
    for (const rel of ctx.relationships.slice(0, 2)) {
      const targetName = rel.targetName;
      if (!targetName) continue;

      const cleanType = rel.type.replace(/-/g, ' ').toLowerCase();
      const answerText = rel.description
        ? `${targetName} (${rel.description})`
        : targetName;

      questions.push({
        id: `recall-conn-${ctx.conceptId}-${rel.targetId}-${rel.type}`,
        conceptId: ctx.conceptId,
        conceptName,
        pattern: 'connection',
        question: `Which concept is associated with ${conceptName} through '${cleanType}'?`,
        answer: answerText,
        explanation: `${conceptName} is connected to ${targetName} through '${cleanType}'.`,
        passage: primarySentence,
        sourceName,
        page,
        relatedConceptId: rel.targetId,
        relatedConceptName: targetName,
        relationshipType: rel.type
      });

      // Exam prompt: "What concept depends on X?"
      if (/depend/i.test(cleanType)) {
        questions.push({
          id: `recall-conn-depend-${ctx.conceptId}-${rel.targetId}`,
          conceptId: ctx.conceptId,
          conceptName,
          pattern: 'connection',
          question: `What concept depends on ${conceptName}?`,
          answer: answerText,
          explanation: `${targetName} depends on ${conceptName}.`,
          passage: primarySentence,
          sourceName,
          page,
          relatedConceptId: rel.targetId,
          relatedConceptName: targetName,
          relationshipType: rel.type
        });
      }
    }
  }

  return questions;
}

/**
 * Selects the optimal Active Recall prompt for a concept, cycling through candidates.
 */
export function getActiveRecallQuestionForConcept(
  ctx: QuestionGenerationContext,
  previouslyAnsweredQuestionIds?: Set<string> | string[]
): ActiveRecallQuestion | null {
  const candidates = generateActiveRecallQuestions(ctx);
  if (candidates.length === 0) {
    return null;
  }

  const answeredSet = previouslyAnsweredQuestionIds instanceof Set
    ? previouslyAnsweredQuestionIds
    : new Set(previouslyAnsweredQuestionIds || []);

  const unpracticed = candidates.filter(q => !answeredSet.has(q.id));
  if (unpracticed.length > 0) {
    return unpracticed[0];
  }

  return candidates[0];
}

/**
 * Intelligent Next Concept Selection (Phase 4 Section 11)
 * Preference order:
 * 1. directly connected concepts
 * 2. concepts related through active relationships
 * 3. concepts not yet tested
 * 4. concepts marked for review later
 */
export interface FindNextRecallConceptParams {
  currentConceptId: string;
  allNodes: Array<{ id: string; data?: { relationships?: Array<{ targetId: string }> } }>;
  allEdges?: Array<{ source: string; target: string }>;
  testedConceptIds?: Set<string> | string[];
  reviewConceptIds?: Set<string> | string[];
  recalledConceptIds?: Set<string> | string[];
  practiceStates?: Record<string, { status?: string }>;
}

export function findNextRecallConceptId(
  paramsOrCurrentId: FindNextRecallConceptParams | string,
  maybeNodes?: Array<any>,
  maybeSessionOrEdges?: any,
  maybeEdges?: Array<any>,
  maybePracticeStates?: Record<string, { status?: string }>
): string | null {
  let currentConceptId: string;
  let allNodes: Array<any>;
  let allEdges: Array<{ source: string; target: string }> = [];
  let testedConceptIds: Set<string> | string[] | undefined;
  let reviewConceptIds: Set<string> | string[] | undefined;
  let practiceStates: Record<string, { status?: string }> = {};

  if (typeof paramsOrCurrentId === 'object' && paramsOrCurrentId !== null) {
    currentConceptId = paramsOrCurrentId.currentConceptId;
    allNodes = paramsOrCurrentId.allNodes || [];
    allEdges = paramsOrCurrentId.allEdges || [];
    testedConceptIds = paramsOrCurrentId.testedConceptIds;
    reviewConceptIds = paramsOrCurrentId.reviewConceptIds;
    practiceStates = paramsOrCurrentId.practiceStates || {};
  } else {
    currentConceptId = paramsOrCurrentId;
    allNodes = maybeNodes || [];
    if (maybeSessionOrEdges && Array.isArray(maybeSessionOrEdges)) {
      allEdges = maybeSessionOrEdges;
      practiceStates = maybePracticeStates || {};
    } else if (maybeSessionOrEdges && typeof maybeSessionOrEdges === 'object') {
      testedConceptIds = maybeSessionOrEdges.testedConceptIds;
      reviewConceptIds = maybeSessionOrEdges.reviewConceptIds;
      allEdges = maybeEdges || [];
      practiceStates = maybePracticeStates || {};
    }
  }

  if (!allNodes || allNodes.length === 0) return null;
  if (allNodes.length === 1) return allNodes[0].id;

  const testedSet = testedConceptIds instanceof Set ? testedConceptIds : new Set(testedConceptIds || []);
  const reviewSet = reviewConceptIds instanceof Set ? reviewConceptIds : new Set(reviewConceptIds || []);

  // 1. Identify directly connected concept IDs
  const directNeighborIds = new Set<string>();

  // From edges
  for (const edge of allEdges) {
    if (edge.source === currentConceptId && edge.target !== currentConceptId) {
      directNeighborIds.add(edge.target);
    } else if (edge.target === currentConceptId && edge.source !== currentConceptId) {
      directNeighborIds.add(edge.source);
    }
  }

  // From node relationships or directConnections
  const currentNode = allNodes.find(n => n.id === currentConceptId);
  const nodeConnections = [
    ...(currentNode?.directConnections || []),
    ...(currentNode?.data?.directConnections || []),
    ...(currentNode?.relationships || []),
    ...(currentNode?.data?.relationships || [])
  ];

  for (const rel of nodeConnections) {
    const target = rel.targetId || rel.target;
    if (target && target !== currentConceptId) {
      directNeighborIds.add(target);
    }
  }

  // Also check reverse connections from other nodes
  for (const n of allNodes) {
    if (n.id === currentConceptId) continue;
    const otherConnections = [
      ...(n.directConnections || []),
      ...(n.data?.directConnections || []),
      ...(n.relationships || []),
      ...(n.data?.relationships || [])
    ];
    for (const rel of otherConnections) {
      const target = rel.targetId || rel.target;
      if (target === currentConceptId) {
        directNeighborIds.add(n.id);
      }
    }
  }

  // Filter to valid node IDs that exist in allNodes
  const validNeighbors = Array.from(directNeighborIds).filter(id => allNodes.some(n => n.id === id));

  // Step 1: Directly connected concepts not yet tested
  const untestedNeighbors = validNeighbors.filter(id => !testedSet.has(id));
  if (untestedNeighbors.length > 0) {
    return untestedNeighbors[0];
  }

  // Step 2: Directly connected concepts marked for review
  const reviewNeighbors = validNeighbors.filter(id => reviewSet.has(id));
  if (reviewNeighbors.length > 0) {
    return reviewNeighbors[0];
  }

  // Step 3: Directly connected concepts needing review from persistence
  const persistentReviewNeighbors = validNeighbors.filter(id => practiceStates[id]?.status === 'needs-review');
  if (persistentReviewNeighbors.length > 0) {
    return persistentReviewNeighbors[0];
  }

  // Step 4: Other concepts in the graph not yet tested
  const otherUntestedNodes = allNodes.filter(n => n.id !== currentConceptId && !testedSet.has(n.id));
  if (otherUntestedNodes.length > 0) {
    return otherUntestedNodes[0].id;
  }

  // Step 5: Other concepts in the graph marked for review in this session
  const otherReviewNodes = allNodes.filter(n => n.id !== currentConceptId && reviewSet.has(n.id));
  if (otherReviewNodes.length > 0) {
    return otherReviewNodes[0].id;
  }

  // Step 6: Other concepts in the graph needing review from persistence
  const otherPersistentReview = allNodes.filter(n => n.id !== currentConceptId && practiceStates[n.id]?.status === 'needs-review');
  if (otherPersistentReview.length > 0) {
    return otherPersistentReview[0].id;
  }

  // Step 7: Any valid neighbor
  if (validNeighbors.length > 0) {
    return validNeighbors[0];
  }

  // Step 8: Any other node in the graph
  const remaining = allNodes.filter(n => n.id !== currentConceptId);
  if (remaining.length > 0) {
    return remaining[0].id;
  }

  return currentConceptId;
}

