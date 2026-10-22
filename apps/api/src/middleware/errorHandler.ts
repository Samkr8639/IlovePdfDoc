import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '@paperflow/contracts';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field?: string; issue: string }>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : err.message;

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(err instanceof AppError && err.details ? { details: err.details } : {})
    },
    meta: {
      requestId: (req.headers['x-request-id'] as string) || undefined,
      timestamp: new Date().toISOString()
    }
  };

  res.status(statusCode).json(response);
}
