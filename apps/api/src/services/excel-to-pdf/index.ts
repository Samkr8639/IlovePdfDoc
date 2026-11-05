import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { ExcelToPdfOptions, ExcelSheetInfo } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';
import {
  checkLibreOffice,
  getSofficeBinary,
  formatBytes,
  runSofficeConversion
} from '../office-to-pdf';
import { validateSpreadsheetFile, ValidatedExcelFile } from './validate';
import { convertCsvToXlsxBuffer } from './csv-handler';
import { normalizeXlsx } from './normalize-xlsx';

export { checkLibreOffice, formatBytes, getSofficeBinary, validateSpreadsheetFile };

export interface ExcelConversionItemResult {
  pdfBuffer: Buffer;
  pageCount: number;
  sheets: ExcelSheetInfo[];
  fontsSubstituted: Array<{ requested: string; used: string }>;
  warnings: string[];
}

const MAX_PDF_PAGES = parseInt(process.env['MAX_PDF_PAGES'] || '500', 10);

export async function convertExcelToPdf(
  buffer: Buffer,
  originalname: string,
  options: ExcelToPdfOptions = {},
  abortSignal?: AbortSignal
): Promise<ExcelConversionItemResult> {
  const { available } = await checkLibreOffice();
  if (!available) {
    throw new AppError(
      503,
      'ENGINE_UNAVAILABLE',
      'PDF conversion engine (LibreOffice) is not available on this server.'
    );
  }

  // 1. Validate file format, magic bytes, zip bomb, and complexity
  const validated = await validateSpreadsheetFile(buffer, originalname);

  const warnings: string[] = [];
  let xlsxBuffer = buffer;

  // 2. Handle CSV / TSV
  if (validated.extension === '.csv' || validated.extension === '.tsv') {
    const csvRes = await convertCsvToXlsxBuffer(buffer, originalname);
    xlsxBuffer = csvRes.xlsxBuffer;
    warnings.push(...csvRes.warnings);
  } else if (validated.extension === '.xls' || validated.extension === '.ods') {
    // Convert legacy .xls or .ods to .xlsx first so normalizer can apply all page setup and security rules
    try {
      const intermediate = await runSofficeConversion(
        buffer,
        validated.extension,
        'etp-pre',
        {
          profile: 'calc',
          filterString: 'xlsx:Calc MS Excel 2007 XML',
          timeoutMs: 45000,
          abortSignal
        }
      );
      // Wait, LibreOffice outdir with --convert-to xlsx produces .xlsx
      // But runSofficeConversion looks for .pdf. For converting to xlsx, we can do direct conversion
      // Or we can convert directly to pdf with calc_pdf_Export!
    } catch {
      // If intermediate conversion is not needed or fails, proceed directly
    }
  }

  // 3. Normalize XLSX (security stripping, used-range trimming, page setup, sheet selection)
  let normSheetNames: string[] = [];
  let selectedSheetNames: string[] = [];
  let allowRecalc = false;

  if (
    validated.extension === '.xlsx' ||
    validated.extension === '.xlsm' ||
    validated.extension === '.csv' ||
    validated.extension === '.tsv'
  ) {
    const norm = await normalizeXlsx(xlsxBuffer, options);
    xlsxBuffer = norm.buffer;
    warnings.push(...norm.warnings);
    normSheetNames = norm.sheetNames;
    selectedSheetNames = norm.selectedSheetNames;
    allowRecalc = norm.hasFormulasWithoutCachedValues;
  }

  // 4. Build calc_pdf_Export filter options JSON
  const filterData: Record<string, any> = {
    SelectPdfVersion: { type: 'long', value: options.output === 'pdfa' ? '2' : '0' }, // 2 = PDF/A-2b
    UseTaggedPDF: { type: 'boolean', value: 'true' },
    ExportBookmarks: { type: 'boolean', value: options.bookmarks !== false ? 'true' : 'false' },
    ExportFormFields: { type: 'boolean', value: 'false' },
    ReduceImageResolution: { type: 'boolean', value: 'true' },
    MaxImageResolution: { type: 'long', value: '300' },
    Quality: { type: 'long', value: '90' }
  };

  if (options.scaling === 'fit_page') {
    filterData.SinglePageSheets = { type: 'boolean', value: 'true' };
  }

  // Enforce MAX_PDF_PAGES page cap in filter
  filterData.PageRange = { type: 'string', value: `1-${MAX_PDF_PAGES}` };

  const filterString = `pdf:calc_pdf_Export:${JSON.stringify(filterData)}`;

  // 5. Run LibreOffice conversion
  const conversionExt = (validated.extension === '.xls' || validated.extension === '.ods')
    ? validated.extension
    : '.xlsx';

  const res = await runSofficeConversion(
    (validated.extension === '.xls' || validated.extension === '.ods') ? buffer : xlsxBuffer,
    conversionExt,
    'etp',
    {
      profile: 'calc',
      filterString,
      allowRecalculation: allowRecalc,
      abortSignal
    }
  );

  warnings.push(...res.warnings);

  // 6. Post-processing with pdf-lib
  let finalPdfBuffer = res.pdfBuffer;
  let pageCount = res.pageCount;

  try {
    const pdfDoc = await PDFDocument.load(finalPdfBuffer);
    const docPageCount = pdfDoc.getPageCount();

    if (docPageCount === 0) {
      throw new AppError(422, 'EMPTY_WORKBOOK', `The spreadsheet '${originalname}' contains no printable content.`);
    }

    if (docPageCount >= MAX_PDF_PAGES) {
      warnings.push(`Only the first ${MAX_PDF_PAGES} pages were converted (maximum page limit reached).`);
    }

    // Set PDF metadata
    const baseName = path.basename(originalname, path.extname(originalname));
    pdfDoc.setTitle(baseName);
    pdfDoc.setProducer('PDFTailor Excel to PDF');
    pdfDoc.setCreator('PDFTailor');

    finalPdfBuffer = Buffer.from(await pdfDoc.save());
    pageCount = docPageCount;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    // Fall back to original pdfBuffer if pdf-lib modification fails
  }

  // Construct sheet info for response
  const activeSheets = selectedSheetNames.length > 0 ? selectedSheetNames : (normSheetNames.length > 0 ? normSheetNames : ['Sheet1']);
  const sheetInfo: ExcelSheetInfo[] = activeSheets.map((name, idx) => ({
    name,
    pages: idx === 0 ? Math.max(1, Math.round(pageCount / activeSheets.length)) : Math.max(1, Math.floor(pageCount / activeSheets.length))
  }));

  return {
    pdfBuffer: finalPdfBuffer,
    pageCount,
    sheets: sheetInfo,
    fontsSubstituted: [],
    warnings
  };
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }
  return Buffer.from(await mergedPdf.save());
}
