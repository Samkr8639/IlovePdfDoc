import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  DocumentStorage,
  EmailMessage,
  EmailService,
  SenderOtpChallenge,
  SignerTokenLookupResult,
  SigningRequestRecord,
  SigningRequestRepository,
  StoredDocumentCiphertext
} from './interfaces';
import { constantTimeEqualHex } from './crypto';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

/**
 * Zero-dependency file-backed persistence for single-node & local dev runtime.
 * Stores request metadata as atomic JSON files so active links survive restarts.
 */
export class DiskSigningRequestRepository implements SigningRequestRepository {
  private readonly requestsDir: string;
  private readonly otpFile: string;
  private readonly quotaFile: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(baseDir: string) {
    this.requestsDir = path.join(baseDir, 'requests');
    this.otpFile = path.join(baseDir, 'state', 'otp-challenges.json');
    this.quotaFile = path.join(baseDir, 'state', 'sender-quotas.json');
    ensureDir(this.requestsDir);
    ensureDir(path.dirname(this.otpFile));
  }

  private reqPath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.requestsDir, `${safeId}.json`);
  }

  async createRequest(req: SigningRequestRecord): Promise<void> {
    writeJsonAtomic(this.reqPath(req.id), req);
  }

  async getRequestById(requestId: string): Promise<SigningRequestRecord | null> {
    const p = this.reqPath(requestId);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as SigningRequestRecord;
    } catch {
      return null;
    }
  }

  private listAllRequests(): SigningRequestRecord[] {
    ensureDir(this.requestsDir);
    const out: SigningRequestRecord[] = [];
    for (const fname of fs.readdirSync(this.requestsDir)) {
      if (!fname.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(this.requestsDir, fname), 'utf8')) as SigningRequestRecord);
      } catch {
        // Ignore corrupt/partial files
      }
    }
    return out;
  }

  async findBySignerTokenHash(tokenHash: string): Promise<SignerTokenLookupResult | null> {
    for (const req of this.listAllRequests()) {
      for (const signer of req.signers) {
        if (signer.tokenHash && constantTimeEqualHex(signer.tokenHash, tokenHash)) {
          return { request: req, signer: structuredClone(signer) };
        }
      }
    }
    return null;
  }

  async findBySenderEmail(email: string): Promise<SigningRequestRecord[]> {
    const lower = email.trim().toLowerCase();
    return this.listAllRequests().filter((r) => r.senderEmail.toLowerCase() === lower);
  }

  async updateRequest(req: SigningRequestRecord): Promise<void> {
    writeJsonAtomic(this.reqPath(req.id), req);
  }

  async withRequestLock<T>(
    requestId: string,
    fn: (latest: SigningRequestRecord | null) => Promise<T>
  ): Promise<T> {
    const prev = this.locks.get(requestId) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    this.locks.set(requestId, gate);
    await prev.catch(() => undefined);
    try {
      const latest = await this.getRequestById(requestId);
      return await fn(latest);
    } finally {
      release();
      if (this.locks.get(requestId) === gate) {
        this.locks.delete(requestId);
      }
    }
  }

  async listDueForRetentionOrExpiry(nowMs: number): Promise<SigningRequestRecord[]> {
    const out: SigningRequestRecord[] = [];
    for (const req of this.listAllRequests()) {
      const expMs = Date.parse(req.expiresAt);
      const retMs = Date.parse(req.retentionDeleteAt);
      const dueExp = req.status === 'in_progress' && Number.isFinite(expMs) && nowMs >= expMs;
      const dueRet = !req.deletedAt && Number.isFinite(retMs) && nowMs >= retMs;
      if (dueExp || dueRet) out.push(req);
    }
    return out;
  }

  async deleteRequest(requestId: string): Promise<void> {
    const p = this.reqPath(requestId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  private readJsonMap<T>(filePath: string): Record<string, T> {
    if (!fs.existsSync(filePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, T>;
    } catch {
      return {};
    }
  }

  async saveOtpChallenge(challenge: SenderOtpChallenge): Promise<void> {
    const map = this.readJsonMap<SenderOtpChallenge>(this.otpFile);
    map[challenge.email.trim().toLowerCase()] = challenge;
    writeJsonAtomic(this.otpFile, map);
  }

  async getOtpChallenge(email: string): Promise<SenderOtpChallenge | null> {
    const map = this.readJsonMap<SenderOtpChallenge>(this.otpFile);
    return map[email.trim().toLowerCase()] || null;
  }

  async incrementSenderCreateCount(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }> {
    const key = email.trim().toLowerCase();
    const map = this.readJsonMap<number[]>(this.quotaFile);
    const list = (map[key] || []).filter((ts) => nowMs - ts < 24 * 60 * 60 * 1000);
    list.push(nowMs);
    map[key] = list;
    writeJsonAtomic(this.quotaFile, map);
    return {
      hourCount: list.filter((ts) => nowMs - ts < 60 * 60 * 1000).length,
      dayCount: list.length
    };
  }

  async getSenderQuotaCounts(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }> {
    const key = email.trim().toLowerCase();
    const map = this.readJsonMap<number[]>(this.quotaFile);
    const list = (map[key] || []).filter((ts) => nowMs - ts < 24 * 60 * 60 * 1000);
    return {
      hourCount: list.filter((ts) => nowMs - ts < 60 * 60 * 1000).length,
      dayCount: list.length
    };
  }
}

/**
 * Encrypted blob storage on disk (only AES-256-GCM ciphertext + wrapped DEK ever touch disk).
 */
export class DiskDocumentStorage implements DocumentStorage {
  private readonly blobsDir: string;

  constructor(baseDir: string) {
    this.blobsDir = path.join(baseDir, 'blobs');
    ensureDir(this.blobsDir);
  }

  private pathsForKey(key: string): { metaPath: string; binPath: string } {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return {
      metaPath: path.join(this.blobsDir, `${hash}.meta.json`),
      binPath: path.join(this.blobsDir, `${hash}.bin`)
    };
  }

  async putEncrypted(key: string, data: StoredDocumentCiphertext): Promise<void> {
    const { metaPath, binPath } = this.pathsForKey(key);
    ensureDir(this.blobsDir);
    const tmpBin = `${binPath}.tmp`;
    fs.writeFileSync(tmpBin, data.ciphertext, { mode: 0o600 });
    fs.renameSync(tmpBin, binPath);
    writeJsonAtomic(metaPath, {
      wrappedDek: data.wrappedDek,
      iv: data.iv,
      authTag: data.authTag,
      sha256: data.sha256,
      byteLength: data.byteLength
    });
  }

  async getEncrypted(key: string): Promise<StoredDocumentCiphertext | null> {
    const { metaPath, binPath } = this.pathsForKey(key);
    if (!fs.existsSync(metaPath) || !fs.existsSync(binPath)) return null;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const ciphertext = fs.readFileSync(binPath);
      return {
        ciphertext,
        wrappedDek: meta.wrappedDek,
        iv: meta.iv,
        authTag: meta.authTag,
        sha256: meta.sha256,
        byteLength: meta.byteLength
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const { metaPath, binPath } = this.pathsForKey(key);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
  }
}

/**
 * Local dev / self-hosted outbox email adapter: writes rendered messages to disk without logging secrets.
 */
export class OutboxEmailService implements EmailService {
  private readonly outboxDir: string;

  constructor(baseDir: string) {
    this.outboxDir = path.join(baseDir, 'outbox');
    ensureDir(this.outboxDir);
  }

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const messageId = `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const outPath = path.join(this.outboxDir, `${messageId}.json`);
    writeJsonAtomic(outPath, {
      messageId,
      sentAt: new Date().toISOString(),
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    return { messageId };
  }
}
