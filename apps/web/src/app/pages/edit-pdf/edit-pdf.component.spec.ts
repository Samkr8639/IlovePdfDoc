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
});
