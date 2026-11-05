/**
 * POST /api/v1/powerpoint-to-pdf/convert
 * GET  /api/v1/powerpoint-to-pdf/jobs/:jobId/download
 * GET  /api/v1/powerpoint-to-pdf/jobs/:jobId/download/:fileId
 * DELETE /api/v1/powerpoint-to-pdf/jobs/:jobId
 */

import * as path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import crypto from 'crypto';
import {
  PowerPointToPdfOptions,
  PowerPointToPdfResponse,
  PowerPointToPdfFileItem,
  powerpointToPdfOptionsSchema
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import {
  convertPowerPointToPdf,
  validatePowerPointFile,
  checkLibreOffice,
  formatBytes,
  mergePowerPointPdfOutputs
} from '../services/powerpoint-to-pdf';

export const powerpointToPdfRouter = Router();

// ──────────────────────────────────────────────────────────────
// Multer – memory storage, 100 MB per file, max 10 files
// ──────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = parseInt(process.env['PPT_MAX_FILE_MB'] || '100', 10) * 1024 * 1024;
const MAX_FILES = parseInt(process.env['PPT_MAX_FILES'] || '10', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES
  },
  fileFilter: (_req, file, cb) => {
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch {
      // keep original
    }
    cb(null, true);
  }
});

// ──────────────────────────────────────────────────────────────
// In-memory job store (10-minute ephemeral retention)
// ──────────────────────────────────────────────────────────────

interface PowerPointPdfOutputFile {
  id: string;
  originalFilename: string;
  pdfFilename: string;
  originalSize: number;
  pdfSize: number;
  slideCount: number;
  pageCount: number;
  buffer: Buffer;
  downloadUrl: string;
  fontsSubstituted: Array<{ requested: string; used: string }>;
  fontsMissing: string[];
}

interface PowerPointToPdfJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  files: PowerPointPdfOutputFile[];
  zipBuffer?: Buffer;
  mergedPdfBuffer?: Buffer;
  isMerged?: boolean;
  warnings: string[];
}

const jobStore = new Map<string, PowerPointToPdfJob>();
const JOB_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (job.expiresAt <= now) {
      jobStore.delete(id);
    }
  }
}

export function sanitizeDownloadFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9_\-\. \u00C0-\u024F\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF]/g, '_');
  return cleaned.trim() || 'converted-presentation.pdf';
}

function buildContentDisposition(filename: string): string {
  const safeAscii = filename.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  const encodedUtf8 = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
}

// ──────────────────────────────────────────────────────────────
// POST /convert
// ──────────────────────────────────────────────────────────────

powerpointToPdfRouter.post(
  '/convert',
  (req: Request, res: Response, next: NextFunction) => {
    upload.array('files', MAX_FILES)(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              `A file exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`
            )
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(
            new AppError(400, 'TOO_MANY_FILES', `Cannot upload more than ${MAX_FILES} presentations at once.`)
          );
        }
        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    pruneExpiredJobs();

    try {
      const { available } = await checkLibreOffice();
      if (!available) {
        throw new AppError(
          503,
          'ENGINE_UNAVAILABLE',
          'PowerPoint to PDF conversion engine (LibreOffice Impress) is unavailable on this server.'
        );
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one presentation file to convert.');
      }
      if (files.length > MAX_FILES) {
        throw new AppError(400, 'TOO_MANY_FILES', `Maximum ${MAX_FILES} presentation files per request.`);
      }

      // Parse and validate options
      let rawOptions: any = {};
      if (req.body.options) {
        try {
          rawOptions = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
        } catch {
          throw new AppError(400, 'INVALID_OPTIONS', 'Options must be a valid JSON string.');
        }
      } else {
        rawOptions = {
          output: req.body.output || 'pdf',
          layout: req.body.layout || 'slides',
          pageSize: req.body.pageSize || 'as_slide',
          comments: req.body.comments === 'true' || req.body.comments === true,
          bookmarks: req.body.bookmarks !== 'false' && req.body.bookmarks !== false,
          tagged: req.body.tagged !== 'false' && req.body.tagged !== false,
          hyperlinks: req.body.hyperlinks !== 'false' && req.body.hyperlinks !== false,
          imageQuality: req.body.imageQuality || 'standard',
          merge: req.body.merge === 'true' || req.body.merge === true
        };
      }

      const parsed = powerpointToPdfOptionsSchema.safeParse(rawOptions);
      if (!parsed.success) {
        throw new AppError(
          400,
          'INVALID_OPTIONS',
          `Invalid options: ${parsed.error.issues.map((i: any) => i.message).join(', ')}`
        );
      }
      const options: PowerPointToPdfOptions = parsed.data;

      // Validate custom slide range if provided
      if (options.slides?.mode === 'range' && options.slides?.range) {
        const rangeRegex = /^(\s*\d+(\s*-\s*\d+)?\s*,)*\s*\d+(\s*-\s*\d+)?\s*$/;
        if (!rangeRegex.test(options.slides.range)) {
          throw new AppError(
            400,
            'INVALID_SLIDE_RANGE',
            `Invalid slide range format: '${options.slides.range}'. Use format like '1-3,5,8-10'.`
          );
        }
      }

      // Pre-validation of all files before initiating LibreOffice
      for (const file of files) {
        await validatePowerPointFile(file.buffer, file.originalname);
      }

      const jobId = crypto.randomUUID();
      const outputFiles: PowerPointPdfOutputFile[] = [];
      const overallWarnings: string[] = [];

      const abortController = new AbortController();
      req.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      });

      // Sequential conversion through the pool
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = crypto.randomUUID();
        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const pdfFilename = `${sanitizeDownloadFilename(baseName)}.pdf`;

        const conv = await convertPowerPointToPdf(
          file.buffer,
          file.originalname,
          options,
          abortController.signal
        );

        outputFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          pdfFilename,
          originalSize: file.buffer.length,
          pdfSize: conv.pdfBuffer.length,
          slideCount: conv.slideCount,
          pageCount: conv.pageCount,
          buffer: conv.pdfBuffer,
          downloadUrl: `/api/v1/powerpoint-to-pdf/jobs/${jobId}/download/${fileId}`,
          fontsSubstituted: conv.fontsSubstituted,
          fontsMissing: conv.fontsMissing
        });

        for (const w of conv.warnings) {
          if (!overallWarnings.includes(w)) {
            overallWarnings.push(w);
          }
        }
      }

      let zipBuffer: Buffer | undefined;
      let mergedPdfBuffer: Buffer | undefined;
      const isMergeRequested = options.merge && outputFiles.length > 1;

      if (isMergeRequested) {
        const mergeRes = await mergePowerPointPdfOutputs(
          outputFiles.map((f) => f.buffer),
          files[0].originalname
        );
        mergedPdfBuffer = mergeRes.pdfBuffer;
      } else if (outputFiles.length > 1) {
        const zip = new JSZip();
        for (const out of outputFiles) {
          let entryName = out.pdfFilename;
          let counter = 1;
          while (zip.file(entryName)) {
            const ext = path.extname(out.pdfFilename);
            const base = out.pdfFilename.replace(/\.[^/.]+$/, '');
            entryName = `${base} (${counter})${ext}`;
            counter++;
          }
          zip.file(entryName, out.buffer);
        }
        zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }

      // Store in job store
      const job: PowerPointToPdfJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        files: outputFiles,
        zipBuffer,
        mergedPdfBuffer,
        isMerged: isMergeRequested,
        warnings: overallWarnings
      };
      jobStore.set(jobId, job);

      // Build response
      const firstBase = files[0].originalname.replace(/\.[^/.]+$/, '');
      const downloadFilename = isMergeRequested
        ? `${sanitizeDownloadFilename(firstBase)}_merged.pdf`
        : outputFiles.length > 1
        ? `${sanitizeDownloadFilename(firstBase)}_converted.zip`
        : outputFiles[0].pdfFilename;

      const totalSize = isMergeRequested
        ? mergedPdfBuffer!.length
        : zipBuffer
        ? zipBuffer.length
        : outputFiles[0].pdfSize;

      const fileItems: PowerPointToPdfFileItem[] = outputFiles.map((f) => ({
        id: f.id,
        inputName: f.originalFilename,
        outputName: f.pdfFilename,
        slideCount: f.slideCount,
        pageCount: f.pageCount,
        sizeBytes: f.pdfSize,
        originalSizeBytes: f.originalSize,
        formattedOriginalSize: formatBytes(f.originalSize),
        formattedPdfSize: formatBytes(f.pdfSize),
        downloadUrl: f.downloadUrl,
        fontsSubstituted: f.fontsSubstituted,
        fontsMissing: f.fontsMissing
      }));

      const responsePayload: PowerPointToPdfResponse = {
        jobId,
        status: 'completed',
        isZip: !isMergeRequested && outputFiles.length > 1,
        downloadUrl: `/api/v1/powerpoint-to-pdf/jobs/${jobId}/download`,
        filename: downloadFilename,
        sizeBytes: totalSize,
        files: fileItems,
        warnings: overallWarnings
      };

      res.status(200).json({
        success: true,
        data: responsePayload,
        meta: {
          requestId: jobId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return next(err);
      }
      next(
        new AppError(
          422,
          'CONVERSION_FAILED',
          err.message || 'PowerPoint to PDF conversion failed. Please verify your file and try again.'
        )
      );
    }
  }
);

// ──────────────────────────────────────────────────────────────
// GET /jobs/:jobId/download
// ──────────────────────────────────────────────────────────────

powerpointToPdfRouter.get('/jobs/:jobId/download', (req: Request, res: Response, next: NextFunction) => {
  pruneExpiredJobs();
  const job = jobStore.get(req.params.jobId);
  if (!job) {
    return next(new AppError(404, 'DOWNLOAD_EXPIRED', 'The conversion job has expired or does not exist.'));
  }

  const firstBase = job.files[0]?.originalFilename.replace(/\.[^/.]+$/, '') || 'presentation';

  if (job.isMerged && job.mergedPdfBuffer) {
    const filename = `${sanitizeDownloadFilename(firstBase)}_merged.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition(filename));
    res.setHeader('Content-Length', job.mergedPdfBuffer.length);
    res.send(job.mergedPdfBuffer);
    jobStore.delete(job.id); // Delete on download
    return;
  }

  if (job.files.length === 1) {
    const file = job.files[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition(file.pdfFilename));
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
    jobStore.delete(job.id); // Delete on download
    return;
  }

  if (job.zipBuffer) {
    const filename = `${sanitizeDownloadFilename(firstBase)}_converted.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', buildContentDisposition(filename));
    res.setHeader('Content-Length', job.zipBuffer.length);
    res.send(job.zipBuffer);
    jobStore.delete(job.id); // Delete on download
    return;
  }

  return next(new AppError(404, 'DOWNLOAD_NOT_FOUND', 'Output file not found.'));
});

// ──────────────────────────────────────────────────────────────
// GET /jobs/:jobId/download/:fileId (Single file from batch)
// ──────────────────────────────────────────────────────────────

powerpointToPdfRouter.get('/jobs/:jobId/download/:fileId', (req: Request, res: Response, next: NextFunction) => {
  pruneExpiredJobs();
  const job = jobStore.get(req.params.jobId);
  if (!job) {
    return next(new AppError(404, 'DOWNLOAD_EXPIRED', 'The conversion job has expired or does not exist.'));
  }

  const file = job.files.find((f) => f.id === req.params.fileId);
  if (!file) {
    return next(new AppError(404, 'FILE_NOT_FOUND', 'Requested file was not found in this job.'));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', buildContentDisposition(file.pdfFilename));
  res.setHeader('Content-Length', file.buffer.length);
  res.send(file.buffer);
});

// ──────────────────────────────────────────────────────────────
// DELETE /jobs/:jobId
// ──────────────────────────────────────────────────────────────

powerpointToPdfRouter.delete('/jobs/:jobId', (req: Request, res: Response) => {
  jobStore.delete(req.params.jobId);
  res.status(200).json({ success: true, message: 'Job cleared successfully.' });
});
