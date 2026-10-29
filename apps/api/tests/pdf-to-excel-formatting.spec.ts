import { buildExcelWorkbook } from '../src/services/pdf-to-excel/build';
import { DetectedTable } from '../src/services/pdf-to-excel/detect';
import { PdfToExcelOptions } from '@paperflow/contracts';

describe('PDF to Excel: Formatting, Row Heights and AutoFilter', () => {
  const baseOptions: PdfToExcelOptions = {
    mode: 'no_ocr',
    sheetLayout: 'sheet_per_table',
    multiFileOutput: 'one_workbook',
    detectTypes: false,
    keepFormatting: true,
    mergeAcrossPages: true,
    includeText: false
  };

  test('sets explicit row heights for rows with wrapped/multiline cells', async () => {
    const tableWithWrap: DetectedTable = {
      id: 't-wrap',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 500, y1: 300 },
      rows: 2,
      cols: 2,
      hasHeader: true,
      headerRows: 1,
      method: 'lattice',
      confidence: 1,
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 100, x1: 275, y1: 130, text: 'Header 1' },
          { row: 0, col: 1, x0: 275, y0: 100, x1: 500, y1: 130, text: 'Header 2' }
        ],
        [
          {
            row: 1,
            col: 0,
            x0: 50,
            y0: 130,
            x1: 275,
            y1: 220,
            text: 'First line of long text\nSecond line of long text\nThird line of long text\nFourth line of long text'
          },
          { row: 1, col: 1, x0: 275, y0: 130, x1: 500, y1: 220, text: 'Short text' }
        ]
      ],
      cells: []
    };

    const res = await buildExcelWorkbook([tableWithWrap], { options: baseOptions, title: 'Test Doc' });
    const ws = res.workbook.worksheets[0];

    const headerRow = ws.getRow(1);
    const multiLineRow = ws.getRow(2);

    expect(headerRow.height).toBeDefined();
    expect(multiLineRow.height).toBeDefined();
    // 4 lines should result in height >= 4 * 15 = 60
    expect(multiLineRow.height).toBeGreaterThanOrEqual(60);
  });

  test('preserves source font and background fill when keepFormatting is true', async () => {
    const tableWithStyles: DetectedTable = {
      id: 't-styles',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 500, y1: 200 },
      rows: 2,
      cols: 2,
      hasHeader: true,
      headerRows: 1,
      method: 'lattice',
      confidence: 1,
      grid: [
        [
          {
            row: 0,
            col: 0,
            x0: 50,
            y0: 100,
            x1: 275,
            y1: 130,
            text: 'Header Col',
            bgColor: '#F5F2EC',
            fontName: 'Century Gothic'
          },
          {
            row: 0,
            col: 1,
            x0: 275,
            y0: 100,
            x1: 500,
            y1: 130,
            text: 'Header Col 2',
            bgColor: '#F5F2EC',
            fontName: 'Century Gothic'
          }
        ],
        [
          {
            row: 1,
            col: 0,
            x0: 50,
            y0: 130,
            x1: 275,
            y1: 160,
            text: 'Data 1',
            fontName: 'Times New Roman'
          },
          {
            row: 1,
            col: 1,
            x0: 275,
            y0: 130,
            x1: 500,
            y1: 160,
            text: 'Data 2',
            bgColor: '#E2E8F0'
          }
        ]
      ],
      cells: []
    };

    const res = await buildExcelWorkbook([tableWithStyles], {
      options: { ...baseOptions, keepFormatting: true },
      title: 'Test Doc'
    });
    const ws = res.workbook.worksheets[0];

    const hCell = ws.getCell('A1');
    const dCell1 = ws.getCell('A2');
    const dCell2 = ws.getCell('B2');

    // Header should preserve font and header fill
    expect(hCell.font?.name).toBe('Century Gothic');
    expect(hCell.fill).toBeDefined();
    const hFill = hCell.fill as any;
    expect(hFill.fgColor?.argb).toBe('FFF5F2EC');

    // Data cell 1 should preserve font
    expect(dCell1.font?.name).toBe('Times New Roman');

    // Data cell 2 should preserve background fill
    expect(dCell2.fill).toBeDefined();
    const dFill = dCell2.fill as any;
    expect(dFill.fgColor?.argb).toBe('FFE2E8F0');
  });

  test('falls back to Calibri and omits custom fills when keepFormatting is false', async () => {
    const tableWithStyles: DetectedTable = {
      id: 't-styles-off',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 500, y1: 200 },
      rows: 2,
      cols: 2,
      hasHeader: true,
      headerRows: 1,
      method: 'lattice',
      confidence: 1,
      grid: [
        [
          {
            row: 0,
            col: 0,
            x0: 50,
            y0: 100,
            x1: 275,
            y1: 130,
            text: 'Header Col',
            bgColor: '#F5F2EC',
            fontName: 'Century Gothic'
          },
          { row: 0, col: 1, x0: 275, y0: 100, x1: 500, y1: 130, text: 'Header Col 2' }
        ],
        [
          {
            row: 1,
            col: 0,
            x0: 50,
            y0: 130,
            x1: 275,
            y1: 160,
            text: 'Data 1',
            fontName: 'Times New Roman'
          },
          {
            row: 1,
            col: 1,
            x0: 275,
            y0: 130,
            x1: 500,
            y1: 160,
            text: 'Data 2',
            bgColor: '#E2E8F0'
          }
        ]
      ],
      cells: []
    };

    const res = await buildExcelWorkbook([tableWithStyles], {
      options: { ...baseOptions, keepFormatting: false },
      title: 'Test Doc'
    });
    const ws = res.workbook.worksheets[0];

    const hCell = ws.getCell('A1');
    const dCell1 = ws.getCell('A2');
    const dCell2 = ws.getCell('B2');

    expect(hCell.font?.name).toBe('Calibri');
    expect(dCell1.font?.name).toBe('Calibri');
    // Data cell 2 custom fill should not be applied when keepFormatting is false
    expect(dCell2.fill).toBeUndefined();
  });

  test('sets freeze pane and autofilter ONLY when table has header', async () => {
    const tableWithHeader: DetectedTable = {
      id: 't-hdr',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 500, y1: 200 },
      rows: 2,
      cols: 2,
      hasHeader: true,
      headerRows: 1,
      method: 'lattice',
      confidence: 1,
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 100, x1: 275, y1: 130, text: 'H1' },
          { row: 0, col: 1, x0: 275, y0: 100, x1: 500, y1: 130, text: 'H2' }
        ],
        [
          { row: 1, col: 0, x0: 50, y0: 130, x1: 275, y1: 160, text: 'D1' },
          { row: 1, col: 1, x0: 275, y0: 130, x1: 500, y1: 160, text: 'D2' }
        ]
      ],
      cells: []
    };

    const tableWithoutHeader: DetectedTable = {
      id: 't-nohdr',
      page: 1,
      bbox: { x0: 50, y0: 100, x1: 500, y1: 200 },
      rows: 2,
      cols: 2,
      hasHeader: false,
      headerRows: 0,
      method: 'stream',
      confidence: 0.8,
      grid: [
        [
          { row: 0, col: 0, x0: 50, y0: 100, x1: 275, y1: 130, text: 'D1' },
          { row: 0, col: 1, x0: 275, y0: 100, x1: 500, y1: 130, text: 'D2' }
        ],
        [
          { row: 1, col: 0, x0: 50, y0: 130, x1: 275, y1: 160, text: 'D3' },
          { row: 1, col: 1, x0: 275, y0: 130, x1: 500, y1: 160, text: 'D4' }
        ]
      ],
      cells: []
    };

    const resWithHdr = await buildExcelWorkbook([tableWithHeader], { options: baseOptions, title: 'With Hdr' });
    const wsWithHdr = resWithHdr.workbook.worksheets[0];
    expect(wsWithHdr.autoFilter).toBeDefined();
    expect(wsWithHdr.views).toBeDefined();
    expect((wsWithHdr.views as any[])[0]?.state).toBe('frozen');

    const resNoHdr = await buildExcelWorkbook([tableWithoutHeader], { options: baseOptions, title: 'No Hdr' });
    const wsNoHdr = resNoHdr.workbook.worksheets[0];
    expect(wsNoHdr.autoFilter).toBeFalsy();
    expect(wsNoHdr.views).toEqual([]);
  });
});
