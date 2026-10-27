import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
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
  // Handle Multer upload errors gracefully
  if (err instanceof MulterError || (err && (err as any).name === 'MulterError')) {
    const multerErr = err as MulterError;
    let statusCode = 400;
    let code: string = multerErr.code || 'UPLOAD_ERROR';
    let message = multerErr.message;

    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      code = 'FILE_TOO_LARGE';
      message = 'One or more files exceed the maximum allowed file size limit (50MB).';
    } else if (multerErr.code === 'LIMIT_FILE_COUNT') {
      statusCode = 400;
      code = 'TOO_MANY_FILES';
      message = 'Too many files uploaded. A maximum of 10 files is allowed per conversion job.';
    } else if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
      statusCode = 400;
      code = 'UNEXPECTED_FIELD';
      message = `Unexpected file field '${multerErr.field}'.`;
    }

    const response: ApiErrorResponse = {
      success: false,
      error: { code, message },
      meta: {
        requestId: (req.headers['x-request-id'] as string) || undefined,
        timestamp: new Date().toISOString()
      }
    };
    res.status(statusCode).json(response);
    return;
  }

  const isAppError = err instanceof AppError || (err && typeof (err as any).statusCode === 'number');
  const statusCode = isAppError ? (err as AppError).statusCode : 500;
  const errorCode = isAppError ? ((err as AppError).code || 'INTERNAL_SERVER_ERROR') : 'INTERNAL_SERVER_ERROR';
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
