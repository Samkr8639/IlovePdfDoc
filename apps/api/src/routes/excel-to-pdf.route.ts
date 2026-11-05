/**
 * POST /api/v1/excel-to-pdf/convert
 * GET  /api/v1/excel-to-pdf/jobs/:jobId/download
 * GET  /api/v1/excel-to-pdf/jobs/:jobId/download/:fileId
 * DELETE /api/v1/excel-to-pdf/jobs/:jobId
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import crypto from 'crypto';
import {
  ExcelToPdfOptions,
  ExcelToPdfJobResponse,
  ConvertedExcelFileItem,
  excelToPdfOptionsSchema
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import {
  convertExcelToPdf,
  validateSpreadsheetFile,
  checkLibreOffice,
  formatBytes,
  mergePdfBuffers
} from '../services/excel-to-pdf';

export const excelToPdfRouter = Router();

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

interface ExcelPdfOutputFile {
  id: string;
  originalFilename: string;
  pdfFilename: string;
  originalSize: number;
  pdfSize: number;
  pageCount: number;
  sheets: Array<{ name: string; pages: number }>;
  buffer: Buffer;
  downloadUrl: string;
  fontsSubstituted: Array<{ requested: string; used: string }>;
}

interface ExcelToPdfJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  files: ExcelPdfOutputFile[];
  zipBuffer?: Buffer;
  mergedPdfBuffer?: Buffer;
  isMerged?: boolean;
  warnings: string[];
}

const jobStore = new Map<string, ExcelToPdfJob>();
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
  // Keep letters, digits, spaces, and safe punctuation – - _ .
  const cleaned = filename.replace(/[^a-zA-Z0-9_\-\. \u00C0-\u024F\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF]/g, '_');
  return cleaned.trim() || 'converted-document.pdf';
}

function buildContentDisposition(filename: string): string {
  const safeAscii = filename.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  const encodedUtf8 = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/excel-to-pdf/convert
// ──────────────────────────────────────────────────────────────

excelToPdfRouter.post(
  '/convert',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one spreadsheet to convert.');
      }

      if (files.length > 10) {
        throw new AppError(400, 'TOO_MANY_FILES', 'Maximum 10 files per conversion.');
      }

      // Parse and validate options
      let rawOptions: any = {};
      try {
        if (req.body.options) {
          rawOptions = typeof req.body.options === 'string'
            ? JSON.parse(req.body.options)
            : req.body.options;
        } else {
          rawOptions = {
            output: req.body.output || 'pdf',
            pageSize: req.body.pageSize || 'as_file',
            orientation: req.body.orientation || 'as_file',
            scaling: req.body.scaling || 'as_file',
            customScale: req.body.customScale ? parseInt(req.body.customScale, 10) : undefined,
            margins: req.body.margins || 'as_file',
            gridlines: req.body.gridlines === 'true' || req.body.gridlines === true,
            headings: req.body.headings === 'true' || req.body.headings === true,
            repeatHeader: req.body.repeatHeader !== 'false' && req.body.repeatHeader !== false,
            pageNumbers: req.body.pageNumbers === 'true' || req.body.pageNumbers === true,
            bookmarks: req.body.bookmarks !== 'false' && req.body.bookmarks !== false,
            trimEmpty: req.body.trimEmpty !== 'false' && req.body.trimEmpty !== false,
            merge: req.body.merge === 'true' || req.body.merge === true
          };
        }
      } catch {
        throw new AppError(400, 'INVALID_OPTIONS', 'Invalid conversion options format.');
      }

      const parseResult = excelToPdfOptionsSchema.safeParse(rawOptions);
      if (!parseResult.success) {
        throw new AppError(400, 'INVALID_OPTIONS', `Invalid options: ${parseResult.error.issues.map(i => i.message).join(', ')}`);
      }
      const options: ExcelToPdfOptions = parseResult.data;

      // Validate each uploaded file first before conversion
      for (const file of files) {
        try {
          file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch {
          // keep original
        }
        await validateSpreadsheetFile(file.buffer, file.originalname);
      }

      // Check engine availability
      const { available } = await checkLibreOffice();
      if (!available) {
        throw new AppError(503, 'ENGINE_UNAVAILABLE', 'PDF conversion engine (LibreOffice) is not available. Please try again later.');
      }

      const jobId = crypto.randomUUID();
      const outputFiles: ExcelPdfOutputFile[] = [];
      const jobWarnings: string[] = [];

      // Convert each file through the engine
      for (const file of files) {
        let convResult;
        try {
          convResult = await convertExcelToPdf(file.buffer, file.originalname, options);
        } catch (err: unknown) {
          if (err instanceof AppError) throw err;
          const e = err as { code?: string; status?: number; message?: string };
          const code = e.code || 'CONVERSION_FAILED';
          const status = e.status || 422;
          throw new AppError(status, code, e.message || `Failed to convert '${file.originalname}'.`);
        }

        if (convResult.warnings.length > 0) {
          jobWarnings.push(...convResult.warnings.map(w => `${file.originalname}: ${w}`));
        }

        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const pdfFilename = `${sanitizeDownloadFilename(baseName)}.pdf`;
        const fileId = crypto.randomUUID();

        outputFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          pdfFilename,
          originalSize: file.size,
          pdfSize: convResult.pdfBuffer.length,
          pageCount: convResult.pageCount,
          sheets: convResult.sheets,
          buffer: convResult.pdfBuffer,
          downloadUrl: `/api/v1/excel-to-pdf/jobs/${jobId}/download/${fileId}`,
          fontsSubstituted: convResult.fontsSubstituted
        });
      }

      let zipBuffer: Buffer | undefined;
      let mergedPdfBuffer: Buffer | undefined;
      let isZip = false;

      // Multiple files handling: merged PDF or ZIP
      if (outputFiles.length > 1) {
        if (options.merge) {
          mergedPdfBuffer = await mergePdfBuffers(outputFiles.map(f => f.buffer));
        } else {
          isZip = true;
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
      }

      const job: ExcelToPdfJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        files: outputFiles,
        zipBuffer,
        mergedPdfBuffer,
        isMerged: options.merge && outputFiles.length > 1,
        warnings: jobWarnings
      };
      jobStore.set(jobId, job);

      const responseFiles: ConvertedExcelFileItem[] = outputFiles.map(f => ({
        id: f.id,
        inputName: f.originalFilename,
        outputName: f.pdfFilename,
        originalSizeBytes: f.originalSize,
        pdfSizeBytes: f.pdfSize,
        formattedOriginalSize: formatBytes(f.originalSize),
        formattedPdfSize: formatBytes(f.pdfSize),
        pageCount: f.pageCount,
        sheets: f.sheets,
        downloadUrl:
          outputFiles.length === 1 || options.merge
            ? `/api/v1/excel-to-pdf/jobs/${jobId}/download`
            : f.downloadUrl,
        fontsSubstituted: f.fontsSubstituted
      }));

      const primaryFilename = options.merge && outputFiles.length > 1
        ? `${outputFiles[0].pdfFilename.replace(/\.pdf$/i, '')}_merged.pdf`
        : isZip
          ? 'converted-spreadsheets.zip'
          : outputFiles[0].pdfFilename;

      const totalSize = options.merge && mergedPdfBuffer
        ? mergedPdfBuffer.length
        : isZip && zipBuffer
          ? zipBuffer.length
          : outputFiles[0]?.pdfSize || 0;

      const responseData: ExcelToPdfJobResponse = {
        jobId,
        status: 'completed',
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        totalFiles: outputFiles.length,
        isZip,
        downloadUrl: `/api/v1/excel-to-pdf/jobs/${jobId}/download`,
        zipDownloadUrl: isZip ? `/api/v1/excel-to-pdf/jobs/${jobId}/download` : undefined,
        filename: primaryFilename,
        sizeBytes: totalSize,
        files: responseFiles,
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
// GET /api/v1/excel-to-pdf/jobs/:jobId/download
// ──────────────────────────────────────────────────────────────

excelToPdfRouter.get(
  '/jobs/:jobId/download',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();
      const job = jobStore.get(req.params.jobId);
      if (!job) {
        throw new AppError(404, 'DOWNLOAD_EXPIRED', 'Conversion job not found or has expired.');
      }

      // If merged PDF was requested
      if (job.isMerged && job.mergedPdfBuffer) {
        const filename = `${job.files[0]?.pdfFilename.replace(/\.pdf$/i, '') || 'merged'}_merged.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', buildContentDisposition(filename));
        res.send(job.mergedPdfBuffer);
        jobStore.delete(req.params.jobId);
        return;
      }

      // If multi-file ZIP
      if (job.zipBuffer) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', buildContentDisposition('converted-spreadsheets.zip'));
        res.send(job.zipBuffer);
        jobStore.delete(req.params.jobId);
        return;
      }

      // Single file
      const file = job.files[0];
      if (!file) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'No output file found for this job.');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', buildContentDisposition(file.pdfFilename));
      res.send(file.buffer);

      jobStore.delete(req.params.jobId);
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// GET /api/v1/excel-to-pdf/jobs/:jobId/download/:fileId
// ──────────────────────────────────────────────────────────────

excelToPdfRouter.get(
  '/jobs/:jobId/download/:fileId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();
      const job = jobStore.get(req.params.jobId);
      if (!job) {
        throw new AppError(404, 'DOWNLOAD_EXPIRED', 'Conversion job not found or has expired.');
      }

      const file = job.files.find(f => f.id === req.params.fileId);
      if (!file) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Requested file was not found in this job.');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', buildContentDisposition(file.pdfFilename));
      res.send(file.buffer);
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /api/v1/excel-to-pdf/jobs/:jobId
// ──────────────────────────────────────────────────────────────

excelToPdfRouter.delete(
  '/jobs/:jobId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const exists = jobStore.has(req.params.jobId);
      if (!exists) {
        throw new AppError(404, 'JOB_NOT_FOUND', 'Conversion job not found or already deleted.');
      }
      jobStore.delete(req.params.jobId);
      res.status(200).json({ success: true, message: 'Job deleted.' });
    } catch (err) {
      next(err);
    }
  }
);
