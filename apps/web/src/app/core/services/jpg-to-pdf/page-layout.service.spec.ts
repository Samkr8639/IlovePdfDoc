import { TestBed } from '@angular/core/testing';
import { PageLayoutService, MM_TO_PT } from './page-layout.service';
import { JpgToPdfImageItem, JpgToPdfOptions } from './jpg-to-pdf.models';

describe('PageLayoutService', () => {
  let service: PageLayoutService;

  const defaultOptions: JpgToPdfOptions = {
    orientation: 'auto',
    pageSize: 'same-as-image',
    customPageWidth: 210,
    customPageHeight: 297,
    customPageUnit: 'mm',
    margin: 'none',
    customMarginValue: 10,
    customMarginUnit: 'mm',
    fit: 'fit',
    alignment: 'center',
    quality: 'original',
    backgroundColor: '#ffffff',
    mergeAll: true,
    removeExif: true,
    addPageNumbers: false,
    fixExifRotation: true,
    pdfTitle: '',
    pdfAuthor: '',
    dpiFallback: 96
  };

  const sampleImageItem: JpgToPdfImageItem = {
    id: 'img-1',
    file: new File([], 'sample.jpg'),
    name: 'sample.jpg',
    sizeBytes: 150000,
    thumbnailUrl: 'blob:sample',
    probe: {
      isValid: true,
      format: 'jpeg',
      widthPx: 800,
      heightPx: 600,
      dpiX: 96,
      dpiY: 96,
      hasDpi: true,
      exifOrientation: 1,
      colorComponents: 3,
      megapixels: 0.48
    },
    manualRotationDeg: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PageLayoutService]
    });
    service = TestBed.inject(PageLayoutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should compute exact dimensions for "same-as-image" at 96 DPI with no margins', () => {
    // 800px / 96 * 72 = 600 pt
    // 600px / 96 * 72 = 450 pt
    const layout = service.computeLayout(sampleImageItem, defaultOptions);
    expect(layout.pageWidthPt).toBeCloseTo(600, 1);
    expect(layout.pageHeightPt).toBeCloseTo(450, 1);
    expect(layout.isLandscape).toBe(true);
    expect(layout.drawWidthPt).toBeCloseTo(600, 1);
    expect(layout.drawHeightPt).toBeCloseTo(450, 1);
    expect(layout.drawXPt).toBeCloseTo(0, 1);
    expect(layout.drawYPt).toBeCloseTo(0, 1);
    expect(layout.isClipped).toBe(false);
  });

  it('should expand page dimensions when margin is applied to "same-as-image"', () => {
    const optsWithMargin: JpgToPdfOptions = {
      ...defaultOptions,
      margin: 'small' // 10mm ≈ 28.35 pt
    };
    const layout = service.computeLayout(sampleImageItem, optsWithMargin);
    const expectedMargin = 10 * MM_TO_PT;
    expect(layout.pageWidthPt).toBeCloseTo(600 + expectedMargin * 2, 1);
    expect(layout.pageHeightPt).toBeCloseTo(450 + expectedMargin * 2, 1);
    expect(layout.marginLeftPt).toBeCloseTo(expectedMargin, 1);
    expect(layout.drawWidthPt).toBeCloseTo(600, 1);
    expect(layout.drawHeightPt).toBeCloseTo(450, 1);
  });

  it('should correctly layout A4 page with portrait orientation', () => {
    const a4Options: JpgToPdfOptions = {
      ...defaultOptions,
      pageSize: 'a4',
      orientation: 'portrait',
      margin: 'none',
      fit: 'fit'
    };
    const layout = service.computeLayout(sampleImageItem, a4Options);
    // A4 portrait: 595.28 x 841.89 pt
    expect(layout.pageWidthPt).toBeCloseTo(595.28, 0.5);
    expect(layout.pageHeightPt).toBeCloseTo(841.89, 0.5);
    expect(layout.isLandscape).toBe(false);

    // Image aspect is 800/600 = 4/3. Fits width (595.28), height = 595.28 / (4/3) = 446.46
    expect(layout.drawWidthPt).toBeCloseTo(595.28, 0.5);
    expect(layout.drawHeightPt).toBeCloseTo(446.46, 0.5);
    // Vertically centered in A4 page
    const expectedY = (841.89 - 446.46) / 2;
    expect(layout.drawYPt).toBeCloseTo(expectedY, 0.5);
  });

  it('should align image to top when alignment is set to "top"', () => {
    const topOptions: JpgToPdfOptions = {
      ...defaultOptions,
      pageSize: 'a4',
      orientation: 'portrait',
      margin: 'small',
      alignment: 'top',
      fit: 'fit'
    };
    const layout = service.computeLayout(sampleImageItem, topOptions);
    // Top of image should match pageHeight - marginTop
    const imageTopY = layout.drawYPt + layout.drawHeightPt;
    expect(imageTopY).toBeCloseTo(layout.pageHeightPt - layout.marginTopPt, 0.5);
  });

  it('should mark fill mode with clipping boundaries', () => {
    const fillOptions: JpgToPdfOptions = {
      ...defaultOptions,
      pageSize: 'a4',
      orientation: 'portrait',
      margin: 'none',
      fit: 'fill'
    };
    const layout = service.computeLayout(sampleImageItem, fillOptions);
    expect(layout.isClipped).toBe(true);
    expect(layout.clipWidthPt).toBeCloseTo(layout.pageWidthPt, 0.5);
    expect(layout.clipHeightPt).toBeCloseTo(layout.pageHeightPt, 0.5);
    // Height should be filled completely
    expect(layout.drawHeightPt).toBeCloseTo(layout.pageHeightPt, 0.5);
    // Width should exceed page width (cropped on sides)
    expect(layout.drawWidthPt).toBeGreaterThan(layout.pageWidthPt);
  });

  it('should clamp huge custom dimensions to PDF 14,400 pt limit', () => {
    const hugeOptions: JpgToPdfOptions = {
      ...defaultOptions,
      pageSize: 'custom',
      customPageWidth: 6000, // 6000 mm ≈ 17,007 pt (> 14400 pt)
      customPageHeight: 6000,
      customPageUnit: 'mm'
    };
    const layout = service.computeLayout(sampleImageItem, hugeOptions);
    expect(layout.clampedDueToPdfLimit).toBe(true);
    expect(layout.pageWidthPt).toBeLessThanOrEqual(14400);
    expect(layout.pageHeightPt).toBeLessThanOrEqual(14400);
  });

  it('should generate mini preview styles matching layout', () => {
    const layout = service.computeLayout(sampleImageItem, defaultOptions);
    const preview = service.computeMiniPreviewStyle(layout, defaultOptions);
    expect(preview.pageContainer.aspectRatio).toBe(`${layout.pageWidthPt} / ${layout.pageHeightPt}`);
    expect(preview.imageWrapper.left).toBe('0%');
    expect(preview.imageWrapper.top).toBe('0%');
    expect(preview.imageWrapper.width).toBe('100%');
  });

  it('should estimate output size for various quality levels', () => {
    const origSize = service.estimateTotalSize([sampleImageItem], { ...defaultOptions, quality: 'original' });
    const optSize = service.estimateTotalSize([sampleImageItem], { ...defaultOptions, quality: 'optimised' });
    const smallSize = service.estimateTotalSize([sampleImageItem], { ...defaultOptions, quality: 'small' });

    expect(origSize).toBeGreaterThan(optSize);
    expect(optSize).toBeGreaterThan(smallSize);
    expect(service.formatEstimatedSize(origSize)).toContain('≈');
  });
});

