import type { 
  KnowledgeSource, 
  TextChunk, 
  ExtractionResult 
} from '../types/knowledgeGraph';

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
 * Flate Decompression with trailing garbage tolerance.
 * Uses native streaming pipeThrough to guarantee non-blocking decompression
 * without deadlocking on large streams.
 */
async function decompressFlateStream(payload: Uint8Array): Promise<string> {
  // 1. Try standard zlib deflate via non-blocking Blob stream pipe
  try {
    const stream = new Blob([payload as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  } catch {
    // continue to fallbacks
  }

  // 2. Try raw deflate without zlib headers
  try {
    const stream = new Blob([payload as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  } catch {
    // continue to fallbacks
  }

  // 3. Fallback: Trim trailing framing bytes if any junk remained before endstream
  for (let trim = 1; trim <= 8; trim++) {
    try {
      const slice = payload.subarray(0, payload.length - trim);
      const stream = new Blob([slice as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
      return await new Response(stream).text();
    } catch {
      // try next trim
    }
  }

  for (let trim = 1; trim <= 8; trim++) {
    try {
      const slice = payload.subarray(0, payload.length - trim);
      const stream = new Blob([slice as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    } catch {
      // try next trim
    }
  }

  return '';
}

interface PdfTextItem {
  text: string;
  x: number;
  y: number;
}

/**
 * Parses operators in a PDF stream and reconstructs reading order
 * by sorting top-to-bottom and left-to-right using text matrix (Tm / Td) coordinates.
 */
function parseStreamTextWithCoords(streamText: string): string {
  const items: PdfTextItem[] = [];
  const btEtRegex = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btEtRegex.exec(streamText)) !== null) {
    const block = btMatch[0];
    let curX = 0;
    let curY = 0;

    // Matches Tm, Td, TD, Tj, TJ, ', "
    const opRegex = /(?:([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm)|(?:\((?:\\.|[^()\\])*\)|<[0-9A-Fa-f\s]+>|\[(?:\\.|[^\]])*\])\s*(?:Tj|TJ|'|")|T\*|(?:([-\d.]+)\s+([-\d.]+)\s+(?:Td|TD))/g;
    let opMatch: RegExpExecArray | null;

    while ((opMatch = opRegex.exec(block)) !== null) {
      const full = opMatch[0].trim();
      if (full.endsWith('Tm')) {
        curX = parseFloat(opMatch[5]);
        curY = parseFloat(opMatch[6]);
      } else if (full.endsWith('Td') || full.endsWith('TD')) {
        const dx = parseFloat(opMatch[7]);
        const dy = parseFloat(opMatch[8]);
        if (!isNaN(dx)) curX += dx;
        if (!isNaN(dy)) curY += dy;
      } else if (full.endsWith('Tj') || full.endsWith('TJ') || full.endsWith("'") || full.endsWith('"')) {
        let extracted = '';
        if (full.endsWith('TJ')) {
          const raw = full.substring(0, full.length - 2).trim();
          extracted = decodePdfArray(raw);
        } else {
          const raw = full.substring(0, full.length - (full.endsWith('Tj') ? 2 : 1)).trim();
          extracted = decodePdfString(raw);
        }
        if (extracted) {
          items.push({ text: extracted, x: curX, y: curY });
        }
      }
    }
  }

  if (items.length === 0) return '';

  // Sort reading order: Top to Bottom (descending Y), then Left to Right (ascending X)
  items.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3.5) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines: string[] = [];
  let curLine = '';
  let lastY: number | null = null;
  let lastX = 0;

  for (const item of items) {
    if (lastY === null) {
      curLine = item.text;
      lastY = item.y;
      lastX = item.x + item.text.length * 5;
      continue;
    }

    const yDiff = Math.abs(item.y - lastY);
    if (yDiff <= 3.5) {
      // Same line: insert space if there is a gap and not already spaced
      const gap = item.x - lastX;
      if (gap > 3 && !curLine.endsWith(' ') && !item.text.startsWith(' ')) {
        curLine += ' ';
      }
      curLine += item.text;
      lastX = item.x + item.text.length * 5;
    } else {
      // New line
      if (curLine.trim()) lines.push(curLine.trim());
      // Paragraph break if vertical gap is significant (> 18pt)
      if (lastY - item.y > 18) {
        lines.push('');
      }
      curLine = item.text;
      lastY = item.y;
      lastX = item.x + item.text.length * 5;
    }
  }

  if (curLine.trim()) lines.push(curLine.trim());
  return lines.join('\n');
}

/**
 * 3. Pure-TypeScript PDF Stream & Text Operator Extractor
 * Extracts text from standard PDF streams (FlateDecode compressed or uncompressed)
 * without external binary or native dependencies.
 */
export async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
  const textBlocks: string[] = [];

  try {
    // 1. Scan for stream objects in the PDF binary
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

    // Convert bytes to binary string for pattern scanning
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(pdfBytes);

    // If not a standard PDF binary (does not start with %PDF-), check if it is plain text (e.g. mock demo files)
    if (!pdfString.trimStart().startsWith('%PDF-')) {
      const utf8Text = new TextDecoder('utf-8').decode(pdfBytes).trim();
      // eslint-disable-next-line no-control-regex
      const controlChars = utf8Text.match(/[\x00-\x08\x0E-\x1F]/g);
      if (!controlChars || controlChars.length / utf8Text.length < 0.05) {
        return utf8Text;
      }
      return '';
    }

    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(pdfString)) !== null) {
      // Check preceding dictionary for /Length, /FlateDecode, /Subtype, etc.
      const precedingDict = pdfString.substring(Math.max(0, match.index - 500), match.index);

      // Skip binary non-content streams (embedded TrueType/Type1 fonts, raster images)
      if (
        /\/Subtype\s*\/Image/i.test(precedingDict) ||
        /\/Length1\s+\d+/i.test(precedingDict) ||
        /\/Type\s*\/Font/i.test(precedingDict)
      ) {
        continue;
      }

      const streamContentStartIndex = match.index + match[0].indexOf('stream') + 6;
      // Skip newline after 'stream'
      const actualStart = pdfString[streamContentStartIndex] === '\r' && pdfString[streamContentStartIndex + 1] === '\n'
        ? streamContentStartIndex + 2
        : (pdfString[streamContentStartIndex] === '\n' ? streamContentStartIndex + 1 : streamContentStartIndex);

      const isFlate = /FlateDecode/i.test(precedingDict);

      // Check direct /Length <number>
      const directLenMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(precedingDict);
      // Check indirect /Length <objId> <gen> R
      const indirectLenMatch = /\/Length\s+(\d+)\s+(\d+)\s+R/.exec(precedingDict);

      let actualEnd: number;

      if (directLenMatch && directLenMatch[1]) {
        const declaredLen = parseInt(directLenMatch[1], 10);
        actualEnd = Math.min(actualStart + declaredLen, pdfBytes.length);
      } else if (indirectLenMatch && indirectLenMatch[1] && indirectLenMatch[2]) {
        const objId = indirectLenMatch[1];
        const gen = indirectLenMatch[2];
        const objRegex = new RegExp(`\\b${objId}\\s+${gen}\\s+obj[\\s\\r\\n]+(\\d+)[\\s\\r\\n]+endobj`);
        const resolved = objRegex.exec(pdfString);
        if (resolved && resolved[1]) {
          const declaredLen = parseInt(resolved[1], 10);
          actualEnd = Math.min(actualStart + declaredLen, pdfBytes.length);
        } else {
          actualEnd = match.index + match[0].lastIndexOf('endstream');
          while (actualEnd > actualStart && (pdfBytes[actualEnd - 1] === 10 || pdfBytes[actualEnd - 1] === 13)) {
            actualEnd--;
          }
        }
      } else {
        actualEnd = match.index + match[0].lastIndexOf('endstream');
        // Trim trailing newlines (\r and \n) before endstream
        while (actualEnd > actualStart && (pdfBytes[actualEnd - 1] === 10 || pdfBytes[actualEnd - 1] === 13)) {
          actualEnd--;
        }
      }

      const streamDataBytes = pdfBytes.subarray(actualStart, actualEnd);
      let decompressedText = '';

      if (isFlate) {
        decompressedText = await decompressFlateStream(new Uint8Array(streamDataBytes));
        if (!decompressedText) continue;
      } else {
        // Plain uncompressed stream
        decompressedText = new TextDecoder('latin1').decode(streamDataBytes);
      }

      // Parse PDF Text Operators within BT ... ET blocks with coordinate ordering
      const pageText = parseStreamTextWithCoords(decompressedText);
      if (pageText.trim()) {
        textBlocks.push(pageText.trim());
      }
    }

    // If stream extraction extracted text, combine and return
    if (textBlocks.length > 0) {
      return textBlocks.join('\n\n');
    }

    // 3. Fallback: Scan for plain text literal strings in uncompressed PDFs
    const literalStrings = scanLiteralStrings(pdfString);
    if (literalStrings.length > 0) {
      return literalStrings.join('\n\n');
    }

    return '';
  } catch {
    return '';
  }
}

/**
 * Decode PDF literal string ( ... ) or hex string < ... >
 */
function decodePdfString(raw: string): string {
  if (raw.startsWith('(') && raw.endsWith(')')) {
    const inner = raw.slice(1, -1);
    return inner
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  if (raw.startsWith('<') && raw.endsWith('>')) {
    const hex = raw.slice(1, -1).replace(/\s+/g, '');
    let res = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      if (!isNaN(code)) res += String.fromCharCode(code);
    }
    return res;
  }

  return '';
}

/**
 * Decode PDF array from [...] TJ
 * Elements with large negative numeric kerning gaps represent word spaces
 */
function decodePdfArray(raw: string): string {
  const content = raw.slice(1, -1);
  const elementRegex = /\((?:\\.|[^()\\])*\)|<[0-9A-Fa-f\s]+>|[-+]?\d*\.?\d+/g;
  let out = '';
  let match: RegExpExecArray | null;

  while ((match = elementRegex.exec(content)) !== null) {
    const el = match[0];
    if (el.startsWith('(') || el.startsWith('<')) {
      out += decodePdfString(el);
    } else {
      const num = parseFloat(el);
      // Large negative numbers indicate word space in PDF fonts (typically <= -100 units)
      if (!isNaN(num) && num <= -100) {
        if (out.length > 0 && !out.endsWith(' ')) out += ' ';
      }
    }
  }

  return out;
}

/**
 * Fallback scanner for uncompressed PDF text
 */
function scanLiteralStrings(pdfString: string): string[] {
  const regex = /\(((?:\\.|[^()\\]){4,})\)\s*Tj/g;
  const list: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(pdfString)) !== null) {
    const s = decodePdfString(`(${m[1]})`).trim();
    if (s.length > 3 && !/^[0-9\s.]+$/.test(s)) {
      list.push(s);
    }
  }
  return list;
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
      error: "Couldn't read this file."
    };
  }

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
        rawText = await extractTextFromPdfBytes(new Uint8Array(buffer));
      } else {
        rawText = await rawContent.text();
      }
    } 
    // 4. Uint8Array provided
    else if (rawContent instanceof Uint8Array) {
      if (source.type === 'pdf') {
        rawText = await extractTextFromPdfBytes(rawContent);
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
      rawText = await extractTextFromPdfBytes(bytes);
    }

    // If source type is markdown, apply markdown structure cleaning
    if (source.type === 'markdown') {
      rawText = cleanMarkdown(rawText);
    }

    // Clean and normalize text
    const cleanText = normalizeText(rawText);

    // If extraction resulted in no readable text
    if (!cleanText || cleanText.length === 0) {
      return {
        success: false,
        sourceId: source.id,
        error: "Couldn't read this file."
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
  } catch {
    // Return structured application-level error without leaking internal exceptions
    return {
      success: false,
      sourceId: source.id,
      error: "Couldn't read this file."
    };
  }
}
