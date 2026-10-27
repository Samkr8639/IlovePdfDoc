import { createRequire } from 'module';

const nativeRequire = createRequire(__filename);

// Lazy-loaded dependencies for OCR mode
let activeWorker: any = null;
let activeWorkerLang = '';

async function getPdfjs(): Promise<any> {
  const dynamicImport = new Function('specifier', 'return import(specifier)');
  return dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
}

export interface OcrTextLine {
  text: string;
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  fontSizePt: number;
}

export interface OcrPageResult {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  pngBuffer: Buffer;
  lines: OcrTextLine[];
}


/**
 * Get or create a Tesseract OCR worker for the given language
 */
export async function getOcrWorker(lang = 'eng'): Promise<any> {
  if (activeWorker && activeWorkerLang === lang) {
    return activeWorker;
  }

  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignore termination errors during replacement
    }
    activeWorker = null;
  }

  const Tesseract = require('tesseract.js');
  const worker = await Tesseract.createWorker(lang);
  activeWorker = worker;
  activeWorkerLang = lang;
  return worker;
}

/**
 * Clean up active OCR worker pool on shutdown or test completion
 */
export async function terminateOcrPool(): Promise<void> {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignore termination errors
    }
    activeWorker = null;
    activeWorkerLang = '';
  }
}

/**
 * Render a single PDF page to a PNG Buffer at specified DPI (default 200)
 */
export async function renderPdfPageToPng(
  pdfDoc: any,
  pageNumber: number,
  dpi = 200
): Promise<{ pngBuffer: Buffer; widthPt: number; heightPt: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const widthPt = unscaledViewport.width;
  const heightPt = unscaledViewport.height;

  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });

  const canvasWidth = Math.max(1, Math.round(viewport.width));
  const canvasHeight = Math.max(1, Math.round(viewport.height));

  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Fill canvas with white background before rendering
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  await page.render({ canvasContext: ctx, viewport }).promise;
  const pngBuffer = canvas.toBuffer('image/png');

  if (typeof page.cleanup === 'function') {
    page.cleanup();
  }

  return { pngBuffer, widthPt, heightPt };
}

/**
 * Execute OCR on an image buffer and extract line bounding boxes converted to PDF points
 */
export async function performOcrOnImage(
  pngBuffer: Buffer,
  lang = 'eng',
  dpi = 200,
  timeoutMs = 30000
): Promise<OcrTextLine[]> {
  const worker = await getOcrWorker(lang);

  const ocrPromise = (async () => {
    const res = await worker.recognize(pngBuffer, {}, { blocks: true });
    const lines: OcrTextLine[] = [];
    const scaleToPoints = 72 / dpi;

    const blocks = res.data.blocks || [];
    for (const block of blocks) {
      const paragraphs = block.paragraphs || [];
      for (const p of paragraphs) {
        const pLines = p.lines || [];
        for (const l of pLines) {
          const text = (l.text || '').trim();
          if (!text) continue;

          const bbox = l.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
          const wPx = Math.max(1, bbox.x1 - bbox.x0);
          const hPx = Math.max(1, bbox.y1 - bbox.y0);

          const xPt = bbox.x0 * scaleToPoints;
          const yPt = bbox.y0 * scaleToPoints;
          const wPt = wPx * scaleToPoints;
          const hPt = hPx * scaleToPoints;
          const fontSizePt = Math.max(6, Math.min(72, Math.round(hPt * 0.85)));

          lines.push({
            text,
            xPt,
            yPt,
            wPt,
            hPt,
            fontSizePt
          });
        }
      }
    }
    return lines;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OCR processing timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    ocrPromise.finally(() => clearTimeout(timer));
  });

  return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * End-to-end OCR helper: extracts all pages of a PDF document up to maxPages
 */
export async function extractPdfWithOcr(
  pdfBuffer: Buffer,
  options: {
    lang?: string;
    dpi?: number;
    maxPages?: number;
    timeoutPerMs?: number;
  } = {}
): Promise<OcrPageResult[]> {
  const lang = options.lang || 'eng';
  const dpi = options.dpi || 200;
  const maxPages = options.maxPages || parseInt(process.env.MAX_OCR_PAGES || '10', 10);
  const timeoutMs = options.timeoutPerMs || 30000;

  const pdfjsLib = await getPdfjs();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    isEvalSupported: false
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const results: OcrPageResult[] = [];

  try {
    for (let p = 1; p <= totalPages; p++) {
      const { pngBuffer, widthPt, heightPt } = await renderPdfPageToPng(pdfDoc, p, dpi);
      let lines: OcrTextLine[] = [];
      try {
        lines = await performOcrOnImage(pngBuffer, lang, dpi, timeoutMs);
      } catch {
        // Fall back gracefully if OCR times out or fails on this page
        lines = [];
      }

      results.push({
        pageNumber: p,
        widthPt,
        heightPt,
        pngBuffer,
        lines
      });

      // Cooperative yield to keep event loop responsive
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

  return results;
}
