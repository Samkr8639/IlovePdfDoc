import { Injectable } from '@angular/core';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { SharedPdfjsService } from '../shared-pdfjs.service';
import {
  PdfToJpgOptions,
  PdfToJpgConversionResult,
  ConvertedPageItem,
  ExtractedImageItem
} from '@paperflow/contracts';
import { parsePageRange } from './range-parser';
import { embedJpegDpi, isValidJpeg } from './jfif-patcher';
import { calculateSafeRenderDpi, checkCombinedHeightLimit } from './canvas-limits';
import {
  buildPageFilename,
  buildExtractedImageFilename,
  buildZipFilename,
  buildCombinedFilename
} from './filename-builder';
import { createStreamingZip } from './streaming-zip';
import { computeImageHash } from './image-hash';

export interface ConversionProgress {
  current: number;
  total: number;
  percent: number;
  statusText: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfToJpgService {
  constructor(private pdfjs: SharedPdfjsService) {}

  /**
   * Main entry point to convert a PDF file or extract images according to user options.
   */
  async convert(
    file: File | Uint8Array,
    filename: string,
    options: PdfToJpgOptions,
    onProgress?: (progress: ConversionProgress) => void,
    signal?: AbortSignal,
    password?: string
  ): Promise<PdfToJpgConversionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const fileBytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());

    const pdfDoc = await this.pdfjs.loadDocument(fileBytes, { password });

    try {
      if (options.mode === 'convert_pages') {
        return await this.convertPagesToJpg(
          pdfDoc,
          fileBytes,
          filename,
          options,
          warnings,
          startTime,
          onProgress,
          signal
        );
      } else {
        return await this.extractImagesFromPdf(
          pdfDoc,
          fileBytes,
          filename,
          options,
          warnings,
          startTime,
          onProgress,
          signal
        );
      }
    } finally {
      await this.pdfjs.destroyDocument(pdfDoc);
    }
  }

  /**
   * Quick page renderer for rendering a small thumbnail or sample page for DPI estimation.
   */
  async renderPageSample(
    pdfDoc: any,
    pageNumber: number,
    dpi: number,
    quality: number,
    backgroundColor = '#FFFFFF'
  ): Promise<{ width: number; height: number; blob: Blob; sizeBytes: number }> {
    const page = await pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('Could not obtain canvas 2D rendering context');

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob([], { type: 'image/jpeg' })), 'image/jpeg', quality);
    });

    const sizeBytes = blob.size;
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();

    return {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      blob,
      sizeBytes
    };
  }

  // ──────────────────────────────────────────────────────────────
  // MODE A: Convert Pages to JPG
  // ──────────────────────────────────────────────────────────────
  private async convertPagesToJpg(
    pdfDoc: any,
    fileBytes: Uint8Array,
    filename: string,
    options: PdfToJpgOptions,
    warnings: string[],
    startTime: number,
    onProgress?: (progress: ConversionProgress) => void,
    signal?: AbortSignal
  ): Promise<PdfToJpgConversionResult> {
    const totalPages = pdfDoc.numPages;
    const pagesOpt = options.convertPages;

    let targetPages: number[] = [];
    if (pagesOpt.pagesMode === 'all') {
      targetPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      const parsed = parsePageRange(pagesOpt.pageRange || `1-${totalPages}`, totalPages);
      targetPages = parsed.valid && parsed.pages.length > 0
        ? parsed.pages
        : Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    // Arrangement: Combined vertical strip
    if (pagesOpt.arrangement === 'combined') {
      return await this.renderCombinedPages(
        pdfDoc,
        targetPages,
        filename,
        fileBytes.length,
        options,
        warnings,
        startTime,
        onProgress,
        signal
      );
    }

    // Arrangement: Separate images per page
    const convertedPages: ConvertedPageItem[] = [];

    for (let idx = 0; idx < targetPages.length; idx++) {
      if (signal?.aborted) {
        throw new DOMException('Conversion cancelled by user', 'AbortError');
      }

      const pageNum = targetPages[idx];
      onProgress?.({
        current: idx + 1,
        total: targetPages.length,
        percent: Math.round(((idx + 1) / targetPages.length) * 90),
        statusText: `Converting page ${pageNum} of ${totalPages}...`
      });

      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Safe render DPI check
      const safeCalc = calculateSafeRenderDpi(
        unscaledViewport.width,
        unscaledViewport.height,
        pagesOpt.dpi
      );
      if (safeCalc.isReduced && safeCalc.warning) {
        warnings.push(`Page ${pageNum}: ${safeCalc.warning}`);
      }

      const effectiveDpi = safeCalc.safeDpi;
      const scale = effectiveDpi / 72;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not obtain canvas 2D context');

      // 1. Fill solid background color
      ctx.fillStyle = pagesOpt.backgroundColor || '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Render page
      const renderContext: any = {
        canvasContext: ctx,
        viewport,
        annotationMode: pagesOpt.includeAnnotations ? 1 : 0
      };

      await page.render(renderContext).promise;

      // 3. Optional Grayscale pass
      if (pagesOpt.grayscale) {
        this.applyGrayscale(ctx, canvas.width, canvas.height);
      }

      // 4. Encode to JPEG
      const rawBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
          'image/jpeg',
          pagesOpt.quality
        );
      });

      // 5. Embed DPI in JFIF APP0 header if requested
      let finalBlob = rawBlob;
      if (pagesOpt.embedDpi) {
        const rawBuffer = new Uint8Array(await rawBlob.arrayBuffer());
        if (isValidJpeg(rawBuffer)) {
          const patchedBuffer = embedJpegDpi(rawBuffer, effectiveDpi);
          finalBlob = new Blob([patchedBuffer as BlobPart], { type: 'image/jpeg' });
        }
      }

      const pageFilename = buildPageFilename(filename, pageNum, totalPages);
      const previewUrl = URL.createObjectURL(finalBlob);

      convertedPages.push({
        pageNumber: pageNum,
        filename: pageFilename,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        dpi: effectiveDpi,
        sizeBytes: finalBlob.size,
        blob: finalBlob,
        previewUrl,
        warning: safeCalc.isReduced ? safeCalc.warning : undefined
      });

      // Clean up canvas memory immediately
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      // Yield execution to keep browser UI responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    onProgress?.({
      current: targetPages.length,
      total: targetPages.length,
      percent: 95,
      statusText: 'Packaging output...'
    });

    const isSingleImage = convertedPages.length === 1;
    let zipBlob: Blob | undefined;
    let zipFilename: string | undefined;

    if (!isSingleImage) {
      zipFilename = buildZipFilename(filename, 'convert_pages');
      zipBlob = await createStreamingZip(
        convertedPages.map((p) => ({ name: p.filename, blob: p.blob }))
      );
    }

    const totalOutputSizeBytes = isSingleImage
      ? convertedPages[0].sizeBytes
      : zipBlob?.size || convertedPages.reduce((sum, p) => sum + p.sizeBytes, 0);

    return {
      jobId: `p2j-${Date.now()}`,
      mode: 'convert_pages',
      inputFilename: filename,
      originalSizeBytes: fileBytes.length,
      pages: convertedPages,
      images: [],
      isSingleImage,
      singleImageBlob: isSingleImage ? convertedPages[0].blob : undefined,
      singleImageFilename: isSingleImage ? convertedPages[0].filename : undefined,
      singleImagePreviewUrl: isSingleImage ? convertedPages[0].previewUrl : undefined,
      zipBlob,
      zipFilename,
      totalOutputSizeBytes,
      warnings,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Stitches all selected pages into a single continuous vertical JPEG image.
   */
  private async renderCombinedPages(
    pdfDoc: any,
    targetPages: number[],
    filename: string,
    originalSizeBytes: number,
    options: PdfToJpgOptions,
    warnings: string[],
    startTime: number,
    onProgress?: (progress: ConversionProgress) => void,
    signal?: AbortSignal
  ): Promise<PdfToJpgConversionResult> {
    const pagesOpt = options.convertPages;
    const pageViewports: any[] = [];
    let totalHeightPx = 0;
    let maxWidthPx = 0;

    // First pass: measure dimensions
    for (const pageNum of targetPages) {
      const page = await pdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: pagesOpt.dpi / 72 });
      pageViewports.push({ pageNum, page, width: Math.round(vp.width), height: Math.round(vp.height) });
      totalHeightPx += Math.round(vp.height);
      maxWidthPx = Math.max(maxWidthPx, Math.round(vp.width));
    }

    // Check JPEG height limit (65,535 px)
    const limitCheck = checkCombinedHeightLimit(totalHeightPx, maxWidthPx);
    let scaleRatio = 1.0;
    if (!limitCheck.safe) {
      scaleRatio = limitCheck.maxAllowedHeight / totalHeightPx;
      warnings.push(
        `Combined height exceeded JPEG limit (${totalHeightPx}px). Scaled automatically by ${(scaleRatio * 100).toFixed(0)}%.`
      );
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(maxWidthPx * scaleRatio);
    canvas.height = Math.round(totalHeightPx * scaleRatio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain canvas 2D context');

    ctx.fillStyle = pagesOpt.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 0;
    for (let idx = 0; idx < pageViewports.length; idx++) {
      if (signal?.aborted) {
        throw new DOMException('Conversion cancelled by user', 'AbortError');
      }

      const item = pageViewports[idx];
      onProgress?.({
        current: idx + 1,
        total: pageViewports.length,
        percent: Math.round(((idx + 1) / pageViewports.length) * 90),
        statusText: `Stitching page ${item.pageNum}...`
      });

      const effectiveDpi = (pagesOpt.dpi * scaleRatio);
      const vp = item.page.getViewport({ scale: effectiveDpi / 72 });

      // Create temporary canvas for individual page
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.round(vp.width);
      pageCanvas.height = Math.round(vp.height);
      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = pagesOpt.backgroundColor || '#FFFFFF';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await item.page.render({
          canvasContext: pageCtx,
          viewport: vp,
          annotationMode: pagesOpt.includeAnnotations ? 1 : 0
        }).promise;

        if (pagesOpt.grayscale) {
          this.applyGrayscale(pageCtx, pageCanvas.width, pageCanvas.height);
        }

        ctx.drawImage(pageCanvas, 0, currentY);
      }

      currentY += Math.round(vp.height);
      pageCanvas.width = 0;
      pageCanvas.height = 0;
      item.page.cleanup();
    }

    const rawBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
        'image/jpeg',
        pagesOpt.quality
      );
    });

    let finalBlob = rawBlob;
    if (pagesOpt.embedDpi) {
      const rawBuffer = new Uint8Array(await rawBlob.arrayBuffer());
      if (isValidJpeg(rawBuffer)) {
        const patchedBuffer = embedJpegDpi(rawBuffer, Math.round(pagesOpt.dpi * scaleRatio));
        finalBlob = new Blob([patchedBuffer as BlobPart], { type: 'image/jpeg' });
      }
    }

    const combinedFilename = buildCombinedFilename(filename);
    const previewUrl = URL.createObjectURL(finalBlob);

    const pageItem: ConvertedPageItem = {
      pageNumber: 1,
      filename: combinedFilename,
      width: canvas.width,
      height: canvas.height,
      dpi: Math.round(pagesOpt.dpi * scaleRatio),
      sizeBytes: finalBlob.size,
      blob: finalBlob,
      previewUrl
    };

    canvas.width = 0;
    canvas.height = 0;

    return {
      jobId: `p2j-combined-${Date.now()}`,
      mode: 'convert_pages',
      inputFilename: filename,
      originalSizeBytes,
      pages: [pageItem],
      images: [],
      isSingleImage: true,
      singleImageBlob: finalBlob,
      singleImageFilename: combinedFilename,
      singleImagePreviewUrl: previewUrl,
      totalOutputSizeBytes: finalBlob.size,
      warnings,
      processingTimeMs: Date.now() - startTime
    };
  }

  // ──────────────────────────────────────────────────────────────
  // MODE B: Extract All Images
  // ──────────────────────────────────────────────────────────────
  private async extractImagesFromPdf(
    pdfDoc: any,
    fileBytes: Uint8Array,
    filename: string,
    options: PdfToJpgOptions,
    warnings: string[],
    startTime: number,
    onProgress?: (progress: ConversionProgress) => void,
    signal?: AbortSignal
  ): Promise<PdfToJpgConversionResult> {
    const totalPages = pdfDoc.numPages;
    const extractOpt = options.extractImages;
    const extractedItems: ExtractedImageItem[] = [];
    const hashToItem = new Map<string, ExtractedImageItem>();

    // Parse PDFDocument via pdf-lib for lossless DCT stream extraction
    let pdfLibDoc: PDFDocument | null = null;
    try {
      pdfLibDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    } catch {
      // If pdf-lib fails (e.g. encrypted), we gracefully fall back to full pdf.js extraction
      pdfLibDoc = null;
    }

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (signal?.aborted) {
        throw new DOMException('Image extraction cancelled by user', 'AbortError');
      }

      onProgress?.({
        current: pageNum,
        total: totalPages,
        percent: Math.round((pageNum / totalPages) * 90),
        statusText: `Scanning images on page ${pageNum} of ${totalPages}...`
      });

      const page = await pdfDoc.getPage(pageNum);
      const opList = await page.getOperatorList();
      const fnArray = opList.fnArray;
      const argsArray = opList.argsArray;

      let imageIdxOnPage = 1;

      // OPS indices for image rendering in pdfjs-dist
      // paintImageXObject = 85 (or matched via name)
      // paintInlineImageXObject = 86
      // paintImageMaskXObject = 87
      for (let i = 0; i < fnArray.length; i++) {
        if (signal?.aborted) {
          throw new DOMException('Image extraction cancelled by user', 'AbortError');
        }

        const fn = fnArray[i];
        const args = argsArray[i];

        // Check for paintImageXObject or paintInlineImageXObject
        const isImageXObject = fn === 85 || (args && typeof args[0] === 'string' && args[0].startsWith('g_'));
        const isInlineImage = fn === 86;
        const isMaskImage = fn === 87;

        if (isMaskImage && !extractOpt.includeMasks) {
          continue;
        }

        if (isImageXObject || isInlineImage) {
          const objId = isImageXObject ? args[0] : null;

          try {
            // Retrieve decoded image from pdf.js page.objs
            const imgData = await new Promise<any>((resolve) => {
              if (objId && page.objs.has(objId)) {
                resolve(page.objs.get(objId));
              } else if (objId) {
                page.objs.get(objId, (data: any) => resolve(data));
              } else {
                resolve(args[0]);
              }
            });

            if (!imgData || !imgData.width || !imgData.height) {
              continue;
            }

            const width = imgData.width;
            const height = imgData.height;

            // Filter minimum dimensions
            if (width < extractOpt.minWidth || height < extractOpt.minHeight) {
              continue;
            }

            // Check for lossless DCT JPEG passthrough via pdf-lib
            let losslessBlob: Blob | null = null;
            if (extractOpt.keepOriginalJpegs && pdfLibDoc) {
              losslessBlob = await this.tryExtractLosslessDct(pdfLibDoc, pageNum, width, height);
            }

            let finalBlob: Blob;
            let isLossless = false;

            if (losslessBlob) {
              finalBlob = losslessBlob;
              isLossless = true;
            } else {
              // Re-encode via canvas
              finalBlob = await this.renderImageToJpegBlob(
                imgData,
                extractOpt.quality,
                extractOpt.backgroundColor
              );
            }

            // Hash for deduplication
            const rawBytes = new Uint8Array(await finalBlob.arrayBuffer());
            const hash = computeImageHash(rawBytes, width, height);

            if (extractOpt.skipDuplicates && hashToItem.has(hash)) {
              const existing = hashToItem.get(hash)!;
              if (!existing.usedOnPages.includes(pageNum)) {
                existing.usedOnPages.push(pageNum);
              }
              continue;
            }

            const imgFilename = buildExtractedImageFilename(
              filename,
              pageNum,
              imageIdxOnPage++,
              totalPages
            );

            const previewUrl = URL.createObjectURL(finalBlob);

            const item: ExtractedImageItem = {
              id: `img-${pageNum}-${imageIdxOnPage}-${Date.now()}`,
              filename: imgFilename,
              pageNumber: pageNum,
              indexOnPage: imageIdxOnPage,
              width,
              height,
              sizeBytes: finalBlob.size,
              mimeType: 'image/jpeg',
              blob: finalBlob,
              previewUrl,
              usedOnPages: [pageNum],
              isLossless,
              colorSpace: imgData.colorSpace?.name
            };

            extractedItems.push(item);
            hashToItem.set(hash, item);
          } catch (imgErr) {
            console.warn(`Failed extracting image on page ${pageNum}:`, imgErr);
          }
        }
      }

      page.cleanup();
      await new Promise((r) => setTimeout(r, 0));
    }

    if (extractedItems.length === 0) {
      warnings.push('No qualifying images found matching the current minimum size filter.');
    }

    onProgress?.({
      current: totalPages,
      total: totalPages,
      percent: 95,
      statusText: 'Packaging extracted images...'
    });

    const isSingleImage = extractedItems.length === 1;
    let zipBlob: Blob | undefined;
    let zipFilename: string | undefined;

    if (!isSingleImage && extractedItems.length > 0) {
      zipFilename = buildZipFilename(filename, 'extract_images');
      zipBlob = await createStreamingZip(
        extractedItems.map((img) => ({ name: img.filename, blob: img.blob }))
      );
    }

    const totalOutputSizeBytes = isSingleImage
      ? extractedItems[0].sizeBytes
      : zipBlob?.size || extractedItems.reduce((sum, img) => sum + img.sizeBytes, 0);

    return {
      jobId: `p2j-extract-${Date.now()}`,
      mode: 'extract_images',
      inputFilename: filename,
      originalSizeBytes: fileBytes.length,
      pages: [],
      images: extractedItems,
      isSingleImage,
      singleImageBlob: isSingleImage ? extractedItems[0].blob : undefined,
      singleImageFilename: isSingleImage ? extractedItems[0].filename : undefined,
      singleImagePreviewUrl: isSingleImage ? extractedItems[0].previewUrl : undefined,
      zipBlob,
      zipFilename,
      totalOutputSizeBytes,
      warnings,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Attempts to extract raw DCT bytes (JPEG) directly from pdf-lib without recompression.
   */
  private async tryExtractLosslessDct(
    pdfDoc: PDFDocument,
    pageNumber: number,
    targetWidth: number,
    targetHeight: number
  ): Promise<Blob | null> {
    try {
      const page = pdfDoc.getPage(pageNumber - 1);
      const resources = page.node.Resources();
      if (!resources) return null;

      const xObjectDict = resources.lookup(PDFName.of('XObject'));
      if (!xObjectDict || typeof (xObjectDict as any).entries !== 'function') return null;

      for (const [, ref] of (xObjectDict as any).entries()) {
        const stream = pdfDoc.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) continue;

        const dict = stream.dict;
        const subtype = dict.lookup(PDFName.of('Subtype'));
        if (subtype !== PDFName.of('Image')) continue;

        const filter = dict.lookup(PDFName.of('Filter'));
        const isDct = filter === PDFName.of('DCTDecode') ||
          (Array.isArray(filter) && filter.some((f: any) => f === PDFName.of('DCTDecode')));

        if (!isDct) continue;

        // Ensure no SMask or soft mask complicates direct extraction
        const sMask = dict.lookup(PDFName.of('SMask'));
        const mask = dict.lookup(PDFName.of('Mask'));
        if (sMask || mask) continue;

        const w = dict.lookup(PDFName.of('Width')) as any;
        const h = dict.lookup(PDFName.of('Height')) as any;
        const widthVal = typeof w?.value === 'function' ? w.value() : Number(w);
        const heightVal = typeof h?.value === 'function' ? h.value() : Number(h);

        if (widthVal === targetWidth && heightVal === targetHeight) {
          const rawBytes = stream.contents;
          if (isValidJpeg(rawBytes)) {
            return new Blob([rawBytes as BlobPart], { type: 'image/jpeg' });
          }
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Renders raw pdf.js image data (RGBA, RGB, or Gray) to a JPEG blob.
   */
  private async renderImageToJpegBlob(
    imgData: any,
    quality: number,
    backgroundColor = '#FFFFFF'
  ): Promise<Blob> {
    const width = imgData.width;
    const height = imgData.height;
    const data = imgData.data;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain canvas 2D context for image');

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const imgDataObj = ctx.createImageData(width, height);
    const dest = imgDataObj.data;

    if (imgData.kind === 2) {
      // RGBA format
      dest.set(data);
    } else if (imgData.kind === 1) {
      // RGB format
      let srcIdx = 0;
      let dstIdx = 0;
      for (let i = 0; i < width * height; i++) {
        dest[dstIdx] = data[srcIdx];
        dest[dstIdx + 1] = data[srcIdx + 1];
        dest[dstIdx + 2] = data[srcIdx + 2];
        dest[dstIdx + 3] = 255;
        srcIdx += 3;
        dstIdx += 4;
      }
    } else {
      // Grayscale or 1-component format
      let srcIdx = 0;
      let dstIdx = 0;
      for (let i = 0; i < width * height; i++) {
        const val = data[srcIdx++] || 0;
        dest[dstIdx] = val;
        dest[dstIdx + 1] = val;
        dest[dstIdx + 2] = val;
        dest[dstIdx + 3] = 255;
        dstIdx += 4;
      }
    }

    ctx.putImageData(imgDataObj, 0, 0);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      );
    });

    canvas.width = 0;
    canvas.height = 0;
    return blob;
  }

  /**
   * Applies standard luminance conversion (0.299R + 0.587G + 0.114B) to a 2D canvas context.
   */
  private applyGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }
}
