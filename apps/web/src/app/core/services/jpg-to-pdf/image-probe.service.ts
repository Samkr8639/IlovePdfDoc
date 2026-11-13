import { Injectable } from '@angular/core';
import { ImageProbeResult, SupportedImageFormat } from './jpg-to-pdf.models';

const MAX_MEGAPIXELS = 200;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable({
  providedIn: 'root'
})
export class ImageProbeService {
  /**
   * Fast header probe that extracts format, dimensions, DPI, and orientation
   * without decoding full image raster into memory.
   */
  async probeImage(file: File): Promise<ImageProbeResult> {
    if (file.size === 0) {
      return this.errorResult('File is empty (0 bytes).');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return this.errorResult(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB limit.`
      );
    }

    // Read header chunk (64KB is plenty for image headers, EXIF and PNG chunks)
    const headerChunkSize = Math.min(file.size, 65536);
    const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    const view = new DataView(headerBuffer);

    // 1. Check for Polyglots & explicitly rejected formats
    if (this.isSvg(bytes) || file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml') {
      return this.errorResult(
        'SVG format is not supported. Please use JPG, PNG, WebP, or BMP images.'
      );
    }

    if (this.isGif(bytes) || file.name.toLowerCase().endsWith('.gif') || file.type === 'image/gif') {
      return this.errorResult(
        'GIF format is not supported. Please use JPG, PNG, WebP, or BMP images.'
      );
    }

    if (this.isTiff(bytes)) {
      return this.errorResult(
        'TIFF format is not supported directly in browsers. Please convert HEIC/TIFF to JPG first.'
      );
    }

    if (this.isHeic(bytes)) {
      return this.errorResult(
        'HEIC/HEIF is not supported directly in browsers. Please convert HEIC/TIFF to JPG first.'
      );
    }

    if (this.isPdfOrArchive(bytes)) {
      return this.errorResult(
        'File is not a valid image format. Renamed document or archive detected.'
      );
    }

    // 2. Identify and parse supported formats
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      // If full EXIF might exceed 64KB, read up to 256KB
      let fullBytes = bytes;
      let fullView = view;
      if (file.size > headerChunkSize) {
        const largerChunk = Math.min(file.size, 262144);
        const largerBuf = await file.slice(0, largerChunk).arrayBuffer();
        fullBytes = new Uint8Array(largerBuf);
        fullView = new DataView(largerBuf);
      }
      return this.parseJpeg(fullBytes, fullView);
    }

    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return this.parsePng(bytes, view);
    }

    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return this.parseWebp(bytes, view);
    }

    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return this.parseBmp(bytes, view);
    }

    if (this.isGif(bytes)) {
      return this.errorResult('GIF format is not supported. Please use JPG, PNG, WebP, or BMP images.');
    }

    return this.errorResult('Unrecognized image format or corrupt image header.');
  }

  // ---------------------------------------------------------------------------
  // FORMAT DETECTORS (Negative validation & Polyglot protection)
  // ---------------------------------------------------------------------------

  private isGif(bytes: Uint8Array): boolean {
    return (
      (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && bytes[4] === 0x37 && bytes[5] === 0x61) ||
      (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && bytes[4] === 0x39 && bytes[5] === 0x61)
    );
  }

  private isSvg(bytes: Uint8Array): boolean {
    const textSnippet = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512));
    const trimmed = textSnippet.trim().toLowerCase();
    return (
      trimmed.startsWith('<svg') ||
      trimmed.startsWith('<?xml') && trimmed.includes('<svg') ||
      trimmed.startsWith('<!doctype svg') ||
      trimmed.includes('<svg')
    );
  }

  private isTiff(bytes: Uint8Array): boolean {
    return (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    );
  }

  private isHeic(bytes: Uint8Array): boolean {
    if (bytes.length < 12) return false;
    // ftyp box indicator: bytes 4-7 = 'ftyp'
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box !== 'ftyp') return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif'].includes(brand);
  }

  private isPdfOrArchive(bytes: Uint8Array): boolean {
    // PDF magic %PDF-
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return true;
    }
    // ZIP magic PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return true;
    }
    // HTML <!DOCTYPE or <html
    const textSnippet = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 100)).trim().toLowerCase();
    if (textSnippet.startsWith('<!doctype html') || textSnippet.startsWith('<html')) {
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // JPEG PARSER (SOF markers, JFIF density, EXIF orientation/resolution, Adobe APP14)
  // ---------------------------------------------------------------------------

  private parseJpeg(bytes: Uint8Array, view: DataView): ImageProbeResult {
    let offset = 2; // skip SOI (0xFFD8)
    let width = 0;
    let height = 0;
    let dpiX = 96;
    let dpiY = 96;
    let hasDpi = false;
    let orientation = 1;
    let components = 3;
    let isAdobeYcck = false;
    let hasIccProfile = false;

    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }

      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset++;
      }
      if (offset >= bytes.length) break;

      const marker = bytes[offset];
      offset++;

      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        continue;
      }

      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset, false);
      if (length < 2) break;

      const payloadOffset = offset + 2;
      const payloadLength = length - 2;

      // APP0 (JFIF density)
      if (marker === 0xe0 && payloadLength >= 5) {
        const id = String.fromCharCode(...bytes.subarray(payloadOffset, payloadOffset + 5));
        if (id === 'JFIF\0' && payloadLength >= 14) {
          const densityUnits = bytes[payloadOffset + 7];
          const xDensity = view.getUint16(payloadOffset + 8, false);
          const yDensity = view.getUint16(payloadOffset + 10, false);
          if (xDensity > 0 && yDensity > 0) {
            if (densityUnits === 1) {
              // Pixels per inch
              dpiX = xDensity;
              dpiY = yDensity;
              hasDpi = true;
            } else if (densityUnits === 2) {
              // Pixels per cm
              dpiX = Math.round(xDensity * 2.54);
              dpiY = Math.round(yDensity * 2.54);
              hasDpi = true;
            }
          }
        }
      }

      // APP1 (EXIF metadata)
      if (marker === 0xe1 && payloadLength >= 6) {
        const id = String.fromCharCode(...bytes.subarray(payloadOffset, payloadOffset + 6));
        if (id === 'Exif\0\0') {
          const exifData = this.parseExif(bytes.subarray(payloadOffset + 6, payloadOffset + payloadLength));
          if (exifData.orientation >= 1 && exifData.orientation <= 8) {
            orientation = exifData.orientation;
          }
          if (exifData.hasDpi) {
            dpiX = exifData.dpiX;
            dpiY = exifData.dpiY;
            hasDpi = true;
          }
        }
      }

      // APP2 (ICC profile)
      if (marker === 0xe2 && payloadLength >= 12) {
        const id = String.fromCharCode(...bytes.subarray(payloadOffset, payloadOffset + 12));
        if (id.startsWith('ICC_PROFILE\0')) {
          hasIccProfile = true;
        }
      }

      // APP14 (Adobe transform flag)
      if (marker === 0xee && payloadLength >= 12) {
        const id = String.fromCharCode(...bytes.subarray(payloadOffset, payloadOffset + 5));
        if (id === 'Adobe') {
          const transform = bytes[payloadOffset + 11];
          if (transform === 2) {
            isAdobeYcck = true;
          }
        }
      }

      // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5-SOF15 (0xC5-0xCF except 0xC4/0xC8/0xCC)
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isSof && payloadLength >= 6) {
        height = view.getUint16(payloadOffset + 1, false);
        width = view.getUint16(payloadOffset + 3, false);
        components = bytes[payloadOffset + 5];
        break; // Found primary dimensions
      }

      // SOS (0xDA): Start of Scan, raster data begins
      if (marker === 0xda) {
        break;
      }

      offset += length;
    }

    if (width <= 0 || height <= 0) {
      return this.errorResult('Could not extract valid JPEG dimensions from SOF marker.');
    }

    const megapixels = (width * height) / 1000000;
    if (megapixels > MAX_MEGAPIXELS) {
      return this.errorResult(
        `Decompression bomb guard: Image exceeds the ${MAX_MEGAPIXELS} megapixel limit (${megapixels.toFixed(1)} MP).`
      );
    }

    const isCmyk = components === 4;

    return {
      isValid: true,
      format: 'jpeg',
      mimeType: 'image/jpeg',
      widthPx: width,
      heightPx: height,
      dpiX: hasDpi ? dpiX : 96,
      dpiY: hasDpi ? dpiY : 96,
      hasDpi,
      exifOrientation: orientation,
      colorComponents: components,
      isCmyk,
      isAdobeYcck,
      hasAlpha: false,
      hasIccProfile,
      megapixels
    };
  }

  /**
   * Safe parser for TIFF header inside EXIF segment.
   * Handles both Little Endian (II) and Big Endian (MM) architectures.
   */
  private parseExif(exifBytes: Uint8Array): { orientation: number; dpiX: number; dpiY: number; hasDpi: boolean } {
    const result = { orientation: 1, dpiX: 96, dpiY: 96, hasDpi: false };
    if (exifBytes.length < 8) return result;

    const view = new DataView(exifBytes.buffer, exifBytes.byteOffset, exifBytes.byteLength);
    const byteOrderMarker = view.getUint16(0, false);
    let isLe = false;

    if (byteOrderMarker === 0x4949) {
      isLe = true; // 'II' Little Endian
    } else if (byteOrderMarker === 0x4d4d) {
      isLe = false; // 'MM' Big Endian
    } else {
      return result;
    }

    // Verify 42 tag
    if (view.getUint16(2, isLe) !== 0x002a) {
      return result;
    }

    const ifd0Offset = view.getUint32(4, isLe);
    if (ifd0Offset < 8 || ifd0Offset + 2 > exifBytes.length) {
      return result;
    }

    try {
      const numEntries = view.getUint16(ifd0Offset, isLe);
      let entryOffset = ifd0Offset + 2;

      let resolutionUnit = 2; // Default inches
      let xRes = 0;
      let yRes = 0;

      for (let i = 0; i < numEntries && entryOffset + 12 <= exifBytes.length; i++) {
        const tag = view.getUint16(entryOffset, isLe);
        const type = view.getUint16(entryOffset + 2, isLe);
        const count = view.getUint32(entryOffset + 4, isLe);

        // Tag 0x0112: Orientation
        if (tag === 0x0112 && count >= 1) {
          const orientationVal = view.getUint16(entryOffset + 8, isLe);
          if (orientationVal >= 1 && orientationVal <= 8) {
            result.orientation = orientationVal;
          }
        }

        // Tag 0x0128: ResolutionUnit
        if (tag === 0x0128 && count >= 1) {
          resolutionUnit = view.getUint16(entryOffset + 8, isLe);
        }

        // Tag 0x011A: XResolution (RATIONAL = 2 uint32s)
        if (tag === 0x011a && type === 5 && count >= 1) {
          const valOffset = view.getUint32(entryOffset + 8, isLe);
          if (valOffset + 8 <= exifBytes.length) {
            const num = view.getUint32(valOffset, isLe);
            const den = view.getUint32(valOffset + 4, isLe);
            if (den > 0) xRes = Math.round(num / den);
          }
        }

        // Tag 0x011B: YResolution (RATIONAL = 2 uint32s)
        if (tag === 0x011b && type === 5 && count >= 1) {
          const valOffset = view.getUint32(entryOffset + 8, isLe);
          if (valOffset + 8 <= exifBytes.length) {
            const num = view.getUint32(valOffset, isLe);
            const den = view.getUint32(valOffset + 4, isLe);
            if (den > 0) yRes = Math.round(num / den);
          }
        }

        entryOffset += 12;
      }

      if (xRes > 0 && yRes > 0) {
        if (resolutionUnit === 3) {
          // Centimeters -> Inches
          result.dpiX = Math.round(xRes * 2.54);
          result.dpiY = Math.round(yRes * 2.54);
        } else {
          result.dpiX = xRes;
          result.dpiY = yRes;
        }
        result.hasDpi = true;
      }
    } catch {
      // Malformed EXIF must never throw or crash probe
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // PNG PARSER (IHDR, pHYs, color type, alpha check)
  // ---------------------------------------------------------------------------

  private parsePng(bytes: Uint8Array, view: DataView): ImageProbeResult {
    let offset = 8; // skip 8-byte signature
    let width = 0;
    let height = 0;
    let colorType = 2;
    let hasAlpha = false;
    let dpiX = 96;
    let dpiY = 96;
    let hasDpi = false;

    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset, false);
      const chunkType = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      const dataOffset = offset + 8;

      if (chunkType === 'IHDR' && length >= 13) {
        width = view.getUint32(dataOffset, false);
        height = view.getUint32(dataOffset + 4, false);
        colorType = bytes[dataOffset + 9];
        // Color type 4 = Gray + Alpha, 6 = RGBA
        if (colorType === 4 || colorType === 6) {
          hasAlpha = true;
        }
      } else if (chunkType === 'tRNS') {
        hasAlpha = true;
      } else if (chunkType === 'pHYs' && length >= 9) {
        const ppmX = view.getUint32(dataOffset, false);
        const ppmY = view.getUint32(dataOffset + 4, false);
        const unit = bytes[dataOffset + 8];
        if (unit === 1 && ppmX > 0 && ppmY > 0) {
          // unit 1 = meters. 1 meter = 39.3701 inches. DPI = ppm * 0.0254
          dpiX = Math.round(ppmX * 0.0254);
          dpiY = Math.round(ppmY * 0.0254);
          hasDpi = true;
        }
      } else if (chunkType === 'IEND') {
        break;
      }

      offset += 12 + length; // length + 4(type) + data + 4(crc)
    }

    if (width <= 0 || height <= 0) {
      return this.errorResult('Could not extract valid PNG dimensions from IHDR chunk.');
    }

    const megapixels = (width * height) / 1000000;
    if (megapixels > MAX_MEGAPIXELS) {
      return this.errorResult(
        `Decompression bomb guard: Image exceeds the ${MAX_MEGAPIXELS} megapixel limit (${megapixels.toFixed(1)} MP).`
      );
    }

    return {
      isValid: true,
      format: 'png',
      mimeType: 'image/png',
      widthPx: width,
      heightPx: height,
      dpiX: hasDpi ? dpiX : 96,
      dpiY: hasDpi ? dpiY : 96,
      hasDpi,
      exifOrientation: 1,
      hasAlpha,
      megapixels
    };
  }

  // ---------------------------------------------------------------------------
  // WEBP PARSER (VP8, VP8L, VP8X, animation flag)
  // ---------------------------------------------------------------------------

  private parseWebp(bytes: Uint8Array, view: DataView): ImageProbeResult {
    let offset = 12; // skip RIFF + size + WEBP
    let width = 0;
    let height = 0;
    let hasAlpha = false;
    let isAnimated = false;

    while (offset + 8 <= bytes.length) {
      const chunkType = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      const chunkSize = view.getUint32(offset + 4, true); // Little endian in RIFF
      const dataOffset = offset + 8;

      if (chunkType === 'VP8X' && chunkSize >= 10) {
        const flags = bytes[dataOffset];
        hasAlpha = (flags & 0x10) !== 0;
        isAnimated = (flags & 0x02) !== 0;
        // 24-bit width and height: 1 + value
        width = 1 + (bytes[dataOffset + 4] | (bytes[dataOffset + 5] << 8) | (bytes[dataOffset + 6] << 16));
        height = 1 + (bytes[dataOffset + 7] | (bytes[dataOffset + 8] << 8) | (bytes[dataOffset + 9] << 16));
        break;
      } else if (chunkType === 'VP8 ' && chunkSize >= 10) {
        // Simple lossy WebP
        const keyframe = bytes[dataOffset + 3] === 0x9d && bytes[dataOffset + 4] === 0x01 && bytes[dataOffset + 5] === 0x2a;
        if (keyframe) {
          width = view.getUint16(dataOffset + 6, true) & 0x3fff;
          height = view.getUint16(dataOffset + 8, true) & 0x3fff;
        }
        break;
      } else if (chunkType === 'VP8L' && chunkSize >= 5) {
        // Simple lossless WebP
        if (bytes[dataOffset] === 0x2f) {
          const b1 = bytes[dataOffset + 1];
          const b2 = bytes[dataOffset + 2];
          const b3 = bytes[dataOffset + 3];
          const b4 = bytes[dataOffset + 4];
          width = 1 + (((b2 & 0x3f) << 8) | b1);
          height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          hasAlpha = (b4 & 0x10) !== 0;
        }
        break;
      }

      offset += 8 + chunkSize + (chunkSize % 2); // padded to even
    }

    if (width <= 0 || height <= 0) {
      return this.errorResult('Could not extract valid WebP dimensions.');
    }

    const megapixels = (width * height) / 1000000;
    if (megapixels > MAX_MEGAPIXELS) {
      return this.errorResult(
        `Decompression bomb guard: Image exceeds the ${MAX_MEGAPIXELS} megapixel limit (${megapixels.toFixed(1)} MP).`
      );
    }

    return {
      isValid: true,
      format: 'webp',
      mimeType: 'image/webp',
      widthPx: width,
      heightPx: height,
      dpiX: 96,
      dpiY: 96,
      hasDpi: false,
      exifOrientation: 1,
      hasAlpha,
      isAnimated,
      megapixels
    };
  }

  // ---------------------------------------------------------------------------
  // GIF PARSER (Width, Height, animated flag)
  // ---------------------------------------------------------------------------

  private parseGif(bytes: Uint8Array, view: DataView): ImageProbeResult {
    if (bytes.length < 13) {
      return this.errorResult('Truncated GIF header.');
    }

    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);

    if (width <= 0 || height <= 0) {
      return this.errorResult('Invalid GIF logical screen dimensions.');
    }

    // Check for multiple image descriptors (0x2C) indicating animated GIF
    let imageDescriptorCount = 0;
    for (let i = 13; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x2c) {
        imageDescriptorCount++;
        if (imageDescriptorCount > 1) break;
      }
    }

    const megapixels = (width * height) / 1000000;
    return {
      isValid: true,
      format: 'gif',
      mimeType: 'image/gif',
      widthPx: width,
      heightPx: height,
      dpiX: 96,
      dpiY: 96,
      hasDpi: false,
      exifOrientation: 1,
      hasAlpha: true,
      isAnimated: imageDescriptorCount > 1,
      megapixels
    };
  }

  // ---------------------------------------------------------------------------
  // BMP PARSER (DIB Header dimensions, DPI)
  // ---------------------------------------------------------------------------

  private parseBmp(bytes: Uint8Array, view: DataView): ImageProbeResult {
    if (bytes.length < 26) {
      return this.errorResult('Truncated BMP header.');
    }

    const dibHeaderSize = view.getUint32(14, true);
    let width = 0;
    let height = 0;
    let dpiX = 96;
    let dpiY = 96;
    let hasDpi = false;

    if (dibHeaderSize >= 40 && bytes.length >= 26) {
      width = Math.abs(view.getInt32(18, true));
      height = Math.abs(view.getInt32(22, true));

      if (dibHeaderSize >= 40 && bytes.length >= 46) {
        const ppmX = view.getInt32(38, true);
        const ppmY = view.getInt32(42, true);
        if (ppmX > 0 && ppmY > 0) {
          dpiX = Math.round(ppmX * 0.0254);
          dpiY = Math.round(ppmY * 0.0254);
          hasDpi = true;
        }
      }
    } else if (dibHeaderSize === 12 && bytes.length >= 22) {
      // BITMAPCOREHEADER (OS/2)
      width = view.getUint16(18, true);
      height = view.getUint16(20, true);
    }

    if (width <= 0 || height <= 0) {
      return this.errorResult('Invalid BMP dimensions.');
    }

    const megapixels = (width * height) / 1000000;
    return {
      isValid: true,
      format: 'bmp',
      mimeType: 'image/bmp',
      widthPx: width,
      heightPx: height,
      dpiX: hasDpi ? dpiX : 96,
      dpiY: hasDpi ? dpiY : 96,
      hasDpi,
      exifOrientation: 1,
      hasAlpha: false,
      megapixels
    };
  }

  private errorResult(message: string): ImageProbeResult {
    return {
      isValid: false,
      widthPx: 0,
      heightPx: 0,
      dpiX: 96,
      dpiY: 96,
      hasDpi: false,
      exifOrientation: 1,
      error: message,
      megapixels: 0
    };
  }
}

