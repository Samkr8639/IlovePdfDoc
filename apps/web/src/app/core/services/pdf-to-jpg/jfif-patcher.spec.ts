import { describe, it, expect } from 'vitest';
import { isValidJpeg, readJpegDpi, embedJpegDpi } from './jfif-patcher';

describe('jfif-patcher', () => {
  // Minimal dummy JPEG: SOI (FF D8) + SOS (FF DA 00 08 01 01 00 00) + EOI (FF D9)
  const dummyRawJpeg = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
    0xff, 0xd9
  ]);

  it('validates JPEG SOI and EOI markers', () => {
    expect(isValidJpeg(dummyRawJpeg)).toBe(true);
    expect(isValidJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isValidJpeg(new Uint8Array([0xff, 0xd8, 0x00]))).toBe(false); // truncated
  });

  it('inserts JFIF APP0 header when missing and sets DPI correctly', () => {
    const patched = embedJpegDpi(dummyRawJpeg, 300);
    expect(isValidJpeg(patched)).toBe(true);
    expect(patched.length).toBe(dummyRawJpeg.length + 18);

    const dpiInfo = readJpegDpi(patched);
    expect(dpiInfo).not.toBeNull();
    expect(dpiInfo?.units).toBe(1); // 1 = dots per inch
    expect(dpiInfo?.xDensity).toBe(300);
    expect(dpiInfo?.yDensity).toBe(300);
  });

  it('patches existing JFIF APP0 header in place', () => {
    // First insert 150 DPI
    const firstPass = embedJpegDpi(dummyRawJpeg, 150);
    const info1 = readJpegDpi(firstPass);
    expect(info1?.xDensity).toBe(150);

    // Now re-embed 600 DPI
    const secondPass = embedJpegDpi(firstPass, 600);
    expect(secondPass.length).toBe(firstPass.length); // no bloat!
    const info2 = readJpegDpi(secondPass);
    expect(info2?.xDensity).toBe(600);
    expect(info2?.yDensity).toBe(600);
  });
});
