import { analyzePdf, PdfLayoutModel } from '../pdf-layout';
import { extractPdfWithOcr, OcrPageResult } from '../ocr';
import { buildPptx, BuildPptxResult } from './build';
import { PdfToPowerPointMode, PdfToPowerPointSlideSize } from '@paperflow/contracts';

export interface ConvertPdfToPptxOptions {
  mode?: PdfToPowerPointMode;
  slideSize?: PdfToPowerPointSlideSize;
  ocrLanguage?: string;
  originalFilename?: string;
}

export interface ConvertPdfToPptxResult {
  pptxBuffer: Buffer;
  slideCount: number;
  warnings: string[];
}

/**
 * End-to-end PDF to PowerPoint conversion orchestrator
 */
export async function convertPdfToPptx(
  pdfBuffer: Buffer,
  options: ConvertPdfToPptxOptions = {}
): Promise<ConvertPdfToPptxResult> {
  const mode = options.mode || 'no_ocr';
  const slideSize = options.slideSize || 'match_pdf';
  const originalFilename = options.originalFilename || 'document.pdf';
  const ocrLanguage = options.ocrLanguage || 'eng';

  // Analyze structured PDF layout first
  const layoutModel = await analyzePdf(pdfBuffer);

  // If user requested No OCR, build directly from structured layout model
  if (mode !== 'ocr') {
    return await buildPptx(layoutModel, {
      slideSize,
      mode: 'no_ocr',
      originalFilename
    });
  }

  // If user requested OCR:
  // Identify pages that are genuinely scanned/image-based (i.e. having no/minimal digital text)
  const scannedPageIndices = new Set<number>();
  for (let i = 0; i < layoutModel.pages.length; i++) {
    const page = layoutModel.pages[i];
    const textChars = (page.blocks || []).reduce(
      (sum, b) => sum + (b.lines || []).reduce((s2, l) => s2 + l.reduce((s3, r) => s3 + (r.text || '').length, 0), 0),
      0
    );
    // Page is scanned or image-based if it has negligible native digital text (< 30 characters)
    if (textChars < 30) {
      scannedPageIndices.add(i);
    }
  }

  // If all pages already have rich digital vector text, native layout conversion preserves
  // exact original vector typography, tables, and colors without OCR errors or raster degradation.
  if (scannedPageIndices.size === 0) {
    const result = await buildPptx(layoutModel, {
      slideSize,
      mode: 'no_ocr',
      originalFilename
    });
    result.warnings.push(
      'Document already contains native editable digital text. Converted using high-fidelity vector extraction without degradation.'
    );
    return result;
  }

  // Extract OCR pages (with whitened background to prevent text ghosting)
  const ocrPages = await extractPdfWithOcr(pdfBuffer, {
    lang: ocrLanguage
  });

  return await buildPptx(layoutModel, {
    slideSize,
    mode: 'ocr',
    originalFilename,
    ocrPages,
    scannedPageIndices
  });
}

export * from './build';
