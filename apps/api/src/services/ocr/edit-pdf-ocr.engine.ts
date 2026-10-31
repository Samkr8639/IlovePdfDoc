import os from 'os';
import sharp from 'sharp';
import {
  EditPdfOcrOptions,
  EditPdfOcrPageResult,
  EditPdfOcrLine,
  EditPdfOcrWord,
  EditPdfOcrResult
} from '@paperflow/contracts';
import { getOcrWorker, renderPdfPageToPng, terminateOcrPool } from './index';

export const OCR_CONCURRENCY = Math.max(
  1,
  Math.min(2, (os.cpus()?.length || 2) - 1)
);
export const OCR_PAGE_TIMEOUT_MS = 45000; // 45 seconds per page
export const OCR_JOB_TIMEOUT_MS = 180000; // 3 minutes per job

async function getPdfjs(): Promise<any> {
  const dynamicImport = new Function('specifier', 'return import(specifier)');
  return dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
}

/**
 * Estimates skew angle using horizontal projection profile variance on downscaled image
 */
export async function detectSkewAngle(
  imageBuffer: Buffer
): Promise<{ angle: number; deskewedBuffer: Buffer }> {
  try {
    const downscaled = await sharp(imageBuffer)
      .resize({ width: 600, fit: 'inside' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = downscaled;
    const width = info.width;
    const height = info.height;

    // Search angles between -15 and +15 degrees
    let bestAngle = 0;
    let maxVariance = 0;

    for (let angle = -15; angle <= 15; angle += 1.0) {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Compute row projections for rotated coordinates
      const rowSums = new Float64Array(height);
      const centerX = width / 2;
      const centerY = height / 2;

      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 4) {
          const pixelVal = 255 - data[y * width + x]; // Invert so text is high value
          if (pixelVal > 50) {
            const rotY = Math.round(
              (x - centerX) * sin + (y - centerY) * cos + centerY
            );
            if (rotY >= 0 && rotY < height) {
              rowSums[rotY] += pixelVal;
            }
          }
        }
      }

      // Compute variance of row sums
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < height; i++) {
        sum += rowSums[i];
        sumSq += rowSums[i] * rowSums[i];
      }
      const variance = sumSq / height - (sum / height) ** 2;

      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }

    // Only deskew if significant variance and angle is at least 0.5 degrees
    if (maxVariance > 10 && Math.abs(bestAngle) >= 0.5 && Math.abs(bestAngle) <= 15) {
      const deskewedBuffer = await sharp(imageBuffer)
        .rotate(-bestAngle, { background: '#ffffff' })
        .toBuffer();
      return { angle: bestAngle, deskewedBuffer };
    }

    return { angle: 0, deskewedBuffer: imageBuffer };
  } catch {
    // If deskew computation encounters an issue, safely return original buffer
    return { angle: 0, deskewedBuffer: imageBuffer };
  }
}

/**
 * Execute OCR on a single rendered page buffer
 */
export async function processPageOcr(
  pageBuffer: Buffer,
  pageIndex: number,
  pageWidthPt: number,
  pageHeightPt: number,
  pageRotation: number,
  languages: string[],
  deskew = true,
  abortSignal?: AbortSignal
): Promise<EditPdfOcrPageResult> {
  if (abortSignal?.aborted) {
    throw new Error('OCR job was cancelled by user');
  }

  // 1. Optional deskew
  let processedBuffer = pageBuffer;
  if (deskew) {
    const deskewRes = await detectSkewAngle(pageBuffer);
    processedBuffer = deskewRes.deskewedBuffer;
  }

  // 2. Grayscale optimization
  const grayscaleBuffer = await sharp(processedBuffer)
    .grayscale()
    .toBuffer();

  const metadata = await sharp(grayscaleBuffer).metadata();
  const imgWidthPx = metadata.width || 1;
  const imgHeightPx = metadata.height || 1;

  // 3. Tesseract recognize
  const langKey = languages.join('+') || 'eng';
  const worker = await getOcrWorker(langKey);

  if (abortSignal?.aborted) {
    throw new Error('OCR job was cancelled by user');
  }

  const ocrPromise = worker.recognize(
    grayscaleBuffer,
    { rotateAuto: true },
    { blocks: true }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Page ${pageIndex + 1} OCR timed out after ${OCR_PAGE_TIMEOUT_MS}ms`));
    }, OCR_PAGE_TIMEOUT_MS);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('OCR job was cancelled by user'));
      });
    }

    ocrPromise.finally(() => clearTimeout(timer));
  });

  const res = await Promise.race([ocrPromise, timeoutPromise]);

  // 4. Map recognition blocks to PDF coordinate system (72 DPI points, origin bottom-left)
  const scaleX = pageWidthPt / imgWidthPx;
  const scaleY = pageHeightPt / imgHeightPx;

  const lines: EditPdfOcrLine[] = [];
  const blocks = res?.data?.blocks || [];

  for (const block of blocks) {
    const paragraphs = block.paragraphs || [];
    for (const paragraph of paragraphs) {
      const pLines = paragraph.lines || [];
      for (const line of pLines) {
        const lineText = (line.text || '').trim();
        const lineConfidence = Math.max(0, Math.min(100, Math.round(line.confidence || 0)));

        // Filter out empty or low-confidence noise lines
        if (!lineText || lineConfidence < 15) {
          continue;
        }

        const words: EditPdfOcrWord[] = [];
        const lineWords = line.words || [];

        for (const w of lineWords) {
          const wText = (w.text || '').trim();
          if (!wText) continue;

          const wBbox = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
          const wx0 = Math.max(0, Math.round(wBbox.x0 * scaleX * 10) / 10);
          const wx1 = Math.min(pageWidthPt, Math.round(wBbox.x1 * scaleX * 10) / 10);
          // Convert to PDF origin bottom-left:
          const wy0 = Math.max(0, Math.round((pageHeightPt - wBbox.y1 * scaleY) * 10) / 10);
          const wy1 = Math.min(pageHeightPt, Math.round((pageHeightPt - wBbox.y0 * scaleY) * 10) / 10);

          words.push({
            text: wText,
            bbox: [wx0, wy0, wx1, wy1],
            confidence: Math.max(0, Math.min(100, Math.round(w.confidence || lineConfidence)))
          });
        }

        if (words.length === 0) continue;

        const lBbox = line.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
        const lx0 = Math.max(0, Math.round(lBbox.x0 * scaleX * 10) / 10);
        const lx1 = Math.min(pageWidthPt, Math.round(lBbox.x1 * scaleX * 10) / 10);
        const ly0 = Math.max(0, Math.round((pageHeightPt - lBbox.y1 * scaleY) * 10) / 10);
        const ly1 = Math.min(pageHeightPt, Math.round((pageHeightPt - lBbox.y0 * scaleY) * 10) / 10);

        const lineHeightPt = Math.max(6, ly1 - ly0);
        const fontSizePt = Math.max(6, Math.min(72, Math.round(lineHeightPt * 0.85)));
        // Typographic baseline estimate ~ 20% above bottom of bounding box
        const baselineY = Math.round((ly0 + lineHeightPt * 0.2) * 10) / 10;

        lines.push({
          text: lineText,
          bbox: [lx0, ly0, lx1, ly1],
          baselineY,
          fontSizePt,
          confidence: lineConfidence,
          words
        });
      }
    }
  }

  return {
    index: pageIndex,
    widthPt: pageWidthPt,
    heightPt: pageHeightPt,
    rotation: pageRotation,
    lines
  };
}

/**
 * Execute full PDF OCR processing job
 */
export async function executePdfOcrJob(
  pdfBuffer: Buffer,
  options: EditPdfOcrOptions,
  jobId: string,
  onProgress?: (progress: number, page: number, totalPages: number) => void,
  abortSignal?: AbortSignal
): Promise<EditPdfOcrResult> {
  const pdfjsLib = await getPdfjs();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    isEvalSupported: false
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pageResults: EditPdfOcrPageResult[] = [];
  const warnings: string[] = [];

  let totalConfidenceSum = 0;
  let totalLinesCount = 0;

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (abortSignal?.aborted) {
        throw new Error('OCR job was cancelled by user');
      }

      onProgress?.(
        Math.round(((pageNum - 1) / totalPages) * 100),
        pageNum,
        totalPages
      );

      // Render page at 300 DPI for high fidelity character recognition
      const { pngBuffer, widthPt, heightPt } = await renderPdfPageToPng(
        pdfDoc,
        pageNum,
        300
      );

      const page = await pdfDoc.getPage(pageNum);
      const pageRotation = page.rotate || 0;

      const pageResult = await processPageOcr(
        pngBuffer,
        pageNum - 1,
        widthPt,
        heightPt,
        pageRotation,
        options.languages,
        options.deskew,
        abortSignal
      );

      pageResults.push(pageResult);

      for (const line of pageResult.lines) {
        totalConfidenceSum += line.confidence;
        totalLinesCount++;
      }

      onProgress?.(
        Math.round((pageNum / totalPages) * 100),
        pageNum,
        totalPages
      );

      // Cooperative yield
      await new Promise(resolve => setImmediate(resolve));
    }
  } finally {
    if (typeof pdfDoc.cleanup === 'function') {
      pdfDoc.cleanup();
    }
    if (typeof loadingTask.destroy === 'function') {
      loadingTask.destroy();
    }
  }

  const averageConfidence =
    totalLinesCount > 0 ? Math.round(totalConfidenceSum / totalLinesCount) : 100;

  if (averageConfidence < 60) {
    warnings.push(
      'Document recognition completed with low average confidence. Review flagged words before saving.'
    );
  }

  return {
    jobId,
    pages: pageResults,
    language: options.languages.join('+'),
    averageConfidence,
    warnings
  };
}
