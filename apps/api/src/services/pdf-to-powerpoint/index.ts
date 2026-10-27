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

  if (mode === 'ocr') {
    const ocrPages = await extractPdfWithOcr(pdfBuffer, {
      lang: ocrLanguage
    });

    const dummyModel: PdfLayoutModel = {
      pages: ocrPages.map(p => ({
        width: p.widthPt,
        height: p.heightPt,
        blocks: [],
        lines: [],
        boxes: [],
        images: []
      })),
      warnings: []
    };

    return await buildPptx(dummyModel, {
      slideSize,
      mode: 'ocr',
      originalFilename,
      ocrPages
    });
  }

  // Standard No OCR mode: extract exact visual layout model
  const layoutModel = await analyzePdf(pdfBuffer);
  return await buildPptx(layoutModel, {
    slideSize,
    mode: 'no_ocr',
    originalFilename
  });
}

export * from './build';
