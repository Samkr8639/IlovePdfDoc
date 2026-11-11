import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import {
  applyDetachedPdfSignature,
  buildDetachedCmsSignedData,
  extractPdfSignaturePayload,
  InvalidPkcs12PasswordError,
  parsePkcs12WithWebCrypto,
  UnsupportedPkcs12CipherError
} from '@paperflow/sign-core';
import { createApp } from '../src/app';
import {
  DiskDocumentStorage,
  DiskSigningRequestRepository
} from '../src/services/sign/disk-store';
import { encryptDocumentAtRest, decryptDocumentAtRest } from '../src/services/sign/crypto';

async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([500, 700]).drawText('ISO 32000 PAdES Signature Test', { x: 40, y: 620, size: 16 });
  return Buffer.from(await doc.save());
}

describe('Phase 3 PAdES Digital Certificates & Persistent Disk Store', () => {
  const app = createApp();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-pades-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('signs PDF cleanly in pure WebCrypto from PBES2 .p12, verifies via OpenSSL cms -verify, and rejects tampering', async () => {
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${tmpDir}/k.pem" -out "${tmpDir}/c.pem" -days 1 -nodes -subj "/CN=Browser Signer" 2>/dev/null`);
    execSync(`openssl pkcs12 -export -keypbe AES-256-CBC -certpbe AES-256-CBC -out "${tmpDir}/aes.p12" -inkey "${tmpDir}/k.pem" -in "${tmpDir}/c.pem" -passout pass:p12pass`);

    const p12Bytes = new Uint8Array(fs.readFileSync(path.join(tmpDir, 'aes.p12')));
    await expect(parsePkcs12WithWebCrypto(p12Bytes, 'wrong-password')).rejects.toThrow(InvalidPkcs12PasswordError);

    const identity = await parsePkcs12WithWebCrypto(p12Bytes, 'p12pass');
    expect(identity.commonName).toBe('Browser Signer');
    expect(identity.keyAlgorithm).toBe('rsa');

    const pdfBuf = await buildSamplePdf();
    const { signedPdfBytes } = await applyDetachedPdfSignature(
      new Uint8Array(pdfBuf),
      { signerName: identity.commonName, reason: 'Contract approval', location: 'Browser' },
      (rangeBytes) => buildDetachedCmsSignedData(rangeBytes, identity)
    );

    // Cryptographic verification using external OpenSSL CMS verifier
    const extracted = extractPdfSignaturePayload(signedPdfBytes);
    fs.writeFileSync(path.join(tmpDir, 'signed.bin'), extracted.signedData);
    fs.writeFileSync(path.join(tmpDir, 'sig.der'), extracted.cmsDer);
    execSync(`openssl cms -verify -binary -inform DER -in "${tmpDir}/sig.der" -content "${tmpDir}/signed.bin" -CAfile "${tmpDir}/c.pem" -out /dev/null`);

    // Flip 1 byte in signed region -> OpenSSL verification MUST fail
    const tampered = new Uint8Array(extracted.signedData);
    tampered[10] ^= 0xff;
    fs.writeFileSync(path.join(tmpDir, 'tampered.bin'), tampered);
    expect(() => {
      execSync(`openssl cms -verify -binary -inform DER -in "${tmpDir}/sig.der" -content "${tmpDir}/tampered.bin" -CAfile "${tmpDir}/c.pem" -out /dev/null 2>/dev/null`);
    }).toThrow();
  });

  it('detects legacy 3DES .p12 in WebCrypto and signs it via POST /api/v1/sign/certificate-sign verified by OpenSSL', async () => {
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${tmpDir}/k.pem" -out "${tmpDir}/c.pem" -days 1 -nodes -subj "/CN=Legacy Signer" 2>/dev/null`);
    execSync(`openssl pkcs12 -export -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -out "${tmpDir}/legacy.p12" -inkey "${tmpDir}/k.pem" -in "${tmpDir}/c.pem" -passout pass:legacypass`);

    const p12Buf = fs.readFileSync(path.join(tmpDir, 'legacy.p12'));
    await expect(parsePkcs12WithWebCrypto(new Uint8Array(p12Buf), 'legacypass')).rejects.toThrow(UnsupportedPkcs12CipherError);

    const pdfBuf = await buildSamplePdf();
    const res = await request(app)
      .post('/api/v1/sign/certificate-sign')
      .attach('pdf', pdfBuf, 'agreement.pdf')
      .attach('certificate', p12Buf, 'legacy.p12')
      .field('password', 'legacypass')
      .field('reason', 'Approved')
      .field('location', 'HQ')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(Buffer.from(c)));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['x-signer-cn']).toBe('Legacy Signer');

    const extracted = extractPdfSignaturePayload(new Uint8Array(res.body as Buffer));
    fs.writeFileSync(path.join(tmpDir, 'srv.bin'), extracted.signedData);
    fs.writeFileSync(path.join(tmpDir, 'srv.der'), extracted.cmsDer);
    execSync(`openssl cms -verify -binary -inform DER -in "${tmpDir}/srv.der" -content "${tmpDir}/srv.bin" -CAfile "${tmpDir}/c.pem" -out /dev/null`);

    // Wrong password rejected cleanly with 400
    const badRes = await request(app)
      .post('/api/v1/sign/certificate-sign')
      .attach('pdf', pdfBuf, 'agreement.pdf')
      .attach('certificate', p12Buf, 'legacy.p12')
      .field('password', 'wrongpass');
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('INVALID_CERTIFICATE_OR_PASSWORD');
  });

  it('persists encrypted blobs and signing requests across DiskSigningRequestRepository restarts', async () => {
    process.env.SIGN_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const store1 = new DiskSigningRequestRepository(tmpDir);
    const blobs1 = new DiskDocumentStorage(tmpDir);

    const plain = Buffer.from('%PDF-1.7 secret contract bytes');
    await blobs1.putEncrypted('doc-1', encryptDocumentAtRest(plain));

    await store1.createRequest({
      id: 'req-disk-1',
      senderName: 'Alice',
      senderEmail: 'alice@example.com',
      senderEmailVerified: true,
      senderAccessTokenHash: 'aa'.repeat(32),
      title: 'Disk Persisted Doc',
      message: '',
      originalFilename: 'doc.pdf',
      order: 'parallel',
      status: 'in_progress',
      requireSignerOtp: false,
      remindersEnabled: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      retentionDeleteAt: new Date(Date.now() + 86400000 * 15).toISOString(),
      originalStorageKey: 'doc-1',
      originalSha256: 'bb'.repeat(32),
      pageCount: 1,
      pagesMeta: [{ pageIndex: 0, widthPt: 595, heightPt: 842, rotation: 0 }],
      signers: [],
      fields: [],
      auditLog: [],
      reminderCount: 0
    });

    // Simulate process restart with new instances pointing at same directory
    const store2 = new DiskSigningRequestRepository(tmpDir);
    const blobs2 = new DiskDocumentStorage(tmpDir);
    const loadedReq = await store2.getRequestById('req-disk-1');
    expect(loadedReq?.title).toBe('Disk Persisted Doc');

    const loadedCipher = await blobs2.getEncrypted('doc-1');
    expect(loadedCipher).toBeTruthy();
    // Raw blob on disk must NOT start with %PDF-
    expect(loadedCipher!.ciphertext.subarray(0, 5).toString('utf8')).not.toBe('%PDF-');
    expect(decryptDocumentAtRest(loadedCipher!).toString('utf8')).toBe('%PDF-1.7 secret contract bytes');
  });
});
