import { PDFDocument } from 'pdf-lib';
import { analyzePdf, LayoutPage, LayoutSegment } from '../pdf-layout';
import { extractPdfWithOcr } from '../ocr';
import { detectTablesOnPage, mergeCrossPageTables, DetectedTable } from './detect';
import { buildExcelWorkbook, BuildWorkbookResult, OutsideTextBlock } from './build';
import { applyCoverageGuard } from './coverage';
import { PdfToExcelOptions, PdfToExcelTable } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';

export interface ConvertPdfToExcelOptions extends PdfToExcelOptions {
  originalFilename?: string;
  title?: string;
}

export interface ConvertPdfToExcelResult {
  xlsxBuffer: Buffer;
  sheetCount: number;
  tableCount: number;
  rowCount: number;
  cellCount: number;
  tables: PdfToExcelTable[];
  warnings: string[];
  coverage: number;
}

/**
 * Parse page range string (e.g. "1-3,5,8-10" or "All pages") against total pages
 */
export function parsePageRange(rangeStr: string | undefined, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim() === '' || rangeStr.toLowerCase().includes('all')) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(',');

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > totalPages || end > totalPages) {
        throw new AppError(
          400,
          'INVALID_PAGE_RANGE',
          `Invalid page range '${part}'. Document has ${totalPages} pages.`
        );
      }

      for (let p = start; p <= end; p++) {
        pagesSet.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (isNaN(p) || p < 1 || p > totalPages) {
        throw new AppError(
          400,
          'INVALID_PAGE_RANGE',
          `Page ${part} is out of range. Document has ${totalPages} pages.`
        );
      }
      pagesSet.add(p);
    }
  }

  if (pagesSet.size === 0) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  return Array.from(pagesSet).sort((a, b) => a - b);
}

/**
 * Main conversion engine: converts PDF buffer to Excel (.xlsx) workbook
 */
export async function convertPdfToExcel(
  pdfBuffer: Buffer,
  options: ConvertPdfToExcelOptions
): Promise<ConvertPdfToExcelResult> {
  const warnings: string[] = [];

  // Determine total pages using pdf-lib
  let totalPages = 1;
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    totalPages = pdfDoc.getPageCount();
  } catch {
    // Will be caught in route validator if corrupt
  }

  const selectedPages = parsePageRange(options.pages, totalPages);
  const selectedPagesSet = new Set(selectedPages);

  const pageTables: { pageNumber: number; tables: DetectedTable[] }[] = [];
  const outsideTextByPage: { page: number; text: string }[] = [];
  const allPdfTextByPage: { page: number; text: string }[] = [];
  const outsideBlocks: OutsideTextBlock[] = [];

  if (options.mode === 'ocr') {
    // OCR Mode: Process selected pages through OCR engine
    const ocrPages = await extractPdfWithOcr(pdfBuffer, { lang: 'eng' });
    for (const pageNum of selectedPages) {
      const ocrResult = ocrPages.find(p => p.pageNumber === pageNum);
      if (!ocrResult) continue;

      try {
        const segments: LayoutSegment[] = (ocrResult.lines || []).map(line => ({
          x: line.xPt,
          y: line.yPt,
          x0: line.xPt,
          x1: line.xPt + line.wPt,
          yb: line.yPt,
          width: line.wPt,
          right: line.xPt + line.wPt,
          fs: line.fontSizePt || 10,
          text: line.text,
          runs: [{
            text: line.text,
            font: 'Arial',
            rawFont: 'Arial',
            generic: 'sans',
            bold: false,
            italic: false,
            color: '#000000',
            fs: line.fontSizePt || 10
          }]
        }));

        const mockPage: LayoutPage = {
          width: ocrResult.widthPt || 595,
          height: ocrResult.heightPt || 842,
          blocks: [],
          lines: [],
          boxes: [],
          images: [],
          segments
        };

        allPdfTextByPage.push({
          page: pageNum,
          text: (ocrResult.lines || []).map(l => l.text).join('\n')
        });

        const tables = detectTablesOnPage(mockPage, pageNum);
        // Mark tables method as 'ocr'
        for (const t of tables) {
          t.method = 'ocr';
        }
        pageTables.push({ pageNumber: pageNum, tables });

        // Collect text outside tables
        const outsideSegs = segments.filter(seg =>
          !tables.some(t =>
            seg.x >= t.bbox.x0 - 2 && seg.x <= t.bbox.x1 + 2 &&
            seg.y >= t.bbox.y0 - 2 && seg.y <= t.bbox.y1 + 2
          )
        );
        if (outsideSegs.length > 0) {
          outsideTextByPage.push({
            page: pageNum,
            text: outsideSegs.map(s => s.text).join('\n')
          });
        }
      } catch (err) {
        warnings.push(`OCR processing failed on page ${pageNum}: ${err}`);
      }

      await new Promise(resolve => setImmediate(resolve));
    }
  } else {
    // Standard Vector / Selectable Text Mode
    const layout = await analyzePdf(pdfBuffer, { title: options.title || options.originalFilename });
    if (layout.warnings && layout.warnings.length > 0) {
      warnings.push(...layout.warnings.filter(w => !w.toLowerCase().includes('vector shapes skipped')));
    }

    for (let pIdx = 0; pIdx < layout.pages.length; pIdx++) {
      const pageNum = pIdx + 1;
      if (!selectedPagesSet.has(pageNum)) continue;

      const page = layout.pages[pIdx];
      const tables = detectTablesOnPage(page, pageNum);
      pageTables.push({ pageNumber: pageNum, tables });

      // Collect text outside tables for optional 'Text' sheet or fallback
      const segments = page.segments || [];
      allPdfTextByPage.push({
        page: pageNum,
        text: segments.map(s => s.text).join('\n')
      });
      const outsideSegs = segments.filter(seg =>
        !tables.some(t =>
          seg.x >= t.bbox.x0 - 2 && seg.x <= t.bbox.x1 + 2 &&
          seg.y >= t.bbox.y0 - 2 && seg.y <= t.bbox.y1 + 2
        )
      );
      if (outsideSegs.length > 0) {
        outsideTextByPage.push({
          page: pageNum,
          text: outsideSegs.map(s => s.text).join('\n')
        });
      }

      // Collect outside blocks for reading-order merged emission
      if (page.blocks && page.blocks.length > 0) {
        for (const block of page.blocks) {
          const inside = tables.some(t =>
            block.x >= t.bbox.x0 - 2 && block.x <= t.bbox.x1 + 2 &&
            block.y >= t.bbox.y0 - 2 && block.y <= t.bbox.y1 + 2
          );
          if (!inside) {
            const blockText = block.lines.map(line => line.map(r => r.text).join('')).join('\n').trim();
            if (blockText) {
              const isBold = block.lines.some(l => l.some(r => r.bold));
              const isHeading = (block.fs && block.fs >= 13) || (isBold && blockText.length < 80);
              const blockFont = block.lines[0]?.find(r => r.font)?.font;
              outsideBlocks.push({
                page: pageNum,
                y0: block.y,
                text: blockText,
                fs: block.fs,
                bold: isBold,
                align: block.align,
                isHeading,
                fontName: blockFont
              });
            }
          }
        }
      } else if (outsideSegs.length > 0) {
        const yGroups = new Map<number, typeof outsideSegs>();
        for (const seg of outsideSegs) {
          const key = Math.round((seg.yb || seg.y) / 6) * 6;
          const list = yGroups.get(key) || [];
          list.push(seg);
          yGroups.set(key, list);
        }
        for (const [yKey, segs] of yGroups.entries()) {
          segs.sort((a, b) => a.x - b.x);
          const lineText = segs.map(s => s.text).join(' ').trim();
          if (!lineText) continue;
          const maxFs = Math.max(...segs.map(s => s.fs || 10));
          const hasBold = segs.some(s => s.runs?.some(r => r.bold));
          outsideBlocks.push({
            page: pageNum,
            y0: yKey,
            text: lineText,
            fs: maxFs,
            bold: hasBold,
            isHeading: maxFs >= 13 || (hasBold && lineText.length < 80)
          });
        }
      }

      // Cooperative yield between pages
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // Merge cross-page tables if requested
  const allDetectedTables = mergeCrossPageTables(pageTables, options.mergeAcrossPages);

  // Filter out low confidence demoted tables (< 0.35) into outsideText
  const validTables: DetectedTable[] = [];
  for (const t of allDetectedTables) {
    if (t.demotedToText) {
      warnings.push(`Low-confidence table on page ${t.page} was demoted to plain text.`);
      const tableText = t.grid.map(row => row.map(c => c?.text || '').join('\t')).join('\n');
      outsideTextByPage.push({ page: t.page, text: tableText });
    } else {
      t.file = options.originalFilename;
      validTables.push(t);
    }
  }

  // Handle NO TABLES FOUND:
  // "never return an empty workbook silently; if nothing at all can be extracted return error NO_TABLES_FOUND 422 with a helpful message suggesting OCR for scans."
  if (validTables.length === 0) {
    const hasAnyText = outsideTextByPage.some(item => item.text.trim().length > 0);
    if (!hasAnyText) {
      throw new AppError(
        422,
        'NO_TABLES_FOUND',
        'No tables or selectable text could be found in the document. If this is a scanned PDF, please enable OCR mode.'
      );
    }

    // Force include text into a Text sheet so the user gets their content
    warnings.push('No tables were detected. Document text has been extracted into a Text sheet.');
    options.includeText = true;
  }

  // Build the Excel workbook
  const workbookResult: BuildWorkbookResult = await buildExcelWorkbook(validTables, {
    options,
    title: options.title,
    originalFilename: options.originalFilename,
    outsideTextByPage,
    outsideBlocks
  });

  if (workbookResult.warnings && workbookResult.warnings.length > 0) {
    warnings.push(...workbookResult.warnings);
  }

  // Coverage guard: check coverage, append missing text to Text sheet if < 98%
  const coverageResult = await applyCoverageGuard(workbookResult.workbook, allPdfTextByPage, warnings);
  const finalBuffer = Buffer.from(await workbookResult.workbook.xlsx.writeBuffer());

  // Construct table preview models for response
  const tablesResponse: PdfToExcelTable[] = validTables.map((t, idx) => {
    const previewRows = Math.min(15, t.rows);
    const previewCols = Math.min(10, t.cols);
    const preview: string[][] = [];

    for (let r = 0; r < previewRows; r++) {
      const rowArr: string[] = [];
      for (let c = 0; c < previewCols; c++) {
        rowArr.push(t.grid[r]?.[c]?.text || '');
      }
      preview.push(rowArr);
    }

    const sheetName = t.title || `Table ${idx + 1}`;
    return {
      file: options.originalFilename || 'document.pdf',
      page: t.page,
      sheet: sheetName,
      rows: t.rows,
      cols: t.cols,
      method: t.method,
      confidence: Math.round(t.confidence * 100) / 100,
      preview
    };
  });

  return {
    xlsxBuffer: finalBuffer,
    sheetCount: workbookResult.workbook.worksheets.length,
    tableCount: workbookResult.tableCount,
    rowCount: workbookResult.rowCount,
    cellCount: workbookResult.cellCount,
    tables: tablesResponse,
    warnings: Array.from(new Set(warnings)),
    coverage: coverageResult.coverage
  };
}

export interface ConvertMultiplePdfsInput {
  buffer: Buffer;
  filename: string;
}

export interface ConvertMultiplePdfsResult extends ConvertPdfToExcelResult {
  fileStats: Array<{
    filename: string;
    sheets: number;
    tables: number;
    rows: number;
    cells: number;
    coverage?: number;
  }>;
}

/**
 * Converts multiple PDF files into a single consolidated Excel (.xlsx) workbook
 */
export async function convertMultiplePdfsToOneWorkbook(
  files: ConvertMultiplePdfsInput[],
  options: PdfToExcelOptions
): Promise<ConvertMultiplePdfsResult> {
  const warnings: string[] = [];
  const allValidTables: DetectedTable[] = [];
  const outsideTextByPage: { page: number; text: string }[] = [];
  const allPdfTextByPage: { page: number; text: string }[] = [];
  const fileStats: ConvertMultiplePdfsResult['fileStats'] = [];

  for (const file of files) {
    const fileBase = file.filename.replace(/\.[^/.]+$/, '');
    let totalPages = 1;
    try {
      const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
    } catch {
      // Handled in validation
    }

    const selectedPages = parsePageRange(options.pages, totalPages);
    const selectedPagesSet = new Set(selectedPages);
    const pageTables: { pageNumber: number; tables: DetectedTable[] }[] = [];

    if (options.mode === 'ocr') {
      const ocrPages = await extractPdfWithOcr(file.buffer, { lang: 'eng' });
      for (const pageNum of selectedPages) {
        const ocrResult = ocrPages.find(p => p.pageNumber === pageNum);
        if (!ocrResult) continue;

        try {
          allPdfTextByPage.push({
            page: pageNum,
            text: (ocrResult.lines || []).map(l => l.text).join('\n')
          });
          const segments: LayoutSegment[] = (ocrResult.lines || []).map(line => ({
            x: line.xPt,
            y: line.yPt,
            x0: line.xPt,
            x1: line.xPt + line.wPt,
            yb: line.yPt,
            width: line.wPt,
            right: line.xPt + line.wPt,
            fs: line.fontSizePt || 10,
            text: line.text,
            runs: [{
              text: line.text,
              font: 'Arial',
              rawFont: 'Arial',
              generic: 'sans',
              bold: false,
              italic: false,
              color: '#000000',
              fs: line.fontSizePt || 10
            }]
          }));

          const mockPage: LayoutPage = {
            width: ocrResult.widthPt || 595,
            height: ocrResult.heightPt || 842,
            blocks: [],
            lines: [],
            boxes: [],
            images: [],
            segments
          };

          const tables = detectTablesOnPage(mockPage, pageNum);
          for (const t of tables) {
            t.method = 'ocr';
          }
          pageTables.push({ pageNumber: pageNum, tables });

          const outsideSegs = segments.filter(seg =>
            !tables.some(t =>
              seg.x >= t.bbox.x0 - 2 && seg.x <= t.bbox.x1 + 2 &&
              seg.y >= t.bbox.y0 - 2 && seg.y <= t.bbox.y1 + 2
            )
          );
          if (outsideSegs.length > 0) {
            outsideTextByPage.push({
              page: pageNum,
              text: `[${fileBase}] ` + outsideSegs.map(s => s.text).join('\n')
            });
          }
        } catch (err) {
          warnings.push(`OCR failed for ${file.filename} page ${pageNum}: ${err}`);
        }
        await new Promise(resolve => setImmediate(resolve));
      }
    } else {
      const layout = await analyzePdf(file.buffer, { title: file.filename });
      if (layout.warnings && layout.warnings.length > 0) {
        warnings.push(...layout.warnings.filter(w => !w.toLowerCase().includes('vector shapes skipped')));
      }

      for (let pIdx = 0; pIdx < layout.pages.length; pIdx++) {
        const pageNum = pIdx + 1;
        if (!selectedPagesSet.has(pageNum)) continue;

        const page = layout.pages[pIdx];
        const tables = detectTablesOnPage(page, pageNum);
        pageTables.push({ pageNumber: pageNum, tables });

        const segments = page.segments || [];
        allPdfTextByPage.push({
          page: pageNum,
          text: segments.map(s => s.text).join('\n')
        });
        const outsideSegs = segments.filter(seg =>
          !tables.some(t =>
            seg.x >= t.bbox.x0 - 2 && seg.x <= t.bbox.x1 + 2 &&
            seg.y >= t.bbox.y0 - 2 && seg.y <= t.bbox.y1 + 2
          )
        );
        if (outsideSegs.length > 0) {
          outsideTextByPage.push({
            page: pageNum,
            text: `[${fileBase}] ` + outsideSegs.map(s => s.text).join('\n')
          });
        }
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const merged = mergeCrossPageTables(pageTables, options.mergeAcrossPages);
    let fileRows = 0;
    let fileCells = 0;
    let fileTableCount = 0;

    for (const t of merged) {
      if (t.demotedToText) {
        warnings.push(`Low-confidence table in ${file.filename} page ${t.page} demoted to text.`);
        const tableText = t.grid.map(row => row.map(c => c?.text || '').join('\t')).join('\n');
        outsideTextByPage.push({ page: t.page, text: `[${fileBase}] ` + tableText });
      } else {
        t.file = fileBase;
        allValidTables.push(t);
        fileTableCount++;
        fileRows += t.rows;
        fileCells += t.rows * t.cols;
      }
    }

    fileStats.push({
      filename: file.filename,
      sheets: options.sheetLayout === 'single_sheet' ? 1 : fileTableCount,
      tables: fileTableCount,
      rows: fileRows,
      cells: fileCells
    });
  }

  if (allValidTables.length === 0) {
    const hasAnyText = outsideTextByPage.some(item => item.text.trim().length > 0);
    if (!hasAnyText) {
      throw new AppError(
        422,
        'NO_TABLES_FOUND',
        'No tables or selectable text could be found across the uploaded documents.'
      );
    }
    warnings.push('No tables were detected. Document text has been extracted into a Text sheet.');
    options.includeText = true;
  }

  const workbookResult = await buildExcelWorkbook(allValidTables, {
    options,
    title: 'Combined Export',
    originalFilename: 'combined.xlsx',
    outsideTextByPage
  });

  if (workbookResult.warnings && workbookResult.warnings.length > 0) {
    warnings.push(...workbookResult.warnings);
  }

  // Coverage guard: check coverage, append missing text to Text sheet if < 98%
  const coverageResult = await applyCoverageGuard(workbookResult.workbook, allPdfTextByPage, warnings);
  const finalBuffer = Buffer.from(await workbookResult.workbook.xlsx.writeBuffer());

  const tablesResponse: PdfToExcelTable[] = allValidTables.map((t, idx) => {
    const previewRows = Math.min(15, t.rows);
    const previewCols = Math.min(10, t.cols);
    const preview: string[][] = [];

    for (let r = 0; r < previewRows; r++) {
      const rowArr: string[] = [];
      for (let c = 0; c < previewCols; c++) {
        rowArr.push(t.grid[r]?.[c]?.text || '');
      }
      preview.push(rowArr);
    }

    const sheetName = t.file ? `${t.file} - ${t.title || 'Table ' + (idx + 1)}` : (t.title || `Table ${idx + 1}`);
    return {
      file: t.file || 'document.pdf',
      page: t.page,
      sheet: sheetName,
      rows: t.rows,
      cols: t.cols,
      method: t.method,
      confidence: Math.round(t.confidence * 100) / 100,
      preview
    };
  });

  return {
    xlsxBuffer: finalBuffer,
    sheetCount: workbookResult.workbook.worksheets.length,
    tableCount: workbookResult.tableCount,
    rowCount: workbookResult.rowCount,
    cellCount: workbookResult.cellCount,
    tables: tablesResponse,
    fileStats,
    warnings: Array.from(new Set(warnings)),
    coverage: coverageResult.coverage
  };
}
