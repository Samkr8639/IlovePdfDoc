import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import crypto from 'crypto';
import { ApiResponse } from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';

export const compressRouter = Router();

// Multer memory storage configuration with limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 20 // Max 20 files
  }
});

import {
  compressPdf,
  validatePdfBuffer,
  CompressionLevel,
  CompressionStats
} from '../services/compress';

export { CompressionLevel, validatePdfBuffer };

export interface CompressedFileResult {
  id: string;
  originalFilename: string;
  compressedFilename: string;
  originalSize: number;
  compressedSize: number;
  spaceSaved: number;
  reductionPercentage: number;
  pageCount: number;
  buffer: Buffer;
  downloadUrl: string;
  savingsReason?: string;
}

export interface CompressionJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'completed' | 'failed' | 'processing';
  level: CompressionLevel;
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSpaceSaved: number;
  totalReductionPercentage: number;
  files: CompressedFileResult[];
  zipBuffer?: Buffer;
}

// In-memory job repository with auto-pruning
const jobStore = new Map<string, CompressionJob>();
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (job.expiresAt <= now) {
      jobStore.delete(id);
    }
  }
}

/**
 * Compresses a PDF buffer using the new high-efficiency engine
 */
export async function compressSinglePdf(
  buffer: Buffer,
  filename: string,
  level: CompressionLevel = 'recommended'
): Promise<{ compressedBuffer: Buffer; pageCount: number; stats?: CompressionStats }> {
  const result = await compressPdf(buffer, filename, { level });
  return {
    compressedBuffer: result.compressedBuffer,
    pageCount: result.pageCount,
    stats: result.stats
  };
}

/**
 * POST /api/v1/compress
 * Accept uploaded PDF files (single or multiple) and a compression level.
 */
compressRouter.post(
  '/',
  upload.any(),
  async (req: Request, res: Response, next: NextFunction) => {
    pruneExpiredJobs();

    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return next(new AppError(400, 'NO_FILES_PROVIDED', 'Please select at least one PDF file.'));
    }

    if (uploadedFiles.length > 20) {
      return next(new AppError(400, 'TOO_MANY_FILES', 'A maximum of 20 PDF files can be processed at once.'));
    }

    const rawLevel = req.body?.level;
    const level: CompressionLevel =
      rawLevel === 'extreme' || rawLevel === 'less' ? rawLevel : 'recommended';

    const jobId = crypto.randomUUID();
    const processedFiles: CompressedFileResult[] = [];

    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileId = `file-${i + 1}-${crypto.randomBytes(4).toString('hex')}`;

        const { compressedBuffer, pageCount, stats } = await compressSinglePdf(file.buffer, file.originalname, level);

        const originalSize = file.size || file.buffer.length;
        const compressedSize = compressedBuffer.length;
        const spaceSaved = Math.max(0, originalSize - compressedSize);
        const reductionPercentage =
          originalSize > 0
            ? Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10
            : 0;

        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;

        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const cleanBase = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const compressedFilename = `${cleanBase}_compressed.pdf`;

        processedFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          compressedFilename,
          originalSize,
          compressedSize,
          spaceSaved,
          reductionPercentage,
          pageCount,
          buffer: compressedBuffer,
          downloadUrl: `/api/v1/compress/jobs/${jobId}/download/${fileId}`,
          savingsReason: stats?.savingsReason
        });
      }

      let zipBuffer: Buffer | undefined;
      if (processedFiles.length > 1) {
        const zip = new JSZip();
        for (const pf of processedFiles) {
          zip.file(pf.compressedFilename, pf.buffer);
        }
        zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }

      const totalSpaceSaved = Math.max(0, totalOriginalSize - totalCompressedSize);
      const totalReductionPercentage =
        totalOriginalSize > 0
          ? Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 1000) / 10
          : 0;

      const job: CompressionJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        level,
        totalOriginalSize,
        totalCompressedSize,
        totalSpaceSaved,
        totalReductionPercentage,
        files: processedFiles,
        zipBuffer
      };

      jobStore.set(jobId, job);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          jobId,
          status: 'completed',
          level,
          filesCount: processedFiles.length,
          totalOriginalSize,
          totalCompressedSize,
          totalSpaceSaved,
          totalReductionPercentage,
          savingsReason: processedFiles[0]?.savingsReason || 'Optimization completed',
          files: processedFiles.map(f => ({
            id: f.id,
            originalFilename: f.originalFilename,
            compressedFilename: f.compressedFilename,
            originalSize: f.originalSize,
            compressedSize: f.compressedSize,
            spaceSaved: f.spaceSaved,
            reductionPercentage: f.reductionPercentage,
            pageCount: f.pageCount,
            downloadUrl: f.downloadUrl,
            savingsReason: f.savingsReason
          })),
          downloadUrl: `/api/v1/compress/jobs/${jobId}/download`
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(200).json(response);
    } catch (err: unknown) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/compress/jobs/:jobId
 * Return job status and metadata
 */
compressRouter.get('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  pruneExpiredJobs();
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return next(new AppError(404, 'JOB_NOT_FOUND', 'The download has expired or could not be found. Please process the file again.'));
  }

  const response: ApiResponse<any> = {
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      level: job.level,
      filesCount: job.files.length,
      totalOriginalSize: job.totalOriginalSize,
      totalCompressedSize: job.totalCompressedSize,
      totalSpaceSaved: job.totalSpaceSaved,
      totalReductionPercentage: job.totalReductionPercentage,
      savingsReason: job.files[0]?.savingsReason || 'Optimization completed',
      files: job.files.map(f => ({
        id: f.id,
        originalFilename: f.originalFilename,
        compressedFilename: f.compressedFilename,
        originalSize: f.originalSize,
        compressedSize: f.compressedSize,
        spaceSaved: f.spaceSaved,
        reductionPercentage: f.reductionPercentage,
        pageCount: f.pageCount,
        downloadUrl: f.downloadUrl,
        savingsReason: f.savingsReason
      })),
      downloadUrl: `/api/v1/compress/jobs/${job.id}/download`
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  res.status(200).json(response);
});

/**
 * GET /api/v1/compress/jobs/:jobId/download
 * Download single compressed PDF or ZIP archive of all processed files
 */
compressRouter.get('/jobs/:jobId/download', (req: Request, res: Response, next: NextFunction) => {
  pruneExpiredJobs();
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return next(new AppError(404, 'JOB_NOT_FOUND', 'The download has expired. Please process the file again.'));
  }

  if (job.files.length === 1) {
    const single = job.files[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(single.compressedFilename)}"`);
    res.setHeader('Content-Length', single.buffer.length);
    return res.status(200).send(single.buffer);
  }

  if (job.zipBuffer) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="paperflow_compressed_files.zip"');
    res.setHeader('Content-Length', job.zipBuffer.length);
    return res.status(200).send(job.zipBuffer);
  }

  return next(new AppError(500, 'DOWNLOAD_FAILED', 'Failed to generate download bundle.'));
});

/**
 * GET /api/v1/compress/jobs/:jobId/download/:fileId
 * Download specific compressed file from a multi-file job
 */
compressRouter.get('/jobs/:jobId/download/:fileId', (req: Request, res: Response, next: NextFunction) => {
  pruneExpiredJobs();
  const { jobId, fileId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return next(new AppError(404, 'JOB_NOT_FOUND', 'The download has expired. Please process the file again.'));
  }

  const file = job.files.find(f => f.id === fileId);
  if (!file) {
    return next(new AppError(404, 'FILE_NOT_FOUND', 'The requested file was not found in this compression job.'));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.compressedFilename)}"`);
  res.setHeader('Content-Length', file.buffer.length);
  return res.status(200).send(file.buffer);
});

/**
 * DELETE /api/v1/compress/jobs/:jobId
 * Clean up job resources immediately
 */
compressRouter.delete('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  const { jobId } = req.params;
  const deleted = jobStore.delete(jobId);

  if (!deleted) {
    return next(new AppError(404, 'JOB_NOT_FOUND', 'The requested job was not found or already deleted.'));
  }

  res.status(200).json({
    success: true,
    data: { message: 'Job and temporary files deleted successfully.' },
    meta: { timestamp: new Date().toISOString() }
  });
});
