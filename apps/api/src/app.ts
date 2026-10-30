import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.route';
import { toolsRouter } from './routes/tools.route';
import { contactRouter } from './routes/contact.route';
import { compressRouter } from './routes/compress.route';
import { pdfToWordRouter } from './routes/pdf-to-word.route';
import { pdfToPowerPointRouter } from './routes/pdf-to-powerpoint.route';
import { pdfToExcelRouter } from './routes/pdf-to-excel.route';
import { wordToPdfRouter } from './routes/word-to-pdf.route';
import { errorHandler, AppError } from './middleware/errorHandler';
import { apiRateLimiter, conversionRateLimiter, contactRateLimiter } from './middleware/rateLimiter';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          frameSrc: ["'self'", 'blob:'],
          objectSrc: ["'self'", 'blob:']
        }
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Interactive Swagger UI & OpenAPI Specification
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Global API Rate Limiter
  app.use('/api/v1', apiRateLimiter);

  // API Routes with specific rate limits
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/tools', toolsRouter);
  app.use('/api/v1/contact', contactRateLimiter, contactRouter);
  app.use('/api/v1/compress', conversionRateLimiter, compressRouter);
  app.use('/api/v1/pdf-to-word', conversionRateLimiter, pdfToWordRouter);
  app.use('/api/v1/pdf-to-powerpoint', conversionRateLimiter, pdfToPowerPointRouter);
  app.use('/api/v1/pdf-to-excel', conversionRateLimiter, pdfToExcelRouter);
  app.use('/api/v1/word-to-pdf', conversionRateLimiter, wordToPdfRouter);

  // 404 Route Catch-all
  app.use('*', (req: Request, _res: Response, next) => {
    next(new AppError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found`));
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
