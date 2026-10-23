import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.route';
import { toolsRouter } from './routes/tools.route';
import { contactRouter } from './routes/contact.route';
import { compressRouter } from './routes/compress.route';
import { pdfToWordRouter } from './routes/pdf-to-word.route';
import { errorHandler, AppError } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/tools', toolsRouter);
  app.use('/api/v1/contact', contactRouter);
  app.use('/api/v1/compress', compressRouter);
  app.use('/api/v1/pdf-to-word', pdfToWordRouter);

  // 404 Route Catch-all
  app.use('*', (req: Request, _res: Response, next) => {
    next(new AppError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found`));
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
