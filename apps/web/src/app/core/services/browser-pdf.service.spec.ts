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
});
