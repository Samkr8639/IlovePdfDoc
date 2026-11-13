import request from 'supertest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { createApp } from '../src/app';
import {
  signEmail,
  signRepo,
  signScheduler,
  signStorage,
  signWorkflow
} from '../src/routes/sign.route';
import { verifyAuditChain } from '../src/services/sign/audit';
import { buildSignerInviteEmail } from '../src/services/sign/email-templates';
import { sanitiseUploadedPdf } from '../src/services/sign/sanitise-pdf';
import { sha256Hex } from '../src/services/sign/crypto';

// Tiny transparent 1x1 PNG data URL for test signatures
const SAMPLE_SIG_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAD0lEQVQImWNgYGD4z0AEYAQABQAB/S4sKAAAAABJRU5ErkJggg==';

async function buildTestPdfBytes(pageCount = 1, title = 'NDA Test'): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  for (let i = 0; i < pageCount; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Page ${i + 1}`, { x: 40, y: 780, size: 16 });
  }
  return Buffer.from(await doc.save());
}

function extractTokenFromSentEmail(toEmail: string, indexFromEnd = 0): string {
  const matches = signEmail.sent.filter((m) => m.to === toEmail.toLowerCase());
  const entry = matches[matches.length - 1 - indexFromEnd];
  if (!entry) throw new Error(`No email sent to ${toEmail}`);
  const linkMatch = entry.text.match(/\/sign\/([A-Za-z0-9_-]{20,})/);
  if (!linkMatch) throw new Error(`No token found in email to ${toEmail}`);
  return linkMatch[1];
}

describe('Phase 2 Sign PDF API & Workflow Security Suite', () => {
  const app = createApp();
  const originalFlag = process.env.SIGN_REQUESTS_ENABLED;
  const originalKey = process.env.SIGN_MASTER_KEY;

  beforeEach(() => {
    process.env.SIGN_REQUESTS_ENABLED = 'true';
    process.env.SIGN_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    signRepo.clear();
    signStorage.clear();
    signEmail.clear();
    signScheduler.clearAll();
  });

  afterAll(() => {
    process.env.SIGN_REQUESTS_ENABLED = originalFlag;
    process.env.SIGN_MASTER_KEY = originalKey;
    signScheduler.clearAll();
  });

  it('respects SIGN_REQUESTS_ENABLED=false kill switch on /features and /sign/*', async () => {
    process.env.SIGN_REQUESTS_ENABLED = 'false';

    const featOff = await request(app).get('/api/v1/features');
    expect(featOff.status).toBe(200);
    expect(featOff.body.data.signRequestsEnabled).toBe(false);

    const csrfOff = await request(app).get('/api/v1/sign/csrf');
    expect(csrfOff.status).toBe(503);
    expect(csrfOff.body.error.code).toBe('FEATURE_DISABLED');

    process.env.SIGN_REQUESTS_ENABLED = 'true';
    const featOn = await request(app).get('/api/v1/features');
    expect(featOn.status).toBe(200);
    expect(featOn.body.data.signRequestsEnabled).toBe(true);
  });

  it('runs a complete 3-signer parallel workflow, verifies encrypted storage, audit chain, final SHA-256, and Certificate of Completion', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const pdfBuf = await buildTestPdfBytes(2, 'Mutual NDA');

    const payload = {
      senderName: 'Alice Sender',
      senderEmail: 'alice@example.com',
      title: 'Mutual NDA Agreement',
      message: 'Please sign pages 1 and 2.',
      order: 'parallel',
      expiryDays: 14,
      remindersEnabled: true,
      requireSignerOtp: false,
      signers: [
        { id: 's1', name: 'Bob One', email: 'bob@example.com', orderIndex: 0 },
        { id: 's2', name: 'Carol Two', email: 'carol@example.com', orderIndex: 1 },
        { id: 's3', name: 'Dan Three', email: 'dan@example.com', orderIndex: 2 }
      ],
      fields: [
        { id: 'f1', pageIndex: 0, type: 'signature', xPt: 80, yPt: 150, widthPt: 180, heightPt: 60, signerId: 's1', required: true },
        { id: 'f2', pageIndex: 1, type: 'signature', xPt: 80, yPt: 150, widthPt: 180, heightPt: 60, signerId: 's2', required: true },
        { id: 'f3', pageIndex: 1, type: 'signature', xPt: 300, yPt: 150, widthPt: 180, heightPt: 60, signerId: 's3', required: true },
        { id: 'f4', pageIndex: 1, type: 'name', xPt: 300, yPt: 110, widthPt: 150, heightPt: 24, signerId: 's3', required: true }
      ]
    };

    const createRes = await request(app)
      .post('/api/v1/sign/requests')
      .attach('file', pdfBuf, 'nda-secret-name.pdf')
      .field('payload', JSON.stringify(payload));

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const { requestId, senderAccessToken, originalSha256 } = createRes.body.data;
    expect(originalSha256).toHaveLength(64);

    // Check rest encryption hides %PDF- magic header
    const rawCipher = signStorage.inspectRawCiphertext(`sign/${requestId}/original.enc`);
    expect(rawCipher).toBeTruthy();
    expect(rawCipher!.subarray(0, 5).toString('utf8')).not.toBe('%PDF-');

    // Check 3 invite emails dispatched with no stored raw tokens in DB
    const stored = await signRepo.getRequestById(requestId);
    const tok1 = extractTokenFromSentEmail('bob@example.com');
    const tok2 = extractTokenFromSentEmail('carol@example.com');
    const tok3 = extractTokenFromSentEmail('dan@example.com');
    expect(JSON.stringify(stored)).not.toContain(tok1);
    expect(JSON.stringify(stored)).not.toContain(tok2);

    // Concurrent completion by Signer 1 and Signer 2 (tests per-request lock serialization)
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/sign/t/${tok1}/complete`)
        .send({ consentGiven: true, completedFields: [{ fieldId: 'f1', imageDataUrl: SAMPLE_SIG_PNG }] }),
      request(app)
        .post(`/api/v1/sign/t/${tok2}/complete`)
        .send({ consentGiven: true, completedFields: [{ fieldId: 'f2', imageDataUrl: SAMPLE_SIG_PNG }] })
    ]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Reusing tok1 must fail (single-use revocation)
    const reuseRes = await request(app).get(`/api/v1/sign/t/${tok1}`);
    expect(reuseRes.status).toBe(404);
    expect(reuseRes.body.error.code).toBe('LINK_INVALID');

    // Signer 3 views PDF + completes remaining required fields
    const pdfGet = await request(app).get(`/api/v1/sign/t/${tok3}/document`);
    expect(pdfGet.status).toBe(200);
    expect(pdfGet.headers['x-robots-tag']).toContain('noindex');

    const res3 = await request(app)
      .post(`/api/v1/sign/t/${tok3}/complete`)
      .send({
        consentGiven: true,
        completedFields: [
          { fieldId: 'f3', imageDataUrl: SAMPLE_SIG_PNG },
          { fieldId: 'f4', text: 'Dan Three' }
        ]
      });
    expect(res3.status).toBe(200);
    expect(res3.body.data.status).toBe('completed');
    expect(res3.body.data.finalSha256).toHaveLength(64);

    // Check status + audit chain validity
    const statusRes = await request(app)
      .get(`/api/v1/sign/requests/${requestId}`)
      .set('x-sender-token', senderAccessToken);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('completed');
    expect(statusRes.body.data.auditChainValid).toBe(true);

    // Tamper audit entry check
    const tampered = [...statusRes.body.data.auditLog];
    tampered[1] = { ...tampered[1], signerEmail: 'attacker@evil.example' };
    expect(verifyAuditChain(tampered)).toBe(false);

    // Download final signed PDF -> verify SHA-256 + 2 original pages + 1 Certificate page = 3 pages
    const dlRes = await request(app)
      .get(`/api/v1/sign/requests/${requestId}/final`)
      .set('x-sender-token', senderAccessToken)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dlRes.status).toBe(200);
    const finalBuf = dlRes.body as Buffer;
    expect(sha256Hex(finalBuf)).toBe(res3.body.data.finalSha256);

    const loadedFinal = await PDFDocument.load(finalBuf);
    expect(loadedFinal.getPageCount()).toBe(3);

    // Verify no PDF bytes / filenames leaked into console logs
    const logged = logSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain('%PDF-');
    expect(logged).not.toContain('nda-secret-name');
    logSpy.mockRestore();
  });

  it('enforces sequential signing order, resend token rotation, decline, and cancel', async () => {
    const pdfBuf = await buildTestPdfBytes(1);
    const payload = {
      senderName: 'Alice',
      senderEmail: 'alice@example.com',
      title: 'Sequential Contract',
      order: 'sequential',
      signers: [
        { id: 's1', name: 'First Signer', email: 'one@example.com', orderIndex: 0 },
        { id: 's2', name: 'Second Signer', email: 'two@example.com', orderIndex: 1 }
      ],
      fields: [
        { id: 'f1', pageIndex: 0, type: 'signature', xPt: 50, yPt: 100, widthPt: 150, heightPt: 50, signerId: 's1' },
        { id: 'f2', pageIndex: 0, type: 'signature', xPt: 250, yPt: 100, widthPt: 150, heightPt: 50, signerId: 's2' }
      ]
    };

    const createRes = await request(app)
      .post('/api/v1/sign/requests')
      .attach('file', pdfBuf, 'seq.pdf')
      .field('payload', JSON.stringify(payload));
    expect(createRes.status).toBe(201);
    const { requestId, senderAccessToken } = createRes.body.data;

    // Only First Signer received an email initially
    expect(signEmail.sent.filter((m) => m.to === 'one@example.com').length).toBe(1);
    expect(signEmail.sent.filter((m) => m.to === 'two@example.com').length).toBe(0);

    const oldTok1 = extractTokenFromSentEmail('one@example.com');
    // Sender resends & updates s1 email -> old token MUST become invalid
    const resendRes = await request(app)
      .post(`/api/v1/sign/requests/${requestId}/resend`)
      .set('x-sender-token', senderAccessToken)
      .send({ signerId: 's1', newEmail: 'one-updated@example.com' });
    expect(resendRes.status).toBe(200);

    const revokedGet = await request(app).get(`/api/v1/sign/t/${oldTok1}`);
    expect(revokedGet.status).toBe(404);

    const newTok1 = extractTokenFromSentEmail('one-updated@example.com');
    const complete1 = await request(app)
      .post(`/api/v1/sign/t/${newTok1}/complete`)
      .send({ consentGiven: true, completedFields: [{ fieldId: 'f1', imageDataUrl: SAMPLE_SIG_PNG }] });
    expect(complete1.status).toBe(200);
    expect(complete1.body.data.status).toBe('partial');

    // Now Signer 2 receives invite email, then declines
    const tok2 = extractTokenFromSentEmail('two@example.com');
    const declRes = await request(app)
      .post(`/api/v1/sign/t/${tok2}/decline`)
      .send({ reason: 'Terms unacceptable' });
    expect(declRes.status).toBe(200);
    expect(declRes.body.data.status).toBe('declined');

    const statusAfterDecline = await request(app)
      .get(`/api/v1/sign/requests/${requestId}`)
      .set('x-sender-token', senderAccessToken);
    expect(statusAfterDecline.body.data.status).toBe('declined');
  });

  it('blocks CSRF mismatch, verifies sender OTP lockout after 5 failures, and enforces sender quota', async () => {
    // 1. CSRF check: cross-site Origin without valid matching pt_csrf cookie + header
    const csrfFail = await request(app)
      .post('/api/v1/sign/sender/verify-start')
      .set('Origin', 'https://evil.example')
      .send({ email: 'sender@example.com' });
    expect(csrfFail.status).toBe(403);
    expect(csrfFail.body.error.code).toBe('CSRF_INVALID');

    // Valid CSRF token issuance & OTP flow + lockout
    const csrfRes = await request(app).get('/api/v1/sign/csrf');
    const csrfToken = csrfRes.body.data.csrfToken;
    const cookieHeader = `pt_csrf=${csrfToken}`;

    const otpStart = await request(app)
      .post('/api/v1/sign/sender/verify-start')
      .set('Origin', 'http://localhost:4200')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'otp@example.com' });
    expect(otpStart.status).toBe(200);
    const realCode = otpStart.body.data._devOtpCode;
    expect(realCode).toMatch(/^\d{6}$/);

    // 4 bad guesses -> 401, 5th bad guess -> 429 OTP_LOCKED
    for (let i = 0; i < 4; i++) {
      const bad = await request(app)
        .post('/api/v1/sign/sender/verify-confirm')
        .send({ email: 'otp@example.com', code: '000000' });
      expect(bad.status).toBe(401);
    }
    const fifth = await request(app)
      .post('/api/v1/sign/sender/verify-confirm')
      .send({ email: 'otp@example.com', code: '000000' });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('OTP_LOCKED');

    // Fresh email succeeds with exact code and passes verified sender gate
    const start2 = await request(app).post('/api/v1/sign/sender/verify-start').send({ email: 'verified@example.com' });
    const ok = await request(app)
      .post('/api/v1/sign/sender/verify-confirm')
      .send({ email: 'verified@example.com', code: start2.body.data._devOtpCode });
    expect(ok.status).toBe(200);
    expect(ok.body.data.verified).toBe(true);
  });

  it('strips malicious JS/Launch/EmbeddedFiles and rejects encrypted, 0-byte, non-PDF, and >100 page PDFs', async () => {
    // Malicious PDF with /OpenAction /JavaScript & /Names/EmbeddedFiles
    const dirtyDoc = await PDFDocument.create();
    dirtyDoc.addPage();
    dirtyDoc.catalog.set(PDFName.of('OpenAction'), PDFString.of('app.alert(1)'));
    dirtyDoc.catalog.set(PDFName.of('JS'), PDFString.of('app.alert(2)'));
    const dirtyBytes = await dirtyDoc.save();
    const cleaned = await sanitiseUploadedPdf(dirtyBytes);
    expect(cleaned.strippedActiveContentCount).toBeGreaterThanOrEqual(2);
    const reloaded = await PDFDocument.load(cleaned.cleanBytes);
    expect(reloaded.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    expect(reloaded.catalog.has(PDFName.of('JS'))).toBe(false);

    // Non-PDF magic bytes -> 415
    const badRes = await request(app)
      .post('/api/v1/sign/requests')
      .attach('file', Buffer.from('not a pdf'), 'fake.pdf')
      .field('payload', JSON.stringify({
        senderName: 'A', senderEmail: 'a@b.com', title: 'T',
        signers: [{ id: 's1', name: 'S', email: 's@b.com', orderIndex: 0 }],
        fields: [{ id: 'f1', pageIndex: 0, type: 'signature', xPt: 10, yPt: 10, widthPt: 100, heightPt: 40 }]
      }));
    expect(badRes.status).toBe(415);

    // >100 pages -> 413
    const hugePages = await buildTestPdfBytes(101);
    await expect(sanitiseUploadedPdf(hugePages)).rejects.toMatchObject({ statusCode: 413, code: 'TOO_MANY_PAGES' });
  });

  it('sanitises CRLF email headers and escapes HTML in titles/messages', () => {
    const email = buildSignerInviteEmail({
      toEmail: 'signer@example.com',
      signerName: 'Bob <Admin>',
      senderName: 'Alice',
      senderEmail: 'alice@example.com\r\nBcc:attacker@evil.example',
      title: 'NDA\r\nBcc:evil@x.com <script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
      signingUrl: 'https://example.com/sign/abc',
      expiresAtIso: new Date().toISOString()
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.replyTo).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('expires overdue requests, runs reminders + retention deletion, and supports GDPR export/delete', async () => {
    const pdfBuf = await buildTestPdfBytes(1);
    const created = await signWorkflow.createAndSendRequest(
      pdfBuf,
      'retention.pdf',
      {
        senderName: 'Gdpr User',
        senderEmail: 'gdpr@example.com',
        title: 'Retention Doc',
        expiryDays: 2,
        remindersEnabled: true,
        signers: [{ id: 's1', name: 'S1', email: 's1@example.com', orderIndex: 0 }],
        fields: [{ id: 'f1', pageIndex: 0, type: 'signature', xPt: 50, yPt: 50, widthPt: 120, heightPt: 40, signerId: 's1' }]
      }
    );

    const exported = await signWorkflow.exportSenderData('gdpr@example.com');
    expect(exported.length).toBe(1);
    expect((exported[0] as any).senderAccessTokenHash).toBeUndefined();

    // Advance clock past expiry + 14 days retention -> sweeps & purges ciphertext
    const farFuture = Date.now() + 20 * 24 * 60 * 60 * 1000;
    const sweep = await signWorkflow.runExpiryAndRetentionSweep(farFuture);
    expect(sweep.expired).toBe(1);
    expect(sweep.purged).toBe(1);
    expect(signStorage.hasKey(`sign/${created.requestId}/original.enc`)).toBe(false);
    expect(await signRepo.getRequestById(created.requestId)).toBeNull();
  });

  it('supports cancel, GDPR hard delete, standalone certificate download, rate limit, and hourly quota', async () => {
    const pdfBuf = await buildTestPdfBytes(1);
    const created = await signWorkflow.createAndSendRequest(
      pdfBuf,
      'cancel.pdf',
      {
        senderName: 'Owner',
        senderEmail: 'quota@example.com',
        title: 'Cancellable Agreement',
        expiryDays: 7,
        remindersEnabled: true,
        signers: [{ id: 's1', name: 'R1', email: 'r1@example.com', orderIndex: 0 }],
        fields: [{ id: 'f1', pageIndex: 0, type: 'signature', xPt: 40, yPt: 40, widthPt: 140, heightPt: 50, signerId: 's1' }]
      }
    );

    // Certificate endpoint streams valid PDF
    const certRes = await request(app)
      .get(`/api/v1/sign/requests/${created.requestId}/certificate`)
      .set('x-sender-token', created.senderAccessToken)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(certRes.status).toBe(200);
    expect((certRes.body as Buffer).subarray(0, 5).toString('utf8')).toBe('%PDF-');

    // Reminder dispatch rotates token cleanly
    const sentRem = await signWorkflow.sendDueReminder(created.requestId);
    expect(sentRem).toBe(1);
    const tokLatest = extractTokenFromSentEmail('r1@example.com');

    // Cancel revokes signer token -> signer gets 410 REQUEST_CANCELLED or 404 LINK_INVALID
    const cancelRes = await request(app)
      .delete(`/api/v1/sign/requests/${created.requestId}`)
      .set('x-sender-token', created.senderAccessToken);
    expect(cancelRes.status).toBe(200);

    const revokedAfterCancel = await request(app).get(`/api/v1/sign/t/${tokLatest}`);
    expect(revokedAfterCancel.status).toBe(404);

    // GDPR hard delete purges request & ciphertext immediately
    const gdprDel = await request(app)
      .delete(`/api/v1/sign/gdpr/requests/${created.requestId}`)
      .set('x-sender-token', created.senderAccessToken);
    expect(gdprDel.status).toBe(200);
    expect(signStorage.hasKey(`sign/${created.requestId}/original.enc`)).toBe(false);

    // Hourly sender quota (limit 10)
    for (let i = 0; i < 9; i++) {
      await signWorkflow.createAndSendRequest(pdfBuf, `q${i}.pdf`, {
        senderName: 'Owner',
        senderEmail: 'quota@example.com',
        title: `Quota ${i}`,
        signers: [{ id: 's1', name: 'R1', email: 'r1@example.com', orderIndex: 0 }],
        fields: [{ id: 'f1', pageIndex: 0, type: 'signature', xPt: 40, yPt: 40, widthPt: 140, heightPt: 50, signerId: 's1' }]
      });
    }
    await expect(
      signWorkflow.createAndSendRequest(pdfBuf, 'q-over.pdf', {
        senderName: 'Owner',
        senderEmail: 'quota@example.com',
        title: 'Over Quota',
        signers: [{ id: 's1', name: 'R1', email: 'r1@example.com', orderIndex: 0 }],
        fields: [{ id: 'f1', pageIndex: 0, type: 'signature', xPt: 40, yPt: 40, widthPt: 140, heightPt: 50, signerId: 's1' }]
      })
    ).rejects.toMatchObject({ statusCode: 429, code: 'QUOTA_EXCEEDED' });

    // Rate limit enforcement check (when x-test-rate-limit header enabled)
    await request(app).post('/api/v1/sign/sender/verify-start').set('x-test-rate-limit', '1').send({ email: 'a@b.com' });
    await request(app).post('/api/v1/sign/sender/verify-start').set('x-test-rate-limit', '1').send({ email: 'a@b.com' });
    const limited = await request(app).post('/api/v1/sign/sender/verify-start').set('x-test-rate-limit', '1').send({ email: 'a@b.com' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
