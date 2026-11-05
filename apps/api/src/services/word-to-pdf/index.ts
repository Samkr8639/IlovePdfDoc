import { normalizeDocx } from './normalize-docx';
import * as path from 'path';
import { AppError } from '../../middleware/errorHandler';
import {
  checkLibreOffice,
  getSofficeBinary,
  formatBytes,
  runSofficeConversion
} from '../office-to-pdf';

export { checkLibreOffice, formatBytes, getSofficeBinary };

// ──────────────────────────────────────────────────────────────
// Input Validation
// ──────────────────────────────────────────────────────────────

export interface ValidatedWordFile {
  buffer: Buffer;
  originalname: string;
  extension: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.doc', '.docx', '.odt', '.rtf']);
const SUPPORTED_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/rtf'
]);

export function validateWordFile(
  buffer: Buffer,
  originalname: string,
  mimetype?: string
): void {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The file '${originalname}' is empty.`);
  }

  const ext = path.extname(originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      `Unsupported file type '${ext}'. Please upload a .doc, .docx, .odt, or .rtf file.`
    );
  }

  // Mime type is advisory — do not block on it since browsers report inconsistently
  if (mimetype && !SUPPORTED_MIMES.has(mimetype) && mimetype !== 'application/octet-stream') {
    // warn but allow through — LibreOffice is the real validator
  }

  // ZIP signature check for .docx / .odt (OOXML/ODF are both ZIP archives)
  if (ext === '.docx' || ext === '.odt') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid ${ext.toUpperCase()} document.`
      );
    }
  }

  // OLE2 magic for .doc
  if (ext === '.doc') {
    if (
      buffer[0] !== 0xd0 || buffer[1] !== 0xcf ||
      buffer[2] !== 0x11 || buffer[3] !== 0xe0
    ) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid .doc file.`
      );
    }
  }

  // RTF magic
  if (ext === '.rtf') {
    const start = buffer.subarray(0, 5).toString('ascii');
    if (!start.startsWith('{\\rtf')) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid RTF document.`
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Conversion
// ──────────────────────────────────────────────────────────────

export interface ConversionResult {
  pdfBuffer: Buffer;
  pageCount: number;
  fontsSubstituted: string[];
  warnings: string[];
}

export interface ConversionOptions {
  output?: 'pdf' | 'pdfa';
  imageQuality?: 'standard' | 'smaller';
  embedBookmarks?: boolean;
  useTaggedPdf?: boolean;
  exportHyperlinks?: boolean;
}

export async function convertWordToPdf(
  buffer: Buffer,
  originalname: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const warnings: string[] = [];
  let fileBuffer = buffer;
  const ext = path.extname(originalname).toLowerCase() || '.docx';

  // Apply DOCX table fidelity normalizer (resolves exact row height clipping in LibreOffice)
  if (ext === '.docx') {
    try {
      const norm = await normalizeDocx(fileBuffer);
      fileBuffer = norm.buffer;
      if (norm.fixes.exactToAtLeast > 0 || (norm.fixes.framesNormalized && norm.fixes.framesNormalized > 0)) {
        warnings.push('Fixed-height table rows were adjusted so borders and shading display correctly.');
      }
    } catch {
      // Fallback to original buffer if normalization fails
    }
  }

  const filterString = options.output === 'pdfa'
    ? 'pdf:writer_pdf_Export:SelectPdfVersion=1'
    : 'pdf:writer_pdf_Export';

  const res = await runSofficeConversion(fileBuffer, ext, 'wtp', {
    profile: 'writer',
    filterString
  });

  return {
    pdfBuffer: res.pdfBuffer,
    pageCount: res.pageCount,
    fontsSubstituted: [],
    warnings: [...warnings, ...res.warnings]
  };
}
