/**
 * POST /api/v1/word-to-pdf/convert
 * GET  /api/v1/word-to-pdf/jobs/:jobId/download
 * DELETE /api/v1/word-to-pdf/jobs/:jobId
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import crypto from 'crypto';
import {
  WordToPdfOptions,
  WordToPdfJobResponse,
  ConvertedPdfFileItem
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import {
  convertWordToPdf,
  validateWordFile,
  checkLibreOffice,
  formatBytes
} from '../services/word-to-pdf';

export const wordToPdfRouter = Router();

// ──────────────────────────────────────────────────────────────
// Multer – memory storage, 50 MB per file, max 10 files
// ──────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    // Decode Latin-1 filename (Multer parses multipart headers as Latin-1)
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

// ──────────────────────────────────────────────────────────────
// In-memory job store (10-minute ephemeral retention)
// ──────────────────────────────────────────────────────────────

interface PdfOutputFile {
  id: string;
  originalFilename: string;
  pdfFilename: string;
  originalSize: number;
  pdfSize: number;
  pageCount: number;
  buffer: Buffer;
  downloadUrl: string;
  fontsSubstituted: string[];
}

interface WordToPdfJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  files: PdfOutputFile[];
  zipBuffer?: Buffer;
  warnings: string[];
}

const jobStore = new Map<string, WordToPdfJob>();
const JOB_RETENTION_MS = 10 * 60 * 1000;

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (job.expiresAt <= now) {
      jobStore.delete(id);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/word-to-pdf/convert
// ──────────────────────────────────────────────────────────────

wordToPdfRouter.post(
  '/convert',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one Word document to convert.');
      }

      if (files.length > 10) {
        throw new AppError(400, 'TOO_MANY_FILES', 'Maximum 10 files per conversion.');
      }

      // Parse options from JSON body field or form fields
      let options: WordToPdfOptions = {};
      try {
        const raw = req.body.options;
        if (raw) {
          options = JSON.parse(raw) as WordToPdfOptions;
        } else {
          options = {
            output: (req.body.output as 'pdf' | 'pdfa') || 'pdf',
            imageQuality: (req.body.imageQuality as 'standard' | 'smaller') || 'standard',
            embedBookmarks: req.body.embedBookmarks !== 'false',
            useTaggedPdf: req.body.useTaggedPdf === 'true',
            exportHyperlinks: req.body.exportHyperlinks !== 'false'
          };
        }
      } catch {
        throw new AppError(400, 'INVALID_OPTIONS', 'Invalid conversion options.');
      }

      // Validate each uploaded file first before checking engine
      for (const file of files) {
        validateWordFile(file.buffer, file.originalname, file.mimetype);
      }

      // Check engine availability
      const { available } = await checkLibreOffice();
      if (!available) {
        throw new AppError(503, 'ENGINE_UNAVAILABLE', 'PDF conversion engine is not available. Please try again later.');
      }

      const jobId = crypto.randomUUID();
      const outputFiles: PdfOutputFile[] = [];
      const jobWarnings: string[] = [];

      for (const file of files) {
        let convResult;
        try {
          convResult = await convertWordToPdf(file.buffer, file.originalname, {
            output: options.output || 'pdf',
            imageQuality: options.imageQuality || 'standard',
            embedBookmarks: options.embedBookmarks !== false,
            useTaggedPdf: options.useTaggedPdf === true,
            exportHyperlinks: options.exportHyperlinks !== false
          });
        } catch (err: unknown) {
          const e = err as { code?: string; status?: number; message?: string };
          const code = e.code || 'CONVERSION_FAILED';
          const status = e.status || 422;
          throw new AppError(status, code, e.message || `Failed to convert '${file.originalname}'.`);
        }

        if (convResult.warnings.length > 0) {
          jobWarnings.push(...convResult.warnings.map(w => `${file.originalname}: ${w}`));
        }

        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const pdfFilename = `${baseName}.pdf`;
        const fileId = crypto.randomUUID();

        outputFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          pdfFilename,
          originalSize: file.size,
          pdfSize: convResult.pdfBuffer.length,
          pageCount: convResult.pageCount,
          buffer: convResult.pdfBuffer,
          downloadUrl: `/api/v1/word-to-pdf/jobs/${jobId}/download/${fileId}`,
          fontsSubstituted: convResult.fontsSubstituted
        });
      }

      // Build ZIP for multi-file results
      let zipBuffer: Buffer | undefined;
      if (outputFiles.length > 1) {
        const zip = new JSZip();
        for (const item of outputFiles) {
          zip.file(item.pdfFilename, item.buffer);
        }
        zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }

      const job: WordToPdfJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        files: outputFiles,
        zipBuffer,
        warnings: jobWarnings
      };
      jobStore.set(jobId, job);

      const responseFiles: ConvertedPdfFileItem[] = outputFiles.map(f => ({
        id: f.id,
        originalFilename: f.originalFilename,
        pdfFilename: f.pdfFilename,
        originalSizeBytes: f.originalSize,
        pdfSizeBytes: f.pdfSize,
        formattedOriginalSize: formatBytes(f.originalSize),
        formattedPdfSize: formatBytes(f.pdfSize),
        pageCount: f.pageCount,
        downloadUrl:
          outputFiles.length === 1
            ? `/api/v1/word-to-pdf/jobs/${jobId}/download`
            : f.downloadUrl,
        fontsSubstituted: f.fontsSubstituted
      }));

      const responseData: WordToPdfJobResponse = {
        id: jobId,
        status: 'completed',
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        totalFiles: outputFiles.length,
        files: responseFiles,
        isZip: outputFiles.length > 1,
        zipDownloadUrl:
          outputFiles.length > 1
            ? `/api/v1/word-to-pdf/jobs/${jobId}/download`
            : undefined,
        warnings: jobWarnings
      };

      res.status(200).json({
        success: true,
        data: responseData,
        meta: {
          requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// GET /api/v1/word-to-pdf/jobs/:jobId/download   (single or ZIP)
// GET /api/v1/word-to-pdf/jobs/:jobId/download/:fileId
// ──────────────────────────────────────────────────────────────

wordToPdfRouter.get(
  '/jobs/:jobId/download',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();
      const { jobId } = req.params;
      const job = jobStore.get(jobId);

      if (!job) {
        throw new AppError(404, 'DOWNLOAD_EXPIRED', 'Download link has expired. Please convert again.');
      }

      if (job.files.length === 1) {
        const file = job.files[0];
        const encoded = encodeURIComponent(file.pdfFilename);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
        );
        res.setHeader('Content-Length', file.buffer.length);
        return res.status(200).send(file.buffer);
      }

      if (job.zipBuffer) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="converted_pdfs.zip"');
        res.setHeader('Content-Length', job.zipBuffer.length);
        return res.status(200).send(job.zipBuffer);
      }

      throw new AppError(500, 'DOWNLOAD_ERROR', 'File not available for download.');
    } catch (err) {
      next(err);
    }
  }
);

wordToPdfRouter.get(
  '/jobs/:jobId/download/:fileId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();
      const { jobId, fileId } = req.params;
      const job = jobStore.get(jobId);

      if (!job) {
        throw new AppError(404, 'DOWNLOAD_EXPIRED', 'Download link has expired. Please convert again.');
      }

      const file = job.files.find(f => f.id === fileId);
      if (!file) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Requested file was not found in this conversion job.');
      }

      const encoded = encodeURIComponent(file.pdfFilename);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
      );
      res.setHeader('Content-Length', file.buffer.length);
      return res.status(200).send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/word-to-pdf/jobs/:jobId
// ──────────────────────────────────────────────────────────────

wordToPdfRouter.delete(
  '/jobs/:jobId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const existed = jobStore.delete(jobId);
      if (!existed) {
        throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found or already deleted.');
      }
      res.status(200).json({
        success: true,
        data: { deleted: true },
        meta: { timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  }
);

