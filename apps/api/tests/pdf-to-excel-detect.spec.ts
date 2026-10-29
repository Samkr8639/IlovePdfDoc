import {
  detectLatticeTables,
  detectStreamTables,
  detectTablesOnPage,
  mergeCrossPageTables,
  DetectedTable
} from '../src/services/pdf-to-excel/detect';
import { LayoutPage } from '../src/services/pdf-layout';

describe('Table Detector (detect.ts)', () => {
  it('detects a ruled (lattice) table with exact rows, columns, and cell text', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [
        { x: 50, y: 100, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 130, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 160, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 190, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 150, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 250, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 350, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 }
      ],
      boxes: [],
      images: [],
      segments: [
        { x: 60, y: 115, x0: 60, x1: 90, yb: 115, width: 30, right: 90, fs: 10, text: 'Item', runs: [{ text: 'Item', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 10 }] },
        { x: 160, y: 115, x0: 160, x1: 190, yb: 115, width: 30, right: 190, fs: 10, text: 'Qty', runs: [{ text: 'Qty', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 10 }] },
        { x: 260, y: 115, x0: 260, x1: 290, yb: 115, width: 30, right: 290, fs: 10, text: 'Price', runs: [{ text: 'Price', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 10 }] },
        { x: 60, y: 145, x0: 60, x1: 110, yb: 145, width: 50, right: 110, fs: 10, text: 'Apples', runs: [{ text: 'Apples', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 160, y: 145, x0: 160, x1: 175, yb: 145, width: 15, right: 175, fs: 10, text: '5', runs: [{ text: '5', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 260, y: 145, x0: 260, x1: 285, yb: 145, width: 25, right: 285, fs: 10, text: '$10.00', runs: [{ text: '$10.00', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 60, y: 175, x0: 60, x1: 120, yb: 175, width: 60, right: 120, fs: 10, text: 'Oranges', runs: [{ text: 'Oranges', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 160, y: 175, x0: 160, x1: 175, yb: 175, width: 15, right: 175, fs: 10, text: '2', runs: [{ text: '2', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 260, y: 175, x0: 260, x1: 280, yb: 175, width: 20, right: 280, fs: 10, text: '$4.50', runs: [{ text: '$4.50', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] }
      ]
    };

    const tables = detectLatticeTables(page, 1);
    expect(tables.length).toBe(1);
    const table = tables[0];
    expect(table.rows).toBe(3);
    expect(table.cols).toBe(3);
    expect(table.method).toBe('lattice');
    expect(table.hasHeader).toBe(true);

    expect(table.grid[0][0]?.text).toBe('Item');
    expect(table.grid[0][1]?.text).toBe('Qty');
    expect(table.grid[0][2]?.text).toBe('Price');
    expect(table.grid[1][0]?.text).toBe('Apples');
    expect(table.grid[1][1]?.text).toBe('5');
    expect(table.grid[1][2]?.text).toBe('$10.00');
    expect(table.grid[2][0]?.text).toBe('Oranges');
  });

  it('detects merged headers (colspan) and merged rows (rowspan)', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [
        { x: 50, y: 100, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 130, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 160, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 190, w: 300, h: 1, vertical: false, color: '#000000', style: 'solid', thickness: 1 },
        { x: 50, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 350, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 150, y: 130, w: 1, h: 60, vertical: true, color: '#000000', style: 'solid', thickness: 1 },
        { x: 250, y: 100, w: 1, h: 90, vertical: true, color: '#000000', style: 'solid', thickness: 1 }
      ],
      boxes: [],
      images: [],
      segments: [
        { x: 100, y: 115, x0: 100, x1: 190, yb: 115, width: 90, right: 190, fs: 10, text: 'Product Details', runs: [{ text: 'Product Details', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 10 }] },
        { x: 260, y: 115, x0: 260, x1: 290, yb: 115, width: 30, right: 290, fs: 10, text: 'Total', runs: [{ text: 'Total', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 10 }] }
      ]
    };

    const tables = detectLatticeTables(page, 1);
    expect(tables.length).toBe(1);
    const table = tables[0];
    expect(table.cols).toBe(3);
    expect(table.grid[0][0]?.colSpan).toBe(2);
    expect(table.grid[0][0]?.text).toBe('Product Details');
  });

  it('detects borderless (stream) tables with column alignment and right-aligned numbers', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [],
      boxes: [],
      images: [],
      segments: [
        { x: 60, y: 100, x0: 60, x1: 120, yb: 100, width: 60, right: 120, fs: 11, text: 'Description', runs: [{ text: 'Description', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 11 }] },
        { x: 200, y: 100, x0: 200, x1: 225, yb: 100, width: 25, right: 225, fs: 11, text: 'Qty', runs: [{ text: 'Qty', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 11 }] },
        { x: 300, y: 100, x0: 300, x1: 340, yb: 100, width: 40, right: 340, fs: 11, text: 'Amount', runs: [{ text: 'Amount', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: true, italic: false, color: '#000', fs: 11 }] },
        { x: 60, y: 120, x0: 60, x1: 130, yb: 120, width: 70, right: 130, fs: 10, text: 'Web Hosting', runs: [{ text: 'Web Hosting', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 200, y: 120, x0: 200, x1: 210, yb: 120, width: 10, right: 210, fs: 10, text: '1', runs: [{ text: '1', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 295, y: 120, x0: 295, x1: 340, yb: 120, width: 45, right: 340, fs: 10, text: '150.00', runs: [{ text: '150.00', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 60, y: 140, x0: 60, x1: 145, yb: 140, width: 85, right: 145, fs: 10, text: 'Domain Registration', runs: [{ text: 'Domain Registration', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 200, y: 140, x0: 200, x1: 210, yb: 140, width: 10, right: 210, fs: 10, text: '2', runs: [{ text: '2', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 302, y: 140, x0: 302, x1: 340, yb: 140, width: 38, right: 340, fs: 10, text: '30.00', runs: [{ text: '30.00', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 60, y: 160, x0: 60, x1: 115, yb: 160, width: 55, right: 115, fs: 10, text: 'SSL Certificate', runs: [{ text: 'SSL Certificate', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 200, y: 160, x0: 200, x1: 210, yb: 160, width: 10, right: 210, fs: 10, text: '1', runs: [{ text: '1', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] },
        { x: 302, y: 160, x0: 302, x1: 340, yb: 160, width: 38, right: 340, fs: 10, text: '45.00', runs: [{ text: '45.00', font: 'Arial', rawFont: 'Arial', generic: 'sans', bold: false, italic: false, color: '#000', fs: 10 }] }
      ]
    };

    const tables = detectStreamTables(page, 1);
    expect(tables.length).toBe(1);
    const table = tables[0];
    expect(table.rows).toBe(4);
    expect(table.cols).toBe(3);
    expect(table.method).toBe('stream');
    expect(table.hasHeader).toBe(true);
    expect(table.grid[1][0]?.text).toBe('Web Hosting');
    expect(table.grid[1][2]?.text).toBe('150.00');
  });

  it('detects two tables on one page', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [
        // Table 1 (Y: 50 - 110)
        { x: 50, y: 50, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 80, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 110, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 50, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 150, y: 50, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 250, y: 50, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },

        // Table 2 (Y: 200 - 260)
        { x: 50, y: 200, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 230, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 260, w: 200, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 50, y: 200, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 150, y: 200, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 250, y: 200, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 }
      ],
      boxes: [],
      images: [],
      segments: [
        { x: 60, y: 65, x0: 60, x1: 90, yb: 65, width: 30, right: 90, fs: 10, text: 'T1_A', runs: [] },
        { x: 160, y: 65, x0: 160, x1: 190, yb: 65, width: 30, right: 190, fs: 10, text: 'T1_B', runs: [] },
        { x: 60, y: 95, x0: 60, x1: 90, yb: 95, width: 30, right: 90, fs: 10, text: 'T1_C', runs: [] },
        { x: 160, y: 95, x0: 160, x1: 190, yb: 95, width: 30, right: 190, fs: 10, text: 'T1_D', runs: [] },

        { x: 60, y: 215, x0: 60, x1: 90, yb: 215, width: 30, right: 90, fs: 10, text: 'T2_A', runs: [] },
        { x: 160, y: 215, x0: 160, x1: 190, yb: 215, width: 30, right: 190, fs: 10, text: 'T2_B', runs: [] },
        { x: 60, y: 245, x0: 60, x1: 90, yb: 245, width: 30, right: 90, fs: 10, text: 'T2_C', runs: [] },
        { x: 160, y: 245, x0: 160, x1: 190, yb: 245, width: 30, right: 190, fs: 10, text: 'T2_D', runs: [] }
      ]
    };

    const tables = detectTablesOnPage(page, 1);
    expect(tables.length).toBe(2);
  });

  it('detects side-by-side tables separated by a horizontal gap', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [
        // Left Table: X: 40 - 180, Y: 100 - 160
        { x: 40, y: 100, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 40, y: 130, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 40, y: 160, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 40, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 110, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 180, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },

        // Right Table: X: 260 - 400, Y: 100 - 160 (gap of 80 pt)
        { x: 260, y: 100, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 260, y: 130, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 260, y: 160, w: 140, h: 1, vertical: false, color: '#000', style: 'solid', thickness: 1 },
        { x: 260, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 330, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 },
        { x: 400, y: 100, w: 1, h: 60, vertical: true, color: '#000', style: 'solid', thickness: 1 }
      ],
      boxes: [],
      images: [],
      segments: [
        { x: 50, y: 115, x0: 50, x1: 90, yb: 115, width: 40, right: 90, fs: 10, text: 'L1', runs: [] },
        { x: 120, y: 115, x0: 120, x1: 160, yb: 115, width: 40, right: 160, fs: 10, text: 'L2', runs: [] },
        { x: 50, y: 145, x0: 50, x1: 90, yb: 145, width: 40, right: 90, fs: 10, text: 'L3', runs: [] },
        { x: 120, y: 145, x0: 120, x1: 160, yb: 145, width: 40, right: 160, fs: 10, text: 'L4', runs: [] },

        { x: 270, y: 115, x0: 270, x1: 310, yb: 115, width: 40, right: 310, fs: 10, text: 'R1', runs: [] },
        { x: 340, y: 115, x0: 340, x1: 380, yb: 115, width: 40, right: 380, fs: 10, text: 'R2', runs: [] },
        { x: 270, y: 145, x0: 270, x1: 310, yb: 145, width: 40, right: 310, fs: 10, text: 'R3', runs: [] },
        { x: 340, y: 145, x0: 340, x1: 380, yb: 145, width: 40, right: 380, fs: 10, text: 'R4', runs: [] }
      ]
    };

    const tables = detectTablesOnPage(page, 1);
    expect(tables.length).toBe(2);
  });

  it('does NOT turn regular paragraphs of text into a table', () => {
    const page: LayoutPage = {
      width: 595,
      height: 842,
      blocks: [],
      lines: [],
      boxes: [],
      images: [],
      segments: [
        { x: 50, y: 100, x0: 50, x1: 450, yb: 100, width: 400, right: 450, fs: 12, text: 'This is the first sentence of an ordinary paragraph describing terms.', runs: [] },
        { x: 50, y: 116, x0: 50, x1: 430, yb: 116, width: 380, right: 430, fs: 12, text: 'It continues onto the next line without any tabular structure at all.', runs: [] },
        { x: 50, y: 132, x0: 50, x1: 400, yb: 132, width: 350, right: 400, fs: 12, text: 'And concludes on the third line nicely and cleanly.', runs: [] }
      ]
    };

    const tables = detectTablesOnPage(page, 1);
    expect(tables.length).toBe(0);
  });

  it('merges repeated headers across pages into a single continuous table', () => {
    const tablePage1: DetectedTable = {
      id: 'table_p1_1',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 350, y1: 800 },
      rows: 3,
      cols: 3,
      colWidths: [100, 100, 100],
      method: 'lattice',
      confidence: 0.9,
      headerRows: 1,
      hasHeader: true,
      cells: [],
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 100, x1: 150, y1: 120, text: 'Name', isHeader: true },
          { row: 0, col: 1, x0: 150, y0: 100, x1: 250, y1: 120, text: 'Role', isHeader: true },
          { row: 0, col: 2, x0: 250, y0: 100, x1: 350, y1: 120, text: 'Salary', isHeader: true }
        ],
        [
          { row: 1, col: 0, x0: 50, y0: 120, x1: 150, y1: 140, text: 'Alice' },
          { row: 1, col: 1, x0: 150, y0: 120, x1: 250, y1: 140, text: 'Engineer' },
          { row: 1, col: 2, x0: 250, y0: 120, x1: 350, y1: 140, text: '100k' }
        ],
        [
          { row: 2, col: 0, x0: 50, y0: 140, x1: 150, y1: 160, text: 'Bob' },
          { row: 2, col: 1, x0: 150, y0: 140, x1: 250, y1: 160, text: 'Designer' },
          { row: 2, col: 2, x0: 250, y0: 140, x1: 350, y1: 160, text: '90k' }
        ]
      ]
    };

    const tablePage2: DetectedTable = {
      id: 'table_p2_1',
      page: 2,
      bbox: { x0: 50, y0: 50, x1: 350, y1: 300 },
      rows: 2,
      cols: 3,
      colWidths: [100, 100, 100],
      method: 'lattice',
      confidence: 0.9,
      headerRows: 1,
      hasHeader: true,
      cells: [],
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 50, x1: 150, y1: 70, text: 'Name', isHeader: true },
          { row: 0, col: 1, x0: 150, y0: 50, x1: 250, y1: 70, text: 'Role', isHeader: true },
          { row: 0, col: 2, x0: 250, y0: 50, x1: 350, y1: 70, text: 'Salary', isHeader: true }
        ],
        [
          { row: 1, col: 0, x0: 50, y0: 70, x1: 150, y1: 90, text: 'Charlie' },
          { row: 1, col: 1, x0: 150, y0: 70, x1: 250, y1: 90, text: 'Manager' },
          { row: 1, col: 2, x0: 250, y0: 70, x1: 350, y1: 90, text: '120k' }
        ]
      ]
    };

    const merged = mergeCrossPageTables(
      [
        { pageNumber: 1, tables: [tablePage1] },
        { pageNumber: 2, tables: [tablePage2] }
      ],
      true
    );

    expect(merged.length).toBe(1);
    expect(merged[0].rows).toBe(4);
    expect(merged[0].grid[3][0]?.text).toBe('Charlie');
  });
});
