import {
  DocumentStorage,
  EmailMessage,
  EmailService,
  Scheduler,
  SenderOtpChallenge,
  SignerTokenLookupResult,
  SigningRequestRecord,
  SigningRequestRepository,
  StoredDocumentCiphertext
} from './interfaces';
import { constantTimeEqualHex } from './crypto';

export class InMemorySigningRequestRepository implements SigningRequestRepository {
  private readonly requests = new Map<string, SigningRequestRecord>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly otpChallenges = new Map<string, SenderOtpChallenge>();
  private readonly senderCreateTimestamps = new Map<string, number[]>();

  async createRequest(req: SigningRequestRecord): Promise<void> {
    this.requests.set(req.id, structuredClone(req));
  }

  async getRequestById(requestId: string): Promise<SigningRequestRecord | null> {
    const found = this.requests.get(requestId);
    return found ? structuredClone(found) : null;
  }

  async findBySignerTokenHash(tokenHash: string): Promise<SignerTokenLookupResult | null> {
    for (const req of this.requests.values()) {
      for (const signer of req.signers) {
        if (signer.tokenHash && constantTimeEqualHex(signer.tokenHash, tokenHash)) {
          return {
            request: structuredClone(req),
            signer: structuredClone(signer)
          };
        }
      }
    }
    return null;
  }

  async findBySenderEmail(email: string): Promise<SigningRequestRecord[]> {
    const normalized = email.trim().toLowerCase();
    const list: SigningRequestRecord[] = [];
    for (const req of this.requests.values()) {
      if (req.senderEmail.toLowerCase() === normalized) {
        list.push(structuredClone(req));
      }
    }
    return list;
  }

  async updateRequest(req: SigningRequestRecord): Promise<void> {
    this.requests.set(req.id, structuredClone(req));
  }

  async withRequestLock<T>(
    requestId: string,
    fn: (latest: SigningRequestRecord | null) => Promise<T>
  ): Promise<T> {
    const previous = this.locks.get(requestId) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    this.locks.set(requestId, gate);

    await previous.catch(() => undefined);
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
    for (const req of this.requests.values()) {
      const expMs = Date.parse(req.expiresAt);
      const retMs = Date.parse(req.retentionDeleteAt);
      const isDueExpiry = req.status === 'in_progress' && Number.isFinite(expMs) && nowMs >= expMs;
      const isDueRetention = !req.deletedAt && Number.isFinite(retMs) && nowMs >= retMs;
      if (isDueExpiry || isDueRetention) {
        out.push(structuredClone(req));
      }
    }
    return out;
  }

  async deleteRequest(requestId: string): Promise<void> {
    this.requests.delete(requestId);
  }

  async saveOtpChallenge(challenge: SenderOtpChallenge): Promise<void> {
    this.otpChallenges.set(challenge.email.trim().toLowerCase(), structuredClone(challenge));
  }

  async getOtpChallenge(email: string): Promise<SenderOtpChallenge | null> {
    const found = this.otpChallenges.get(email.trim().toLowerCase());
    return found ? structuredClone(found) : null;
  }

  async incrementSenderCreateCount(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }> {
    const key = email.trim().toLowerCase();
    const list = (this.senderCreateTimestamps.get(key) || []).filter((ts) => nowMs - ts < 24 * 60 * 60 * 1000);
    list.push(nowMs);
    this.senderCreateTimestamps.set(key, list);
    const hourCount = list.filter((ts) => nowMs - ts < 60 * 60 * 1000).length;
    return { hourCount, dayCount: list.length };
  }

  async getSenderQuotaCounts(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }> {
    const key = email.trim().toLowerCase();
    const list = (this.senderCreateTimestamps.get(key) || []).filter((ts) => nowMs - ts < 24 * 60 * 60 * 1000);
    this.senderCreateTimestamps.set(key, list);
    const hourCount = list.filter((ts) => nowMs - ts < 60 * 60 * 1000).length;
    return { hourCount, dayCount: list.length };
  }

  /** Test helper for resetting all in-memory state cleanly between test cases. */
  clear(): void {
    this.requests.clear();
    this.locks.clear();
    this.otpChallenges.clear();
    this.senderCreateTimestamps.clear();
  }
}

export class InMemoryDocumentStorage implements DocumentStorage {
  private readonly blobs = new Map<string, StoredDocumentCiphertext>();

  async putEncrypted(key: string, data: StoredDocumentCiphertext): Promise<void> {
    this.blobs.set(key, {
      ...data,
      ciphertext: Buffer.from(data.ciphertext)
    });
  }

  async getEncrypted(key: string): Promise<StoredDocumentCiphertext | null> {
    const found = this.blobs.get(key);
    if (!found) return null;
    return {
      ...found,
      ciphertext: Buffer.from(found.ciphertext)
    };
  }

  async delete(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  /** Inspection helper for verifying rest encryption in security tests. */
  inspectRawCiphertext(key: string): Buffer | null {
    return this.blobs.get(key)?.ciphertext || null;
  }

  hasKey(key: string): boolean {
    return this.blobs.has(key);
  }

  clear(): void {
    this.blobs.clear();
  }
}

export class InMemoryEmailService implements EmailService {
  readonly sent: Array<EmailMessage & { messageId: string; sentAt: string }> = [];

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sent.push({
      ...message,
      messageId,
      sentAt: new Date().toISOString()
    });
    return { messageId };
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export class InMemoryScheduler implements Scheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(jobKey: string, runAtMs: number, task: () => Promise<void> | void): void {
    this.cancel(jobKey);
    const delayMs = Math.max(10, runAtMs - Date.now());
    // Cap JS 32-bit signed int setTimeout overflow (~24.8 days) by re-chaining if longer
    const maxTimeout = 2_147_483_000;
    if (delayMs > maxTimeout) {
      const handle = setTimeout(() => {
        this.schedule(jobKey, runAtMs, task);
      }, maxTimeout);
      if (typeof handle.unref === 'function') handle.unref();
      this.timers.set(jobKey, handle);
      return;
    }

    const handle = setTimeout(() => {
      this.timers.delete(jobKey);
      void Promise.resolve(task()).catch(() => undefined);
    }, delayMs);
    if (typeof handle.unref === 'function') handle.unref();
    this.timers.set(jobKey, handle);
  }

  cancel(jobKey: string): void {
    const existing = this.timers.get(jobKey);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(jobKey);
    }
  }

  cancelAllForPrefix(prefix: string): void {
    for (const [k, handle] of this.timers.entries()) {
      if (k.startsWith(prefix)) {
        clearTimeout(handle);
        this.timers.delete(k);
      }
    }
  }

  clearAll(): void {
    for (const handle of this.timers.values()) {
      clearTimeout(handle);
    }
    this.timers.clear();
  }
}
