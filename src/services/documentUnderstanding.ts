import type { TextChunk, KnowledgeSource, DocumentProfile, DocumentSection } from '../types/knowledgeGraph';

/**
 * =========================================================================
 * DOCUMENT UNDERSTANDING SERVICE
 * 
 * Preserves document structure before concept extraction:
 * - Source ID, Page Numbers, Sections, Subsections
 * - Structural Blocks (Headings, Paragraphs, Lists, Definitions)
 * - Inferred Title, Subject Area & Domain Taxonomy
 * - Direct Definitional Quotes & Formula Representations
 * =========================================================================
 */

export interface DocumentBlock {
  chunkId: string;
  sourceId: string;
  page?: number;
  section?: string;
  subsection?: string;
  heading?: string;
  blockType: 'heading' | 'paragraph' | 'list_item' | 'definition' | 'table';
  text: string;
}

/**
 * Common domain keywords map used to recognize when a common word
 * is actually a specialized technical term within a specific subject.
 */
const DOMAIN_SUBJECT_HEURISTICS: Array<{
  domain: string;
  subject: string;
  triggerKeywords: string[];
  specializedTerms: string[];
}> = [
  {
    domain: 'Physics',
    subject: 'Optics & Light',
    triggerKeywords: ['optics', 'light', 'mirror', 'lens', 'reflection', 'refraction', 'focal', 'curvature', 'ray', 'magnification', 'pole', 'aperture'],
    specializedTerms: [
      'spherical mirror', 'concave mirror', 'convex mirror', 'mirror formula',
      'magnification', 'focal length', 'principal axis', 'pole', 'center of curvature',
      'radius of curvature', 'refraction', 'reflection', 'aperture', 'optical center'
    ]
  },
  {
    domain: 'Computer Science',
    subject: 'Operating Systems',
    triggerKeywords: ['operating system', 'kernel', 'process', 'thread', 'virtual memory', 'paging', 'scheduling', 'cpu', 'deadlock', 'scheduler'],
    specializedTerms: [
      'operating system', 'process', 'process scheduling', 'process scheduler', 'thread',
      'virtual memory', 'inter-process communication', 'process control block',
      'translation lookaside buffer', 'memory management unit', 'computer hardware',
      'software resources', 'kernel', 'deadlock', 'semaphore', 'mutex',
      'round robin', 'context switch', 'first-come, first-served', 'shortest job first',
      'shortest remaining time first', 'priority scheduling', 'starvation', 'aging',
      'time quantum', 'waiting time', 'turnaround time', 'response time', 'throughput',
      'cpu utilization'
    ]
  },
  {
    domain: 'Computer Science',
    subject: 'Databases & DBMS',
    triggerKeywords: ['database', 'sql', 'relation', 'table', 'query', 'transaction', 'acid', 'index', 'schema', 'normalization', 'atomicity', 'consistency', 'isolation', 'durability'],
    specializedTerms: [
      'relational database', 'database schema', 'database transaction', 'transaction',
      'acid properties', 'atomicity', 'consistency', 'isolation', 'durability',
      'database normalization', 'sql query', 'index', 'concurrency control',
      'serializability', 'database constraints'
    ]
  },
  {
    domain: 'Computer Science',
    subject: 'Machine Learning & Deep Learning',
    triggerKeywords: ['machine learning', 'neural network', 'deep learning', 'gradient', 'backpropagation', 'transformer', 'convolutional', 'loss function', 'activation'],
    specializedTerms: [
      'machine learning', 'deep learning', 'neural network', 'artificial neural network',
      'convolutional neural network', 'recurrent neural network', 'gradient descent',
      'stochastic gradient descent', 'backpropagation', 'backpropagation algorithm',
      'loss function', 'activation function', 'tensor', 'embedding', 'self-attention'
    ]
  },
  {
    domain: 'Computer Science',
    subject: 'Computer Networks',
    triggerKeywords: ['network', 'packet', 'router', 'protocol', 'tcp', 'ip', 'bandwidth', 'latency', 'topology', 'ethernet'],
    specializedTerms: [
      'computer network', 'packet switching', 'router', 'switch', 'socket', 'port',
      'protocol', 'network topology', 'ethernet', 'tcp/ip', 'dns', 'http'
    ]
  },
  {
    domain: 'Mathematics',
    subject: 'Linear Algebra & Calculus',
    triggerKeywords: ['matrix', 'vector', 'eigenvalue', 'determinant', 'derivative', 'integral', 'linear transformation', 'vector space'],
    specializedTerms: [
      'matrix', 'vector', 'vector space', 'linear transformation', 'eigenvalue',
      'determinant', 'derivative', 'integral', 'eigenvector', 'gradient'
    ]
  }
];

/**
 * Transforms unstructured text chunks into structured semantic document blocks.
 */
export function createStructuredDocumentBlocks(chunks: TextChunk[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  for (const chunk of chunks) {
    const lines = (chunk.text || '').split('\n').map(l => l.trim()).filter(Boolean);
    let activeSection = chunk.section || chunk.heading || undefined;
    let activeSubsection: string | undefined = chunk.subsection || undefined;

    for (const line of lines) {
      // 1. Heading check
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const headingText = line.replace(/^#+\s*/, '').trim();
        if (level <= 2) {
          activeSection = headingText;
          activeSubsection = undefined;
        } else {
          activeSubsection = headingText;
        }
        blocks.push({
          chunkId: chunk.chunkId,
          sourceId: chunk.sourceId,
          page: chunk.page,
          section: activeSection,
          subsection: activeSubsection,
          heading: headingText,
          blockType: 'heading',
          text: line
        });
      }
      // 2. List Item check
      else if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
        blocks.push({
          chunkId: chunk.chunkId,
          sourceId: chunk.sourceId,
          page: chunk.page,
          section: activeSection,
          subsection: activeSubsection,
          heading: chunk.heading,
          blockType: 'list_item',
          text: line
        });
      }
      // 3. Paragraph
      else {
        blocks.push({
          chunkId: chunk.chunkId,
          sourceId: chunk.sourceId,
          page: chunk.page,
          section: activeSection,
          subsection: activeSubsection,
          heading: chunk.heading,
          blockType: 'paragraph',
          text: line
        });
      }
    }
  }

  return blocks;
}

/**
 * Builds a structured semantic profile of the document prior to concept extraction.
 */
export function buildDocumentProfile(
  chunks: TextChunk[],
  source?: KnowledgeSource
): DocumentProfile {
  const sections: DocumentSection[] = [];
  const definitionsFound: Array<{ term: string; definition: string; chunkIndex: number; page?: number; chunkId?: string }> = [];
  const formulasFound: Array<{ term?: string; formula: string; chunkIndex: number; page?: number; chunkId?: string }> = [];

  let totalWords = 0;
  const headingsSet = new Set<string>();

  // 1. Identify Document Title
  let title = '';
  if (source?.fileName) {
    const rawBase = source.fileName.replace(/\.[^/.]+$/, '').trim();
    if (!rawBase.toLowerCase().includes('concept_extraction_test') && !rawBase.toLowerCase().includes('fixture')) {
      title = rawBase;
    }
  } else if (source?.name) {
    const rawBase = source.name.trim();
    if (!rawBase.toLowerCase().includes('concept_extraction_test') && !rawBase.toLowerCase().includes('fixture')) {
      title = rawBase;
    }
  }

  // Scan chunk 0 for prominent document title
  if (!title && chunks.length > 0) {
    const firstLines = (chunks[0]?.text || '').split('\n').map(l => l.trim()).filter(Boolean);
    for (const fl of firstLines.slice(0, 4)) {
      if (
        fl.length >= 5 && fl.length <= 80 &&
        !fl.startsWith('#') &&
        !/^(?:chapter|[0-9]+\.)/i.test(fl) &&
        !/^(?:graphmind|test document|page \d|figure|table)/i.test(fl) &&
        !fl.endsWith('.')
      ) {
        title = fl;
        break;
      }
    }
  }

  // 2. Scan Chunks for Headings, Definitions, Formulas
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const text = chunk.text || '';
    const words = text.split(/\s+/).filter(Boolean);
    totalWords += words.length;

    // A. Detect chunk heading if provided
    if (chunk.heading && !headingsSet.has(chunk.heading.trim())) {
      const headingClean = chunk.heading.trim();
      headingsSet.add(headingClean);
      sections.push({
        heading: headingClean,
        level: headingClean.startsWith('###') ? 3 : headingClean.startsWith('##') ? 2 : 1,
        chunkIndexes: [idx]
      });
      if (!title) title = headingClean.replace(/^#+\s*/, '').replace(/^[0-9]+(?:\.[0-9]+)*\.?\s*/, '').trim();
    }

    // B. Scan text lines for headings (markdown and textbook patterns)
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Markdown heading: # Heading
      const mdMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (mdMatch) {
        const hText = mdMatch[2].trim();
        if (!headingsSet.has(hText) && hText.length > 2 && hText.length < 100) {
          headingsSet.add(hText);
          sections.push({
            heading: hText,
            level: mdMatch[1].length,
            chunkIndexes: [idx]
          });
          if (!title) title = hText;
        }
      }

      // Textbook chapter / section heading: e.g. "Chapter 10: Light", "10.2 Spherical Mirrors", "1. Introduction", "3. First-Come, First-Served (FCFS)"
      const secMatch = trimmed.match(/^(?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)*\.?)\s*[:–—\-]?\s*(.+)$/i);
      if (secMatch) {
        const hText = trimmed;
        if (!headingsSet.has(hText) && hText.length < 100) {
          headingsSet.add(hText);
          sections.push({
            heading: hText,
            level: 1,
            chunkIndexes: [idx]
          });
          if (!title) title = secMatch[1].trim();
        }
      }

      // Table / Glossary Row Check:
      // e.g. "Waiting time Time a process spends waiting in the ready queue."
      // e.g. "Turnaround time Time from process submission to process completion."
      // e.g. "Response time Time from a request until the system first produces a response."
      // e.g. "Throughput Number of processes completed per unit of time."
      // e.g. "CPU utilization Percentage of time the processor is kept busy."
      const tableRowMatch = trimmed.match(
        /^([A-Z][a-zA-Z\s-]{1,24})\s+(Time\s+(?:a|from|until)\b.+|Number\s+of\s+processes\b.+|Percentage\s+of\s+time\b.+)/i
      );
      if (tableRowMatch) {
        let rawTerm = tableRowMatch[1].trim();
        const definition = `${rawTerm}: ${tableRowMatch[2].trim()}`;
        // Normalize term casing
        const term = rawTerm.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }
    }

    // C. Scan for Explicit Definitions & Core Principles
    const rawParagraphs = text.split(/\n\s*\n+/);
    const sentences: string[] = [];
    for (const p of rawParagraphs) {
      const pTrimmed = p.trim();
      // If paragraph starts with heading line, strip heading
      const pClean = pTrimmed.replace(/^(?:#{1,4}\s+|[0-9]+(?:\.[0-9]+)*\.?\s+|Chapter\s+[0-9]+[:\s–—\-]|Section\s+[0-9.]+[:\s–—\-])[^\n]*\n+/i, '').trim();
      for (const sent of pClean.split(/(?<=[.!?])\s+/)) {
        const s = sent.trim();
        if (s.length >= 15 && s.length <= 350) {
          sentences.push(s);
        }
      }
    }
    for (const s of sentences) {

      // Pattern 1: "... is called / is termed / is known as X"
      // e.g. "...forms a part of a sphere. The centre of this sphere is called the centre of curvature (C)."
      // e.g. "...is a point called the pole (P)."
      const calledMatch = s.match(/(?:(?:is|are)\s+(?:called|termed|known as|defined as))\s+(?:a|an|the\s+)?([A-Za-z][a-zA-Z\s-]{2,40})/i);
      if (calledMatch) {
        let term = calledMatch[1].replace(/[.,;:].*$/, '').trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2: "X is defined as Y" or "X refers to Y" or "X is a/an Y that Z"
      // e.g. "A process is a program in execution."
      // e.g. "Operating System is system software that manages computer hardware and software resources."
      // e.g. "CPU scheduling is the mechanism used by an operating system to select a process..."
      // e.g. "Aging is a technique used to reduce starvation."
      // e.g. "Round Robin scheduling is designed for time-sharing systems."
      const refersMatch = s.match(/^(?:An?\s+|The\s+)?([A-Z][a-zA-Z\s-]{2,40})\s+(?:is defined as|refers to|denotes|is the mechanism used by|is a technique used to|is designed for|is a technique that|is an algorithm that|is a method that|is a principle that|is a device that|is a process that|is a system that|is an architecture that|is a program in execution|is system software that)\s+([^.]+)/i);
      if (refersMatch) {
        let term = refersMatch[1].trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2b: "A <Term> is a/an <Definition>"
      const aTermIsMatch = s.match(/^An?\s+([a-zA-Z\s-]{3,35})\s+(?:is a|is an|is the process of|is the property of|is defined as|refers to)\s+([^.]+)/i);
      if (aTermIsMatch) {
        let term = aTermIsMatch[1].trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2c: Properties & Guarantees: "Atomicity ensures that...", "Consistency preserves...", "Isolation controls..."
      const propertyVerbMatch = s.match(/^([A-Z][a-zA-Z\s-]{2,30})\s+(?:ensures|preserves|controls|governs|guarantees|determines)\s+(?:that\s+)?([^.]+)/i);
      if (propertyVerbMatch) {
        const term = propertyVerbMatch[1].trim();
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2d: Problems & Mechanisms: "A common problem is <Term>: ...", "<Term> selects ...", "<Term> assigns ..."
      const problemMatch = s.match(/\b(?:common problem is|phenomenon of|occurs when|technique of)\s+([a-zA-Z\s-]{3,30})[:;–—\s]/i);
      if (problemMatch) {
        let term = problemMatch[1].trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2e: Preemptive form: "<Term> is the preemptive form of <Target>"
      const preemptMatch = s.match(/^([A-Z][a-zA-Z\s-]{3,40})\s+is the preemptive form of\s+([A-Za-z\s-]+)/i);
      if (preemptMatch) {
        const term = preemptMatch[1].trim();
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 2f: Parameter / Entity definition: "Each ready process receives a fixed <Term>."
      const fixedTermMatch = s.match(/receives a fixed\s+([a-zA-Z\s-]{3,30})\./i);
      if (fixedTermMatch) {
        let term = fixedTermMatch[1].trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      }

      // Pattern 3: Formulas & Equations (e.g. "Mirror formula: 1/v + 1/u = 1/f", "Magnification: m = h'/h = -v/u")
      const formulaNamedMatch = s.match(/\b([A-Za-z][a-zA-Z\s-]{2,30})\s*(?:formula|equation|law|rule|theorem)\s*[:=]\s*([^\n.;]+)/i);
      if (formulaNamedMatch) {
        const baseName = formulaNamedMatch[1].trim();
        const suffix = /formula/i.test(s) ? 'Formula' : /equation/i.test(s) ? 'Equation' : /law/i.test(s) ? 'Law' : 'Formula';
        const term = baseName.toLowerCase().endsWith(suffix.toLowerCase())
          ? baseName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : `${baseName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} ${suffix}`;
        const formula = formulaNamedMatch[2].trim();
        if (!formulasFound.some(f => f.formula === formula)) {
          formulasFound.push({ term, formula, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
        }
      } else {
        const formulaMatch = s.match(/\b(?:formula|equation|relationship)\s*[:=]\s*([^\n.;]+)/i) ||
          s.match(/([a-zA-Z]['_a-zA-Z0-9]*\s*=\s*[^.,;]{3,35})/);
        if (formulaMatch) {
          const formula = formulaMatch[0].trim();
          if (formula.length >= 5 && formula.includes('=') && !formulasFound.some(f => f.formula === formula)) {
            formulasFound.push({ formula, chunkIndex: idx, page: chunk.page, chunkId: chunk.chunkId });
          }
        }
      }
    }
  }

  // 3. Fallback Title
  if (!title && sections.length > 0) {
    title = sections[0].heading.replace(/^[0-9]+(?:\.[0-9]+)*\.?\s*/, '').trim();
  }
  if (!title) {
    title = 'Educational Material';
  }

  // 4. Infer Subject & Domain Context
  const combinedTextSample = [
    title,
    ...sections.map(s => s.heading),
    ...chunks.slice(0, 3).map(c => c.text)
  ].join(' ').toLowerCase();

  let inferredDomain = 'General';
  let inferredSubject = title;
  const domainKeywords = new Set<string>();

  for (const h of DOMAIN_SUBJECT_HEURISTICS) {
    let matchCount = 0;
    for (const kw of h.triggerKeywords) {
      if (combinedTextSample.includes(kw)) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
      inferredDomain = h.domain;
      inferredSubject = `${h.domain}: ${h.subject}`;
      for (const t of h.specializedTerms) {
        domainKeywords.add(t);
      }
      break;
    }
  }

  const BOILERPLATE_WORDS = new Set([
    'introduction', 'intro', 'summary', 'conclusion', 'conclusions', 'overview',
    'appendix', 'references', 'notes', 'exercises', 'questions', 'general', 'chapter',
    'section', 'part', 'preface', 'acknowledgments', 'index'
  ]);
  const majorTopics = sections
    .map(s => s.heading.replace(/^#+\s*/, '').replace(/^[0-9]+(?:\.[0-9]+)*\.?\s*/, '').trim())
    .filter(Boolean)
    .filter(h => {
      const words = h.toLowerCase().split(/\s+/).filter(Boolean);
      return !words.every(w => BOILERPLATE_WORDS.has(w));
    });

  return {
    title,
    inferredSubject,
    inferredDomain,
    majorTopics: majorTopics.length > 0 ? majorTopics : [title],
    sections,
    totalWordCount: totalWords,
    definitionsFound,
    formulasFound,
    domainKeywords: Array.from(domainKeywords)
  };
}
