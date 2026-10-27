import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Middleware that gates OCR conversion requests behind a premium requirement
 * and environment flag (OCR_ENABLED, default false in production).
 */
export function requirePremiumForOcr(req: Request, _res: Response, next: NextFunction): void {
  const mode = req.body?.mode;
  if (mode === 'ocr') {
    const ocrEnabledEnv = process.env.OCR_ENABLED === 'true';
    const hasPremiumAuth = Boolean(req.headers['authorization'] || req.headers['x-premium-token']);

    // Allow in test/dev if OCR_ENABLED is explicitly true or default dev/test, but if OCR_ENABLED is false in prod or no premium
    if (process.env.NODE_ENV === 'production' && !ocrEnabledEnv && !hasPremiumAuth) {
      throw new AppError(
        403,
        'PREMIUM_REQUIRED',
        'OCR conversion is a Premium feature. Please upgrade to a Premium account or use standard No-OCR conversion mode.'
      );
    }

    if (process.env.OCR_ENABLED === 'false' && !hasPremiumAuth) {
      throw new AppError(
        403,
        'PREMIUM_REQUIRED',
        'OCR conversion is a Premium feature. Please upgrade to a Premium account or use standard No-OCR conversion mode.'
      );
    }
  }

  next();
}
