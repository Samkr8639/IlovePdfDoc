import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PdfToJpgComponent } from './pdf-to-jpg.component';
import { PdfToJpgService } from '../../core/services/pdf-to-jpg/pdf-to-jpg.service';
import { SharedPdfjsService, PdfPasswordError } from '../../core/services/shared-pdfjs.service';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { PdfToJpgConversionResult } from '@paperflow/contracts';

describe('PdfToJpgComponent Integration Tests', () => {
  let component: PdfToJpgComponent;
  let fixture: ComponentFixture<PdfToJpgComponent>;
  let pdfjsServiceMock: any;
  let pdfToJpgServiceMock: any;

  beforeEach(async () => {
    pdfjsServiceMock = {
      loadDocument: vi.fn().mockResolvedValue({
        numPages: 3,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 595, height: 842 }),
          render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
          cleanup: vi.fn()
        }),
        destroy: vi.fn()
      }),
      destroyDocument: vi.fn()
    };

    pdfToJpgServiceMock = {
      convert: vi.fn(),
      estimateJpgSize: vi.fn().mockResolvedValue({
        singlePageBytes: 85000,
        totalBytes: 255000,
        widthPx: 1240,
        heightPx: 1754,
        sampledCount: 3
      })
    };

    await TestBed.configureTestingModule({
      imports: [PdfToJpgComponent],
      providers: [
        provideRouter([]),
        { provide: SharedPdfjsService, useValue: pdfjsServiceMock },
        { provide: PdfToJpgService, useValue: pdfToJpgServiceMock },
        ToolRegistryService,
        SeoService,
        LayoutService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToJpgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createTestPdfFile(name: string, size = 1024, lastModified = 1000): File {
    const blob = new Blob(['%PDF-1.7 mock content'], { type: 'application/pdf' });
    const file = new File([blob], name, { type: 'application/pdf', lastModified });
    return file;
  }

  it('should initialize in "upload" state with default options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.mode()).toBe('convert_pages');
    expect(component.pagesMode()).toBe('all');
    expect(component.dpiPreset()).toBe(150);
    expect(component.qualityPreset()).toBe('high');
    expect(component.backgroundColor()).toBe('#FFFFFF');
    expect(component.arrangement()).toBe('separate');
    expect(component.includeAnnotations()).toBe(true);
    expect(component.embedDpi()).toBe(true);
    expect(component.grayscale()).toBe(false);
    expect(component.minSize()).toBe(100);
    expect(component.keepOriginalJpegs()).toBe(true);
    expect(component.skipDuplicates()).toBe(true);
  });

  it('should transition to "organize" state when a valid PDF file is uploaded', async () => {
    const file = createTestPdfFile('annual-report.pdf');
    component.onFilesSelected([file]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('annual-report.pdf');
  });

  it('should reject non-PDF files and set error message', () => {
    const invalidFile = new File(['mock content'], 'photo.png', { type: 'image/png' });
    component.onFilesSelected([invalidFile]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toContain('is not a PDF file');
  });

  it('should reject duplicate files with same name, size, and lastModified', () => {
    const file1 = createTestPdfFile('doc.pdf', 2048, 5000);
    component.onFilesSelected([file1]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);

    // Attempt to add identical file
    const file2 = createTestPdfFile('doc.pdf', 2048, 5000);
    component.onFilesSelected([file2]);
    fixture.detectChanges();

    expect(component.selectedFiles().length).toBe(1);
    expect(component.errorMessage()).toContain('has already been added');
  });

  it('should toggle conversion modes between convert_pages and extract_images', () => {
    expect(component.mode()).toBe('convert_pages');

    component.mode.set('extract_images');
    fixture.detectChanges();
    expect(component.mode()).toBe('extract_images');

    component.mode.set('convert_pages');
    fixture.detectChanges();
    expect(component.mode()).toBe('convert_pages');
  });

  it('should handle page selection utilities: selectAll, clear, invert', () => {
    // Simulate 4 pages
    component.selectedFiles.set([{
      id: 'f1',
      file: createTestPdfFile('doc.pdf'),
      name: 'doc.pdf',
      sizeBytes: 100,
      formattedSize: '100 B',
      pageCount: 4
    }]);
    component.selectedPageNumbers.set([1, 2, 3, 4]);

    // Clear all
    component.clearAllPages();
    expect(component.selectedPageNumbers().length).toBe(0);
    expect(component.pageRangeInput()).toBe('');

    // Select all
    component.selectAllPages();
    expect(component.selectedPageNumbers()).toEqual([1, 2, 3, 4]);
    expect(component.pageRangeInput()).toBe('1-4');

    // Invert: select page 1 only, then invert -> [2, 3, 4]
    component.selectedPageNumbers.set([1]);
    component.invertPageSelection();
    expect(component.selectedPageNumbers()).toEqual([2, 3, 4]);
  });

  it('should validate page range input correctly', () => {
    component.selectedFiles.set([{
      id: 'f1',
      file: createTestPdfFile('doc.pdf'),
      name: 'doc.pdf',
      sizeBytes: 100,
      formattedSize: '100 B',
      pageCount: 10
    }]);
    component.pagesMode.set('range');

    // Valid range
    component.pageRangeInput.set('1-3, 5, 8-10');
    expect(component.pageRangeError()).toBeNull();

    // Invalid range
    component.pageRangeInput.set('abc');
    expect(component.pageRangeError()).toContain('Invalid');

    // Empty range
    component.pageRangeInput.set('');
    expect(component.pageRangeError()).toContain('Please specify');
  });

  it('should open password modal on password-protected PDF and retry', async () => {
    pdfjsServiceMock.loadDocument.mockRejectedValueOnce(
      new PdfPasswordError('PASSWORD_REQUIRED', 'Document requires password')
    );

    const file = createTestPdfFile('encrypted.pdf');
    component.onFilesSelected([file]);
    await new Promise(r => setTimeout(r, 10));
    fixture.detectChanges();

    expect(component.isPasswordModalOpen()).toBe(true);

    // Cancel modal resets state
    component.cancelPasswordModal();
    expect(component.isPasswordModalOpen()).toBe(false);
  });

  it('should execute conversion and transition to completed state on success', async () => {
    const file = createTestPdfFile('contract.pdf');
    component.onFilesSelected([file]);
    fixture.detectChanges();

    const mockResult: PdfToJpgConversionResult = {
      jobId: 'job-test-1',
      inputFilename: 'contract.pdf',
      originalSizeBytes: 50000,
      mode: 'convert_pages',
      pages: [
        {
          pageNumber: 1,
          filename: 'contract-page-01.jpg',
          blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
          previewUrl: 'blob:mock-url-1',
          width: 1240,
          height: 1754,
          sizeBytes: 50000,
          dpi: 150
        }
      ],
      images: [],
      isSingleImage: true,
      singleImageBlob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
      singleImageFilename: 'contract-page-01.jpg',
      totalOutputSizeBytes: 50000,
      processingTimeMs: 450,
      warnings: []
    };

    pdfToJpgServiceMock.convert.mockResolvedValue(mockResult);

    await component.executeConversion();
    fixture.detectChanges();

    expect(component.currentState()).toBe('completed');
    expect(component.conversionResult()).toEqual(mockResult);
  });

  it('should allow cancelling ongoing conversion and reset abort controller', async () => {
    let abortSignalObserved = false;
    pdfToJpgServiceMock.convert.mockImplementation((_f: any, _name: any, _o: any, _cb: any, signal: AbortSignal) => {
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          abortSignalObserved = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const file = createTestPdfFile('large.pdf');
    component.onFilesSelected([file]);
    fixture.detectChanges();

    const conversionPromise = component.executeConversion();
    expect(component.currentState()).toBe('processing');

    component.cancelConversion();
    await conversionPromise;
    fixture.detectChanges();

    expect(abortSignalObserved).toBe(true);
    expect(component.currentState()).toBe('organize');
  });

  it('should handle gallery item selection on result screen', () => {
    const mockResult: PdfToJpgConversionResult = {
      jobId: 'job-test-2',
      inputFilename: 'doc.pdf',
      originalSizeBytes: 2000,
      mode: 'convert_pages',
      pages: [
        {
          pageNumber: 1,
          filename: 'doc-page-1.jpg',
          blob: new Blob([]),
          previewUrl: 'blob:1',
          width: 100,
          height: 100,
          sizeBytes: 1000,
          dpi: 150
        },
        {
          pageNumber: 2,
          filename: 'doc-page-2.jpg',
          blob: new Blob([]),
          previewUrl: 'blob:2',
          width: 100,
          height: 100,
          sizeBytes: 1000,
          dpi: 150
        }
      ],
      images: [],
      isSingleImage: false,
      zipFilename: 'doc-jpg.zip',
      totalOutputSizeBytes: 2000,
      processingTimeMs: 200,
      warnings: []
    };

    component.conversionResult.set(mockResult);
    component.selectedResultItemIds.set(new Set(['doc-page-1.jpg', 'doc-page-2.jpg']));
    fixture.detectChanges();
    expect(component.areAllItemsSelected()).toBe(true);

    // Toggle off item 1
    component.toggleResultItemSelection('doc-page-1.jpg');
    fixture.detectChanges();
    expect(component.selectedResultItemIds().has('doc-page-1.jpg')).toBe(false);
    expect(component.areAllItemsSelected()).toBe(false);

    // Select all
    component.toggleSelectAllResultItems();
    fixture.detectChanges();
    expect(component.selectedResultItemIds().size).toBe(2);
    expect(component.areAllItemsSelected()).toBe(true);

    // Deselect all
    component.toggleSelectAllResultItems();
    fixture.detectChanges();
    expect(component.selectedResultItemIds().size).toBe(0);
    expect(component.areAllItemsSelected()).toBe(false);
  });
});
