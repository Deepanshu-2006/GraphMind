import type { 
  KnowledgeSource, 
  TextChunk, 
  ExtractionResult 
} from '../types/knowledgeGraph';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure worker in browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // If worker configuration fails, pdfjs automatically runs in-process with fallback
  }
}

/**
 * PDF Extraction Development Verification Logger (Requirement 9)
 * Disabled after verification to prevent console clutter.
 */
const DEBUG_VERBOSE_PDF_LOGS = false;

function logPdfDevVerification(filename: string, pageCount: number, charCount: number, previewText: string) {
  if (DEBUG_VERBOSE_PDF_LOGS) {
    console.log(
      `[PDF Extraction Verification]\n` +
      `  filename: ${filename}\n` +
      `  page count: ${pageCount}\n` +
      `  extracted character count: ${charCount}\n` +
      `  first ~200 characters: "${previewText.slice(0, 200).replace(/\n/g, ' ')}"`
    );
  }
}

/**
 * PDF Extraction Error Logger (Requirement 4)
 */
function logPdfExtractionError(
  filename: string,
  fileType: string,
  parserStage: string,
  err: unknown
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[PDF Extraction Error]`, {
    filename,
    fileType,
    parserStage,
    error: message,
    stack
  });
}

/**
 * ==================================================
 * TEXT EXTRACTION & NORMALIZATION PIPELINE (Day 2 Step 3)
 * Flow: SOURCE → TEXT EXTRACTION → CLEAN TEXT → CHUNKS
 * ==================================================
 */

export interface ChunkOptions {
  maxChunkWords?: number;
  minChunkWords?: number;
  overlapWords?: number;
}

/**
 * 1. Lightweight Text Normalization
 * Handles:
 * - Repeated whitespace & irregular tabs
 * - Excessive blank lines
 * - Line-break hyphenation artifacts (e.g. transfor-\nmers -> transformers)
 * - Page numbers & running footer artifacts (e.g. Page 1 of 12, --- 2 ---)
 * - Preserves meaningful paragraph & heading boundaries
 */
export function normalizeText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // 1. Standardize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

      // 2. Remove null bytes and non-printable control characters (retain \n and \t)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

      // 3. Fix soft hyphenation across line breaks: e.g. "convolu-\ntional" -> "convolutional"
      .replace(/([a-zA-Z])- *\n *([a-zA-Z])/g, '$1$2')

      // 4. Strip obvious page number footers/headers: e.g. "Page 1 of 12", "--- 2 ---", "- 4 -", "[ Page 3 ]"
      .replace(/^[ \t]*(?:Page \d+(?: of \d+)?|[-–—]+ *\d+ *[-–—]+|\d+\s*\/\s*\d+|\[\s*Page \d+\s*\])[ \t]*$/gim, '')

      // 5. Replace excessive horizontal whitespace with a single space on each line
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')

      // 6. Collapse 3 or more consecutive blank lines into a double newline (preserves paragraphs)
      .replace(/\n{3,}/g, '\n\n')

      // 7. Final trim
      .trim()
  );
}

/**
 * 2. Markdown Cleanup
 * Preserves headings (# Heading), bullet points, and structure while removing
 * heavy raw HTML, image tags, and link destinations.
 */
export function cleanMarkdown(markdownText: string): string {
  if (!markdownText) return '';

  return (
    markdownText
      // Remove HTML comments <!-- ... -->
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove image embeds: ![alt](url)
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Simplify link embeds to just link text: [Link Text](https://...) -> Link Text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove raw HTML tags: <div ...> -> ''
      .replace(/<[^>]+>/g, '')
  );
}

/**
 * 3. Robust Multi-Page PDF Text Extractor
 * Uses pdfjs-dist to parse native PDF structures, font encodings (Type1/TrueType/CID/CMap),
 * multi-column layouts, and stream compressions.
 */
export async function extractTextFromPdfBytes(
  pdfBytes: Uint8Array,
  fileName: string = 'document.pdf'
): Promise<string> {
  let stage = 'input-validation';

  if (!pdfBytes || pdfBytes.length === 0) {
    const errorMsg = "Couldn't read the file. The PDF is empty.";
    logPdfExtractionError(fileName, 'pdf', stage, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  // Check PDF signature (%PDF-)
  const decoder = new TextDecoder('latin1');
  const header = decoder.decode(pdfBytes.subarray(0, 10)).trimStart();

  if (!header.startsWith('%PDF-')) {
    stage = 'mock-or-plaintext-check';
    // Fallback check for plain-text / mock demo files uploaded as .pdf (e.g. Stanford CS229 sample)
    const utf8Text = new TextDecoder('utf-8').decode(pdfBytes).trim();
    // eslint-disable-next-line no-control-regex
    const controlChars = utf8Text.match(/[\x00-\x08\x0E-\x1F]/g);
    if (utf8Text.length > 0 && (!controlChars || controlChars.length / utf8Text.length < 0.05)) {
      logPdfDevVerification(fileName, 1, utf8Text.length, utf8Text);
      return utf8Text;
    }

    const errorMsg = "Couldn't read the file. Could not parse the PDF structure.";
    logPdfExtractionError(fileName, 'pdf', stage, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  stage = 'loading-pdf-document';
  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      useSystemFonts: true
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    logPdfExtractionError(fileName, 'pdf', stage, err);
    throw new Error("Couldn't read the file. Could not parse the PDF structure.");
  }

  stage = 'extracting-pages';
  const pageTexts: string[] = [];
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    const errorMsg = "Couldn't read the file. The PDF is empty.";
    logPdfExtractionError(fileName, 'pdf', stage, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  interface ExtractedItem {
    str: string;
    x: number;
    y: number;
    width: number;
    hasEOL: boolean;
  }

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items: ExtractedItem[] = [];
      for (const rawItem of textContent.items) {
        if ('str' in rawItem && typeof rawItem.str === 'string') {
          const item = rawItem as { str: string; transform: number[]; width?: number; hasEOL?: boolean };
          items.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || (item.str.length * 5),
            hasEOL: Boolean(item.hasEOL)
          });
        }
      }

      // Sort reading order: Top to Bottom (descending Y), then Left to Right (ascending X)
      items.sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 3.5) {
          return yDiff;
        }
        return a.x - b.x;
      });

      const lines: string[] = [];
      let curLine = '';
      let lastY: number | null = null;
      let lastXEnd = 0;

      for (const item of items) {
        const str = item.str;
        if (!str && !item.hasEOL) continue;

        const x = item.x;
        const y = item.y;
        const width = item.width;

        if (lastY === null) {
          curLine = str;
          lastY = y;
          lastXEnd = x + width;
          if (item.hasEOL) {
            lines.push(curLine.trim());
            curLine = '';
            lastY = null;
          }
          continue;
        }

        const yDiff = Math.abs(y - lastY);
        if (yDiff <= 3.5) {
          // Same line: insert space if there is a gap between previous and current text
          const gap = x - lastXEnd;
          if (gap > 2 && curLine.length > 0 && !curLine.endsWith(' ') && !str.startsWith(' ')) {
            curLine += ' ';
          }
          curLine += str;
          lastXEnd = Math.max(lastXEnd, x + width);
        } else {
          // New line
          if (curLine.trim()) lines.push(curLine.trim());
          // Significant vertical gap -> paragraph break
          if (lastY - y > 18) {
            lines.push('');
          }
          curLine = str;
          lastY = y;
          lastXEnd = x + width;
        }

        if (item.hasEOL) {
          if (curLine.trim()) lines.push(curLine.trim());
          curLine = '';
          lastY = null;
        }
      }
      if (curLine.trim()) lines.push(curLine.trim());

      const pageStr = lines.join('\n').trim();
      if (pageStr) {
        pageTexts.push(pageStr);
      }
    }
  } catch (err: unknown) {
    logPdfExtractionError(fileName, 'pdf', stage, err);
    throw new Error("Couldn't read the file. Could not parse the PDF structure.");
  }

  const combinedText = pageTexts.join('\n\n').trim();

  stage = 'verifying-extracted-text';
  // If no text or only trivial whitespace/punctuation extracted (scanned or image-only PDF)
  if (!combinedText || combinedText.replace(/\s+/g, '').length < 5) {
    const errorMsg = "Couldn't read the file. No extractable text was found (it may be scanned or image-only).";
    logPdfExtractionError(fileName, 'pdf', stage, new Error(errorMsg));
    throw new Error(errorMsg);
  }

  logPdfDevVerification(fileName, numPages, combinedText.length, combinedText);

  return combinedText;
}

/**
 * 4. Document Chunking
 * Splits clean text into coherent chunks respecting paragraph & section boundaries.
 */
export function chunkText(
  sourceId: string, 
  cleanText: string, 
  options: ChunkOptions = {}
): TextChunk[] {
  const maxWords = options.maxChunkWords || 450;
  const minWords = options.minChunkWords || 80;
  const overlapWords = options.overlapWords || 30;

  if (!cleanText || cleanText.trim().length === 0) {
    return [];
  }

  const rawParagraphs = cleanText.split(/\n\s*\n/);
  // Expand paragraphs that are individually longer than maxWords by splitting on sentence boundaries
  const paragraphs: string[] = [];
  for (const rawPara of rawParagraphs) {
    const trimmed = rawPara.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [trimmed];
      let currentSentencePara: string[] = [];
      let currentSentCount = 0;

      for (const sent of sentences) {
        const sentWords = sent.split(/\s+/).filter(Boolean);
        if (currentSentCount + sentWords.length > maxWords && currentSentCount > 0) {
          paragraphs.push(currentSentencePara.join(' ').trim());
          currentSentencePara = [sent.trim()];
          currentSentCount = sentWords.length;
        } else {
          currentSentencePara.push(sent.trim());
          currentSentCount += sentWords.length;
        }
      }
      if (currentSentencePara.length > 0) {
        paragraphs.push(currentSentencePara.join(' ').trim());
      }
    } else {
      paragraphs.push(trimmed);
    }
  }

  const chunks: TextChunk[] = [];
  let currentChunkParagraphs: string[] = [];
  let currentWordCount = 0;
  let activeHeading: string | undefined = undefined;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Detect heading lines (# Heading or Short Upper Title)
    if (
      trimmedPara.startsWith('#') || 
      /^(?:[0-9]+\.|\bSection|\bChapter)\s+[A-Z]/.test(trimmedPara) ||
      (trimmedPara.length < 80 && !trimmedPara.endsWith('.') && /^[A-Z0-9\s:–—-]+$/.test(trimmedPara))
    ) {
      activeHeading = trimmedPara.replace(/^#+\s*/, '');
    }

    const paraWords = trimmedPara.split(/\s+/).filter(Boolean);
    const paraWordCount = paraWords.length;

    // If adding this paragraph exceeds maxWords and we have enough words, finalize current chunk
    if (currentWordCount + paraWordCount > maxWords && currentWordCount >= minWords) {
      const chunkTextContent = currentChunkParagraphs.join('\n\n');
      const words = chunkTextContent.split(/\s+/).filter(Boolean);

      chunks.push({
        chunkId: `${sourceId}_chunk_${chunks.length + 1}`,
        sourceId,
        text: chunkTextContent,
        heading: activeHeading,
        index: chunks.length,
        wordCount: words.length,
        characterCount: chunkTextContent.length
      });

      // Prepare next chunk with context overlap if possible
      if (overlapWords > 0 && words.length > overlapWords) {
        const overlapSlice = words.slice(-overlapWords).join(' ');
        currentChunkParagraphs = [overlapSlice, trimmedPara];
        currentWordCount = overlapWords + paraWordCount;
      } else {
        currentChunkParagraphs = [trimmedPara];
        currentWordCount = paraWordCount;
      }
    } else {
      currentChunkParagraphs.push(trimmedPara);
      currentWordCount += paraWordCount;
    }
  }

  // Final remaining chunk
  if (currentChunkParagraphs.length > 0) {
    const chunkTextContent = currentChunkParagraphs.join('\n\n');
    const words = chunkTextContent.split(/\s+/).filter(Boolean);

    chunks.push({
      chunkId: `${sourceId}_chunk_${chunks.length + 1}`,
      sourceId,
      text: chunkTextContent,
      heading: activeHeading,
      index: chunks.length,
      wordCount: words.length,
      characterCount: chunkTextContent.length
    });
  }

  return chunks;
}

/**
 * 5. Master Extraction Layer Function
 * SOURCE → TEXT EXTRACTION → CLEAN TEXT → CHUNKS
 * 
 * Accepts a KnowledgeSource and optional raw content,
 * returns normalized text and semantic chunks.
 */
export async function extractText(
  source: KnowledgeSource,
  rawContent?: File | Blob | Uint8Array | string
): Promise<ExtractionResult> {
  if (!source) {
    return {
      success: false,
      sourceId: 'unknown',
      error: "Couldn't read the file."
    };
  }

  const fileName = source.fileName || source.name || 'document';

  try {
    let rawText = '';

    // 1. Text already present on source object
    if (source.text && source.text.trim()) {
      rawText = source.text;
    } 
    // 2. Direct string provided
    else if (typeof rawContent === 'string' && rawContent.trim()) {
      rawText = rawContent;
    } 
    // 3. File or Blob provided
    else if (rawContent instanceof Blob) {
      if (source.type === 'pdf') {
        const buffer = await rawContent.arrayBuffer();
        rawText = await extractTextFromPdfBytes(new Uint8Array(buffer), fileName);
      } else {
        rawText = await rawContent.text();
      }
    } 
    // 4. Uint8Array provided
    else if (rawContent instanceof Uint8Array) {
      if (source.type === 'pdf') {
        rawText = await extractTextFromPdfBytes(rawContent, fileName);
      } else {
        rawText = new TextDecoder('utf-8').decode(rawContent);
      }
    }

    // If content looks like raw PDF binary data (e.g. starts with %PDF-), extract via PDF parser
    if (rawText.startsWith('%PDF-')) {
      const bytes = new Uint8Array(rawText.length);
      for (let i = 0; i < rawText.length; i++) {
        bytes[i] = rawText.charCodeAt(i) & 0xff;
      }
      rawText = await extractTextFromPdfBytes(bytes, fileName);
    }

    // If source type is markdown, apply markdown structure cleaning
    if (source.type === 'markdown') {
      rawText = cleanMarkdown(rawText);
    }

    // Clean and normalize text
    const cleanText = normalizeText(rawText);

    // If extraction resulted in no readable text
    if (!cleanText || cleanText.length === 0) {
      const errorMsg = "Couldn't read the file. No readable text could be extracted.";
      logPdfExtractionError(fileName, source.type, 'cleanText-validation', new Error(errorMsg));
      return {
        success: false,
        sourceId: source.id,
        error: errorMsg
      };
    }

    // Divide into manageable chunks
    const chunks = chunkText(source.id, cleanText);

    return {
      success: true,
      sourceId: source.id,
      rawText,
      cleanText,
      chunks
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Couldn't read the file.";
    logPdfExtractionError(fileName, source.type, 'extractText-pipeline', err);
    return {
      success: false,
      sourceId: source.id,
      error: errorMsg
    };
  }
}
