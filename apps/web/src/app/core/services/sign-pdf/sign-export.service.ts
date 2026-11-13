import { Injectable, inject } from '@angular/core';
import { SignFieldElement } from '@paperflow/contracts';
import {
  applyDetachedPdfSignature,
  buildDetachedCmsSignedData,
  exportSignedPdf,
  parsePkcs12WithWebCrypto
} from '@paperflow/sign-core';
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
      originalPageCount: params.pageCount,
      signedMode: 'simple'
    };
  }

  /**
   * Signs the PDF purely in the browser using WebCrypto PBES2 (.p12/.pfx) + PAdES detached CMS.
   * Throws UnsupportedPkcs12CipherError if the certificate uses legacy 3DES/RC2 encryption.
   */
  async exportWithBrowserCertificate(params: {
    originalBytes: Uint8Array;
    originalFilename: string;
    pageCount: number;
    fields: SignFieldElement[];
    flattenFormFields: boolean;
    certBytes: Uint8Array;
    password: string;
    reason?: string;
    location?: string;
    warningsPrefix?: string[];
  }): Promise<SignExportOutcome> {
    const identity = await parsePkcs12WithWebCrypto(params.certBytes, params.password);

    let workingBytes = params.originalBytes;
    let fieldsApplied = 0;
    let pagesSigned: number[] = [];
    const warnings: string[] = [...(params.warningsPrefix || [])];

    if (params.fields.length > 0) {
      const visual = await exportSignedPdf(params.originalBytes, params.fields, {
        appName: 'PDFTailor',
        documentTitle: buildSignedFilename(params.originalFilename).replace(/\.pdf$/i, ''),
        flattenFormFields: params.flattenFormFields,
        fontResolver: key => this.resolveFontBytes(key),
        downscalePng: (bytes, maxW, maxH) => this.imageService.downscalePngBytes(bytes, maxW, maxH),
        rasterizeTextFallback: (text, size, color) => this.rasterizeUnsupportedTextFallback(text, size, color)
      });
      workingBytes = visual.pdfBytes;
      fieldsApplied = visual.fieldsApplied;
      pagesSigned = visual.pagesSigned;
      warnings.push(...visual.warnings);
    }

    const padesResult = await applyDetachedPdfSignature(
      workingBytes,
      {
        signerName: identity.commonName || 'Certificate Signer',
        reason: params.reason?.trim() || 'Digitally signed with PDFTailor',
        location: params.location?.trim() || ''
      },
      dataToSign => buildDetachedCmsSignedData(dataToSign, identity)
    );

    return this.createOutcomeFromBytes(padesResult.signedPdfBytes, {
      originalFilename: params.originalFilename,
      pageCount: params.pageCount,
      fieldsApplied,
      pagesSigned,
      warnings,
      certificateSubject: identity.commonName,
      certificateIssuer: identity.issuerCommonName,
      signedMode: 'browser_webcrypto'
    });
  }

  createOutcomeFromBlob(
    blob: Blob,
    meta: {
      originalFilename: string;
      pageCount: number;
      fieldsApplied: number;
      pagesSigned: number[];
      warnings?: string[];
      certificateSubject?: string;
      certificateIssuer?: string;
      signedMode: 'simple' | 'browser_webcrypto' | 'server_openssl';
    }
  ): SignExportOutcome {
    const url = URL.createObjectURL(blob);
    const sizeBytes = blob.size;
    return {
      blob,
      url,
      filename: buildSignedFilename(meta.originalFilename),
      sizeBytes,
      formattedSize: this.formatBytes(sizeBytes),
      fieldsApplied: meta.fieldsApplied,
      pagesSigned: meta.pagesSigned,
      warnings: meta.warnings || [],
      originalPageCount: meta.pageCount,
      certificateSubject: meta.certificateSubject,
      certificateIssuer: meta.certificateIssuer,
      signedMode: meta.signedMode
    };
  }

  private createOutcomeFromBytes(
    pdfBytes: Uint8Array,
    meta: {
      originalFilename: string;
      pageCount: number;
      fieldsApplied: number;
      pagesSigned: number[];
      warnings: string[];
      certificateSubject?: string;
      certificateIssuer?: string;
      signedMode: 'simple' | 'browser_webcrypto' | 'server_openssl';
    }
  ): SignExportOutcome {
    const blob = new Blob([pdfBytes.slice(0).buffer], { type: 'application/pdf' });
    return this.createOutcomeFromBlob(blob, meta);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

