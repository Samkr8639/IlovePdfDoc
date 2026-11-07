import { TestBed } from '@angular/core/testing';
import { ImageProbeService } from './image-probe.service';

describe('ImageProbeService', () => {
  let service: ImageProbeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImageProbeService]
    });
    service = TestBed.inject(ImageProbeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reject empty files', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const res = await service.probeImage(emptyFile);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('empty');
  });

  it('should reject files exceeding 50MB', async () => {
    const mockBigFile = {
      size: 51 * 1024 * 1024,
      name: 'large.jpg',
      slice: () => new Blob([])
    } as unknown as File;
    const res = await service.probeImage(mockBigFile);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('50 MB limit');
  });

  it('should reject SVG files', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
    const file = new File([svgContent], 'test.svg', { type: 'image/svg+xml' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('SVG is not supported');
  });

  it('should reject TIFF files with clear conversion message', async () => {
    // Little-endian TIFF header: II\x2a\x00
    const tiffHeader = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
    const file = new File([tiffHeader], 'photo.tiff', { type: 'image/tiff' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('convert HEIC/TIFF to JPG first');
  });

  it('should reject HEIC files with clear conversion message', async () => {
    // ftyp heic
    const heicHeader = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ...ftyp
      0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00
    ]);
    const file = new File([heicHeader], 'photo.heic', { type: 'image/heic' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('convert HEIC/TIFF to JPG first');
  });

  it('should reject PDF or ZIP files disguised as images', async () => {
    const pdfHeader = new TextEncoder().encode('%PDF-1.4 dummy content');
    const file = new File([pdfHeader], 'fake.jpg', { type: 'image/jpeg' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Renamed document or archive detected');
  });

  it('should successfully parse valid minimal PNG and detect dimensions', async () => {
    // Minimal PNG header + IHDR chunk (10x20, 8-bit RGB, non-interlaced)
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR length (13)
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x0a, // width: 10
      0x00, 0x00, 0x00, 0x14, // height: 20
      0x08, 0x02, 0x00, 0x00, 0x00, // 8-bit truecolor
      0x00, 0x00, 0x00, 0x00 // CRC dummy
    ]);
    const file = new File([png], 'test.png', { type: 'image/png' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(true);
    expect(res.format).toBe('png');
    expect(res.widthPx).toBe(10);
    expect(res.heightPx).toBe(20);
    expect(res.dpiX).toBe(96); // default fallback when no pHYs
  });

  it('should successfully parse valid minimal JPEG with SOF0', async () => {
    // JPEG SOI (FF D8) + SOF0 (FF C0 00 11 08 00 1E 00 28 03 ...) + EOI (FF D9)
    const jpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xc0, // SOF0
      0x00, 0x11, // length 17
      0x08,       // precision 8
      0x00, 0x1e, // height: 30
      0x00, 0x28, // width: 40
      0x03,       // components: 3 (YCbCr)
      0x01, 0x11, 0x00,
      0x02, 0x11, 0x01,
      0x03, 0x11, 0x01,
      0xff, 0xd9  // EOI
    ]);
    const file = new File([jpeg], 'test.jpg', { type: 'image/jpeg' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(true);
    expect(res.format).toBe('jpeg');
    expect(res.widthPx).toBe(40);
    expect(res.heightPx).toBe(30);
    expect(res.colorComponents).toBe(3);
  });

  it('should detect decompression bomb exceeding 200 Megapixels', async () => {
    // Construct JPEG with 20000 x 15000 = 300 MP
    const bombJpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0,
      0x00, 0x11,
      0x08,
      0x3a, 0x98, // height: 15000
      0x4e, 0x20, // width: 20000
      0x03,
      0x01, 0x11, 0x00,
      0x02, 0x11, 0x01,
      0x03, 0x11, 0x01,
      0xff, 0xd9
    ]);
    const file = new File([bombJpeg], 'bomb.jpg', { type: 'image/jpeg' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('exceeds the 200 megapixel limit');
  });

  it('should parse BMP headers', async () => {
    // BM signature + DIB header (width 50, height 60)
    const bmp = new Uint8Array(54);
    bmp[0] = 0x42; // 'B'
    bmp[1] = 0x4d; // 'M'
    const view = new DataView(bmp.buffer);
    view.setUint32(14, 40, true); // DIB header size
    view.setInt32(18, 50, true);  // width: 50
    view.setInt32(22, 60, true);  // height: 60
    view.setUint16(26, 1, true);  // planes
    view.setUint16(28, 24, true); // bpp 24

    const file = new File([bmp], 'test.bmp', { type: 'image/bmp' });
    const res = await service.probeImage(file);
    expect(res.isValid).toBe(true);
    expect(res.format).toBe('bmp');
    expect(res.widthPx).toBe(50);
    expect(res.heightPx).toBe(60);
  });
});
