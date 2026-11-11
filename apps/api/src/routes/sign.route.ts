import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { ApiErrorResponse, SIGN_ERROR_CODES, SIGN_PDF_LIMITS } from '@paperflow/contracts';
import { isSignRequestsEnabled } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { constantTimeEqualHex, generateToken256 } from '../services/sign/crypto';
import {
  InMemoryDocumentStorage,
  InMemoryEmailService,
  InMemoryScheduler,
  InMemorySigningRequestRepository
} from '../services/sign/in-memory';
import { SignWorkflowService } from '../services/sign/sign-workflow.service';

// Default singleton runtime stores (cleanly resettable / replaceable in Jest tests)
export const signRepo = new InMemorySigningRequestRepository();
export const signStorage = new InMemoryDocumentStorage();
export const signEmail = new InMemoryEmailService();
export const signScheduler = new InMemoryScheduler();
export const signWorkflow = new SignWorkflowService(signRepo, signStorage, signEmail, signScheduler);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SIGN_PDF_LIMITS.serverMaxFileSizeBytes,
    files: 1
  }
});

function rateLimitJson(code: string, message: string) {
  return (_req: Request, res: Response): void => {
    const body: ApiErrorResponse = {
      success: false,
      error: { code, message },
      meta: { timestamp: new Date().toISOString() }
    };
    res.status(429).json(body);
  };
}

export const signOtpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: (req) => (req.headers['x-test-rate-limit'] ? 2 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitJson(SIGN_ERROR_CODES.RATE_LIMITED.code, 'Too many OTP requests. Try again later.')
});

export const signCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: (req) => (req.headers['x-test-rate-limit'] ? 2 : 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitJson(SIGN_ERROR_CODES.RATE_LIMITED.code, 'Too many signature requests created. Wait before retrying.')
});

export const signTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: (req) => (req.headers['x-test-rate-limit'] ? 3 : 60),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitJson(SIGN_ERROR_CODES.RATE_LIMITED.code, 'Too many requests to signing link.')
});

function parseCookies(header?: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out.set(k, decodeURIComponent(v));
  }
  return out;
}

/**
 * Kills all Phase 2 endpoints unless SIGN_REQUESTS_ENABLED=true.
 */
function requireSignRequestsEnabled(_req: Request, _res: Response, next: NextFunction): void {
  if (!isSignRequestsEnabled()) {
    next(new AppError(503, 'FEATURE_DISABLED', 'Multi-party signature requests are currently disabled.'));
    return;
  }
  next();
}

/**
 * Double-submit CSRF guard: enforced whenever `pt_csrf` cookie or Origin browser header is present.
 * Browser clients obtain the token from GET /api/v1/sign/csrf first.
 */
function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies.get('pt_csrf');
  const headerToken = typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : '';

  if (cookieToken || req.headers.origin) {
    const aHex = Buffer.from(cookieToken || '').toString('hex');
    const bHex = Buffer.from(headerToken || '').toString('hex');
    if (!aHex || !constantTimeEqualHex(aHex, bHex)) {
      next(new AppError(403, 'CSRF_INVALID', 'Invalid or missing CSRF verification token.'));
      return;
    }
  }
  next();
}

function getClientMeta(req: Request) {
  return {
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 200) : 'unknown'
  };
}

function getSenderToken(req: Request): string {
  const header = req.headers['x-sender-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof req.query?.senderToken === 'string') return req.query.senderToken.trim();
  return '';
}

export const signRouter = Router();

signRouter.use(requireSignRequestsEnabled);

/** Issue CSRF double-submit token cookie + JSON copy. */
signRouter.get('/csrf', (_req: Request, res: Response) => {
  const csrfToken = generateToken256();
  res.cookie('pt_csrf', csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  res.json({
    success: true,
    data: { csrfToken },
    meta: { timestamp: new Date().toISOString() }
  });
});

/** Sender email OTP start & verify. */
signRouter.post('/sender/verify-start', signOtpRateLimiter, csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await signWorkflow.startSenderOtp(req.body?.email);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.post('/sender/verify-confirm', signOtpRateLimiter, csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await signWorkflow.verifySenderOtp(req.body?.email, req.body?.code);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/** Create & dispatch signature request (multipart `file` + JSON `payload`). */
signRouter.post(
  '/requests',
  signCreateRateLimiter,
  csrfProtection,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'PDF file upload is required.');
      }

      let rawPayload = req.body?.payload;
      if (typeof rawPayload === 'string') {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch {
          throw new AppError(SIGN_ERROR_CODES.INVALID_OPTIONS.status, SIGN_ERROR_CODES.INVALID_OPTIONS.code, 'Malformed JSON payload.');
        }
      }

      const requireOtp = req.headers['x-require-sender-otp'] === 'true' || process.env.SIGN_REQUIRE_SENDER_OTP === 'true';
      const result = await signWorkflow.createAndSendRequest(
        req.file.buffer,
        req.file.originalname,
        rawPayload,
        getClientMeta(req),
        { requireVerifiedSenderOtp: requireOtp }
      );

      res.status(201).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  }
);

/** Sender status, resend/change email, cancel, final PDF, Certificate, GDPR export/delete. */
signRouter.get('/requests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.getRequestStatus(String(req.params.id), getSenderToken(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.post('/requests/:id/resend', csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.resendSigner(
      String(req.params.id),
      getSenderToken(req),
      String(req.body?.signerId || ''),
      req.body?.newEmail
    );
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.delete('/requests/:id', csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.cancelRequest(String(req.params.id), getSenderToken(req), getClientMeta(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.get('/requests/:id/final', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await signWorkflow.downloadFinalPdf(String(req.params.id), getSenderToken(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.bytes);
  } catch (err) {
    next(err);
  }
});

signRouter.get('/requests/:id/certificate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cert = await signWorkflow.downloadCertificatePdf(String(req.params.id), getSenderToken(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.filename.replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(cert.bytes));
  } catch (err) {
    next(err);
  }
});

signRouter.post('/gdpr/export', csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError(SIGN_ERROR_CODES.INVALID_EMAIL.status, SIGN_ERROR_CODES.INVALID_EMAIL.code, 'Email is required.');
    }
    const items = await signWorkflow.exportSenderData(email);
    res.json({ success: true, data: { items }, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.delete('/gdpr/requests/:id', csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.hardDeleteRequest(String(req.params.id), getSenderToken(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/** Signer session & actions (token in URL path, brute-force rate limited). */
signRouter.get('/t/:token', signTokenRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    const data = await signWorkflow.getSignerSession(String(req.params.token), getClientMeta(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.get('/t/:token/document', signTokenRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    const doc = await signWorkflow.getSignerPdfBytes(String(req.params.token), getClientMeta(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename.replace(/"/g, '')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.bytes);
  } catch (err) {
    next(err);
  }
});

signRouter.post('/t/:token/complete', signTokenRateLimiter, csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.completeSigner(String(req.params.token), req.body, getClientMeta(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

signRouter.post('/t/:token/decline', signTokenRateLimiter, csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await signWorkflow.declineSigner(String(req.params.token), req.body?.reason, getClientMeta(req));
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});
