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
export * from './relationshipExtraction';
export * from './graphBuilder';
export {
  pipelineOrchestrator,
  runPipeline,
  PipelineOrchestrator,
  PIPELINE_STAGE_LABELS
} from './pipelineOrchestrator';
export type {
  PipelineStage,
  PipelineProgressEvent,
  PipelineError,
  PipelineErrorCode,
  PipelineMetrics,
  PipelineResult,
  PipelineOrchestratorOptions
} from './pipelineOrchestrator';

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
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${Number(kb.toFixed(1))} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number(mb.toFixed(1))} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${Number(gb.toFixed(1))} GB`;
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
    sizeBytes: file.size,
    mimeType: file.type || undefined,
    createdAt: new Date().toISOString(),
    status: 'pending' // Initial lifecycle state
  };

  try {
    const extraction = await extractText(source, file);
    if (extraction.success && extraction.cleanText) {
      source.text = extraction.cleanText;
    } else {
      return {
        success: false,
        error: extraction.error || `Unable to read text from "${file.name}". Please ensure the file contains readable text.`
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : `Unable to read text from "${file.name}".`;
    return { success: false, error: msg };
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
 * Derive file type from file name, extension, mimeType, or type
 */
export function getFileType(source: { 
  type?: string; 
  fileName?: string; 
  name?: string; 
  mimeType?: string; 
  format?: string 
}): string {
  if (source.format && source.format.length <= 5 && source.format !== 'Unknown') {
    return source.format.toUpperCase();
  }

  if (source.mimeType) {
    const mime = source.mimeType.toLowerCase();
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('word') || mime.includes('docx') || mime.includes('document')) return 'DOCX';
    if (mime.includes('doc')) return 'DOC';
    if (mime.includes('markdown') || mime.includes('md')) return 'MD';
    if (mime.includes('text/plain') || mime.includes('txt')) return 'TXT';
    if (mime.includes('json')) return 'JSON';
    if (mime.includes('csv')) return 'CSV';
  }

  const name = source.fileName || source.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext && ext !== name.toLowerCase()) {
    if (ext === 'pdf') return 'PDF';
    if (ext === 'md' || ext === 'markdown') return 'MD';
    if (ext === 'txt') return 'TXT';
    if (ext === 'docx') return 'DOCX';
    if (ext === 'doc') return 'DOC';
    if (ext === 'json') return 'JSON';
    if (ext === 'csv') return 'CSV';
    if (ext.length <= 5) return ext.toUpperCase();
  }

  if (source.type) {
    const t = source.type.toLowerCase();
    if (t === 'pdf') return 'PDF';
    if (t === 'markdown' || t === 'md') return 'MD';
    if (t === 'text' || t === 'txt') return 'TXT';
    if (t.length <= 5) return t.toUpperCase();
  }

  return 'PDF';
}

/**
 * Format timestamp into concise relative or archival date
 */
export function formatRelativeTime(createdAt?: string | number): string {
  if (!createdAt) return '';

  const date = typeof createdAt === 'number' ? new Date(createdAt) : new Date(createdAt);
  const time = date.getTime();
  if (isNaN(time)) {
    if (typeof createdAt === 'string' && /^(added\s|just\snow)/i.test(createdAt)) {
      return createdAt.replace(/^Added\s+/i, 'ADDED ').toUpperCase();
    }
    return '';
  }

  const now = Date.now();
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return 'ADDED JUST NOW';
  }
  if (diffMin < 60) {
    return `ADDED ${diffMin} ${diffMin === 1 ? 'MIN' : 'MIN'} AGO`;
  }
  if (diffHours < 24) {
    return `ADDED ${diffHours} ${diffHours === 1 ? 'HOUR' : 'HOURS'} AGO`;
  }
  if (diffDays === 1) {
    return 'ADDED YESTERDAY';
  }
  if (diffDays < 7) {
    return `ADDED ${diffDays} DAYS AGO`;
  }

  const day = date.getDate();
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `ADDED ${day} ${month} ${year}`;
}

/**
 * Adapter: Convert canonical KnowledgeSource to UI RecentMaterial
 */
export function sourceToRecentMaterial(source: KnowledgeSource): RecentMaterial {
  const formatDisplay = getFileType(source);

  let statusDisplay = 'Ready';
  const normStatus = (source.status || 'pending').toLowerCase();
  if (normStatus === 'ready' || normStatus === 'indexed' || normStatus === 'synced') {
    statusDisplay = 'Indexed';
  } else if (normStatus.includes('read')) {
    statusDisplay = 'reading';
  } else if (normStatus.includes('concept')) {
    statusDisplay = 'extracting-concepts';
  } else if (normStatus.includes('connect') || normStatus.includes('idea') || normStatus.includes('normaliz')) {
    statusDisplay = 'normalizing';
  } else if (normStatus.includes('build') || normStatus.includes('graph')) {
    statusDisplay = 'building-graph';
  } else if (normStatus === 'processing' || normStatus === 'indexing') {
    statusDisplay = 'Processing';
  } else if (normStatus === 'failed' || normStatus === 'error') {
    statusDisplay = 'Failed';
  } else {
    statusDisplay = 'Pending';
  }

  const rawSize = source.size || (source.sizeBytes ? formatFileSize(source.sizeBytes) : '');

  return {
    id: source.id,
    title: source.fileName || source.name,
    fileName: source.fileName || source.name,
    name: source.name,
    format: formatDisplay,
    size: rawSize || 'SIZE UNAVAILABLE',
    sizeBytes: source.sizeBytes,
    mimeType: source.mimeType,
    conceptsExtracted: source.conceptsExtracted,
    conceptIds: source.conceptIds,
    timestamp: formatRelativeTime(source.createdAt) || 'ADDED JUST NOW',
    createdAt: source.createdAt,
    status: statusDisplay,
    error: source.errorMessage || source.error
  };
}
