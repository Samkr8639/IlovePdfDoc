import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SplitPdfComponent } from './split-pdf.component';
import { BrowserPdfService, ValidatedPdfFile, SplitPdfResult } from '../../core/services/browser-pdf.service';
import { provideTranslateService } from '@ngx-translate/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SplitPdfComponent Integration Tests', () => {
  let component: SplitPdfComponent;
  let fixture: ComponentFixture<SplitPdfComponent>;
  let mockPdfService: any;

  const mockFile: ValidatedPdfFile = {
    id: 'test-doc-1',
    file: new File(['%PDF-1.4 test content'], 'quarterly_report.pdf', { type: 'application/pdf' }),
    name: 'quarterly_report.pdf',
    sizeBytes: 10240,
    formattedSize: '10 KB',
    pageCount: 6,
    isValid: true
  };

  const mockSplitResult: SplitPdfResult = {
    blob: new Blob(['%PDF split result'], { type: 'application/pdf' }),
    url: 'blob:http://localhost:4200/test-split-uuid',
    filename: 'quarterly_report_split_1-2.pdf',
    pageCount: 2,
    sizeBytes: 4096,
    formattedSize: '4 KB',
    outputFilesCount: 1,
    isZip: false,
    outputFiles: [{
      filename: 'quarterly_report_split_1-2.pdf',
      pageCount: 2,
      sizeBytes: 4096,
      formattedSize: '4 KB'
    }]
  };

  beforeEach(async () => {
    mockPdfService = {
      validatePdf: vi.fn().mockResolvedValue(mockFile),
      splitPdf: vi.fn().mockResolvedValue(mockSplitResult)
    };

    await TestBed.configureTestingModule({
      imports: [
        SplitPdfComponent
      ],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: BrowserPdfService, useValue: mockPdfService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SplitPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize in "upload" state with custom mode as default', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.splitMode()).toBe('custom');
    expect(component.selectedFile()).toBeNull();
  });

  it('should transition to "organize" state when a valid PDF is uploaded', async () => {
    await component.onFilesAdded([mockFile.file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFile()).toEqual(mockFile);
    expect(component.totalPages()).toBe(6);
  });

  it('should compute active chunks and page distribution in fixed mode', async () => {
    await component.onFilesAdded([mockFile.file]);
    component.setSplitMode('fixed');
    component.fixedChunkSize.set(2);
    fixture.detectChanges();

    const chunks = component.activeChunks();
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ from: 1, to: 2 });
    expect(chunks[1]).toEqual({ from: 3, to: 4 });
    expect(chunks[2]).toEqual({ from: 5, to: 6 });

    expect(component.outputFilesCount()).toBe(3);
    expect(component.isZipOutput()).toBe(true);
  });

  it('should compute 1 chunk per page in extract_all mode', async () => {
    await component.onFilesAdded([mockFile.file]);
    component.setSplitMode('extract_all');
    fixture.detectChanges();

    const chunks = component.activeChunks();
    expect(chunks.length).toBe(6);
    expect(chunks[0]).toEqual({ from: 1, to: 1 });
    expect(chunks[5]).toEqual({ from: 6, to: 6 });
  });

  it('should validate custom ranges and catch reversed, out-of-bounds, and overlapping ranges', async () => {
    await component.onFilesAdded([mockFile.file]);
    component.setSplitMode('custom');

    // Valid range
    component.customRanges.set([
      { id: '1', from: 1, to: 3 }
    ]);
    expect(component.validation().isValid).toBe(true);

    // Reversed range (from > to)
    component.customRanges.set([
      { id: '1', from: 4, to: 2 }
    ]);
    expect(component.validation().isValid).toBe(false);
    expect(component.validation().errors['1']).toContain('cannot be greater than');

    // Out of bounds (to > totalPages)
    component.customRanges.set([
      { id: '1', from: 1, to: 10 }
    ]);
    expect(component.validation().isValid).toBe(false);
    expect(component.validation().errors['1']).toContain('exceeds total pages');

    // Overlapping ranges
    component.customRanges.set([
      { id: '1', from: 1, to: 3 },
      { id: '2', from: 3, to: 5 }
    ]);
    expect(component.validation().isValid).toBe(false);
    expect(component.validation().errors['2']).toContain('overlaps');
  });

  it('should execute split and transition to completed state', async () => {
    await component.onFilesAdded([mockFile.file]);
    component.customRanges.set([{ id: '1', from: 1, to: 2 }]);
    fixture.detectChanges();

    await component.executeSplit();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.splitResult()).toEqual(mockSplitResult);
    expect(mockPdfService.splitPdf).toHaveBeenCalled();
  });

  it('should reset workspace back to upload state when changeFile is clicked', async () => {
    await component.onFilesAdded([mockFile.file]);
    expect(component.currentState()).toBe('organize');

    component.changeFile();
    fixture.detectChanges();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFile()).toBeNull();
  });
});
