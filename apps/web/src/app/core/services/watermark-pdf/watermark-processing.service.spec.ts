import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WatermarkProcessingService } from './watermark-processing.service';
import { WatermarkExportService } from './watermark-export.service';
import { WATERMARK_DEFAULT_SETTINGS } from '@paperflow/contracts';

describe('WatermarkProcessingService', () => {
  let service: WatermarkProcessingService;
  let exportServiceMock: Partial<WatermarkExportService>;

  beforeEach(() => {
    exportServiceMock = {
      exportWatermarkedPdf: vi.fn().mockResolvedValue({
        filename: 'sample-watermarked.pdf',
        pdfBytes: new Uint8Array([1, 2, 3]),
        totalPages: 2,
        watermarkedPagesCount: 2,
        warnings: []
      }),
      exportMultipleFiles: vi.fn().mockResolvedValue({
        results: [
          { filename: 'doc1-watermarked.pdf', pdfBytes: new Uint8Array([1]), totalPages: 1, watermarkedPagesCount: 1, warnings: [] },
          { filename: 'doc2-watermarked.pdf', pdfBytes: new Uint8Array([2]), totalPages: 1, watermarkedPagesCount: 1, warnings: [] }
        ],
        zipBytes: new Uint8Array([10, 20]),
        zipFilename: 'watermarked-pdfs.zip'
      })
    };

    TestBed.configureTestingModule({
      providers: [
        WatermarkProcessingService,
        { provide: WatermarkExportService, useValue: exportServiceMock }
      ]
    });

    service = TestBed.inject(WatermarkProcessingService);
  });

  describe('getDeviceLimits & validateFileLimits', () => {
    it('returns valid limit configurations for devices', () => {
      const limits = service.getDeviceLimits();
      expect(limits.maxFiles).toBe(10);
      expect(limits.maxFileSizeBytes).toBeGreaterThan(0);
      expect(limits.maxPages).toBeGreaterThan(0);
    });

    it('rejects files exceeding size limits with clear error', () => {
      const res = service.validateFileLimits(105 * 1024 * 1024);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('limit for this device');
    });

    it('rejects files exceeding page limits with clear error', () => {
      const res = service.validateFileLimits(1000, 600);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds the');
    });

    it('accepts files within limits', () => {
      const res = service.validateFileLimits(5 * 1024 * 1024, 20);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe('processWatermark execution & fallback', () => {
    it('executes watermark processing via fallback when Worker is mocked out', async () => {
      const progressEvents: any[] = [];
      const dummyPdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF

      const result = await service.processWatermark(
        dummyPdfBytes,
        'doc.pdf',
        WATERMARK_DEFAULT_SETTINGS,
        undefined,
        progress => progressEvents.push(progress)
      );

      expect(result.filename).toBe('sample-watermarked.pdf');
      expect(exportServiceMock.exportWatermarkedPdf).toHaveBeenCalled();
    });

    it('aborts when cancel() is triggered during execution', async () => {
      const dummyPdfBytes = new Uint8Array([37, 80, 68, 70]);
      (exportServiceMock.exportWatermarkedPdf as any).mockImplementation(
        async (_bytes: any, _name: any, _settings: any, options: any) => {
          service.cancel(); // Trigger cancel during processing
          if (options.shouldCancel?.()) {
            throw new Error('Watermark processing was cancelled.');
          }
          return {
            filename: 'out.pdf',
            pdfBytes: new Uint8Array(0),
            totalPages: 1,
            watermarkedPagesCount: 1,
            warnings: []
          };
        }
      );

      await expect(
        service.processWatermark(dummyPdfBytes, 'doc.pdf', WATERMARK_DEFAULT_SETTINGS)
      ).rejects.toThrow('cancelled');
    });

    it('processes multiple watermarks and produces zip result (R-037, R-038)', async () => {
      const dummyPdfBytes = new Uint8Array([37, 80, 68, 70]);
      const files = [
        { filename: 'doc1.pdf', pdfBytes: dummyPdfBytes, settings: WATERMARK_DEFAULT_SETTINGS },
        { filename: 'doc2.pdf', pdfBytes: dummyPdfBytes, settings: WATERMARK_DEFAULT_SETTINGS }
      ];

      const progressEvents: any[] = [];
      const multiResult = await service.processMultipleWatermarks(files, undefined, (p) => {
        progressEvents.push(p);
      });

      expect(multiResult.results.length).toBe(2);
      expect(multiResult.zipFilename).toBe('watermarked-pdfs.zip');
      expect(exportServiceMock.exportMultipleFiles).toHaveBeenCalled();
    });
  });
});
