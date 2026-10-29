import ExcelJS from 'exceljs';
import { DetectedTable, DetectedCell } from './detect';
import { typeColumnCells, TypedCell } from './typing';
import { PdfToExcelOptions } from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';

export interface OutsideTextBlock {
  page: number;
  y0: number;
  text: string;
  fs?: number;
  bold?: boolean;
  align?: 'left' | 'right' | 'center';
  isHeading?: boolean;
}

export interface BuildWorkbookOptions {
  options: PdfToExcelOptions;
  title?: string;
  originalFilename?: string;
  outsideTextByPage?: { page: number; text: string }[];
  outsideBlocks?: OutsideTextBlock[];
}

export interface BuildWorkbookResult {
  buffer: Buffer;
  workbook: ExcelJS.Workbook;
  sheetCount: number;
  tableCount: number;
  rowCount: number;
  cellCount: number;
  warnings: string[];
}

/**
 * Sanitize sheet name: <= 31 chars, strip forbidden characters []:*?/\, fallback to default
 */
export function sanitizeSheetName(name: string, fallback = 'Sheet'): string {
  if (!name) return fallback;
  let clean = name.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length === 0) clean = fallback;
  if (clean.length > 31) clean = clean.substring(0, 31).trim();
  return clean || fallback;
}

/**
 * Generate a unique sheet name within a workbook
 */
export function getUniqueSheetName(base: string, existingNames: Set<string>): string {
  let name = sanitizeSheetName(base);
  if (!existingNames.has(name.toLowerCase())) {
    existingNames.add(name.toLowerCase());
    return name;
  }

  let counter = 2;
  while (true) {
    const suffix = ` (${counter})`;
    const truncatedBase = name.length + suffix.length > 31 ? name.substring(0, 31 - suffix.length) : name;
    const candidate = `${truncatedBase}${suffix}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      existingNames.add(candidate.toLowerCase());
      return candidate;
    }
    counter++;
  }
}

/**
 * Sanitize string value against formula injection:
 * Prefix strings starting with =, +, -, @, \t, \r with '
 */
export function sanitizeFormulaInjection(val: string): string {
  if (!val) return val;
  const firstChar = val.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return "'" + val;
  }
  return val;
}

/**
 * Convert hex color string to ARGB hex string for ExcelJS
 */
function toArgb(hex?: string, defaultArgb = 'FF000000'): string {
  if (!hex) return defaultArgb;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length === 6) {
    return 'FF' + h.toUpperCase();
  }
  if (h.length === 8) {
    return h.toUpperCase();
  }
  return defaultArgb;
}

/**
 * Build Excel workbook from detected tables
 */
export async function buildExcelWorkbook(
  tables: DetectedTable[],
  opts: BuildWorkbookOptions
): Promise<BuildWorkbookResult> {
  const { options, title, originalFilename, outsideTextByPage } = opts;
  const warnings: string[] = [];

  // Check total cell count limits
  let totalCellCount = 0;
  for (const t of tables) {
    totalCellCount += t.rows * t.cols;
  }
  if (totalCellCount > 2000000) {
    throw new AppError(
      413,
      'TOO_LARGE',
      `Workbook contains ${totalCellCount.toLocaleString()} cells, which exceeds the maximum limit of 2,000,000 cells.`
    );
  }

  const wb = new ExcelJS.Workbook();
  wb.title = title || originalFilename || 'PDF Export';
  wb.creator = ''; // Empty creator as specified

  const existingSheetNames = new Set<string>();
  let totalRowsWritten = 0;
  let totalCellsWritten = 0;

  // Group tables and text blocks based on sheetLayout:
  // 'sheet_per_table' | 'sheet_per_page' | 'single_sheet'
  interface SheetGroup {
    sheetTitle: string;
    tables: DetectedTable[];
    outsideBlocks: OutsideTextBlock[];
  }
  const sheetGroups: SheetGroup[] = [];

  if (options.sheetLayout === 'single_sheet') {
    sheetGroups.push({
      sheetTitle: title || originalFilename?.replace(/\.[^.]+$/, '') || 'Data',
      tables,
      outsideBlocks: opts.outsideBlocks || []
    });
  } else if (options.sheetLayout === 'sheet_per_page') {
    const byPage = new Map<string, { tables: DetectedTable[]; blocks: OutsideTextBlock[] }>();
    for (const t of tables) {
      const key = t.file ? `${t.file} - Page ${t.page}` : `Page ${t.page}`;
      const entry = byPage.get(key) || { tables: [], blocks: [] };
      entry.tables.push(t);
      byPage.set(key, entry);
    }
    for (const b of (opts.outsideBlocks || [])) {
      const key = `Page ${b.page}`;
      const entry = byPage.get(key) || { tables: [], blocks: [] };
      entry.blocks.push(b);
      byPage.set(key, entry);
    }
    for (const [pageKey, data] of byPage.entries()) {
      sheetGroups.push({
        sheetTitle: pageKey,
        tables: data.tables,
        outsideBlocks: data.blocks
      });
    }
  } else {
    // sheet_per_table
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const prefix = t.file ? `${t.file} - ` : '';
      const sheetName = t.title ? `${prefix}${t.title}` : `${prefix}Table ${i + 1}`;
      sheetGroups.push({
        sheetTitle: sheetName,
        tables: [t],
        outsideBlocks: []
      });
    }
  }

  // Write each sheet
  for (const group of sheetGroups) {
    const sheetName = getUniqueSheetName(group.sheetTitle, existingSheetNames);
    const ws = wb.addWorksheet(sheetName);

    let startRow = 1;
    let maxColsInSheet = Math.max(1, ...group.tables.map(t => t.cols));
    const colMaxWidths = new Map<number, number>();

    type SheetItem =
      | { type: 'table'; y0: number; table: DetectedTable }
      | { type: 'text'; y0: number; block: OutsideTextBlock };

    const sheetItems: SheetItem[] = [
      ...group.tables.map(t => ({ type: 'table' as const, y0: t.bbox.y0, table: t }))
    ];

    if (options.includeText && group.outsideBlocks.length > 0) {
      for (const b of group.outsideBlocks) {
        sheetItems.push({ type: 'text' as const, y0: b.y0, block: b });
      }
    }

    sheetItems.sort((a, b) => a.y0 - b.y0);

    let tableIndexInSheet = 0;
    for (const item of sheetItems) {
      if (item.type === 'text') {
        const wsRow = ws.getRow(startRow);
        const cell = wsRow.getCell(1);
        cell.value = sanitizeFormulaInjection(item.block.text);

        if (maxColsInSheet > 1) {
          try {
            ws.mergeCells(startRow, 1, startRow, maxColsInSheet);
          } catch {
            // Ignore overlap if any
          }
        }

        const isHeading = item.block.isHeading || (item.block.fs !== undefined && item.block.fs >= 13) || item.block.bold;
        const fontSize = isHeading ? Math.max(12, Math.min(18, Math.round(item.block.fs || 13))) : 11;
        cell.font = {
          name: 'Calibri',
          size: fontSize,
          bold: isHeading,
          color: isHeading ? { argb: 'FF14213D' } : undefined
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: item.block.align || 'left',
          wrapText: true
        };
        startRow++;
        totalRowsWritten++;
        totalCellsWritten++;
        continue;
      }

      const table = item.table;
      tableIndexInSheet++;

      // If multiple tables in one sheet, add title banner and blank space
      if (group.tables.length > 1) {
        if (tableIndexInSheet > 1) {
          startRow += 2; // blank rows between tables
        }
        if (table.title) {
          const titleRow = ws.getRow(startRow);
          titleRow.getCell(1).value = sanitizeFormulaInjection(table.title);
          titleRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF14213D' } };
          startRow += 1;
        }
      }

      maxColsInSheet = Math.max(maxColsInSheet, table.cols);

      // Pre-type columns across table rows
      const typedColumns: TypedCell[][] = [];
      for (let c = 0; c < table.cols; c++) {
        const startR = table.hasHeader ? 1 : 0;
        const colStrings: string[] = [];
        for (let r = startR; r < table.rows; r++) {
          const cell = table.grid[r]?.[c];
          colStrings.push(cell ? cell.text : '');
        }

        const typed = typeColumnCells(colStrings, options.detectTypes);
        typedColumns.push(typed);
      }

      const tableStartRow = startRow;
      const tableEndRow = startRow + table.rows - 1;

      for (let r = 0; r < table.rows; r++) {
        const wsRow = ws.getRow(startRow + r);
        const isHeaderRow = table.hasHeader && r < (table.headerRows || 1);

        for (let c = 0; c < table.cols; c++) {
          const cell = table.grid[r]?.[c];
          if (!cell) continue;

          if (cell.row !== r || cell.col !== c) {
            continue;
          }

          const wsCell = wsRow.getCell(c + 1);
          totalCellsWritten++;

          let cellValue: any;
          let numFmt: string | undefined;

          if (isHeaderRow) {
            cellValue = sanitizeFormulaInjection(cell.text);
          } else {
            const dataRowIdx = r - (table.hasHeader ? 1 : 0);
            const typed = typedColumns[c]?.[dataRowIdx];

            if (typed) {
              if (typed.warning) warnings.push(typed.warning);

              if (typed.type === 'number') {
                cellValue = typed.value;
                numFmt = typed.numFmt;
              } else if (typed.type === 'date') {
                cellValue = typed.value;
                numFmt = typed.numFmt || 'dd/mm/yyyy';
              } else {
                cellValue = sanitizeFormulaInjection(String(typed.value));
              }
            } else {
              cellValue = sanitizeFormulaInjection(cell.text);
            }
          }

          wsCell.value = cellValue;
          if (numFmt) {
            wsCell.numFmt = numFmt;
          }

          const textLen = String(cell.text || '').split('\n').reduce((max, line) => Math.max(max, line.length), 0);
          const measuredPts = cell.x1 - cell.x0;
          const approxColWidth = Math.max(textLen + 2, measuredPts / 5.5);
          const currentColWidth = colMaxWidths.get(c + 1) || 0;
          colMaxWidths.set(c + 1, Math.max(currentColWidth, approxColWidth));

          const isNumeric = typeof cellValue === 'number';
          const alignH = isNumeric ? 'right' : (cell.align || 'left');
          const hasWrap = (cell.text && cell.text.includes('\n')) || cell.colSpan !== undefined;

          wsCell.alignment = {
            vertical: 'top',
            horizontal: alignH,
            wrapText: hasWrap
          };

          const isBold = isHeaderRow || cell.bold;
          wsCell.font = {
            name: 'Calibri',
            size: isHeaderRow ? 11 : 10.5,
            bold: isBold,
            italic: cell.italic
          };

          if (isHeaderRow) {
            wsCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' }
            };
            wsCell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          } else if (options.keepFormatting) {
            wsCell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (cell.bgColor) {
              wsCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: toArgb(cell.bgColor) }
              };
            }
          }

          if ((cell.colSpan && cell.colSpan > 1) || (cell.rowSpan && cell.rowSpan > 1)) {
            const cs = cell.colSpan || 1;
            const rs = cell.rowSpan || 1;
            const topRow = startRow + r;
            const leftCol = c + 1;
            const bottomRow = topRow + rs - 1;
            const rightCol = leftCol + cs - 1;

            try {
              ws.mergeCells(topRow, leftCol, bottomRow, rightCol);
            } catch {
              // Ignore merge overlaps if any
            }
          }
        }
      }

      if (table.hasHeader && group.tables.length === 1) {
        ws.views = [{ state: 'frozen', ySplit: table.headerRows || 1 }];
        ws.autoFilter = {
          from: { row: tableStartRow, column: 1 },
          to: { row: tableStartRow, column: table.cols }
        };
      }

      startRow = tableEndRow + 1;
      totalRowsWritten += table.rows;
    }

    for (let c = 1; c <= maxColsInSheet; c++) {
      const w = colMaxWidths.get(c) || 12;
      const clampedWidth = Math.min(60, Math.max(6, Math.round(w * 10) / 10));
      ws.getColumn(c).width = clampedWidth;
    }
  }

  if (
    options.includeText &&
    options.sheetLayout === 'sheet_per_table' &&
    outsideTextByPage &&
    outsideTextByPage.length > 0
  ) {
    const textSheetName = getUniqueSheetName('Text', existingSheetNames);
    const textWs = wb.addWorksheet(textSheetName);

    let textRowIdx = 1;
    for (const item of outsideTextByPage) {
      if (!item.text.trim()) continue;

      const titleRow = textWs.getRow(textRowIdx);
      titleRow.getCell(1).value = `--- Page ${item.page} ---`;
      titleRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F766E' } };
      textRowIdx += 1;

      const lines = item.text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const r = textWs.getRow(textRowIdx);
        r.getCell(1).value = sanitizeFormulaInjection(line.trim());
        r.getCell(1).alignment = { wrapText: true };
        textRowIdx += 1;
      }
      textRowIdx += 1;
    }
    textWs.getColumn(1).width = 80;
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  return {
    buffer,
    workbook: wb,
    sheetCount: wb.worksheets.length,
    tableCount: tables.length,
    rowCount: totalRowsWritten,
    cellCount: totalCellsWritten,
    warnings: Array.from(new Set(warnings))
  };
}
