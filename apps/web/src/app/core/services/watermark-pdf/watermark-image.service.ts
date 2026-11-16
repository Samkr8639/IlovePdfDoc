/**
 * Watermark Image Service
 * Safe image validation via magic bytes and binary header parsing BEFORE decoding.
 * Handles PNG, JPEG, WebP, and GIF (first frame). Strictly rejects SVG.
 * Supports white background removal and effective DPI downscaling.
 */

import { Injectable } from '@angular/core';
import { WATERMARK_LIMITS } from '@paperflow/contracts';

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif';

export interface ImageHeaderInfo {
  format: ImageFormat;
  width: number;
  height: number;
  fileSizeBytes: number;
}

export interface ValidatedWatermarkImage {
  format: ImageFormat;
  bytes: Uint8Array;
  header: ImageHeaderInfo;
}

export interface ProcessedWatermarkImage {
  dataUrl: string;
  width: number;
  height: number;
  format: 'png';
  bytes: Uint8Array;
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkImageService {
  /**
   * Validates image by magic bytes and extracts dimensions from the binary header
   * strictly BEFORE decoding.
   */
  async validateImageHeader(file: File | { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<{
    valid: boolean;
    error?: string;
    image?: ValidatedWatermarkImage;
  }> {
    if (!file || file.size === 0) {
      return { valid: false, error: 'The selected image file is empty.' };
    }

    if (file.size > WATERMARK_LIMITS.maxImageSizeBytes) {
      return { valid: false, error: 'Image exceeds the 10 MB maximum size limit.' };
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Reject SVG strictly
    const probeLen = Math.min(bytes.length, 512);
    const textProbe = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, probeLen)).trimStart().toLowerCase();
    if (textProbe.startsWith('<svg') || textProbe.includes('<svg') || textProbe.startsWith('<?xml')) {
      return { valid: false, error: 'SVG images are not allowed for security reasons. Please upload PNG, JPG, or WebP.' };
    }

    // Inspect format and extract dimensions directly from header
    const header = this.parseImageHeader(bytes);
    if (!header) {
      return { valid: false, error: 'Unsupported or corrupted image format. Please upload PNG, JPG, WebP, or GIF.' };
    }

    // Check dimensions against limits
    if (header.width > WATERMARK_LIMITS.maxImageDimensionPx || header.height > WATERMARK_LIMITS.maxImageDimensionPx) {
      return {
        valid: false,
        error: `Image dimensions (${header.width}×${header.height} px) exceed maximum allowed limit of ${WATERMARK_LIMITS.maxImageDimensionPx} px per side.`
      };
    }

    const megapixels = (header.width * header.height) / 1_000_000;
    if (megapixels > WATERMARK_LIMITS.maxImageMegapixels) {
      return {
        valid: false,
        error: `Image resolution (${megapixels.toFixed(1)} MP) exceeds maximum allowed limit of ${WATERMARK_LIMITS.maxImageMegapixels} megapixels.`
      };
    }

    // Verify consistency: tiny file cannot declare huge uncompressed area (decompression bomb protection)
    if (header.width > 2000 && header.height > 2000 && bytes.length < 500) {
      return { valid: false, error: 'Image header is inconsistent with file size (potential compression bomb).' };
    }

    return {
      valid: true,
      image: {
        format: header.format,
        bytes,
        header
      }
    };
  }

  /**
   * Parses binary headers without decoding pixel raster.
   */
  parseImageHeader(bytes: Uint8Array): ImageHeaderInfo | null {
    if (bytes.length < 16) return null;

    // 1. PNG Header (IHDR chunk)
    if (
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      if (bytes.length < 24) return null;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false); // Big endian
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0) {
        return { format: 'png', width, height, fileSizeBytes: bytes.length };
      }
      return null;
    }

    // 2. JPEG Header (SOF marker)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        while (bytes[offset] === 0xff && offset < bytes.length) {
          offset++;
        }
        if (offset >= bytes.length) break;

        const marker = bytes[offset++];
        // Baseline, Extended, Progressive SOF markers
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          if (offset + 7 <= bytes.length) {
            const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
            const height = view.getUint16(3, false);
            const width = view.getUint16(5, false);
            if (width > 0 && height > 0) {
              return { format: 'jpeg', width, height, fileSizeBytes: bytes.length };
            }
          }
          break;
        }

        if (offset + 2 <= bytes.length) {
          const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 2);
          const len = view.getUint16(0, false);
          offset += len;
        } else {
          break;
        }
      }
      return null;
    }

    // 3. WebP Header (RIFF....WEBP)
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

      if (chunkType === 'VP8X' && bytes.length >= 30) {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        return { format: 'webp', width, height, fileSizeBytes: bytes.length };
      }

      if (chunkType === 'VP8 ' && bytes.length >= 30) {
        if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
          const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
          const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
          return { format: 'webp', width, height, fileSizeBytes: bytes.length };
        }
      }

      if (chunkType === 'VP8L' && bytes.length >= 26) {
        if (bytes[20] === 0x2f) {
          const b0 = bytes[21];
          const b1 = bytes[22];
          const b2 = bytes[23];
          const b3 = bytes[24];
          const width = 1 + (b0 | ((b1 & 0x3f) << 8));
          const height = 1 + (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)));
          return { format: 'webp', width, height, fileSizeBytes: bytes.length };
        }
      }
      return null;
    }

    // 4. GIF Header (GIF87a / GIF89a)
    if (
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
      bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, 10);
      const width = view.getUint16(6, true); // Little endian
      const height = view.getUint16(8, true);
      if (width > 0 && height > 0) {
        return { format: 'gif', width, height, fileSizeBytes: bytes.length };
      }
      return null;
    }

    return null;
  }

  /**
   * Decodes validated image, applies background removal if requested,
   * downscales if effective DPI > 300 at max placement, and outputs clean PNG data.
   */
  async processImage(
    validated: ValidatedWatermarkImage,
    options: { removeWhiteBg: boolean; tolerance: number; maxPlacementWidthPt?: number }
  ): Promise<ProcessedWatermarkImage> {
    const mime =
      validated.format === 'png'
        ? 'image/png'
        : validated.format === 'jpeg'
          ? 'image/jpeg'
          : validated.format === 'webp'
            ? 'image/webp'
            : 'image/gif';

    const blob = new Blob([validated.bytes.buffer as ArrayBuffer], { type: mime });

    let sourceBitmap: ImageBitmap | HTMLImageElement;
    if (typeof createImageBitmap === 'function') {
      try {
        sourceBitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      } catch {
        sourceBitmap = await this.decodeViaImageElement(blob);
      }
    } else {
      sourceBitmap = await this.decodeViaImageElement(blob);
    }

    const origW = sourceBitmap.width;
    const origH = sourceBitmap.height;

    // Check if downscaling is needed for effective resolution <= 300 DPI
    // 300 DPI means 300 px per 72 pt = ~4.167 px/pt
    let targetW = origW;
    let targetH = origH;
    if (options.maxPlacementWidthPt && options.maxPlacementWidthPt > 0) {
      const maxAllowedPx = Math.ceil(options.maxPlacementWidthPt * (300 / 72));
      if (origW > maxAllowedPx) {
        const ratio = maxAllowedPx / origW;
        targetW = maxAllowedPx;
        targetH = Math.round(origH * ratio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable.');

    ctx.drawImage(sourceBitmap, 0, 0, targetW, targetH);

    if (options.removeWhiteBg) {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      this.stripNearWhiteBackground(imgData, options.tolerance);
      ctx.putImageData(imgData, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const pngBytes = this.dataUrlToUint8Array(dataUrl);

    // Release image bitmap if applicable
    if ('close' in sourceBitmap && typeof sourceBitmap.close === 'function') {
      sourceBitmap.close();
    }

    return {
      dataUrl,
      width: targetW,
      height: targetH,
      format: 'png',
      bytes: pngBytes
    };
  }

  /**
   * Strips near-white pixels by setting alpha channel to 0 or smooth feathering.
   */
  stripNearWhiteBackground(imageData: ImageData, tolerance = 30): void {
    const data = imageData.data;
    const threshold = Math.max(200, 255 - Math.max(0, Math.min(100, tolerance)));

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue;

      if (r >= threshold && g >= threshold && b >= threshold) {
        const delta = Math.min(r, Math.min(g, b)) - threshold;
        const fadeRange = 255 - threshold;
        if (fadeRange > 0) {
          const factor = Math.max(0, 1 - delta / fadeRange);
          data[i + 3] = Math.round(a * factor * factor);
        } else {
          data[i + 3] = 0;
        }
      }
    }
  }

  private decodeViaImageElement(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image file.'));
      };
      img.src = url;
    });
  }

  private dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
