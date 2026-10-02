import type { TextChunk, KnowledgeSource, DocumentProfile, DocumentSection } from '../types/knowledgeGraph';

/**
 * =========================================================================
 * DOCUMENT UNDERSTANDING SERVICE
 * 
 * Understands document structure before concept extraction:
 * - Inferred Title & Subject Area
 * - Chapter/Section/Subheading Outline
 * - Definition & Formula Extractor
 * - Document-specific Domain Vocabulary Context
 * =========================================================================
 */

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
    triggerKeywords: ['optics', 'light', 'mirror', 'lens', 'reflection', 'refraction', 'focal', 'curvature', 'ray', 'magnification'],
    specializedTerms: ['spherical mirror', 'concave mirror', 'convex mirror', 'mirror formula', 'magnification', 'focal length', 'principal axis', 'pole', 'aperture', 'refraction', 'reflection']
  },
  {
    domain: 'Computer Science',
    subject: 'Operating Systems',
    triggerKeywords: ['operating system', 'kernel', 'process', 'thread', 'virtual memory', 'paging', 'scheduling', 'cpu', 'deadlock'],
    specializedTerms: ['operating system', 'process scheduling', 'virtual memory', 'inter-process communication', 'process control block', 'translation lookaside buffer', 'memory management unit', 'thread', 'kernel', 'scheduler', 'semaphore', 'mutex']
  },
  {
    domain: 'Computer Science',
    subject: 'Computer Networks',
    triggerKeywords: ['network', 'packet', 'router', 'protocol', 'tcp', 'ip', 'bandwidth', 'latency', 'topology', 'ethernet'],
    specializedTerms: ['computer network', 'packet switching', 'router', 'switch', 'socket', 'port', 'protocol', 'network topology', 'ethernet']
  },
  {
    domain: 'Computer Science',
    subject: 'Machine Learning & Deep Learning',
    triggerKeywords: ['machine learning', 'neural network', 'deep learning', 'gradient', 'backpropagation', 'transformer', 'convolutional', 'loss function', 'activation'],
    specializedTerms: ['machine learning', 'deep learning', 'neural network', 'gradient descent', 'backpropagation algorithm', 'loss function', 'activation function', 'tensor', 'embedding']
  },
  {
    domain: 'Computer Science',
    subject: 'Databases',
    triggerKeywords: ['database', 'sql', 'relation', 'table', 'query', 'transaction', 'acid', 'index', 'schema', 'normalization'],
    specializedTerms: ['relational database', 'database schema', 'database transaction', 'acid properties', 'database normalization', 'sql query', 'index']
  },
  {
    domain: 'Mathematics',
    subject: 'Linear Algebra & Calculus',
    triggerKeywords: ['matrix', 'vector', 'eigenvalue', 'determinant', 'derivative', 'integral', 'linear transformation', 'vector space'],
    specializedTerms: ['matrix', 'vector', 'vector space', 'linear transformation', 'eigenvalue', 'determinant', 'derivative', 'integral']
  }
];

/**
 * Builds a structured semantic profile of the document prior to concept extraction.
 */
export function buildDocumentProfile(
  chunks: TextChunk[],
  source?: KnowledgeSource
): DocumentProfile {
  const sections: DocumentSection[] = [];
  const definitionsFound: Array<{ term: string; definition: string; chunkIndex: number }> = [];
  const formulasFound: Array<{ term?: string; formula: string; chunkIndex: number }> = [];

  let totalWords = 0;
  const headingsSet = new Set<string>();

  // 1. Identify Document Title
  let title = '';
  if (source?.fileName) {
    title = source.fileName.replace(/\.[^/.]+$/, '').trim();
  } else if (source?.name) {
    title = source.name.trim();
  }

  // 2. Scan Chunks for Headings, Definitions, Formulas
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const text = chunk.text || '';
    const words = text.split(/\s+/).filter(Boolean);
    totalWords += words.length;

    // A. Detect chunk heading
    if (chunk.heading && !headingsSet.has(chunk.heading.trim())) {
      const headingClean = chunk.heading.trim();
      headingsSet.add(headingClean);
      sections.push({
        heading: headingClean,
        level: headingClean.startsWith('###') ? 3 : headingClean.startsWith('##') ? 2 : 1,
        chunkIndexes: [idx]
      });
    }

    // B. Scan text lines for headings (markdown and textbook patterns)
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Markdown heading
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

      // Textbook chapter / section heading: e.g. "Chapter 10: Light", "10.2 Spherical Mirrors"
      const secMatch = trimmed.match(/^(?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)+)\s*[:–—\-]?\s*(.+)$/i);
      if (secMatch) {
        const hText = trimmed;
        if (!headingsSet.has(hText) && hText.length < 100) {
          headingsSet.add(hText);
          sections.push({
            heading: hText,
            level: 1,
            chunkIndexes: [idx]
          });
          if (!title) title = hText;
        }
      }
    }

    // C. Scan for Explicit Definitions
    // e.g. "A spherical mirror ... is called a concave mirror."
    // e.g. "Virtual Memory is defined as a technique..."
    // e.g. "Process Scheduling refers to the mechanism..."
    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sent of sentences) {
      const s = sent.trim();
      if (s.length < 20 || s.length > 350) continue;

      // Pattern 1: "... is called / is termed / is known as X"
      const calledMatch = s.match(/(?:(?:is|are)\s+(?:called|termed|known as|defined as))\s+(?:a|an|the\s+)?([A-Za-z][a-zA-Z\s-]{2,40})/i);
      if (calledMatch) {
        let term = calledMatch[1].replace(/[.,;:].*$/, '').trim();
        // Capitalize words
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx });
        }
      }

      // Pattern 2: "X is defined as Y" or "X refers to Y" or "X is a/an Y that Z"
      const refersMatch = s.match(/^([A-Z][a-zA-Z\s-]{2,40})\s+(?:is defined as|refers to|denotes|is a technique that|is an algorithm that|is a method that|is a principle that|is a device that|is a process that|is a system that|is an architecture that)\s+([^.]+)/i);
      if (refersMatch) {
        const term = refersMatch[1].trim();
        if (term.length >= 3 && !definitionsFound.some(d => d.term.toLowerCase() === term.toLowerCase())) {
          definitionsFound.push({ term, definition: s, chunkIndex: idx });
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
          formulasFound.push({ term, formula, chunkIndex: idx });
        }
      } else {
        const formulaMatch = s.match(/\b(?:formula|equation|relationship)\s*[:=]\s*([^\n.;]+)/i) ||
          s.match(/([a-zA-Z]['_a-zA-Z0-9]*\s*=\s*[^.,;]{3,35})/);
        if (formulaMatch) {
          const formula = formulaMatch[0].trim();
          if (formula.length >= 5 && formula.includes('=') && !formulasFound.some(f => f.formula === formula)) {
            formulasFound.push({ formula, chunkIndex: idx });
          }
        }
      }
    }
  }

  // 3. Fallback Title
  if (!title && sections.length > 0) {
    title = sections[0].heading;
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
    .map(s => s.heading.replace(/^#+\s*/, '').trim())
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
