import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PdfToWordComponent } from './pdf-to-word.component';
import { PdfToWordService } from '../../core/services/pdf-to-word.service';
import { PDFDocument } from 'pdf-lib';

describe('PdfToWordComponent Integration Test', () => {
  let component: PdfToWordComponent;
  let fixture: ComponentFixture<PdfToWordComponent>;
  let service: PdfToWordService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToWordComponent],
      providers: [
        provideRouter([]),
        PdfToWordService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToWordComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PdfToWordService);
    fixture.detectChanges();
  });

  async function createTestPdfFile(pages: number, name: string): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const page = doc.addPage([500, 400]);
      page.drawText(`This is a standard digital document with selectable paragraphs and typography on page ${i + 1}. All content can be converted to Word DOCX.`);
      page.drawText('Second paragraph: Software engineering specifications and document properties.');
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf' });
  }

  it('should initialize in "upload" state with default "no_ocr" mode', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.selectedMode()).toBe('no_ocr');
    expect(component.conversionResult()).toBeNull();
  });

  it('should transition to "organize" state when valid PDF files are uploaded', async () => {
    const file = await createTestPdfFile(2, 'annual_report.pdf');

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('annual_report.pdf');
    expect(component.selectedFiles()[0].pageCount).toBe(2);
    expect(component.documentAnalysis()).not.toBeNull();
  });

  it('should support switching conversion mode between "no_ocr" and "ocr"', async () => {
    const file = await createTestPdfFile(1, 'invoice.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedMode()).toBe('no_ocr');

    // Switch to OCR mode
    component.selectedMode.set('ocr');
    fixture.detectChanges();
    expect(component.selectedMode()).toBe('ocr');

    // Switch back to No OCR mode
    component.selectedMode.set('no_ocr');
    fixture.detectChanges();
    expect(component.selectedMode()).toBe('no_ocr');
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

  it('should execute conversion and transition to "completed" state with valid Word result', async () => {
    vi.spyOn(service, 'convertToWord').mockResolvedValue({
      blob: new Blob(['docx binary payload']),
      url: 'blob:http://localhost:4200/fake-doc-uuid',
      filename: 'sample_doc.docx',
      pageCount: 1,
      originalSizeBytes: 1024,
      wordSizeBytes: 2048,
      formattedOriginalSize: '1.0 KB',
      formattedWordSize: '2.0 KB',
      modeUsed: 'no_ocr'
    });

    const file = await createTestPdfFile(1, 'sample_doc.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    const result = component.conversionResult();
    expect(result?.filename).toContain('.docx');
    expect(result?.wordSizeBytes).toBeGreaterThan(0);
    expect(result?.blob).toBeDefined();

    // Reset workspace
    component.resetWorkspace();
    fixture.detectChanges();
    expect(component.currentState()).toBe('upload');
    expect(component.conversionResult()).toBeNull();
  });
});
