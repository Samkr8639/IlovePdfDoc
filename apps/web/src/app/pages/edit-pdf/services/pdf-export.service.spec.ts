import { TestBed } from '@angular/core/testing';
import { PdfExportService } from './pdf-export.service';
import { PDFDocument } from 'pdf-lib';
import {
  HighlightEditElement,
  SignEditElement,
  ImageEditElement,
  ShapeEditElement
} from '../models/document-model';

describe('PdfExportService', () => {
  let service: PdfExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PdfExportService]
    });
    service = TestBed.inject(PdfExportService);
  });

  it('should export PDF successfully with CSS variable colors for highlight, sign, image, and shape', async () => {
    // Create minimal blank PDF document
    const testDoc = await PDFDocument.create();
    testDoc.addPage([600, 800]);
    const pdfBytes = await testDoc.save();

    // 1x1 transparent png dataUrl
    const dummyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const elements = [
      {
        id: 'hl-1',
        pageIndex: 0,
        type: 'highlight',
        xPt: 50,
        yPt: 700,
        widthPt: 150,
        heightPt: 24,
        color: 'var(--pt-amber)',
        opacity: 0.35
      } as HighlightEditElement,
      {
        id: 'hl-2',
        pageIndex: 0,
        type: 'highlight',
        xPt: 50,
        yPt: 650,
        widthPt: 120,
        heightPt: 24,
        color: 'var(--pt-coral)',
        opacity: 0.35
      } as HighlightEditElement,
      {
        id: 'sign-1',
        pageIndex: 0,
        type: 'sign',
        xPt: 100,
        yPt: 300,
        widthPt: 140,
        heightPt: 50,
        signatureText: 'Sameer',
        color: 'var(--pt-navy)',
        fontFamily: "'Dancing Script', cursive"
      } as SignEditElement,
      {
        id: 'img-1',
        pageIndex: 0,
        type: 'image',
        xPt: 100,
        yPt: 150,
        widthPt: 100,
        heightPt: 100,
        dataUrl: dummyPngDataUrl
      } as ImageEditElement,
      {
        id: 'shape-1',
        pageIndex: 0,
        type: 'shape',
        shapeType: 'rectangle',
        xPt: 200,
        yPt: 400,
        widthPt: 80,
        heightPt: 40,
        strokeColor: 'var(--pt-teal-700)',
        fillColor: 'transparent',
        strokeWidth: 2
      } as ShapeEditElement
    ];

    const resultBlob = await service.exportPdf(
      pdfBytes,
      [{ pageIndex: 0, widthPt: 600, heightPt: 800, rotation: 0 }],
      elements
    );

    expect(resultBlob).toBeTruthy();
    expect(resultBlob.type).toBe('application/pdf');
    expect(resultBlob.size).toBeGreaterThan(0);
  });
});
