import type { 
  KnowledgeSource, 
  SourceLifecycleState, 
  SourceType 
} from '../types/knowledgeGraph';
import type { RecentMaterial } from '../types';
import { extractText } from './textExtraction';

export * from './textExtraction';
export * from './conceptExtraction';
export * from './conceptNormalization';

export const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'markdown'];
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export interface IngestionResult {
  success: boolean;
  source?: KnowledgeSource;
  error?: string;
}

export interface BatchIngestionResult {
  successful: KnowledgeSource[];
  errors: { fileName: string; error: string }[];
}

/**
 * Format bytes into human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detect source type from file extension
 */
export function detectSourceType(fileName: string): SourceType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'txt': return 'text';
    case 'md':
    case 'markdown': return 'markdown';
    default: return 'text';
  }
}

/**
 * Generate a deterministic identifier to prevent duplicate entries in one session
 */
export function generateSourceId(fileName: string, fileSize: number): string {
  const cleanName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  return `src_${cleanName}_${fileSize}`;
}

/**
 * Validate a file against format, size, and duplicate constraints
 */
export function validateFileForIngestion(
  file: File, 
  existingSources: KnowledgeSource[] = []
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds maximum supported size of 50MB.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return { 
      valid: false, 
      error: `Unsupported file format (.${ext}). GraphMind supports PDF, TXT, and Markdown files.` 
    };
  }

  const targetId = generateSourceId(file.name, file.size);
  const isDuplicate = existingSources.some(
    s => s.id === targetId || (s.fileName?.toLowerCase() === file.name.toLowerCase() && s.size === formatFileSize(file.size))
  );

  if (isDuplicate) {
    return { 
      valid: false, 
      error: `"${file.name}" has already been uploaded to your workspace.` 
    };
  }

  return { valid: true };
}

/**
 * Create a canonical KnowledgeSource from an uploaded File
 */
export async function createSourceFromFile(
  file: File, 
  existingSources: KnowledgeSource[] = []
): Promise<IngestionResult> {
  const validation = validateFileForIngestion(file, existingSources);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const id = generateSourceId(file.name, file.size);
  const sourceType = detectSourceType(file.name);
  const sizeFormatted = formatFileSize(file.size);

  const source: KnowledgeSource = {
    id,
    name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    fileName: file.name,
    type: sourceType,
    size: sizeFormatted,
    createdAt: new Date().toISOString(),
    status: 'pending' // Initial lifecycle state
  };

  try {
    const extraction = await extractText(source, file);
    if (extraction.success && extraction.cleanText) {
      source.text = extraction.cleanText;
    }
  } catch {
    // Retain pending source without blocking UI
  }

  return { success: true, source };
}

/**
 * Ingest multiple files in batch, isolating individual errors
 */
export async function createSourcesFromFiles(
  files: File[], 
  existingSources: KnowledgeSource[] = []
): Promise<BatchIngestionResult> {
  const successful: KnowledgeSource[] = [];
  const errors: { fileName: string; error: string }[] = [];
  const currentSources = [...existingSources];

  for (const file of files) {
    const result = await createSourceFromFile(file, currentSources);
    if (result.success && result.source) {
      successful.push(result.source);
      currentSources.push(result.source);
    } else {
      errors.push({
        fileName: file.name,
        error: result.error || 'Failed to process file.'
      });
    }
  }

  return { successful, errors };
}

/**
 * Transition source lifecycle state
 */
export function transitionSourceStatus(
  source: KnowledgeSource,
  nextStatus: SourceLifecycleState,
  errorMessage?: string
): KnowledgeSource {
  return {
    ...source,
    status: nextStatus,
    errorMessage: errorMessage || (nextStatus === 'failed' ? source.errorMessage : undefined)
  };
}

/**
 * Adapter: Convert canonical KnowledgeSource to UI RecentMaterial
 */
export function sourceToRecentMaterial(source: KnowledgeSource): RecentMaterial {
  let formatDisplay = 'PDF';
  switch (source.type) {
    case 'pdf': formatDisplay = 'PDF'; break;
    case 'text': formatDisplay = 'TXT'; break;
    case 'markdown': formatDisplay = 'MD'; break;
    default: formatDisplay = 'DOC';
  }

  let statusDisplay = 'Ready';
  const normStatus = (source.status || 'pending').toLowerCase();
  if (normStatus === 'ready' || normStatus === 'indexed' || normStatus === 'synced') {
    statusDisplay = 'Indexed';
  } else if (normStatus === 'processing' || normStatus === 'indexing') {
    statusDisplay = 'Processing';
  } else if (normStatus === 'failed') {
    statusDisplay = 'Failed';
  } else {
    statusDisplay = 'Pending';
  }

  return {
    id: source.id,
    title: source.fileName || source.name,
    format: formatDisplay,
    size: source.size || 'Unknown size',
    conceptsExtracted: source.conceptsExtracted,
    timestamp: 'Added just now',
    status: statusDisplay
  };
}
