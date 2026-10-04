import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  validateFileForIngestion, 
  createSourceFromFile,
  formatFileSize 
} from '../src/services/sourceIngestion';
import { 
  extractTextFromPdfBytes, 
  extractText 
} from '../src/services/textExtraction';
import { runPipeline } from '../src/services/pipelineOrchestrator';
import type { KnowledgeSource } from '../src/types/knowledgeGraph';

const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/GraphMind_Concept_Extraction_Test.pdf');

describe('PDF Text Extraction Pipeline', () => {
  describe('1. File Validation Layer', () => {
    it('validates a normal text PDF successfully', () => {
      const buffer = fs.readFileSync(FIXTURE_PATH);
      const file = new File([buffer], 'GraphMind_Concept_Extraction_Test.pdf', {
        type: 'application/pdf',
        lastModified: Date.now()
      });

      const validation = validateFileForIngestion(file);
      assert.equal(validation.valid, true);
      assert.equal(validation.error, undefined);
    });

    it('rejects an empty PDF file (0 bytes)', () => {
      const emptyFile = new File([new Uint8Array(0)], 'empty.pdf', {
        type: 'application/pdf'
      });

      const validation = validateFileForIngestion(emptyFile);
      assert.equal(validation.valid, false);
      assert.match(validation.error || '', /File is empty \(0 bytes\)/);
    });

    it('rejects an oversized file (> 50MB)', () => {
      // Mock File with size property exceeding 50MB
      const oversizedFile = {
        name: 'huge_document.pdf',
        size: 52 * 1024 * 1024,
        type: 'application/pdf'
      } as unknown as File;

      const validation = validateFileForIngestion(oversizedFile);
      assert.equal(validation.valid, false);
      assert.match(validation.error || '', /File exceeds maximum supported size of 50MB/);
    });

    it('rejects unsupported file formats', () => {
      const docxFile = new File([new Uint8Array(100)], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const validation = validateFileForIngestion(docxFile);
      assert.equal(validation.valid, false);
      assert.match(validation.error || '', /Unsupported file format \(\.docx\)/);
    });

    it('detects duplicate files in workspace', () => {
      const file = new File([new Uint8Array(1024)], 'Lecture_01.pdf', {
        type: 'application/pdf'
      });

      const existingSource: KnowledgeSource = {
        id: 'src_lecture-01-pdf_1024',
        name: 'Lecture 01',
        fileName: 'Lecture_01.pdf',
        type: 'pdf',
        size: formatFileSize(1024),
        status: 'ready',
        createdAt: new Date().toISOString()
      };

      const validation = validateFileForIngestion(file, [existingSource]);
      assert.equal(validation.valid, false);
      assert.match(validation.error || '', /has already been uploaded/);
    });
  });

  describe('2. PDF Parser & Text Extraction Edge Cases', () => {
    it('extracts multi-page text from actual test PDF fixture', async () => {
      const buffer = fs.readFileSync(FIXTURE_PATH);
      const extracted = await extractTextFromPdfBytes(
        new Uint8Array(buffer), 
        'GraphMind_Concept_Extraction_Test.pdf'
      );

      assert.ok(extracted.length > 3500, `Expected > 3500 characters, got ${extracted.length}`);
      
      // Page 1 content assertions
      assert.ok(extracted.includes('Operating Systems: Process Scheduling'));
      assert.ok(extracted.includes('1. Introduction'));
      assert.ok(extracted.includes('CPU scheduling is the mechanism used by an operating system'));
      assert.ok(extracted.includes('First-Come, First-Served'));
      assert.ok(extracted.includes('Shortest Job First'));
      assert.ok(extracted.includes('Round Robin Scheduling'));

      // Page 2 content assertions (multi-page verification)
      assert.ok(extracted.includes('time quantum'));
      assert.ok(extracted.includes('8. Scheduling Criteria'));
      assert.ok(extracted.includes('Waiting time'));
      assert.ok(extracted.includes('Turnaround time'));
      assert.ok(extracted.includes('11. Summary'));
    });

    it('handles empty PDF buffer by throwing a clear error', async () => {
      await assert.rejects(
        async () => {
          await extractTextFromPdfBytes(new Uint8Array(0), 'empty.pdf');
        },
        (err: Error) => {
          assert.equal(err.message, "Couldn't read the file. The PDF is empty.");
          return true;
        }
      );
    });

    it('handles scanned or image-only PDF by reporting no extractable text', async () => {
      // 1-page valid PDF with no text operators
      const blankPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <<>>>> endobj
4 0 obj <</Length 0>> stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
266
%%EOF`;

      const bytes = new TextEncoder().encode(blankPdf);
      await assert.rejects(
        async () => {
          await extractTextFromPdfBytes(bytes, 'scanned_document.pdf');
        },
        (err: Error) => {
          assert.equal(
            err.message, 
            "Couldn't read the file. No extractable text was found (it may be scanned or image-only)."
          );
          return true;
        }
      );
    });

    it('handles corrupted PDF by reporting could not parse PDF structure', async () => {
      const corruptedBytes = new TextEncoder().encode('%PDF-1.4 corrupt byte stream {invalid]');
      await assert.rejects(
        async () => {
          await extractTextFromPdfBytes(corruptedBytes, 'damaged.pdf');
        },
        (err: Error) => {
          assert.equal(err.message, "Couldn't read the file. Could not parse the PDF structure.");
          return true;
        }
      );
    });

    it('supports mock plain-text demo PDFs gracefully', async () => {
      const demoPlainBytes = new TextEncoder().encode(
        'Stanford CS229: Machine Learning Course Notes on Deep Neural Architectures and Representation Learning.'
      );
      const text = await extractTextFromPdfBytes(demoPlainBytes, 'sample_demo.pdf');
      assert.ok(text.includes('Stanford CS229: Machine Learning Course Notes'));
    });
  });

  describe('3. Ingestion & GraphMind Pipeline Flow', () => {
    it('creates KnowledgeSource from File and extracts text end-to-end', async () => {
      const buffer = fs.readFileSync(FIXTURE_PATH);
      const file = new File([buffer], 'GraphMind_Concept_Extraction_Test.pdf', {
        type: 'application/pdf',
        lastModified: Date.now()
      });

      const result = await createSourceFromFile(file);
      assert.equal(result.success, true);
      assert.ok(result.source);
      assert.equal(result.source.type, 'pdf');
      assert.equal(result.source.status, 'pending');
      assert.ok(result.source.text && result.source.text.length > 3500);

      // Verify extractText on the generated source produces chunks
      const extraction = await extractText(result.source);
      assert.equal(extraction.success, true);
      assert.ok(extraction.chunks && extraction.chunks.length > 0);
    });

    it('feeds extracted PDF text into GraphMind concept extraction and builds knowledge graph', async () => {
      const buffer = fs.readFileSync(FIXTURE_PATH);
      const file = new File([buffer], 'GraphMind_Concept_Extraction_Test.pdf', {
        type: 'application/pdf',
        lastModified: Date.now()
      });

      const ingestion = await createSourceFromFile(file);
      assert.equal(ingestion.success, true);
      assert.ok(ingestion.source);

      // Run pipeline: text extracted -> concept extraction -> normalization -> relationships -> graph
      const pipelineResult = await runPipeline([ingestion.source]);
      assert.equal(pipelineResult.success, true);
      assert.ok(pipelineResult.graph.nodes.length > 0);
      assert.ok(pipelineResult.graph.relationships.length > 0);

      const nodeNames = pipelineResult.graph.nodes.map(n => n.name.toLowerCase());
      assert.ok(nodeNames.some(n => n.includes('process')));
      assert.ok(nodeNames.some(n => n.includes('cpu scheduling') || n.includes('operating system')));
    });
  });
});
