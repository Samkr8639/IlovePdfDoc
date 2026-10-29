import { describe, it, expect } from '@jest/globals';
import ExcelJS from 'exceljs';
import { PdfToExcelOptionsSchema } from '@paperflow/contracts';
import { buildExcelWorkbook, OutsideTextBlock } from '../src/services/pdf-to-excel/build';
import { DetectedTable } from '../src/services/pdf-to-excel/detect';

describe('PDF to Excel: Include Text Outside Tables & Sheet-per-page (Step 2)', () => {
  it('has defaults sheetLayout="sheet_per_page" and includeText=true in options schema', () => {
    const defaultOptions = PdfToExcelOptionsSchema.parse({});
    expect(defaultOptions.sheetLayout).toBe('sheet_per_page');
    expect(defaultOptions.includeText).toBe(true);
  });

  it('emits headings and paragraphs as merged full-width cells in reading order', async () => {
    const mockTable: DetectedTable = {
      id: 'table_1',
      page: 1,
      bbox: { x0: 50, y0: 200, x1: 500, y1: 350 },
      rows: 2,
      cols: 3,
      cells: [
        { row: 0, col: 0, x0: 50, y0: 200, x1: 200, y1: 250, text: 'Col A' },
        { row: 0, col: 1, x0: 200, y0: 200, x1: 350, y1: 250, text: 'Col B' },
        { row: 0, col: 2, x0: 350, y0: 200, x1: 500, y1: 250, text: 'Col C' },
        { row: 1, col: 0, x0: 50, y0: 250, x1: 200, y1: 350, text: 'Val 1' },
        { row: 1, col: 1, x0: 200, y0: 250, x1: 350, y1: 350, text: 'Val 2' },
        { row: 1, col: 2, x0: 350, y0: 250, x1: 500, y1: 350, text: 'Val 3' }
      ],
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 200, x1: 200, y1: 250, text: 'Col A' },
          { row: 0, col: 1, x0: 200, y0: 200, x1: 350, y1: 250, text: 'Col B' },
          { row: 0, col: 2, x0: 350, y0: 200, x1: 500, y1: 250, text: 'Col C' }
        ],
        [
          { row: 1, col: 0, x0: 50, y0: 250, x1: 200, y1: 350, text: 'Val 1' },
          { row: 1, col: 1, x0: 200, y0: 250, x1: 350, y1: 350, text: 'Val 2' },
          { row: 1, col: 2, x0: 350, y0: 250, x1: 500, y1: 350, text: 'Val 3' }
        ]
      ],
      method: 'lattice',
      confidence: 1,
      headerRows: 1,
      hasHeader: true
    };

    const outsideBlocks: OutsideTextBlock[] = [
      {
        page: 1,
        y0: 50,
        text: 'Document Title Heading',
        fs: 16,
        bold: true,
        isHeading: true
      },
      {
        page: 1,
        y0: 100,
        text: 'This is an overview paragraph explaining the table below.',
        fs: 11,
        bold: false,
        isHeading: false
      },
      {
        page: 1,
        y0: 400,
        text: 'Note below table.',
        fs: 10,
        bold: false,
        isHeading: false
      }
    ];

    const result = await buildExcelWorkbook([mockTable], {
      options: {
        mode: 'no_ocr',
        sheetLayout: 'sheet_per_page',
        multiFileOutput: 'separate_workbooks',
        detectTypes: true,
        keepFormatting: true,
        includeText: true,
        mergeAcrossPages: true
      },
      outsideBlocks
    });

    const wb = result.workbook;
    const ws = wb.worksheets[0];
    expect(ws).toBeDefined();

    // Row 1: Heading
    const r1 = ws.getRow(1);
    expect(r1.getCell(1).value).toBe('Document Title Heading');
    expect(r1.getCell(1).font?.bold).toBe(true);
    expect(r1.getCell(1).font?.size).toBeGreaterThanOrEqual(13);

    // Row 2: Paragraph
    const r2 = ws.getRow(2);
    expect(r2.getCell(1).value).toBe('This is an overview paragraph explaining the table below.');

    // Table starts at Row 3
    const r3 = ws.getRow(3);
    expect(r3.getCell(1).value).toBe('Col A');
    expect(r3.getCell(2).value).toBe('Col B');
    expect(r3.getCell(3).value).toBe('Col C');

    // Row 4: Table Data
    const r4 = ws.getRow(4);
    expect(r4.getCell(1).value).toBe('Val 1');

    // Row 5: Note below table
    const r5 = ws.getRow(5);
    expect(r5.getCell(1).value).toBe('Note below table.');
  });
});
