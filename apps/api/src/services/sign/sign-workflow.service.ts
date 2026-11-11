import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  AuditLogEntry,
  CreateSignRequestInput,
  CreateSignRequestSchema,
  SIGN_ERROR_CODES,
  SIGN_PDF_LIMITS,
  SignFieldElement
} from '@paperflow/contracts';
import {
  appendCertificateOfCompletionPage,
  exportSignedPdf
} from '@paperflow/sign-core';
import { AppError } from '../../middleware/errorHandler';
import { appendAuditEntry, verifyAuditChain } from './audit';
import {
  constantTimeEqualHex,
  decryptDocumentAtRest,
  encryptDocumentAtRest,
  generateToken256,
  hashSecretToken,
  sha256Hex
} from './crypto';
import { buildCompletionEmail, buildSignerInviteEmail } from './email-templates';
import {
  DocumentStorage,
  EmailService,
  Scheduler,
  SignerRecord,
  SigningRequestRecord,
  SigningRequestRepository
} from './interfaces';
import { sanitiseUploadedPdf } from './sanitise-pdf';

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPLETED_RETENTION_MS = 30 * DAY_MS;
const INACTIVE_RETENTION_MS = 14 * DAY_MS;
const SENDER_OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const SENDER_HOURLY_QUOTA = 10;
const SENDER_DAILY_QUOTA = 50;
const DEFAULT_SIGNER_COLORS = ['#0F766E', '#14213D', '#0284C7', '#D97706', '#7C3AED', '#DC2626', '#059669', '#4F46E5', '#C54E37', '#0369A1'];

export interface RequestClientMeta {
  ip?: string;
  userAgent?: string;
}

export interface CreateRequestResult {
  requestId: string;
  statusUrl: string;
  senderAccessToken: string;
  expiresAt: string;
  originalSha256: string;
  /** Returned only to authorized sender tracking response; raw signer tokens never stored server-side. */
  signerStatusSummaries: Array<{ id: string; name: string; email: string; orderIndex: number; status: string }>;
  /** Populated ONLY inside explicit test harness injection when needed; normal API omits raw tokens. */
  _issuedTestLinks?: Record<string, string>;
}

const FONT_DIR = path.resolve(__dirname, '../../../../web/public/fonts/sign');
const serverFontCache = new Map<string, Uint8Array | null>();

async function loadServerFont(fontKey: string): Promise<Uint8Array | null> {
  const clean = fontKey.replace(/[^a-zA-Z0-9._-]/g, '');
  if (serverFontCache.has(clean)) {
    return serverFontCache.get(clean) || null;
  }
  const candidateNames = clean.endsWith('.woff')
    ? [clean]
    : [`${clean}.woff`];
  for (const fname of candidateNames) {
    const full = path.join(FONT_DIR, fname);
    if (fs.existsSync(full)) {
      const buf = new Uint8Array(fs.readFileSync(full));
      serverFontCache.set(clean, buf);
      return buf;
    }
  }
  serverFontCache.set(clean, null);
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SignWorkflowService {
  constructor(
    private readonly repo: SigningRequestRepository,
    private readonly storage: DocumentStorage,
    private readonly email: EmailService,
    private readonly scheduler: Scheduler,
    private readonly publicBaseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:4200'
  ) {}

  /* =========================================================================
     SENDER EMAIL VERIFICATION (6-DIGIT OTP, 10m TTL, MAX 5 ATTEMPTS)
     ========================================================================= */

  async startSenderOtp(rawEmail: string): Promise<{ sent: boolean; expiresInSeconds: number; _devOtpCode?: string }> {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(SIGN_ERROR_CODES.INVALID_EMAIL.status, SIGN_ERROR_CODES.INVALID_EMAIL.code, 'Enter a valid email address.');
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashSecretToken(`${email}:${code}`, 'sender-otp');
    await this.repo.saveOtpChallenge({
      email,
      codeHash,
      expiresAt: Date.now() + SENDER_OTP_TTL_MS,
      attempts: 0
    });

    await this.email.send({
      to: email,
      subject: 'Your PDFTailor verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your PDFTailor verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
    });

    return {
      sent: true,
      expiresInSeconds: SENDER_OTP_TTL_MS / 1000,
      ...(process.env.NODE_ENV === 'test' ? { _devOtpCode: code } : {})
    };
  }

  async verifySenderOtp(rawEmail: string, code: string): Promise<{ verified: boolean }> {
    const email = (rawEmail || '').trim().toLowerCase();
    const challenge = await this.repo.getOtpChallenge(email);
    if (!challenge) {
      throw new AppError(SIGN_ERROR_CODES.OTP_INVALID.status, SIGN_ERROR_CODES.OTP_INVALID.code, 'No active verification code found.');
    }
    if (challenge.lockedUntil && Date.now() < challenge.lockedUntil) {
      throw new AppError(SIGN_ERROR_CODES.OTP_LOCKED.status, SIGN_ERROR_CODES.OTP_LOCKED.code, 'Too many invalid attempts. Request a new code later.');
    }
    if (Date.now() > challenge.expiresAt) {
      throw new AppError(SIGN_ERROR_CODES.OTP_INVALID.status, SIGN_ERROR_CODES.OTP_INVALID.code, 'Verification code expired.');
    }

    const expected = hashSecretToken(`${email}:${(code || '').trim()}`, 'sender-otp');
    if (!constantTimeEqualHex(expected, challenge.codeHash)) {
      const nextAttempts = challenge.attempts + 1;
      await this.repo.saveOtpChallenge({
        ...challenge,
        attempts: nextAttempts,
        ...(nextAttempts >= MAX_OTP_ATTEMPTS ? { lockedUntil: Date.now() + 15 * 60 * 1000 } : {})
      });
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        throw new AppError(SIGN_ERROR_CODES.OTP_LOCKED.status, SIGN_ERROR_CODES.OTP_LOCKED.code, 'Verification locked after 5 failed attempts.');
      }
      throw new AppError(SIGN_ERROR_CODES.OTP_INVALID.status, SIGN_ERROR_CODES.OTP_INVALID.code, 'Invalid verification code.');
    }

    await this.repo.saveOtpChallenge({
      ...challenge,
      verifiedAt: Date.now()
    });
    return { verified: true };
  }

  /* =========================================================================
     CREATE & SEND SIGNING REQUEST
     ========================================================================= */

  async createAndSendRequest(
    pdfBytes: Uint8Array,
    originalFilename: string,
    rawPayload: unknown,
    meta: RequestClientMeta = {},
    options: { requireVerifiedSenderOtp?: boolean; includeTestLinks?: boolean } = {}
  ): Promise<CreateRequestResult> {
    const parsed = CreateSignRequestSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message }));
      throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'Invalid signing request payload.', details);
    }

    const input: CreateSignRequestInput = parsed.data;
    if (input.signers.length > SIGN_PDF_LIMITS.maxSigners) {
      throw new AppError(SIGN_ERROR_CODES.TOO_MANY_SIGNERS.status, SIGN_ERROR_CODES.TOO_MANY_SIGNERS.code, `Maximum ${SIGN_PDF_LIMITS.maxSigners} signers allowed.`);
    }

    // Enforce sender email verification when configured
    const otpChallenge = await this.repo.getOtpChallenge(input.senderEmail);
    const senderVerified = Boolean(otpChallenge?.verifiedAt);
    if (options.requireVerifiedSenderOtp && !senderVerified) {
      throw new AppError(SIGN_ERROR_CODES.OTP_INVALID.status, SIGN_ERROR_CODES.OTP_INVALID.code, 'Verify sender email via OTP before sending signature requests.');
    }

    // Per-sender quota checks (10/hr, 50/day)
    const nowMs = Date.now();
    const existingQuota = await this.repo.getSenderQuotaCounts(input.senderEmail, nowMs);
    if (existingQuota.hourCount >= SENDER_HOURLY_QUOTA || existingQuota.dayCount >= SENDER_DAILY_QUOTA) {
      throw new AppError(
        SIGN_ERROR_CODES.QUOTA_EXCEEDED.status,
        SIGN_ERROR_CODES.QUOTA_EXCEEDED.code,
        'Sender quota exceeded. Please try again later.'
      );
    }

    // Sanitise uploaded PDF (magic bytes, size, encryption check, page count, JS/Launch strip)
    const sanitised = await sanitiseUploadedPdf(pdfBytes);

    // Ensure every field targets a valid page index & valid signer if assigned
    const signerIds = new Set(input.signers.map((s) => s.id));
    for (const f of input.fields) {
      if (f.pageIndex >= sanitised.pageCount) {
        throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, `Field references invalid page ${f.pageIndex + 1}.`);
      }
      if (f.signerId && !signerIds.has(f.signerId)) {
        throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, `Field references unknown signer "${f.signerId}".`);
      }
    }

    // Require at least one signature field overall
    if (!input.fields.some((f) => f.type === 'signature')) {
      throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'At least one signature field is required.');
    }

    const requestId = crypto.randomUUID();
    const senderAccessToken = generateToken256();
    const senderAccessTokenHash = hashSecretToken(senderAccessToken, 'sender-access');
    const createdAtIso = nowIso();
    const expiresAtMs = nowMs + input.expiryDays * DAY_MS;
    const expiresAtIso = new Date(expiresAtMs).toISOString();
    const retentionDeleteAtIso = new Date(expiresAtMs + INACTIVE_RETENTION_MS).toISOString();

    const originalStorageKey = `sign/${requestId}/original.enc`;
    const encryptedOrig = encryptDocumentAtRest(sanitised.cleanBytes);
    await this.storage.putEncrypted(originalStorageKey, encryptedOrig);

    // Prepare signers sorted cleanly by orderIndex in sequential mode
    const sortedSigners = [...input.signers].sort((a, b) => a.orderIndex - b.orderIndex);
    const issuedLinks: Record<string, string> = {};
    const signerRecords: SignerRecord[] = [];
    const tokensToEmail: Array<{ signer: SignerRecord; rawToken: string }> = [];

    for (let idx = 0; idx < sortedSigners.length; idx++) {
      const s = sortedSigners[idx];
      const shouldSendNow = input.order === 'parallel' || idx === 0;
      let tokenHash: string | null = null;
      let tokenExpiresAt: string | null = null;
      const rawToken = shouldSendNow ? generateToken256() : null;
      if (rawToken) {
        tokenHash = hashSecretToken(rawToken, 'signer-token');
        tokenExpiresAt = expiresAtIso;
        issuedLinks[s.id] = `${this.publicBaseUrl.replace(/\/$/, '')}/sign/${rawToken}`;
      }

      const rec: SignerRecord = {
        id: s.id,
        name: s.name,
        email: s.email.trim().toLowerCase(),
        orderIndex: input.order === 'parallel' ? idx : s.orderIndex,
        color: s.color || DEFAULT_SIGNER_COLORS[idx % DEFAULT_SIGNER_COLORS.length],
        status: shouldSendNow ? 'sent' : 'pending',
        tokenHash,
        tokenExpiresAt,
        otpAttempts: 0
      };
      signerRecords.push(rec);
      if (rawToken) {
        tokensToEmail.push({ signer: rec, rawToken });
      }
    }

    let auditLog: AuditLogEntry[] = appendAuditEntry([], {
      eventType: 'created',
      requestId,
      timestampUtc: createdAtIso,
      ip: meta.ip,
      userAgent: meta.userAgent,
      detail: `Created ${input.order} request for ${signerRecords.length} signer(s)`
    });

    const record: SigningRequestRecord = {
      id: requestId,
      senderName: input.senderName,
      senderEmail: input.senderEmail.trim().toLowerCase(),
      senderEmailVerified: senderVerified,
      senderAccessTokenHash,
      title: input.title,
      message: input.message || '',
      originalFilename: (originalFilename || 'document.pdf').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_'),
      order: input.order,
      status: 'in_progress',
      requireSignerOtp: input.requireSignerOtp,
      remindersEnabled: input.remindersEnabled,
      createdAt: createdAtIso,
      expiresAt: expiresAtIso,
      retentionDeleteAt: retentionDeleteAtIso,
      originalStorageKey,
      originalSha256: encryptedOrig.sha256,
      pageCount: sanitised.pageCount,
      pagesMeta: sanitised.pagesMeta,
      signers: signerRecords,
      fields: input.fields as SignFieldElement[],
      auditLog,
      reminderCount: 0
    };

    await this.repo.createRequest(record);
    await this.repo.incrementSenderCreateCount(input.senderEmail, nowMs);

    // Send initial invite emails
    for (const item of tokensToEmail) {
      const signingUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/sign/${item.rawToken}`;
      await this.email.send(
        buildSignerInviteEmail({
          toEmail: item.signer.email,
          signerName: item.signer.name,
          senderName: record.senderName,
          senderEmail: record.senderEmail,
          title: record.title,
          message: record.message,
          signingUrl,
          expiresAtIso: record.expiresAt
        })
      );
      auditLog = appendAuditEntry(auditLog, {
        eventType: 'sent',
        requestId,
        signerId: item.signer.id,
        signerEmail: item.signer.email
      });
    }
    record.auditLog = auditLog;
    await this.repo.updateRequest(record);

    this.scheduleLifecycleJobs(record);

    return {
      requestId,
      statusUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/api/v1/sign/requests/${requestId}`,
      senderAccessToken,
      expiresAt: expiresAtIso,
      originalSha256: encryptedOrig.sha256,
      signerStatusSummaries: record.signers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        orderIndex: s.orderIndex,
        status: s.status
      })),
      ...(options.includeTestLinks ? { _issuedTestLinks: issuedLinks } : {})
    };
  }

  /* =========================================================================
     SIGNER ACCESS (VIEW SESSION + DOCUMENT PDF STREAM + COMPLETE / DECLINE)
     ========================================================================= */

  private async resolveActiveSignerByToken(token: string): Promise<{ req: SigningRequestRecord; signer: SignerRecord }> {
    const clean = (token || '').trim();
    if (!clean || clean.length < 16) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Signing link is invalid.');
    }
    const tokenHash = hashSecretToken(clean, 'signer-token');
    const found = await this.repo.findBySignerTokenHash(tokenHash);
    if (!found) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Signing link is invalid or revoked.');
    }

    const { request: req, signer } = found;

    if (req.status === 'cancelled') {
      throw new AppError(SIGN_ERROR_CODES.REQUEST_CANCELLED.status, SIGN_ERROR_CODES.REQUEST_CANCELLED.code, 'This signature request was cancelled.');
    }
    if (req.status === 'declined') {
      throw new AppError(SIGN_ERROR_CODES.REQUEST_CANCELLED.status, SIGN_ERROR_CODES.REQUEST_CANCELLED.code, 'This signature request was declined.');
    }
    if (req.status === 'completed' || signer.status === 'signed') {
      throw new AppError(SIGN_ERROR_CODES.ALREADY_COMPLETED.status, SIGN_ERROR_CODES.ALREADY_COMPLETED.code, 'You have already signed this document.');
    }
    if (req.status === 'expired' || Date.now() >= Date.parse(req.expiresAt) || (signer.tokenExpiresAt && Date.now() >= Date.parse(signer.tokenExpiresAt))) {
      throw new AppError(SIGN_ERROR_CODES.REQUEST_EXPIRED.status, SIGN_ERROR_CODES.REQUEST_EXPIRED.code, 'This signing link has expired.');
    }

    return { req, signer };
  }

  private computeWaitingOn(req: SigningRequestRecord, signer: SignerRecord): { isYourTurn: boolean; waitingOn?: string } {
    if (req.order === 'parallel') return { isYourTurn: true };
    const earlierUnsigned = req.signers.find(
      (other) => other.orderIndex < signer.orderIndex && other.status !== 'signed'
    );
    if (earlierUnsigned) {
      return { isYourTurn: false, waitingOn: earlierUnsigned.name };
    }
    return { isYourTurn: true };
  }

  async getSignerSession(token: string, meta: RequestClientMeta = {}) {
    const { req, signer } = await this.resolveActiveSignerByToken(token);
    const turn = this.computeWaitingOn(req, signer);

    // Record 'opened' event atomically
    await this.repo.withRequestLock(req.id, async (latest) => {
      if (!latest) return;
      const target = latest.signers.find((s) => s.id === signer.id);
      if (!target) return;
      if (target.status === 'sent') {
        target.status = 'opened';
        target.openedAt = nowIso();
      }
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'opened',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      await this.repo.updateRequest(latest);
    });

    const assignedFields = req.fields.filter((f) => !f.signerId || f.signerId === signer.id);
    return {
      requestId: req.id,
      title: req.title,
      message: req.message,
      senderName: req.senderName,
      expiresAt: req.expiresAt,
      order: req.order,
      pageCount: req.pageCount,
      pagesMeta: req.pagesMeta,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        color: signer.color,
        status: signer.status
      },
      isYourTurn: turn.isYourTurn,
      waitingOn: turn.waitingOn,
      assignedFields: turn.isYourTurn ? assignedFields : []
    };
  }

  async getSignerPdfBytes(token: string, meta: RequestClientMeta = {}): Promise<{ bytes: Buffer; filename: string }> {
    const { req, signer } = await this.resolveActiveSignerByToken(token);
    const turn = this.computeWaitingOn(req, signer);
    if (!turn.isYourTurn) {
      throw new AppError(
        SIGN_ERROR_CODES.NOT_YOUR_TURN.status,
        SIGN_ERROR_CODES.NOT_YOUR_TURN.code,
        `Waiting for ${turn.waitingOn || 'previous signer'} to sign first.`
      );
    }

    const encrypted = await this.storage.getEncrypted(req.originalStorageKey);
    if (!encrypted) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Document is no longer available.');
    }

    await this.repo.withRequestLock(req.id, async (latest) => {
      if (!latest) return;
      const target = latest.signers.find((s) => s.id === signer.id);
      if (target && !target.viewedAt) target.viewedAt = nowIso();
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'viewed',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      await this.repo.updateRequest(latest);
    });

    return {
      bytes: decryptDocumentAtRest(encrypted),
      filename: req.originalFilename
    };
  }

  async completeSigner(
    token: string,
    body: {
      consentGiven?: boolean;
      completedFields?: Array<{
        fieldId: string;
        imageDataUrl?: string;
        text?: string;
        checked?: boolean;
      }>;
    },
    meta: RequestClientMeta = {}
  ): Promise<{ status: 'partial' | 'completed'; completedAt?: string; finalSha256?: string }> {
    if (!body?.consentGiven) {
      throw new AppError(
        SIGN_ERROR_CODES.INVALID_OPTIONS.status,
        SIGN_ERROR_CODES.INVALID_OPTIONS.code,
        'Consent to conduct business electronically is required.'
      );
    }

    const initial = await this.resolveActiveSignerByToken(token);

    return this.repo.withRequestLock(initial.req.id, async (latest) => {
      if (!latest) {
        throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Signing request not found.');
      }
      const signer = latest.signers.find((s) => s.id === initial.signer.id);
      if (!signer) {
        throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Signer not found.');
      }
      if (latest.status === 'cancelled' || latest.status === 'declined') {
        throw new AppError(SIGN_ERROR_CODES.REQUEST_CANCELLED.status, SIGN_ERROR_CODES.REQUEST_CANCELLED.code, 'This request is no longer active.');
      }
      if (latest.status === 'expired' || Date.now() >= Date.parse(latest.expiresAt)) {
        throw new AppError(SIGN_ERROR_CODES.REQUEST_EXPIRED.status, SIGN_ERROR_CODES.REQUEST_EXPIRED.code, 'This signing request has expired.');
      }
      if (latest.status === 'completed' || signer.status === 'signed') {
        throw new AppError(SIGN_ERROR_CODES.ALREADY_COMPLETED.status, SIGN_ERROR_CODES.ALREADY_COMPLETED.code, 'Signer has already completed this request.');
      }

      const turn = this.computeWaitingOn(latest, signer);
      if (!turn.isYourTurn) {
        throw new AppError(
          SIGN_ERROR_CODES.NOT_YOUR_TURN.status,
          SIGN_ERROR_CODES.NOT_YOUR_TURN.code,
          `It is not your turn yet; waiting on ${turn.waitingOn}.`
        );
      }

      // Apply submitted field values ONLY for fields belonging to this signer
      const submittedMap = new Map((body.completedFields || []).map((c) => [c.fieldId, c]));
      const signerFields = latest.fields.filter((f) => !f.signerId || f.signerId === signer.id);

      for (const f of signerFields) {
        const sub = submittedMap.get(f.id);
        if (sub) {
          if (sub.imageDataUrl !== undefined) f.imageDataUrl = sub.imageDataUrl;
          if (sub.text !== undefined) f.text = sub.text;
          if (sub.checked !== undefined) f.checked = sub.checked;
        }
        const isRequired = f.required ?? f.type === 'signature';
        if (isRequired) {
          const hasImage = (f.type === 'signature' || f.type === 'initials' || f.type === 'stamp') && Boolean(f.imageDataUrl);
          const hasText = (f.type === 'name' || f.type === 'date' || f.type === 'text') && Boolean(f.text?.trim());
          const hasCheck = f.type === 'checkbox' && Boolean(f.checked);
          if (!hasImage && !hasText && !hasCheck) {
            throw new AppError(
              SIGN_ERROR_CODES.INVALID_OPTIONS.status,
              SIGN_ERROR_CODES.INVALID_OPTIONS.code,
              `Required field "${f.id}" (${f.type}) must be completed before finishing.`
            );
          }
        }
      }

      const signedTime = nowIso();
      signer.status = 'signed';
      signer.signedAt = signedTime;
      signer.ip = meta.ip;
      signer.userAgent = meta.userAgent;
      // Single-use token: revoke signer token immediately on finish
      signer.tokenHash = null;

      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'consent_given',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'field_completed',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        detail: `Completed ${signerFields.length} assigned field(s)`
      });
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'signed',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        ip: meta.ip,
        userAgent: meta.userAgent
      });

      const allSigned = latest.signers.every((s) => s.status === 'signed');
      if (!allSigned) {
        // If sequential, issue token & send invite email to next pending signer in order
        if (latest.order === 'sequential') {
          const nextSigner = latest.signers.find((s) => s.status === 'pending');
          if (nextSigner) {
            const nextToken = generateToken256();
            nextSigner.status = 'sent';
            nextSigner.tokenHash = hashSecretToken(nextToken, 'signer-token');
            nextSigner.tokenExpiresAt = latest.expiresAt;
            const signingUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/sign/${nextToken}`;
            await this.email.send(
              buildSignerInviteEmail({
                toEmail: nextSigner.email,
                signerName: nextSigner.name,
                senderName: latest.senderName,
                senderEmail: latest.senderEmail,
                title: latest.title,
                message: latest.message,
                signingUrl,
                expiresAtIso: latest.expiresAt
              })
            );
            latest.auditLog = appendAuditEntry(latest.auditLog, {
              eventType: 'sent',
              requestId: latest.id,
              signerId: nextSigner.id,
              signerEmail: nextSigner.email,
              detail: 'Sequential advance notification sent'
            });
          }
        }
        await this.repo.updateRequest(latest);
        return { status: 'partial' };
      }

      // ALL SIGNERS COMPLETE: build final signed PDF + Certificate of Completion
      const encryptedOrig = await this.storage.getEncrypted(latest.originalStorageKey);
      if (!encryptedOrig) {
        throw new AppError(500, 'STORAGE_MISSING', 'Source encrypted document missing.');
      }
      const origPlain = decryptDocumentAtRest(encryptedOrig);

      const exported = await exportSignedPdf(origPlain, latest.fields, {
        fontResolver: loadServerFont,
        documentTitle: latest.title
      });

      const signedOnlySha256 = sha256Hex(exported.pdfBytes);
      const completedAtUtc = nowIso();

      const withCertBytes = await appendCertificateOfCompletionPage(exported.pdfBytes, {
        requestId: latest.id,
        title: latest.title,
        senderName: latest.senderName,
        senderEmail: latest.senderEmail,
        createdAtUtc: latest.createdAt,
        completedAtUtc,
        originalSha256: latest.originalSha256,
        finalSha256: signedOnlySha256,
        signers: latest.signers.map((s) => ({
          name: s.name,
          email: s.email,
          status: s.status,
          signedAtUtc: s.signedAt,
          ip: s.ip,
          userAgent: s.userAgent
        })),
        auditLog: latest.auditLog
      });

      const finalKey = `sign/${latest.id}/final.enc`;
      const encryptedFinal = encryptDocumentAtRest(withCertBytes);
      await this.storage.putEncrypted(finalKey, encryptedFinal);

      latest.status = 'completed';
      latest.completedAt = completedAtUtc;
      latest.finalStorageKey = finalKey;
      latest.finalSha256 = encryptedFinal.sha256;
      latest.retentionDeleteAt = new Date(Date.now() + COMPLETED_RETENTION_MS).toISOString();

      await this.repo.updateRequest(latest);
      this.scheduler.cancelAllForPrefix(`sign:${latest.id}:reminder`);
      this.scheduler.cancel(`sign:${latest.id}:expiry`);
      this.scheduleRetentionJob(latest);

      const downloadUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/api/v1/sign/requests/${latest.id}/final`;
      // Notify sender & all signers
      const recipients = [
        { email: latest.senderEmail, name: latest.senderName },
        ...latest.signers.map((s) => ({ email: s.email, name: s.name }))
      ];
      const seenEmails = new Set<string>();
      for (const r of recipients) {
        const lower = r.email.toLowerCase();
        if (seenEmails.has(lower)) continue;
        seenEmails.add(lower);
        await this.email.send(
          buildCompletionEmail({
            toEmail: lower,
            recipientName: r.name,
            title: latest.title,
            downloadUrl,
            finalSha256: encryptedFinal.sha256
          })
        );
      }

      return {
        status: 'completed',
        completedAt: completedAtUtc,
        finalSha256: encryptedFinal.sha256
      };
    });
  }

  async declineSigner(token: string, reason: string, meta: RequestClientMeta = {}): Promise<{ status: 'declined' }> {
    const cleanReason = (reason || 'Declined by recipient').trim().slice(0, 500);
    const initial = await this.resolveActiveSignerByToken(token);

    return this.repo.withRequestLock(initial.req.id, async (latest) => {
      if (!latest) throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Not found');
      const signer = latest.signers.find((s) => s.id === initial.signer.id);
      if (!signer) throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Signer not found');

      const ts = nowIso();
      signer.status = 'declined';
      signer.declinedAt = ts;
      signer.declineReason = cleanReason;
      signer.tokenHash = null;

      // Cancel all remaining signers immediately
      for (const s of latest.signers) {
        if (s.id !== signer.id && s.status !== 'signed') {
          s.status = 'cancelled';
          s.tokenHash = null;
        }
      }

      latest.status = 'declined';
      latest.declinedAt = ts;
      latest.retentionDeleteAt = new Date(Date.now() + INACTIVE_RETENTION_MS).toISOString();
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'declined',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
        detail: cleanReason
      });

      await this.repo.updateRequest(latest);
      this.scheduler.cancelAllForPrefix(`sign:${latest.id}:reminder`);
      this.scheduler.cancel(`sign:${latest.id}:expiry`);
      this.scheduleRetentionJob(latest);

      await this.email.send({
        to: latest.senderEmail,
        subject: `Declined: ${latest.title}`,
        text: `${signer.name} declined to sign "${latest.title}". Reason: ${cleanReason}`,
        html: `<p>${signer.name} declined to sign <strong>${latest.title}</strong>.</p><p>Reason: ${cleanReason}</p>`
      });

      return { status: 'declined' };
    });
  }

  /* =========================================================================
     SENDER MANAGEMENT: STATUS, RESEND / CHANGE EMAIL, CANCEL, DOWNLOADS
     ========================================================================= */

  private async verifySenderAccess(requestId: string, senderToken: string): Promise<SigningRequestRecord> {
    const req = await this.repo.getRequestById(requestId);
    if (!req) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Request not found.');
    }
    const providedHash = hashSecretToken((senderToken || '').trim(), 'sender-access');
    if (!constantTimeEqualHex(providedHash, req.senderAccessTokenHash)) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Unauthorized sender token.');
    }
    return req;
  }

  async getRequestStatus(requestId: string, senderToken: string) {
    const req = await this.verifySenderAccess(requestId, senderToken);
    return {
      requestId: req.id,
      title: req.title,
      status: req.status,
      order: req.order,
      createdAt: req.createdAt,
      expiresAt: req.expiresAt,
      completedAt: req.completedAt,
      cancelledAt: req.cancelledAt,
      declinedAt: req.declinedAt,
      originalSha256: req.originalSha256,
      finalSha256: req.finalSha256,
      auditChainValid: verifyAuditChain(req.auditLog),
      signers: req.signers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        orderIndex: s.orderIndex,
        status: s.status,
        openedAt: s.openedAt,
        signedAt: s.signedAt,
        declinedAt: s.declinedAt,
        declineReason: s.declineReason
      })),
      auditLog: req.auditLog
    };
  }

  async resendSigner(
    requestId: string,
    senderToken: string,
    signerId: string,
    newEmail?: string,
    options: { includeTestLink?: boolean } = {}
  ): Promise<{ resent: boolean; email: string; _testSigningUrl?: string }> {
    const auth = await this.verifySenderAccess(requestId, senderToken);

    return this.repo.withRequestLock(auth.id, async (latest) => {
      if (!latest) throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Request not found.');
      if (latest.status !== 'in_progress') {
        throw new AppError(SIGN_ERROR_CODES.ALREADY_COMPLETED.status, SIGN_ERROR_CODES.ALREADY_COMPLETED.code, 'Cannot resend completed/closed request.');
      }
      const signer = latest.signers.find((s) => s.id === signerId);
      if (!signer) {
        throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'Signer not found.');
      }
      if (signer.status === 'signed') {
        throw new AppError(SIGN_ERROR_CODES.ALREADY_COMPLETED.status, SIGN_ERROR_CODES.ALREADY_COMPLETED.code, 'Signer already signed.');
      }
      if (newEmail !== undefined) {
        const clean = newEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
          throw new AppError(SIGN_ERROR_CODES.INVALID_EMAIL.status, SIGN_ERROR_CODES.INVALID_EMAIL.code, 'Invalid replacement email.');
        }
        signer.email = clean;
      }

      // Revoke OLD token hash and issue NEW 256-bit token
      const rawToken = generateToken256();
      signer.tokenHash = hashSecretToken(rawToken, 'signer-token');
      signer.tokenExpiresAt = latest.expiresAt;
      if (signer.status === 'pending') signer.status = 'sent';

      const signingUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/sign/${rawToken}`;
      await this.email.send(
        buildSignerInviteEmail({
          toEmail: signer.email,
          signerName: signer.name,
          senderName: latest.senderName,
          senderEmail: latest.senderEmail,
          title: latest.title,
          message: latest.message,
          signingUrl,
          expiresAtIso: latest.expiresAt,
          isReminder: true
        })
      );

      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'resent',
        requestId: latest.id,
        signerId: signer.id,
        signerEmail: signer.email,
        detail: newEmail ? 'Email updated and new signing token issued (previous token revoked)' : 'New signing token issued (previous token revoked)'
      });
      await this.repo.updateRequest(latest);

      return {
        resent: true,
        email: signer.email,
        ...(options.includeTestLink ? { _testSigningUrl: signingUrl } : {})
      };
    });
  }

  async cancelRequest(requestId: string, senderToken: string, meta: RequestClientMeta = {}): Promise<{ status: 'cancelled' }> {
    const auth = await this.verifySenderAccess(requestId, senderToken);

    return this.repo.withRequestLock(auth.id, async (latest) => {
      if (!latest) throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Request not found.');
      if (latest.status === 'completed') {
        throw new AppError(SIGN_ERROR_CODES.ALREADY_COMPLETED.status, SIGN_ERROR_CODES.ALREADY_COMPLETED.code, 'Completed requests cannot be cancelled.');
      }

      latest.status = 'cancelled';
      latest.cancelledAt = nowIso();
      latest.retentionDeleteAt = new Date(Date.now() + INACTIVE_RETENTION_MS).toISOString();
      for (const s of latest.signers) {
        if (s.status !== 'signed') {
          s.status = 'cancelled';
          s.tokenHash = null;
        }
      }
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'cancelled',
        requestId: latest.id,
        ip: meta.ip,
        userAgent: meta.userAgent
      });
      await this.repo.updateRequest(latest);
      this.scheduler.cancelAllForPrefix(`sign:${latest.id}:reminder`);
      this.scheduler.cancel(`sign:${latest.id}:expiry`);
      this.scheduleRetentionJob(latest);
      return { status: 'cancelled' };
    });
  }

  async downloadFinalPdf(requestId: string, senderToken: string): Promise<{ bytes: Buffer; filename: string; sha256: string }> {
    const req = await this.verifySenderAccess(requestId, senderToken);
    if (req.status !== 'completed' || !req.finalStorageKey) {
      throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'Final signed document is not ready yet.');
    }
    const encrypted = await this.storage.getEncrypted(req.finalStorageKey);
    if (!encrypted) {
      throw new AppError(SIGN_ERROR_CODES.LINK_INVALID.status, SIGN_ERROR_CODES.LINK_INVALID.code, 'Document expired from retention storage.');
    }
    await this.repo.withRequestLock(req.id, async (latest) => {
      if (!latest) return;
      latest.auditLog = appendAuditEntry(latest.auditLog, {
        eventType: 'downloaded',
        requestId: latest.id
      });
      await this.repo.updateRequest(latest);
    });
    const cleanName = req.originalFilename.replace(/\.pdf$/i, '') + '-signed.pdf';
    return {
      bytes: decryptDocumentAtRest(encrypted),
      filename: cleanName,
      sha256: encrypted.sha256
    };
  }

  async downloadCertificatePdf(requestId: string, senderToken: string): Promise<{ bytes: Uint8Array; filename: string }> {
    const req = await this.verifySenderAccess(requestId, senderToken);
    const bytes = await appendCertificateOfCompletionPage(null, {
      requestId: req.id,
      title: req.title,
      senderName: req.senderName,
      senderEmail: req.senderEmail,
      createdAtUtc: req.createdAt,
      completedAtUtc: req.completedAt || nowIso(),
      originalSha256: req.originalSha256,
      finalSha256: req.finalSha256 || req.originalSha256,
      signers: req.signers.map((s) => ({
        name: s.name,
        email: s.email,
        status: s.status,
        signedAtUtc: s.signedAt,
        ip: s.ip,
        userAgent: s.userAgent
      })),
      auditLog: req.auditLog
    });
    return {
      bytes,
      filename: `${req.id}-certificate.pdf`
    };
  }

  /* =========================================================================
     GDPR RIGHT TO ERASURE / EXPORT + RETENTION & REMINDER JOBS
     ========================================================================= */

  async exportSenderData(senderEmail: string): Promise<Array<Omit<SigningRequestRecord, 'senderAccessTokenHash'>>> {
    const records = await this.repo.findBySenderEmail(senderEmail);
    return records.map(({ senderAccessTokenHash: _omit, ...rest }) => rest);
  }

  async hardDeleteRequest(requestId: string, senderToken: string): Promise<{ deleted: boolean }> {
    const req = await this.verifySenderAccess(requestId, senderToken);
    this.scheduler.cancelAllForPrefix(`sign:${req.id}`);
    await this.storage.delete(req.originalStorageKey);
    if (req.finalStorageKey) await this.storage.delete(req.finalStorageKey);
    await this.repo.deleteRequest(req.id);
    return { deleted: true };
  }

  async sendDueReminder(requestId: string): Promise<number> {
    return this.repo.withRequestLock(requestId, async (latest) => {
      if (!latest || latest.status !== 'in_progress' || !latest.remindersEnabled) return 0;
      let sent = 0;
      for (const s of latest.signers) {
        if ((s.status === 'sent' || s.status === 'opened') && s.tokenHash) {
          // Rotate fresh reminder token so link works seamlessly until expiry
          const freshToken = generateToken256();
          s.tokenHash = hashSecretToken(freshToken, 'signer-token');
          const url = `${this.publicBaseUrl.replace(/\/$/, '')}/sign/${freshToken}`;
          await this.email.send(
            buildSignerInviteEmail({
              toEmail: s.email,
              signerName: s.name,
              senderName: latest.senderName,
              senderEmail: latest.senderEmail,
              title: latest.title,
              message: latest.message,
              signingUrl: url,
              expiresAtIso: latest.expiresAt,
              isReminder: true
            })
          );
          sent++;
        }
      }
      if (sent > 0) {
        latest.reminderCount++;
        latest.lastReminderAt = nowIso();
        await this.repo.updateRequest(latest);
      }
      return sent;
    });
  }

  async runExpiryAndRetentionSweep(nowMs = Date.now()): Promise<{ expired: number; purged: number }> {
    const due = await this.repo.listDueForRetentionOrExpiry(nowMs);
    let expired = 0;
    let purged = 0;

    for (const item of due) {
      await this.repo.withRequestLock(item.id, async (latest) => {
        if (!latest) return;
        const expMs = Date.parse(latest.expiresAt);
        const retMs = Date.parse(latest.retentionDeleteAt);

        if (latest.status === 'in_progress' && nowMs >= expMs) {
          latest.status = 'expired';
          for (const s of latest.signers) {
            if (s.status !== 'signed') {
              s.status = 'expired';
              s.tokenHash = null;
            }
          }
          latest.auditLog = appendAuditEntry(latest.auditLog, {
            eventType: 'expired',
            requestId: latest.id
          });
          await this.repo.updateRequest(latest);
          expired++;
        }

        if (!latest.deletedAt && nowMs >= retMs) {
          await this.storage.delete(latest.originalStorageKey);
          if (latest.finalStorageKey) await this.storage.delete(latest.finalStorageKey);
          await this.repo.deleteRequest(latest.id);
          purged++;
        }
      });
    }

    return { expired, purged };
  }

  private scheduleLifecycleJobs(record: SigningRequestRecord): void {
    const createdMs = Date.parse(record.createdAt);
    const expiresMs = Date.parse(record.expiresAt);

    if (record.remindersEnabled) {
      const rem1 = createdMs + 3 * DAY_MS;
      if (rem1 < expiresMs) {
        this.scheduler.schedule(`sign:${record.id}:reminder:1`, rem1, () => this.sendDueReminder(record.id));
      }
      const rem2 = expiresMs - DAY_MS;
      if (rem2 > createdMs) {
        this.scheduler.schedule(`sign:${record.id}:reminder:2`, rem2, () => this.sendDueReminder(record.id));
      }
    }

    this.scheduler.schedule(`sign:${record.id}:expiry`, expiresMs, () => this.runExpiryAndRetentionSweep(Date.now()));
    this.scheduleRetentionJob(record);
  }

  private scheduleRetentionJob(record: SigningRequestRecord): void {
    const retMs = Date.parse(record.retentionDeleteAt);
    if (Number.isFinite(retMs)) {
      this.scheduler.schedule(`sign:${record.id}:retention`, retMs, () => this.runExpiryAndRetentionSweep(Date.now()));
    }
  }
}
