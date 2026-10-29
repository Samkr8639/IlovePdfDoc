import request from 'supertest';
import { createApp } from '../src/app';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PDF to Excel API Endpoints', () => {
  const app = createApp();

  async function createTablePdf(pageCount = 1): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle('Financial Report');
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([600, 400]);
      // Header
      page.drawText('Product', { x: 60, y: 275, size: 12, color: rgb(0, 0, 0) });
      page.drawText('Quantity', { x: 210, y: 275, size: 12, color: rgb(0, 0, 0) });
      page.drawText('Price', { x: 360, y: 275, size: 12, color: rgb(0, 0, 0) });

      // Row 1
      page.drawText('Widget A', { x: 60, y: 235, size: 12, color: rgb(0, 0, 0) });
      page.drawText('10', { x: 210, y: 235, size: 12, color: rgb(0, 0, 0) });
      page.drawText('100.50', { x: 360, y: 235, size: 12, color: rgb(0, 0, 0) });

      // Row 2
      page.drawText('Widget B', { x: 60, y: 195, size: 12, color: rgb(0, 0, 0) });
      page.drawText('20', { x: 210, y: 195, size: 12, color: rgb(0, 0, 0) });
      page.drawText('250.00', { x: 360, y: 195, size: 12, color: rgb(0, 0, 0) });

      // Grid Ruling Lines
      page.drawLine({ start: { x: 50, y: 300 }, end: { x: 500, y: 300 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 50, y: 260 }, end: { x: 500, y: 260 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 50, y: 220 }, end: { x: 500, y: 220 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 50, y: 180 }, end: { x: 500, y: 180 }, thickness: 1, color: rgb(0, 0, 0) });

      page.drawLine({ start: { x: 50, y: 180 }, end: { x: 50, y: 300 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 200, y: 180 }, end: { x: 200, y: 300 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 350, y: 180 }, end: { x: 350, y: 300 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: 500, y: 180 }, end: { x: 500, y: 300 }, thickness: 1, color: rgb(0, 0, 0) });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  async function createBlankPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage([600, 400]);
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('rejects request with no files provided (400 NO_FILES_UPLOADED)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_FILES_UPLOADED');
  });

  it('rejects non-PDF files renamed with .pdf extension (400 INVALID_PDF_HEADER)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', Buffer.from('Plain text fake pdf file'), 'fake.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PDF_HEADER');
  });

  it('rejects zero-byte PDF file (400 ZERO_BYTE_FILE)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', Buffer.alloc(0), 'empty.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZERO_BYTE_FILE');
  });

  it('rejects corrupted PDF with %PDF- header but invalid structure (422 CORRUPTED_PDF)', async () => {
    const corrupted = Buffer.from('%PDF-1.7\nCorrupted structure');
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', corrupted, 'corrupt.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CORRUPTED_PDF');
  });

  it('rejects password-protected or encrypted PDF (422 ENCRYPTED_PDF)', async () => {
    const encPath = path.resolve(__dirname, '../../../test-fixtures/encrypted_sample.pdf');
    if (fs.existsSync(encPath)) {
      const encBuf = fs.readFileSync(encPath);
      const res = await request(app)
        .post('/api/v1/pdf-to-excel/convert')
        .attach('files', encBuf, 'encrypted_sample.pdf')
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ENCRYPTED_PDF');
    }
  });

  it('rejects upload with more than 10 files (400 TOO_MANY_FILES)', async () => {
    const pdfBuf = await createTablePdf(1);
    const req = request(app).post('/api/v1/pdf-to-excel/convert');

    for (let i = 1; i <= 11; i++) {
      req.attach('files', pdfBuf, `table_${i}.pdf`);
    }

    const res = await req.expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_FILES');
  });

  it('rejects file larger than 50MB (413 FILE_TOO_LARGE)', async () => {
    const oversizedBuf = Buffer.alloc(51 * 1024 * 1024);
    oversizedBuf.write('%PDF-1.4\n');

    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', oversizedBuf, 'giant.pdf')
      .expect(413);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects OCR mode when premium flag/auth is missing (403 PREMIUM_REQUIRED)', async () => {
    const prevOcr = process.env.OCR_ENABLED;
    try {
      process.env.OCR_ENABLED = 'false';
      const pdfBuf = await createTablePdf(1);

      const res = await request(app)
        .post('/api/v1/pdf-to-excel/convert')
        .field('mode', 'ocr')
        .attach('files', pdfBuf, 'scanned.pdf')
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PREMIUM_REQUIRED');
    } finally {
      process.env.OCR_ENABLED = prevOcr;
    }
  });

  it('rejects invalid page range (400 INVALID_PAGE_RANGE)', async () => {
    const pdfBuf = await createTablePdf(1);
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .field('pages', '5-10')
      .attach('files', pdfBuf, 'sample.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PAGE_RANGE');
  });

  it('rejects completely blank document with 422 NO_TABLES_FOUND', async () => {
    const blankPdf = await createBlankPdf();
    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', blankPdf, 'blank.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_TABLES_FOUND');
    expect(res.body.error.message).toContain('OCR');
  });

  it('successfully converts single PDF with table to XLSX and deletes on download', async () => {
    const pdfBuf = await createTablePdf(1);

    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .field('mode', 'no_ocr')
      .field('sheetLayout', 'sheet_per_table')
      .field('detectTypes', 'true')
      .field('keepFormatting', 'true')
      .attach('files', pdfBuf, 'invoice.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isZip).toBe(false);
    expect(res.body.data.filename).toBe('invoice.xlsx');
    expect(res.body.data.sizeBytes).toBeGreaterThan(1000);
    expect(res.body.data.files).toHaveLength(1);
    expect(res.body.data.files[0].tables).toBeGreaterThanOrEqual(1);
    expect(res.body.data.tables.length).toBeGreaterThanOrEqual(1);

    const jobId = res.body.data.jobId;

    // Verify GET /jobs/:jobId
    const statusRes = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}`)
      .expect(200);

    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.data.jobId).toBe(jobId);

    // Download XLSX stream and verify deletion
    const downloadRes = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(downloadRes.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(downloadRes.headers['content-disposition']).toContain('invoice.xlsx');

    const xlsxBuf = Buffer.from(downloadRes.body);
    expect(xlsxBuf.length).toBeGreaterThan(1000);
    expect(xlsxBuf[0]).toBe(0x50); // 'P'
    expect(xlsxBuf[1]).toBe(0x4b); // 'K'

    // Ephemeral deletion check
    const secondDownloadRes = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}/download`)
      .expect(404);

    expect(secondDownloadRes.body.success).toBe(false);
    expect(secondDownloadRes.body.error.code).toBe('DOWNLOAD_EXPIRED');
  });

  it('supports multi-file separate workbooks with zip bundle download', async () => {
    const pdf1 = await createTablePdf(1);
    const pdf2 = await createTablePdf(1);

    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .field('multiFileOutput', 'separate_workbooks')
      .attach('files', pdf1, 'report_jan.pdf')
      .attach('files', pdf2, 'report_feb.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isZip).toBe(true);
    expect(res.body.data.filename).toBe('converted_excel_workbooks.zip');
    expect(res.body.data.files).toHaveLength(2);

    const jobId = res.body.data.jobId;

    const zipRes = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(zipRes.headers['content-type']).toContain('application/zip');
    const zipBuf = Buffer.from(zipRes.body);
    expect(zipBuf.length).toBeGreaterThan(500);
    expect(zipBuf[0]).toBe(0x50);
    expect(zipBuf[1]).toBe(0x4b);
  });

  it('supports multi-file consolidated into one workbook', async () => {
    const pdf1 = await createTablePdf(1);
    const pdf2 = await createTablePdf(1);

    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .field('multiFileOutput', 'one_workbook')
      .attach('files', pdf1, 'batch_a.pdf')
      .attach('files', pdf2, 'batch_b.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isZip).toBe(false);
    expect(res.body.data.filename).toContain('batch_a_combined.xlsx');

    const jobId = res.body.data.jobId;
    const downloadRes = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(downloadRes.headers['content-type']).toContain('spreadsheetml.sheet');
  });

  it('returns 404 for unknown job ID', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${unknownId}`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('supports DELETE /jobs/:jobId to discard early', async () => {
    const pdfBuf = await createTablePdf(1);

    const res = await request(app)
      .post('/api/v1/pdf-to-excel/convert')
      .attach('files', pdfBuf, 'delete_me.pdf')
      .expect(200);

    const jobId = res.body.data.jobId;

    const delRes = await request(app)
      .delete(`/api/v1/pdf-to-excel/jobs/${jobId}`)
      .expect(200);

    expect(delRes.body.success).toBe(true);
    expect(delRes.body.data.deleted).toBe(true);

    await request(app)
      .get(`/api/v1/pdf-to-excel/jobs/${jobId}`)
      .expect(404);
  });
});
