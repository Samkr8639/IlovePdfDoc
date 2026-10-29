import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { analyzePdf } from '../src/services/pdf-layout';
import { detectTablesOnPage, mergeCrossPageTables } from '../src/services/pdf-to-excel/detect';

describe('PDF to Excel: Table Detection Boundaries & No Empty Columns (Steps 3 & 5)', () => {
  const fixturePdfPath = path.resolve(__dirname, 'fixtures/dev-brief/source.pdf');
  let pdfBuffer: Buffer;

  beforeAll(() => {
    pdfBuffer = fs.readFileSync(fixturePdfPath);
  });

  it('detects Payments table with shaded header row and 4 data rows on Page 5', async () => {
    const layout = await analyzePdf(pdfBuffer);
    const p5 = layout.pages[4]; // Page 5
    const tables = detectTablesOnPage(p5, 5);

    expect(tables.length).toBeGreaterThanOrEqual(1);
    const paymentsTable = tables.find(t =>
      t.grid[0]?.some(c => c?.text.toLowerCase().includes('method') || c?.text.toLowerCase().includes('stripe product'))
    );

    expect(paymentsTable).toBeDefined();
    expect(paymentsTable!.cols).toBe(3);
    // Header + 4 data rows = 5 rows total
    expect(paymentsTable!.rows).toBe(5);

    // Header cells
    expect(paymentsTable!.grid[0][0]?.text).toContain('Method');
    expect(paymentsTable!.grid[0][1]?.text).toContain('How it works');
    expect(paymentsTable!.grid[0][2]?.text).toContain('Stripe product');

    // Data row 1
    expect(paymentsTable!.grid[1][0]?.text).toContain("Customer's phone");
    // Data row 2
    expect(paymentsTable!.grid[2][0]?.text).toContain('Card reader');
    // Data row 3
    expect(paymentsTable!.grid[3][0]?.text).toContain('Pay later');
    // Data row 4
    expect(paymentsTable!.grid[4][0]?.text).toContain('Cash, bank transfer');
  });

  it('detects and merges Data table across pages into ONE table with 7 rows and no empty cells', async () => {
    const layout = await analyzePdf(pdfBuffer);
    const pageTables: { pageNumber: number; tables: any[] }[] = [];

    for (let p = 1; p <= layout.pages.length; p++) {
      const page = layout.pages[p - 1];
      const tables = detectTablesOnPage(page, p);
      pageTables.push({ pageNumber: p, tables });
    }

    const merged = mergeCrossPageTables(pageTables, true);
    const dataTable = merged.find(t =>
      t.grid[0]?.some(c => c?.text.toLowerCase().includes('record') || c?.text.toLowerCase().includes('key fields'))
    );

    expect(dataTable).toBeDefined();
    expect(dataTable!.cols).toBe(2);
    // Header "Record | Key fields" + 7 rows = 8 rows total
    expect(dataTable!.rows).toBe(8);

    // Header
    expect(dataTable!.grid[0][0]?.text).toContain('Record');
    expect(dataTable!.grid[0][1]?.text).toContain('Key fields');

    // The 7 required rows
    const expectedRecords = [
      'Event',
      'Staff member',
      'Promissory note',
      'Note version',
      'Retracted lot',
      'Settings',
      'Audit entry'
    ];

    for (let r = 1; r <= 7; r++) {
      const recordCell = dataTable!.grid[r][0]?.text || '';
      const keyFieldsCell = dataTable!.grid[r][1]?.text || '';
      expect(recordCell).toContain(expectedRecords[r - 1]);
      // NO EMPTY CELLS in key fields!
      expect(keyFieldsCell.trim().length).toBeGreaterThan(0);
    }
  });

  it('never outputs a table that has an entirely empty column (Step 5)', () => {
    // If a column is 100% empty across all rows, it should be rejected
    const { hasEntirelyEmptyColumn } = require('../src/services/pdf-to-excel/detect');
    const tableWithEmptyCol = [
      [{ text: 'Header 1' }, { text: '' }],
      [{ text: 'Val 1' }, { text: '' }],
      [{ text: 'Val 2' }, { text: '' }]
    ];
    expect(hasEntirelyEmptyColumn(tableWithEmptyCol)).toBe(true);

    const validTable = [
      [{ text: 'Header 1' }, { text: 'Header 2' }],
      [{ text: 'Val 1' }, { text: 'Val 2' }]
    ];
    expect(hasEntirelyEmptyColumn(validTable)).toBe(false);
  });
});
