import request from 'supertest';
import { createApp } from '../src/app';
import { PDFDocument, rgb } from 'pdf-lib';

describe('POST /api/v1/compress', () => {
  const app = createApp();

  async function createSamplePdf(pageCount = 2, title = 'Sample Title'): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setAuthor('Test Author');
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([400, 600]);
      page.drawText(`Sample Page ${i + 1}`, { x: 50, y: 500, size: 24, color: rgb(0, 0, 0) });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('rejects request with no files provided', async () => {
    const res = await request(app)
      .post('/api/v1/compress')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_FILES_PROVIDED');
  });

  it('rejects non-PDF files', async () => {
    const res = await request(app)
      .post('/api/v1/compress')
      .attach('files', Buffer.from('Hello world plain text'), 'sample.txt')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects files with .pdf extension but invalid header', async () => {
    const res = await request(app)
      .post('/api/v1/compress')
      .attach('files', Buffer.from('Not a real PDF contents'), 'fake.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PDF_HEADER');
  });

  it('rejects zero-byte PDF file', async () => {
    const res = await request(app)
      .post('/api/v1/compress')
      .attach('files', Buffer.alloc(0), 'empty.pdf')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ZERO_BYTE_FILE');
  });

  it('rejects corrupted PDF', async () => {
    // Starts with %PDF- but is corrupted
    const corrupted = Buffer.from('%PDF-1.4\nCorrupted binary junk content trailing');
    const res = await request(app)
      .post('/api/v1/compress')
      .attach('files', corrupted, 'corrupt.pdf')
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CORRUPTED_PDF');
  });

  it('successfully compresses a single PDF with recommended level', async () => {
    const pdfBuf = await createSamplePdf(3, 'Recommended Test');

    const res = await request(app)
      .post('/api/v1/compress')
      .field('level', 'recommended')
      .attach('files', pdfBuf, 'document.pdf')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.level).toBe('recommended');
    expect(res.body.data.filesCount).toBe(1);
    expect(res.body.data.totalOriginalSize).toBe(pdfBuf.length);
    expect(res.body.data.totalCompressedSize).toBeGreaterThan(0);
    expect(res.body.data.files[0].originalFilename).toBe('document.pdf');
    expect(res.body.data.files[0].compressedFilename).toBe('document_compressed.pdf');

    const jobId = res.body.data.jobId;

    // Check GET job status
    const jobRes = await request(app)
      .get(`/api/v1/compress/jobs/${jobId}`)
      .expect(200);
    expect(jobRes.body.data.jobId).toBe(jobId);

    // Check GET download single file
    const dlRes = await request(app)
      .get(`/api/v1/compress/jobs/${jobId}/download`)
      .expect(200);
    expect(dlRes.headers['content-type']).toBe('application/pdf');
    expect(dlRes.body.length).toBeGreaterThan(0);

    // Verify downloaded buffer is a readable PDF
    const downloadedDoc = await PDFDocument.load(dlRes.body);
    expect(downloadedDoc.getPageCount()).toBe(3);

    // Check DELETE job
    await request(app)
      .delete(`/api/v1/compress/jobs/${jobId}`)
      .expect(200);

    // Verify it's gone
    await request(app)
      .get(`/api/v1/compress/jobs/${jobId}`)
      .expect(404);
  });

  it('compresses with extreme level and strips metadata', async () => {
    const pdfBuf = await createSamplePdf(2, 'Extreme Test Title');

    const res = await request(app)
      .post('/api/v1/compress')
      .field('level', 'extreme')
      .attach('files', pdfBuf, 'extreme_doc.pdf')
      .expect(200);

    expect(res.body.data.level).toBe('extreme');
    const dlRes = await request(app)
      .get(`/api/v1/compress/jobs/${res.body.data.jobId}/download`)
      .expect(200);

    const doc = await PDFDocument.load(dlRes.body);
    expect(doc.getTitle()).toBeFalsy();
  });

  it('compresses with less compression level', async () => {
    const pdfBuf = await createSamplePdf(2, 'Less Test');

    const res = await request(app)
      .post('/api/v1/compress')
      .field('level', 'less')
      .attach('files', pdfBuf, 'less_doc.pdf')
      .expect(200);

    expect(res.body.data.level).toBe('less');
  });

  it('handles multiple files and packages them into a downloadable ZIP', async () => {
    const pdf1 = await createSamplePdf(1, 'Doc 1');
    const pdf2 = await createSamplePdf(2, 'Doc 2');

    const res = await request(app)
      .post('/api/v1/compress')
      .field('level', 'recommended')
      .attach('files', pdf1, 'first.pdf')
      .attach('files', pdf2, 'second.pdf')
      .expect(200);

    expect(res.body.data.filesCount).toBe(2);
    expect(res.body.data.files.length).toBe(2);
    const jobId = res.body.data.jobId;

    // Download ZIP
    const zipRes = await request(app)
      .get(`/api/v1/compress/jobs/${jobId}/download`)
      .buffer()
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(zipRes.headers['content-type']).toBe('application/zip');
    expect(Number(zipRes.headers['content-length'])).toBeGreaterThan(0);
    expect(zipRes.body.length).toBeGreaterThan(0);

    // Download individual file
    const file1Id = res.body.data.files[0].id;
    const singleRes = await request(app)
      .get(`/api/v1/compress/jobs/${jobId}/download/${file1Id}`)
      .buffer()
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      })
      .expect(200);
    expect(singleRes.headers['content-type']).toBe('application/pdf');
    const singleDoc = await PDFDocument.load(singleRes.body);
    expect(singleDoc.getPageCount()).toBe(1);
  });
});
