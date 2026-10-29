import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PdfToExcelComponent } from './pdf-to-excel.component';
import { PdfToExcelService } from '../../core/services/pdf-to-excel.service';
import { PDFDocument } from 'pdf-lib';

describe('PdfToExcelComponent Integration Test', () => {
  let component: PdfToExcelComponent;
  let fixture: ComponentFixture<PdfToExcelComponent>;
  let service: PdfToExcelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToExcelComponent],
      providers: [
        provideRouter([]),
        PdfToExcelService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToExcelComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(PdfToExcelService);
    fixture.detectChanges();
  });

  async function createTestPdfFile(pages: number, name: string): Promise<File> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const page = doc.addPage([600, 400]);
      page.drawText(`Sample financial report content on page ${i + 1}`);
    }
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/pdf', lastModified: 1000 });
  }

  it('should initialize in "upload" state with default options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.selectedMode()).toBe('no_ocr');
    expect(component.selectedSheetLayout()).toBe('sheet_per_table');
    expect(component.selectedMultiFileOutput()).toBe('separate_workbooks');
    expect(component.detectTypes()).toBe(true);
    expect(component.keepFormatting()).toBe(true);
    expect(component.mergeAcrossPages()).toBe(true);
    expect(component.includeText()).toBe(false);
    expect(component.conversionResult()).toBeNull();
    expect(component.mergeResult()).toBeNull();
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

  it('should reject duplicate files based on name, size, and lastModified', async () => {
    const file = await createTestPdfFile(1, 'invoice.pdf');

    await component.onFilesAdded([file]);
    fixture.detectChanges();
    expect(component.selectedFiles().length).toBe(1);

    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);
    expect(component.errorMessage()).toContain('Duplicate');
  });

  it('should support switching sheet layout between "sheet_per_table", "sheet_per_page", and "single_sheet"', async () => {
    const file = await createTestPdfFile(1, 'data.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    expect(component.selectedSheetLayout()).toBe('sheet_per_table');

    component.selectedSheetLayout.set('sheet_per_page');
    fixture.detectChanges();
    expect(component.selectedSheetLayout()).toBe('sheet_per_page');

    component.selectedSheetLayout.set('single_sheet');
    fixture.detectChanges();
    expect(component.selectedSheetLayout()).toBe('single_sheet');
  });

  it('should support switching detection checkboxes', async () => {
    const file = await createTestPdfFile(1, 'data.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.detectTypes.set(false);
    component.keepFormatting.set(false);
    component.includeText.set(true);
    fixture.detectChanges();

    expect(component.detectTypes()).toBe(false);
    expect(component.keepFormatting()).toBe(false);
    expect(component.includeText()).toBe(true);
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

  it('should validate invalid page range format before conversion', async () => {
    const file = await createTestPdfFile(2, 'doc.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    component.pageRange.set('invalid-range-format!!');
    await component.startConversion();
    fixture.detectChanges();

    expect(component.errorMessage()).toContain('Invalid page range format');
    expect(component.currentState()).toBe('organize');
  });

  it('should execute conversion and transition to "completed" state with table preview navigation', async () => {
    const mockBlob = new Blob(['xlsx binary content']);
    const mockUrl = 'blob:http://localhost:4200/test-xlsx-uuid';

    vi.spyOn(service, 'convertToExcel').mockResolvedValue({
      blob: mockBlob,
      url: mockUrl,
      filename: 'sample_financials.xlsx',
      isZip: false,
      originalSizeBytes: 2048,
      excelSizeBytes: 4096,
      formattedOriginalSize: '2.0 KB',
      formattedSize: '4.0 KB',
      sheetCount: 2,
      tableCount: 2,
      rowCount: 20,
      cellCount: 80,
      files: [
        {
          filename: 'sample_financials.xlsx',
          sheets: 2,
          tables: 2,
          rows: 20,
          cells: 80
        }
      ],
      tables: [
        {
          file: 'deck.pdf',
          page: 1,
          sheet: 'Balance Sheet',
          rows: 3,
          cols: 2,
          method: 'lattice',
          confidence: 0.95,
          preview: [
            ['Item', 'Amount'],
            ['Assets', '1000'],
            ['Liabilities', '400']
          ]
        },
        {
          file: 'deck.pdf',
          page: 2,
          sheet: 'Income Statement',
          rows: 3,
          cols: 2,
          method: 'stream',
          confidence: 0.88,
          preview: [
            ['Metric', 'Value'],
            ['Revenue', '5000'],
            ['Net Income', '1200']
          ]
        }
      ],
      warnings: ['Detected Indian numbering format in column 2.'],
      modeUsed: 'no_ocr'
    });

    const file = await createTestPdfFile(2, 'deck.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).not.toBeNull();
    expect(component.mergeResult()).not.toBeNull();
    expect(component.mergeResult()?.filename).toBe('sample_financials.xlsx');
    expect(component.activeWarnings().length).toBe(1);

    // Verify table preview navigation
    expect(component.activeTable()?.sheet).toBe('Balance Sheet');
    component.selectPreviewTable(1);
    fixture.detectChanges();
    expect(component.activeTable()?.sheet).toBe('Income Statement');
  });

  it('should display error banner and return to "organize" state when conversion fails', async () => {
    vi.spyOn(service, 'convertToExcel').mockRejectedValue(
      new Error('No tables or selectable text found')
    );

    const file = await createTestPdfFile(1, 'blank.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    await component.startConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.errorMessage()).toBe('No tables or selectable text found');
  });

  it('should revoke object URL on reset and ngOnDestroy', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    component.conversionResult.set({
      blob: new Blob(['xlsx']),
      url: 'blob:http://localhost:4200/test-excel-uuid',
      filename: 'test.xlsx',
      isZip: false,
      originalSizeBytes: 100,
      excelSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      sheetCount: 1,
      tableCount: 1,
      rowCount: 5,
      cellCount: 20,
      files: [],
      tables: [],
      warnings: [],
      modeUsed: 'no_ocr'
    });

    component.resetWorkspace();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:4200/test-excel-uuid');

    component.conversionResult.set({
      blob: new Blob(['xlsx']),
      url: 'blob:http://localhost:4200/another-excel-uuid',
      filename: 'test.xlsx',
      isZip: false,
      originalSizeBytes: 100,
      excelSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      sheetCount: 1,
      tableCount: 1,
      rowCount: 5,
      cellCount: 20,
      files: [],
      tables: [],
      warnings: [],
      modeUsed: 'no_ocr'
    });
    component.ngOnDestroy();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost:4200/another-excel-uuid');

    revokeSpy.mockRestore();
  });

  it('should ignore late results when conversion is cancelled', async () => {
    let resolveConversion!: (val: any) => void;
    const conversionPromise = new Promise(resolve => {
      resolveConversion = resolve;
    });

    vi.spyOn(service, 'convertToExcel').mockImplementation(() => conversionPromise as any);

    const file = await createTestPdfFile(1, 'data.pdf');
    await component.onFilesAdded([file]);
    fixture.detectChanges();

    const conversionTask = component.startConversion();
    fixture.detectChanges();
    expect(component.currentState()).toBe('processing');

    component.cancelConversion();
    fixture.detectChanges();
    expect(component.currentState()).toBe('organize');

    resolveConversion({
      blob: new Blob(['late xlsx']),
      url: 'blob:http://localhost:4200/late-uuid',
      filename: 'late.xlsx',
      isZip: false,
      originalSizeBytes: 100,
      excelSizeBytes: 200,
      formattedOriginalSize: '100 B',
      formattedSize: '200 B',
      sheetCount: 1,
      tableCount: 1,
      rowCount: 5,
      cellCount: 20,
      files: [],
      tables: [],
      warnings: [],
      modeUsed: 'no_ocr'
    });

    await conversionTask;
    fixture.detectChanges();
    expect(component.currentState()).toBe('organize');
  });
});

