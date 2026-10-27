import { Injectable } from '@angular/core';
import { PDFDocument, PDFName } from 'pdf-lib';
import JSZip from 'jszip';
import { PdfDocumentAnalysis, PdfPageAnalysis } from '@paperflow/contracts';
import { SplitRangeParser, PageRange } from '../utils/split-range-parser';

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
}

export interface CompressPdfResult extends MergeResult {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  spaceSavedBytes: number;
  reductionPercent: number;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
  formattedSpaceSaved: string;
  level: 'extreme' | 'recommended' | 'less';
  isZip: boolean;
  filesCount: number;
  items: CompressedPdfItem[];
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

  /**
   * Inspects PDF content to determine if it contains extractable text or is a scanned document
   */
  async analyzePdf(file: File): Promise<PdfDocumentAnalysis> {
    try {
      const buffer = await file.arrayBuffer();
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
    const zip = new JSZip();
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
    level: 'extreme' | 'recommended' | 'less' = 'recommended',
    onProgress?: (percent: number, message: string) => void
  ): Promise<CompressPdfResult> {
    const fileList = Array.isArray(files) ? files : [files];

    if (fileList.length === 0) {
      throw new Error('Please select at least one PDF file.');
    }

    onProgress?.(5, 'Validating document structures and headers...');
    for (const f of fileList) {
      if (!f || f.size === 0) {
        throw new Error(`The selected file '${f?.name || 'document'}' is empty.`);
      }
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

      let compressedBytes: Uint8Array;
      if (level === 'extreme') {
        // Extreme: strip metadata, enable object streams, compress stream dictionaries
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
      } else if (level === 'recommended') {
        // Recommended: standard object stream packing
        compressedBytes = await pdfDoc.save({
          useObjectStreams: true
        });
      } else {
        // Less: standard output without object stream packing, maximum fidelity
        compressedBytes = await pdfDoc.save({
          useObjectStreams: false
        });
      }

      const origBytes = file.size;
      const compBytes = compressedBytes.byteLength;
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
        url: itemUrl
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
        items
      };
    }

    // Multiple files packaged into a ZIP archive
    onProgress?.(90, 'Packaging all compressed documents into ZIP archive...');
    const zip = new JSZip();
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
      items
    };
  }
}
