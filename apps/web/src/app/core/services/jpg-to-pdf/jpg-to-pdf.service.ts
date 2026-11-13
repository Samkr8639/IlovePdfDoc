import { Injectable } from '@angular/core';
import {
  clip,
  endPath,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  StandardFonts
} from 'pdf-lib';
import {
  ComputedPageLayout,
  JpgToPdfBuildResult,
  JpgToPdfImageItem,
  JpgToPdfOptions,
  JpgToPdfProgress
} from './jpg-to-pdf.models';
import { JpegSanitizer } from './jpeg-sanitizer';
import { PageLayoutService } from './page-layout.service';
import { createStreamingZip, ZipEntryInput } from '../pdf-to-jpg/streaming-zip';

@Injectable({
  providedIn: 'root'
})
export class JpgToPdfService {
  constructor(private layoutService: PageLayoutService) {}

  /**
   * Converts a list of image items into a single PDF or a ZIP of individual PDFs.
   */
  async buildPdf(
    items: JpgToPdfImageItem[],
    options: JpgToPdfOptions,
    onProgress?: (progress: JpgToPdfProgress) => void,
    signal?: AbortSignal
  ): Promise<JpgToPdfBuildResult> {
    const startTime = Date.now();

    if (!items || items.length === 0) {
      throw new Error('No images provided for PDF conversion.');
    }

    if (signal?.aborted) {
      throw new DOMException('Operation aborted by user.', 'AbortError');
    }

    const warnings: Array<{ fileName: string; reason: string }> = [];
    const validItems = items.filter((item) => item.probe.isValid);

    if (validItems.length === 0) {
      throw new Error('None of the provided images are valid.');
    }

    if (options.mergeAll) {
      return this.buildSinglePdf(validItems, options, warnings, onProgress, signal, startTime);
    } else {
      return this.buildMultiPdfZip(validItems, options, warnings, onProgress, signal, startTime);
    }
  }

  /**
   * Builds a single merged PDF containing all images.
   */
  private async buildSinglePdf(
    items: JpgToPdfImageItem[],
    options: JpgToPdfOptions,
    warnings: Array<{ fileName: string; reason: string }>,
    onProgress?: (progress: JpgToPdfProgress) => void,
    signal?: AbortSignal,
    startTime: number = Date.now()
  ): Promise<JpgToPdfBuildResult> {
    const pdfDoc = await PDFDocument.create();

    // Set PDF Document Metadata
    const customTitle = options.pdfTitle?.trim();
    const title = customTitle || this.stripExtension(items[0].name);
    pdfDoc.setTitle(title);
    if (options.pdfAuthor && options.pdfAuthor.trim()) {
      pdfDoc.setAuthor(options.pdfAuthor.trim());
    }
    pdfDoc.setCreator('PDFTailor');
    pdfDoc.setProducer('PDFTailor (In-Browser)');

    const total = items.length;
    let helveticaFont: any = null;
    if (options.addPageNumbers) {
      helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const totalPages = items.length;

    for (let i = 0; i < total; i++) {
      if (signal?.aborted) {
        throw new DOMException('Operation aborted by user.', 'AbortError');
      }

      const item = items[i];
      const percent = Math.round(((i + 0.1) / total) * 100);
      onProgress?.({
        current: i + 1,
        total,
        percent,
        message: `Processing page ${i + 1} of ${total} (${item.name})...`
      });

      try {
        const layout = this.layoutService.computeLayout(item, options);
        if (layout.clampedDueToPdfLimit) {
          warnings.push({
            fileName: item.name,
            reason: 'Image dimensions exceeded PDF 200-inch limit (14,400 pt) and were proportionally scaled down.'
          });
        }

        await this.renderImageToPage(pdfDoc, item, layout, options, i + 1, totalPages, helveticaFont);
      } catch (err: any) {
        warnings.push({
          fileName: item.name,
          reason: `Failed to embed image: ${err?.message || 'Unknown error'}`
        });
      }
    }

    onProgress?.({
      current: total,
      total,
      percent: 95,
      message: 'Finalizing PDF document...'
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });

    const customName = options.pdfTitle?.trim();
    let downloadFilename = customName
      ? this.sanitizeFileName(this.stripExtension(customName))
      : this.sanitizeFileName(this.stripExtension(items[0].name));
    if (!downloadFilename) downloadFilename = 'images';
    downloadFilename += '.pdf';

    onProgress?.({
      current: total,
      total,
      percent: 100,
      message: 'Done!'
    });

    return {
      blob,
      downloadFilename,
      isZip: false,
      pageCount: pdfDoc.getPageCount(),
      failedCount: total - pdfDoc.getPageCount(),
      warnings,
      outputSizeBytes: blob.size,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Builds individual PDFs for each image and bundles them into a ZIP archive.
   */
  private async buildMultiPdfZip(
    items: JpgToPdfImageItem[],
    options: JpgToPdfOptions,
    warnings: Array<{ fileName: string; reason: string }>,
    onProgress?: (progress: JpgToPdfProgress) => void,
    signal?: AbortSignal,
    startTime: number = Date.now()
  ): Promise<JpgToPdfBuildResult> {
    const total = items.length;
    const zipEntries: ZipEntryInput[] = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < total; i++) {
      if (signal?.aborted) {
        throw new DOMException('Operation aborted by user.', 'AbortError');
      }

      const item = items[i];
      const percent = Math.round(((i + 0.1) / total) * 90);
      onProgress?.({
        current: i + 1,
        total,
        percent,
        message: `Creating PDF ${i + 1} of ${total} (${item.name})...`
      });

      try {
        const singleDoc = await PDFDocument.create();
        const customTitle = options.pdfTitle?.trim();
        const baseTitle = customTitle
          ? `${this.sanitizeFileName(this.stripExtension(customTitle))}-${i + 1}`
          : this.stripExtension(item.name);
        singleDoc.setTitle(baseTitle);
        if (options.pdfAuthor && options.pdfAuthor.trim()) {
          singleDoc.setAuthor(options.pdfAuthor.trim());
        }
        singleDoc.setCreator('PDFTailor');
        singleDoc.setProducer('PDFTailor (In-Browser)');

        let font: any = null;
        if (options.addPageNumbers) {
          font = await singleDoc.embedFont(StandardFonts.Helvetica);
        }

        const layout = this.layoutService.computeLayout(item, options);
        await this.renderImageToPage(singleDoc, item, layout, options, 1, 1, font);

        const pdfBytes = await singleDoc.save();
        const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });

        // Disambiguate duplicate filenames
        let entryName = this.sanitizeFileName(baseTitle);
        if (!entryName) entryName = `image-${i + 1}`;
        let finalName = `${entryName}.pdf`;
        let counter = 1;
        while (usedNames.has(finalName.toLowerCase())) {
          finalName = `${entryName}-${counter}.pdf`;
          counter++;
        }
        usedNames.add(finalName.toLowerCase());

        zipEntries.push({
          name: finalName,
          blob: pdfBlob
        });
      } catch (err: any) {
        warnings.push({
          fileName: item.name,
          reason: `Failed to create PDF: ${err?.message || 'Unknown error'}`
        });
      }
    }

    onProgress?.({
      current: total,
      total,
      percent: 92,
      message: 'Compressing into ZIP archive...'
    });

    const zipBlob = await createStreamingZip(zipEntries);

    onProgress?.({
      current: total,
      total,
      percent: 100,
      message: 'Done!'
    });

    const zipDownloadName = options.pdfTitle?.trim()
      ? `${this.sanitizeFileName(this.stripExtension(options.pdfTitle.trim()))}.zip`
      : 'images.zip';

    return {
      blob: zipBlob,
      downloadFilename: zipDownloadName,
      isZip: true,
      pageCount: zipEntries.length,
      failedCount: total - zipEntries.length,
      warnings,
      outputSizeBytes: zipBlob.size,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Renders a single image item onto a new PDF page according to the computed layout.
   */
  private async renderImageToPage(
    pdfDoc: PDFDocument,
    item: JpgToPdfImageItem,
    layout: ComputedPageLayout,
    options: JpgToPdfOptions,
    pageNumber: number,
    totalPages: number,
    font?: any
  ): Promise<void> {
    const page = pdfDoc.addPage([layout.pageWidthPt, layout.pageHeightPt]);

    // 1. Draw solid background color (for transparency or letterbox margins)
    const bgColor = this.hexToRgb(options.backgroundColor || '#ffffff');
    page.drawRectangle({
      x: 0,
      y: 0,
      width: layout.pageWidthPt,
      height: layout.pageHeightPt,
      color: rgb(bgColor.r, bgColor.g, bgColor.b)
    });

    // 2. Obtain embedded PDF image
    const embeddedImage = await this.getOrEncodeEmbeddedImage(pdfDoc, item, layout, options);

    // 3. Handle clipping for 'fill' mode
    if (layout.isClipped && layout.clipXPt !== undefined && layout.clipYPt !== undefined) {
      page.pushOperators(
        pushGraphicsState(),
        rectangle(layout.clipXPt, layout.clipYPt, layout.clipWidthPt || layout.pageWidthPt, layout.clipHeightPt || layout.pageHeightPt),
        clip(),
        endPath()
      );

      page.drawImage(embeddedImage, {
        x: layout.drawXPt,
        y: layout.drawYPt,
        width: layout.drawWidthPt,
        height: layout.drawHeightPt
      });

      page.pushOperators(popGraphicsState());
    } else {
      page.drawImage(embeddedImage, {
        x: layout.drawXPt,
        y: layout.drawYPt,
        width: layout.drawWidthPt,
        height: layout.drawHeightPt
      });
    }

    // 4. Page Numbering
    if (options.addPageNumbers && font) {
      const pageText = `${pageNumber} / ${totalPages}`;
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(pageText, fontSize);
      const textX = (layout.pageWidthPt - textWidth) / 2;
      const textY = Math.max(10, layout.marginBottomPt > 20 ? layout.marginBottomPt / 2 : 14);

      page.drawText(pageText, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
    }
  }

  /**
   * Embeds the image in the PDFDocument.
   * Performs direct lossless embedding for unrotated JPEGs and PNGs in original quality.
   * Uses canvas rasterization for rotated images, WebP/GIF/BMP, and downsampled qualities.
   */
  private async getOrEncodeEmbeddedImage(
    pdfDoc: PDFDocument,
    item: JpgToPdfImageItem,
    layout: ComputedPageLayout,
    options: JpgToPdfOptions
  ) {
    const isLosslessCandidate =
      options.quality === 'original' &&
      layout.effectiveRotationDeg === 0 &&
      !layout.needsHorizontalFlip;

    // Direct lossless JPEG embed
    if (
      isLosslessCandidate &&
      item.probe.format === 'jpeg' &&
      !item.probe.isCmyk &&
      (item.probe.colorComponents === 1 || item.probe.colorComponents === 3)
    ) {
      let rawBytes: Uint8Array = new Uint8Array(await item.file.arrayBuffer());
      if (options.removeExif) {
        const sanitized = JpegSanitizer.sanitize(rawBytes);
        rawBytes = sanitized.bytes as Uint8Array<ArrayBuffer>;
      }
      return await pdfDoc.embedJpg(rawBytes as any);
    }

    // Direct lossless PNG embed
    if (isLosslessCandidate && item.probe.format === 'png') {
      const rawBytes = new Uint8Array(await item.file.arrayBuffer());
      return await pdfDoc.embedPng(rawBytes);
    }

    // Canvas fallback: handles rotation, flip, format conversion, and downsampling
    const rasterBytes = await this.renderImageToRasterBytes(item, layout, options);
    if (rasterBytes.format === 'png') {
      return await pdfDoc.embedPng(rasterBytes.bytes);
    } else {
      return await pdfDoc.embedJpg(rasterBytes.bytes);
    }
  }

  /**
   * Renders the image onto an HTML canvas with transforms and downsampling, returning JPEG or PNG bytes.
   */
  private async renderImageToRasterBytes(
    item: JpgToPdfImageItem,
    layout: ComputedPageLayout,
    options: JpgToPdfOptions
  ): Promise<{ bytes: Uint8Array; format: 'jpeg' | 'png' }> {
    const imgBitmap = await this.loadImageBitmap(item.file);

    try {
      // Calculate target raster pixel dimensions based on quality and printed dimensions
      let targetW = imgBitmap.width;
      let targetH = imgBitmap.height;

      if (layout.effectiveRotationDeg === 90 || layout.effectiveRotationDeg === 270) {
        targetW = imgBitmap.height;
        targetH = imgBitmap.width;
      }

      let maxDpi = 300;
      let encodeQuality = 0.92;

      if (options.quality === 'optimised') {
        maxDpi = 200;
        encodeQuality = 0.85;
      } else if (options.quality === 'small') {
        maxDpi = 150;
        encodeQuality = 0.70;
      }

      if (options.quality !== 'original') {
        // Downsample based on physical printed size in inches (72 pt per inch)
        const printedWidthInches = layout.drawWidthPt / 72;
        const printedHeightInches = layout.drawHeightPt / 72;
        const maxAllowedW = Math.round(printedWidthInches * maxDpi);
        const maxAllowedH = Math.round(printedHeightInches * maxDpi);

        if (targetW > maxAllowedW || targetH > maxAllowedH) {
          const scale = Math.min(maxAllowedW / targetW, maxAllowedH / targetH);
          targetW = Math.max(1, Math.round(targetW * scale));
          targetH = Math.max(1, Math.round(targetH * scale));
        }
      }

      // Create Canvas
      let canvas: HTMLCanvasElement;
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
      } else if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(targetW, targetH) as any;
      } else {
        throw new Error('Canvas rendering environment not available.');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D canvas context.');

      // Background color fill for transparent images or when background is non-white
      ctx.fillStyle = options.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);

      if (layout.effectiveRotationDeg !== 0) {
        ctx.rotate((layout.effectiveRotationDeg * Math.PI) / 180);
      }
      if (layout.needsHorizontalFlip) {
        ctx.scale(-1, 1);
      }

      // Draw original image bitmap centered
      const isRotated = layout.effectiveRotationDeg === 90 || layout.effectiveRotationDeg === 270;
      const drawW = isRotated ? targetH : targetW;
      const drawH = isRotated ? targetW : targetH;
      ctx.drawImage(imgBitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Encode to JPEG (or PNG if requested and small)
      const blob = await this.canvasToBlob(canvas, 'image/jpeg', encodeQuality);
      const arrayBuf = await blob.arrayBuffer();
      return { bytes: new Uint8Array(arrayBuf), format: 'jpeg' };
    } finally {
      if ('close' in imgBitmap) {
        imgBitmap.close();
      }
    }
  }

  private async loadImageBitmap(file: File): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== 'undefined') {
      try {
        return await createImageBitmap(file);
      } catch {
        // Fallback to HTMLImageElement
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img as any);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image in browser.'));
      };
      img.src = url;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    if ('convertToBlob' in canvas) {
      return (canvas as any).convertToBlob({ type, quality });
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert canvas to blob.'));
        },
        type,
        quality
      );
    });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (cleanHex.length !== 6) {
      return { r: 1, g: 1, b: 1 };
    }
    return {
      r: parseInt(cleanHex.slice(0, 2), 16) / 255,
      g: parseInt(cleanHex.slice(2, 4), 16) / 255,
      b: parseInt(cleanHex.slice(4, 6), 16) / 255
    };
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
      .replace(/\.\./g, '_')
      .trim()
      .slice(0, 100);
  }

  private stripExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(0, idx) : name;
  }
}
