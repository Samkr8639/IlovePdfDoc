import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PdfToWordMode } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';

export interface ConvertPdfToWordOptions {
  mode?: PdfToWordMode;
  ocrLanguage?: string;
  originalFilename?: string;
}

export interface ConvertPdfToWordResult {
  docxBuffer: Buffer;
  pageCount: number;
  warnings: string[];
}

function nativeImport(url: string): Promise<any> {
  return new Function('s', 'return import(s)')(url);
}

let cachedConverter: any = null;

async function getConverter() {
  if (cachedConverter) return cachedConverter;
  let enginePath = path.resolve(__dirname, 'engine.mjs');
  if (!fs.existsSync(enginePath)) {
    enginePath = path.resolve(__dirname, '../../../src/services/pdf-to-word/engine.mjs');
  }
  if (!fs.existsSync(enginePath)) {
    enginePath = path.resolve(__dirname, '../../src/services/pdf-to-word/engine.mjs');
  }
  const url = pathToFileURL(enginePath).href;
  const mod = await nativeImport(url);
  cachedConverter = mod.convertPdfToDocx;
  return cachedConverter;
}

/**
 * Layout-preserving PDF → DOCX conversion.
 * Uses the pdfjs-dist v5 + docx-js 9.x layout engine from ./engine.mjs.
 * Each PDF page becomes a DOCX section with exact dimensions and absolute frame positions.
 */
export async function convertPdfToDocx(
  pdfBuffer: Buffer,
  options: ConvertPdfToWordOptions = {}
): Promise<ConvertPdfToWordResult> {
  // Validate PDF magic bytes
  if (!pdfBuffer || pdfBuffer.length < 4) {
    throw new AppError(422, 'INVALID_PDF', 'PDF buffer is empty or too short');
  }
  if (pdfBuffer.toString('utf8', 0, 4) !== '%PDF') {
    throw new AppError(422, 'INVALID_PDF_HEADER', 'File does not have a valid PDF header (%PDF)');
  }

  try {
    const convert = await getConverter();
    const { docx, model } = await convert(pdfBuffer);

    return {
      docxBuffer: docx,
      pageCount: model.pages.length,
      warnings: model.warnings || []
    };
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;

    const msg = err instanceof Error ? err.message : String(err);

    if (msg.toLowerCase().includes('invalid pdf') || msg.toLowerCase().includes('corrupt')) {
      throw new AppError(422, 'CORRUPTED_PDF', `Failed to parse PDF: ${msg}`);
    }

    throw new AppError(500, 'CONVERSION_FAILED', `PDF to Word conversion failed: ${msg}`);
  }
}

// Re-export for backward compat
export type { ConvertPdfToWordOptions as PdfToWordOptions };
