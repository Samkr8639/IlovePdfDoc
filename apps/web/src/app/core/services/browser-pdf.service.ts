import { Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

export interface ValidatedPdfFile {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  formattedSize: string;
  pageCount: number;
  isValid: boolean;
  error?: string;
}

export interface MergeResult {
  blob: Blob;
  url: string;
  filename: string;
  pageCount: number;
  sizeBytes: number;
  formattedSize: string;
}

@Injectable({
  providedIn: 'root'
})
export class BrowserPdfService {

  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async validatePdf(file: File): Promise<ValidatedPdfFile> {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const baseInfo = {
      id,
      file,
      name: file.name,
      sizeBytes: file.size,
      formattedSize: this.formatBytes(file.size)
    };

    // Check MIME type or extension
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfExt && file.type !== 'application/pdf') {
      return {
        ...baseInfo,
        pageCount: 0,
        isValid: false,
        error: 'Unsupported file type. Only PDF documents (.pdf) are allowed.'
      };
    }

    try {
      const buffer = await file.arrayBuffer();

      // Check PDF magic header '%PDF-'
      const header = new Uint8Array(buffer.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      if (!headerStr.startsWith('%PDF-')) {
        return {
          ...baseInfo,
          pageCount: 0,
          isValid: false,
          error: 'Invalid PDF format. The file does not have a valid PDF header.'
        };
      }

      // Load document to count pages
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      return {
        ...baseInfo,
        pageCount,
        isValid: true
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Corrupted or unreadable PDF document';
      return {
        ...baseInfo,
        pageCount: 0,
        isValid: false,
        error: `Could not parse PDF: ${message}`
      };
    }
  }

  async mergePdfs(
    files: File[],
    onProgress?: (percent: number, message: string) => void
  ): Promise<MergeResult> {
    if (files.length < 2) {
      throw new Error('At least 2 PDF files are required to merge.');
    }

    onProgress?.(5, 'Initializing PDF engine in browser...');
    const mergedDoc = await PDFDocument.create();
    let totalPages = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progressPercent = Math.round(10 + (i / files.length) * 75);
      onProgress?.(
        progressPercent,
        `Reading document ${i + 1} of ${files.length}: ${file.name}`
      );

      const arrayBuffer = await file.arrayBuffer();
      const donorDoc = await PDFDocument.load(arrayBuffer);
      const donorPages = await mergedDoc.copyPages(
        donorDoc,
        donorDoc.getPageIndices()
      );

      donorPages.forEach((page) => mergedDoc.addPage(page));
      totalPages += donorPages.length;
    }

    onProgress?.(90, 'Assembling and optimizing final PDF document...');
    const mergedPdfBytes = await mergedDoc.save();

    onProgress?.(98, 'Generating download package...');
    const blob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const filename = `paperflow-merged-${new Date().toISOString().slice(0, 10)}.pdf`;

    onProgress?.(100, 'Merge completed successfully!');

    return {
      blob,
      url,
      filename,
      pageCount: totalPages,
      sizeBytes: blob.size,
      formattedSize: this.formatBytes(blob.size)
    };
  }
}
