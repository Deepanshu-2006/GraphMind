import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelationship } from '../types/knowledgeGraph';
import type { 
  TestQuestion, 
  TestQuestionType, 
  TestOption, 
  KnowledgeTest, 
  TestGenerationResult 
} from '../types/test';
import { getIntelligentDistractors } from './practiceQuestionGenerator';

/**
 * Clean text by stripping markdown headers, excessive whitespace, etc.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shuffles an array with a deterministic or random seed.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Checks whether a node has sufficient authentic content for question generation.
 */
function isValidConceptNode(node: KnowledgeNode): boolean {
  if (!node || !node.name || node.name.trim().length === 0) return false;
  const desc = node.description ? cleanText(node.description) : '';
  const evidence = node.evidence ? cleanText(node.evidence) : '';
  return desc.length >= 20 || evidence.length >= 20;
}

/**
 * Formats 4 options with '01', '02', '03', '04' IDs and determines the correctOptionId.
 */
function createFourOptions(
  correctText: string,
  distractorTexts: string[]
): { options: TestOption[]; correctOptionId: string } {
  // Ensure we have exactly 3 unique distractors different from correctText
  const normalizedCorrect = correctText.toLowerCase().trim();
  const uniqueDistractors: string[] = [];
  const seen = new Set<string>([normalizedCorrect]);

  for (const d of distractorTexts) {
    const norm = d.toLowerCase().trim();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      uniqueDistractors.push(d);
    }
    if (uniqueDistractors.length === 3) break;
  }

  // If not enough unique distractors, options cannot be properly formed
  if (uniqueDistractors.length < 3) {
    return { options: [], correctOptionId: '' };
  }

  const rawOptions = [
    { text: correctText, isCorrect: true },
    { text: uniqueDistractors[0], isCorrect: false },
    { text: uniqueDistractors[1], isCorrect: false },
    { text: uniqueDistractors[2], isCorrect: false }
  ];

  const shuffled = shuffleArray(rawOptions);
  const optionSlots = ['01', '02', '03', '04'];
  let correctOptionId = '01';

  const options: TestOption[] = shuffled.map((item, index) => {
    const slotId = optionSlots[index];
    if (item.isCorrect) {
      correctOptionId = slotId;
    }
    return {
      id: slotId,
      text: item.text
    };
  });

  return { options, correctOptionId };
}

/**
 * 1. Generate a Concept Understanding Question
 * e.g., "Which concept is defined as: '[clean description]'?"
 */
function generateConceptUnderstandingQuestion(
  node: KnowledgeNode,
  allNodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
  sources: KnowledgeGraph['sources']
): TestQuestion | null {
  const desc = cleanText(node.description || node.evidence || '');
  if (desc.length < 20) return null;

  // Retrieve intelligent distractors (names)
  const distractors = getIntelligentDistractors(
    node.id,
    node.name,
    allNodes,
    node.type,
    relationships
      .filter(r => r.source === node.id || r.target === node.id)
      .map(r => ({
        id: r.source === node.id ? r.target : r.source,
        name: allNodes.find(n => n.id === (r.source === node.id ? r.target : r.source))?.name || ''
      })),
    4
  ).map(d => d.name);

  if (distractors.length < 3) return null;

  const { options, correctOptionId } = createFourOptions(node.name, distractors);
  if (options.length !== 4) return null;

  const matchedSource = sources.find(s => node.sourceIds?.includes(s.id));
  const evidenceExcerpt = node.evidence || node.evidenceItems?.[0]?.text || node.description;

  return {
    id: `q-concept-${node.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'concept',
    question: `Which concept is described as: "${desc}"?`,
    options,
    correctOptionId,
    explanation: `${node.name}: ${desc}`,
    conceptIds: [node.id],
    conceptNames: [node.name],
    sourceIds: node.sourceIds || [],
    sourceChunkIds: node.sourceChunkIds,
    sourceEvidence: evidenceExcerpt,
    sourceName: matchedSource?.name || matchedSource?.fileName || 'Uploaded study material',
    page: node.evidenceItems?.[0]?.page
  };
}

/**
 * 2. Generate a Relationship Understanding Question
 * e.g., "Which concept is directly connected to [Source Concept] via [relationship label]?"
 */
function generateRelationshipQuestion(
  rel: KnowledgeRelationship,
  allNodes: KnowledgeNode[],
  allRels: KnowledgeRelationship[],
  sources: KnowledgeGraph['sources']
): TestQuestion | null {
  const sourceNode = allNodes.find(n => n.id === rel.source);
  const targetNode = allNodes.find(n => n.id === rel.target);
  if (!sourceNode || !targetNode) return null;

  const relLabel = cleanText(rel.label || rel.type || rel.description || 'connected to');
  if (!relLabel) return null;

  // Find distractors for the target concept
  const distractors = getIntelligentDistractors(
    targetNode.id,
    targetNode.name,
    allNodes,
    targetNode.type,
    allRels
      .filter(r => r.source === targetNode.id || r.target === targetNode.id)
      .map(r => ({
        id: r.source === targetNode.id ? r.target : r.source,
        name: allNodes.find(n => n.id === (r.source === targetNode.id ? r.target : r.source))?.name || ''
      })),
    4
  ).filter(d => d.name.toLowerCase() !== sourceNode.name.toLowerCase()).map(d => d.name);

  if (distractors.length < 3) return null;

  const { options, correctOptionId } = createFourOptions(targetNode.name, distractors);
  if (options.length !== 4) return null;

  const matchedSource = sources.find(s => rel.sourceIds?.includes(s.id) || sourceNode.sourceIds?.includes(s.id));
  const relDesc = rel.description || `${sourceNode.name} has relationship "${relLabel}" with ${targetNode.name}.`;

  return {
    id: `q-rel-${rel.id || `${rel.source}-${rel.target}`}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'relationship',
    question: `According to your knowledge graph, which concept has a "${relLabel}" relationship with ${sourceNode.name}?`,
    options,
    correctOptionId,
    explanation: relDesc,
    conceptIds: [sourceNode.id, targetNode.id],
    conceptNames: [sourceNode.name, targetNode.name],
    relationshipIds: [rel.id],
    sourceIds: rel.sourceIds || sourceNode.sourceIds || [],
    sourceChunkIds: rel.sourceChunkIds,
    sourceEvidence: rel.evidence || relDesc,
    sourceName: matchedSource?.name || matchedSource?.fileName || 'Uploaded study material'
  };
}

/**
 * 3. Generate an Application / Mechanics Question
 * Grounded in operational/functional evidence of a concept.
 */
function generateApplicationQuestion(
  node: KnowledgeNode,
  allNodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
  sources: KnowledgeGraph['sources']
): TestQuestion | null {
  const evidence = cleanText(node.evidence || node.evidenceItems?.[0]?.text || node.description || '');
  if (evidence.length < 25) return null;

  const distractors = getIntelligentDistractors(
    node.id,
    node.name,
    allNodes,
    node.type,
    relationships
      .filter(r => r.source === node.id || r.target === node.id)
      .map(r => ({
        id: r.source === node.id ? r.target : r.source,
        name: allNodes.find(n => n.id === (r.source === node.id ? r.target : r.source))?.name || ''
      })),
    4
  ).map(d => d.name);

  if (distractors.length < 3) return null;

  const { options, correctOptionId } = createFourOptions(node.name, distractors);
  if (options.length !== 4) return null;

  const matchedSource = sources.find(s => node.sourceIds?.includes(s.id));

  return {
    id: `q-app-${node.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'application',
    question: `Based on your study material, which concept or mechanism operates as follows: "${evidence}"?`,
    options,
    correctOptionId,
    explanation: `${node.name}: ${evidence}`,
    conceptIds: [node.id],
    conceptNames: [node.name],
    sourceIds: node.sourceIds || [],
    sourceChunkIds: node.sourceChunkIds,
    sourceEvidence: evidence,
    sourceName: matchedSource?.name || matchedSource?.fileName || 'Uploaded study material',
    page: node.evidenceItems?.[0]?.page
  };
}

/**
 * 4. Generate a Comparison Question
 * Compares two distinct concepts from the graph.
 */
function generateComparisonQuestion(
  node: KnowledgeNode,
  allNodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[],
  sources: KnowledgeGraph['sources']
): TestQuestion | null {
  const nodeDesc = cleanText(node.description || node.evidence || '');
  if (nodeDesc.length < 20) return null;

  // Find a distinct peer concept in the same category or a neighbor
  const candidatePeers = allNodes.filter(n => 
    n.id !== node.id && 
    isValidConceptNode(n) && 
    (n.type === node.type || relationships.some(r => (r.source === node.id && r.target === n.id) || (r.target === node.id && r.source === n.id)))
  );

  if (candidatePeers.length === 0) return null;
  const peer = candidatePeers[Math.floor(Math.random() * candidatePeers.length)];
  const peerDesc = cleanText(peer.description || peer.evidence || '');
  if (peerDesc.length < 15) return null;

  const distractors = getIntelligentDistractors(
    node.id,
    node.name,
    allNodes,
    node.type,
    relationships
      .filter(r => r.source === node.id || r.target === node.id)
      .map(r => ({
        id: r.source === node.id ? r.target : r.source,
        name: allNodes.find(n => n.id === (r.source === node.id ? r.target : r.source))?.name || ''
      })),
    4
  ).map(d => d.name);

  if (distractors.length < 3) return null;

  const { options, correctOptionId } = createFourOptions(node.name, distractors);
  if (options.length !== 4) return null;

  const matchedSource = sources.find(s => node.sourceIds?.includes(s.id));

  return {
    id: `q-comp-${node.id}-${peer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'comparison',
    question: `In contrast to ${peer.name} (${peerDesc.slice(0, 75)}…), which concept is specifically defined by: "${nodeDesc}"?`,
    options,
    correctOptionId,
    explanation: `${node.name}: ${nodeDesc}. Contrast with ${peer.name}: ${peerDesc}`,
    conceptIds: [node.id, peer.id],
    conceptNames: [node.name, peer.name],
    sourceIds: node.sourceIds || [],
    sourceChunkIds: node.sourceChunkIds,
    sourceEvidence: node.evidence || nodeDesc,
    sourceName: matchedSource?.name || matchedSource?.fileName || 'Uploaded study material',
    page: node.evidenceItems?.[0]?.page
  };
}

export interface GenerateTestOptions {
  questionCount?: number;
  timeLimitSeconds?: number;
  title?: string;
}

/**
 * Generates an authentic academic MCQ test grounded strictly in the Knowledge Graph.
 * Never invents facts or unrelated questions.
 */
export function generateKnowledgeTest(
  graph: KnowledgeGraph | null | undefined,
  options: GenerateTestOptions = {}
): TestGenerationResult {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return {
      success: false,
      reason: 'no_graph',
      message: 'No knowledge graph available to generate a test.'
    };
  }

  const validNodes = graph.nodes.filter(isValidConceptNode);
  // Need at least 4 valid concepts with descriptions/evidence to form proper 4-option MCQs
  if (validNodes.length < 4) {
    return {
      success: false,
      reason: 'insufficient_material',
      message: 'Not enough material to create a full test yet.'
    };
  }

  const targetQuestionCount = options.questionCount || 10;
  const timeLimitSeconds = options.timeLimitSeconds || (targetQuestionCount * 60); // 1 minute per question default (10 mins for 10 questions)
  const candidateQuestions: TestQuestion[] = [];
  const relationships = graph.relationships || [];
  const sources = graph.sources || [];

  // Track concept usage to ensure wide distribution across the graph
  const conceptUsageCount = new Map<string, number>();

  // Pass 1: Generate Concept Understanding questions across distinct nodes
  for (const node of validNodes) {
    const q = generateConceptUnderstandingQuestion(node, validNodes, relationships, sources);
    if (q) {
      candidateQuestions.push(q);
      conceptUsageCount.set(node.id, (conceptUsageCount.get(node.id) || 0) + 1);
    }
  }

  // Pass 2: Generate Relationship Understanding questions from real edges
  const shuffledRels = shuffleArray(relationships);
  for (const rel of shuffledRels) {
    const q = generateRelationshipQuestion(rel, validNodes, relationships, sources);
    if (q) {
      candidateQuestions.push(q);
    }
  }

  // Pass 3: Generate Application / Mechanics questions
  for (const node of validNodes) {
    if ((conceptUsageCount.get(node.id) || 0) < 2) {
      const q = generateApplicationQuestion(node, validNodes, relationships, sources);
      if (q) {
        candidateQuestions.push(q);
        conceptUsageCount.set(node.id, (conceptUsageCount.get(node.id) || 0) + 1);
      }
    }
  }

  // Pass 4: Generate Comparison questions
  for (const node of validNodes) {
    if ((conceptUsageCount.get(node.id) || 0) < 2) {
      const q = generateComparisonQuestion(node, validNodes, relationships, sources);
      if (q) {
        candidateQuestions.push(q);
        conceptUsageCount.set(node.id, (conceptUsageCount.get(node.id) || 0) + 1);
      }
    }
  }

  // Check if we have at least 3 legitimate questions to form an assessment
  if (candidateQuestions.length < 3) {
    return {
      success: false,
      reason: 'insufficient_material',
      message: 'Not enough material to create a full test yet.'
    };
  }

  // Distribute questions intelligently across question types and concepts
  const shuffledCandidates = shuffleArray(candidateQuestions);
  const selectedQuestions: TestQuestion[] = [];
  const selectedQuestionSignatures = new Set<string>();
  const finalConceptUsage = new Map<string, number>();

  // Group by question type to ensure a healthy balance
  const byType: Record<TestQuestionType, TestQuestion[]> = {
    concept: [],
    relationship: [],
    application: [],
    comparison: []
  };

  for (const q of shuffledCandidates) {
    byType[q.type].push(q);
  }

  // Round-robin selection across question types, prioritizing concepts not yet over-represented
  const typesOrder: TestQuestionType[] = ['concept', 'relationship', 'application', 'comparison'];
  let addedAny = true;

  while (selectedQuestions.length < targetQuestionCount && addedAny) {
    addedAny = false;
    for (const type of typesOrder) {
      if (selectedQuestions.length >= targetQuestionCount) break;

      const candidatesOfType = byType[type];
      // Find candidate that minimally repeats concepts
      let bestIndex = -1;
      let minConceptUsage = Infinity;

      for (let i = 0; i < candidatesOfType.length; i++) {
        const cand = candidatesOfType[i];
        const sig = `${cand.type}:${cand.question}`;
        if (selectedQuestionSignatures.has(sig)) continue;

        const primaryConceptId = cand.conceptIds[0];
        const usage = finalConceptUsage.get(primaryConceptId) || 0;
        if (usage < minConceptUsage) {
          minConceptUsage = usage;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1) {
        const chosen = candidatesOfType.splice(bestIndex, 1)[0];
        const sig = `${chosen.type}:${chosen.question}`;
        selectedQuestionSignatures.add(sig);
        selectedQuestions.push(chosen);
        for (const cId of chosen.conceptIds) {
          finalConceptUsage.set(cId, (finalConceptUsage.get(cId) || 0) + 1);
        }
        addedAny = true;
      }
    }
  }

  // If still need questions to reach target and have remaining unused candidates, add them
  if (selectedQuestions.length < targetQuestionCount) {
    for (const cand of shuffledCandidates) {
      if (selectedQuestions.length >= targetQuestionCount) break;
      const sig = `${cand.type}:${cand.question}`;
      if (!selectedQuestionSignatures.has(sig)) {
        selectedQuestionSignatures.add(sig);
        selectedQuestions.push(cand);
      }
    }
  }

  if (selectedQuestions.length < 3) {
    return {
      success: false,
      reason: 'insufficient_material',
      message: 'Not enough material to create a full test yet.'
    };
  }

  // Determine covered concepts
  const coveredConceptNamesSet = new Set<string>();
  for (const q of selectedQuestions) {
    for (const name of q.conceptNames) {
      coveredConceptNamesSet.add(name);
    }
  }

  const testTitle = options.title || graph.name || 'Knowledge Graph Assessment';
  const testId = `test-${graph.id || 'current'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const test: KnowledgeTest = {
    id: testId,
    graphId: graph.id || 'default_graph',
    title: testTitle,
    questions: selectedQuestions,
    timeLimitSeconds,
    startedAt: new Date().toISOString(),
    answers: {},
    flaggedQuestionIds: []
  };

  return {
    success: true,
    test,
    conceptsCovered: Array.from(coveredConceptNamesSet)
  };
}
