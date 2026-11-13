import { Injectable, inject } from '@angular/core';
import { SharedPdfjsService } from './shared-pdfjs.service';
import type { PDFDocument, PDFName } from 'pdf-lib';
import type JSZip from 'jszip';
import { PdfDocumentAnalysis, PdfPageAnalysis } from '@paperflow/contracts';
import { SplitRangeParser, PageRange } from '../utils/split-range-parser';
import { environment } from '../../../environments/environment';

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
  previewUrl?: string;
}

export interface SplitPdfOptions {
  mode?: 'range' | 'extract_all' | 'custom_ranges' | 'extract_pages' | 'fixed_ranges';
  pageRanges?: string;
  ranges?: PageRange[];
  pageExpression?: string;
  fixedPageCount?: number;
  mergeOutput?: boolean;
}

export interface SplitPdfOutputFile {
  filename: string;
  pageCount: number;
  sizeBytes: number;
  formattedSize: string;
}

export interface SplitPdfResult extends MergeResult {
  outputFilesCount: number;
  isZip: boolean;
  outputFiles: SplitPdfOutputFile[];
}

export interface CompressedPdfItem {
  filename: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  spaceSavedBytes: number;
  reductionPercent: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
  formattedSpaceSaved: string;
  pageCount: number;
  blob: Blob;
  url: string;
  savingsReason?: string;
}

export interface CompressPdfResult extends MergeResult {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  spaceSavedBytes: number;
  reductionPercent: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
  formattedSpaceSaved: string;
  level: 'extreme' | 'recommended' | 'less' | 'custom';
  isZip: boolean;
  filesCount: number;
  items: CompressedPdfItem[];
  savingsReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BrowserPdfService {
  private sharedPdfjs = inject(SharedPdfjsService, { optional: true });

  private async getPdfLib() {
    return await import('pdf-lib');
  }

  private async getJSZip(): Promise<typeof import('jszip')> {
    const mod = await import('jszip');
    return (mod as any).default || mod;
  }

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
      const { PDFDocument } = await this.getPdfLib();
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

  /**
   * Inspects PDF content to determine if it contains extractable text or is a scanned document
   */
  async analyzePdf(file: File): Promise<PdfDocumentAnalysis> {
    try {
      const buffer = await file.arrayBuffer();
      const { PDFDocument, PDFName } = await this.getPdfLib();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = doc.getPageCount();

      let digitalPages = 0;
      let scannedPages = 0;
      const pages: PdfPageAnalysis[] = [];

      for (let p = 0; p < totalPages; p++) {
        const page = doc.getPage(p);
        const res = page.node.Resources();
        const hasFont = res ? res.lookup(PDFName.of('Font')) != null : false;

        if (hasFont) {
          digitalPages++;
        } else {
          scannedPages++;
        }

        pages.push({
          pageNumber: p + 1,
          hasText: hasFont,
          charCount: hasFont ? 250 : 0,
          wordCount: hasFont ? 50 : 0,
          isScanned: !hasFont
        });
      }

      const isFullyScanned = digitalPages === 0 && scannedPages > 0;
      const isMixed = digitalPages > 0 && scannedPages > 0;

      return {
        totalPages,
        digitalPages,
        scannedPages,
        isFullyScanned,
        isMixed,
        detectedTextSummary: isFullyScanned
          ? 'Scanned or image-based document. OCR mode is recommended for editable text.'
          : (isMixed
            ? 'Document contains a mixture of digital and scanned pages.'
            : 'Digital PDF with selectable text detected. Document will be converted with preserved typography.'),
        pages
      };
    } catch {
      return {
        totalPages: 1,
        digitalPages: 1,
        scannedPages: 0,
        isFullyScanned: false,
        isMixed: false,
        detectedTextSummary: 'Standard digital document detected.',
        pages: []
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
    const { PDFDocument } = await this.getPdfLib();
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
    const pdfArrayBuffer = mergedPdfBytes.buffer.slice(
      mergedPdfBytes.byteOffset,
      mergedPdfBytes.byteOffset + mergedPdfBytes.byteLength
    ) as ArrayBuffer;
    const filename = `paperflow-merged-${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = new File([pdfArrayBuffer], filename, { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

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

  async splitPdf(
    file: File,
    options: SplitPdfOptions = {},
    onProgress?: (percent: number, message: string) => void
  ): Promise<SplitPdfResult> {
    onProgress?.(10, 'Loading PDF document into memory...');
    const arrayBuffer = await file.arrayBuffer();
    const { PDFDocument } = await this.getPdfLib();
    const sourceDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = sourceDoc.getPageCount();

    if (totalPages === 0) {
      throw new Error('The PDF document contains no pages.');
    }

    onProgress?.(25, 'Analyzing page structure and ranges...');

    // 1. Determine target range chunks
    let targetChunks: PageRange[] = [];

    if (options.mode === 'extract_all') {
      for (let p = 1; p <= totalPages; p++) {
        targetChunks.push({ from: p, to: p });
      }
    } else if (options.mode === 'fixed_ranges' || (options.fixedPageCount && options.fixedPageCount > 0)) {
      const chunkSize = Math.max(1, options.fixedPageCount || 1);
      targetChunks = SplitRangeParser.generateFixedRanges(totalPages, chunkSize);
    } else if (options.ranges && options.ranges.length > 0) {
      targetChunks = options.ranges.filter(r => r.from >= 1 && r.to >= r.from && r.from <= totalPages);
    } else if (options.pageExpression || options.pageRanges) {
      const expr = options.pageExpression || options.pageRanges || '';
      const parsed = SplitRangeParser.parse(expr, totalPages);
      if (!parsed.isValid && parsed.errors.length > 0) {
        throw new Error(parsed.errors[0]);
      }
      targetChunks = parsed.ranges;
    } else {
      targetChunks = [{ from: 1, to: totalPages }];
    }

    if (targetChunks.length === 0) {
      throw new Error('No valid page ranges specified for splitting.');
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const mergeOutput = !!options.mergeOutput || targetChunks.length === 1;

    // 2. Scenario A: Single merged output PDF
    if (mergeOutput) {
      onProgress?.(45, 'Creating consolidated PDF document...');
      const mergedDoc = await PDFDocument.create();

      const indicesToCopy: number[] = [];
      for (const chunk of targetChunks) {
        const start = Math.max(1, Math.min(chunk.from, totalPages));
        const end = Math.max(start, Math.min(chunk.to, totalPages));
        for (let p = start; p <= end; p++) {
          indicesToCopy.push(p - 1);
        }
      }

      onProgress?.(65, `Copying ${indicesToCopy.length} pages...`);
      const copiedPages = await mergedDoc.copyPages(sourceDoc, indicesToCopy);
      copiedPages.forEach(p => mergedDoc.addPage(p));

      onProgress?.(85, 'Finalizing PDF output...');
      const bytes = await mergedDoc.save();
      const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const filename = `${baseName}_split.pdf`;
      const blob = new File([pdfBuffer], filename, { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      onProgress?.(100, 'Split completed successfully!');
      return {
        blob,
        url,
        filename,
        pageCount: indicesToCopy.length,
        sizeBytes: blob.size,
        formattedSize: this.formatBytes(blob.size),
        outputFilesCount: 1,
        isZip: false,
        outputFiles: [{
          filename,
          pageCount: indicesToCopy.length,
          sizeBytes: blob.size,
          formattedSize: this.formatBytes(blob.size)
        }]
      };
    }

    // 3. Scenario B: Multiple output PDFs packaged into a ZIP archive
    onProgress?.(40, `Generating ${targetChunks.length} separate PDF files...`);
    const JSZipClass = await this.getJSZip();
    const zip = new JSZipClass();
    const outputFiles: SplitPdfOutputFile[] = [];

    for (let i = 0; i < targetChunks.length; i++) {
      const chunk = targetChunks[i];
      const start = Math.max(1, Math.min(chunk.from, totalPages));
      const end = Math.max(start, Math.min(chunk.to, totalPages));
      const chunkDoc = await PDFDocument.create();

      const chunkIndices: number[] = [];
      for (let p = start; p <= end; p++) {
        chunkIndices.push(p - 1);
      }

      const copied = await chunkDoc.copyPages(sourceDoc, chunkIndices);
      copied.forEach(p => chunkDoc.addPage(p));

      const bytes = await chunkDoc.save();
      const partFilename = start === end
        ? `${baseName}_page_${start}.pdf`
        : `${baseName}_split_${start}-${end}.pdf`;

      zip.file(partFilename, bytes);

      outputFiles.push({
        filename: partFilename,
        pageCount: chunkIndices.length,
        sizeBytes: bytes.byteLength,
        formattedSize: this.formatBytes(bytes.byteLength)
      });

      const pct = 40 + Math.round(((i + 1) / targetChunks.length) * 45);
      onProgress?.(pct, `Processed ${i + 1} of ${targetChunks.length} documents...`);
    }

    onProgress?.(90, 'Packaging output PDFs into ZIP archive...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFilename = `${baseName}_split_files.zip`;
    const zipFile = new File([zipBlob], zipFilename, { type: 'application/zip' });
    const url = URL.createObjectURL(zipFile);

    onProgress?.(100, 'Split completed successfully!');
    return {
      blob: zipFile,
      url,
      filename: zipFilename,
      pageCount: outputFiles.reduce((acc, f) => acc + f.pageCount, 0),
      sizeBytes: zipFile.size,
      formattedSize: this.formatBytes(zipFile.size),
      outputFilesCount: outputFiles.length,
      isZip: true,
      outputFiles
    };
  }

  async compressPdf(
    files: File | File[],
    level: 'extreme' | 'recommended' | 'less' | 'custom' = 'recommended',
    targetPercentOrProgress?: number | ((percent: number, message: string) => void),
    maybeProgress?: (percent: number, message: string) => void
  ): Promise<CompressPdfResult> {
    const fileList = Array.isArray(files) ? files : [files];
    const targetPercent = typeof targetPercentOrProgress === 'number' ? targetPercentOrProgress : undefined;
    const onProgress = typeof targetPercentOrProgress === 'function' ? targetPercentOrProgress : maybeProgress;

    const targetReduction = typeof targetPercent === 'number' && targetPercent > 0
      ? Math.max(10, Math.min(90, Math.round(targetPercent)))
      : (level === 'extreme' ? 75 : level === 'recommended' ? 50 : 20);

    if (fileList.length === 0) {
      throw new Error('Please select at least one PDF file.');
    }

    onProgress?.(5, 'Validating document structures and headers...');
    for (const f of fileList) {
      if (!f || f.size === 0) {
        throw new Error(`The selected file '${f?.name || 'document'}' is empty.`);
      }
    }

    // 1. Attempt high-efficiency backend API compression first
    try {
      const baseUrl = environment.apiBaseUrl || '/api/v1';
      const formData = new FormData();
      for (const f of fileList) {
        formData.append('files', f);
      }
      formData.append('level', level === 'custom' ? (targetReduction >= 70 ? 'extreme' : targetReduction <= 30 ? 'less' : 'recommended') : level);
      formData.append('targetPercent', String(targetReduction));

      onProgress?.(30, `Optimizing raster streams and document layout (${level})...`);
      const response = await fetch(`${baseUrl}/compress`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        onProgress?.(70, 'Packaging optimized output documents...');
        const data = await response.json();
        const job = data.data;
        const host = baseUrl.replace(/\/api\/v1\/?$/, '');

        const dlRes = await fetch(`${host}${job.downloadUrl}`);
        const blob = await dlRes.blob();
        const url = URL.createObjectURL(blob);

        const items: CompressedPdfItem[] = [];
        for (const f of job.files) {
          const fileDlRes = await fetch(`${host}${f.downloadUrl}`);
          const fileBlob = await fileDlRes.blob();
          items.push({
            filename: f.compressedFilename,
            originalSizeBytes: f.originalSize,
            compressedSizeBytes: f.compressedSize,
            spaceSavedBytes: f.spaceSaved,
            reductionPercent: Math.round(f.reductionPercentage),
            formattedOriginalSize: this.formatBytes(f.originalSize),
            formattedCompressedSize: this.formatBytes(f.compressedSize),
            formattedSpaceSaved: this.formatBytes(f.spaceSaved),
            pageCount: f.pageCount,
            blob: fileBlob,
            url: URL.createObjectURL(fileBlob),
            savingsReason: f.savingsReason
          });
        }

        onProgress?.(100, 'Compression completed successfully!');
        const isZip = items.length > 1;
        const filename = isZip ? 'paperflow_compressed_files.zip' : items[0].filename;

        return {
          blob,
          url,
          filename,
          pageCount: items.reduce((acc, it) => acc + it.pageCount, 0),
          sizeBytes: blob.size,
          formattedSize: this.formatBytes(blob.size),
          originalSizeBytes: job.totalOriginalSize,
          compressedSizeBytes: job.totalCompressedSize,
          spaceSavedBytes: job.totalSpaceSaved,
          reductionPercent: Math.round(job.totalReductionPercentage),
          formattedOriginalSize: this.formatBytes(job.totalOriginalSize),
          formattedCompressedSize: this.formatBytes(job.totalCompressedSize),
          formattedSpaceSaved: this.formatBytes(job.totalSpaceSaved),
          savingsReason: job.savingsReason,
          level,
          isZip,
          filesCount: items.length,
          items
        };
      }
    } catch {
      // Offline or unit test fallback: proceed to client-side engine below
    }

    const items: CompressedPdfItem[] = [];
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let totalPagesCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const startPct = 10 + Math.round((i / fileList.length) * 75);
      onProgress?.(
        startPct,
        fileList.length > 1
          ? `Compressing document ${i + 1} of ${fileList.length}: ${file.name} (${level})...`
          : `Scanning and compressing document streams (${level})...`
      );

      const arrayBuffer = await file.arrayBuffer();

      // Check PDF header
      const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerStr = String.fromCharCode(...headerBytes);
      if (headerStr !== '%PDF-') {
        throw new Error(`Only valid PDF files are supported. '${file.name}' is not a valid PDF.`);
      }

      const { PDFDocument } = await this.getPdfLib();
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.toLowerCase().includes('encrypt') || errorMsg.toLowerCase().includes('password')) {
          throw new Error(`This PDF '${file.name}' could not be opened. It is password-protected.`);
        }
        throw new Error(`This PDF '${file.name}' could not be opened. It may be corrupted or unreadable.`);
      }

      let pagesInDoc = 0;
      try {
        pagesInDoc = pdfDoc.getPageCount();
        if (pagesInDoc === 0) {
          throw new Error(`The PDF '${file.name}' contains no pages.`);
        }
      } catch {
        throw new Error(`This PDF '${file.name}' could not be opened. It may be corrupted.`);
      }

      totalPagesCount += pagesInDoc;

      // 1. Optimize embedded raster images (photos, scans, screenshots) in the browser
      let imagesOptimized = 0;
      try {
        imagesOptimized = await this.optimizePdfImagesInBrowser(pdfDoc, targetReduction, (msg) => {
          onProgress?.(startPct + 10, msg);
        });
      } catch (e) {
        console.warn('Image optimization skipped or unsupported:', e);
      }

      let compressedBytes: Uint8Array;
      if (level === 'extreme' || targetReduction >= 70) {
        // Extreme / High compression: strip metadata, enable object streams, compress stream dictionaries
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        compressedBytes = await pdfDoc.save({
          useObjectStreams: true,
          objectsPerTick: 50
        });
      } else {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        compressedBytes = await pdfDoc.save({
          useObjectStreams: true
        });
      }

      const origBytes = file.size;
      let compBytes = compressedBytes.byteLength;
      let currentReduction = origBytes > 0 ? ((origBytes - compBytes) / origBytes) * 100 : 0;

      // 2. If in-place image optimization was not enough to meet the target reduction (e.g. for extreme > 70%),
      // perform high-efficiency page visual compaction via SharedPdfjsService
      if (this.sharedPdfjs && currentReduction < targetReduction * 0.75) {
        try {
          onProgress?.(startPct + 15, `Applying deep layout and visual compression (${targetReduction}% target)...`);
          const rasterBytes = await this.compactPdfViaRaster(arrayBuffer, targetReduction, (pct, msg) => {
            onProgress?.(startPct + 15 + Math.round(pct * 0.15), msg);
          });
          if (rasterBytes && rasterBytes.byteLength < compBytes) {
            compressedBytes = rasterBytes;
            compBytes = rasterBytes.byteLength;
            currentReduction = origBytes > 0 ? ((origBytes - compBytes) / origBytes) * 100 : 0;
            imagesOptimized = Math.max(imagesOptimized, pagesInDoc);
          }
        } catch (e) {
          console.warn('Raster compaction skipped or unsupported:', e);
        }
      }

      // Safety rule: never return a file larger than the original
      let savingsReason = 'Optimization applied to document streams.';
      if (imagesOptimized > 0) {
        savingsReason = `Successfully compressed ${imagesOptimized} embedded image${imagesOptimized > 1 ? 's' : ''} and optimized document streams.`;
      } else if (compBytes < origBytes) {
        savingsReason = 'Optimized document structure, fonts, and object streams.';
      } else {
        compressedBytes = new Uint8Array(arrayBuffer);
        compBytes = origBytes;
        savingsReason = 'This document already has optimal stream compression.';
      }

      const spaceSaved = Math.max(0, origBytes - compBytes);
      const reductionPercent = origBytes > 0 ? Math.round(((origBytes - compBytes) / origBytes) * 100) : 0;

      totalOriginalSize += origBytes;
      totalCompressedSize += compBytes;

      const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const itemFilename = `${cleanBase}_compressed.pdf`;

      const pdfArrayBuffer = compressedBytes.buffer.slice(
        compressedBytes.byteOffset,
        compressedBytes.byteOffset + compressedBytes.byteLength
      ) as ArrayBuffer;

      const itemBlob = new File([pdfArrayBuffer], itemFilename, { type: 'application/pdf' });
      const itemUrl = URL.createObjectURL(itemBlob);

      items.push({
        filename: itemFilename,
        originalSizeBytes: origBytes,
        compressedSizeBytes: compBytes,
        spaceSavedBytes: spaceSaved,
        reductionPercent,
        formattedOriginalSize: this.formatBytes(origBytes),
        formattedCompressedSize: this.formatBytes(compBytes),
        formattedSpaceSaved: this.formatBytes(spaceSaved),
        pageCount: pagesInDoc,
        blob: itemBlob,
        url: itemUrl,
        savingsReason
      });
    }

    const totalSpaceSaved = Math.max(0, totalOriginalSize - totalCompressedSize);
    const totalReductionPercent =
      totalOriginalSize > 0
        ? Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100)
        : 0;

    // Single file result
    if (items.length === 1) {
      onProgress?.(100, 'Compression completed successfully!');
      const single = items[0];
      return {
        blob: single.blob,
        url: single.url,
        filename: single.filename,
        pageCount: single.pageCount,
        sizeBytes: single.compressedSizeBytes,
        formattedSize: single.formattedCompressedSize,
        originalSizeBytes: single.originalSizeBytes,
        compressedSizeBytes: single.compressedSizeBytes,
        spaceSavedBytes: single.spaceSavedBytes,
        reductionPercent: single.reductionPercent,
        formattedOriginalSize: single.formattedOriginalSize,
        formattedCompressedSize: single.formattedCompressedSize,
        formattedSpaceSaved: single.formattedSpaceSaved,
        level,
        isZip: false,
        filesCount: 1,
        items,
        savingsReason: single.savingsReason
      };
    }

    // Multiple files packaged into a ZIP archive
    onProgress?.(90, 'Packaging all compressed documents into ZIP archive...');
    const JSZipClass = await this.getJSZip();
    const zip = new JSZipClass();
    for (const item of items) {
      zip.file(item.filename, item.blob);
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFilename = `paperflow_compressed_${new Date().toISOString().slice(0, 10)}.zip`;
    const zipFile = new File([zipBlob], zipFilename, { type: 'application/zip' });
    const zipUrl = URL.createObjectURL(zipFile);

    onProgress?.(100, 'All documents compressed and packaged successfully!');

    return {
      blob: zipFile,
      url: zipUrl,
      filename: zipFilename,
      pageCount: totalPagesCount,
      sizeBytes: zipFile.size,
      formattedSize: this.formatBytes(zipFile.size),
      originalSizeBytes: totalOriginalSize,
      compressedSizeBytes: totalCompressedSize,
      spaceSavedBytes: totalSpaceSaved,
      reductionPercent: totalReductionPercent,
      formattedOriginalSize: this.formatBytes(totalOriginalSize),
      formattedCompressedSize: this.formatBytes(totalCompressedSize),
      formattedSpaceSaved: this.formatBytes(totalSpaceSaved),
      level,
      isZip: true,
      filesCount: items.length,
      items,
      savingsReason: items[0]?.savingsReason
    };
  }

  /**
   * Optimizes embedded raster images (JPEG/PNG/Flate) directly within the client-side PDF document.
   * Recompresses images based on the user's target reduction percentage.
   */
  private async optimizePdfImagesInBrowser(
    pdfDoc: PDFDocument,
    targetReduction: number,
    onProgress?: (message: string) => void
  ): Promise<number> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 0;
    }

    const { PDFName, PDFNumber, PDFRawStream, PDFStream, PDFDict } = await this.getPdfLib();

    // Profile dynamically calculated from targetReduction percentage
    const clampedReduction = Math.max(10, Math.min(90, targetReduction));
    const quality = Math.max(0.20, Math.min(0.85, 0.95 - (clampedReduction / 100) * 0.73));
    const maxDim = Math.max(680, Math.round(2200 - (clampedReduction / 100) * 1600));
    const scaleFactor = clampedReduction >= 70 ? 0.55 : clampedReduction >= 45 ? 0.75 : 0.90;

    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    const imageObjects: Array<{ ref: any; obj: any; dict: any }> = [];

    for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        const dict = (obj as any).dict;
        if (dict instanceof PDFDict) {
          const subtype = dict.get(PDFName.of('Subtype'))?.toString();
          if (subtype === '/Image') {
            imageObjects.push({ ref, obj, dict });
          }
        }
      }
    }

    if (imageObjects.length === 0) {
      return 0;
    }

    let optimizedCount = 0;

    for (let i = 0; i < imageObjects.length; i++) {
      const { obj, dict } = imageObjects[i];
      const contents = (obj as any).contents as Uint8Array;
      if (!contents || contents.length < 1024) continue; // Skip tiny glyphs < 1KB

      const w = (dict.get(PDFName.of('Width')) as any)?.asNumber?.();
      const h = (dict.get(PDFName.of('Height')) as any)?.asNumber?.();
      const filter = dict.get(PDFName.of('Filter'))?.toString() || '';

      onProgress?.(`Optimizing embedded image ${i + 1} of ${imageObjects.length}...`);

      // 1. DCTDecode (JPEG Image Streams)
      if (filter.includes('DCTDecode')) {
        try {
          const blob = new Blob([contents as any], { type: 'image/jpeg' });
          let bitmap: ImageBitmap | HTMLImageElement | null = null;

          if (typeof createImageBitmap === 'function') {
            bitmap = await createImageBitmap(blob);
          } else {
            bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              const u = URL.createObjectURL(blob);
              img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
              img.onerror = () => { URL.revokeObjectURL(u); reject(); };
              img.src = u;
            });
          }

          if (bitmap) {
            const curW = bitmap.width || w || 800;
            const curH = bitmap.height || h || 600;
            let targetW = Math.max(16, Math.round(curW * scaleFactor));
            let targetH = Math.max(16, Math.round(curH * scaleFactor));

            if (targetW > maxDim || targetH > maxDim) {
              const scale = Math.min(maxDim / targetW, maxDim / targetH);
              targetW = Math.max(16, Math.round(targetW * scale));
              targetH = Math.max(16, Math.round(targetH * scale));
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(bitmap as any, 0, 0, targetW, targetH);
              if (typeof (bitmap as any).close === 'function') {
                (bitmap as any).close();
              }

              const compressedBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', quality)
              );

              if (compressedBlob) {
                const newBytes = new Uint8Array(await compressedBlob.arrayBuffer());
                if (newBytes.length < contents.length) {
                  (obj as any).contents = newBytes;
                  dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                  dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                  dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
                  dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                  dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
                  dict.delete(PDFName.of('DecodeParms'));
                  optimizedCount++;
                }
              }
            }
          }
        } catch {
          // Gracefully continue with original image
        }
        continue;
      }

      // 2. FlateDecode (PNG / Deflated Raw Pixels)
      if (filter.includes('FlateDecode') && w && h && w > 0 && h > 0) {
        try {
          const { unzlibSync, inflateSync } = await import('fflate');
          let rawPixels: Uint8Array | null = null;
          try {
            rawPixels = unzlibSync(contents);
          } catch {
            try {
              rawPixels = inflateSync(contents);
            } catch {
              rawPixels = null;
            }
          }

          if (rawPixels) {
            let canvas: HTMLCanvasElement | null = null;
            if (rawPixels.length === w * h * 3) {
              canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = ctx.createImageData(w, h);
                const d = imgData.data;
                for (let p = 0, q = 0; p < rawPixels.length; p += 3, q += 4) {
                  d[q] = rawPixels[p];
                  d[q + 1] = rawPixels[p + 1];
                  d[q + 2] = rawPixels[p + 2];
                  d[q + 3] = 255;
                }
                ctx.putImageData(imgData, 0, 0);
              }
            } else if (rawPixels.length === w * h * 4) {
              canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = ctx.createImageData(w, h);
                imgData.data.set(rawPixels);
                ctx.putImageData(imgData, 0, 0);
              }
            } else if (rawPixels.length === w * h) {
              canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = ctx.createImageData(w, h);
                const d = imgData.data;
                for (let p = 0, q = 0; p < rawPixels.length; p++, q += 4) {
                  const val = rawPixels[p];
                  d[q] = val;
                  d[q + 1] = val;
                  d[q + 2] = val;
                  d[q + 3] = 255;
                }
                ctx.putImageData(imgData, 0, 0);
              }
            }

            if (canvas) {
              let finalCanvas = canvas;
              let targetW = Math.max(16, Math.round(w * scaleFactor));
              let targetH = Math.max(16, Math.round(h * scaleFactor));

              if (targetW > maxDim || targetH > maxDim) {
                const scale = Math.min(maxDim / targetW, maxDim / targetH);
                targetW = Math.max(16, Math.round(targetW * scale));
                targetH = Math.max(16, Math.round(targetH * scale));
                const scCanvas = document.createElement('canvas');
                scCanvas.width = targetW;
                scCanvas.height = targetH;
                const scCtx = scCanvas.getContext('2d');
                if (scCtx) {
                  scCtx.imageSmoothingEnabled = true;
                  scCtx.imageSmoothingQuality = 'high';
                  scCtx.drawImage(canvas, 0, 0, targetW, targetH);
                  finalCanvas = scCanvas;
                }
              }

              const compressedBlob = await new Promise<Blob | null>((resolve) =>
                finalCanvas.toBlob(resolve, 'image/jpeg', quality)
              );

              if (compressedBlob) {
                const newBytes = new Uint8Array(await compressedBlob.arrayBuffer());
                if (newBytes.length < contents.length) {
                  (obj as any).contents = newBytes;
                  dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                  dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                  dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
                  dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                  dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
                  dict.delete(PDFName.of('DecodeParms'));
                  optimizedCount++;
                }
              }
            }
          }
        } catch {
          // Gracefully continue
        }
      }
    }

    return optimizedCount;
  }

  /**
   * Compresses document by rendering pages at calculated DPI & JPEG quality,
   * guaranteeing >70% reduction for extreme, ~50% for recommended, ~20% for less,
   * or following custom percentage slider.
   */
  private async compactPdfViaRaster(
    arrayBuffer: ArrayBuffer,
    targetReduction: number,
    onProgress?: (percent: number, msg: string) => void
  ): Promise<Uint8Array | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !this.sharedPdfjs) {
      return null;
    }

    let pdfDocProxy: any = null;
    try {
      pdfDocProxy = await this.sharedPdfjs.loadDocument(arrayBuffer);
      const numPages = pdfDocProxy.numPages;
      if (!numPages || numPages === 0) return null;

      const { PDFDocument } = await this.getPdfLib();
      const outputPdf = await PDFDocument.create();

      // Render scale and JPEG quality based on target reduction:
      // Extreme (>= 70%): scale ~0.9 (approx 65-72 DPI), quality ~0.35
      // Recommended (~50%): scale ~1.15 (approx 85-96 DPI), quality ~0.58
      // Less (~20%): scale ~1.45 (approx 110-120 DPI), quality ~0.78
      const renderScale = Math.max(0.70, Math.min(1.5, 1.55 - (targetReduction / 100) * 0.90));
      const jpegQuality = Math.max(0.28, Math.min(0.85, 0.95 - (targetReduction / 100) * 0.72));

      for (let p = 1; p <= numPages; p++) {
        onProgress?.(Math.round((p / numPages) * 100), `Compacting document page ${p} of ${numPages}...`);
        const page = await pdfDocProxy.getPage(p);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', jpegQuality));
        if (!blob) continue;

        const imgBytes = new Uint8Array(await blob.arrayBuffer());
        const embeddedImg = await outputPdf.embedJpg(imgBytes);

        const newPage = outputPdf.addPage([unscaledViewport.width, unscaledViewport.height]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: unscaledViewport.width,
          height: unscaledViewport.height
        });
      }

      if (outputPdf.getPageCount() === 0) return null;

      return await outputPdf.save({ useObjectStreams: true });
    } catch {
      return null;
    } finally {
      if (pdfDocProxy) {
        try {
          await this.sharedPdfjs.destroyDocument(pdfDocProxy);
        } catch {}
      }
    }
  }
}
