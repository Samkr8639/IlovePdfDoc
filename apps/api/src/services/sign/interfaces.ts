import {
  AuditLogEntry,
  PdfPageBoxMetrics,
  SignFieldElement,
  SignRequestOrder,
  SignRequestStatus,
  SignerStatus
} from '@paperflow/contracts';

export interface StoredDocumentCiphertext {
  ciphertext: Buffer;
  wrappedDek: string;
  iv: string;
  authTag: string;
  sha256: string;
  byteLength: number;
}

export interface SignerRecord {
  id: string;
  name: string;
  email: string;
  orderIndex: number;
  color: string;
  status: SignerStatus;
  tokenHash: string | null;
  tokenExpiresAt: string | null;
  openedAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  ip?: string;
  userAgent?: string;
  otpAttempts: number;
  otpLockedUntil?: number;
}

export interface SigningRequestRecord {
  id: string;
  senderName: string;
  senderEmail: string;
  senderEmailVerified: boolean;
  senderAccessTokenHash: string;
  title: string;
  message: string;
  originalFilename: string;
  order: SignRequestOrder;
  status: SignRequestStatus;
  requireSignerOtp: boolean;
  remindersEnabled: boolean;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  cancelledAt?: string;
  declinedAt?: string;
  retentionDeleteAt: string;
  deletedAt?: string;
  originalStorageKey: string;
  originalSha256: string;
  finalStorageKey?: string;
  finalSha256?: string;
  sealedWithCertificate?: boolean;
  pageCount: number;
  pagesMeta: PdfPageBoxMetrics[];
  signers: SignerRecord[];
  fields: SignFieldElement[];
  auditLog: AuditLogEntry[];
  reminderCount: number;
  lastReminderAt?: string;
}

export interface SenderOtpChallenge {
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
  verifiedAt?: number;
}

export interface SignerTokenLookupResult {
  request: SigningRequestRecord;
  signer: SignerRecord;
}

export interface EmailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

/**
 * Persistence interface for multi-signer workflow state.
 * Production deployments back this with PostgreSQL or encrypted SQLite.
 */
export interface SigningRequestRepository {
  createRequest(req: SigningRequestRecord): Promise<void>;
  getRequestById(requestId: string): Promise<SigningRequestRecord | null>;
  findBySignerTokenHash(tokenHash: string): Promise<SignerTokenLookupResult | null>;
  findBySenderEmail(email: string): Promise<SigningRequestRecord[]>;
  updateRequest(req: SigningRequestRecord): Promise<void>;
  /**
   * Serializes state-mutating work per request ID so concurrent signer finishes
   * never overwrite each other's completed fields or race on completion export.
   */
  withRequestLock<T>(requestId: string, fn: (latest: SigningRequestRecord | null) => Promise<T>): Promise<T>;
  listDueForRetentionOrExpiry(nowMs: number): Promise<SigningRequestRecord[]>;
  deleteRequest(requestId: string): Promise<void>;

  // Sender OTP store
  saveOtpChallenge(challenge: SenderOtpChallenge): Promise<void>;
  getOtpChallenge(email: string): Promise<SenderOtpChallenge | null>;

  // Sender quota tracking
  incrementSenderCreateCount(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }>;
  getSenderQuotaCounts(email: string, nowMs: number): Promise<{ hourCount: number; dayCount: number }>;
}

/**
 * Encrypted blob storage interface for PDF documents.
 * Production deployments back this with SSE/client-encrypted S3/R2 or encrypted disk.
 */
export interface DocumentStorage {
  putEncrypted(key: string, data: StoredDocumentCiphertext): Promise<void>;
  getEncrypted(key: string): Promise<StoredDocumentCiphertext | null>;
  delete(key: string): Promise<void>;
}

/**
 * Outbound transactional email interface.
 * Production deployments integrate Postmark, SES, or SMTP relay with SPF/DKIM/DMARC.
 */
export interface EmailService {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

/**
 * Delayed background job scheduler for reminders, expiry, and retention purge.
 * Production deployments use Cloud Tasks, BullMQ/Redis, or pg-boss.
 */
export interface Scheduler {
  schedule(jobKey: string, runAtMs: number, task: () => Promise<unknown> | void): void;
  cancel(jobKey: string): void;
  cancelAllForPrefix(prefix: string): void;
  clearAll(): void;
}
