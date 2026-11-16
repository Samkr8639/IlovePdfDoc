import { describe, it, expect, beforeEach } from 'vitest';
import { WatermarkImageService } from './watermark-image.service';

describe('WatermarkImageService', () => {
  let service: WatermarkImageService;

  beforeEach(() => {
    service = new WatermarkImageService();
  });

  describe('parseImageHeader', () => {
    it('parses valid PNG headers accurately', () => {
      const bytes = new Uint8Array(32);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // PNG signature
      bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
      const view = new DataView(bytes.buffer);
      view.setUint32(16, 1920, false);
      view.setUint32(20, 1080, false);

      const header = service.parseImageHeader(bytes);
      expect(header).not.toBeNull();
      expect(header?.format).toBe('png');
      expect(header?.width).toBe(1920);
      expect(header?.height).toBe(1080);
    });

    it('parses valid JPEG SOF0 headers accurately', () => {
      const bytes = new Uint8Array(64);
      bytes[0] = 0xff;
      bytes[1] = 0xd8; // SOI
      bytes[2] = 0xff;
      bytes[3] = 0xe0; // APP0
      const view = new DataView(bytes.buffer);
      view.setUint16(4, 16, false); // len = 16 (covers 4..19)
      bytes[20] = 0xff;
      bytes[21] = 0xc0; // SOF0
      view.setUint16(22, 17, false); // len
      bytes[24] = 8; // precision
      view.setUint16(25, 600, false); // height
      view.setUint16(27, 800, false); // width

      const header = service.parseImageHeader(bytes);
      expect(header).not.toBeNull();
      expect(header?.format).toBe('jpeg');
      expect(header?.width).toBe(800);
      expect(header?.height).toBe(600);
    });

    it('parses valid WebP VP8X headers accurately', () => {
      const bytes = new Uint8Array(32);
      bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
      const view = new DataView(bytes.buffer);
      view.setUint32(4, 24, true);
      bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
      bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
      view.setUint32(16, 10, true);
      // width = 1200 -> 1199 (0x04AF)
      bytes[24] = 0xaf;
      bytes[25] = 0x04;
      bytes[26] = 0x00;
      // height = 800 -> 799 (0x031F)
      bytes[27] = 0x1f;
      bytes[28] = 0x03;
      bytes[29] = 0x00;

      const header = service.parseImageHeader(bytes);
      expect(header).not.toBeNull();
      expect(header?.format).toBe('webp');
      expect(header?.width).toBe(1200);
      expect(header?.height).toBe(800);
    });

    it('parses valid GIF headers accurately', () => {
      const bytes = new Uint8Array(16);
      bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // GIF89a
      const view = new DataView(bytes.buffer);
      view.setUint16(6, 400, true);
      view.setUint16(8, 300, true);

      const header = service.parseImageHeader(bytes);
      expect(header).not.toBeNull();
      expect(header?.format).toBe('gif');
      expect(header?.width).toBe(400);
      expect(header?.height).toBe(300);
    });
  });

  describe('validateImageHeader', () => {
    it('rejects SVG images due to script execution risk', async () => {
      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>';
      const fakeFile = {
        name: 'test.svg',
        size: svgText.length,
        arrayBuffer: async () => new TextEncoder().encode(svgText).buffer
      };

      const res = await service.validateImageHeader(fakeFile as any);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('SVG images are not allowed');
    });

    it('rejects files exceeding 10 MB limit', async () => {
      const fakeFile = {
        name: 'huge.png',
        size: 11 * 1024 * 1024,
        arrayBuffer: async () => new ArrayBuffer(0)
      };

      const res = await service.validateImageHeader(fakeFile as any);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('10 MB maximum size limit');
    });

    it('rejects images exceeding 5000 px per side before decoding', async () => {
      const bytes = new Uint8Array(32);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      bytes.set([0x49, 0x48, 0x44, 0x52], 12);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, 5001, false); // exceeds 5000 px
      view.setUint32(20, 1000, false);

      const fakeFile = {
        name: 'oversized.png',
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer
      };

      const res = await service.validateImageHeader(fakeFile as any);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('5000 px per side');
    });

    it('rejects images exceeding 25 megapixels before decoding', async () => {
      const bytes = new Uint8Array(32);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      bytes.set([0x49, 0x48, 0x44, 0x52], 12);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, 4900, false);
      view.setUint32(20, 4900, false); // 24.01 MP is ok, but 4900x5200 is > 25MP

      view.setUint32(16, 5000, false);
      view.setUint32(20, 5001, false);

      const fakeFile = {
        name: 'huge-res.png',
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer
      };

      const res = await service.validateImageHeader(fakeFile as any);
      expect(res.valid).toBe(false);
    });

    it('rejects tiny file declaring huge dimensions (decompression bomb protection)', async () => {
      const bytes = new Uint8Array(32);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      bytes.set([0x49, 0x48, 0x44, 0x52], 12);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, 4000, false);
      view.setUint32(20, 4000, false);

      const fakeFile = {
        name: 'bomb.png',
        size: 32, // only 32 bytes declaring 16 million pixels
        arrayBuffer: async () => bytes.buffer
      };

      const res = await service.validateImageHeader(fakeFile as any);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('inconsistent with file size');
    });
  });

  describe('stripNearWhiteBackground', () => {
    it('sets alpha to 0 for pure white pixels and preserves non-white pixels', () => {
      // 2x1 ImageData: pixel 0 is pure white, pixel 1 is pure red
      const rawData = new Uint8ClampedArray([
        255, 255, 255, 255, // white
        255, 0, 0, 255       // red
      ]);

      const imgData = {
        data: rawData,
        width: 2,
        height: 1
      } as unknown as ImageData;

      service.stripNearWhiteBackground(imgData, 20);

      // Pixel 0 (white) should have alpha reduced or zeroed
      expect(rawData[3]).toBe(0);

      // Pixel 1 (red) should remain untouched
      expect(rawData[4]).toBe(255);
      expect(rawData[5]).toBe(0);
      expect(rawData[6]).toBe(0);
      expect(rawData[7]).toBe(255);
    });
  });
});
