import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { applyDetachedPdfSignature } from '@paperflow/sign-core';
import { AppError } from '../../middleware/errorHandler';
import { SIGN_ERROR_CODES } from '@paperflow/contracts';

const execFileAsync = promisify(execFile);

export interface ServerCertificateSignResult {
  signedPdfBytes: Buffer;
  signerCommonName: string;
  issuerCommonName: string;
}

function parseCnFromOpenSslSubject(subjectLine: string): string {
  const m = subjectLine.match(/(?:^|,|\/|=)\s*CN\s*=\s*([^,/\n]+)/i);
  return (m?.[1] || 'Certificate Holder').trim();
}

/**
 * Signs an uploaded PDF using a user-supplied .p12/.pfx archive (supports legacy 3DES/RC2 and AES/PBES2 PKCS#12)
 * via isolated OpenSSL subprocess calls. All private key material and passphrases are scrubbed in `finally`.
 */
export async function signPdfWithPkcs12OpenSsl(
  pdfBytes: Buffer,
  p12Bytes: Buffer,
  passphrase: string,
  options: { reason?: string; location?: string } = {}
): Promise<ServerCertificateSignResult> {
  if (!pdfBytes || pdfBytes.length < 5 || pdfBytes.subarray(0, 5).toString('utf8') !== '%PDF-') {
    throw new AppError(
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.status,
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.code,
      'Invalid PDF file signature.'
    );
  }
  if (!p12Bytes || p12Bytes.length < 16 || p12Bytes[0] !== 0x30) {
    throw new AppError(
      SIGN_ERROR_CODES.INVALID_OPTIONS.status,
      SIGN_ERROR_CODES.INVALID_OPTIONS.code,
      'Invalid PKCS#12 (.p12 / .pfx) certificate file.'
    );
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-cert-'));
  try {
    fs.chmodSync(workDir, 0o700);
    const p12Path = path.join(workDir, 'cert.p12');
    const passPath = path.join(workDir, 'pass.txt');
    const keyPath = path.join(workDir, 'key.pem');
    const certPath = path.join(workDir, 'cert.pem');
    const chainPath = path.join(workDir, 'chain.pem');

    fs.writeFileSync(p12Path, p12Bytes, { mode: 0o600 });
    fs.writeFileSync(passPath, passphrase || '', { mode: 0o600 });

    try {
      // Extract unencrypted private key & leaf cert into strict 0600 files inside ephemeral dir
      await execFileAsync(
        'openssl',
        ['pkcs12', '-in', p12Path, '-nocerts', '-nodes', '-passin', `file:${passPath}`, '-out', keyPath],
        { timeout: 10000 }
      );
      await execFileAsync(
        'openssl',
        ['pkcs12', '-in', p12Path, '-clcerts', '-nokeys', '-passin', `file:${passPath}`, '-out', certPath],
        { timeout: 10000 }
      );
    } catch {
      throw new AppError(400, 'INVALID_CERTIFICATE_OR_PASSWORD', 'Could not unlock certificate. Check password and .p12/.pfx file.');
    }

    // Optional intermediate CA chain (best-effort)
    let hasChain = false;
    try {
      await execFileAsync(
        'openssl',
        ['pkcs12', '-in', p12Path, '-cacerts', '-nokeys', '-passin', `file:${passPath}`, '-out', chainPath],
        { timeout: 10000 }
      );
      hasChain = fs.existsSync(chainPath) && fs.readFileSync(chainPath, 'utf8').includes('BEGIN CERTIFICATE');
    } catch {
      hasChain = false;
    }

    const certPem = fs.readFileSync(certPath, 'utf8');
    if (!certPem.includes('BEGIN CERTIFICATE')) {
      throw new AppError(400, 'INVALID_CERTIFICATE_OR_PASSWORD', 'Certificate archive does not contain an X.509 signing certificate.');
    }

    const subjOut = await execFileAsync('openssl', ['x509', '-in', certPath, '-noout', '-subject'], { timeout: 5000 });
    const issuerOut = await execFileAsync('openssl', ['x509', '-in', certPath, '-noout', '-issuer'], { timeout: 5000 });
    const signerCommonName = parseCnFromOpenSslSubject(subjOut.stdout || '');
    const issuerCommonName = parseCnFromOpenSslSubject(issuerOut.stdout || '');

    const { signedPdfBytes } = await applyDetachedPdfSignature(
      new Uint8Array(pdfBytes),
      {
        signerName: signerCommonName,
        reason: options.reason || 'Digitally signed with X.509 certificate',
        location: options.location || 'PDFTailor'
      },
      async (dataToSign) => {
        const rangeBinPath = path.join(workDir, 'byterange.bin');
        const sigDerPath = path.join(workDir, 'sig.der');
        fs.writeFileSync(rangeBinPath, dataToSign, { mode: 0o600 });

        const cmsArgs = [
          'cms', '-sign',
          '-signer', certPath,
          '-inkey', keyPath,
          ...(hasChain ? ['-certfile', chainPath] : []),
          '-in', rangeBinPath,
          '-outform', 'DER',
          '-binary',
          '-md', 'sha256',
          '-out', sigDerPath
        ];
        await execFileAsync('openssl', cmsArgs, { timeout: 10000 });
        return new Uint8Array(fs.readFileSync(sigDerPath));
      }
    );

    return {
      signedPdfBytes: Buffer.from(signedPdfBytes),
      signerCommonName,
      issuerCommonName
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup race
    }
  }
}
