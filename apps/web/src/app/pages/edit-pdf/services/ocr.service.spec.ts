import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PDFDocument } from 'pdf-lib';
import { OcrService } from './ocr.service';
import { ServerActionGuard } from '../../../core/guards/server-action.guard';

describe('OcrService', () => {
  let service: OcrService;
  let guard: ServerActionGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OcrService, ServerActionGuard, provideHttpClient()]
    });
    service = TestBed.inject(OcrService);
    guard = TestBed.inject(ServerActionGuard);
    guard.revokeConsent('edit-pdf-ocr');
  });

  afterEach(() => {
    guard.revokeConsent('edit-pdf-ocr');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('buildPageSubsetPdf should create a PDF with only the selected pages', async () => {
    // Create a 3-page source document
    const srcDoc = await PDFDocument.create();
    srcDoc.addPage([200, 200]);
    srcDoc.addPage([300, 300]);
    srcDoc.addPage([400, 400]);
    const srcBytes = await srcDoc.save();

    // Select only page 1 (index 1)
    const subsetBytes = await service.buildPageSubsetPdf(srcBytes, [1]);
    const parsedSub = await PDFDocument.load(subsetBytes);

    expect(parsedSub.getPageCount()).toBe(1);
    const page = parsedSub.getPage(0);
    expect(page.getWidth()).toBe(300);
    expect(page.getHeight()).toBe(300);
  });

  it('throws an error if executing OCR without prior recorded user consent', async () => {
    const dummyBytes = new Uint8Array([1, 2, 3]);
    await expect(
      service.executeOcr(dummyBytes, {
        languages: ['eng'],
        pages: '1',
        deskew: true,
        mode: 'searchable'
      })
    ).rejects.toThrow(/Unauthorized server action attempt without explicit user consent/);
  });

  it('allows cancellation gracefully', async () => {
    await expect(service.cancel()).resolves.toBeUndefined();
  });
});

