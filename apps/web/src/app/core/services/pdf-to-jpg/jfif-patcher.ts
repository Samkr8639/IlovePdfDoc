/**
 * Utilities for validating JPEG markers and embedding JFIF APP0 DPI metadata into JPEG binary buffers.
 */

export interface JpegDpiInfo {
  units: number; // 0 = no units, 1 = dots per inch, 2 = dots per cm
  xDensity: number;
  yDensity: number;
}

/**
 * Validates that the buffer begins with JPEG SOI (0xFFD8) and ends with EOI (0xFFD9).
 */
export function isValidJpeg(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  const isSoi = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isEoi = buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  return isSoi && isEoi;
}

/**
 * Parses the JFIF APP0 density information if present.
 */
export function readJpegDpi(buffer: Uint8Array): JpegDpiInfo | null {
  if (buffer.length < 18 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) {
      break;
    }
    const marker = buffer[offset + 1];

    // APP0 marker (0xFFE0)
    if (marker === 0xe0) {
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
      // Check JFIF identifier: "JFIF\0" (0x4A, 0x46, 0x49, 0x46, 0x00)
      if (
        buffer[offset + 4] === 0x4a &&
        buffer[offset + 5] === 0x46 &&
        buffer[offset + 6] === 0x49 &&
        buffer[offset + 7] === 0x46 &&
        buffer[offset + 8] === 0x00
      ) {
        const units = buffer[offset + 11];
        const xDensity = (buffer[offset + 12] << 8) | buffer[offset + 13];
        const yDensity = (buffer[offset + 14] << 8) | buffer[offset + 15];
        return { units, xDensity, yDensity };
      }
      offset += 2 + length;
    } else if (marker === 0xda) {
      // Start of scan - markers stop here
      break;
    } else {
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
      offset += 2 + length;
    }
  }

  return null;
}

/**
 * Embeds or patches the JFIF APP0 marker with the specified DPI (dots per inch).
 * Returns a new Uint8Array with the embedded DPI.
 */
export function embedJpegDpi(buffer: Uint8Array, dpi: number): Uint8Array {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }

  const roundedDpi = Math.max(1, Math.min(65535, Math.round(dpi)));
  const xDensityHigh = (roundedDpi >> 8) & 0xff;
  const xDensityLow = roundedDpi & 0xff;
  const yDensityHigh = xDensityHigh;
  const yDensityLow = xDensityLow;

  // Check if first segment after SOI is an APP0 marker
  if (buffer[2] === 0xff && buffer[3] === 0xe0) {
    const length = (buffer[4] << 8) | buffer[5];
    // Check if it's JFIF
    if (
      buffer[6] === 0x4a &&
      buffer[7] === 0x46 &&
      buffer[8] === 0x49 &&
      buffer[9] === 0x46 &&
      buffer[10] === 0x00
    ) {
      // Clone buffer and patch density in place
      const patched = new Uint8Array(buffer);
      patched[13] = 0x01; // Units: 1 = dots per inch (DPI)
      patched[14] = xDensityHigh;
      patched[15] = xDensityLow;
      patched[16] = yDensityHigh;
      patched[17] = yDensityLow;
      return patched;
    }
  }

  // Construct a standard 18-byte JFIF APP0 segment:
  // Marker (2 bytes: 0xFFE0) + Length (2 bytes: 16) + Identifier (5 bytes: "JFIF\0") +
  // Version (2 bytes: 1.02) + Units (1 byte: 1 for DPI) + X density (2 bytes) + Y density (2 bytes) +
  // Thumbnail width/height (2 bytes: 0, 0)
  const app0 = new Uint8Array([
    0xff, 0xe0, // Marker
    0x00, 0x10, // Length: 16 bytes
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x02, // Version 1.02
    0x01, // Units: dots per inch
    xDensityHigh, xDensityLow,
    yDensityHigh, yDensityLow,
    0x00, 0x00 // No embedded thumbnail
  ]);

  // Insert APP0 right after SOI (index 2)
  const result = new Uint8Array(buffer.length + app0.length);
  result[0] = 0xff;
  result[1] = 0xd8;
  result.set(app0, 2);
  result.set(buffer.subarray(2), 2 + app0.length);

  return result;
}
