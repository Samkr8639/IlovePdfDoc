import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { PowerPointToPdfOptions, PowerPointToPdfFileItem } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';
import {
  checkLibreOffice,
  getSofficeBinary,
  formatBytes,
  runSofficeConversion
} from '../office-to-pdf';
import { validatePowerPointFile, ValidatedPowerPointFile } from './validate';
import { normalizePptx, NormalizePptxResult } from './normalize-pptx';
import { postProcessPptPdf } from './post';

export { checkLibreOffice, formatBytes, getSofficeBinary, validatePowerPointFile };

export interface PowerPointConversionItemResult {
  pdfBuffer: Buffer;
  pageCount: number;
  slideCount: number;
  fontsSubstituted: Array<{ requested: string; used: string }>;
  fontsMissing: string[];
  warnings: string[];
}

export async function convertPowerPointToPdf(
  buffer: Buffer,
  originalname: string,
  options: PowerPointToPdfOptions = {},
  abortSignal?: AbortSignal
): Promise<PowerPointConversionItemResult> {
  const { available } = await checkLibreOffice();
  if (!available) {
    throw new AppError(
      503,
      'ENGINE_UNAVAILABLE',
      'PDF conversion engine (LibreOffice) is not available on this server.'
    );
  }

  // 1. Validate presentation file
  const validated = await validatePowerPointFile(buffer, originalname);

  const warnings: string[] = [];
  let pptBuffer = buffer;
  let slideCount = validated.slideCountEstimate || 1;
  let slideTitles: string[] = [];
  let fontsSubstituted: Array<{ requested: string; used: string }> = [];
  let fontsMissing: string[] = [];

  // 2. Normalize PPTX (.pptx, .pptm, .ppsx)
  if (
    validated.extension === '.pptx' ||
    validated.extension === '.pptm' ||
    validated.extension === '.ppsx'
  ) {
    const norm = await normalizePptx(buffer, options);
    pptBuffer = norm.buffer;
    slideCount = norm.slideCount || slideCount;
    slideTitles = norm.slideTitles;
    fontsSubstituted = norm.fontsSubstituted;
    fontsMissing = norm.fontsMissing;
    warnings.push(...norm.warnings);

    if (norm.exportedSlideCount === 0 && norm.slideCount > 0) {
      throw new AppError(
        422,
        'EMPTY_PRESENTATION',
        `No slides were selected for export in '${originalname}'.`
      );
    }
  }

  // 3. Build impress_pdf_Export filter options JSON
  const filterData: Record<string, any> = {
    SelectPdfVersion: { type: 'long', value: options.output === 'pdfa' ? '2' : '0' },
    UseTaggedPDF: { type: 'boolean', value: options.tagged !== false ? 'true' : 'false' },
    ExportBookmarks: { type: 'boolean', value: options.bookmarks !== false ? 'true' : 'false' },
    ExportFormFields: { type: 'boolean', value: 'false' },
    ExportLinksRelativeFsys: { type: 'boolean', value: 'false' },
    ExportHiddenSlides: {
      type: 'boolean',
      value: options.slides?.includeHidden ? 'true' : 'false'
    },
    ExportNotesPages: {
      type: 'boolean',
      value: options.layout === 'notes' ? 'true' : 'false'
    },
    ExportNotes: {
      type: 'boolean',
      value: options.comments ? 'true' : 'false'
    },
    ReduceImageResolution: {
      type: 'boolean',
      value: options.imageQuality === 'smaller' ? 'true' : 'false'
    },
    MaxImageResolution: { type: 'long', value: 150 },
    Quality: { type: 'long', value: options.imageQuality === 'smaller' ? 75 : 90 }
  };

  const filterString = `pdf:impress_pdf_Export:${JSON.stringify(filterData)}`;

  // 4. Run conversion in hardened sandbox via shared runner
  const convRes = await runSofficeConversion(pptBuffer, validated.extension, 'ptp', {
    profile: 'impress',
    filterString,
    timeoutMs: parseInt(process.env['PPT_TO_PDF_TIMEOUT_MS'] || '120000', 10),
    abortSignal
  });

  warnings.push(...convRes.warnings);

  // 5. Post-processing (handouts imposition, slide page scaling, metadata, page limits)
  const postResult = await postProcessPptPdf(convRes.pdfBuffer, {
    options,
    originalName: originalname,
    deckTitle: slideTitles[0],
    slideTitles
  });

  warnings.push(...postResult.warnings);

  // De-duplicate warnings
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    pdfBuffer: postResult.pdfBuffer,
    pageCount: postResult.pageCount,
    slideCount,
    fontsSubstituted,
    fontsMissing,
    warnings: uniqueWarnings
  };
}

export async function mergePowerPointPdfOutputs(
  pdfBuffers: Buffer[],
  firstFilename: string
): Promise<{ pdfBuffer: Buffer; pageCount: number }> {
  if (pdfBuffers.length === 0) {
    throw new Error('No PDF buffers to merge.');
  }
  if (pdfBuffers.length === 1) {
    const doc = await PDFDocument.load(pdfBuffers[0], { ignoreEncryption: true });
    return { pdfBuffer: pdfBuffers[0], pageCount: doc.getPageCount() };
  }

  const mergedDoc = await PDFDocument.create();
  mergedDoc.setProducer('PDFTailor (https://pdfflow.app)');
  mergedDoc.setTitle(`${firstFilename.replace(/\.[^/.]+$/, '')} (Merged)`);

  let totalPages = 0;
  for (const buf of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const count = srcDoc.getPageCount();
    const copiedPages = await mergedDoc.copyPages(srcDoc, Array.from({ length: count }, (_, i) => i));
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
      totalPages++;
    }
  }

  const mergedBytes = await mergedDoc.save();
  return {
    pdfBuffer: Buffer.from(mergedBytes),
    pageCount: totalPages
  };
}
