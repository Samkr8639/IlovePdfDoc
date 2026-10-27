import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '@paperflow/contracts';

/**
 * Standard handler for rate limit exceeded responses matching PaperFlow API contract
 */
const rateLimitHandler = (message: string) => {
  return (_req: Request, res: Response): void => {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
    res.status(429).json(response);
  };
};

/**
 * General API rate limiter: 300 requests per 15 minutes per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Too many requests from this IP address. Please try again after 15 minutes.')
});

/**
 * Conversion rate limiter for compute-heavy endpoints (PDF to Word, Compress):
 * 60 conversion requests per 15 minutes per IP.
 */
export const conversionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Conversion rate limit reached (60 conversions per 15 minutes). Please wait before submitting more conversion jobs.')
});

/**
 * Contact form rate limiter to prevent automated spam:
 * 5 submissions per 15 minutes per IP.
 */
export const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  handler: rateLimitHandler('Too many contact form submissions. Please wait 15 minutes before sending another inquiry.')
});
