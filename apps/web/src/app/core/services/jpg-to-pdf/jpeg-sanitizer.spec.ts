import { JpegSanitizer } from './jpeg-sanitizer';

describe('JpegSanitizer', () => {
  function createJpegWithSegments(segments: { marker: number; data: Uint8Array }[]): Uint8Array {
    let totalLen = 2; // SOI
    for (const seg of segments) {
      if (seg.marker === 0xd9) {
        totalLen += 2;
      } else {
        totalLen += 4 + seg.data.length; // FF marker + length(2) + data
      }
    }

    const res = new Uint8Array(totalLen);
    res[0] = 0xff;
    res[1] = 0xd8; // SOI
    let offset = 2;

    for (const seg of segments) {
      if (seg.marker === 0xd9) {
        res[offset++] = 0xff;
        res[offset++] = 0xd9;
        continue;
      }
      res[offset++] = 0xff;
      res[offset++] = seg.marker;
      const segLen = seg.data.length + 2;
      res[offset++] = (segLen >> 8) & 0xff;
      res[offset++] = segLen & 0xff;
      res.set(seg.data, offset);
      offset += seg.data.length;
    }
    return res;
  }

  it('should preserve JPEG without metadata without modifications', () => {
    // SOI + APP0 (JFIF) + SOF0 + EOI
    const jfifData = new Uint8Array([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
    const sofData = new Uint8Array([0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]);
    const jpeg = createJpegWithSegments([
      { marker: 0xe0, data: jfifData }, // APP0
      { marker: 0xc0, data: sofData },  // SOF0
      { marker: 0xd9, data: new Uint8Array(0) } // EOI
    ]);

    const sanitized = JpegSanitizer.sanitize(jpeg);
    expect(sanitized.strippedExif).toBe(false);
    expect(sanitized.strippedIptc).toBe(false);
    expect(sanitized.strippedComments).toBe(false);
    expect(sanitized.bytes.length).toBe(jpeg.length);
  });

  it('should strip APP1 (EXIF), APP13 (IPTC), and COM segments while preserving APP0, APP2, and APP14', () => {
    const app0Data = new Uint8Array([0x4a, 0x46, 0x49, 0x46, 0x00]);
    const app1Data = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x01, 0x02]); // Exif\0\0...
    const app2Data = new Uint8Array([0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]); // ICC
    const app13Data = new Uint8Array([0x50, 0x68, 0x6f, 0x74, 0x6f, 0x73, 0x68, 0x6f, 0x70, 0x20]); // Photoshop
    const app14Data = new Uint8Array([0x41, 0x64, 0x6f, 0x62, 0x65, 0x00]); // Adobe
    const comData = new Uint8Array(new TextEncoder().encode('Created by camera 12345'));
    const sofData = new Uint8Array([0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);

    const jpeg = createJpegWithSegments([
      { marker: 0xe0, data: app0Data },
      { marker: 0xe1, data: app1Data },
      { marker: 0xe2, data: app2Data },
      { marker: 0xed, data: app13Data },
      { marker: 0xee, data: app14Data },
      { marker: 0xfe, data: comData },
      { marker: 0xc0, data: sofData },
      { marker: 0xd9, data: new Uint8Array(0) }
    ]);

    const sanitized = JpegSanitizer.sanitize(jpeg);
    expect(sanitized.strippedExif).toBe(true);
    expect(sanitized.strippedIptc).toBe(true);
    expect(sanitized.strippedComments).toBe(true);

    // Verify sanitized starts with SOI and ends with EOI
    expect(sanitized.bytes[0]).toBe(0xff);
    expect(sanitized.bytes[1]).toBe(0xd8);
    expect(sanitized.bytes[sanitized.bytes.length - 2]).toBe(0xff);
    expect(sanitized.bytes[sanitized.bytes.length - 1]).toBe(0xd9);

    // Verify APP1 (0xE1), APP13 (0xED), COM (0xFE) are NOT in output
    let offset = 2;
    const foundMarkers: number[] = [];
    while (offset < sanitized.bytes.length - 1) {
      if (sanitized.bytes[offset] === 0xff) {
        const m = sanitized.bytes[offset + 1];
        if (m === 0xd9) {
          foundMarkers.push(m);
          break;
        }
        if (m !== 0xff && m !== 0x00 && !(m >= 0xd0 && m <= 0xd7)) {
          foundMarkers.push(m);
          const len = (sanitized.bytes[offset + 2] << 8) | sanitized.bytes[offset + 3];
          offset += 2 + len;
          continue;
        }
      }
      offset++;
    }

    expect(foundMarkers).toContain(0xe0); // APP0 preserved
    expect(foundMarkers).toContain(0xe2); // APP2 (ICC) preserved
    expect(foundMarkers).toContain(0xee); // APP14 (Adobe) preserved
    expect(foundMarkers).toContain(0xc0); // SOF0 preserved
    expect(foundMarkers).not.toContain(0xe1); // APP1 stripped
    expect(foundMarkers).not.toContain(0xed); // APP13 stripped
    expect(foundMarkers).not.toContain(0xfe); // COM stripped
  });

  it('should detect GPS info tag in EXIF IFD', () => {
    // Build EXIF TIFF structure with GPS Info tag 0x8825
    // Little-endian TIFF header: II (0x49, 0x49), 42 (0x2a, 0x00), offset to IFD0 = 8
    const tiff = new Uint8Array(26);
    tiff[0] = 0x49;
    tiff[1] = 0x49;
    const view = new DataView(tiff.buffer);
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true); // IFD0 offset
    view.setUint16(8, 1, true); // 1 entry in IFD0
    view.setUint16(10, 0x8825, true); // GPS IFD pointer tag!
    view.setUint16(12, 4, true); // type LONG
    view.setUint32(14, 1, true); // count
    view.setUint32(18, 500, true); // pointer value

    const exifData = new Uint8Array(6 + tiff.length);
    exifData.set(new TextEncoder().encode('Exif\0\0'), 0);
    exifData.set(tiff, 6);

    const jpegWithGps = createJpegWithSegments([
      { marker: 0xe1, data: exifData },
      { marker: 0xd9, data: new Uint8Array(0) }
    ]);

    expect(JpegSanitizer.hasGpsInfo(jpegWithGps)).toBe(true);
    const result = JpegSanitizer.sanitize(jpegWithGps);
    expect(result.hasGpsData).toBe(true);
    expect(result.strippedExif).toBe(true);
  });
});

