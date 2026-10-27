import { PDFDocument } from 'pdf-lib';
import { AppError } from '../../middleware/errorHandler';
import {
  CompressionLevel,
  CompressionProfile,
  COMPRESSION_PROFILES,
  CompressPdfOptions,
  CompressionStats
} from './types';
import { optimizeImageStreams, extractImageDisplayDimensions } from './image-optimizer';
import { optimizePdfStructure, runQpdfOptimization } from './structural-optimizer';
import { isGhostscriptEngineEnabled, runGhostscriptOptimization } from './ghostscript-optimizer';

export * from './types';
export * from './image-optimizer';
export * from './structural-optimizer';
export * from './ghostscript-optimizer';

/**
 * Validates a PDF file buffer
 */
export function validatePdfBuffer(buffer: Buffer, originalname: string): void {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The selected file '${originalname}' is empty.`);
  }

  if (!originalname.toLowerCase().endsWith('.pdf')) {
    throw new AppError(400, 'INVALID_FILE_TYPE', `File '${originalname}' must have a .pdf extension.`);
  }

  // Check magic number %PDF-
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new AppError(
      400,
      'INVALID_PDF_HEADER',
      `Only valid PDF files are supported. '${originalname}' is not a valid PDF.`
    );
  }
}

/**
 * Checks whether a document is fully composed of scanned page images
 */
export function isFullyScannedDocument(doc: PDFDocument): boolean {
  const pages = doc.getPages();
  if (pages.length === 0) return false;

  const displayMap = extractImageDisplayDimensions(doc);
  let scannedPages = 0;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const pageArea = width * height;
    let maxImageAreaOnPage = 0;

    for (const [, dims] of displayMap.entries()) {
      const imgArea = dims.scaleXPt * dims.scaleYPt;
      if (imgArea > maxImageAreaOnPage) {
        maxImageAreaOnPage = imgArea;
      }
    }

    // If an image covers >= 85% of the page, it's a full-page scan
    if (pageArea > 0 && maxImageAreaOnPage / pageArea >= 0.85) {
      scannedPages++;
    }
  }

  return scannedPages === pages.length;
}

/**
 * Core PDF compression engine
 */
export async function compressPdf(
  buffer: Buffer,
  filename: string,
  options: CompressPdfOptions = {}
): Promise<{
  compressedBuffer: Buffer;
  pageCount: number;
  stats: CompressionStats;
}> {
  const startTime = performance.now();
  const origSize = buffer.length;
  validatePdfBuffer(buffer, filename);

  const level: CompressionLevel = options.level || 'recommended';
  const profile: CompressionProfile = { ...COMPRESSION_PROFILES[level] };

  // 1. Load document with encryption detection
  let doc: PDFDocument;
  let pageCount = 0;
  try {
    doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    pageCount = doc.getPageCount();
    if (pageCount === 0) {
      throw new AppError(422, 'EMPTY_PDF', `The PDF '${filename}' contains no pages.`);
    }
  } catch (err: unknown) {
    if (err instanceof AppError || (err && typeof (err as any).statusCode === 'number')) {
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.toLowerCase().includes('encrypt') || errorMsg.toLowerCase().includes('password')) {
      throw new AppError(
        422,
        'PASSWORD_PROTECTED_PDF',
        `This PDF '${filename}' could not be opened. It is password-protected or encrypted.`
      );
    }
    throw new AppError(
      422,
      'CORRUPTED_PDF',
      `This PDF '${filename}' could not be opened. It may be corrupted or unreadable.`
    );
  }

  const isScanned = isFullyScannedDocument(doc);

  // 2. Check for optional Ghostscript engine (OFF by default, AGPL licensed)
  if (isGhostscriptEngineEnabled()) {
    const gsOutput = await runGhostscriptOptimization(buffer, profile);
    if (gsOutput && gsOutput.length < origSize) {
      const durationMs = Math.round(performance.now() - startTime);
      const savedBytes = origSize - gsOutput.length;
      const reductionPercentage = Math.round((savedBytes / origSize) * 1000) / 10;
      return {
        compressedBuffer: gsOutput,
        pageCount,
        stats: {
          originalBytes: origSize,
          compressedBytes: gsOutput.length,
          spaceSavedBytes: savedBytes,
          reductionPercentage,
          pageCount,
          imagesProcessed: 0,
          imagesOptimized: 0,
          imagesDeduplicated: 0,
          savingsReason: 'Processed with high-efficiency Ghostscript engine',
          durationMs,
          isScannedDocument: isScanned
        }
      };
    }
  }

  // 3. TARGET SIZE ITERATION (if requested by caller, e.g. binary search on quality then DPI)
  if (options.targetSizeBytes && options.targetSizeBytes < origSize) {
    let bestBuffer: Buffer | null = null;
    let bestSize = Infinity;
    const testQualities = [75, 60, 45, 35];
    const testDpis = [profile.maxDpi, Math.round(profile.maxDpi * 0.75), Math.round(profile.maxDpi * 0.5)];

    for (let pass = 0; pass < 6; pass++) {
      const curQ = testQualities[Math.min(pass, testQualities.length - 1)];
      const curDpi = testDpis[Math.min(Math.floor(pass / 2), testDpis.length - 1)];

      const passDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const passProfile: CompressionProfile = {
        ...profile,
        jpegQuality: curQ,
        maxDpi: curDpi
      };

      await optimizeImageStreams(passDoc, passProfile);
      await optimizePdfStructure(passDoc, passProfile);

      const passBytes = await passDoc.save({
        useObjectStreams: true,
        objectsPerTick: 50
      });
      const passBuf = Buffer.from(passBytes);

      if (passBuf.length < bestSize) {
        bestSize = passBuf.length;
        bestBuffer = passBuf;
      }

      if (passBuf.length <= options.targetSizeBytes) {
        break; // Reached target size
      }
    }

    if (bestBuffer && bestBuffer.length < origSize) {
      const durationMs = Math.round(performance.now() - startTime);
      const spaceSaved = origSize - bestBuffer.length;
      const reductionPercentage = Math.round((spaceSaved / origSize) * 1000) / 10;
      return {
        compressedBuffer: bestBuffer,
        pageCount,
        stats: {
          originalBytes: origSize,
          compressedBytes: bestBuffer.length,
          spaceSavedBytes: spaceSaved,
          reductionPercentage,
          pageCount,
          imagesProcessed: 0,
          imagesOptimized: 0,
          imagesDeduplicated: 0,
          savingsReason:
            bestBuffer.length <= options.targetSizeBytes
              ? 'Successfully achieved target size constraint'
              : 'Best-effort compression applied towards target size',
          durationMs,
          isScannedDocument: isScanned
        }
      };
    }
  }

  // 4. STANDARD ENGINE PASS: Image Optimization Pipeline
  const imgStats = await optimizeImageStreams(doc, profile);

  // 5. Structural Optimization & Flate Recompression
  await optimizePdfStructure(doc, profile);

  // 6. Serialize with Object Streams and XRef streams
  const compressedBytesArray = await doc.save({
    useObjectStreams: true,
    objectsPerTick: 50
  });
  let candidateBuffer = Buffer.from(compressedBytesArray);

  // 7. Run qpdf pass if binary is available
  const qpdfOutput = await runQpdfOptimization(candidateBuffer);
  if (qpdfOutput && qpdfOutput.length < candidateBuffer.length) {
    candidateBuffer = Buffer.from(qpdfOutput);
  }

  // 8. SAFETY INVARIANT: NEVER RETURN A FILE LARGER THAN ORIGINAL
  let finalBuffer: Buffer = candidateBuffer;
  let savingsReason = '';

  if (candidateBuffer.length >= origSize) {
    finalBuffer = buffer; // Fallback to original
    savingsReason =
      imgStats.imagesProcessed === 0
        ? 'This PDF is mostly text and already well optimised.'
        : 'Images and document streams are already compressed to optimal efficiency.';
  } else {
    const savedBytes = origSize - candidateBuffer.length;
    const reductionPercent = (savedBytes / origSize) * 100;

    if (reductionPercent < 5) {
      savingsReason =
        imgStats.imagesProcessed === 0
          ? 'This PDF is mostly text and already optimised.'
          : 'Images are already close to target resolution.';
    } else if (imgStats.imagesDeduplicated > 0) {
      savingsReason = `Deduplicated ${imgStats.imagesDeduplicated} redundant images and re-encoded raster streams at ${profile.maxDpi} DPI.`;
    } else if (imgStats.imagesOptimized > 0) {
      savingsReason = `Re-encoded ${imgStats.imagesOptimized} raster image streams to ${profile.maxDpi} DPI MozJPEG.`;
    } else {
      savingsReason = 'Lossless structural stream packing and object stream compression applied.';
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  const totalSpaceSaved = Math.max(0, origSize - finalBuffer.length);
  const totalReductionPercentage =
    origSize > 0 ? Math.round((totalSpaceSaved / origSize) * 1000) / 10 : 0;

  return {
    compressedBuffer: finalBuffer,
    pageCount,
    stats: {
      originalBytes: origSize,
      compressedBytes: finalBuffer.length,
      spaceSavedBytes: totalSpaceSaved,
      reductionPercentage: totalReductionPercentage,
      pageCount,
      imagesProcessed: imgStats.imagesProcessed,
      imagesOptimized: imgStats.imagesOptimized,
      imagesDeduplicated: imgStats.imagesDeduplicated,
      savingsReason,
      durationMs,
      isScannedDocument: isScanned
    }
  };
}
