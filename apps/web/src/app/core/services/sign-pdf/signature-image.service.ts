import { Injectable } from '@angular/core';
import { SIGN_PDF_LIMITS, SignStampShape } from '@paperflow/contracts';

export interface ValidatedRasterImage {
  format: 'png' | 'jpeg' | 'webp';
  bytes: Uint8Array;
}

@Injectable({
  providedIn: 'root'
})
export class SignatureImageService {
  /** Validates uploaded signature/stamp image strictly by magic bytes (PNG/JPG/WebP; rejects SVG script risk). */
  async validateUploadedImage(file: File): Promise<{ valid: boolean; error?: string; image?: ValidatedRasterImage }> {
    if (!file || file.size === 0) {
      return { valid: false, error: 'Selected image file is empty.' };
    }
    if (file.size > SIGN_PDF_LIMITS.maxImageSizeBytes) {
      return { valid: false, error: 'Image exceeds the 5 MB size limit.' };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const textProbe = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
    if (textProbe.startsWith('<svg') || textProbe.includes('<svg') || textProbe.startsWith('<?xml')) {
      return { valid: false, error: 'SVG images are not allowed for security reasons. Upload PNG, JPG, or WebP.' };
    }

    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    if (isPng) return { valid: true, image: { format: 'png', bytes } };

    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) return { valid: true, image: { format: 'jpeg', bytes } };

    const isWebp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (isWebp) return { valid: true, image: { format: 'webp', bytes } };

    return { valid: false, error: 'Unsupported image format. Upload PNG, JPG, or WebP (verified by file header).' };
  }

  /** Decodes a validated raster image, rejects dimensions > 4000px, auto-trims transparent borders, and optionally removes near-white background. */
  async processUploadedImageToPng(
    validated: ValidatedRasterImage,
    options: { removeWhiteBg: boolean; tolerance: number }
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    const mime = validated.format === 'png' ? 'image/png' : validated.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = new Blob([validated.bytes.slice(0).buffer], { type: mime });
    const url = URL.createObjectURL(blob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not decode uploaded image file.'));
        el.src = url;
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > SIGN_PDF_LIMITS.maxImageDimensionPx || h > SIGN_PDF_LIMITS.maxImageDimensionPx || w < 1 || h < 1) {
        throw new Error(`Image dimensions (${w}×${h}) must be within 1–${SIGN_PDF_LIMITS.maxImageDimensionPx} px.`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.drawImage(img, 0, 0);

      let imgData = ctx.getImageData(0, 0, w, h);
      if (options.removeWhiteBg) {
        this.stripNearWhiteBackground(imgData, options.tolerance);
        ctx.putImageData(imgData, 0, 0);
      }

      const bounds = this.findOpaqueBounds(imgData, 8);
      if (!bounds) {
        return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
      }

      const pad = 4;
      const sx = Math.max(0, bounds.minX - pad);
      const sy = Math.max(0, bounds.minY - pad);
      const sw = Math.min(w - sx, bounds.maxX - bounds.minX + 1 + pad * 2);
      const sh = Math.min(h - sy, bounds.maxY - bounds.minY + 1 + pad * 2);

      const trimmed = document.createElement('canvas');
      trimmed.width = Math.max(1, sw);
      trimmed.height = Math.max(1, sh);
      const tCtx = trimmed.getContext('2d');
      if (!tCtx) return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
      tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      return { dataUrl: trimmed.toDataURL('image/png'), width: trimmed.width, height: trimmed.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Makes near-white pixels transparent using soft luminance + chroma distance filtering (pure algorithm, testable). */
  stripNearWhiteBackground(imageData: ImageData, tolerance = 32): void {
    const data = imageData.data;
    const tol = Math.max(0, Math.min(120, tolerance));
    const cutoff = 255 - tol;
    const featherSpan = Math.max(8, tol * 0.35);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      const spread = maxC - minC;

      // Near-neutral high brightness pixels become transparent
      if (minC >= cutoff && spread <= Math.max(24, tol * 0.6)) {
        data[i + 3] = 0;
      } else if (minC >= cutoff - featherSpan && spread <= Math.max(30, tol * 0.7)) {
        const factor = Math.max(0, Math.min(1, (cutoff - minC) / featherSpan));
        data[i + 3] = Math.round(a * factor);
      }
    }
  }

  /** Finds tight opaque pixel bounding box for auto-trimming excess transparent canvas margins. */
  findOpaqueBounds(
    imageData: { width: number; height: number; data: Uint8ClampedArray },
    alphaThreshold = 8
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const { width, height, data } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return maxX >= minX && maxY >= minY ? { minX, minY, maxX, maxY } : null;
  }

  /** Trims a drawn HTMLCanvasElement down to tight stroke bounding box + padding as a transparent PNG data URL. */
  trimCanvasToPngDataUrl(canvas: HTMLCanvasElement, padding = 10): string | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bounds = this.findOpaqueBounds(data, 4);
    if (!bounds) return null;

    const sx = Math.max(0, bounds.minX - padding);
    const sy = Math.max(0, bounds.minY - padding);
    const sw = Math.min(canvas.width - sx, bounds.maxX - bounds.minX + 1 + padding * 2);
    const sh = Math.min(canvas.height - sy, bounds.maxY - bounds.minY + 1 + padding * 2);

    const out = document.createElement('canvas');
    out.width = Math.max(1, sw);
    out.height = Math.max(1, sh);
    const outCtx = out.getContext('2d');
    if (!outCtx) return canvas.toDataURL('image/png');
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  }

  /** Renders a high-DPI transparent PNG for typed signature/initials preview and embedding. */
  renderTypedSignatureToPngDataUrl(
    text: string,
    cssFontFamily: string,
    colorHex: string,
    baseFontPx = 56
  ): string | null {
    const clean = (text || '').trim();
    if (!clean || typeof document === 'undefined') return null;

    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    if (!mCtx) return null;

    const scale = 2;
    mCtx.font = `600 ${baseFontPx}px ${cssFontFamily}`;
    const metrics = mCtx.measureText(clean);
    const textW = Math.ceil(metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || baseFontPx * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || baseFontPx * 0.25);

    const w = Math.max(60, textW + 28);
    const h = Math.max(48, ascent + descent + 24);
    measureCanvas.width = w * scale;
    measureCanvas.height = h * scale;

    const ctx = measureCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.font = `600 ${baseFontPx}px ${cssFontFamily}`;
    ctx.fillStyle = colorHex || '#14213D';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(clean, 14, 12 + ascent);

    return this.trimCanvasToPngDataUrl(measureCanvas, 12) || measureCanvas.toDataURL('image/png');
  }

  /** Renders a crisp transparent company stamp PNG (rectangle, rounded, or circular seal). */
  renderStampToPngDataUrl(params: {
    line1: string;
    line2?: string;
    shape: SignStampShape;
    color: string;
  }): string | null {
    if (typeof document === 'undefined') return null;
    const l1 = (params.line1 || 'APPROVED').trim();
    const l2 = (params.line2 || '').trim();
    const color = params.color || '#0F766E';

    const size = params.shape === 'circle' ? 360 : 420;
    const height = params.shape === 'circle' ? 360 : 180;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 8;

    if (params.shape === 'circle') {
      const r = size / 2 - 14;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r - 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 32px Inter, sans-serif';
      ctx.fillText(l1, size / 2, l2 ? size / 2 - 18 : size / 2, r * 1.5);
      if (l2) {
        ctx.font = '600 20px Inter, sans-serif';
        ctx.fillText(l2, size / 2, size / 2 + 24, r * 1.5);
      }
    } else {
      const pad = 12;
      const bw = size - pad * 2;
      const bh = height - pad * 2;
      const rad = params.shape === 'rounded' ? 22 : 4;
      this.roundRectPath(ctx, pad, pad, bw, bh, rad);
      ctx.stroke();

      ctx.lineWidth = 3;
      this.roundRectPath(ctx, pad + 10, pad + 10, bw - 20, bh - 20, Math.max(2, rad - 6));
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 38px Inter, sans-serif';
      ctx.fillText(l1, size / 2, l2 ? height / 2 - 20 : height / 2, bw - 44);
      if (l2) {
        ctx.font = '600 22px Inter, sans-serif';
        ctx.fillText(l2, size / 2, height / 2 + 26, bw - 44);
      }
    }

    return canvas.toDataURL('image/png');
  }

  /** Downscales oversized PNG bytes to <= maxWidthPx x maxHeightPx while preserving alpha transparency. */
  async downscalePngBytes(pngBytes: Uint8Array, maxWidthPx: number, maxHeightPx: number): Promise<Uint8Array> {
    if (typeof document === 'undefined') return pngBytes;
    const blob = new Blob([pngBytes.slice(0).buffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('PNG decode error'));
        el.src = url;
      });
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w <= maxWidthPx && h <= maxHeightPx) return pngBytes;

      const ratio = Math.min(maxWidthPx / w, maxHeightPx / h);
      const nw = Math.max(8, Math.round(w * ratio));
      const nh = Math.max(8, Math.round(h * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return pngBytes;
      ctx.drawImage(img, 0, 0, nw, nh);

      const outBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!outBlob) return pngBytes;
      return new Uint8Array(await outBlob.arrayBuffer());
    } catch {
      return pngBytes;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
