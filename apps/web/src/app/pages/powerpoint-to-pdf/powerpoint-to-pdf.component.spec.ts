import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PowerPointToPdfComponent } from './powerpoint-to-pdf.component';
import { PowerPointToPdfService, ValidatedPowerPointFile } from '../../core/services/powerpoint-to-pdf.service';

describe('PowerPointToPdfComponent Integration Test', () => {
  let component: PowerPointToPdfComponent;
  let fixture: ComponentFixture<PowerPointToPdfComponent>;
  let service: PowerPointToPdfService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PowerPointToPdfComponent],
      providers: [
        provideRouter([]),
        PowerPointToPdfService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PowerPointToPdfComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PowerPointToPdfService);
    fixture.detectChanges();
  });

  function createTestPresentationFile(name: string, content = 'fake pptx content'): File {
    return new File([content], name, {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      lastModified: Date.now()
    });
  }

  it('should initialize in "upload" state with default PowerPoint options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.outputFormat()).toBe('pdf');
    expect(component.layout()).toBe('slides');
    expect(component.pageSize()).toBe('as_slide');
    expect(component.handoutPerPage()).toBe(3);
    expect(component.handoutOrientation()).toBe('portrait');
    expect(component.slideMode()).toBe('all');
    expect(component.bookmarks()).toBe(true);
    expect(component.tagged()).toBe(true);
    expect(component.hyperlinks()).toBe(true);
    expect(component.imageQuality()).toBe('standard');
    expect(component.conversionResult()).toBeNull();
  });

  it('should transition to "organize" state when valid presentation files are uploaded', async () => {
    const file = createTestPresentationFile('pitch_deck.pptx');

    const validated: ValidatedPowerPointFile = {
      id: 'test-1',
      file,
      name: 'pitch_deck.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 5, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('pitch_deck.pptx');
    expect(component.selectedFiles()[0].extension).toBe('.pptx');
    expect(component.knownSlideCount()).toBe(5);
  });

  it('should reject unsupported file types and set error message', async () => {
    const invalidFile = new File(['content'], 'test.png', { type: 'image/png' });

    const validated: ValidatedPowerPointFile = {
      id: 'test-invalid',
      file: invalidFile,
      name: 'test.png',
      sizeBytes: invalidFile.size,
      extension: '.png',
      formattedSize: '1 KB',
      isValid: false,
      deckInfo: { hiddenSlideCount: 0 },
      error: 'Unsupported file format (.png). Please upload .pptx, .ppt, .ppsx, .pps, .pptm, or .odp.'
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([invalidFile]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toContain('Unsupported file format');
  });

  it('should reject duplicate files', async () => {
    const file = createTestPresentationFile('keynote.pptx');

    const validated: ValidatedPowerPointFile = {
      id: 'test-keynote',
      file,
      name: 'keynote.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 3, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);
  });

  it('should allow removing files and return to "upload" state when list is empty', async () => {
    const file = createTestPresentationFile('deck.pptx');
    const validated: ValidatedPowerPointFile = {
      id: 'test-deck',
      file,
      name: 'deck.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 3, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    component.removeFile(0);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
  });

  it('should validate slide ranges properly against known slide count', async () => {
    const file = createTestPresentationFile('slides.pptx');
    const validated: ValidatedPowerPointFile = {
      id: 'test-slides',
      file,
      name: 'slides.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 10, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.slideMode.set('range');

    // Empty range
    component.slideRange.set('');
    expect(component.slideRangeError()).toContain('Please specify');

    // Invalid format
    component.slideRange.set('1-3, abc');
    expect(component.slideRangeError()).toContain('Invalid range format');

    // Start > End
    component.slideRange.set('6-3');
    expect(component.slideRangeError()).toContain('cannot be greater than');

    // Out of bounds
    component.slideRange.set('1-12');
    expect(component.slideRangeError()).toContain('Range exceeds slide count (10 slides in deck)');

    // Valid range
    component.slideRange.set('1-3, 5, 8-10');
    expect(component.slideRangeError()).toBeNull();
  });

  it('should execute conversion and transition to "completed" state with valid PDF result', async () => {
    vi.spyOn(service, 'convertToPdf').mockResolvedValue({
      blob: new Blob(['%PDF-1.4 mock presentation pdf payload']),
      url: 'blob:http://localhost:4200/fake-ppt-pdf-uuid',
      filename: 'pitch_deck.pdf',
      pageCount: 5,
      originalSizeBytes: 4096,
      pdfSizeBytes: 2048,
      formattedOriginalSize: '4.0 KB',
      formattedPdfSize: '2.0 KB',
      isZip: false,
      files: [{
        id: '1',
        inputName: 'pitch_deck.pptx',
        outputName: 'pitch_deck.pdf',
        slideCount: 5,
        pageCount: 5,
        sizeBytes: 2048,
        originalSizeBytes: 4096,
        formattedOriginalSize: '4.0 KB',
        formattedPdfSize: '2.0 KB',
        downloadUrl: '/api/v1/powerpoint-to-pdf/jobs/123/download',
        fontsSubstituted: [],
        fontsMissing: []
      }],
      warnings: []
    });

    const file = createTestPresentationFile('pitch_deck.pptx');
    const validated: ValidatedPowerPointFile = {
      id: 'test-pitch',
      file,
      name: 'pitch_deck.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '4.0 KB',
      isValid: true,
      deckInfo: { slideCount: 5, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.executeConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    expect(component.conversionResult()?.filename).toBe('pitch_deck.pdf');
    expect(component.resultViewModel()).not.toBeNull();
    expect(component.resultViewModel()?.filename).toBe('pitch_deck.pdf');
    expect(component.resultViewModel()?.pageCount).toBe(5);
  });

  it('should handle conversion failure gracefully and keep user on "organize" screen', async () => {
    vi.spyOn(service, 'convertToPdf').mockRejectedValue(new Error('LibreOffice Impress conversion timeout'));

    const file = createTestPresentationFile('error.pptx');
    const validated: ValidatedPowerPointFile = {
      id: 'test-error',
      file,
      name: 'error.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 1, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.executeConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.errorMessage()).toContain('LibreOffice Impress conversion timeout');
  });

  it('should cancel conversion properly', () => {
    component.currentState.set('processing');
    component.isProcessing.set(true);

    component.cancelConversion();

    expect(component.currentState()).toBe('organize');
    expect(component.isProcessing()).toBe(false);
    expect(component.errorMessage()).toContain('Conversion was cancelled.');
  });

  it('should reset workspace back to default initial state', async () => {
    const file = createTestPresentationFile('deck.pptx');
    const validated: ValidatedPowerPointFile = {
      id: 'test-reset',
      file,
      name: 'deck.pptx',
      sizeBytes: file.size,
      extension: '.pptx',
      formattedSize: '1 KB',
      isValid: true,
      deckInfo: { slideCount: 2, hiddenSlideCount: 0 }
    };
    vi.spyOn(service, 'validateFile').mockResolvedValue(validated);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.outputFormat.set('pdfa');
    component.layout.set('handout');
    component.resetWorkspace();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.outputFormat()).toBe('pdf');
    expect(component.layout()).toBe('slides');
    expect(component.errorMessage()).toBeNull();
  });
});
