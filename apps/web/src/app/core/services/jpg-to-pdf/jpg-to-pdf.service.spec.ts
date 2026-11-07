import { TestBed } from '@angular/core/testing';
import { JpgToPdfService } from './jpg-to-pdf.service';
import { PageLayoutService } from './page-layout.service';
import { JpgToPdfImageItem, JpgToPdfOptions } from './jpg-to-pdf.models';
import { PDFDocument } from 'pdf-lib';

describe('JpgToPdfService', () => {
  let service: JpgToPdfService;

  // A tiny valid 1x1 baseline JPEG
  const tinyJpegBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07,
    0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
    0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c,
    0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d,
    0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01,
    0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf,
    0x00, 0xff, 0xd9
  ]);

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
    pdfTitle: 'My Test PDF',
    pdfAuthor: 'Test Author',
    dpiFallback: 96
  };

  function createTestItem(id: string, name: string): JpgToPdfImageItem {
    return {
      id,
      file: new File([tinyJpegBytes], name, { type: 'image/jpeg' }),
      name,
      sizeBytes: tinyJpegBytes.length,
      thumbnailUrl: 'blob:mock',
      probe: {
        isValid: true,
        format: 'jpeg',
        widthPx: 10,
        heightPx: 10,
        dpiX: 96,
        dpiY: 96,
        hasDpi: true,
        exifOrientation: 1,
        colorComponents: 1,
        megapixels: 0.0001
      },
      manualRotationDeg: 0
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [JpgToPdfService, PageLayoutService]
    });
    service = TestBed.inject(JpgToPdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reject empty image list', async () => {
    await expect(service.buildPdf([], defaultOptions)).rejects.toThrow(/No images provided/);
  });

  it('should abort cleanly when AbortSignal is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const item = createTestItem('1', 'sample.jpg');
    await expect(
      service.buildPdf([item], defaultOptions, undefined, controller.signal)
    ).rejects.toThrow(/aborted/);
  });

  it('should build a single valid PDF document from JPEG image', async () => {
    const item = createTestItem('1', 'landscape-photo.jpg');
    const result = await service.buildPdf([item], defaultOptions);

    expect(result.isZip).toBe(false);
    expect(result.pageCount).toBe(1);
    expect(result.downloadFilename).toBe('landscape-photo.pdf');
    expect(result.blob.type).toBe('application/pdf');
    expect(result.blob.size).toBeGreaterThan(100);

    // Verify it loads with pdf-lib and check metadata
    const parsedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(parsedPdf.getPageCount()).toBe(1);
    expect(parsedPdf.getTitle()).toBe('My Test PDF');
    expect(parsedPdf.getAuthor()).toBe('Test Author');
    expect(parsedPdf.getCreator()).toBe('PDFTailor');
  });

  it('should merge multiple images into one multi-page PDF', async () => {
    const items = [
      createTestItem('1', 'page-1.jpg'),
      createTestItem('2', 'page-2.jpg'),
      createTestItem('3', 'page-3.jpg')
    ];
    const optsWithPageNumbers: JpgToPdfOptions = {
      ...defaultOptions,
      addPageNumbers: true
    };
    const result = await service.buildPdf(items, optsWithPageNumbers);

    expect(result.isZip).toBe(false);
    expect(result.pageCount).toBe(3);

    const parsedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(parsedPdf.getPageCount()).toBe(3);
  });

  it('should output a ZIP containing individual PDFs when mergeAll is false', async () => {
    const items = [
      createTestItem('1', 'doc.jpg'),
      createTestItem('2', 'doc.jpg') // duplicate name to test disambiguation
    ];
    const unmergedOptions: JpgToPdfOptions = {
      ...defaultOptions,
      mergeAll: false
    };
    const result = await service.buildPdf(items, unmergedOptions);

    expect(result.isZip).toBe(true);
    expect(result.pageCount).toBe(2);
    expect(result.downloadFilename).toBe('images.zip');
    expect(result.blob.type).toBe('application/zip');
    expect(result.blob.size).toBeGreaterThan(100);
  });
});
