import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JpgToPdfComponent } from './jpg-to-pdf.component';
import { ToolRegistryService } from '../../core/services/tool-registry.service';
import { SeoService } from '../../core/services/seo.service';
import { LayoutService } from '../../core/services/layout.service';
import { ImageProbeService } from '../../core/services/jpg-to-pdf/image-probe.service';
import { PageLayoutService } from '../../core/services/jpg-to-pdf/page-layout.service';
import { JpgToPdfService } from '../../core/services/jpg-to-pdf/jpg-to-pdf.service';
import { JpgToPdfBuildResult, ImageProbeResult } from '../../core/services/jpg-to-pdf/jpg-to-pdf.models';

describe('JpgToPdfComponent Unit Tests', () => {
  let component: JpgToPdfComponent;
  let fixture: ComponentFixture<JpgToPdfComponent>;
  let imageProbeServiceMock: any;
  let pageLayoutServiceMock: any;
  let jpgToPdfServiceMock: any;
  let layoutServiceMock: any;

  const validProbeResult: ImageProbeResult = {
    isValid: true,
    format: 'jpeg',
    mimeType: 'image/jpeg',
    widthPx: 800,
    heightPx: 600,
    dpiX: 96,
    dpiY: 96,
    hasDpi: true,
    exifOrientation: 1,
    colorComponents: 3,
    megapixels: 0.48
  };

  beforeEach(async () => {
    // Preserve URL constructor and only stub createObjectURL / revokeObjectURL
    if (typeof URL.createObjectURL !== 'function') {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:mock-thumbnail-url');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-thumbnail-url');
    }

    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as any).revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    imageProbeServiceMock = {
      probeImage: vi.fn().mockResolvedValue(validProbeResult)
    };

    pageLayoutServiceMock = {
      computeLayout: vi.fn().mockReturnValue({
        pageWidthPt: 595.28,
        pageHeightPt: 841.89,
        isLandscape: false,
        marginLeftPt: 0,
        marginRightPt: 0,
        marginTopPt: 0,
        marginBottomPt: 0,
        contentBoxWidthPt: 595.28,
        contentBoxHeightPt: 841.89,
        drawXPt: 0,
        drawYPt: 0,
        drawWidthPt: 595.28,
        drawHeightPt: 446.46,
        isClipped: false,
        effectiveRotationDeg: 0,
        needsHorizontalFlip: false,
        clampedDueToPdfLimit: false
      }),
      computeMiniPreviewStyle: vi.fn().mockReturnValue({
        pageContainer: {
          width: '96px',
          height: '136px',
          aspectRatio: '1 / 1.414',
          backgroundColor: '#ffffff'
        },
        marginBox: {
          top: '0%',
          right: '0%',
          bottom: '0%',
          left: '0%'
        },
        imageWrapper: {
          position: 'absolute',
          left: '0%',
          top: '0%',
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        },
        imageElement: {
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          transform: 'none'
        }
      }),
      estimateTotalSize: vi.fn().mockReturnValue(125000),
      formatEstimatedSize: vi.fn().mockReturnValue('≈ 122 KB')
    };

    jpgToPdfServiceMock = {
      buildPdf: vi.fn()
    };

    layoutServiceMock = {
      hideFooter: vi.fn(),
      showFooter: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [JpgToPdfComponent],
      providers: [
        provideRouter([]),
        { provide: ImageProbeService, useValue: imageProbeServiceMock },
        { provide: PageLayoutService, useValue: pageLayoutServiceMock },
        { provide: JpgToPdfService, useValue: jpgToPdfServiceMock },
        { provide: LayoutService, useValue: layoutServiceMock },
        ToolRegistryService,
        SeoService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JpgToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockImageFile(name: string, size = 50000, type = 'image/jpeg'): File {
    const bytes = new Uint8Array(size);
    if (size >= 4) {
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      bytes[3] = 0xe0;
    }
    return new File([bytes], name, { type });
  }

  it('should initialize in "upload" state with default options', () => {
    expect(component.currentState()).toBe('upload');
    expect(component.selectedFiles().length).toBe(0);
    expect(component.totalFilesCount()).toBe(0);
    expect(component.options().orientation).toBe('auto');
    expect(component.options().pageSize).toBe('same-as-image');
    expect(component.options().margin).toBe('none');
    expect(component.options().fit).toBe('fit');
    expect(component.options().quality).toBe('original');
    expect(component.options().mergeAll).toBe(true);
    expect(component.options().removeExif).toBe(true);
  });

  it('should transition to "organize" state when valid images are added', async () => {
    const file1 = createMockImageFile('test1.jpg', 10000);
    const file2 = createMockImageFile('test2.jpg', 20000);

    await component.onFilesAdded([file1, file2]);
    fixture.detectChanges();

    expect(component.currentState()).toBe('organize');
    expect(component.selectedFiles().length).toBe(2);
    expect(component.totalFilesCount()).toBe(2);
    expect(component.totalSizeBytes()).toBe(30000);
    expect(layoutServiceMock.hideFooter).toHaveBeenCalled();
  });

  it('should skip duplicate files and log warnings', async () => {
    const file1 = createMockImageFile('test1.jpg', 10000);
    await component.onFilesAdded([file1]);

    // Try adding the same file again
    const fileDuplicate = createMockImageFile('test1.jpg', 10000);
    await component.onFilesAdded([fileDuplicate]);

    expect(component.selectedFiles().length).toBe(1);
    expect(component.warnings().length).toBe(1);
    expect(component.warnings()[0]).toContain('already added and was skipped');
  });

  it('should reject invalid images that fail probe', async () => {
    imageProbeServiceMock.probeImage.mockResolvedValueOnce({
      isValid: false,
      error: 'Unrecognized image format',
      widthPx: 0,
      heightPx: 0,
      dpiX: 0,
      dpiY: 0,
      hasDpi: false,
      exifOrientation: 1,
      megapixels: 0
    });

    const badFile = createMockImageFile('corrupt.jpg', 5000);
    await component.onFilesAdded([badFile]);

    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toContain('Unrecognized image format');
  });

  it('should reject GIF and SVG files with clear error message', async () => {
    const gifFile = new File(['GIF89a...'], 'animation.gif', { type: 'image/gif' });
    const svgFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });

    await component.onFilesAdded([gifFile]);
    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toBe('GIF and SVG formats are not supported. Please select JPG, PNG, WebP, or BMP images.');

    await component.onFilesAdded([svgFile]);
    expect(component.selectedFiles().length).toBe(0);
    expect(component.errorMessage()).toBe('GIF and SVG formats are not supported. Please select JPG, PNG, WebP, or BMP images.');
  });

  it('should reorder files with move left and move right', async () => {
    const fileA = createMockImageFile('a.jpg', 1000);
    const fileB = createMockImageFile('b.jpg', 2000);
    const fileC = createMockImageFile('c.jpg', 3000);

    await component.onFilesAdded([fileA, fileB, fileC]);

    // Move middle item (B) to left
    component.onMoveLeft(1);
    expect(component.selectedFiles().map(f => f.name)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);

    // Moving index 0 to left should be a no-op
    component.onMoveLeft(0);
    expect(component.selectedFiles().map(f => f.name)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);

    // Move item at 0 to right
    component.onMoveRight(0);
    expect(component.selectedFiles().map(f => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);

    // Moving last item to right should be a no-op
    component.onMoveRight(2);
    expect(component.selectedFiles().map(f => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('should reorder files via drag and drop', async () => {
    const fileA = createMockImageFile('a.jpg', 1000);
    const fileB = createMockImageFile('b.jpg', 2000);
    const fileC = createMockImageFile('c.jpg', 3000);

    await component.onFilesAdded([fileA, fileB, fileC]);

    component.onDragStart(0);
    const mockDropEvent = { preventDefault: vi.fn() } as unknown as DragEvent;
    component.onDropCard(mockDropEvent, 2);

    expect(component.selectedFiles().map(f => f.name)).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
  });

  it('should rotate individual cards and normalize angles', async () => {
    const file = createMockImageFile('photo.jpg', 5000);
    await component.onFilesAdded([file]);

    expect(component.selectedFiles()[0].manualRotationDeg).toBe(0);

    component.onRotateCard(0, 90);
    expect(component.selectedFiles()[0].manualRotationDeg).toBe(90);

    component.onRotateCard(0, -90);
    expect(component.selectedFiles()[0].manualRotationDeg).toBe(0);

    component.onRotateCard(0, -90);
    expect(component.selectedFiles()[0].manualRotationDeg).toBe(270);
  });

  it('should remove a card and reset workspace when empty', async () => {
    const fileA = createMockImageFile('a.jpg', 1000);
    const fileB = createMockImageFile('b.jpg', 2000);
    await component.onFilesAdded([fileA, fileB]);

    component.onRemoveCard(0);
    expect(component.selectedFiles().length).toBe(1);
    expect(component.selectedFiles()[0].name).toBe('b.jpg');

    component.onRemoveCard(0);
    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
    expect(layoutServiceMock.showFooter).toHaveBeenCalled();
  });

  it('should support toolbar actions: sort, reverse, rotateAll, clearAll', async () => {
    const file1 = createMockImageFile('charlie.jpg', 1000);
    const file2 = createMockImageFile('alpha.jpg', 2000);
    const file3 = createMockImageFile('bravo.jpg', 3000);

    await component.onFilesAdded([file1, file2, file3]);

    // Sort A-Z
    component.sortByName('asc');
    expect(component.selectedFiles().map(f => f.name)).toEqual(['alpha.jpg', 'bravo.jpg', 'charlie.jpg']);

    // Sort Z-A
    component.sortByName('desc');
    expect(component.selectedFiles().map(f => f.name)).toEqual(['charlie.jpg', 'bravo.jpg', 'alpha.jpg']);

    // Reverse
    component.reverseOrder();
    expect(component.selectedFiles().map(f => f.name)).toEqual(['alpha.jpg', 'bravo.jpg', 'charlie.jpg']);

    // Rotate all
    component.rotateAll(90);
    expect(component.selectedFiles().every(f => f.manualRotationDeg === 90)).toBe(true);

    // Clear all
    component.clearAll();
    expect(component.selectedFiles().length).toBe(0);
    expect(component.currentState()).toBe('upload');
  });

  it('should update sidebar options properly', () => {
    // Switching directly from same-as-image to Landscape upgrades pageSize to A4
    component.setOrientation('landscape');
    expect(component.options().pageSize).toBe('a4');
    expect(component.options().orientation).toBe('landscape');

    // Setting page size back to same-as-image resets orientation to auto
    component.setPageSize('same-as-image');
    expect(component.options().pageSize).toBe('same-as-image');
    expect(component.options().orientation).toBe('auto');

    // Change page size to A4 and orientation to portrait
    component.setPageSize('a4');
    component.setOrientation('portrait');
    expect(component.options().pageSize).toBe('a4');
    expect(component.options().orientation).toBe('portrait');

    component.setMargin('small');
    expect(component.options().margin).toBe('small');

    component.setFit('fill');
    expect(component.options().fit).toBe('fill');

    component.setAlignment('top');
    expect(component.options().alignment).toBe('top');

    component.setQuality('optimised');
    expect(component.options().quality).toBe('optimised');
  });

  it('should execute conversion successfully and transition to completed', async () => {
    const file = createMockImageFile('document.jpg', 50000);
    await component.onFilesAdded([file]);

    const mockResult: JpgToPdfBuildResult = {
      blob: new Blob(['%PDF-1.7 mock output'], { type: 'application/pdf' }),
      downloadFilename: 'document.pdf',
      isZip: false,
      pageCount: 1,
      outputSizeBytes: 125000,
      durationMs: 450,
      warnings: []
    };

    jpgToPdfServiceMock.buildPdf.mockImplementation(async (items: any, opts: any, onProgress?: any) => {
      onProgress?.({ percent: 50, message: 'Processing image 1...' });
      onProgress?.({ percent: 100, message: 'Done!' });
      return mockResult;
    });

    const convertPromise = component.executeConvert();
    expect(component.currentState()).toBe('processing');
    expect(component.isProcessing()).toBe(true);

    await convertPromise;

    expect(component.currentState()).toBe('completed');
    expect(component.isProcessing()).toBe(false);
    expect(component.buildResult()).toBe(mockResult);
    expect(component.resultViewData()).toEqual({
      blob: mockResult.blob,
      url: 'blob:mock-thumbnail-url',
      filename: 'document.pdf',
      pageCount: 1,
      sizeBytes: 125000,
      formattedSize: '122.1 KB',
      previewUrl: 'blob:mock-thumbnail-url'
    });
    expect(layoutServiceMock.showFooter).toHaveBeenCalled();
  });

  it('should handle conversion cancellation gracefully', async () => {
    const file = createMockImageFile('doc.jpg', 50000);
    await component.onFilesAdded([file]);

    jpgToPdfServiceMock.buildPdf.mockImplementation(async (items: any, opts: any, onProgress?: any, signal?: AbortSignal) => {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    const convertPromise = component.executeConvert();
    component.cancelProcessing();

    await convertPromise;

    expect(component.currentState()).toBe('organize');
    expect(component.errorMessage()).toContain('cancelled');
    expect(component.isProcessing()).toBe(false);
  });

  it('should format bytes correctly', () => {
    expect(component.formatBytes(500)).toBe('500 B');
    expect(component.formatBytes(1536)).toBe('1.5 KB');
    expect(component.formatBytes(2097152)).toBe('2.0 MB');
  });

  it('should toggle and close mobile side panel', () => {
    expect(component.isSidePanelOpen()).toBe(false);
    component.toggleSidePanel();
    expect(component.isSidePanelOpen()).toBe(true);
    component.closeSidePanel();
    expect(component.isSidePanelOpen()).toBe(false);
  });
});
