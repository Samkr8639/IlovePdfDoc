import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExcelToPdfComponent } from './excel-to-pdf.component';
import { ExcelToPdfService } from '../../core/services/excel-to-pdf.service';

describe('ExcelToPdfComponent Integration Test', () => {
  let component: ExcelToPdfComponent;
  let fixture: ComponentFixture<ExcelToPdfComponent>;
  let service: ExcelToPdfService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelToPdfComponent],
      providers: [
        provideRouter([]),
        ExcelToPdfService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExcelToPdfComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ExcelToPdfService);
    fixture.detectChanges();
  });

  function createTestSpreadsheetFile(name: string, content = 'fake xlsx content'): File {
    return new File([content], name, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: Date.now()
    });
  }

  it('should initialize in "upload" state with default Excel options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.outputFormat()).toBe('pdf');
    expect(component.sheetMode()).toBe('all');
    expect(component.pageSize()).toBe('as_file');
    expect(component.orientation()).toBe('as_file');
    expect(component.scaling()).toBe('as_file');
    expect(component.gridlines()).toBe(false);
    expect(component.repeatHeader()).toBe(true);
    expect(component.bookmarks()).toBe(true);
    expect(component.trimEmpty()).toBe(true);
    expect(component.conversionResult()).toBeNull();
  });

  it('should transition to "organize" state when valid Excel files are uploaded', async () => {
    const file = createTestSpreadsheetFile('financial_model.xlsx');

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('financial_model.xlsx');
    expect(component.selectedFiles()[0].extension).toBe('.xlsx');
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
    const file = createTestSpreadsheetFile('q3_results.xlsx');

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);
  });

  it('should allow removing files and return to "upload" state when list is empty', async () => {
    const file = createTestSpreadsheetFile('budget.xlsx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);

    component.removeFile(component.selectedFiles()[0].id);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
  });

  it('should toggle sheet selection correctly', async () => {
    const file = createTestSpreadsheetFile('multi.xlsx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.selectedSheetNames.set(['Sheet1', 'Sheet2']);
    component.toggleSheetSelection('Sheet2');
    expect(component.selectedSheetNames()).toEqual(['Sheet1']);

    component.toggleSheetSelection('Sheet2');
    expect(component.selectedSheetNames()).toEqual(['Sheet1', 'Sheet2']);
  });

  it('should execute conversion and transition to "completed" state with valid PDF result', async () => {
    vi.spyOn(service, 'convertToPdf').mockResolvedValue({
      blob: new Blob(['%PDF-1.4 mock pdf payload']),
      url: 'blob:http://localhost:4200/fake-pdf-uuid',
      filename: 'financial_model.pdf',
      pageCount: 2,
      originalSizeBytes: 1024,
      pdfSizeBytes: 2048,
      formattedOriginalSize: '1.0 KB',
      formattedPdfSize: '2.0 KB',
      isZip: false,
      files: [{
        id: '1',
        inputName: 'financial_model.xlsx',
        outputName: 'financial_model.pdf',
        originalSizeBytes: 1024,
        pdfSizeBytes: 2048,
        formattedOriginalSize: '1.0 KB',
        formattedPdfSize: '2.0 KB',
        pageCount: 2,
        sheets: [{ name: 'Sheet1', pages: 2 }],
        downloadUrl: '/api/v1/excel-to-pdf/jobs/123/download',
        fontsSubstituted: []
      }],
      warnings: []
    });

    const file = createTestSpreadsheetFile('financial_model.xlsx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    expect(component.conversionResult()?.filename).toBe('financial_model.pdf');
    expect(component.resultViewModel()).not.toBeNull();
    expect(component.resultViewModel()?.filename).toBe('financial_model.pdf');
    expect(component.resultViewModel()?.pageCount).toBe(2);
  });

  it('should handle conversion failure gracefully and keep user on "organize" screen', async () => {
    vi.spyOn(service, 'convertToPdf').mockRejectedValue(new Error('LibreOffice Calc conversion timeout'));

    const file = createTestSpreadsheetFile('error.xlsx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.errorMessage()).toContain('LibreOffice Calc conversion timeout');
  });

  it('should cancel conversion properly', () => {
    component.currentState.set('processing');
    component.isProcessing.set(true);

    component.cancelConversion();

    expect(component.currentState()).toBe('organize');
    expect(component.isProcessing()).toBe(false);
  });

  it('should reset workspace back to default initial state', async () => {
    const file = createTestSpreadsheetFile('doc.xlsx');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.outputFormat.set('pdfa');
    component.scaling.set('fit_width');
    component.resetWorkspace();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.outputFormat()).toBe('pdf');
    expect(component.scaling()).toBe('as_file');
    expect(component.errorMessage()).toBeNull();
  });
});
