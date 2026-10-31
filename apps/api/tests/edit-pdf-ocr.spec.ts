import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { createApp } from '../src/app';
import {
  validateOcrPdf,
  OCR_MAX_PAGES,
  ocrJobStore
} from '../src/routes/edit-pdf-ocr.route';
import { detectSkewAngle } from '../src/services/ocr/edit-pdf-ocr.engine';

describe('Edit PDF OCR - Engine & Route Tests', () => {
  const app = createApp();

  describe('validateOcrPdf Unit Tests', () => {
    it('throws ZERO_BYTE_FILE for empty buffer', async () => {
      await expect(validateOcrPdf(Buffer.alloc(0), 'empty.pdf')).rejects.toMatchObject({
        statusCode: 400,
        code: 'ZERO_BYTE_FILE'
      });
    });

    it('throws UNSUPPORTED_FILE for non-PDF file lacking %PDF- header', async () => {
      const invalidBuffer = Buffer.from('hello world not a pdf');
      await expect(validateOcrPdf(invalidBuffer, 'fake.pdf')).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE'
      });
    });

    it('validates a valid minimal PDF and returns page count', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 400]);
      const pdfBytes = await pdfDoc.save();
      const count = await validateOcrPdf(Buffer.from(pdfBytes), 'valid.pdf');
      expect(count).toBe(1);
    });

    it('throws TOO_MANY_PAGES if PDF exceeds OCR_MAX_PAGES', async () => {
      const pdfDoc = await PDFDocument.create();
      for (let i = 0; i < OCR_MAX_PAGES + 1; i++) {
        pdfDoc.addPage([100, 100]);
      }
      const pdfBytes = await pdfDoc.save();
      await expect(
        validateOcrPdf(Buffer.from(pdfBytes), 'large.pdf')
      ).rejects.toMatchObject({
        statusCode: 413,
        code: 'TOO_MANY_PAGES'
      });
    });
  });

  describe('detectSkewAngle Unit Tests', () => {
    it('returns angle 0 for a blank or clean image buffer', async () => {
      const sharp = (await import('sharp')).default;
      const blankImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .png()
        .toBuffer();

      const res = await detectSkewAngle(blankImage);
      expect(res.angle).toBe(0);
      expect(res.deskewedBuffer).toBeDefined();
    });
  });

  describe('API Routes: /api/v1/edit-pdf/ocr', () => {
    it('GET /languages returns list of supported languages', async () => {
      const res = await request(app).get('/api/v1/edit-pdf/ocr/languages');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const eng = res.body.data.find((l: any) => l.code === 'eng');
      expect(eng).toBeDefined();
      expect(eng.name).toBe('English');
    });

    it('POST / rejects request when no file is uploaded', async () => {
      const res = await request(app).post('/api/v1/edit-pdf/ocr');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FILES_UPLOADED');
    });

    it('POST / rejects non-PDF file upload with 415 UNSUPPORTED_FILE', async () => {
      const res = await request(app)
        .post('/api/v1/edit-pdf/ocr')
        .attach('file', Buffer.from('not-a-pdf-content'), 'test.txt');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
    });

    it('POST / rejects invalid options payload with 400 INVALID_OPTIONS', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([200, 200]);
      const pdfBytes = await pdfDoc.save();

      const res = await request(app)
        .post('/api/v1/edit-pdf/ocr')
        .field('options', 'invalid-json')
        .attach('file', Buffer.from(pdfBytes), 'doc.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OPTIONS');
    });

    it('POST / rejects unsupported language with 400 UNSUPPORTED_LANGUAGE', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([200, 200]);
      const pdfBytes = await pdfDoc.save();

      const res = await request(app)
        .post('/api/v1/edit-pdf/ocr')
        .field('options', JSON.stringify({ languages: ['xyz'] }))
        .attach('file', Buffer.from(pdfBytes), 'doc.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNSUPPORTED_LANGUAGE');
    });

    it('GET /jobs/:id returns 404 for unknown job', async () => {
      const res = await request(app).get('/api/v1/edit-pdf/ocr/jobs/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('DELETE /jobs/:id returns 404 for unknown job', async () => {
      const res = await request(app).delete('/api/v1/edit-pdf/ocr/jobs/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('GET /jobs/:id/result returns 404 for unknown job', async () => {
      const res = await request(app).get(
        '/api/v1/edit-pdf/ocr/jobs/non-existent-id/result'
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });
});
