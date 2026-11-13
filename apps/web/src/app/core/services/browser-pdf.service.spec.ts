import { TestBed } from '@angular/core/testing';
import { BrowserPdfService } from './browser-pdf.service';
import { PDFDocument } from 'pdf-lib';

describe('BrowserPdfService', () => {
  let service: BrowserPdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BrowserPdfService);
  });

  async function createTestPdf(pageCount: number, name = 'test.pdf'): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([400, 600]);
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf' });
  }

  describe('validatePdf', () => {
    it('should correctly validate a valid single-page PDF', async () => {
      const file = await createTestPdf(1, 'single.pdf');
      const result = await service.validatePdf(file);

      expect(result.isValid).toBe(true);
      expect(result.pageCount).toBe(1);
      expect(result.name).toBe('single.pdf');
      expect(result.error).toBeUndefined();
    });

    it('should correctly validate a multi-page PDF', async () => {
      const file = await createTestPdf(4, 'multi.pdf');
      const result = await service.validatePdf(file);

      expect(result.isValid).toBe(true);
      expect(result.pageCount).toBe(4);
    });

    it('should reject a corrupted PDF file', async () => {
      const corruptedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const file = new File([corruptedBytes], 'broken.pdf', { type: 'application/pdf' });
      const result = await service.validatePdf(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid PDF format');
    });

    it('should reject a non-PDF file', async () => {
      const textFile = new File(['Hello World'], 'doc.txt', { type: 'text/plain' });
      const result = await service.validatePdf(textFile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });
  });

  describe('mergePdfs', () => {
    it('should merge two PDFs into a single valid document with total page count', async () => {
      const file1 = await createTestPdf(2, 'doc1.pdf');
      const file2 = await createTestPdf(3, 'doc2.pdf');

      const progressSteps: number[] = [];
      const result = await service.mergePdfs([file1, file2], (percent) => {
        progressSteps.push(percent);
      });

      expect(result).toBeTruthy();
      expect(result.pageCount).toBe(5); // 2 + 3 = 5
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps[progressSteps.length - 1]).toBe(100);

      // Verify the generated output is a genuine, parsable PDF
      const arrayBuffer = await result.blob.arrayBuffer();
      const verifiedDoc = await PDFDocument.load(arrayBuffer);
      expect(verifiedDoc.getPageCount()).toBe(5);
    });

    it('should throw an error if fewer than 2 files are provided', async () => {
      const file1 = await createTestPdf(1, 'doc1.pdf');
      await expect(service.mergePdfs([file1])).rejects.toThrow('At least 2 PDF files are required');
    });
  });

  describe('splitPdf', () => {
    it('should split PDF by custom ranges and merge into a single PDF when mergeOutput=true', async () => {
      const file = await createTestPdf(6, 'annual_report.pdf');
      const res = await service.splitPdf(file, {
        mode: 'custom_ranges',
        ranges: [
          { from: 1, to: 2 },
          { from: 5, to: 6 }
        ],
        mergeOutput: true
      });

      expect(res.isZip).toBe(false);
      expect(res.outputFilesCount).toBe(1);
      expect(res.pageCount).toBe(4);
      expect(res.filename).toBe('annual_report_split.pdf');

      const verified = await PDFDocument.load(await res.blob.arrayBuffer());
      expect(verified.getPageCount()).toBe(4);
    });

    it('should split PDF by custom ranges into multiple PDFs in a ZIP archive when mergeOutput=false', async () => {
      const file = await createTestPdf(6, 'contracts.pdf');
      const res = await service.splitPdf(file, {
        mode: 'custom_ranges',
        ranges: [
          { from: 1, to: 2 },
          { from: 3, to: 4 },
          { from: 5, to: 6 }
        ],
        mergeOutput: false
      });

      expect(res.isZip).toBe(true);
      expect(res.outputFilesCount).toBe(3);
      expect(res.filename).toBe('contracts_split_files.zip');
      expect(res.outputFiles.length).toBe(3);
      expect(res.outputFiles[0].filename).toBe('contracts_split_1-2.pdf');
      expect(res.outputFiles[1].filename).toBe('contracts_split_3-4.pdf');
      expect(res.outputFiles[2].filename).toBe('contracts_split_5-6.pdf');
    });

    it('should split into fixed page groups with final partial group', async () => {
      const file = await createTestPdf(7, 'handbook.pdf');
      const res = await service.splitPdf(file, {
        mode: 'fixed_ranges',
        fixedPageCount: 3,
        mergeOutput: false
      });

      expect(res.isZip).toBe(true);
      expect(res.outputFilesCount).toBe(3); // 1-3, 4-6, 7
      expect(res.outputFiles[0].pageCount).toBe(3);
      expect(res.outputFiles[1].pageCount).toBe(3);
      expect(res.outputFiles[2].pageCount).toBe(1);
    });

    it('should extract all pages individually into a ZIP archive', async () => {
      const file = await createTestPdf(3, 'invoices.pdf');
      const res = await service.splitPdf(file, {
        mode: 'extract_all',
        mergeOutput: false
      });

      expect(res.isZip).toBe(true);
      expect(res.outputFilesCount).toBe(3);
      expect(res.outputFiles[0].filename).toBe('invoices_page_1.pdf');
      expect(res.outputFiles[1].filename).toBe('invoices_page_2.pdf');
      expect(res.outputFiles[2].filename).toBe('invoices_page_3.pdf');
    });

    it('should extract pages matching a page expression', async () => {
      const file = await createTestPdf(8, 'magazine.pdf');
      const res = await service.splitPdf(file, {
        mode: 'extract_pages',
        pageExpression: '2, 5-6',
        mergeOutput: true
      });

      expect(res.isZip).toBe(false);
      expect(res.pageCount).toBe(3);

      const verified = await PDFDocument.load(await res.blob.arrayBuffer());
      expect(verified.getPageCount()).toBe(3);
    });
  });

  describe('compressPdf', () => {
    it('should compress a single PDF with recommended level and calculate real size and page count', async () => {
      const file = await createTestPdf(3, 'sample.pdf');
      const progressList: number[] = [];
      const res = await service.compressPdf(file, 'recommended', (pct) => progressList.push(pct));

      expect(res).toBeTruthy();
      expect(res.pageCount).toBe(3);
      expect(res.filename).toBe('sample_compressed.pdf');
      expect(res.isZip).toBe(false);
      expect(res.filesCount).toBe(1);
      expect(res.sizeBytes).toBeGreaterThan(0);
      expect(res.originalSizeBytes).toBe(file.size);
      expect(res.reductionPercent).toBeDefined();
      expect(progressList).toContain(100);

      // Verify the output blob is valid readable PDF
      const buf = await res.blob.arrayBuffer();
      const verified = await PDFDocument.load(buf);
      expect(verified.getPageCount()).toBe(3);
    });

    it('should compress with extreme profile and strip document metadata', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Sensitive Title');
      doc.setAuthor('Secret Author');
      doc.addPage([400, 600]);
      const bytes = await doc.save();
      const file = new File([bytes.buffer as ArrayBuffer], 'confidential.pdf', { type: 'application/pdf' });

      const res = await service.compressPdf(file, 'extreme');
      expect(res.level).toBe('extreme');

      const buf = await res.blob.arrayBuffer();
      const verified = await PDFDocument.load(buf);
      expect(verified.getTitle()).toBeFalsy();
    });

    it('should compress with less compression profile', async () => {
      const file = await createTestPdf(2, 'graphic.pdf');
      const res = await service.compressPdf(file, 'less');

      expect(res.level).toBe('less');
      expect(res.sizeBytes).toBeGreaterThan(0);
    });

    it('should compress multiple PDF files and package them into a ZIP archive', async () => {
      const file1 = await createTestPdf(2, 'doc1.pdf');
      const file2 = await createTestPdf(3, 'doc2.pdf');

      const res = await service.compressPdf([file1, file2], 'recommended');

      expect(res.isZip).toBe(true);
      expect(res.filesCount).toBe(2);
      expect(res.items.length).toBe(2);
      expect(res.filename).toContain('.zip');
      expect(res.pageCount).toBe(5); // 2 + 3
      expect(res.originalSizeBytes).toBe(file1.size + file2.size);
      expect(res.items[0].filename).toBe('doc1_compressed.pdf');
      expect(res.items[1].filename).toBe('doc2_compressed.pdf');
    });

    it('should reject empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(service.compressPdf(emptyFile)).rejects.toThrow('is empty');
    });

    it('should reject files with invalid PDF header', async () => {
      const fakePdf = new File(['Not a real PDF stream'], 'fake.pdf', { type: 'application/pdf' });
      await expect(service.compressPdf(fakePdf)).rejects.toThrow('Only valid PDF files are supported');
    });
  });
});
