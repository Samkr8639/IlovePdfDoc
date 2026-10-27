import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PdfToPowerPointComponent } from './pdf-to-powerpoint.component';
import { PdfToPowerPointService } from '../../core/services/pdf-to-powerpoint.service';
import { PDFDocument } from 'pdf-lib';

describe('PdfToPowerPointComponent Integration Test', () => {
  let component: PdfToPowerPointComponent;
  let fixture: ComponentFixture<PdfToPowerPointComponent>;
  let service: PdfToPowerPointService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToPowerPointComponent],
      providers: [
        provideRouter([]),
        PdfToPowerPointService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToPowerPointComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PdfToPowerPointService);
    fixture.detectChanges();
  });

  async function createTestPdfFile(pages: number, name: string): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const page = doc.addPage([600, 400]);
      page.drawText(`Sample slide content for presentation on page ${i + 1}`);
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf', lastModified: 1000 });
  }

  it('should initialize in "upload" state with default options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.selectedMode()).toBe('no_ocr');
    expect(component.selectedSlideSize()).toBe('match_pdf');
    expect(component.conversionResult()).toBeNull();
    expect(component.mergeResult()).toBeNull();
  });

  it('should transition to "organize" state when valid PDF files are uploaded', async () => {
    const file = await createTestPdfFile(3, 'quarterly_deck.pdf');

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('quarterly_deck.pdf');
    expect(component.selectedFiles()[0].pageCount).toBe(3);
    expect(component.documentAnalysis()).not.toBeNull();
  });

  it('should reject duplicate files based on name, size and lastModified', async () => {
    const file = await createTestPdfFile(1, 'presentation.pdf');

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    // Try adding the same file again
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);
    expect(component.errorMessage()).toContain('Duplicate');
  });

  it('should support switching slide size between "match_pdf" and "widescreen_16_9"', async () => {
    const file = await createTestPdfFile(1, 'slides.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedSlideSize()).toBe('match_pdf');

    component.selectedSlideSize.set('widescreen_16_9');
    fixture.detectChanges();
    expect(component.selectedSlideSize()).toBe('widescreen_16_9');

    component.selectedSlideSize.set('match_pdf');
    fixture.detectChanges();
    expect(component.selectedSlideSize()).toBe('match_pdf');
  });

  it('should support switching conversion mode between "no_ocr" and "ocr"', async () => {
    const file = await createTestPdfFile(1, 'slides.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedMode()).toBe('no_ocr');

    component.selectedMode.set('ocr');
    fixture.detectChanges();
    expect(component.selectedMode()).toBe('ocr');

    component.selectedMode.set('no_ocr');
    fixture.detectChanges();
    expect(component.selectedMode()).toBe('no_ocr');
  });

  it('should disable OCR mode when OCR gate is off', async () => {
    vi.spyOn(service, 'isOcrAvailable').mockReturnValue(false);
    fixture.detectChanges();

    expect(component.ocrAvailable()).toBe(false);
  });

  it('should allow removing files and reset to "upload" when last file is removed', async () => {
    const file = await createTestPdfFile(1, 'temp.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);

    component.removeFile(component.selectedFiles()[0].id);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
  });

  it('should execute conversion and transition to "completed" state with stable mergeResult', async () => {
    const mockBlob = new Blob(['pptx binary content']);
    const mockUrl = 'blob:http://localhost:4200/test-pptx-uuid';

    vi.spyOn(service, 'convertToPowerPoint').mockResolvedValue({
      blob: mockBlob,
      url: mockUrl,
      filename: 'sample_presentation.pptx',
      slideCount: 3,
      originalSizeBytes: 2048,
      pptxSizeBytes: 4096,
      formattedOriginalSize: '2.0 KB',
      formattedSize: '4.0 KB',
      isZip: false,
      warnings: ['Font "League Gothic" missing on system; Arial used as substitute.'],
      modeUsed: 'no_ocr',
      slideSizeUsed: 'match_pdf'
    });

    const file = await createTestPdfFile(3, 'deck.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    expect(component.mergeResult()).not.toBeNull();
    expect(component.mergeResult()?.pageCount).toBe(3);
    expect(component.mergeResult()?.filename).toBe('sample_presentation.pptx');
    expect(component.activeWarnings().length).toBe(1);

    // Stable computed property (calling it twice returns the same reference/value)
    const ref1 = component.mergeResult();
    const ref2 = component.mergeResult();
    expect(ref1).toBe(ref2);
  });

  it('should display error banner and return to "organize" state when conversion fails', async () => {
    vi.spyOn(service, 'convertToPowerPoint').mockRejectedValue(
      new Error('Server overloaded or network error')
    );

    const file = await createTestPdfFile(1, 'deck.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.errorMessage()).toBe('Server overloaded or network error');
  });

  it('should revoke object URL on reset and ngOnDestroy', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    component.conversionResult.set({
      blob: new Blob(['pptx']),
      url: 'blob:http://localhost:4200/test-uuid',
      filename: 'test.pptx',
      slideCount: 1,
      originalSizeBytes: 100,
      pptxSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      isZip: false,
      warnings: [],
      modeUsed: 'no_ocr',
      slideSizeUsed: 'match_pdf'
    });

    component.resetWorkspace();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:4200/test-uuid');

    // ngOnDestroy
    component.conversionResult.set({
      blob: new Blob(['pptx']),
      url: 'blob:http://localhost:4200/another-uuid',
      filename: 'test.pptx',
      slideCount: 1,
      originalSizeBytes: 100,
      pptxSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      isZip: false,
      warnings: [],
      modeUsed: 'no_ocr',
      slideSizeUsed: 'match_pdf'
    });
    component.ngOnDestroy();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:4200/another-uuid');

    revokeSpy.mockRestore();
  });

  it('should ignore late results when conversion is cancelled', async () => {
    let resolveConversion!: (val: any) => void;
    const conversionPromise = new Promise(resolve => {
      resolveConversion = resolve;
    });

    vi.spyOn(service, 'convertToPowerPoint').mockImplementation(() => conversionPromise as any);

    const file = await createTestPdfFile(1, 'deck.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    // Start conversion
    const conversionTask = component.startConversion();
    fixture.detectChanges();
    expect(component.currentState()).toBe('processing');

    // Cancel conversion
    component.cancelConversion();
    fixture.detectChanges();
    expect(component.currentState()).toBe('organize');

    // Resolve late conversion
    resolveConversion({
      blob: new Blob(['late pptx']),
      url: 'blob:http://localhost:4200/late-uuid',
      filename: 'late.pptx',
      slideCount: 1,
      originalSizeBytes: 100,
      pptxSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      isZip: false,
      warnings: [],
      modeUsed: 'no_ocr',
      slideSizeUsed: 'match_pdf'
    });

    await conversionTask;
    fixture.detectChanges();

    // Late result should NOT change state back to completed
    expect(component.currentState()).toBe('organize');
  });
});
