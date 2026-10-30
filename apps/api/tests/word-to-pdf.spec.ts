/**
 * Word to PDF — API Route Tests
 *
 * Tests that do NOT require LibreOffice (route-level unit tests) always run.
 * Tests marked with `requiresLibreOffice` are skipped with an explicit message
 * when LibreOffice is not installed.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';

// ──────────────────────────────────────────────────────────────
// Helper: check if LibreOffice is available
// ──────────────────────────────────────────────────────────────

let _sofficePath: string | null = null;

async function getSofficePath(): Promise<string | null> {
  if (_sofficePath !== undefined) return _sofficePath;
  const candidates = [
    process.env['SOFFICE_PATH'],
    'soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  ].filter(Boolean) as string[];

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'], { timeout: 8000 });
      _sofficePath = candidate;
      return candidate;
    } catch {
      // continue
    }
  }
  _sofficePath = null;
  return null;
}

// ──────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function makeMinimalDocx(): Buffer {
  // A minimal OOXML docx (ZIP) with "Hello World" content
  // We use a real tiny fixture if available, otherwise skip with LibreOffice tests
  const fixturePath = path.join(FIXTURES_DIR, 'minimal.docx');
  if (fs.existsSync(fixturePath)) {
    return fs.readFileSync(fixturePath);
  }
  // Fallback: create a zero-content buffer to test validation
  return Buffer.from([]);
}

function makeRtfBuffer(): Buffer {
  return Buffer.from('{\\rtf1\\ansi Hello World!}');
}

function makeInvalidBuffer(): Buffer {
  return Buffer.from('This is not a Word document at all.');
}

// ──────────────────────────────────────────────────────────────
// Route-level tests (no LibreOffice required)
// ──────────────────────────────────────────────────────────────

describe('Word to PDF API — route-level tests (no LibreOffice required)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  test('POST /api/v1/word-to-pdf/convert → 400 when no files uploaded', async () => {
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/NO_FILES_UPLOADED/);
  });

  test('POST /api/v1/word-to-pdf/convert → 415 for unsupported file type', async () => {
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', Buffer.from('hello'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/UNSUPPORTED_FILE_TYPE/);
  });

  test('POST /api/v1/word-to-pdf/convert → 400 for zero-byte file', async () => {
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', Buffer.from(''), { filename: 'empty.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/ZERO_BYTE_FILE/);
  });

  test('POST /api/v1/word-to-pdf/convert → 415 for fake .docx (not a ZIP)', async () => {
    const fakeDocx = Buffer.from('definitely not a zip archive at all');
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', fakeDocx, { filename: 'fake.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/INVALID_FILE_CONTENT/);
  });

  test('POST /api/v1/word-to-pdf/convert → 415 for fake .doc (not OLE2)', async () => {
    const fakeDoc = Buffer.from('this is not an OLE2 file');
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', fakeDoc, { filename: 'fake.doc', contentType: 'application/msword' })
      .expect(415);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/INVALID_FILE_CONTENT/);
  });

  test('GET /api/v1/word-to-pdf/jobs/unknown-id/download → 404', async () => {
    const res = await request(app)
      .get('/api/v1/word-to-pdf/jobs/unknown-job-id-12345/download')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/DOWNLOAD_EXPIRED/);
  });

  test('DELETE /api/v1/word-to-pdf/jobs/unknown-id → 404', async () => {
    const res = await request(app)
      .delete('/api/v1/word-to-pdf/jobs/unknown-job-id-12345')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toMatch(/JOB_NOT_FOUND/);
  });

  test('RTF file with valid magic passes validation', async () => {
    const rtf = makeRtfBuffer();
    // This will fail at ENGINE_UNAVAILABLE or CONVERSION_FAILED, not at validation
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', rtf, { filename: 'test.rtf', contentType: 'application/rtf' });

    // 415 = validation failed (wrong); 503 = engine unavailable (expected without LibreOffice); 422 = conversion failed
    expect([415, 503, 422]).toContain(res.status);
    if (res.status === 415) {
      fail('RTF file should not be rejected by type validation — only by engine availability');
    }
  });
});

// ──────────────────────────────────────────────────────────────
// LibreOffice-dependent tests
// ──────────────────────────────────────────────────────────────

describe('Word to PDF API — LibreOffice integration tests', () => {
  let app: Express;
  let sofficePath: string | null = null;

  beforeAll(async () => {
    app = createApp();
    sofficePath = await getSofficePath();

    if (!sofficePath) {
      console.warn(
        '\n⚠️  SKIPPING LibreOffice integration tests — soffice binary not found.\n' +
        '   Install LibreOffice and set SOFFICE_PATH to run these tests.\n'
      );
    }
  });

  const shouldSkip = () => {
    if (!sofficePath) {
      console.log('Skipping test: LibreOffice not installed on host machine');
      return true;
    }
    return false;
  };

  test('converts a valid .docx to PDF successfully', async () => {
    if (shouldSkip()) return;

    const fixturePath = path.join(FIXTURES_DIR, 'minimal.docx');
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const docxBuffer = fs.readFileSync(fixturePath);
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', docxBuffer, {
        filename: 'minimal.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.files).toHaveLength(1);
    expect(res.body.data.files[0].pdfFilename).toBe('minimal.pdf');
    expect(res.body.data.files[0].pdfSizeBytes).toBeGreaterThan(100);
    expect(res.body.data.isZip).toBe(false);
    expect(res.body.data.zipDownloadUrl).toBeUndefined();
  });

  test('converted PDF can be downloaded', async () => {
    if (shouldSkip()) return;

    const fixturePath = path.join(FIXTURES_DIR, 'minimal.docx');
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const docxBuffer = fs.readFileSync(fixturePath);
    const convertRes = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', docxBuffer, {
        filename: 'minimal.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      .expect(200);

    const jobId = convertRes.body.data.id;
    const downloadRes = await request(app)
      .get(`/api/v1/word-to-pdf/jobs/${jobId}/download`)
      .expect(200);

    expect(downloadRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(downloadRes.body.length ?? downloadRes.text.length).toBeGreaterThan(0);
  });

  test('multiple files produce a ZIP', async () => {
    if (shouldSkip()) return;

    const fixturePath = path.join(FIXTURES_DIR, 'minimal.docx');
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const docxBuffer = fs.readFileSync(fixturePath);
    const res = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', docxBuffer, { filename: 'first.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .attach('files', docxBuffer, { filename: 'second.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .expect(200);

    expect(res.body.data.isZip).toBe(true);
    expect(res.body.data.zipDownloadUrl).toBeDefined();
    expect(res.body.data.files).toHaveLength(2);

    // Download the ZIP
    const jobId = res.body.data.id;
    const zipRes = await request(app)
      .get(`/api/v1/word-to-pdf/jobs/${jobId}/download`)
      .expect(200);

    expect(zipRes.headers['content-type']).toMatch(/application\/zip/);
  });

  test('job deleted after download (explicit DELETE)', async () => {
    if (shouldSkip()) return;

    const fixturePath = path.join(FIXTURES_DIR, 'minimal.docx');
    if (!fs.existsSync(fixturePath)) {
      return;
    }

    const docxBuffer = fs.readFileSync(fixturePath);
    const convertRes = await request(app)
      .post('/api/v1/word-to-pdf/convert')
      .attach('files', docxBuffer, { filename: 'minimal.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .expect(200);

    const jobId = convertRes.body.data.id;

    await request(app).delete(`/api/v1/word-to-pdf/jobs/${jobId}`).expect(200);

    // Second download should 404
    await request(app)
      .get(`/api/v1/word-to-pdf/jobs/${jobId}/download`)
      .expect(404);
  });
});

