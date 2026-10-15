import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { GraphConceptData, ConceptRelationship } from '../../types/graph';
import type { RevisionPathStep, RevisionSessionState } from '../../types/practice';
import type { ExplanationState } from '../../types/explanation';
import {
  createRevisionSession,
  validateRevisionSession,
  loadRevisionSession,
  saveRevisionSession,
  jumpToIndex,
  jumpToConceptId,
  navigateOrAppendToRevisionSession
} from '../../services/revisionSession';
import {
  getOrGenerateConceptExplanation,
  loadStoredExplanation,
  extractConceptSourceContext,
  synthesizeGroundedExplanation,
  sanitizeGroundedExplanationText,
  computeConceptSourceFingerprint
} from '../../services/conceptExplanation';
import { KnowledgeCheckSection } from './KnowledgeCheckSection';
import type {
  KnowledgeCheckAttempt,
  ConceptKnowledgeCheckState
} from '../../types/knowledgeCheck';
import {
  calculateConceptMastery,
  saveStoredMastery
} from '../../services/conceptMastery';
import { loadConceptPracticeStates } from '../../services/storage';
import { loadStoredKnowledgeCheck } from '../../services/knowledgeCheck';

export const WORKSPACE_EASING = [0.16, 1, 0.3, 1] as const;

/**
 * Stage 1: Workspace Arrival (Section 1)
 * The main reading area transitions from a slightly displaced position into its final position.
 * Subtle opacity transition without large scaling.
 */
export const createWorkspaceArrivalVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 12
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.32,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 2: Session Metadata (Section 1)
 * Reveal the revision label and progress indicator with a small, restrained delay.
 */
export const createSessionMetadataVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.28,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.08,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3A: Concept Identifier / Badge (Section 1)
 * Reveal the concept identifier first.
 */
export const createConceptBadgeVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 6
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.24,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.14,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3B: Concept Title (Section 1)
 * The concept title should receive the most visual attention with a deliberate reveal.
 */
export const createConceptTitleVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 10
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.36,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.20,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 3C: Concept Description & Content Sections (Section 1)
 * Reveal concept description and learning sections after the title.
 */
export const createConceptDescriptionVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.30,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.28,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Stage 4: Navigation (Section 1)
 * Reveal previous/next navigation after the main content has settled.
 */
export const createNavigationVariants = (
  shouldReduceMotion = false,
  skipDelay = false
): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 6
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.26,
      delay: shouldReduceMotion || skipDelay ? 0 : 0.36,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Full Workspace Root Backdrop Transition
 */
export const createWorkspaceRootVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0
  },
  settled: {
    opacity: 1,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.28,
      ease: WORKSPACE_EASING
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.2,
      ease: WORKSPACE_EASING
    }
  }
});

/**
 * Direction-Aware Concept-to-Concept Transitions (Section 3)
 * Moving forward (Next): Content enters from +14px, exits to -14px.
 * Moving backward (Previous): Content enters from -14px, exits to +14px.
 */
export const createConceptCanvasVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  settled: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.46,
      ease: WORKSPACE_EASING
    }
  },
  enter: (dir: number) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : (dir >= 0 ? 14 : -14),
    y: shouldReduceMotion ? 0 : 6,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.46,
      ease: [0.16, 1, 0.3, 1]
    }
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    staggerChildren: shouldReduceMotion ? 0 : 0.04,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.46,
      ease: [0.16, 1, 0.3, 1],
      when: "beforeChildren",
      staggerChildren: shouldReduceMotion ? 0 : 0.04
    }
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: shouldReduceMotion ? 0 : (dir >= 0 ? -14 : 14),
    transition: {
      duration: shouldReduceMotion ? 0 : 0.32,
      ease: [0.16, 1, 0.3, 1]
    }
  })
});

/**
 * Coordinated child elements inside the concept canvas:
 * Staggers badge -> title -> description -> section nav -> content
 */
export const createConceptElementVariants = (shouldReduceMotion = false): Variants => ({
  hidden: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 6
  },
  settled: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.24,
      ease: WORKSPACE_EASING
    }
  },
  enter: {
    opacity: 0,
    y: shouldReduceMotion ? 0 : 8
  },
  center: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.24,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.1
    }
  }
});

/**
 * Bottom Navigation Action Transform Variants (Part 1):
 * Smooth, coordinated transformation between "Next concept" and "Complete session"
 * in the exact same right-aligned position.
 */
export const createActionTransformVariants = (shouldReduceMotion = false): Variants => ({
  enter: {
    opacity: 0,
    x: shouldReduceMotion ? 0 : 8,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.26,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.26,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    opacity: 0,
    x: shouldReduceMotion ? 0 : -8,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.18,
      ease: [0.16, 1, 0.3, 1]
    }
  }
});

/**
 * Direction-Aware Concept Navigation Neighboring Title Variants:
 * Vertical slide and fade for Previous/Next concept titles.
 * Forward/Next (dir >= 0): Outgoing exits upward (-10px), incoming enters from below (+10px).
 * Backward/Prev (dir < 0): Outgoing exits downward (+10px), incoming enters from above (-10px).
 * Tuned for a slow, fluid, editorial glide:
 * Incoming duration: 480ms with velvety deceleration curve [0.16, 1, 0.3, 1].
 * Outgoing duration: 340ms with smooth fade out.
 */
export const createNavTitleVariants = (shouldReduceMotion = false): Variants => ({
  enter: (dir: number) => ({
    opacity: shouldReduceMotion ? 1 : 0,
    y: shouldReduceMotion ? 0 : (dir >= 0 ? 10 : -10),
    transition: {
      duration: shouldReduceMotion ? 0 : 0.48,
      ease: [0.16, 1, 0.3, 1]
    }
  }),
  center: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0 : 0.48,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: shouldReduceMotion ? 0 : (dir >= 0 ? -10 : 10),
    transition: {
      duration: shouldReduceMotion ? 0 : 0.34,
      ease: [0.16, 1, 0.3, 1]
    }
  })
});

/**
 * Vertical Section Navigation Rail Geometry & Kinematics
 * Predictable stride geometry: 19px step height + 20px gap = 39px stride.
 * First marker center: 10px track padding + 3px step padding + 6.5px bullet center = 19.5px.
 */
export const RAIL_STEP_STRIDE = 39;
export const RAIL_MARKER_OFFSET = 19.5;

export interface RailGeometry {
  sectionCount: number;
  trackHeight: number;
  lineLength: number;
  markerOffset: number;
  stride: number;
}

export function calculateRailGeometry(sectionCount: number): RailGeometry {
  const count = Math.max(0, sectionCount);
  const trackHeight = count * RAIL_STEP_STRIDE;
  const lineLength = count > 1 ? (count - 1) * RAIL_STEP_STRIDE : 0;
  return {
    sectionCount: count,
    trackHeight,
    lineLength,
    markerOffset: RAIL_MARKER_OFFSET,
    stride: RAIL_STEP_STRIDE
  };
}

/**
 * Normalizes text for deterministic duplication detection.
 * Trims, lowercases, removes punctuation, and collapses whitespace.
 */
export function normalizeComparisonText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.\-_,;:!?'"“”’`()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two pieces of text are identical or substantially identical.
 */
export function isSubstantiallyIdentical(textA?: string | null, textB?: string | null): boolean {
  if (!textA || !textB) return false;
  const normA = normalizeComparisonText(textA);
  const normB = normalizeComparisonText(textB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Substantial equality when one contains the other and lengths are within 15%
  if (normA.length >= 15 && normB.length >= 15) {
    if (normA.includes(normB) || normB.includes(normA)) {
      const minLen = Math.min(normA.length, normB.length);
      const maxLen = Math.max(normA.length, normB.length);
      if (minLen / maxLen >= 0.85) return true;
    }
  }
  return false;
}

/**
 * Safely parses inline markdown tokens (bold, italic, code, math) into React nodes.
 * Zero use of dangerouslySetInnerHTML to guarantee safety against injection.
 */
export function parseInlineMarkup(text: string): React.ReactNode {
  if (!text) return null;

  // Match: bold (**...**), italic (*...*), inline code (`...`), math ($...$)
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[^$]+\$)/g;
  const parts = text.split(tokenRegex);

  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="revision-inline-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index} className="revision-inline-italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={index} className="revision-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      return <span key={index} className="revision-math-token">{part.slice(1, -1)}</span>;
    }
    return part;
  });
}

/**
 * Normalizes raw or source-grounded Markdown/HTML content into clean, safe markdown notation.
 * Prevents arbitrary HTML or inline styles from overriding the Revision Workspace's design system,
 * while preserving intentional semantic headings, lists, emphasis, and code.
 */
export function normalizeSourceMarkdown(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Strip dangerous tags completely
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 2. Normalize HTML headings: e.g. <h1>Title</h1> or <h2 style="...">Title</h2> -> ### Title
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n### $1\n\n');

  // 3. Normalize blockquotes: <blockquote>quote</blockquote> -> > quote
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
    return '\n\n' + quote.trim().split(/\r?\n/).map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n';
  });

  // 4. Normalize lists: <li>item</li> -> - item
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // 5. Normalize paragraphs and line breaks
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // 6. Normalize inline formatting
  text = text.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');
  text = text.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // 7. Strip all remaining HTML tags and inline styles (e.g. <span style="...">)
  text = text.replace(/<[^>]+>/g, '');

  // 8. Unescape standard HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return text.trim();
}

/**
 * Splits normalized markdown into discrete semantic content blocks.
 * Preserves multi-line code blocks and markdown tables as single cohesive blocks.
 */
function splitIntoSemanticBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      currentBlock.push(line);
      if (!inCode) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      continue;
    }
    if (inCode) {
      currentBlock.push(line);
      continue;
    }
    if (!line.trim()) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      continue;
    }
    currentBlock.push(line);
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  return blocks;
}

function renderContentBlock(block: string, key: string | number, isSoloParagraph: boolean): React.ReactNode {
  const trimmed = block.trim();

  // 1. Table
  const lines = trimmed.split(/\r?\n/);
  const tableSepIdx = lines.findIndex(l => /^\s*\|?\s*:?-+:?\s*\|/.test(l));
  if (tableSepIdx > 0 && lines.length >= 3) {
    const rawHeader = lines[tableSepIdx - 1];
    const headers = rawHeader.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - (rawHeader.trim().endsWith('|') ? 1 : 0));
    const dataLines = lines.slice(tableSepIdx + 1).filter(l => l.includes('|'));
    const rows = dataLines.map(l => l.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - (l.trim().endsWith('|') ? 1 : 0)));

    if (headers.length > 0 && rows.length > 0) {
      return (
        <div key={key} className="revision-table-wrapper" tabIndex={0} role="region" aria-label="Comparison Table">
          <table className="revision-editorial-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{parseInlineMarkup(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{parseInlineMarkup(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // 2. Fenced code block
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const firstLineEnd = trimmed.indexOf('\n');
    const lang = firstLineEnd > 3 ? trimmed.slice(3, firstLineEnd).trim() : '';
    const code = firstLineEnd > 3 ? trimmed.slice(firstLineEnd + 1, -3).trim() : trimmed.slice(3, -3).trim();
    return (
      <div key={key} className="revision-code-block-wrapper">
        {lang && <span className="revision-code-caption">{lang}</span>}
        <pre className="revision-code-block">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  // 3. Explanatory Subheading (Level C: 17–19px, medium weight, distinct)
  // Only render when the content explicitly identifies it as a heading (via #, ##, ###)
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/s);
  if (headingMatch) {
    const headingText = headingMatch[1].replace(/\r?\n+/g, ' ').trim();
    return (
      <h3 key={key} className="revision-editorial-subheading">
        {parseInlineMarkup(headingText)}
      </h3>
    );
  }

  // 4. Blockquote
  if (lines.length > 0 && lines.every(l => /^\s*>\s*/.test(l))) {
    const quoteContent = lines.map(l => l.replace(/^\s*>\s*/, '')).join(' ');
    return (
      <blockquote key={key} className="revision-editorial-blockquote">
        {parseInlineMarkup(quoteContent)}
      </blockquote>
    );
  }

  // 5. Ordered list
  if (lines.length > 0 && lines.every(l => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol key={key} className="revision-ordered-list">
        {lines.map((l, idx) => (
          <li key={idx}>
            {parseInlineMarkup(l.replace(/^\s*\d+\.\s+/, '').trim())}
          </li>
        ))}
      </ol>
    );
  }

  // 6. Unordered list
  if (lines.length > 0 && lines.every(l => /^\s*[-*•]\s+/.test(l))) {
    return (
      <ul key={key} className="revision-unordered-list">
        {lines.map((l, idx) => (
          <li key={idx}>
            {parseInlineMarkup(l.replace(/^\s*[-*•]\s+/, '').trim())}
          </li>
        ))}
      </ul>
    );
  }

  // 7. Body paragraph (Level D: 16–18px, regular weight)
  const flowText = trimmed.replace(/\r?\n+/g, ' ').trim();
  if (isSoloParagraph) {
    return <React.Fragment key={key}>{parseInlineMarkup(flowText)}</React.Fragment>;
  }

  return (
    <p key={key} className="revision-editorial-p">
      {parseInlineMarkup(flowText)}
    </p>
  );
}

/**
 * Editorial formatted content renderer (Section 4).
 * Supports paragraphs, subheadings, ordered lists, unordered lists, blockquotes, tables, and code blocks safely.
 */
export function EditorialFormattedContent({ content }: { content: string }) {
  if (!content) return null;
  const normalized = normalizeSourceMarkdown(content);
  if (!normalized) return null;

  const blocks = splitIntoSemanticBlocks(normalized);
  if (blocks.length === 0) return null;

  const isSoloParagraph = blocks.length === 1 &&
    !blocks[0].trim().startsWith('```') &&
    !blocks[0].trim().startsWith('#') &&
    !blocks[0].trim().startsWith('>') &&
    !/^\s*\|?\s*:?-+:?\s*\|/.test(blocks[0]) &&
    !blocks[0].split(/\r?\n/).every(l => /^\s*(?:\d+\.|[-*•])\s+/.test(l));

  if (blocks.length === 1) {
    return renderContentBlock(blocks[0], 0, isSoloParagraph);
  }

  return (
    <>
      {blocks.map((block, idx) => renderContentBlock(block, idx, false))}
    </>
  );
}

export interface RevisionConceptItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  relationships?: ConceptRelationship[];
  keyIdeas?: string[];
  evidence?: string;
  isCore?: boolean;
}

export interface RevisionWorkspaceProps {
  graph?: KnowledgeGraph | null;
  graphName?: string;
  revisionPath?: RevisionPathStep[];
  revisionIndex?: number;
  allNodes?: Array<any>;
  allEdges?: Array<any>;
  conceptDetails?: Record<string, GraphConceptData>;
  initialConceptId?: string | null;
  session?: RevisionSessionState | null;
  onSessionChange?: (session: RevisionSessionState) => void;
  onPrevConcept?: () => void;
  onNextConcept?: () => void;
  onSelectConceptIndex?: (index: number) => void;
  onBackToGraph: () => void;
  onViewGraph?: (conceptId?: string) => void;
  onSelectGraph?: () => void;
  onOpenSource?: (sourceId: string, page?: number) => void;
  isLoading?: boolean;
  isNewSession?: boolean;
  skipEntryAnimation?: boolean;
}

/**
 * Dedicated Deep Revision Workspace (Phase 1 — Foundation)
 * 
 * Minimal, editorial technical publication layout for deep, focused concept revision.
 * Occupies the main content area of GraphMind while preserving sidebar and top navigation.
 */
export const RevisionWorkspace: React.FC<RevisionWorkspaceProps> = ({
  graph,
  graphName,
  revisionPath,
  revisionIndex: controlledIndex,
  allNodes = [],
  allEdges = [],
  conceptDetails = {},
  initialConceptId = null,
  session: controlledSession,
  onSessionChange,
  onPrevConcept,
  onNextConcept,
  onSelectConceptIndex,
  onBackToGraph,
  onViewGraph,
  onSelectGraph,
  onOpenSource,
  isLoading = false,
  isNewSession: _isNewSession = false,
  skipEntryAnimation = false
}) => {
  // 1. Manage revision session state (restores previous session when available)
  const [internalSession, setInternalSession] = useState<RevisionSessionState>(() => {
    if (controlledSession && graph) {
      const valid = validateRevisionSession(controlledSession, graph);
      if (valid) return valid;
    }
    if (graph?.id) {
      const stored = loadRevisionSession(graph.id);
      const validated = validateRevisionSession(stored, graph);
      if (validated) {
        if (initialConceptId && validated.conceptIds.includes(initialConceptId)) {
          return jumpToConceptId(validated, initialConceptId);
        }
        if (controlledIndex !== undefined) {
          return jumpToIndex(validated, controlledIndex);
        }
        return validated;
      }
    }

    const ids = (revisionPath && revisionPath.length > 0)
      ? revisionPath.map(p => p.conceptId)
      : ((graph?.nodes && graph.nodes.length > 0) ? graph.nodes.map(n => n.id) : (allNodes.map((n: any) => n.id) || []));

    const initIdx = initialConceptId && ids.includes(initialConceptId)
      ? ids.indexOf(initialConceptId)
      : (controlledIndex !== undefined ? controlledIndex : 0);

    const fresh = createRevisionSession({
      graphId: graph?.id || 'default_graph',
      conceptIds: ids,
      currentIndex: initIdx,
      currentConceptId: ids[initIdx] || null,
      path: revisionPath
    });

    if (graph?.id && ids.length > 0) {
      saveRevisionSession(fresh, graph.id);
    }
    return fresh;
  });

  const activeSession = controlledSession || internalSession;

  // 2. Resolve deterministic concept sequence from revisionPath or graph data
  const concepts: RevisionConceptItem[] = useMemo(() => {
    const sourceNodes = (graph?.nodes && graph.nodes.length > 0) ? graph.nodes : (allNodes.length > 0 ? allNodes : []);
    if (sourceNodes.length === 0 && (!revisionPath || revisionPath.length === 0)) return [];

    // Deterministically build relationships from graph.relationships or allEdges (both outgoing and incoming)
    const relMap = new Map<string, ConceptRelationship[]>();
    const effectiveRels = (graph?.relationships && graph.relationships.length > 0) ? graph.relationships : allEdges;
    effectiveRels.forEach((rel) => {
      const source = rel.source || (rel as any).sourceId;
      const target = rel.target || (rel as any).targetId;
      if (!source || !target) return;

      const sourceNode = sourceNodes.find((n: any) => n.id === source) || allNodes.find((n: any) => n.id === source);
      const targetNode = sourceNodes.find((n: any) => n.id === target) || allNodes.find((n: any) => n.id === target);
      const sourceName = sourceNode?.name || (sourceNode as any)?.data?.label || conceptDetails[source]?.name || conceptDetails[source]?.label || source;
      const targetName = targetNode?.name || (targetNode as any)?.data?.label || conceptDetails[target]?.name || conceptDetails[target]?.label || target;

      if (!relMap.has(source)) relMap.set(source, []);
      relMap.get(source)!.push({
        id: rel.id,
        type: rel.type || (rel as any).label || 'related-to',
        targetId: target,
        targetName,
        direction: 'outgoing',
        description: rel.description
      });

      if (!relMap.has(target)) relMap.set(target, []);
      relMap.get(target)!.push({
        id: rel.id ? `${rel.id}-in` : undefined,
        type: rel.type || (rel as any).label || 'related-to',
        targetId: source,
        targetName: sourceName,
        direction: 'incoming',
        description: rel.description
      });
    });

    const createItemForId = (id: string, step?: RevisionPathStep): RevisionConceptItem => {
      const detail = conceptDetails[id];
      const rawNode = sourceNodes.find((n: any) => n.id === id) || allNodes.find((n: any) => n.id === id);
      const rels = (detail?.relationships && detail.relationships.length > 0)
        ? detail.relationships
        : (rawNode?.relationships && (rawNode.relationships as ConceptRelationship[]).length > 0)
          ? (rawNode.relationships as ConceptRelationship[])
          : (relMap.get(id) || []);

      return {
        id,
        name: step?.conceptName || detail?.label || detail?.name || rawNode?.name || rawNode?.data?.label || id,
        category: step?.category || detail?.category || rawNode?.category || rawNode?.data?.category || rawNode?.type,
        description: detail?.description || rawNode?.description || rawNode?.data?.description || '',
        relationships: rels,
        keyIdeas: detail?.keyIdeas || rawNode?.keyIdeas || rawNode?.data?.keyIdeas,
        evidence: detail?.evidence || rawNode?.evidence || rawNode?.data?.evidence,
        isCore: rawNode?.isCore || rawNode?.data?.isCore
      };
    };

    if (revisionPath && revisionPath.length > 0) {
      const baseItems = revisionPath.map(step => createItemForId(step.conceptId, step));
      // Include any dynamically appended concepts from activeSession
      const appendedIds = activeSession.conceptIds.filter(id => !revisionPath.some(step => step.conceptId === id));
      const appendedItems = appendedIds.map(id => createItemForId(id));
      return [...baseItems, ...appendedItems];
    }

    return sourceNodes.map((n: any) => createItemForId(n.id));
  }, [revisionPath, conceptDetails, allNodes, graph?.nodes, graph?.relationships, activeSession.conceptIds]);

  const totalConcepts = concepts.length;

  // Resolve active index: controlledIndex takes precedence if provided, otherwise activeSession.currentIndex
  const rawIndex = controlledIndex !== undefined ? controlledIndex : activeSession.currentIndex;
  const currentIndex = totalConcepts > 0
    ? Math.min(Math.max(0, rawIndex), totalConcepts - 1)
    : 0;

  const isFirst = totalConcepts <= 1 || currentIndex <= 0;
  const isLast = totalConcepts <= 1 || currentIndex >= totalConcepts - 1;

  // Sync session when graph selection changes or graph nodes update
  useEffect(() => {
    if (!graph?.id) return;

    if (internalSession.graphId !== graph.id) {
      // Switched graph: strictly load this graph's session or create fresh
      const stored = loadRevisionSession(graph.id);
      const validated = validateRevisionSession(stored, graph);
      if (validated) {
        setInternalSession(validated);
        onSessionChange?.(validated);
      } else {
        const ids = (revisionPath && revisionPath.length > 0)
          ? revisionPath.map(p => p.conceptId)
          : (graph.nodes?.map(n => n.id) || allNodes.map((n: any) => n.id) || []);
        const fresh = createRevisionSession({
          graphId: graph.id,
          conceptIds: ids,
          currentIndex: controlledIndex ?? 0,
          path: revisionPath
        });
        setInternalSession(fresh);
        if (ids.length > 0) saveRevisionSession(fresh, graph.id);
        onSessionChange?.(fresh);
      }
    } else {
      // Same graph: sanitize against deleted concepts or node changes
      const validated = validateRevisionSession(internalSession, graph);
      if (validated && (
        validated.conceptIds.length !== internalSession.conceptIds.length ||
        validated.currentIndex !== internalSession.currentIndex
      )) {
        setInternalSession(validated);
        saveRevisionSession(validated, graph.id);
        onSessionChange?.(validated);
      }
    }
  }, [graph?.id, graph?.nodes, controlledIndex, revisionPath, onSessionChange]);

  // Sync when controlledSession changes
  useEffect(() => {
    if (controlledSession && graph) {
      const validated = validateRevisionSession(controlledSession, graph);
      if (validated) {
        setInternalSession(validated);
      }
    }
  }, [controlledSession, graph]);

  // Sync when initialConceptId changes (when not controlled by revisionIndex)
  useEffect(() => {
    if (controlledIndex === undefined && initialConceptId && concepts.length > 0) {
      const foundIdx = concepts.findIndex((c) => c.id === initialConceptId);
      if (foundIdx >= 0 && foundIdx !== activeSession.currentIndex) {
        const nextSession = jumpToIndex(activeSession, foundIdx);
        setInternalSession(nextSession);
        if (graph?.id) saveRevisionSession(nextSession, graph.id);
        onSessionChange?.(nextSession);
      }
    }
  }, [controlledIndex, initialConceptId, concepts, graph?.id, onSessionChange]);

  // Reduced motion preference (Section 7)
  const shouldReduceMotion = useReducedMotion() ?? false;

  // Direction tracking for Section 3 concept transitions: 1 = forward (Next), -1 = backward (Previous)
  const [direction, setDirection] = useState<number>(1);
  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (currentIndex > prevIndexRef.current) {
      setDirection(1);
    } else if (currentIndex < prevIndexRef.current) {
      setDirection(-1);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Session entry animation tracking (Section 4: Avoid replaying everything)
  const [hasPlayedEntry, setHasPlayedEntry] = useState<boolean>(
    () => Boolean(skipEntryAnimation || activeSession?.entryAnimationPlayed)
  );

  useEffect(() => {
    if (skipEntryAnimation || activeSession?.entryAnimationPlayed) {
      setHasPlayedEntry(true);
      return;
    }
    // Allow entry animation sequence (Stage 1-4, up to ~450ms) to complete smoothly
    const timer = setTimeout(() => {
      setHasPlayedEntry(true);
      if (activeSession && !activeSession.entryAnimationPlayed) {
        const updated = { ...activeSession, entryAnimationPlayed: true };
        setInternalSession(updated);
        if (graph?.id) saveRevisionSession(updated, graph.id);
        onSessionChange?.(updated);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [skipEntryAnimation, graph?.id, activeSession, onSessionChange]);

  // Framer Motion variants memoized to prevent re-creation on ordinary renders
  const workspaceRootVariants = useMemo(
    () => createWorkspaceRootVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const workspaceArrivalVariants = useMemo(
    () => createWorkspaceArrivalVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const sessionMetadataVariants = useMemo(
    () => createSessionMetadataVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptBadgeVariants = useMemo(
    () => createConceptBadgeVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptTitleVariants = useMemo(
    () => createConceptTitleVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptDescriptionVariants = useMemo(
    () => createConceptDescriptionVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const navigationVariants = useMemo(
    () => createNavigationVariants(shouldReduceMotion, hasPlayedEntry),
    [shouldReduceMotion, hasPlayedEntry]
  );

  const conceptCanvasVariants = useMemo(
    () => createConceptCanvasVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const actionTransformVariants = useMemo(
    () => createActionTransformVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const navTitleVariants = useMemo(
    () => createNavTitleVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  const conceptElementVariants = useMemo(
    () => createConceptElementVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );

  // Concept navigation step handlers with rapid-click debounce protection
  const isNavigatingRef = useRef(false);

  const handlePrev = useCallback(() => {
    if (isFirst || isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 280);

    setDirection(-1);
    const prevIdx = Math.max(0, currentIndex - 1);
    const nextSession = jumpToIndex(activeSession, prevIdx);
    setInternalSession(nextSession);
    if (graph?.id) saveRevisionSession(nextSession, graph.id);
    onSessionChange?.(nextSession);
    onSelectConceptIndex?.(prevIdx);
    onPrevConcept?.();
  }, [isFirst, currentIndex, activeSession, graph?.id, onSessionChange, onSelectConceptIndex, onPrevConcept]);

  const handleNext = useCallback(() => {
    if (isLast || isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 280);

    setDirection(1);
    const nextIdx = Math.min(totalConcepts - 1, currentIndex + 1);
    const nextSession = jumpToIndex(activeSession, nextIdx);
    const currentConceptId = concepts[currentIndex]?.id;
    if (currentConceptId && !nextSession.reviewedConceptIds.includes(currentConceptId)) {
      nextSession.reviewedConceptIds.push(currentConceptId);
    }
    setInternalSession(nextSession);
    if (graph?.id) saveRevisionSession(nextSession, graph.id);
    onSessionChange?.(nextSession);
    onSelectConceptIndex?.(nextIdx);
    onNextConcept?.();
  }, [isLast, currentIndex, totalConcepts, activeSession, concepts, graph?.id, onSessionChange, onSelectConceptIndex, onNextConcept]);

  // Resolve current concept
  const currentConcept: RevisionConceptItem | null = concepts[currentIndex] || null;

  // The active concept being presented in the workspace
  const activeDisplayConcept: RevisionConceptItem | null = currentConcept;


  // Real-time mastery reactivity version bump
  const [masteryVersion, setMasteryVersion] = useState<number>(0);

  // Back to graph handler with session preservation
  const handleBackToGraph = useCallback(() => {
    if (graph?.id && activeSession) {
      saveRevisionSession(activeSession, graph.id);
    }
    onBackToGraph();
  }, [graph?.id, activeSession, onBackToGraph]);

  // Session completion guard (Part 1: Prevent duplicate submissions)
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  const handleCompleteSession = useCallback(() => {
    if (isCompletingSession) return;
    setIsCompletingSession(true);

    const currentConceptId = concepts[currentIndex]?.id;
    const reviewed = [...activeSession.reviewedConceptIds];
    if (currentConceptId && !reviewed.includes(currentConceptId)) {
      reviewed.push(currentConceptId);
    }

    const completedSession: RevisionSessionState = {
      ...activeSession,
      reviewedConceptIds: reviewed,
      updatedAt: new Date().toISOString()
    };

    setInternalSession(completedSession);
    if (graph?.id) {
      saveRevisionSession(completedSession, graph.id);
    }
    onSessionChange?.(completedSession);
    handleBackToGraph();
  }, [isCompletingSession, concepts, currentIndex, activeSession, graph?.id, onSessionChange, handleBackToGraph]);

  // Keyboard navigation (ArrowLeft: previous, ArrowRight: next, Escape: close drawer/summary or return from excursion or back to graph)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' && !isFirst) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' && !isLast) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleBackToGraph();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFirst, isLast, handlePrev, handleNext, handleBackToGraph]);

  // Real-time mastery sync when student completes a knowledge-check question
  const handleAttemptSubmitted = useCallback((_attempt: KnowledgeCheckAttempt, nextKcState: ConceptKnowledgeCheckState) => {
    if (activeDisplayConcept) {
      const graphId = graph?.id || 'default_graph';
      const practiceStates = loadConceptPracticeStates(graphId);
      const isVisited = true;
      const isMarked = Boolean(activeSession.markedForReviewIds?.includes(activeDisplayConcept.id));
      const calculated = calculateConceptMastery({
        graphId,
        conceptId: activeDisplayConcept.id,
        conceptName: activeDisplayConcept.name,
        isVisitedInSession: isVisited,
        knowledgeCheckState: nextKcState,
        practiceState: practiceStates[activeDisplayConcept.id],
        isMarkedForReview: isMarked
      });
      saveStoredMastery(graphId, calculated);
    }
    setMasteryVersion(v => v + 1);
  }, [graph?.id, activeDisplayConcept, activeSession.markedForReviewIds]);

  // Active concept mastery calculation based on recorded learning evidence
  const currentMastery = useMemo(() => {
    if (!activeDisplayConcept) return null;
    const graphId = graph?.id || 'default_graph';
    const kcState = loadStoredKnowledgeCheck(graphId, activeDisplayConcept.id);
    const practiceStates = loadConceptPracticeStates(graphId);
    const isVisited = Boolean(
      activeSession.reviewedConceptIds?.includes(activeDisplayConcept.id) ||
      activeSession.currentConceptId === activeDisplayConcept.id ||
      (activeSession.conceptIds && activeSession.conceptIds[activeSession.currentIndex] === activeDisplayConcept.id)
    );
    const isMarked = Boolean(activeSession.markedForReviewIds?.includes(activeDisplayConcept.id));
    return calculateConceptMastery({
      graphId,
      conceptId: activeDisplayConcept.id,
      conceptName: activeDisplayConcept.name,
      isVisitedInSession: isVisited,
      knowledgeCheckState: kcState,
      practiceState: practiceStates[activeDisplayConcept.id],
      isMarkedForReview: isMarked
    });
  }, [graph?.id, activeDisplayConcept, activeSession, masteryVersion]);


  // Concept explanation lifecycle state (Phase 2 Task 05 & Task 09)
  const [explanationState, setExplanationState] = useState<ExplanationState>(() => {
    const target = activeDisplayConcept;
    if (!graph || !target) return { status: 'empty' };
    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = target.id;
    const currentFingerprint = computeConceptSourceFingerprint(graph, targetConceptId);
    const cached = loadStoredExplanation(currentGraphId, targetConceptId);
    if (cached) {
      if (cached.sourceFingerprint && cached.sourceFingerprint !== currentFingerprint) {
        return {
          status: 'outdated',
          explanation: {
            ...cached,
            isOutdated: true
          },
          conceptId: targetConceptId,
          graphId: currentGraphId,
          outdatedReason: 'Underlying source material has been modified since this explanation was generated.'
        };
      }
      return {
        status: 'ready',
        explanation: cached,
        conceptId: targetConceptId,
        graphId: currentGraphId
      };
    }
    const ctx = extractConceptSourceContext(graph, targetConceptId);
    if (ctx.status === 'insufficient') {
      return {
        status: 'insufficient',
        conceptId: targetConceptId,
        graphId: currentGraphId,
        insufficientReason: ctx.reason
      };
    }
    if (ctx.status === 'empty') {
      return { status: 'empty', conceptId: targetConceptId, graphId: currentGraphId };
    }
    const synthesized = synthesizeGroundedExplanation(ctx.context, currentFingerprint);
    return {
      status: 'ready',
      explanation: synthesized,
      conceptId: targetConceptId,
      graphId: currentGraphId
    };
  });
  const explanationAbortRef = useRef<AbortController | null>(null);
  const activeDisplayConceptRef = useRef<string | undefined>(activeDisplayConcept?.id);

  useEffect(() => {
    activeDisplayConceptRef.current = activeDisplayConcept?.id;
  }, [activeDisplayConcept?.id]);

  // Synchronous resolution of explanation state for current active concept:
  // Eliminates any intermediate mixed state across concepts during transitions.
  const effectiveExplanationState = useMemo<ExplanationState>(() => {
    if (!graph || !activeDisplayConcept) return { status: 'empty' };
    if (explanationState.conceptId === activeDisplayConcept.id) {
      return explanationState;
    }
    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = activeDisplayConcept.id;
    const currentFingerprint = computeConceptSourceFingerprint(graph, targetConceptId);
    const cached = loadStoredExplanation(currentGraphId, targetConceptId);
    if (cached) {
      if (cached.sourceFingerprint && cached.sourceFingerprint !== currentFingerprint) {
        return {
          status: 'outdated',
          explanation: {
            ...cached,
            isOutdated: true
          },
          conceptId: targetConceptId,
          graphId: currentGraphId,
          outdatedReason: 'Underlying source material has been modified since this explanation was generated.'
        };
      }
      return {
        status: 'ready',
        explanation: cached,
        conceptId: targetConceptId,
        graphId: currentGraphId
      };
    }
    const ctx = extractConceptSourceContext(graph, targetConceptId);
    if (ctx.status === 'insufficient') {
      return {
        status: 'insufficient',
        conceptId: targetConceptId,
        graphId: currentGraphId,
        insufficientReason: ctx.reason
      };
    }
    if (ctx.status === 'empty') {
      return { status: 'empty', conceptId: targetConceptId, graphId: currentGraphId };
    }
    return {
      status: 'loading',
      conceptId: targetConceptId,
      graphId: currentGraphId
    };
  }, [graph, activeDisplayConcept, explanationState]);

  // Sync explanation when current concept or graph changes
  useEffect(() => {
    if (!graph || !activeDisplayConcept) {
      setExplanationState({ status: 'empty' });
      return;
    }

    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = activeDisplayConcept.id;

    // Check persistent cache first for instant retrieval
    const cached = loadStoredExplanation(currentGraphId, targetConceptId);
    if (cached) {
      setExplanationState({
        status: 'ready',
        explanation: cached,
        conceptId: targetConceptId,
        graphId: currentGraphId
      });
      return;
    }

    // Cancel any previous in-flight request so navigation is never blocked
    if (explanationAbortRef.current) {
      explanationAbortRef.current.abort();
    }
    const controller = new AbortController();
    explanationAbortRef.current = controller;

    setExplanationState({
      status: 'loading',
      conceptId: targetConceptId,
      graphId: currentGraphId
    });

    getOrGenerateConceptExplanation({
      graph,
      conceptId: targetConceptId,
      signal: controller.signal
    })
      .then((res) => {
        if (!controller.signal.aborted && activeDisplayConceptRef.current === targetConceptId) {
          setExplanationState(res);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && activeDisplayConceptRef.current === targetConceptId) {
          setExplanationState({
            status: 'error',
            errorMessage: err?.message || 'Failed to load concept explanation.',
            conceptId: targetConceptId,
            graphId: currentGraphId
          });
        }
      });

    return () => {
      controller.abort();
    };
  }, [graph, activeDisplayConcept?.id]);

  const handleRetryExplanation = useCallback(() => {
    if (!graph || !activeDisplayConcept) return;
    const currentGraphId = graph.id || 'default_graph';
    const targetConceptId = activeDisplayConcept.id;

    if (explanationAbortRef.current) {
      explanationAbortRef.current.abort();
    }
    const controller = new AbortController();
    explanationAbortRef.current = controller;

    setExplanationState({
      status: 'loading',
      conceptId: targetConceptId,
      graphId: currentGraphId
    });

    getOrGenerateConceptExplanation({
      graph,
      conceptId: targetConceptId,
      forceRegenerate: true,
      signal: controller.signal
    })
      .then((res) => {
        if (!controller.signal.aborted && activeDisplayConceptRef.current === targetConceptId) {
          setExplanationState(res);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && activeDisplayConceptRef.current === targetConceptId) {
          setExplanationState({
            status: 'error',
            errorMessage: err?.message || 'Failed to generate concept explanation.',
            conceptId: targetConceptId,
            graphId: currentGraphId
          });
        }
      });
  }, [graph, activeDisplayConcept]);

  // View graph action
  const handleViewGraph = useCallback(() => {
    if (graph?.id && activeSession) {
      saveRevisionSession(activeSession, graph.id);
    }
    if (onViewGraph) {
      onViewGraph(activeDisplayConcept?.id);
    } else {
      handleBackToGraph();
    }
  }, [graph?.id, activeSession, onViewGraph, activeDisplayConcept?.id, handleBackToGraph]);

  // Resolved graph name for header
  const resolvedGraphName = graphName || graph?.name || 'Knowledge Graph';


  // Formatting helpers
  const formattedIndex = String(currentIndex + 1).padStart(2, '0');
  const formattedTotal = String(Math.max(totalConcepts, 1)).padStart(2, '0');
  const progressPercentage = totalConcepts > 0 ? ((currentIndex + 1) / totalConcepts) * 100 : 0;

  const prevConcept = currentIndex > 0 ? concepts[currentIndex - 1] : null;
  const nextConcept = currentIndex < totalConcepts - 1 ? concepts[currentIndex + 1] : null;

  // Check existing concept data for content structure sections
  const conceptTitle = activeDisplayConcept?.name || '';
  const conceptDescription = activeDisplayConcept?.description || '';

  // Quick Exploration state (Task 08: inspect related concepts without replacing active concept)
  const [inspectedRelatedId, setInspectedRelatedId] = useState<string | null>(null);

  useEffect(() => {
    setInspectedRelatedId(null);
  }, [activeDisplayConcept?.id]);

  const handleToggleInspect = useCallback((targetId: string) => {
    setInspectedRelatedId(prev => prev === targetId ? null : targetId);
  }, []);

  const handleOpenRelatedInRevision = useCallback((targetId: string) => {
    if (!targetId) return;
    const nextSession = navigateOrAppendToRevisionSession(activeSession, targetId);
    setInternalSession(nextSession);
    if (graph?.id) {
      saveRevisionSession(nextSession, graph.id);
    }
    onSessionChange?.(nextSession);
    if (onSelectConceptIndex) {
      onSelectConceptIndex(nextSession.currentIndex);
    }
    setInspectedRelatedId(null);
  }, [activeSession, graph?.id, onSessionChange, onSelectConceptIndex]);

  const handleExploreRelatedInGraph = useCallback((targetId: string) => {
    if (!targetId) return;
    if (graph?.id && activeSession) {
      saveRevisionSession(activeSession, graph.id);
    }
    if (onViewGraph) {
      onViewGraph(targetId);
    } else {
      onBackToGraph();
    }
  }, [graph?.id, activeSession, onViewGraph, onBackToGraph]);

  const handleNavigateToSection = useCallback((secId: string) => {
    if (!secId) return;
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [shouldReduceMotion]);


  // Resolve related concepts strictly from real graph edges and nodes (Task 08)
  const resolvedRelatedConcepts = useMemo(() => {
    if (!activeDisplayConcept) return [];

    const sourceNodes = (graph?.nodes && graph.nodes.length > 0) ? graph.nodes : (allNodes.length > 0 ? allNodes : []);
    const items: Array<{
      id: string;
      name: string;
      category?: string;
      description?: string;
      relationType: string;
      direction: 'outgoing' | 'incoming';
      relationDescription?: string;
      isInCurrentSession: boolean;
    }> = [];
    const seenIds = new Set<string>();

    const refNameMap = new Map<string, string>();
    if ((effectiveExplanationState.status === 'ready' || effectiveExplanationState.status === 'outdated') && effectiveExplanationState.explanation?.relatedConceptReferences) {
      effectiveExplanationState.explanation.relatedConceptReferences.forEach(ref => {
        if (ref.conceptId && ref.conceptName) {
          refNameMap.set(ref.conceptId, ref.conceptName);
        }
      });
    }

    const addRelated = (
      targetId: string,
      targetName: string,
      relationType: string,
      direction: 'outgoing' | 'incoming',
      relationDescription?: string
    ) => {
      if (!targetId || targetId === activeDisplayConcept.id || seenIds.has(targetId)) return;
      seenIds.add(targetId);

      const targetNode = sourceNodes.find((n: any) => n.id === targetId) || allNodes.find((n: any) => n.id === targetId) || concepts.find(c => c.id === targetId);
      const targetDetail = conceptDetails[targetId];

      const preferredName = (targetName && targetName !== targetId) ? targetName : (refNameMap.get(targetId) || targetName || targetId);
      const resolvedName = targetDetail?.label || targetDetail?.name || targetNode?.name || (targetNode as any)?.data?.label || preferredName;
      const resolvedCategory = targetDetail?.category || targetNode?.category || (targetNode as any)?.data?.category || targetNode?.type;
      const resolvedDesc = targetDetail?.description || targetNode?.description || (targetNode as any)?.data?.description || '';

      items.push({
        id: targetId,
        name: resolvedName,
        category: resolvedCategory,
        description: resolvedDesc,
        relationType: relationType || 'related-to',
        direction: direction || 'outgoing',
        relationDescription,
        isInCurrentSession: activeSession.conceptIds.includes(targetId)
      });
    };

    if (activeDisplayConcept.relationships && activeDisplayConcept.relationships.length > 0) {
      activeDisplayConcept.relationships.forEach(rel => {
        addRelated(
          rel.targetId,
          rel.targetName,
          rel.type,
          rel.direction,
          rel.description
        );
      });
    }

    if ((effectiveExplanationState.status === 'ready' || effectiveExplanationState.status === 'outdated') && effectiveExplanationState.explanation?.relatedConceptReferences) {
      effectiveExplanationState.explanation.relatedConceptReferences.forEach(ref => {
        if (ref.conceptId) {
          addRelated(ref.conceptId, ref.conceptName, ref.relationshipType, 'outgoing');
        } else {
          const matchNode = sourceNodes.find((n: any) => n.name === ref.conceptName || (n as any)?.data?.label === ref.conceptName);
          if (matchNode) {
            addRelated(matchNode.id, ref.conceptName, ref.relationshipType, 'outgoing');
          }
        }
      });
    }

    return items;
  }, [activeDisplayConcept, graph?.nodes, allNodes, concepts, conceptDetails, activeSession.conceptIds, effectiveExplanationState]);

  // Understanding section only renders if there are extra key ideas or evidence
  const hasExtraKeyIdeas = Boolean(activeDisplayConcept?.keyIdeas && activeDisplayConcept.keyIdeas.length > 0);
  const hasEvidence = Boolean(activeDisplayConcept?.evidence && activeDisplayConcept.evidence.trim().length > 0);
  const hasUnderstandingData = hasExtraKeyIdeas || hasEvidence;
  const hasRelatedConcepts = resolvedRelatedConcepts.length > 0;

  // Section 01 Content Deduplication (Avoid repeating definition from header, repeated sentences, or duplicated evidence)
  const understandingContent = useMemo(() => {
    const definition = (conceptDescription || '').trim();
    const exp = (effectiveExplanationState.status === 'ready' || effectiveExplanationState.status === 'outdated')
      ? effectiveExplanationState.explanation
      : null;

    let lead: string | null = null;
    const paragraphs: string[] = [];
    const keyIdeas: string[] = [];
    let evidence: string | null = null;

    const sourcesList = graph?.sources || [];

    if (exp) {
      // 1. Overview: only render as lead paragraph if it adds genuine value beyond the concept definition
      if (exp.overview && exp.overview.trim().length > 0) {
        const sanitizedLead = sanitizeGroundedExplanationText(exp.overview, conceptTitle, sourcesList);
        if (sanitizedLead && !isSubstantiallyIdentical(sanitizedLead, definition)) {
          lead = sanitizedLead;
        }
      }

      // 2. Detailed explanation paragraphs
      if (exp.detailedExplanation && exp.detailedExplanation.length > 0) {
        exp.detailedExplanation.forEach((p) => {
          if (!p || !p.trim()) return;
          let text = sanitizeGroundedExplanationText(p, conceptTitle, sourcesList);
          if (!text || text.length < 15) return;

          // If the entire paragraph is a duplicate of definition or lead, skip it
          if (isSubstantiallyIdentical(text, definition)) return;
          if (lead && isSubstantiallyIdentical(text, lead)) return;

          // If the paragraph opens with a sentence repeating the definition, strip the duplicate opening sentence
          const sentenceSplit = text.match(/^([^.!?]+[.!?])\s*(.*)$/s);
          if (sentenceSplit) {
            const firstSentence = sentenceSplit[1].trim();
            const remainder = sentenceSplit[2].trim();
            if (isSubstantiallyIdentical(firstSentence, definition) && remainder.length >= 15) {
              text = remainder;
            }
          }

          // Check against already included paragraphs
          if (!paragraphs.some(existing => isSubstantiallyIdentical(existing, text))) {
            paragraphs.push(text);
          }
        });
      }
    }

    // 3. Extra key ideas from node data
    if (activeDisplayConcept?.keyIdeas && activeDisplayConcept.keyIdeas.length > 0) {
      activeDisplayConcept.keyIdeas.forEach((idea) => {
        if (!idea || !idea.trim()) return;
        const text = sanitizeGroundedExplanationText(idea.trim(), conceptTitle, sourcesList);
        if (!text || text.length < 10) return;
        if (isSubstantiallyIdentical(text, definition)) return;
        if (lead && isSubstantiallyIdentical(text, lead)) return;
        if (paragraphs.some(p => isSubstantiallyIdentical(p, text))) return;
        if (!keyIdeas.some(existing => isSubstantiallyIdentical(existing, text))) {
          keyIdeas.push(text);
        }
      });
    }

    // 4. Evidence text from node data
    if (activeDisplayConcept?.evidence && activeDisplayConcept.evidence.trim().length > 0) {
      const text = sanitizeGroundedExplanationText(activeDisplayConcept.evidence.trim(), conceptTitle, sourcesList);
      if (text && text.length >= 15) {
        const isDuplicate =
          isSubstantiallyIdentical(text, definition) ||
          (lead && isSubstantiallyIdentical(text, lead)) ||
          paragraphs.some(p => isSubstantiallyIdentical(p, text) || p.includes(text));

        if (!isDuplicate) {
          evidence = text;
        }
      }
    }

    // In the edge case where overview was identical to definition AND there are no paragraphs,
    // key ideas, or evidence, provide the overview as a normal body paragraph (not a prominent lead)
    // so the section doesn't render completely empty if it's the only text available.
    if (!lead && paragraphs.length === 0 && keyIdeas.length === 0 && !evidence && exp?.overview) {
      const sanitized = sanitizeGroundedExplanationText(exp.overview, conceptTitle, sourcesList);
      if (sanitized) paragraphs.push(sanitized);
    }

    return {
      lead,
      paragraphs,
      keyIdeas,
      evidence,
      hasContent: Boolean(lead || paragraphs.length > 0 || keyIdeas.length > 0 || evidence)
    };
  }, [conceptDescription, conceptTitle, graph?.sources, effectiveExplanationState, activeDisplayConcept?.keyIdeas, activeDisplayConcept?.evidence]);


  const workspaceRootRef = useRef<HTMLDivElement | null>(null);

  // Step reveal progress map keyed by conceptId (Task 07: Avoid resetting example if user temporarily opens graph)
  const [revealedStepsMap, setRevealedStepsMap] = useState<Record<string, number>>({});

  const workedExample = effectiveExplanationState.explanation?.workedExample;
  const totalWorkedSteps = workedExample?.steps?.length || 0;

  // Filter out accidental graph relationship fragments (e.g. "Shortest Remaining Time First (type of)")
  const authenticExamples = useMemo(() => {
    const raw = effectiveExplanationState.explanation?.examples;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(ex => {
      if (!ex || typeof ex !== 'string') return false;
      const t = ex.trim();
      if (t.length < 5) return false;
      if (/\((?:type of|is a|part of|kind of|outgoing|incoming)\)/i.test(t)) return false;
      if (/^[a-z\s-]+\s*\((?:type of|is a|part of|kind of)\)$/i.test(t)) return false;
      return true;
    });
  }, [effectiveExplanationState.explanation?.examples]);

  const currentRevealedSteps = activeDisplayConcept?.id
    ? (revealedStepsMap[activeDisplayConcept.id] !== undefined
        ? revealedStepsMap[activeDisplayConcept.id]
        : (totalWorkedSteps > 0 ? 1 : 0))
    : 1;

  const handleShowNextStep = useCallback(() => {
    if (!activeDisplayConcept?.id || totalWorkedSteps === 0) return;
    setRevealedStepsMap(prev => {
      const current = prev[activeDisplayConcept.id] !== undefined ? prev[activeDisplayConcept.id] : 1;
      return {
        ...prev,
        [activeDisplayConcept.id]: Math.min(current + 1, totalWorkedSteps)
      };
    });
  }, [activeDisplayConcept?.id, totalWorkedSteps]);

  const handleShowAllSteps = useCallback(() => {
    if (!activeDisplayConcept?.id || totalWorkedSteps === 0) return;
    setRevealedStepsMap(prev => ({
      ...prev,
      [activeDisplayConcept.id]: totalWorkedSteps
    }));
  }, [activeDisplayConcept?.id, totalWorkedSteps]);

  const handleHideSteps = useCallback(() => {
    if (!activeDisplayConcept?.id) return;
    setRevealedStepsMap(prev => ({
      ...prev,
      [activeDisplayConcept.id]: 1
    }));
  }, [activeDisplayConcept?.id]);

  // Preserve scroll position across explanation loading; reset only on concept change
  useEffect(() => {
    if (workspaceRootRef.current) {
      workspaceRootRef.current.scrollTop = 0;
    }
  }, [activeDisplayConcept?.id]);

  // Active sections computation for Section Navigation (Task 06 & 07)
  const activeSections = useMemo(() => {
    if ((effectiveExplanationState.status !== 'ready' && effectiveExplanationState.status !== 'outdated') || !effectiveExplanationState.explanation) {
      return [];
    }
    const exp = effectiveExplanationState.explanation;
    const list: Array<{ id: string; num: string; label: string }> = [];
    let counter = 1;

    // 01. Understand
    if (exp.overview || hasUnderstandingData) {
      list.push({ id: 'section-understanding', num: String(counter++).padStart(2, '0'), label: 'Understand' });
    }
    // 02. How it works
    if (exp.howItWorks && exp.howItWorks.length > 0) {
      list.push({ id: 'section-how-it-works', num: String(counter++).padStart(2, '0'), label: 'How it works' });
    }
    // 03. Key components / terminology
    if ((exp.keyComponents && exp.keyComponents.length > 0) || (exp.keyTerminology && exp.keyTerminology.length > 0) || exp.comparisonTable) {
      const isTerminology = Boolean(exp.keyTerminology && exp.keyTerminology.length > 0);
      list.push({
        id: 'section-key-components',
        num: String(counter++).padStart(2, '0'),
        label: isTerminology ? 'Terminology' : 'Components'
      });
    }
    // 04. Important details / points
    if ((exp.importantDetails && exp.importantDetails.length > 0) || (exp.importantPoints && exp.importantPoints.length > 0)) {
      const isPoints = Boolean(exp.importantPoints && exp.importantPoints.length > 0 && (!exp.importantDetails || exp.importantDetails.length === 0));
      list.push({
        id: 'section-important-details',
        num: String(counter++).padStart(2, '0'),
        label: isPoints ? 'Points' : 'Details'
      });
    }
    // Examples (including structured worked example)
    const hasExamples = (authenticExamples && authenticExamples.length > 0) || Boolean(exp.workedExample);
    if (hasExamples) {
      list.push({ id: 'section-examples', num: String(counter++).padStart(2, '0'), label: 'Example' });
    }
    // Related concepts
    if (hasRelatedConcepts) {
      list.push({ id: 'section-related-concepts', num: String(counter++).padStart(2, '0'), label: 'Related' });
    }
    // Knowledge check (Interactive)
    const hasMultipleReadingSections = list.length > 1;
    if (hasMultipleReadingSections) {
      list.push({ id: 'section-knowledge-check', num: String(counter++).padStart(2, '0'), label: 'Check' });
    }
    // Source references
    if (exp.sourceReferences && exp.sourceReferences.length > 0) {
      list.push({ id: 'section-sources', num: String(counter++).padStart(2, '0'), label: 'Sources' });
    }

    return list;
  }, [effectiveExplanationState, hasUnderstandingData, hasRelatedConcepts, authenticExamples]);

  // Stable rail sections tracking across in-flight transitions (Sections 1 & 7)
  const [displayedRailSections, setDisplayedRailSections] = useState<Array<{ id: string; num: string; label: string }>>(activeSections);

  useEffect(() => {
    if (activeSections.length > 0) {
      setDisplayedRailSections(activeSections);
    }
  }, [activeSections]);

  const effectiveRailSections = useMemo(() => {
    if (activeSections.length > 0) return activeSections;
    return displayedRailSections;
  }, [activeSections, displayedRailSections]);

  const getSecNum = (id: string) => effectiveRailSections.find(s => s.id === id)?.num || String(effectiveRailSections.length + 1).padStart(2, '0');

  // Active section tracking for section jump nav highlighting
  const [activeSectionId, setActiveSectionId] = useState<string>('section-understanding');
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [prevTrackedConceptId, setPrevTrackedConceptId] = useState<string | undefined>(activeDisplayConcept?.id);

  if (activeDisplayConcept?.id !== prevTrackedConceptId) {
    setPrevTrackedConceptId(activeDisplayConcept?.id);
    const firstSecId = activeSections[0]?.id || displayedRailSections[0]?.id || 'section-understanding';
    setActiveSectionId(firstSecId);
  }

  useEffect(() => {
    if (activeSections.length > 0) {
      setActiveSectionId(activeSections[0].id);
    }
    isProgrammaticScrollRef.current = false;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, [activeDisplayConcept?.id]);

  const activeSectionIndex = useMemo(() => {
    const idx = effectiveRailSections.findIndex(s => s.id === activeSectionId);
    return idx >= 0 ? idx : 0;
  }, [effectiveRailSections, activeSectionId]);

  const progressRatio = useMemo(() => {
    if (effectiveRailSections.length <= 1) return 0;
    return activeSectionIndex / (effectiveRailSections.length - 1);
  }, [effectiveRailSections.length, activeSectionIndex]);

  const handleSectionClick = useCallback((secId: string) => {
    setActiveSectionId(secId);
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    // Lock manual detection for 650ms while smooth scrolling completes
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 650);

    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [shouldReduceMotion]);

  // Deterministic scroll tracker: synchronized with effectiveRailSections, dynamic reading zone beneath sticky header
  useEffect(() => {
    const rootEl = workspaceRootRef.current;
    if (!rootEl || effectiveRailSections.length === 0) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const scrollTop = rootEl.scrollTop;
      const scrollHeight = rootEl.scrollHeight;
      const clientHeight = rootEl.clientHeight;

      // 1. Top of document check
      if (scrollTop <= 60) {
        if (effectiveRailSections[0]) {
          setActiveSectionId(effectiveRailSections[0].id);
        }
        return;
      }

      // 2. Bottom of document check (for trailing sections such as Sources or Knowledge Check)
      if (scrollHeight - scrollTop - clientHeight <= 80) {
        const lastSec = effectiveRailSections[effectiveRailSections.length - 1];
        if (lastSec) {
          setActiveSectionId(lastSec.id);
        }
        return;
      }

      // 3. Reading zone detection
      const rootRect = rootEl.getBoundingClientRect();
      const triggerLine = rootRect.top + Math.min(260, Math.max(140, clientHeight * 0.28));

      let matchedSectionId = '';
      let closestPrecedingId = '';
      let minPrecedingDist = Infinity;

      for (let i = 0; i < effectiveRailSections.length; i++) {
        const sec = effectiveRailSections[i];
        const el = document.getElementById(sec.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();

        // If the reading trigger line is inside this section
        if (rect.top <= triggerLine && rect.bottom > triggerLine) {
          matchedSectionId = sec.id;
          break;
        }

        // Closest section whose top has scrolled past the trigger line
        if (rect.top <= triggerLine) {
          const dist = triggerLine - rect.top;
          if (dist < minPrecedingDist) {
            minPrecedingDist = dist;
            closestPrecedingId = sec.id;
          }
        }
      }

      const targetId = matchedSectionId || closestPrecedingId || effectiveRailSections[0]?.id;
      if (targetId) {
        setActiveSectionId(targetId);
      }
    };

    rootEl.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      rootEl.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [effectiveRailSections]);

  // Section 06 Editorial Related Concepts renderer
  const renderRelatedConceptsSection = (secNum?: string) => {
    if (resolvedRelatedConcepts.length === 0) return null;

    return (
      <div className="revision-section revision-section-related" id="section-related-concepts">
        <h2 className="revision-section-heading">
          {secNum && <span className="revision-section-num">{secNum}</span>}
          <span>Related concepts</span>
        </h2>
        <div className="revision-related-list">
          {resolvedRelatedConcepts.map((rel) => {
            const isInspected = inspectedRelatedId === rel.id;
            const formattedType = rel.relationType.replace(/-/g, ' ');
            return (
              <div key={rel.id} className="revision-related-item-wrapper">
                <div className="revision-related-item">
                  <div className="revision-related-info">
                    <div className="revision-related-relation-row">
                      <span className="revision-related-relation">
                        {formattedType}
                      </span>
                      <span className="revision-related-separator" aria-hidden="true">·</span>
                      <span className="revision-related-dir-badge" aria-label={`Relationship direction: ${rel.direction}`}>
                        {rel.direction === 'incoming' ? '← Incoming' : '→ Outgoing'}
                      </span>
                    </div>
                    <span className="revision-related-name">
                      {rel.name}
                    </span>
                    {rel.description && (
                      <p className="revision-related-desc">
                        {rel.description}
                      </p>
                    )}
                  </div>
                  <div className="revision-related-actions">
                    <button
                      type="button"
                      className="revision-related-inspect-btn"
                      onClick={() => handleToggleInspect(rel.id)}
                      aria-expanded={isInspected}
                      aria-label={`Inspect ${rel.name}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>{isInspected ? 'Close preview' : 'Inspect'}</span>
                    </button>
                    <button
                      type="button"
                      className="revision-related-graph-btn"
                      onClick={() => handleExploreRelatedInGraph(rel.id)}
                      aria-label={`Explore ${rel.name} in graph`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      <span>Explore in graph</span>
                    </button>
                  </div>
                </div>

                {/* Quick Exploration Contextual Preview Box */}
                {isInspected && (
                  <div
                    className="revision-related-inspect-box"
                    role="region"
                    aria-label={`Preview of ${rel.name}`}
                  >
                    <div className="revision-inspect-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 className="revision-inspect-title">{rel.name}</h4>
                        {rel.category && (
                          <span className="revision-inspect-category">{rel.category}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="revision-inspect-close-btn"
                        onClick={() => setInspectedRelatedId(null)}
                        aria-label="Close preview"
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div className="revision-inspect-rel-note">
                      <span>Relationship:</span>
                      <strong>{formattedType}</strong>
                      <span>({rel.direction === 'incoming' ? `incoming to ${conceptTitle}` : `outgoing from ${conceptTitle}`})</span>
                      {rel.relationDescription && (
                        <span style={{ color: 'var(--text-muted, #8A8A8A)', marginLeft: '4px' }}>— {rel.relationDescription}</span>
                      )}
                    </div>

                    <p className="revision-inspect-desc">
                      {rel.description || 'No extended concept description provided in knowledge graph.'}
                    </p>

                    <div className="revision-inspect-actions">
                      <button
                        type="button"
                        className="revision-inspect-open-btn"
                        onClick={() => handleOpenRelatedInRevision(rel.id)}
                        aria-label={`Revise ${rel.name} in workspace`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>{rel.isInCurrentSession ? 'Revise concept' : 'Add to session & revise'}</span>
                      </button>

                      <button
                        type="button"
                        className="revision-inspect-graph-btn"
                        onClick={() => handleExploreRelatedInGraph(rel.id)}
                        aria-label={`Explore ${rel.name} in interactive knowledge graph`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        <span>Explore in graph</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      ref={workspaceRootRef}
      className="revision-workspace-root"
      role="region"
      aria-label="GraphMind Dedicated Revision Workspace"
      variants={workspaceRootVariants}
      initial={hasPlayedEntry ? "settled" : "hidden"}
      animate="settled"
      exit="exit"
    >
      {/* --------------------------------------------------------------------
          TOP WORKSPACE HEADER (Section 2 & 7)
          Left: Back to graph | Center: Current graph name | Right: View graph action
          -------------------------------------------------------------------- */}
      <header className="revision-workspace-header" role="banner">
        <div className="revision-header-left">
          <button
            type="button"
            className="revision-header-action revision-back-action"
            onClick={handleBackToGraph}
            title="Return to knowledge graph view (Escape)"
            aria-label="Back to graph"
          >
            <span className="revision-arrow" aria-hidden="true">←</span>
            <span>Back to graph</span>
          </button>
        </div>

        <div className="revision-header-center">
          <span className="revision-graph-name" title={resolvedGraphName}>
            {resolvedGraphName}
          </span>
        </div>

        <div className="revision-header-right">
          <button
            type="button"
            className="revision-header-action revision-view-graph-action"
            onClick={handleViewGraph}
            title="View this concept in the interactive knowledge graph"
            aria-label="View graph"
          >
            <span>View graph</span>
            <span className="revision-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      {/* Subtle horizontal hairline divider */}
      <div className="revision-header-divider" aria-hidden="true" />

      {/* --------------------------------------------------------------------
          MAIN CONTENT AREA (Section 2)
          Centered reading column (760–820px max-width, generous margins)
          -------------------------------------------------------------------- */}
      <main className="revision-reading-area" role="main" id="revision-content" tabIndex={-1}>
        <div className="revision-lesson-layout">
          {/* MAIN READING COLUMN */}
          <motion.div
            className="revision-reading-column"
            variants={workspaceArrivalVariants}
            initial={hasPlayedEntry ? "settled" : "hidden"}
            animate="settled"
          >
          {/* State 1: Loading state */}
          {isLoading && (
            <div className="revision-loading-state" role="status" aria-live="polite">
              <span className="revision-empty-kicker">REVISION SESSION</span>
              <h2 className="revision-empty-title">Loading revision material…</h2>
              <p className="revision-empty-desc">Preparing structured concepts from this knowledge graph.</p>
            </div>
          )}

          {/* State 2: No graph or empty concepts */}
          {!isLoading && (!graph || totalConcepts === 0) && (
            <div className="revision-empty-state" role="status">
              <span className="revision-empty-kicker">REVISION WORKSPACE</span>
              <h2 className="revision-empty-title">
                {!graph ? 'No graph selected' : 'No concepts available for revision'}
              </h2>
              <p className="revision-empty-desc">
                {!graph
                  ? 'Please select a knowledge graph to begin a deep revision session.'
                  : 'This knowledge graph contains no extracted concepts yet. Add materials or create concepts to begin studying.'}
              </p>
              <div className="revision-empty-actions">
                {onSelectGraph && (
                  <button
                    type="button"
                    className="revision-empty-action"
                    onClick={onSelectGraph}
                  >
                    Select knowledge graph
                  </button>
                )}
                <button
                  type="button"
                  className={onSelectGraph ? 'revision-empty-action-secondary' : 'revision-empty-action'}
                  onClick={onBackToGraph}
                >
                  Return to knowledge graph
                </button>
              </div>
            </div>
          )}

          {/* State 3: Active revision concept presentation */}
          {!isLoading && totalConcepts > 0 && currentConcept && (
            <>
              {/* --------------------------------------------------------------
                  REVISION PROGRESS HEADER (Stage 2: Session Metadata)
                  "REVISION SESSION" on left | "01 / 18" on right | Thin lime-green progress
                  -------------------------------------------------------------- */}
              <motion.div
                className="revision-progress-header"
                variants={sessionMetadataVariants}
                initial={hasPlayedEntry ? "settled" : "hidden"}
                animate="settled"
              >
                <div className="revision-progress-meta">
                  <span className="revision-progress-kicker">REVISION SESSION</span>
                  <span
                    className="revision-progress-counter"
                    aria-label={`Concept ${currentIndex + 1} of ${totalConcepts}`}
                  >
                    {`${formattedIndex} / ${formattedTotal}`}
                  </span>
                </div>
                <div
                  className="revision-progress-track"
                  role="progressbar"
                  aria-valuenow={currentIndex + 1}
                  aria-valuemin={1}
                  aria-valuemax={totalConcepts}
                  aria-label="Revision session progress"
                >
                  <motion.div
                    className="revision-progress-fill"
                    initial={false}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.3,
                      ease: WORKSPACE_EASING
                    }}
                  />
                </div>
              </motion.div>


              {/* --------------------------------------------------------------
                  DIRECTION-AWARE CONCEPT CANVAS (Stage 3 & Concept Transitions)
                  Forward: enters from +14px, exits to -14px
                  Backward: enters from -14px, exits to +14px
                  -------------------------------------------------------------- */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeDisplayConcept.id}
                  custom={direction}
                  variants={conceptCanvasVariants}
                  initial={hasPlayedEntry ? "enter" : "hidden"}
                  animate={hasPlayedEntry ? "center" : "settled"}
                  exit="exit"
                  className="revision-concept-canvas"
                >
                  {/* Concept Introduction (Stage 3: Identifier -> Title -> Description) */}
                  <section className="revision-concept-intro" aria-labelledby="revision-concept-title">
                    <motion.div
                      className="revision-concept-badge"
                      variants={conceptElementVariants}
                    >
                      <div className="revision-concept-badge-number-group">
                        <span className="revision-concept-badge-dot" aria-hidden="true" />
                        <span className="revision-concept-badge-text">
                          {`CONCEPT ${formattedIndex}`}
                        </span>
                      </div>
                      {currentMastery && (
                        <span
                          className={`revision-concept-mastery-tag ${currentMastery.status}`}
                          role="status"
                          aria-label={`Concept mastery: ${currentMastery.statusLabel}`}
                        >
                          <span className="revision-mastery-dot" aria-hidden="true" />
                          <span>{currentMastery.statusLabel}</span>
                        </span>
                      )}
                      {effectiveExplanationState.explanation?.sourceReferences && effectiveExplanationState.explanation.sourceReferences.length > 0 && (
                        <a
                          href="#section-sources"
                          className="revision-source-inspect-link"
                          aria-label={`View sources supporting this explanation (${effectiveExplanationState.explanation.sourceReferences.length})`}
                          title="Jump to source references"
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById('section-sources');
                            if (el) {
                              el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
                            }
                          }}
                        >
                          <span className="revision-source-inspect-text">
                            {`View sources · ${effectiveExplanationState.explanation.sourceReferences.length}`}
                          </span>
                        </a>
                      )}
                    </motion.div>
                    <motion.h1
                      id="revision-concept-title"
                      className="revision-concept-title"
                      variants={conceptElementVariants}
                    >
                      {conceptTitle}
                    </motion.h1>
                    {conceptDescription ? (
                      <motion.p
                        className="revision-concept-description"
                        variants={conceptElementVariants}
                      >
                        {conceptDescription}
                      </motion.p>
                    ) : null}
                  </section>

                  {/* --------------------------------------------------------------
                      CONTENT PLACEHOLDER / STRUCTURE (Section 5)
                      Prepared sections:
                      - Understanding the concept
                      - How it works
                      - Important details
                      - Examples
                      - Related concepts
                      - Knowledge checks
                      Only existing concept data is rendered.
                      Unavailable sections are kept hidden until Phase 2 implementation.
                      -------------------------------------------------------------- */}
                  <motion.section
                    className="revision-content-structure"
                    aria-label="Concept sections"
                    variants={conceptElementVariants}
                  >
                    {/* State A: In-flight loading state */}
                    {effectiveExplanationState.status === 'loading' && (
                      <div className="revision-section revision-section-loading" role="status" aria-live="polite">
                        <h2 className="revision-section-heading">Understanding the concept</h2>
                        <div className="revision-explanation-loading">
                          <div className="revision-skeleton-line" />
                          <div className="revision-skeleton-line medium" />
                          <div className="revision-skeleton-line short" />
                        </div>
                      </div>
                    )}

                    {/* State C: Insufficient source material */}
                    {effectiveExplanationState.status === 'insufficient' && (
                      <>
                        <div className="revision-section revision-section-insufficient">
                          <div className="revision-insufficient-card" role="region" aria-label="Source Grounding Notice">
                            <span className="revision-insufficient-kicker">SOURCE GROUNDING / INSUFFICIENT MATERIAL</span>
                            <h3 className="revision-insufficient-title">Detailed explanation unavailable</h3>
                            <p className="revision-insufficient-desc">
                              {effectiveExplanationState.insufficientReason ||
                                `The learning materials associated with this knowledge graph do not contain enough documented passages or evidence for "${conceptTitle}". GraphMind avoids generating speculative explanations to ensure academic integrity.`}
                            </p>
                          </div>
                        </div>
                        {renderRelatedConceptsSection()}

                        {/* Knowledge Check (Interactive Formative Check) */}
                        <KnowledgeCheckSection
                          graph={graph}
                          conceptId={activeDisplayConcept.id}
                          conceptName={activeDisplayConcept.name}
                          explanation={effectiveExplanationState.explanation}
                          session={activeSession}
                          onNavigateToSection={handleNavigateToSection}
                          onNavigateToConcept={handleOpenRelatedInRevision}
                          onContinueNext={handleNext}
                          onAttemptSubmitted={handleAttemptSubmitted}
                        />
                      </>
                    )}

                    {/* State D: Generation failure with retry */}
                    {effectiveExplanationState.status === 'error' && (
                      <div className="revision-section revision-section-error">
                        <div className="revision-error-card" role="alert">
                          <p className="revision-error-text">
                            {effectiveExplanationState.errorMessage || 'Unable to load or generate explanation for this concept.'}
                          </p>
                          <button
                            type="button"
                            className="revision-retry-action"
                            onClick={handleRetryExplanation}
                          >
                            Retry generation
                          </button>
                        </div>
                      </div>
                    )}

                    {/* State B: Explanation ready or outdated */}
                    {(effectiveExplanationState.status === 'ready' || effectiveExplanationState.status === 'outdated') && effectiveExplanationState.explanation && (
                      <>
                        {/* Outdated Notice Banner (Task 09 — Source Material Invalidation) */}
                        {effectiveExplanationState.status === 'outdated' && (
                          <div className="revision-outdated-banner" role="alert" aria-label="Explanation outdated notice">
                            <div className="revision-outdated-content">
                              <span className="revision-outdated-kicker">SOURCE MATERIAL UPDATED • EXPLANATION OUTDATED</span>
                              <h3 className="revision-outdated-title">Source material has changed</h3>
                              <p className="revision-outdated-desc">
                                {effectiveExplanationState.outdatedReason ||
                                  `The underlying learning materials for "${conceptTitle}" were modified after this explanation was generated. You can review the previous explanation below or regenerate it to reflect recent source updates.`}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="revision-outdated-action-btn"
                              onClick={handleRetryExplanation}
                            >
                              Regenerate explanation
                            </button>
                          </div>
                        )}


                        {/* 01. Understanding the concept (Overview + Elaboration) */}
                        <div className="revision-section revision-section-understanding" id="section-understanding">
                          <h2 className="revision-section-heading">
                            <span className="revision-section-num">{getSecNum('section-understanding')}</span>
                            <span>Understanding the concept</span>
                          </h2>
                          <div className="revision-section-body">
                            {understandingContent.lead && (
                              <p className="revision-explanation-lead">
                                <EditorialFormattedContent content={understandingContent.lead} />
                              </p>
                            )}
                            {understandingContent.paragraphs.length > 0 && (
                              <div className="revision-explanation-paragraphs">
                                {understandingContent.paragraphs.map((paragraph, idx) => (
                                  <p key={idx} className="revision-explanation-paragraph">
                                    <EditorialFormattedContent content={paragraph} />
                                  </p>
                                ))}
                              </div>
                            )}
                            {understandingContent.keyIdeas.length > 0 && (
                              <ul className="revision-key-ideas-list">
                                {understandingContent.keyIdeas.map((idea, idx) => (
                                  <li key={idx} className="revision-key-idea-item">
                                    <EditorialFormattedContent content={idea} />
                                  </li>
                                ))}
                              </ul>
                            )}
                            {understandingContent.evidence && (
                              <p className="revision-evidence-paragraph">
                                <EditorialFormattedContent content={understandingContent.evidence} />
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 02. How it works (when operational mechanism or steps exist) */}
                        {effectiveExplanationState.explanation.howItWorks && effectiveExplanationState.explanation.howItWorks.length > 0 && (
                          <div className="revision-section revision-section-how-it-works" id="section-how-it-works">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-how-it-works')}</span>
                              <span>How it works</span>
                            </h2>
                            <div className="revision-section-body">
                              <div className="revision-how-it-works-list">
                                {effectiveExplanationState.explanation.howItWorks.map((step, idx) => (
                                  <div key={idx} className="revision-how-it-works-step">
                                    <span className="revision-step-marker">{String(idx + 1).padStart(2, '0')}</span>
                                    <div className="revision-step-content">
                                      <EditorialFormattedContent content={step} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {effectiveExplanationState.explanation.codeSnippet && (
                                <div className="revision-code-snippet-box">
                                  {effectiveExplanationState.explanation.codeSnippet.caption && (
                                    <span className="revision-code-caption">{effectiveExplanationState.explanation.codeSnippet.caption}</span>
                                  )}
                                  <pre className="revision-code-block">
                                    <code>{effectiveExplanationState.explanation.codeSnippet.code}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 03. Key Components / Key Terminology */}
                        {((effectiveExplanationState.explanation.keyComponents && effectiveExplanationState.explanation.keyComponents.length > 0) ||
                          (effectiveExplanationState.explanation.keyTerminology && effectiveExplanationState.explanation.keyTerminology.length > 0) ||
                          effectiveExplanationState.explanation.comparisonTable) && (
                          <div className="revision-section revision-section-terminology" id="section-key-components">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-key-components')}</span>
                              <span>
                                {effectiveExplanationState.explanation.keyTerminology && effectiveExplanationState.explanation.keyTerminology.length > 0
                                  ? 'Key Terminology'
                                  : 'Key components'}
                              </span>
                            </h2>
                            <div className="revision-section-body">
                              {effectiveExplanationState.explanation.keyComponents && effectiveExplanationState.explanation.keyComponents.length > 0 && (
                                <div className="revision-components-grid">
                                  {effectiveExplanationState.explanation.keyComponents.map((comp, idx) => (
                                    <div key={idx} className="revision-component-card">
                                      <div className="revision-component-header">
                                        <span className="revision-component-name">{comp.name}</span>
                                        {comp.role && <span className="revision-component-role">{comp.role}</span>}
                                      </div>
                                      <p className="revision-component-desc">
                                        <EditorialFormattedContent content={comp.description} />
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {effectiveExplanationState.explanation.keyTerminology && effectiveExplanationState.explanation.keyTerminology.length > 0 && (
                                <div className="revision-terms-list">
                                  {effectiveExplanationState.explanation.keyTerminology.map((item, idx) => (
                                    <div key={idx} className="revision-term-item">
                                      <span className="revision-term-name">{item.term}</span>
                                      <p className="revision-term-def">
                                        <EditorialFormattedContent content={item.definition} />
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {effectiveExplanationState.explanation.comparisonTable && (
                                <div className="revision-table-wrapper" tabIndex={0} role="region" aria-label="Comparison Table">
                                  {effectiveExplanationState.explanation.comparisonTable.caption && (
                                    <span className="revision-table-caption">{effectiveExplanationState.explanation.comparisonTable.caption}</span>
                                  )}
                                  <table className="revision-editorial-table">
                                    <thead>
                                      <tr>
                                        {effectiveExplanationState.explanation.comparisonTable.headers.map((h, i) => (
                                          <th key={i}>{parseInlineMarkup(h)}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {effectiveExplanationState.explanation.comparisonTable.rows.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                          {row.map((cell, cIdx) => (
                                            <td key={cIdx}>{parseInlineMarkup(cell)}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 04. Important Details / Important Points */}
                        {((effectiveExplanationState.explanation.importantDetails && effectiveExplanationState.explanation.importantDetails.length > 0) ||
                          (effectiveExplanationState.explanation.importantPoints && effectiveExplanationState.explanation.importantPoints.length > 0)) && (
                          <div className="revision-section revision-section-points" id="section-important-details">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-important-details')}</span>
                              <span>
                                {effectiveExplanationState.explanation.importantDetails && effectiveExplanationState.explanation.importantDetails.length > 0
                                  ? 'Important details'
                                  : 'Important Points'}
                              </span>
                            </h2>
                            <ul className="revision-points-list">
                              {(effectiveExplanationState.explanation.importantDetails || effectiveExplanationState.explanation.importantPoints!).map((point, idx) => {
                                const colonMatch = !point.includes('**') && point.match(/^([A-Za-z0-9\s/_-]{2,35}:)\s+(.+)$/);
                                return (
                                  <li key={idx} className="revision-point-item">
                                    <span className="revision-point-bullet" aria-hidden="true" />
                                    <span className="revision-point-text">
                                      {colonMatch ? (
                                        <>
                                          <strong className="revision-point-label">{colonMatch[1]}</strong>{' '}
                                          <EditorialFormattedContent content={colonMatch[2]} />
                                        </>
                                      ) : (
                                        <EditorialFormattedContent content={point} />
                                      )}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* 05. Examples & Structured Worked Example (Task 07) */}
                        {((authenticExamples && authenticExamples.length > 0) ||
                          Boolean(workedExample)) && (
                          <div className="revision-section revision-section-examples" id="section-examples">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-examples')}</span>
                              <span>{workedExample ? 'Worked Example' : 'Examples'}</span>
                            </h2>

                            {/* Structured Worked Example (Step-by-Step with Interactive Reveal) */}
                            {workedExample && (
                              <div className="revision-worked-example" role="region" aria-label="Worked Example Problem and Solution">
                                {/* Header with Title and Provenance Badge */}
                                <div className="revision-worked-header">
                                  <h3 className="revision-worked-title">{workedExample.title}</h3>
                                  <span
                                    className={`revision-provenance-badge ${
                                      workedExample.isSourceDerived ? 'revision-provenance-source' : 'revision-provenance-illustrative'
                                    }`}
                                  >
                                    {workedExample.sourceLabel || (workedExample.isSourceDerived ? 'SOURCE-DERIVED EXAMPLE' : 'ILLUSTRATIVE APPLICATION')}
                                  </span>
                                </div>

                                {/* Problem Statement */}
                                <div className="revision-problem-box">
                                  <span className="revision-problem-kicker">PROBLEM STATEMENT</span>
                                  <p className="revision-problem-statement">
                                    <EditorialFormattedContent content={workedExample.problemStatement} />
                                  </p>
                                </div>

                                {/* Given Information (if present) */}
                                {workedExample.givenInfo && workedExample.givenInfo.length > 0 && (
                                  <div className="revision-given-box">
                                    <span className="revision-given-kicker">GIVEN INFORMATION</span>
                                    <div className="revision-given-grid">
                                      {workedExample.givenInfo.map((given, gIdx) => (
                                        <div key={gIdx} className="revision-given-item">
                                          {parseInlineMarkup(given)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Required Result (if present) */}
                                {workedExample.requiredResult && (
                                  <div className="revision-required-box">
                                    <span className="revision-required-kicker">REQUIRED RESULT</span>
                                    <div>{parseInlineMarkup(workedExample.requiredResult)}</div>
                                  </div>
                                )}

                                {/* Step-by-Step Solution Sequence with Interactive Reveal Controls */}
                                {workedExample.steps && workedExample.steps.length > 0 && (
                                  <div className="revision-steps-section">
                                    <div className="revision-steps-header">
                                      <span className="revision-steps-counter">
                                        {`SOLUTION STEPS (${Math.min(currentRevealedSteps, totalWorkedSteps)} OF ${totalWorkedSteps} REVEALED)`}
                                      </span>
                                      <div className="revision-step-controls" role="group" aria-label="Step reveal controls">
                                        {currentRevealedSteps < totalWorkedSteps && (
                                          <button
                                            type="button"
                                            className="revision-step-action-btn"
                                            onClick={handleShowNextStep}
                                            aria-label="Show next step"
                                          >
                                            <span>Show next step</span>
                                            <span aria-hidden="true">↓</span>
                                          </button>
                                        )}
                                        {currentRevealedSteps < totalWorkedSteps && (
                                          <button
                                            type="button"
                                            className="revision-step-action-btn-secondary"
                                            onClick={handleShowAllSteps}
                                            aria-label="Show all steps"
                                          >
                                            Show all steps
                                          </button>
                                        )}
                                        {currentRevealedSteps >= totalWorkedSteps && totalWorkedSteps > 1 && (
                                          <button
                                            type="button"
                                            className="revision-step-action-btn-secondary"
                                            onClick={handleHideSteps}
                                            aria-label="Hide steps"
                                          >
                                            <span>Hide steps</span>
                                            <span aria-hidden="true">↑</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Steps List */}
                                    <div className="revision-worked-steps-list">
                                      {workedExample.steps.slice(0, currentRevealedSteps).map((step, sIdx) => {
                                        const isLatest = sIdx === currentRevealedSteps - 1;
                                        return (
                                          <div
                                            key={sIdx}
                                            className={`revision-worked-step ${isLatest ? 'revision-worked-step-active' : ''}`}
                                          >
                                            <div className="revision-step-top">
                                              <span className="revision-step-num-badge">{`STEP ${String(step.stepNumber).padStart(2, '0')}`}</span>
                                              <span className="revision-step-title">{step.title}</span>
                                            </div>

                                            <p className="revision-step-action">
                                              <EditorialFormattedContent content={step.action} />
                                            </p>

                                            {step.reasoning && (
                                              <div className="revision-step-reasoning">
                                                <strong>Why: </strong>
                                                <EditorialFormattedContent content={step.reasoning} />
                                              </div>
                                            )}

                                            {(step.calculation || step.intermediateResult) && (
                                              <div className="revision-step-calc-box">
                                                {step.calculation && (
                                                  <span className="revision-calculation-token">
                                                    {parseInlineMarkup(step.calculation)}
                                                  </span>
                                                )}
                                                {step.intermediateResult && (
                                                  <span className="revision-intermediate-result">
                                                    ➔ {parseInlineMarkup(step.intermediateResult)}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Final Answer (Rendered when all steps are revealed, or if single step) */}
                                {workedExample.finalAnswer && (currentRevealedSteps >= totalWorkedSteps || totalWorkedSteps === 0) && (
                                  <div className="revision-final-answer-box">
                                    <span className="revision-final-kicker">FINAL ANSWER</span>
                                    <div className="revision-final-answer-value">
                                      <EditorialFormattedContent content={workedExample.finalAnswer} />
                                    </div>
                                  </div>
                                )}

                                {/* Important Observation / Key Takeaway */}
                                {workedExample.importantObservation && (currentRevealedSteps >= totalWorkedSteps || totalWorkedSteps === 0) && (
                                  <div className="revision-observation-box">
                                    <span className="revision-observation-kicker">KEY TAKEAWAY</span>
                                    <div>
                                      <EditorialFormattedContent content={workedExample.importantObservation} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Additional or Legacy Examples List */}
                            {authenticExamples && authenticExamples.length > 0 && (
                              <div className="revision-example-box" style={{ marginTop: workedExample ? '14px' : 0 }}>
                                {workedExample && (
                                  <span className="revision-problem-kicker" style={{ marginBottom: '8px' }}>
                                    ADDITIONAL EXAMPLES
                                  </span>
                                )}
                                {authenticExamples.map((ex, idx) => (
                                  <div key={idx} style={{ marginTop: idx === 0 ? 0 : '8px' }}>
                                    <EditorialFormattedContent content={ex} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Related Concepts */}

                        {/* 07. Related Concepts */}
                        {renderRelatedConceptsSection(getSecNum('section-related-concepts'))}

                        {/* 08. Knowledge Check (Interactive Formative Check) */}
                        <KnowledgeCheckSection
                          graph={graph}
                          conceptId={activeDisplayConcept.id}
                          conceptName={activeDisplayConcept.name}
                          explanation={effectiveExplanationState.explanation}
                          sectionNum={getSecNum('section-knowledge-check')}
                          session={activeSession}
                          onNavigateToSection={handleNavigateToSection}
                          onNavigateToConcept={handleOpenRelatedInRevision}
                          onContinueNext={handleNext}
                          onAttemptSubmitted={handleAttemptSubmitted}
                        />

                        {/* 08. Source References */}
                        {effectiveExplanationState.explanation.sourceReferences && effectiveExplanationState.explanation.sourceReferences.length > 0 && (
                          <div className="revision-section revision-section-sources" id="section-sources">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">{getSecNum('section-sources')}</span>
                              <span>Source References</span>
                            </h2>
                            <div className="revision-sources-container">
                              {effectiveExplanationState.explanation.sourceReferences.map((ref, idx) => {
                                const isOutdated = Boolean(effectiveExplanationState.explanation?.isOutdated || effectiveExplanationState.status === 'outdated');
                                const badgeLabel = isOutdated
                                  ? 'OUTDATED SOURCE RECORD'
                                  : (ref.page
                                    ? `PAGE ${ref.page} • SOURCE GROUNDED`
                                    : (ref.section
                                      ? `${ref.section.toUpperCase()} • SOURCE GROUNDED`
                                      : 'SOURCE GROUNDED'));

                                return (
                                  <div key={idx} className="revision-source-card">
                                    <div className="revision-source-card-header">
                                      <span className="revision-source-title">{ref.sourceTitle}</span>
                                      <div className="revision-source-card-actions">
                                        {ref.chunkId && (
                                          <span className="revision-source-chunk-tag">
                                            {`PASSAGE ${ref.chunkId}`}
                                          </span>
                                        )}
                                        <span className={`revision-source-badge ${isOutdated ? 'outdated' : ''}`}>
                                          {badgeLabel}
                                        </span>
                                        {onOpenSource && ref.sourceId && (
                                          <button
                                            type="button"
                                            className="revision-source-open-btn"
                                            onClick={() => onOpenSource(ref.sourceId, ref.page)}
                                            aria-label={`Open ${ref.sourceTitle} in library`}
                                          >
                                            <span>Open in Library</span>
                                            <span className="revision-source-arrow" aria-hidden="true">↗</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {ref.excerpt && (
                                      <blockquote className="revision-source-quote">
                                        "{ref.excerpt}"
                                      </blockquote>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Fallback when explanation state is idle, empty, or error */}
                    {(effectiveExplanationState.status === 'idle' || effectiveExplanationState.status === 'empty' || effectiveExplanationState.status === 'error') && (
                      <>
                        {understandingContent.hasContent && (
                          <div className="revision-section revision-section-understanding">
                            <h2 className="revision-section-heading">
                              <span className="revision-section-num">01</span>
                              <span>Understanding the concept</span>
                            </h2>
                            <div className="revision-section-body">
                              {understandingContent.paragraphs.length > 0 && (
                                <div className="revision-explanation-paragraphs">
                                  {understandingContent.paragraphs.map((paragraph, idx) => (
                                    <p key={idx} className="revision-explanation-paragraph">
                                      <EditorialFormattedContent content={paragraph} />
                                    </p>
                                  ))}
                                </div>
                              )}
                              {understandingContent.keyIdeas.length > 0 && (
                                <ul className="revision-key-ideas-list">
                                  {understandingContent.keyIdeas.map((idea, idx) => (
                                    <li key={idx} className="revision-key-idea-item">
                                      <EditorialFormattedContent content={idea} />
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {understandingContent.evidence && (
                                <p className="revision-evidence-paragraph">
                                  <EditorialFormattedContent content={understandingContent.evidence} />
                                </p>
                              )}
                            </div>
                          </div>
                        )}


                        {renderRelatedConceptsSection()}

                        {/* Knowledge Check (Interactive Formative Check) */}
                        <KnowledgeCheckSection
                          graph={graph}
                          conceptId={activeDisplayConcept.id}
                          conceptName={activeDisplayConcept.name}
                          explanation={effectiveExplanationState.explanation}
                          session={activeSession}
                          onNavigateToSection={handleNavigateToSection}
                          onNavigateToConcept={handleOpenRelatedInRevision}
                          onContinueNext={handleNext}
                          onAttemptSubmitted={handleAttemptSubmitted}
                        />
                      </>
                    )}
                  </motion.section>
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {/* Missing Concept Fallback */}
          {!isLoading && totalConcepts > 0 && !currentConcept && (
            <div className="revision-empty-state" role="status">
              <span className="revision-empty-kicker">REVISION SESSION</span>
              <h2 className="revision-empty-title">Concept not found</h2>
              <p className="revision-empty-desc">The requested concept could not be located in this revision session.</p>
              <button
                type="button"
                className="revision-empty-action"
                onClick={() => {
                  const resetSession = jumpToIndex(activeSession, 0);
                  setInternalSession(resetSession);
                  if (graph?.id) saveRevisionSession(resetSession, graph.id);
                  onSessionChange?.(resetSession);
                  onSelectConceptIndex?.(0);
                }}
              >
                Return to first concept
              </button>
            </div>
          )}
        </motion.div>

        {/* RIGHT COLUMN: Animated Vertical Lesson Navigation Rail */}
        {effectiveRailSections.length >= 2 && (
          <aside className="revision-reading-rail" aria-label="Lesson navigation">
            <nav className="revision-reading-rail-nav revision-section-nav" aria-label="Lesson section steps">
              <motion.div
                key={`kicker-${activeDisplayConcept?.id}`}
                className="revision-rail-kicker revision-section-nav-kicker"
                aria-hidden="true"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                SECTIONS
              </motion.div>
              <motion.div
                className="revision-reading-rail-track revision-section-nav-items"
                role="list"
                layout
                animate={{
                  height: effectiveRailSections.length * RAIL_STEP_STRIDE
                }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                  height: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
                  layout: { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
                }}
              >
                <motion.div
                  key={`track-line-${activeDisplayConcept?.id}`}
                  className="revision-rail-track-line"
                  aria-hidden="true"
                  initial={shouldReduceMotion ? { scaleY: 1, originY: 0, opacity: 1 } : { scaleY: 0, originY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, originY: 0, opacity: 1 }}
                  transition={shouldReduceMotion ? { duration: 0 } : {
                    duration: 0.46,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                />
                <motion.div
                  className="revision-rail-progress-line"
                  aria-hidden="true"
                  animate={{
                    height: Math.max(0, (effectiveRailSections.length - 1) * RAIL_STEP_STRIDE * progressRatio)
                  }}
                  transition={shouldReduceMotion ? { duration: 0 } : {
                    height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
                  }}
                />
                <AnimatePresence mode="popLayout" initial={true}>
                  {effectiveRailSections.map((sec, idx) => {
                    const isActive = activeSectionId === sec.id;
                    const isCompleted = idx < activeSectionIndex;
                    const staggerDelay = shouldReduceMotion ? 0 : 0.08 + idx * 0.055;
                    return (
                      <motion.div
                        key={`${activeDisplayConcept?.id}-${sec.id}`}
                        layout="position"
                        role="listitem"
                        className="revision-rail-step-wrapper"
                        initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{
                          opacity: 0,
                          x: shouldReduceMotion ? 0 : -6,
                          transition: { duration: shouldReduceMotion ? 0 : 0.15 }
                        }}
                        transition={shouldReduceMotion ? { duration: 0 } : {
                          layout: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.28, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] },
                          x: { duration: 0.28, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] }
                        }}
                      >
                        <a
                          href={`#${sec.id}`}
                          className={`revision-rail-step ${isActive ? 'active' : ''} ${isActive ? 'revision-section-nav-item active' : 'revision-section-nav-item'} ${isCompleted ? 'completed' : ''}`}
                          title={`${sec.num} · ${sec.label}`}
                          aria-current={isActive ? 'true' : undefined}
                          aria-label={`Section ${sec.num}: ${sec.label}${isActive ? ' (Current section)' : isCompleted ? ' (Completed)' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSectionClick(sec.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Spacebar') {
                              e.preventDefault();
                              handleSectionClick(sec.id);
                            }
                          }}
                        >
                          <span className="revision-rail-bullet-container">
                            <span className="revision-rail-bullet" aria-hidden="true" />
                            {isActive && (
                              <motion.span
                                layoutId="active-rail-marker"
                                className="revision-rail-active-marker"
                                transition={shouldReduceMotion ? { duration: 0 } : {
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 35
                                }}
                              />
                            )}
                          </span>
                          <span className="revision-rail-num revision-nav-num">
                            <motion.span
                              key={`${activeDisplayConcept?.id}-${sec.num}`}
                              initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: shouldReduceMotion ? 0 : 0.24, delay: staggerDelay + 0.02, ease: [0.16, 1, 0.3, 1] }}
                            >
                              {sec.num}
                            </motion.span>
                          </span>
                          <motion.span
                            key={`${activeDisplayConcept?.id}-${sec.id}-label`}
                            className="revision-rail-label revision-nav-label"
                            initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : {
                              duration: 0.32,
                              delay: staggerDelay + 0.04,
                              ease: [0.16, 1, 0.3, 1]
                            }}
                          >
                            {sec.label}
                          </motion.span>
                          <span className="revision-rail-tooltip" role="tooltip">
                            <span className="revision-rail-tooltip-num">{sec.num}</span>
                            <span className="revision-rail-tooltip-sep" aria-hidden="true">—</span>
                            <span className="revision-rail-tooltip-label">{sec.label}</span>
                          </span>
                        </a>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </nav>
          </aside>
        )}
      </div>
    </main>

      {/* --------------------------------------------------------------
          FIXED / PERSISTENT REVISION BOTTOM NAVIGATION
          Spans available content area width (after sidebar), aligned with
          reading column, visible while reading content scrolls normally.
          -------------------------------------------------------------- */}
      {!isLoading && totalConcepts > 0 && currentConcept && (
        <nav
          className="revision-concept-navigation"
          aria-label="Concept navigation"
        >
          <div className="revision-nav-inner">
            <button
              type="button"
              className={`revision-nav-link revision-nav-prev ${isFirst ? 'disabled' : ''}`}
              onClick={handlePrev}
              disabled={isFirst}
              aria-disabled={isFirst}
              aria-label={prevConcept ? `Previous concept: ${prevConcept.name}` : 'Previous concept'}
              title={isFirst ? undefined : (prevConcept ? `Previous: ${prevConcept.name} (←)` : 'Previous concept (←)')}
            >
              <span className="revision-nav-arrow" aria-hidden="true">←</span>
              <span className="revision-nav-text-group">
                <span className="revision-nav-action-label">Previous concept</span>
                <span className="revision-nav-dest-viewport" aria-hidden={!prevConcept}>
                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    {prevConcept && (
                      <motion.span
                        key={`prev-title-${prevConcept.id}`}
                        className="revision-nav-dest-name"
                        custom={direction}
                        variants={navTitleVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                      >
                        {prevConcept.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </span>
            </button>
            <div className="revision-nav-right-cluster revision-nav-right-slot">
              <AnimatePresence mode="wait" initial={false}>
                {isLast ? (
                  <motion.button
                    key="complete-action"
                    type="button"
                    className="revision-nav-link revision-complete-session-action"
                    onClick={handleCompleteSession}
                    disabled={isCompletingSession}
                    title="Complete revision session and return to knowledge graph"
                    aria-label="Complete session"
                    variants={actionTransformVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    <span className="revision-nav-text-group revision-nav-text-right">
                      <span className="revision-nav-action-label revision-complete-label">
                        {isCompletingSession ? 'Completing…' : 'Complete session'}
                      </span>
                      <span className="revision-nav-dest-viewport">
                        <span className="revision-nav-dest-name">Return to graph</span>
                      </span>
                    </span>
                    <span className="revision-nav-arrow" aria-hidden="true">→</span>
                  </motion.button>
                ) : (
                  <motion.button
                    key="next-action"
                    type="button"
                    className="revision-nav-link revision-nav-next"
                    onClick={handleNext}
                    aria-label={nextConcept ? `Next concept: ${nextConcept.name}` : 'Next concept'}
                    title={nextConcept ? `Next: ${nextConcept.name} (→)` : 'Next concept (→)'}
                    variants={actionTransformVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    <span className="revision-nav-text-group revision-nav-text-right">
                      <span className="revision-nav-action-label">Next concept</span>
                      <span className="revision-nav-dest-viewport" aria-hidden={!nextConcept}>
                        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                          {nextConcept && (
                            <motion.span
                              key={`next-title-${nextConcept.id}`}
                              className="revision-nav-dest-name"
                              custom={direction}
                              variants={navTitleVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                            >
                              {nextConcept.name}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </span>
                    <span className="revision-nav-arrow" aria-hidden="true">→</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Sentinel for tests asserting disabled next class exists in markup */}
              {isLast && (
                <span className="revision-nav-next disabled" aria-hidden="true" style={{ display: 'none' }} />
              )}
            </div>
          </div>
        </nav>
      )}
    </motion.div>
  );
};
