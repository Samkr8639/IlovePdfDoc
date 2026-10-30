import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WordToPdfComponent } from './word-to-pdf.component';
import { WordToPdfService } from '../../core/services/word-to-pdf.service';

describe('WordToPdfComponent Integration Test', () => {
  let component: WordToPdfComponent;
  let fixture: ComponentFixture<WordToPdfComponent>;
  let service: WordToPdfService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordToPdfComponent],
      providers: [
        provideRouter([]),
        WordToPdfService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WordToPdfComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(WordToPdfService);
    fixture.detectChanges();
  });

  function createTestWordFile(name: string, content = 'fake docx content'): File {
    return new File([content], name, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now()
    });
  }

  it('should initialize in "upload" state with default options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.outputFormat()).toBe('pdf');
    expect(component.conversionResult()).toBeNull();
  });

  it('should transition to "organize" state when valid Word files are uploaded', async () => {
    const file = createTestWordFile('document.docx');

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('document.docx');
    expect(component.selectedFiles()[0].extension).toBe('.docx');
  });

  it('should reject unsupported file types and set error message', async () => {
    const invalidFile = new File(['content'], 'test.png', { type: 'image/png' });

    await component.onFilesAdded([invalidFile]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toContain('Unsupported file format');
  });

  it('should reject duplicate files', async () => {
    const file = createTestWordFile('report.docx');

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    // Try adding the exact same file
    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);
  });

  it('should allow removing files and return to "upload" state when list is empty', async () => {
    const file = createTestWordFile('notes.docx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);

    component.removeFile(component.selectedFiles()[0].id);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
  });

  it('should execute conversion and transition to "completed" state with valid PDF result', async () => {
    vi.spyOn(service, 'convertToPdf').mockResolvedValue({
      blob: new Blob(['%PDF-1.4 mock pdf payload']),
      url: 'blob:http://localhost:4200/fake-pdf-uuid',
      filename: 'document.pdf',
      pageCount: 3,
      originalSizeBytes: 1024,
      pdfSizeBytes: 2048,
      formattedOriginalSize: '1.0 KB',
      formattedPdfSize: '2.0 KB',
      isZip: false,
      files: [
        {
          id: '1',
          originalFilename: 'document.docx',
          pdfFilename: 'document.pdf',
          originalSizeBytes: 1024,
          pdfSizeBytes: 2048,
          formattedOriginalSize: '1.0 KB',
          formattedPdfSize: '2.0 KB',
          pageCount: 3,
          downloadUrl: '/api/v1/word-to-pdf/jobs/123/download'
        }
      ],
      warnings: []
    });

    const file = createTestWordFile('document.docx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    const result = component.conversionResult();
    expect(result?.filename).toBe('document.pdf');
    expect(result?.pageCount).toBe(3);

    // Reset workspace
    component.resetWorkspace();
    fixture.detectChanges();
    expect(component.currentState()).toBe('upload');
    expect(component.conversionResult()).toBeNull();
  });
});

