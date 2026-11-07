/**
 * Lossless JPEG EXIF and metadata sanitizer.
 * Parses JPEG marker streams to strip privacy-sensitive segments:
 * - APP1 (0xFFE1): EXIF, GPS coordinates, camera serial numbers, XMP
 * - APP13 (0xFFED): Photoshop Image Resource Blocks, IPTC
 * - COM (0xFFFE): User comments
 *
 * Strictly preserves:
 * - APP0 (0xFFE0): JFIF header
 * - APP2 (0xFFE2): ICC color profiles
 * - APP14 (0xFFEE): Adobe color transform flag (critical for CMYK/YCCK)
 * - DQT (0xFFDB), DHT (0xFFC4), SOFn (0xFFC0..), DRI (0xFFDD), SOS (0xFFDA)
 * - Scan entropy data and EOI (0xFFD9)
 */

export interface SanitizeResult {
  bytes: Uint8Array;
  strippedExif: boolean;
  strippedIptc: boolean;
  strippedComments: boolean;
  hasGpsData: boolean;
}

export class JpegSanitizer {
  /**
   * Check if a JPEG contains GPS information in APP1 EXIF.
   */
  static hasGpsInfo(bytes: Uint8Array): boolean {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return false;
    }

    let offset = 2;
    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xff) {
        break;
      }

      const marker = bytes[offset + 1];
      // Standalone markers
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }

      if (offset + 4 > bytes.length) break;
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];

      if (marker === 0xe1) {
        // Check for 'Exif\0\0'
        if (
          length >= 14 &&
          bytes[offset + 4] === 0x45 && // E
          bytes[offset + 5] === 0x78 && // x
          bytes[offset + 6] === 0x69 && // i
          bytes[offset + 7] === 0x66 && // f
          bytes[offset + 8] === 0x00 &&
          bytes[offset + 9] === 0x00
        ) {
          // Search for GPS IFD tag (0x8825) inside TIFF header
          const tiffStart = offset + 10;
          const tiffLen = length - 8;
          if (this.containsGpsTag(bytes.subarray(tiffStart, tiffStart + tiffLen))) {
            return true;
          }
        }
      }

      if (marker === 0xda) {
        // SOS reached
        break;
      }

      offset += 2 + length;
    }

    return false;
  }

  /**
   * Sanitizes JPEG by removing APP1, APP13, and COM segments.
   * Returns newly allocated Uint8Array or the original if no sensitive markers found.
   */
  static sanitize(bytes: Uint8Array): SanitizeResult {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return {
        bytes,
        strippedExif: false,
        strippedIptc: false,
        strippedComments: false,
        hasGpsData: false
      };
    }

    let strippedExif = false;
    let strippedIptc = false;
    let strippedComments = false;
    const hasGpsData = this.hasGpsInfo(bytes);

    // Collect chunks to keep
    const keptChunks: Uint8Array[] = [];
    let totalLength = 0;

    // Push SOI
    keptChunks.push(bytes.subarray(0, 2));
    totalLength += 2;

    let offset = 2;
    let hasSos = false;

    while (offset < bytes.length - 1) {
      // Find 0xFF marker
      if (bytes[offset] !== 0xff) {
        // Invalid stream or unexpected byte, copy remainder and exit
        const remainder = bytes.subarray(offset);
        keptChunks.push(remainder);
        totalLength += remainder.length;
        break;
      }

      const marker = bytes[offset + 1];

      // Handle padding 0xFF bytes
      if (marker === 0xff) {
        offset++;
        continue;
      }

      // Standalone markers: SOI (0xD8), EOI (0xD9), RST0-RST7 (0xD0-0xD7)
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        keptChunks.push(bytes.subarray(offset, offset + 2));
        totalLength += 2;
        offset += 2;
        if (marker === 0xd9) break;
        continue;
      }

      if (offset + 4 > bytes.length) {
        // Incomplete marker header
        const remainder = bytes.subarray(offset);
        keptChunks.push(remainder);
        totalLength += remainder.length;
        break;
      }

      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const segmentTotalLen = 2 + length;

      if (offset + segmentTotalLen > bytes.length) {
        // Malformed segment length
        const remainder = bytes.subarray(offset);
        keptChunks.push(remainder);
        totalLength += remainder.length;
        break;
      }

      // Markers to strip:
      // 0xE1 = APP1 (EXIF / XMP)
      // 0xED = APP13 (Photoshop IRB / IPTC)
      // 0xFE = COM (Comment)
      if (marker === 0xe1) {
        strippedExif = true;
        offset += segmentTotalLen;
        continue;
      }

      if (marker === 0xed) {
        strippedIptc = true;
        offset += segmentTotalLen;
        continue;
      }

      if (marker === 0xfe) {
        strippedComments = true;
        offset += segmentTotalLen;
        continue;
      }

      // If Start of Scan (0xDA), this is the last marker header before entropy data!
      if (marker === 0xda) {
        hasSos = true;
        // Keep everything from SOS header through the end of the file
        const sosToEnd = bytes.subarray(offset);
        keptChunks.push(sosToEnd);
        totalLength += sosToEnd.length;
        break;
      }

      // Keep this marker segment (APP0, APP2, APP14, DQT, DHT, SOF, etc.)
      keptChunks.push(bytes.subarray(offset, offset + segmentTotalLen));
      totalLength += segmentTotalLen;
      offset += segmentTotalLen;
    }

    if (!strippedExif && !strippedIptc && !strippedComments) {
      return {
        bytes,
        strippedExif: false,
        strippedIptc: false,
        strippedComments: false,
        hasGpsData
      };
    }

    // Assemble new sanitized byte buffer
    const output = new Uint8Array(totalLength);
    let writePos = 0;
    for (const chunk of keptChunks) {
      output.set(chunk, writePos);
      writePos += chunk.length;
    }

    // Ensure EOI (0xFF 0xD9) is present at the end
    if (output.length >= 2) {
      const lastTwo = output.subarray(output.length - 2);
      if (lastTwo[0] !== 0xff || lastTwo[1] !== 0xd9) {
        const withEoi = new Uint8Array(output.length + 2);
        withEoi.set(output, 0);
        withEoi[output.length] = 0xff;
        withEoi[output.length + 1] = 0xd9;
        return {
          bytes: withEoi,
          strippedExif,
          strippedIptc,
          strippedComments,
          hasGpsData
        };
      }
    }

    return {
      bytes: output,
      strippedExif,
      strippedIptc,
      strippedComments,
      hasGpsData
    };
  }

  private static containsGpsTag(tiffData: Uint8Array): boolean {
    if (tiffData.length < 8) return false;
    const isLittleEndian = tiffData[0] === 0x49 && tiffData[1] === 0x49;
    const isBigEndian = tiffData[0] === 0x4d && tiffData[1] === 0x4d;
    if (!isLittleEndian && !isBigEndian) return false;

    const view = new DataView(tiffData.buffer, tiffData.byteOffset, tiffData.byteLength);
    const magic = view.getUint16(2, isLittleEndian);
    if (magic !== 42) return false;

    const firstIfdOffset = view.getUint32(4, isLittleEndian);
    if (firstIfdOffset + 2 > tiffData.length) return false;

    let ifdOffset = firstIfdOffset;
    const numEntries = view.getUint16(ifdOffset, isLittleEndian);
    ifdOffset += 2;

    for (let i = 0; i < numEntries; i++) {
      if (ifdOffset + 12 > tiffData.length) break;
      const tag = view.getUint16(ifdOffset, isLittleEndian);
      if (tag === 0x8825) {
        // Tag 0x8825 is GPSInfo IFD Pointer
        return true;
      }
      ifdOffset += 12;
    }

    return false;
  }
}
