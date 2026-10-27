import request from 'supertest';
import { createApp } from '../src/app';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PDF to Word API Endpoints', () => {
  const app = createApp();

  async function createSamplePdf(pageCount = 2, content = 'Sample Invoice Content'): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle('Test Document');
    doc.setAuthor('Antigravity Engineer');
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([600, 800]);
      page.drawText(`${content} - Page ${i + 1}`, { x: 50, y: 700, size: 20, color: rgb(0, 0, 0) });
      page.drawText('INVOICE DETAILS:\n• Item 1: Web Development\n• Item 2: Cloud Storage', {
        x: 50,
        y: 650,
        size: 14,
        color: rgb(0.2, 0.2, 0.2)
      });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('rejects request with no files provided', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_FILES_UPLOADED');
  });

  it('rejects non-PDF files', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .attach('files', Buffer.from('Plain text file content'), 'document.txt')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects files with .pdf extension but invalid header', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .attach('files', Buffer.from('Not a real PDF'), 'fake.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PDF_HEADER');
  });

  it('rejects zero-byte PDF file', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .attach('files', Buffer.alloc(0), 'empty.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZERO_BYTE_FILE');
  });

  it('rejects corrupted PDF with %PDF- header but invalid structure', async () => {
    const corrupted = Buffer.from('%PDF-1.4\nJunk binary corrupted payload');
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .attach('files', corrupted, 'corrupt.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CORRUPTED_PDF');
  });

  it('rejects password-protected or encrypted PDF with HTTP 422 PASSWORD_PROTECTED', async () => {
    const encBuf = fs.readFileSync(path.resolve(__dirname, '../../../test-fixtures/encrypted_sample.pdf'));
    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .attach('files', encBuf, 'encrypted_sample.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PASSWORD_PROTECTED');
    expect(res.body.error.message).toContain('password-protected or encrypted');
  });

  it('successfully converts a digital PDF to a genuine DOCX document', async () => {
    const pdfBuf = await createSamplePdf(2, 'Project Statement of Work');

    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .field('mode', 'no_ocr')
      .attach('files', pdfBuf, 'contract.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.mode).toBe('no_ocr');
    expect(res.body.data.totalFiles).toBe(1);
    expect(res.body.data.files[0].originalFilename).toBe('contract.pdf');
    expect(res.body.data.files[0].wordFilename).toBe('contract.docx');
    expect(res.body.data.files[0].pageCount).toBe(2);
    expect(res.body.data.files[0].wordSizeBytes).toBeGreaterThan(1000);

    const jobId = res.body.data.id;

    // Verify GET /jobs/:jobId
    const statusRes = await request(app)
      .get(`/api/v1/pdf-to-word/jobs/${jobId}`)
      .expect(200);

    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.data.id).toBe(jobId);

    // Verify GET /jobs/:jobId/download streams genuine DOCX
    const downloadRes = await request(app)
      .get(`/api/v1/pdf-to-word/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(downloadRes.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(downloadRes.headers['content-disposition']).toContain('contract.docx');
    
    // Check DOCX buffer length and PK signature
    const docxBuf = Buffer.from(downloadRes.body);
    expect(docxBuf.length).toBeGreaterThan(1000);
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    // Verify DELETE /jobs/:jobId
    const delRes = await request(app)
      .delete(`/api/v1/pdf-to-word/jobs/${jobId}`)
      .expect(200);

    expect(delRes.body.success).toBe(true);
    expect(delRes.body.data.deleted).toBe(true);
  });

  it('supports multi-file batch conversion with zip bundle download', async () => {
    const pdf1 = await createSamplePdf(1, 'Document One');
    const pdf2 = await createSamplePdf(1, 'Document Two');

    const res = await request(app)
      .post('/api/v1/pdf-to-word/convert')
      .field('mode', 'no_ocr')
      .attach('files', pdf1, 'doc1.pdf')
      .attach('files', pdf2, 'doc2.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalFiles).toBe(2);
    expect(res.body.data.isZip).toBe(true);

    const jobId = res.body.data.id;

    // Verify batch download returns zip
    const zipRes = await request(app)
      .get(`/api/v1/pdf-to-word/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(zipRes.headers['content-type']).toContain('application/zip');
    const zipBuf = Buffer.from(zipRes.body);
    expect(zipBuf.length).toBeGreaterThan(100);
    expect(zipBuf[0]).toBe(0x50);
    expect(zipBuf[1]).toBe(0x4b);
  });
});
