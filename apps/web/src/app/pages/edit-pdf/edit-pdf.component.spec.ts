import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { EditPdfComponent } from './edit-pdf.component';
import { UploadConsentService } from '../../core/services/upload-consent.service';
import { ServerActionGuard } from '../../core/guards/server-action.guard';
import { OcrService } from './services/ocr.service';
import { EditPdfOcrResult } from '@paperflow/contracts';

describe('EditPdfComponent Integration Tests', () => {
  let component: EditPdfComponent;
  let fixture: ComponentFixture<EditPdfComponent>;
  let uploadConsent: UploadConsentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPdfComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        UploadConsentService,
        ServerActionGuard,
        OcrService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditPdfComponent);
    component = fixture.componentInstance;
    uploadConsent = TestBed.inject(UploadConsentService);
    fixture.detectChanges();
  });

  it('should initialize in "upload" viewMode with default tools', () => {
    expect(component).toBeTruthy();
    expect(component.viewMode()).toBe('upload');
    expect(component.activeTool()).toBe('select');
    expect(component.browserTools().length).toBe(9);
    expect(component.cloudTools().length).toBe(1);
    expect(component.cloudTools()[0].id).toBe('ocr');
  });

  it('should switch active tool and reset selection', () => {
    component.selectTool('text');
    expect(component.activeTool()).toBe('text');

    component.selectTool('ocr');
    expect(component.activeTool()).toBe('ocr');
  });

  it('validates OCR page ranges accurately', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 },
      { pageIndex: 1, widthPt: 595, heightPt: 842, rotation: 0 },
      { pageIndex: 2, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    component.ocrPageRange.set('current');
    expect(component.validateOcrPageRange()).toBe(true);

    component.ocrPageRange.set('all');
    expect(component.validateOcrPageRange()).toBe(true);

    component.ocrPageRange.set('custom');
    component.ocrCustomRange.set('1-2');
    expect(component.validateOcrPageRange()).toBe(true);

    component.ocrCustomRange.set('5-10'); // out of bounds
    expect(component.validateOcrPageRange()).toBe(false);
    expect(component.ocrRangeError()).toContain('Valid pages are 1 to 3');

    component.ocrCustomRange.set('9');
    expect(component.validateOcrPageRange()).toBe(false);
    expect(component.ocrRangeError()).toContain('out of bounds');
  });

  it('enforces maximum 3 languages selection', () => {
    component.ocrSelectedLanguages.set(['eng']);
    component.toggleOcrLanguage('hin');
    expect(component.ocrSelectedLanguages()).toEqual(['eng', 'hin']);

    component.toggleOcrLanguage('mar');
    expect(component.ocrSelectedLanguages()).toEqual(['eng', 'hin', 'mar']);

    // Attempt 4th language - should not add
    component.toggleOcrLanguage('tam');
    expect(component.ocrSelectedLanguages().length).toBe(3);
    expect(component.ocrSelectedLanguages()).not.toContain('tam');
  });

  it('applies OCR searchable result as a single undoable command', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    const mockResult: EditPdfOcrResult = {
      jobId: 'test-job',
      language: 'eng',
      averageConfidence: 85,
      warnings: [],
      pages: [
        {
          index: 0,
          widthPt: 595,
          heightPt: 842,
          rotation: 0,
          lines: [
            {
              text: 'Quarterly Report',
              bbox: [50, 750, 200, 770],
              baselineY: 754,
              fontSizePt: 16,
              confidence: 95,
              words: [
                { text: 'Quarterly', bbox: [50, 750, 120, 770], confidence: 95 },
                { text: 'Report', bbox: [125, 750, 200, 770], confidence: 95 }
              ]
            }
          ]
        }
      ]
    };

    component.applyOcrResultToEditor(mockResult, [0], 'searchable');

    expect(component.elements().length).toBe(1);
    expect(component.elements()[0].type).toBe('ocr-layer');
    expect(component.history.canUndo()).toBe(true);

    // Undo rolls back the OCR layer
    component.history.undo();
    expect(component.elements().length).toBe(0);
  });

  it('applies OCR editable mode with cover rectangle and editable text elements', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    const mockResult: EditPdfOcrResult = {
      jobId: 'test-job-2',
      language: 'eng',
      averageConfidence: 78,
      warnings: [],
      pages: [
        {
          index: 0,
          widthPt: 595,
          heightPt: 842,
          rotation: 0,
          lines: [
            {
              text: 'Revenue grew 18%',
              bbox: [60, 600, 220, 620],
              baselineY: 604,
              fontSizePt: 14,
              confidence: 55, // Low confidence word < 60
              words: [
                { text: 'Revenue', bbox: [60, 600, 110, 620], confidence: 55 },
                { text: 'grew', bbox: [115, 600, 150, 620], confidence: 92 },
                { text: '18%', bbox: [155, 600, 190, 620], confidence: 90 }
              ]
            }
          ]
        }
      ]
    };

    component.applyOcrResultToEditor(mockResult, [0], 'editable');

    // Generates 1 cover whiteout + 1 text element
    expect(component.elements().length).toBe(2);
    expect(component.elements()[0].type).toBe('whiteout');
    expect(component.elements()[1].type).toBe('text');

    // Flags low confidence word
    expect(component.lowConfidenceReviewWords().length).toBe(1);
    expect(component.lowConfidenceReviewWords()[0].text).toBe('Revenue');

    // Undo rolls back both generated elements in one step
    component.history.undo();
    expect(component.elements().length).toBe(0);
  });

  it('supports selecting different shape types, stroke widths, and colors', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    component.selectTool('shapes');
    expect(component.activeTool()).toBe('shapes');

    component.setShapeType('circle');
    expect(component.shapeType()).toBe('circle');

    component.setStrokeWidth(4);
    expect(component.strokeWidth()).toBe(4);

    component.setStrokeColor('var(--pt-coral)');
    expect(component.strokeColor()).toBe('var(--pt-coral)');

    component.setFillColor('var(--pt-teal-50)');
    expect(component.fillColor()).toBe('var(--pt-teal-50)');

    // Add shape to page
    component.addShapeElement(150, 150);
    expect(component.elements().length).toBe(1);
    const addedShape = component.elements()[0] as any;
    expect(addedShape.type).toBe('shape');
    expect(addedShape.shapeType).toBe('circle');
    expect(addedShape.strokeWidth).toBe(4);
    expect(addedShape.strokeColor).toBe('var(--pt-coral)');
    expect(addedShape.fillColor).toBe('var(--pt-teal-50)');

    // Switch shape to arrow
    component.setShapeType('arrow');
    const updatedShape = component.elements()[0] as any;
    expect(updatedShape.shapeType).toBe('arrow');
  });

  it('supports duplicating and deleting selected elements', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    component.addTextElement(100, 100);
    expect(component.elements().length).toBe(1);

    component.duplicateSelectedElement();
    expect(component.elements().length).toBe(2);

    component.deleteSelectedElement();
    expect(component.elements().length).toBe(1);

    component.selectedElementId.set(component.elements()[0].id);
    component.deleteSelectedElement();
    expect(component.elements().length).toBe(0);
  });

  it('handles Google Drive and Dropbox external openers safely', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.openGoogleDrive();
    expect(openSpy).toHaveBeenCalledWith('https://drive.google.com/', '_blank', 'noopener,noreferrer');

    component.openDropbox();
    expect(openSpy).toHaveBeenCalledWith('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');

    openSpy.mockRestore();
  });

  it('supports rotating and deleting specific pages with undo history', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 },
      { pageIndex: 1, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    // Rotate page 1 (second page)
    component.rotatePage(1);
    expect(component.pages()[1].rotation).toBe(90);

    // Undo rotation
    component.history.undo();
    expect(component.pages()[1].rotation).toBe(0);

    // Delete page 0
    component.deletePage(0);
    expect(component.pages().length).toBe(1);
    expect(component.pages()[0].pageIndex).toBe(0);

    // Cannot delete the only remaining page
    component.deletePage(0);
    expect(component.pages().length).toBe(1);
    expect(component.errorMessage()).toContain('at least one page');
  });

  it('generates smooth midpoint quadratic bezier splines for drawing', () => {
    // 0 or 1 point
    expect(component.screenPointsToSmoothSvgPath([])).toBe('');
    expect(component.screenPointsToSmoothSvgPath([{ x: 10, y: 20 }])).toContain('M 10 20 L 10.1 20.1');

    // 2 points
    expect(component.screenPointsToSmoothSvgPath([{ x: 0, y: 0 }, { x: 50, y: 50 }])).toBe('M 0 0 L 50 50');

    // 3+ points generates quadratic bezier Q commands
    const points = [
      { x: 10, y: 10 },
      { x: 20, y: 30 },
      { x: 40, y: 50 }
    ];
    const path = component.screenPointsToSmoothSvgPath(points);
    expect(path).toContain('M 10 10');
    expect(path).toContain('Q 20 30');

    // getDrawPath for DrawEditElement
    const drawEl: any = {
      id: 'draw-1',
      type: 'draw',
      xPt: 10,
      yPt: 10,
      widthPt: 50,
      heightPt: 50,
      points: [
        { xPt: 10, yPt: 50 },
        { xPt: 25, yPt: 35 },
        { xPt: 60, yPt: 10 }
      ]
    };
    const elPath = component.getDrawPath(drawEl);
    expect(elPath).toContain('M');
    expect(elPath).toContain('Q');
  });

  it('supports signature studio with cursive font styling and live property updates', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    component.signatureText.set('Sameer Kumar');
    component.signatureFont.set("'Caveat', cursive");
    component.signatureColor.set('var(--pt-teal-700)');
    component.signatureSize.set(34);

    component.addSignatureElement(100, 200);

    expect(component.elements().length).toBe(1);
    const signEl = component.elements()[0] as any;
    expect(signEl.type).toBe('sign');
    expect(signEl.signatureText).toBe('Sameer Kumar');
    expect(signEl.fontFamily).toBe("'Caveat', cursive");
    expect(signEl.color).toBe('var(--pt-teal-700)');
    expect(signEl.fontSizePt).toBe(34);

    // Live update signature font and color while selected
    component.setSignatureFont("'Great Vibes', cursive");
    const updatedSign = component.elements()[0] as any;
    expect(updatedSign.fontFamily).toBe("'Great Vibes', cursive");

    component.setSignatureText('S. Kumar');
    expect((component.elements()[0] as any).signatureText).toBe('S. Kumar');

    // Undo should revert
    component.history.undo();
    expect((component.elements()[0] as any).signatureText).toBe('Sameer Kumar');
  });

  it('supports in-place text styles: underline, alignment, and formatting', () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    component.addTextElement(80, 120);
    const textEl = component.elements()[0] as any;
    expect(textEl.type).toBe('text');

    component.toggleTextUnderline();
    expect((component.elements()[0] as any).underline).toBe(true);

    component.setTextAlign('center');
    expect((component.elements()[0] as any).align).toBe('center');

    component.setTextFont('Calibri');
    expect((component.elements()[0] as any).fontFamily).toBe('Calibri');

    component.setTextSize(22);
    expect((component.elements()[0] as any).fontSizePt).toBe(22);

    component.setTextColor('#e05d44');
    expect((component.elements()[0] as any).color).toBe('#e05d44');
  });

  it('extracts digital PDF text and creates in-place editable lines with makePageTextEditable', async () => {
    component.pages.set([
      { pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }
    ]);

    // Mock cached PDF.js document
    (component as any).cachedPdfDoc = {
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'SAMEER KUMAR', transform: [16, 0, 0, 16, 50, 750], width: 140, height: 16 },
            { str: 'Frontend Developer', transform: [12, 0, 0, 12, 50, 730], width: 120, height: 12 }
          ]
        })
      })
    };

    await component.makePageTextEditable();

    expect(component.editorMode()).toBe('edit');
    // Generates clean in-place text elements (2 lines) without obscuring original PDF
    expect(component.elements().length).toBe(2);

    const textElements = component.elements().filter(e => e.type === 'text') as any[];
    expect(textElements.length).toBe(2);
    expect(textElements[0].text).toBe('SAMEER KUMAR');
    expect(textElements[0].isPageTextLine).toBe(true);
    expect(textElements[0].isEdited).toBe(false);
    expect(textElements[1].text).toBe('Frontend Developer');
    expect(textElements[1].isPageTextLine).toBe(true);
    expect(textElements[1].isEdited).toBe(false);

    // Can undo all extracted text lines in 1 step
    component.history.undo();
    expect(component.elements().length).toBe(0);
  });
});
