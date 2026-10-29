import ExcelJS from 'exceljs';
import {
  buildExcelWorkbook,
  sanitizeSheetName,
  getUniqueSheetName,
  sanitizeFormulaInjection
} from '../src/services/pdf-to-excel/build';
import { DetectedTable } from '../src/services/pdf-to-excel/detect';
import { PdfToExcelOptions } from '@paperflow/contracts';

describe('Excel Workbook Builder (build.ts)', () => {
  const defaultOptions: PdfToExcelOptions = {
    mode: 'no_ocr',
    sheetLayout: 'sheet_per_table',
    multiFileOutput: 'separate_workbooks',
    detectTypes: true,
    keepFormatting: true,
    includeText: false,
    mergeAcrossPages: true
  };

  describe('Sanitization & Helpers', () => {
    it('sanitizes forbidden sheet name characters and truncates to 31 chars', () => {
      const sanitized = sanitizeSheetName('Quarterly Report [Q1] * 2024 / Draft ? <Final>');
      expect(sanitized).not.toContain('[');
      expect(sanitized).not.toContain(']');
      expect(sanitized).not.toContain('*');
      expect(sanitized).not.toContain('?');
      expect(sanitized).not.toContain('/');
      expect(sanitized.length).toBeLessThanOrEqual(31);
    });

    it('generates unique sheet names with numeric suffixes', () => {
      const existing = new Set<string>();
      const name1 = getUniqueSheetName('Invoices', existing);
      const name2 = getUniqueSheetName('Invoices', existing);
      const name3 = getUniqueSheetName('Invoices', existing);

      expect(name1).toBe('Invoices');
      expect(name2).toBe('Invoices (2)');
      expect(name3).toBe('Invoices (3)');
    });

    it('prevents formula injection by prefixing dangerous characters with single quote', () => {
      expect(sanitizeFormulaInjection('=HYPERLINK("http://evil.com","x")')).toBe('\'=HYPERLINK("http://evil.com","x")');
      expect(sanitizeFormulaInjection('=cmd|\' /C calc\'!A0')).toBe('\'=cmd|\' /C calc\'!A0');
      expect(sanitizeFormulaInjection('+12345')).toBe('\'+12345');
      expect(sanitizeFormulaInjection('-50')).toBe('\'-50');
      expect(sanitizeFormulaInjection('@SUM(A1:A5)')).toBe('\'@SUM(A1:A5)');
      expect(sanitizeFormulaInjection('\tTabbed')).toBe('\'\tTabbed');
      expect(sanitizeFormulaInjection('Normal Text')).toBe('Normal Text');
    });
  });

  describe('buildExcelWorkbook', () => {
    it('creates a valid Excel workbook with typed cells, number formats, and merged cells', async () => {
      const table: DetectedTable = {
        id: 'table_1',
        page: 1,
        bbox: { x0: 50, y0: 100, x1: 350, y1: 250 },
        rows: 4,
        cols: 3,
        hasHeader: true,
        headerRows: 1,
        method: 'lattice',
        confidence: 0.95,
        title: 'Sales Summary',
        cells: [],
        grid: [
          // Row 0: Merged header across cols 0 and 1
          [
            { row: 0, col: 0, colSpan: 2, x0: 50, y0: 100, x1: 250, y1: 130, text: 'Product Info', isHeader: true },
            { row: 0, col: 0, colSpan: 2, x0: 50, y0: 100, x1: 250, y1: 130, text: 'Product Info', isHeader: true },
            { row: 0, col: 2, x0: 250, y0: 100, x1: 350, y1: 130, text: 'Revenue', isHeader: true }
          ],
          // Row 1: Item 1
          [
            { row: 1, col: 0, x0: 50, y0: 130, x1: 150, y1: 160, text: 'Item A' },
            { row: 1, col: 1, x0: 150, y0: 130, x1: 250, y1: 160, text: '15/01/2024' },
            { row: 1, col: 2, x0: 250, y0: 130, x1: 350, y1: 160, text: '$1,200.50' }
          ],
          // Row 2: Item 2
          [
            { row: 2, col: 0, x0: 50, y0: 160, x1: 150, y1: 190, text: 'Item B' },
            { row: 2, col: 1, x0: 150, y0: 160, x1: 250, y1: 190, text: '16/01/2024' },
            { row: 2, col: 2, x0: 250, y0: 160, x1: 350, y1: 190, text: '$800.50' }
          ],
          // Row 3: Formula injection test string in cell
          [
            { row: 3, col: 0, x0: 50, y0: 190, x1: 150, y1: 220, text: '=HYPERLINK("http://evil","click")' },
            { row: 3, col: 1, x0: 150, y0: 190, x1: 250, y1: 220, text: '17/01/2024' },
            { row: 3, col: 2, x0: 250, y0: 190, x1: 350, y1: 220, text: '$500.00' }
          ]
        ]
      };

      const result = await buildExcelWorkbook([table], {
        options: defaultOptions,
        title: 'Test Report'
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.sheetCount).toBe(1);
      expect(result.tableCount).toBe(1);

      // Verify the generated file using ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(result.buffer as any);

      const ws = wb.getWorksheet('Sales Summary');
      expect(ws).toBeDefined();

      // 1. Verify merged header
      const headerCell = ws!.getCell('A1');
      expect(headerCell.value).toBe('Product Info');
      expect(headerCell.font?.bold).toBe(true);

      // 2. Verify number typing & SUM verification
      const rev1 = ws!.getCell('C2').value;
      const rev2 = ws!.getCell('C3').value;
      const rev3 = ws!.getCell('C4').value;
      expect(typeof rev1).toBe('number');
      expect(typeof rev2).toBe('number');
      expect(typeof rev3).toBe('number');
      expect(rev1).toBe(1200.5);
      expect(rev2).toBe(800.5);
      expect(rev3).toBe(500);

      // Verify mathematical SUM equals expected 2501
      const total = (rev1 as number) + (rev2 as number) + (rev3 as number);
      expect(total).toBe(2501);

      // 3. Verify date typing
      const dateCell = ws!.getCell('B2').value;
      expect(dateCell).toBeInstanceOf(Date);

      // 4. Verify formula injection prevention: formula is string with single-quote prefix
      const injectionCell = ws!.getCell('A4').value;
      expect(typeof injectionCell).toBe('string');
      expect(injectionCell).toBe('\'=HYPERLINK("http://evil","click")');

      // 5. Verify freeze pane and autoFilter
      expect(ws!.views?.[0]?.state).toBe('frozen');
      expect(ws!.autoFilter).toBeDefined();
    });

    it('throws TOO_LARGE 413 when cell count exceeds limits', async () => {
      const hugeTable: DetectedTable = {
        id: 'huge',
        page: 1,
        bbox: { x0: 0, y0: 0, x1: 100, y1: 100 },
        rows: 20000,
        cols: 150,
        cells: [],
        grid: [],
        method: 'lattice',
        confidence: 0.9,
        headerRows: 1,
        hasHeader: true
      };

      await expect(
        buildExcelWorkbook([hugeTable], { options: defaultOptions })
      ).rejects.toMatchObject({
        code: 'TOO_LARGE',
        statusCode: 413
      });
    });
  });
});
