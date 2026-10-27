import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import crypto from 'crypto';
import {
  ApiResponse,
  PdfToPowerPointMode,
  PdfToPowerPointSlideSize,
  PdfToPowerPointOptionsSchema,
  ConvertedPowerPointFileItem,
  PdfToPowerPointJobResponse
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import { requirePremiumForOcr } from '../middleware/premiumOcrGate';
import { convertPdfToPptx } from '../services/pdf-to-powerpoint';

export const pdfToPowerPointRouter = Router();

// Multer memory storage (max 10 files, 50MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10
  }
});

const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES || '100', 10);
const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface PowerPointOutputFileResult {
  id: string;
  originalFilename: string;
  pptxFilename: string;
  originalSize: number;
  pptxSize: number;
  slideCount: number;
  modeUsed: PdfToPowerPointMode;
  slideSizeUsed: PdfToPowerPointSlideSize;
  buffer: Buffer;
  warnings: string[];
  downloadUrl: string;
}

export interface PdfToPowerPointJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  mode: PdfToPowerPointMode;
  slideSize: PdfToPowerPointSlideSize;
  totalOriginalSize: number;
  totalPptxSize: number;
  files: PowerPointOutputFileResult[];
  zipBuffer?: Buffer;
  warnings: string[];
}

// In-memory job repository with auto-pruning (ephemeral 10-minute volatile retention)
export const pptxJobStore = new Map<string, PdfToPowerPointJob>();
const JOB_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of pptxJobStore.entries()) {
    if (job.expiresAt <= now) {
      pptxJobStore.delete(id);
    }
  }
}

/**
 * Sanitises filenames: strips control chars, directory traversal ('..', slashes), caps length at 120 chars
 */
export function sanitizeFilename(filename: string, fallback = 'presentation.pptx'): string {
  if (!filename) return fallback;
  const cleaned = filename
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/\.\.+/g, '.')
    .trim();
  const truncated = cleaned.slice(0, 120);
  return truncated || fallback;
}

/**
 * Sets RFC 5987 compatible Content-Disposition header supporting UTF-8 filenames
 */
export function setContentDisposition(res: Response, filename: string): void {
  const safeAscii = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`);
}

/**
 * Validates a PDF file buffer against corruption, empty bytes, magic bytes, and encryption
 */
export async function validatePdfInput(
  buffer: Buffer,
  originalname: string
): Promise<{ pageCount: number }> {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The selected file '${originalname}' is empty.`);
  }

  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new AppError(
      400,
      'INVALID_PDF_HEADER',
      `The file '${originalname}' is not a valid PDF document (missing %PDF- signature).`
    );
  }

  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const count = doc.getPageCount();
    if (count === 0) {
      throw new AppError(422, 'EMPTY_PDF', `The PDF '${originalname}' contains no pages.`);
    }
    if (count > MAX_PDF_PAGES) {
      throw new AppError(
        413,
        'TOO_MANY_PAGES',
        `The PDF '${originalname}' has ${count} pages, which exceeds the maximum limit of ${MAX_PDF_PAGES} pages.`
      );
    }
    return { pageCount: count };
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = String(err).toLowerCase();
    if (msg.includes('encrypt') || msg.includes('password')) {
      throw new AppError(
        422,
        'ENCRYPTED_PDF',
        `The PDF '${originalname}' is password-protected or encrypted. Please remove password protection before converting.`
      );
    }
    throw new AppError(
      422,
      'CORRUPTED_PDF',
      `The PDF '${originalname}' could not be parsed. The file may be damaged or corrupted.`
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// -----------------------------------------------------------------------------
// POST /api/v1/pdf-to-powerpoint/convert
// -----------------------------------------------------------------------------
pdfToPowerPointRouter.post(
  '/convert',
  upload.array('files', 10),
  requirePremiumForOcr,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one PDF file to convert.');
      }

      // Validate body parameters using Zod schema
      const parseResult = PdfToPowerPointOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => ({
          field: i.path.join('.'),
          issue: i.message
        }));
        throw new AppError(400, 'INVALID_OPTIONS', 'Invalid conversion options provided.', issues);
      }

      const { mode, slideSize, ocrLanguage } = parseResult.data;
      const jobId = crypto.randomUUID();
      const outputFiles: PowerPointOutputFileResult[] = [];
      const globalWarnings: string[] = [];
      let totalOriginalSize = 0;
      let totalPptxSize = 0;

      // Track filename frequencies for safe unique ZIP naming
      const usedFilenames = new Map<string, number>();

      for (const file of files) {
        await validatePdfInput(file.buffer, file.originalname);

        const { pptxBuffer, slideCount, warnings } = await convertPdfToPptx(file.buffer, {
          mode,
          slideSize,
          ocrLanguage,
          originalFilename: file.originalname
        });

        const rawBase = file.originalname.replace(/\.[^/.]+$/, '');
        let cleanBase = sanitizeFilename(rawBase, 'presentation');
        let finalFilename = `${cleanBase}.pptx`;

        // Avoid collision in multi-file zip
        const count = usedFilenames.get(finalFilename) || 0;
        if (count > 0) {
          finalFilename = `${cleanBase}_${count + 1}.pptx`;
        }
        usedFilenames.set(finalFilename, count + 1);

        const fileId = crypto.randomUUID();
        totalOriginalSize += file.size;
        totalPptxSize += pptxBuffer.length;
        if (warnings && warnings.length > 0) {
          globalWarnings.push(...warnings);
        }

        outputFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          pptxFilename: finalFilename,
          originalSize: file.size,
          pptxSize: pptxBuffer.length,
          slideCount,
          modeUsed: mode,
          slideSizeUsed: slideSize,
          buffer: pptxBuffer,
          warnings,
          downloadUrl: `/api/v1/pdf-to-powerpoint/jobs/${jobId}/download/${fileId}`
        });

        // Cooperative yield between files
        await new Promise(resolve => setImmediate(resolve));
      }

      // If multiple files, create a single ZIP file containing all PPTX outputs
      let zipBuffer: Buffer | undefined;
      if (outputFiles.length > 1) {
        const zip = new JSZip();
        for (const item of outputFiles) {
          zip.file(item.pptxFilename, item.buffer);
        }
        zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }

      const job: PdfToPowerPointJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        mode,
        slideSize,
        totalOriginalSize,
        totalPptxSize,
        files: outputFiles,
        zipBuffer,
        warnings: Array.from(new Set(globalWarnings))
      };

      pptxJobStore.set(jobId, job);

      const responseFiles: ConvertedPowerPointFileItem[] = outputFiles.map(f => ({
        id: f.id,
        originalFilename: f.originalFilename,
        powerpointFilename: f.pptxFilename,
        pptxFilename: f.pptxFilename,
        originalSizeBytes: f.originalSize,
        powerpointSizeBytes: f.pptxSize,
        pptxSizeBytes: f.pptxSize,
        formattedOriginalSize: formatBytes(f.originalSize),
        formattedPowerpointSize: formatBytes(f.pptxSize),
        formattedPptxSize: formatBytes(f.pptxSize),
        slideCount: f.slideCount,
        modeUsed: f.modeUsed,
        slideSizeUsed: f.slideSizeUsed,
        warnings: f.warnings,
        downloadUrl: outputFiles.length === 1
          ? `/api/v1/pdf-to-powerpoint/jobs/${jobId}/download`
          : f.downloadUrl
      }));

      const responseData: PdfToPowerPointJobResponse = {
        id: jobId,
        status: 'completed',
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        mode,
        slideSize,
        totalFiles: outputFiles.length,
        files: responseFiles,
        isZip: outputFiles.length > 1,
        zipDownloadUrl: outputFiles.length > 1
          ? `/api/v1/pdf-to-powerpoint/jobs/${jobId}/download`
          : undefined,
        warnings: job.warnings
      };

      const response: ApiResponse<PdfToPowerPointJobResponse> = {
        success: true,
        data: responseData,
        meta: {
          requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/v1/pdf-to-powerpoint/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToPowerPointRouter.get('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId } = req.params;
    const job = pptxJobStore.get(jobId);

    if (!job) {
      throw new AppError(
        404,
        'JOB_NOT_FOUND',
        'Conversion job not found or has expired. Please convert your PDF again.'
      );
    }

    const responseFiles: ConvertedPowerPointFileItem[] = job.files.map(f => ({
      id: f.id,
      originalFilename: f.originalFilename,
      powerpointFilename: f.pptxFilename,
      pptxFilename: f.pptxFilename,
      originalSizeBytes: f.originalSize,
      powerpointSizeBytes: f.pptxSize,
      pptxSizeBytes: f.pptxSize,
      formattedOriginalSize: formatBytes(f.originalSize),
      formattedPowerpointSize: formatBytes(f.pptxSize),
      formattedPptxSize: formatBytes(f.pptxSize),
      slideCount: f.slideCount,
      modeUsed: f.modeUsed,
      slideSizeUsed: f.slideSizeUsed,
      warnings: f.warnings,
      downloadUrl: job.files.length === 1
        ? `/api/v1/pdf-to-powerpoint/jobs/${job.id}/download`
        : f.downloadUrl
    }));

    const response: ApiResponse<PdfToPowerPointJobResponse> = {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        mode: job.mode,
        slideSize: job.slideSize,
        totalFiles: job.files.length,
        files: responseFiles,
        isZip: job.files.length > 1,
        zipDownloadUrl: job.files.length > 1
          ? `/api/v1/pdf-to-powerpoint/jobs/${job.id}/download`
          : undefined,
        warnings: job.warnings
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/pdf-to-powerpoint/jobs/:jobId/download (Deletes on download)
// -----------------------------------------------------------------------------
pdfToPowerPointRouter.get('/jobs/:jobId/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId } = req.params;
    const job = pptxJobStore.get(jobId);

    if (!job) {
      throw new AppError(
        404,
        'DOWNLOAD_EXPIRED',
        'The download link has expired or was already downloaded. Please convert the document again.'
      );
    }

    // Ephemeral deletion on download
    pptxJobStore.delete(jobId);

    if (job.files.length === 1) {
      const file = job.files[0];
      res.type(PPTX_MIME_TYPE);
      setContentDisposition(res, file.pptxFilename);
      res.setHeader('Content-Length', file.buffer.length);
      return res.status(200).send(file.buffer);
    }

    if (job.zipBuffer) {
      res.type('application/zip');
      setContentDisposition(res, 'converted_powerpoint_presentations.zip');
      res.setHeader('Content-Length', job.zipBuffer.length);
      return res.status(200).send(job.zipBuffer);
    }

    throw new AppError(500, 'DOWNLOAD_ERROR', 'File buffer unavailable for download.');
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/pdf-to-powerpoint/jobs/:jobId/download/:fileId
// -----------------------------------------------------------------------------
pdfToPowerPointRouter.get('/jobs/:jobId/download/:fileId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId, fileId } = req.params;
    const job = pptxJobStore.get(jobId);

    if (!job) {
      throw new AppError(
        404,
        'DOWNLOAD_EXPIRED',
        'The download link has expired. Please convert your PDF again.'
      );
    }

    const file = job.files.find(f => f.id === fileId);
    if (!file) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Requested file was not found in this conversion job.');
    }

    res.type(PPTX_MIME_TYPE);
    setContentDisposition(res, file.pptxFilename);
    res.setHeader('Content-Length', file.buffer.length);
    return res.status(200).send(file.buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// DELETE /api/v1/pdf-to-powerpoint/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToPowerPointRouter.delete('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const exists = pptxJobStore.delete(jobId);

    if (!exists) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found or already deleted.');
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
      meta: { timestamp: new Date().toISOString() }
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});
