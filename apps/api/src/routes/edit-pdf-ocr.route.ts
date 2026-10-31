import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import {
  EditPdfOcrOptionsSchema,
  EditPdfOcrResult,
  SUPPORTED_OCR_LANGUAGES,
  ApiResponse
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import {
  executePdfOcrJob,
  OCR_CONCURRENCY
} from '../services/ocr/edit-pdf-ocr.engine';

export const editPdfOcrRouter = Router();

export const OCR_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const OCR_MAX_PAGES = 20; // 20 pages max per OCR job
export const JOB_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: OCR_MAX_FILE_SIZE,
    files: 1
  }
});

export interface OcrJobItem {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: number;
  page?: number;
  pages?: number;
  error?: string;
  result?: EditPdfOcrResult;
  abortController: AbortController;
}

export const ocrJobStore = new Map<string, OcrJobItem>();
let activeRunningJobs = 0;

export function pruneExpiredOcrJobs(): void {
  const now = Date.now();
  for (const [id, job] of ocrJobStore.entries()) {
    if (job.expiresAt <= now) {
      if (job.status === 'running') {
        job.abortController.abort();
      }
      ocrJobStore.delete(id);
    }
  }
}

// Periodic cleanup every 2 minutes
setInterval(pruneExpiredOcrJobs, 2 * 60 * 1000).unref?.();

/**
 * Validates the uploaded PDF buffer
 */
export async function validateOcrPdf(buffer: Buffer, originalname: string): Promise<number> {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The uploaded file '${originalname}' is empty.`);
  }

  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE',
      `File '${originalname}' is not a valid PDF document. Only PDF documents are supported.`
    );
  }

  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const count = doc.getPageCount();
    if (count === 0) {
      throw new AppError(400, 'EMPTY_PDF', `The PDF '${originalname}' contains no pages.`);
    }
    if (count > OCR_MAX_PAGES) {
      throw new AppError(
        413,
        'TOO_MANY_PAGES',
        `Document contains ${count} pages, which exceeds the maximum limit of ${OCR_MAX_PAGES} pages for OCR processing.`
      );
    }
    return count;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = String(err).toLowerCase();
    if (msg.includes('encrypt') || msg.includes('password')) {
      throw new AppError(
        422,
        'ENCRYPTED_PDF',
        'Password-protected or encrypted PDFs are not supported. Please remove the password and try again.'
      );
    }
    throw new AppError(
      422,
      'OCR_FAILED',
      'The PDF document structure is corrupted or could not be parsed.'
    );
  }
}

/**
 * GET /api/v1/edit-pdf/ocr/languages
 * Discovers the list of supported and installed OCR languages
 */
editPdfOcrRouter.get('/languages', (_req: Request, res: Response) => {
  const response: ApiResponse<typeof SUPPORTED_OCR_LANGUAGES> = {
    success: true,
    data: SUPPORTED_OCR_LANGUAGES
  };
  res.json(response);
});

/**
 * POST /api/v1/edit-pdf/ocr
 * Starts an asynchronous OCR recognition job on the uploaded PDF page subset
 */
editPdfOcrRouter.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      pruneExpiredOcrJobs();

      // Check kill-switch
      if (process.env.OCR_ENABLED === 'false') {
        throw new AppError(
          503,
          'FEATURE_DISABLED',
          'OCR text recognition is currently disabled by administrator configuration.'
        );
      }

      const file = req.file;
      if (!file) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'No PDF file was uploaded for OCR processing.');
      }

      // Check server concurrency & queue load
      if (activeRunningJobs >= OCR_CONCURRENCY && ocrJobStore.size >= OCR_CONCURRENCY * 4) {
        res.setHeader('Retry-After', '30');
        throw new AppError(
          503,
          'SERVER_BUSY',
          'The OCR processing server is currently at maximum capacity. Please retry in 30 seconds.'
        );
      }

      // Parse options
      let rawOptions = req.body.options;
      if (typeof rawOptions === 'string') {
        try {
          rawOptions = JSON.parse(rawOptions);
        } catch {
          throw new AppError(400, 'INVALID_OPTIONS', 'Options field must be a valid JSON object.');
        }
      } else if (!rawOptions) {
        rawOptions = {
          languages: req.body.languages
            ? Array.isArray(req.body.languages)
              ? req.body.languages
              : [req.body.languages]
            : ['eng'],
          pages: req.body.pages || 'all',
          deskew: req.body.deskew === undefined ? true : req.body.deskew === 'true' || req.body.deskew === true,
          mode: req.body.mode || 'searchable'
        };
      }

      const parsedOptions = EditPdfOcrOptionsSchema.safeParse(rawOptions);
      if (!parsedOptions.success) {
        throw new AppError(
          400,
          'INVALID_OPTIONS',
          parsedOptions.error.issues.map(i => i.message).join('; ')
        );
      }
      const options = parsedOptions.data;

      // Validate language allow-list
      const supportedCodes = new Set(SUPPORTED_OCR_LANGUAGES.map(l => l.code));
      for (const lang of options.languages) {
        if (!supportedCodes.has(lang)) {
          throw new AppError(
            400,
            'UNSUPPORTED_LANGUAGE',
            `Language '${lang}' is not supported. Supported codes: ${Array.from(supportedCodes).join(', ')}`
          );
        }
      }

      // Validate PDF buffer
      const pageCount = await validateOcrPdf(file.buffer, file.originalname);

      const jobId = crypto.randomUUID();
      const abortController = new AbortController();

      const job: OcrJobItem = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'queued',
        progress: 0,
        page: 1,
        pages: pageCount,
        abortController
      };

      ocrJobStore.set(jobId, job);

      // Start background processing
      activeRunningJobs++;
      (async () => {
        job.status = 'running';
        try {
          const result = await executePdfOcrJob(
            file.buffer,
            options,
            jobId,
            (progress, page, pages) => {
              job.progress = progress;
              job.page = page;
              job.pages = pages;
            },
            abortController.signal
          );
          job.status = 'done';
          job.progress = 100;
          job.result = result;
        } catch (err: unknown) {
          if (abortController.signal.aborted) {
            job.status = 'cancelled';
            job.error = 'OCR processing was cancelled';
          } else {
            job.status = 'failed';
            job.error = 'OCR processing failed for this document';
          }
        } finally {
          activeRunningJobs = Math.max(0, activeRunningJobs - 1);
        }
      })();

      res.status(202).json({
        success: true,
        data: {
          jobId
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/edit-pdf/ocr/jobs/:id
 * Polls the processing status of an active OCR job
 */
editPdfOcrRouter.get('/jobs/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    pruneExpiredOcrJobs();
    const jobId = req.params.id;
    const job = ocrJobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `OCR job with ID '${jobId}' was not found or has expired.`);
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        state: job.status,
        progress: job.progress,
        page: job.page,
        pages: job.pages,
        error: job.error
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/edit-pdf/ocr/jobs/:id/result
 * Fetches the structured OCR lines and word coordinates, auto-deleting on download for privacy
 */
editPdfOcrRouter.get('/jobs/:id/result', (req: Request, res: Response, next: NextFunction): void => {
  try {
    pruneExpiredOcrJobs();
    const jobId = req.params.id;
    const job = ocrJobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `OCR job with ID '${jobId}' was not found or has expired.`);
    }

    if (job.status === 'failed') {
      throw new AppError(422, 'OCR_FAILED', job.error || 'OCR processing failed for this document.');
    }

    if (job.status !== 'done' || !job.result) {
      throw new AppError(400, 'JOB_NOT_READY', 'OCR job processing is not completed yet.');
    }

    const result = job.result;

    // Ephemeral deletion: delete after first successful retrieval to ensure zero retention
    ocrJobStore.delete(jobId);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/edit-pdf/ocr/jobs/:id
 * Cancels a running job and immediately purges all associated data
 */
editPdfOcrRouter.delete('/jobs/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const jobId = req.params.id;
    const job = ocrJobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `OCR job with ID '${jobId}' was not found.`);
    }

    job.abortController.abort();
    job.status = 'cancelled';
    ocrJobStore.delete(jobId);

    res.json({
      success: true,
      message: 'OCR job cancelled and purged successfully.'
    });
  } catch (err) {
    next(err);
  }
});
