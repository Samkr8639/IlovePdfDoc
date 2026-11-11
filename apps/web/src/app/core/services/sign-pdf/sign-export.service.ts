import { Injectable, inject } from '@angular/core';
import { SignFieldElement } from '@paperflow/contracts';
import { exportSignedPdf } from '@paperflow/sign-core';
import { SignatureImageService } from './signature-image.service';
import { buildSignedFilename, SignExportOutcome } from './sign-pdf.models';

@Injectable({
  providedIn: 'root'
})
export class SignExportService {
  private readonly imageService = inject(SignatureImageService);
  private readonly fontByteCache = new Map<string, Uint8Array | null>();

  private async resolveFontBytes(fontFile: string): Promise<Uint8Array | null> {
    const cleanFile = fontFile.replace(/^\/?fonts\/sign\//, '');
    if (this.fontByteCache.has(cleanFile)) {
      return this.fontByteCache.get(cleanFile) || null;
    }
    try {
      const res = await fetch(`/fonts/sign/${cleanFile}`);
      if (!res.ok) {
        this.fontByteCache.set(cleanFile, null);
        return null;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      this.fontByteCache.set(cleanFile, bytes);
      return bytes;
    } catch {
      this.fontByteCache.set(cleanFile, null);
      return null;
    }
  }

  private async rasterizeUnsupportedTextFallback(
    text: string,
    sizePt: number,
    colorCss: string
  ): Promise<Uint8Array | null> {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = 3;
    const fontPx = Math.max(10, sizePt);
    ctx.font = `${fontPx}px 'SignNotoSans', sans-serif`;
    const width = Math.max(24, Math.ceil(ctx.measureText(text).width + 8));
    const height = Math.max(20, Math.ceil(fontPx * 1.4));
    canvas.width = width * scale;
    canvas.height = height * scale;
    const c2 = canvas.getContext('2d');
    if (!c2) return null;
    c2.scale(scale, scale);
    c2.font = `${fontPx}px 'SignNotoSans', sans-serif`;
    c2.fillStyle = colorCss || '#14213D';
    c2.textBaseline = 'alphabetic';
    c2.fillText(text, 2, fontPx * 0.95);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  }

  async exportSignedDocument(params: {
    originalBytes: Uint8Array;
    originalFilename: string;
    pageCount: number;
    fields: SignFieldElement[];
    flattenFormFields: boolean;
    warningsPrefix?: string[];
  }): Promise<SignExportOutcome> {
    const result = await exportSignedPdf(params.originalBytes, params.fields, {
      appName: 'PDFTailor',
      documentTitle: buildSignedFilename(params.originalFilename).replace(/\.pdf$/i, ''),
      flattenFormFields: params.flattenFormFields,
      fontResolver: key => this.resolveFontBytes(key),
      downscalePng: (bytes, maxW, maxH) => this.imageService.downscalePngBytes(bytes, maxW, maxH),
      rasterizeTextFallback: (text, size, color) => this.rasterizeUnsupportedTextFallback(text, size, color)
    });

    const blob = new Blob([result.pdfBytes.slice(0).buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const sizeBytes = blob.size;

    return {
      blob,
      url,
      filename: buildSignedFilename(params.originalFilename),
      sizeBytes,
      formattedSize: this.formatBytes(sizeBytes),
      fieldsApplied: result.fieldsApplied,
      pagesSigned: result.pagesSigned,
      warnings: [...(params.warningsPrefix || []), ...result.warnings],
      originalPageCount: params.pageCount
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

