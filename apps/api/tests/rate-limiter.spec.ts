import request from 'supertest';
import express, { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiErrorResponse } from '@paperflow/contracts';

describe('Rate Limiter Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res): void => {
        const response: ApiErrorResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please wait a few minutes before trying again.'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
        res.status(429).json(response);
      }
    });

    app.get('/test-limit', testLimiter, (_req, res) => {
      res.status(200).json({ success: true, data: 'ok' });
    });
  });

  it('should allow requests within the rate limit threshold', async () => {
    const res1 = await request(app).get('/test-limit');
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    const res2 = await request(app).get('/test-limit');
    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
  });

  it('should return HTTP 429 RATE_LIMIT_EXCEEDED when threshold is exceeded', async () => {
    await request(app).get('/test-limit');
    await request(app).get('/test-limit');

    const res3 = await request(app).get('/test-limit');
    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res3.body.error.message).toContain('Too many requests');
    expect(res3.body.meta).toHaveProperty('timestamp');
  });
});
