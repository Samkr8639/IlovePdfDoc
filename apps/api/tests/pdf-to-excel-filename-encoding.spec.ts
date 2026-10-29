import { describe, it, expect } from '@jest/globals';
import ExcelJS from 'exceljs';
import { buildExcelWorkbook } from '../src/services/pdf-to-excel/build';

describe('PDF to Excel: Filename Encoding & Workbook Metadata (Step 7)', () => {
  it('decodes Multer latin1 encoded filenames with UTF-8 characters such as en-dash', () => {
    // UTF-8 en-dash "–" is 0xE2 0x80 0x93. In Latin-1, this is decoded as "â\x80\x93"
    const utf8Filename = 'Impulse Decisions Auction Portal – Developer Brief.pdf';
    const latin1Corrupted = Buffer.from(utf8Filename, 'utf8').toString('latin1');
    expect(latin1Corrupted).not.toBe(utf8Filename);

    const decoded = Buffer.from(latin1Corrupted, 'latin1').toString('utf8');
    expect(decoded).toBe(utf8Filename);
    expect(decoded).toContain('–');
    expect(decoded).not.toContain('â');
  });

  it('sets workbook creator to "PDFTailor" and preserves document title', async () => {
    const title = 'Impulse Decisions Auction Portal – Developer Brief';
    const result = await buildExcelWorkbook([], {
      options: {
        mode: 'no_ocr',
        sheetLayout: 'sheet_per_page',
        multiFileOutput: 'separate_workbooks',
        detectTypes: true,
        keepFormatting: true,
        includeText: true,
        mergeAcrossPages: true
      },
      title,
      originalFilename: `${title}.pdf`
    });

    const wb = result.workbook;
    expect(wb.creator).toBe('PDFTailor');
    expect(wb.title).toBe(title);
    expect(wb.title).toContain('–');
    expect(wb.title).not.toContain('â');
  });
});
