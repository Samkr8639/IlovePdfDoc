import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { PdfToWordMode } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface PdfPageData {
  pageNumber: number;
  width: number;
  height: number;
  textItems: PdfTextItem[];
  isScanned: boolean;
  runningHeader?: string;
  runningFooter?: string;
}

export interface ExtractedPdfDocument {
  pageCount: number;
  pages: PdfPageData[];
  detectedDocTitle?: string;
  isAllScanned: boolean;
}

/**
 * Extracts layout-aware, geometry-preserving text and structural metadata from a PDF.
 */
export async function extractPdfDocument(
  pdfBuffer: Buffer,
  mode: PdfToWordMode = 'no_ocr',
  ocrLanguage = 'eng'
): Promise<ExtractedPdfDocument> {
  const parserInstance = new PDFParse({ data: pdfBuffer }) as any;
  let doc: any;
  try {
    await parserInstance.load();
    doc = parserInstance.doc;
    if (!doc) {
      throw new Error('PDF parser doc instance is null');
    }
  } catch (err: unknown) {
    throw new AppError(
      422,
      'CORRUPTED_PDF',
      `Failed to parse PDF structure: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const pages: PdfPageData[] = [];
  let detectedDocTitle = '';
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();

    const pageWidth = Math.round(viewport.width * 10) / 10;
    const pageHeight = Math.round(viewport.height * 10) / 10;

    const rawItems: PdfTextItem[] = [];

    for (const it of content.items as any[]) {
      if (!it.str || it.str.trim().length === 0) continue;

      const tx = it.transform;
      const fontSize = Math.round(Math.hypot(tx[0], tx[1]) * 10) / 10;
      const fontName = it.fontName || '';
      const isBold = /bold|f1|f3/i.test(fontName) || fontSize >= 16;
      const isItalic = /italic|oblique/i.test(fontName);

      rawItems.push({
        str: it.str.trim(),
        x: Math.round(tx[4] * 10) / 10,
        y: Math.round(tx[5] * 10) / 10,
        w: Math.round(it.width * 10) / 10,
        h: Math.round(it.height * 10) / 10,
        fontSize,
        fontName,
        isBold,
        isItalic
      });
    }

    const charCount = rawItems.reduce((acc, it) => acc + it.str.length, 0);
    totalChars += charCount;
    let isScanned = charCount < 25;

    // Separate header and footer
    const bodyItems: PdfTextItem[] = [];
    let runningHeader = '';
    let runningFooter = '';

    for (const it of rawItems) {
      if (it.y > pageHeight - 38) {
        // Top running header zone
        runningHeader = runningHeader ? `${runningHeader} ${it.str}` : it.str;
        if (!detectedDocTitle && it.str.length > 8) {
          detectedDocTitle = it.str;
        }
      } else if (it.y < 38) {
        // Bottom running footer zone (e.g. Page X of Y)
        runningFooter = runningFooter ? `${runningFooter} ${it.str}` : it.str;
      } else {
        bodyItems.push(it);
      }
    }

    // OCR fallback for scanned pages
    if (isScanned && mode === 'ocr') {
      try {
        const ocrResult = await Tesseract.recognize(pdfBuffer, ocrLanguage, {
          logger: () => {}
        });
        const words = (ocrResult.data as any)?.words || [];
        for (const w of words) {
          if (!w.text || !w.text.trim()) continue;
          bodyItems.push({
            str: w.text.trim(),
            x: Math.round(w.bbox.x0),
            y: Math.round(pageHeight - w.bbox.y1),
            w: Math.round(w.bbox.x1 - w.bbox.x0),
            h: Math.round(w.bbox.y1 - w.bbox.y0),
            fontSize: 11,
            fontName: 'Helvetica',
            isBold: false,
            isItalic: false
          });
        }
        if (bodyItems.length > 0) {
          isScanned = false;
        }
      } catch {
        // Fallback silently if OCR engine fails
      }
    }

    pages.push({
      pageNumber: pageNum,
      width: pageWidth,
      height: pageHeight,
      textItems: bodyItems,
      isScanned,
      runningHeader,
      runningFooter
    });
  }

  try {
    if (typeof parserInstance.destroy === 'function') {
      await parserInstance.destroy();
    }
  } catch {
    // Ignore cleanup error
  }

  return {
    pageCount: doc.numPages,
    pages,
    detectedDocTitle,
    isAllScanned: totalChars === 0
  };
}
