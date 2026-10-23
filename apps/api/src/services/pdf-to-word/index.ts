import { PdfToWordMode } from '@paperflow/contracts';
import { extractPdfDocument, ExtractedPdfDocument } from './pdf-layout-extractor';
import { reconstructDocumentLayout, ReconstructedDocument } from './document-layout-reconstructor';
import { generateDocxDocument } from './docx-generator';

export interface ConvertPdfToWordOptions {
  mode?: PdfToWordMode;
  ocrLanguage?: string;
  originalFilename?: string;
}

export interface ConvertPdfToWordResult {
  docxBuffer: Buffer;
  pageCount: number;
  docModel: ReconstructedDocument;
  extractedDoc: ExtractedPdfDocument;
}

/**
 * Converts a PDF buffer into a production-grade, layout-accurate Microsoft Word DOCX buffer.
 */
export async function convertPdfToDocx(
  pdfBuffer: Buffer,
  options: ConvertPdfToWordOptions = {}
): Promise<ConvertPdfToWordResult> {
  const mode = options.mode || 'no_ocr';
  const ocrLanguage = options.ocrLanguage || 'eng';

  // 1. Geometry-preserving extraction
  const extractedDoc = await extractPdfDocument(pdfBuffer, mode, ocrLanguage);

  // 2. Semantic layout and structure reconstruction
  const docModel = reconstructDocumentLayout(extractedDoc);
  if (options.originalFilename && !docModel.title) {
    docModel.title = options.originalFilename.replace(/\.[^/.]+$/, '');
  }

  // 3. Native DOCX generation
  const docxBuffer = await generateDocxDocument(docModel);

  return {
    docxBuffer,
    pageCount: extractedDoc.pageCount,
    docModel,
    extractedDoc
  };
}

export * from './pdf-layout-extractor';
export * from './document-layout-reconstructor';
export * from './docx-generator';
