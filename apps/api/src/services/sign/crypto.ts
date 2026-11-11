import crypto from 'crypto';
import { StoredDocumentCiphertext } from './interfaces';

let ephemeralDevKey: Buffer | null = null;
let warnedEphemeral = false;

/**
 * Resolves the 32-byte AES-256-GCM master wrapping key.
 * In production with signing requests enabled, SIGN_MASTER_KEY must be set (>= 32 chars/bytes).
 */
export function resolveMasterKey(): Buffer {
  const configured = (process.env.SIGN_MASTER_KEY || '').trim();
  if (configured) {
    // Support 64-hex-char, base64, or passphrase hashed deterministically with domain salt
    if (/^[0-9a-fA-F]{64}$/.test(configured)) {
      return Buffer.from(configured, 'hex');
    }
    const b64 = Buffer.from(configured, 'base64');
    if (b64.length === 32 && b64.toString('base64').replace(/=+$/, '') === configured.replace(/=+$/, '')) {
      return b64;
    }
    if (configured.length >= 32) {
      return crypto.createHash('sha256').update(`pdftailor-sign-master:${configured}`).digest();
    }
    throw new Error('SIGN_MASTER_KEY must be at least 32 characters (or 64 hex / 32-byte base64).');
  }

  if (process.env.NODE_ENV === 'production' && process.env.SIGN_REQUESTS_ENABLED === 'true') {
    throw new Error('SIGN_MASTER_KEY is required in production when SIGN_REQUESTS_ENABLED=true.');
  }

  if (!ephemeralDevKey) {
    ephemeralDevKey = crypto.randomBytes(32);
    if (!warnedEphemeral && process.env.NODE_ENV !== 'test') {
      warnedEphemeral = true;
      console.warn('[SignPDF] SIGN_MASTER_KEY not set — generated ephemeral in-memory key for non-production runtime.');
    }
  }
  return ephemeralDevKey;
}

/** Generates a 256-bit cryptographically random URL-safe bearer token. */
export function generateToken256(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Salted HMAC-SHA256 hash of a token so raw tokens are never persisted at rest. */
export function hashSecretToken(token: string, context = 'signer-token'): string {
  const master = resolveMasterKey();
  return crypto
    .createHmac('sha256', master)
    .update(`${context}:${token}`)
    .digest('hex');
}

/** Constant-time equality comparison for equal-length hex digests. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Encrypts document bytes using a fresh random 256-bit DEK and AES-256-GCM,
 * then wraps the DEK using the master key + AES-256-GCM.
 */
export function encryptDocumentAtRest(plainBytes: Buffer | Uint8Array): StoredDocumentCiphertext {
  const master = resolveMasterKey();
  const dek = crypto.randomBytes(32);
  const docIv = crypto.randomBytes(12);
  const docCipher = crypto.createCipheriv('aes-256-gcm', dek, docIv);
  const ciphertext = Buffer.concat([docCipher.update(plainBytes), docCipher.final()]);
  const docTag = docCipher.getAuthTag();

  const wrapIv = crypto.randomBytes(12);
  const wrapCipher = crypto.createCipheriv('aes-256-gcm', master, wrapIv);
  const wrapped = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  dek.fill(0);

  return {
    ciphertext,
    wrappedDek: `${wrapIv.toString('base64url')}.${wrapTag.toString('base64url')}.${wrapped.toString('base64url')}`,
    iv: docIv.toString('base64url'),
    authTag: docTag.toString('base64url'),
    sha256: sha256Hex(plainBytes),
    byteLength: plainBytes.byteLength
  };
}

/** Decrypts a stored AES-256-GCM ciphertext back to plaintext bytes. */
export function decryptDocumentAtRest(stored: StoredDocumentCiphertext): Buffer {
  const master = resolveMasterKey();
  const parts = stored.wrappedDek.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed wrapped document key.');
  }
  const [wrapIvStr, wrapTagStr, wrappedStr] = parts;
  const unwrap = crypto.createDecipheriv(
    'aes-256-gcm',
    master,
    Buffer.from(wrapIvStr, 'base64url')
  );
  unwrap.setAuthTag(Buffer.from(wrapTagStr, 'base64url'));
  const dek = Buffer.concat([unwrap.update(Buffer.from(wrappedStr, 'base64url')), unwrap.final()]);

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(stored.iv, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(stored.authTag, 'base64url'));
    return Buffer.concat([decipher.update(stored.ciphertext), decipher.final()]);
  } finally {
    dek.fill(0);
  }
}
