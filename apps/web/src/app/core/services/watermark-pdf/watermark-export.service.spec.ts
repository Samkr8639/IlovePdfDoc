import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { WatermarkExportService, analyzeStreamGraphicsBalance } from './watermark-export.service';
import { WatermarkLayoutService } from './watermark-layout.service';
import { WATERMARK_DEFAULT_SETTINGS } from '@paperflow/contracts';

describe('WatermarkExportService', () => {
  let layoutService: WatermarkLayoutService;
  let exportService: WatermarkExportService;

  beforeEach(() => {
    layoutService = new WatermarkLayoutService();
    exportService = new WatermarkExportService(layoutService);
  });

  describe('analyzeStreamGraphicsBalance', () => {
    it('detects balanced q and Q operators', () => {
      const stream = new TextEncoder().encode('q 1 0 0 rg 10 10 50 50 re f Q');
      const res = analyzeStreamGraphicsBalance(stream);
      expect(res.openQ).toBe(0);
      expect(res.extraQ).toBe(0);
    });

    it('detects unclosed open q operators', () => {
      const stream = new TextEncoder().encode('q q 1 0 0 rg Q');
      const res = analyzeStreamGraphicsBalance(stream);
      expect(res.openQ).toBe(1);
      expect(res.extraQ).toBe(0);
    });

    it('detects extra Q operators', () => {
      const stream = new TextEncoder().encode('q 1 0 0 rg Q Q');
      const res = analyzeStreamGraphicsBalance(stream);
      expect(res.openQ).toBe(0);
      expect(res.extraQ).toBe(1);
    });

    it('ignores q and Q characters inside text strings or hex strings', () => {
      const stream = new TextEncoder().encode('(Quick Question) Tj <71> Tj');
      const res = analyzeStreamGraphicsBalance(stream);
      expect(res.openQ).toBe(0);
      expect(res.extraQ).toBe(0);
    });
  });

  describe('exportWatermarkedPdf round-trip', () => {
    let sourcePdfBytes: Uint8Array;

    beforeEach(async () => {
      // Create a 3-page test PDF with distinct metadata
      const doc = await PDFDocument.create();
      doc.setTitle('Preserved Title');
      doc.setAuthor('Preserved Author');
      doc.setSubject('Preserved Subject');
      doc.setCreator('Preserved Creator');
      doc.setProducer('Preserved Producer');
      const origDate = new Date(2022, 2, 15, 10, 0, 0);
      doc.setCreationDate(origDate);
      doc.setModificationDate(origDate);

      const p1 = doc.addPage([500, 700]);
      p1.drawText('Page 1 Content', { x: 50, y: 650 });

      const p2 = doc.addPage([600, 800]);
      p2.drawText('Page 2 Content', { x: 50, y: 750 });

      const p3 = doc.addPage([500, 700]);
      p3.drawText('Page 3 Content', { x: 50, y: 650 });

      // Save without letting default updateInfoDict run
      (doc as any).updateInfoDict = function () {};
      sourcePdfBytes = await doc.save();
    });

    it('applies text watermark with transparency group and ExtGState', async () => {
      const settings = {
        ...WATERMARK_DEFAULT_SETTINGS,
        textConfig: {
          ...WATERMARK_DEFAULT_SETTINGS.textConfig,
          text: 'CONFIDENTIAL',
          fontSize: 36,
          color: '#E05D44'
        },
        common: {
          ...WATERMARK_DEFAULT_SETTINGS.common,
          opacity: 40,
          rotation: 45,
          pageMode: 'all' as const
        }
      };

      const result = await exportService.exportWatermarkedPdf(
        sourcePdfBytes,
        'Contract Document.pdf',
        settings
      );

      expect(result.filename).toBe('Contract_Document-watermarked.pdf');
      expect(result.totalPages).toBe(3);
      expect(result.watermarkedPagesCount).toBe(3);
      expect(result.pdfBytes.length).toBeGreaterThan(sourcePdfBytes.length);

      // Reload exported PDF and assert structure
      const reloaded = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
      expect(reloaded.getPageCount()).toBe(3);

      const page1 = reloaded.getPage(0);
      const res = page1.node.Resources() as any;
      expect(res).toBeDefined();

      const xobjDict = res.lookup(PDFName.of('XObject')) as any;
      expect(xobjDict).toBeDefined();

      const wmXObj = xobjDict.lookup(PDFName.of('WM_0'));
      expect(wmXObj).toBeDefined();

      // Assert Transparency Group
      const group = wmXObj.dict.lookup(PDFName.of('Group')) as any;
      expect(group).toBeDefined();
      expect(group.lookup(PDFName.of('S')).toString()).toBe('/Transparency');
      expect(group.lookup(PDFName.of('CS')).toString()).toBe('/DeviceRGB');

      // Assert ExtGState
      const extGStateDict = res.lookup(PDFName.of('ExtGState')) as any;
      const gs = extGStateDict.lookup(PDFName.of('GS_WM'));
      expect(gs).toBeDefined();
      expect(gs.lookup(PDFName.of('ca')).numberValue).toBeCloseTo(0.4, 2);
    });

    it('respects page selection range', async () => {
      const settings = {
        ...WATERMARK_DEFAULT_SETTINGS,
        common: {
          ...WATERMARK_DEFAULT_SETTINGS.common,
          pageMode: 'custom' as const,
          customRange: '2'
        }
      };

      const result = await exportService.exportWatermarkedPdf(
        sourcePdfBytes,
        'report.pdf',
        settings
      );

      expect(result.watermarkedPagesCount).toBe(1);
    });

    it('layers watermark Over vs Below in content stream order', async () => {
      // Over
      const overSettings = {
        ...WATERMARK_DEFAULT_SETTINGS,
        common: {
          ...WATERMARK_DEFAULT_SETTINGS.common,
          layer: 'over' as const,
          pageMode: 'custom' as const,
          customRange: '1'
        }
      };

      const overResult = await exportService.exportWatermarkedPdf(sourcePdfBytes, 'over.pdf', overSettings);
      const overDoc = await PDFDocument.load(overResult.pdfBytes, { updateMetadata: false });
      const overPageContents = overDoc.getPage(0).node.Contents() as PDFArray;
      // In Over, last stream is watermark
      const lastStreamRef = overPageContents.get(overPageContents.size() - 1);
      const lastStream = overDoc.context.lookup(lastStreamRef) as any;
      const lastDecoded = decodePDFRawStream(lastStream).decode();
      const lastOps = new TextDecoder('latin1').decode(lastDecoded);
      expect(lastOps).toContain('/WM_0 Do');

      // Below
      const belowSettings = {
        ...WATERMARK_DEFAULT_SETTINGS,
        common: {
          ...WATERMARK_DEFAULT_SETTINGS.common,
          layer: 'below' as const,
          pageMode: 'custom' as const,
          customRange: '1'
        }
      };

      const belowResult = await exportService.exportWatermarkedPdf(sourcePdfBytes, 'below.pdf', belowSettings);
      const belowDoc = await PDFDocument.load(belowResult.pdfBytes, { updateMetadata: false });
      const belowPageContents = belowDoc.getPage(0).node.Contents() as PDFArray;
      // In Below, first stream is watermark
      const firstStreamRef = belowPageContents.get(0);
      const firstStream = belowDoc.context.lookup(firstStreamRef) as any;
      const firstDecoded = decodePDFRawStream(firstStream).decode();
      const firstOps = new TextDecoder('latin1').decode(firstDecoded);
      expect(firstOps).toContain('/WM_0 Do');
    });

    it('preserves all document metadata and updates ONLY ModDate', async () => {
      const result = await exportService.exportWatermarkedPdf(
        sourcePdfBytes,
        'meta-test.pdf',
        WATERMARK_DEFAULT_SETTINGS
      );

      const reloaded = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
      expect(reloaded.getTitle()).toBe('Preserved Title');
      expect(reloaded.getAuthor()).toBe('Preserved Author');
      expect(reloaded.getSubject()).toBe('Preserved Subject');
      expect(reloaded.getCreator()).toBe('Preserved Creator');
      expect(reloaded.getProducer()).toBe('Preserved Producer');

      const origDate = new Date(2022, 2, 15, 10, 0, 0);
      expect(reloaded.getCreationDate()?.getFullYear()).toBe(origDate.getFullYear());

      // ModDate must be updated to current time
      const modDate = reloaded.getModificationDate();
      expect(modDate).toBeDefined();
      expect(Date.now() - modDate!.getTime()).toBeLessThan(10000); // within last 10 seconds
    });

    it('repairs graphics state balance when original stream has unclosed q', async () => {
      const brokenDoc = await PDFDocument.create();
      const brokenPage = brokenDoc.addPage([400, 400]);
      // Intentionally unbalanced stream: 2 'q' and 1 'Q'
      const unclosedStream = brokenDoc.context.flateStream('q q 1 0 0 rg 50 50 100 100 re f Q');
      brokenPage.node.set(PDFName.of('Contents'), brokenDoc.context.register(unclosedStream));
      (brokenDoc as any).updateInfoDict = function () {};
      const brokenBytes = await brokenDoc.save();

      const result = await exportService.exportWatermarkedPdf(
        brokenBytes,
        'repaired.pdf',
        WATERMARK_DEFAULT_SETTINGS
      );

      expect(result.pdfBytes.length).toBeGreaterThan(0);
      const repairedDoc = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
      expect(repairedDoc.getPageCount()).toBe(1);
    });

    it('aborts cleanly when shouldCancel returns true', async () => {
      await expect(
        exportService.exportWatermarkedPdf(sourcePdfBytes, 'cancel.pdf', WATERMARK_DEFAULT_SETTINGS, {
          shouldCancel: () => true
        })
      ).rejects.toThrow('cancelled by user');
    });
  });

  describe('buildWatermarkedFilename', () => {
    it('sanitizes filename and appends -watermarked.pdf', () => {
      const res = exportService.buildWatermarkedFilename('Invoice #104 (final).pdf');
      expect(res).toBe('Invoice_#104_(final)-watermarked.pdf');
    });

    it('handles empty input gracefully', () => {
      const res = exportService.buildWatermarkedFilename('');
      expect(res).toBe('watermarked.pdf');
    });
  });

  describe('exportMultipleFiles (R-037, R-038)', () => {
    it('processes multiple files and produces a valid ZIP archive', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([300, 300]);
      (doc as any).updateInfoDict = function () {};
      const bytes = await doc.save();

      const files = [
        { filename: 'report.pdf', pdfBytes: bytes, settings: WATERMARK_DEFAULT_SETTINGS },
        { filename: 'report.pdf', pdfBytes: bytes, settings: WATERMARK_DEFAULT_SETTINGS } // Collision!
      ];

      const progressCalls: any[] = [];
      const multiResult = await exportService.exportMultipleFiles(files, {
        onProgress: (p) => progressCalls.push(p)
      });

      expect(multiResult.results.length).toBe(2);
      expect(multiResult.zipFilename).toBe('watermarked-pdfs.zip');
      expect(multiResult.zipBytes.length).toBeGreaterThan(0);

      // Verify filename collision was disambiguated
      expect(multiResult.results[0].filename).toBe('report-watermarked.pdf');
      expect(multiResult.results[1].filename).toBe('report-watermarked-1.pdf');

      // Verify progress notifications occurred
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(progressCalls[progressCalls.length - 1].totalFiles).toBe(2);
    });
  });
});
