import request from 'supertest';
import { createApp } from '../src/app';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('PDF to PowerPoint API Endpoints', () => {
  const app = createApp();

  async function createSamplePdf(pageCount = 2, content = 'Quarterly Strategy Review'): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle('Strategy Presentation');
    doc.setAuthor('Antigravity Engineer');
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([720, 540]);
      page.drawText(`${content} - Slide ${i + 1}`, { x: 50, y: 480, size: 24, color: rgb(0.1, 0.1, 0.1) });
      page.drawText('Key Deliverables:\n• Enterprise Architecture\n• Automated Testing Pipeline', {
        x: 50,
        y: 400,
        size: 14,
        color: rgb(0.2, 0.2, 0.2)
      });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('rejects request with no files provided (400 NO_FILES_UPLOADED)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_FILES_UPLOADED');
  });

  it('rejects non-PDF files renamed with .pdf extension (400 INVALID_PDF_HEADER)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .attach('files', Buffer.from('Plain text fake pdf content'), 'fake.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PDF_HEADER');
  });

  it('rejects zero-byte PDF file (400 ZERO_BYTE_FILE)', async () => {
    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .attach('files', Buffer.alloc(0), 'empty.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZERO_BYTE_FILE');
  });

  it('rejects corrupted PDF with %PDF- header but invalid structure (422 CORRUPTED_PDF)', async () => {
    const corrupted = Buffer.from('%PDF-1.7\nCorrupted binary payload that cannot be parsed by pdf engines');
    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .attach('files', corrupted, 'corrupt.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CORRUPTED_PDF');
  });

  it('rejects password-protected or encrypted PDF (422 ENCRYPTED_PDF)', async () => {
    const encPath = path.resolve(__dirname, '../../../test-fixtures/encrypted_sample.pdf');
    expect(fs.existsSync(encPath)).toBe(true);
    const encBuf = fs.readFileSync(encPath);

    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .attach('files', encBuf, 'encrypted_sample.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ENCRYPTED_PDF');
    expect(res.body.error.message).toContain('password-protected or encrypted');
  });

  it('rejects upload with more than 10 files (400 TOO_MANY_FILES)', async () => {
    const pdfBuf = await createSamplePdf(1, 'Slide');
    const req = request(app).post('/api/v1/pdf-to-powerpoint/convert');

    // Attach 11 files (exceeding limit of 10)
    for (let i = 1; i <= 11; i++) {
      req.attach('files', pdfBuf, `deck_${i}.pdf`);
    }

    const res = await req.expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_FILES');
  });

  it('rejects file larger than 50MB (413 FILE_TOO_LARGE)', async () => {
    // 51 MB buffer starting with %PDF-
    const oversizedBuf = Buffer.alloc(51 * 1024 * 1024);
    oversizedBuf.write('%PDF-1.4\n');

    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .attach('files', oversizedBuf, 'giant.pdf')
      .expect(413);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects OCR mode when premium flag/auth is missing (403 PREMIUM_REQUIRED)', async () => {
    const prevOcr = process.env.OCR_ENABLED;
    try {
      process.env.OCR_ENABLED = 'false';

      const pdfBuf = await createSamplePdf(1, 'OCR Scan');
      const res = await request(app)
        .post('/api/v1/pdf-to-powerpoint/convert')
        .field('mode', 'ocr')
        .attach('files', pdfBuf, 'scanned.pdf')
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PREMIUM_REQUIRED');
      expect(res.body.error.message).toContain('Premium');
    } finally {
      process.env.OCR_ENABLED = prevOcr;
    }
  });

  it('enforces rate limiting on conversion endpoint (429 RATE_LIMIT_EXCEEDED)', async () => {
    // First request uses the 1 allowed attempt in test mode
    await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .set('x-test-rate-limit', 'trigger');

    // Second request exceeds threshold and returns 429
    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .set('x-test-rate-limit', 'trigger')
      .expect(429);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('successfully converts single PDF to PPTX, allows download, and DELETES job on download', async () => {
    const pdfBuf = await createSamplePdf(2, 'Enterprise Roadmap');

    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .field('mode', 'no_ocr')
      .field('slideSize', 'match_pdf')
      .attach('files', pdfBuf, 'roadmap.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.mode).toBe('no_ocr');
    expect(res.body.data.slideSize).toBe('match_pdf');
    expect(res.body.data.totalFiles).toBe(1);
    expect(res.body.data.files[0].originalFilename).toBe('roadmap.pdf');
    expect(res.body.data.files[0].pptxFilename).toBe('roadmap.pptx');
    expect(res.body.data.files[0].slideCount).toBe(2);
    expect(res.body.data.files[0].pptxSizeBytes).toBeGreaterThan(1000);

    const jobId = res.body.data.id;

    // Verify GET /jobs/:jobId before download
    const statusRes = await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}`)
      .expect(200);

    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.data.id).toBe(jobId);

    // Verify first GET /jobs/:jobId/download streams PPTX and deletes job
    const downloadRes = await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(downloadRes.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(downloadRes.headers['content-disposition']).toContain('roadmap.pptx');

    const pptxBuf = Buffer.from(downloadRes.body);
    expect(pptxBuf.length).toBeGreaterThan(1000);
    expect(pptxBuf[0]).toBe(0x50); // 'P'
    expect(pptxBuf[1]).toBe(0x4b); // 'K'

    // Ephemeral retention: second download MUST return 404
    const secondDownloadRes = await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}/download`)
      .expect(404);

    expect(secondDownloadRes.body.success).toBe(false);
    expect(secondDownloadRes.body.error.code).toBe('DOWNLOAD_EXPIRED');

    // Status check after deletion MUST return 404
    await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}`)
      .expect(404);
  });

  it('supports multi-file batch conversion with zip bundle download', async () => {
    const pdf1 = await createSamplePdf(1, 'Deck Alpha');
    const pdf2 = await createSamplePdf(1, 'Deck Beta');

    const res = await request(app)
      .post('/api/v1/pdf-to-powerpoint/convert')
      .field('mode', 'no_ocr')
      .field('slideSize', 'widescreen_16_9')
      .attach('files', pdf1, 'alpha.pdf')
      .attach('files', pdf2, 'beta.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalFiles).toBe(2);
    expect(res.body.data.isZip).toBe(true);

    const jobId = res.body.data.id;

    // Verify batch download returns zip and deletes job
    const zipRes = await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}/download`)
      .responseType('blob')
      .expect(200);

    expect(zipRes.headers['content-type']).toContain('application/zip');
    const zipBuf = Buffer.from(zipRes.body);
    expect(zipBuf.length).toBeGreaterThan(500);
    expect(zipBuf[0]).toBe(0x50);
    expect(zipBuf[1]).toBe(0x4b);

    // Job deleted on download
    await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${jobId}`)
      .expect(404);
  });

  it('returns 404 for unknown job ID', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/v1/pdf-to-powerpoint/jobs/${unknownId}`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });
});
