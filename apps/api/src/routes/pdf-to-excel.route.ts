import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import crypto from 'crypto';
import {
  ApiResponse,
  PdfToExcelMode,
  PdfToExcelOptionsSchema,
  PdfToExcelResponse,
  PdfToExcelTable,
  PdfToExcelTableFile
} from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import { requirePremiumForOcr } from '../middleware/premiumOcrGate';
import {
  convertPdfToExcel,
  convertMultiplePdfsToOneWorkbook
} from '../services/pdf-to-excel';

export const pdfToExcelRouter = Router();

// Multer memory storage (max 10 files, 50MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10
  }
});

const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES || '100', 10);
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExcelOutputFileResult {
  id: string;
  originalFilename: string;
  xlsxFilename: string;
  originalSize: number;
  xlsxSize: number;
  sheets: number;
  tables: number;
  rows: number;
  cells: number;
  buffer: Buffer;
  warnings: string[];
  downloadUrl: string;
  coverage?: number;
}

export interface PdfToExcelJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  mode: PdfToExcelMode;
  totalOriginalSize: number;
  totalXlsxSize: number;
  files: ExcelOutputFileResult[];
  singleWorkbookBuffer?: Buffer;
  singleWorkbookFilename?: string;
  zipBuffer?: Buffer;
  tables: PdfToExcelTable[];
  warnings: string[];
}

// In-memory job repository with auto-pruning (ephemeral 10-minute volatile retention)
export const excelJobStore = new Map<string, PdfToExcelJob>();
const JOB_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

export function pruneExpiredExcelJobs(): void {
  const now = Date.now();
  for (const [id, job] of excelJobStore.entries()) {
    if (job.expiresAt <= now) {
      excelJobStore.delete(id);
    }
  }
}

/**
 * Sanitises filenames: strips control chars, directory traversal, caps length at 120 chars
 */
export function sanitizeFilename(filename: string, fallback = 'workbook.xlsx'): string {
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
// POST /api/v1/pdf-to-excel/convert
// -----------------------------------------------------------------------------
pdfToExcelRouter.post(
  '/convert',
  upload.array('files', 10),
  requirePremiumForOcr,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredExcelJobs();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one PDF file to convert.');
      }

      // Decode filenames from Latin-1 to UTF-8 to preserve en-dashes and special chars
      for (const file of files) {
        try {
          file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch {
          // Preserve as is if decoding fails
        }
      }

      // Validate body parameters using Zod schema
      const parseResult = PdfToExcelOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i: any) => ({
          field: i.path.join('.'),
          issue: i.message
        }));
        throw new AppError(400, 'INVALID_OPTIONS', 'Invalid conversion options provided.', issues);
      }

      const options = parseResult.data;
      const jobId = crypto.randomUUID();
      const outputFiles: ExcelOutputFileResult[] = [];
      const globalWarnings: string[] = [];
      const allTables: PdfToExcelTable[] = [];

      let totalOriginalSize = 0;
      let totalXlsxSize = 0;

      // Validate each uploaded PDF
      for (const file of files) {
        await validatePdfInput(file.buffer, file.originalname);
        totalOriginalSize += file.size;
      }

      let isZip = false;
      let primaryFilename = '';
      let zipBuffer: Buffer | undefined;
      let singleWorkbookBuffer: Buffer | undefined;

      if (files.length > 1 && options.multiFileOutput === 'one_workbook') {
        // Multi-file consolidated into one workbook
        const result = await convertMultiplePdfsToOneWorkbook(
          files.map(f => ({ buffer: f.buffer, filename: f.originalname })),
          options
        );

        singleWorkbookBuffer = result.xlsxBuffer;
        totalXlsxSize = result.xlsxBuffer.length;
        globalWarnings.push(...result.warnings);
        allTables.push(...result.tables);

        const firstBase = sanitizeFilename(files[0].originalname.replace(/\.[^/.]+$/, ''), 'export');
        primaryFilename = `${firstBase}_combined.xlsx`;

        for (const stat of result.fileStats) {
          outputFiles.push({
            id: crypto.randomUUID(),
            originalFilename: stat.filename,
            xlsxFilename: primaryFilename,
            originalSize: files.find(f => f.originalname === stat.filename)?.size || 0,
            xlsxSize: result.xlsxBuffer.length,
            sheets: stat.sheets,
            tables: stat.tables,
            rows: stat.rows,
            cells: stat.cells,
            buffer: result.xlsxBuffer,
            warnings: [],
            downloadUrl: `/api/v1/pdf-to-excel/jobs/${jobId}/download`,
            coverage: stat.coverage || result.coverage
          });
        }
      } else {
        // Individual workbooks per file
        const usedFilenames = new Map<string, number>();

        for (const file of files) {
          const result = await convertPdfToExcel(file.buffer, {
            ...options,
            originalFilename: file.originalname,
            title: file.originalname.replace(/\.[^/.]+$/, '')
          });

          const rawBase = file.originalname.replace(/\.[^/.]+$/, '');
          const cleanBase = sanitizeFilename(rawBase, 'workbook');
          let finalFilename = `${cleanBase}.xlsx`;

          const count = usedFilenames.get(finalFilename) || 0;
          if (count > 0) {
            finalFilename = `${cleanBase}_${count + 1}.xlsx`;
          }
          usedFilenames.set(finalFilename, count + 1);

          const fileId = crypto.randomUUID();
          totalXlsxSize += result.xlsxBuffer.length;
          if (result.warnings && result.warnings.length > 0) {
            globalWarnings.push(...result.warnings);
          }
          allTables.push(...result.tables);

          outputFiles.push({
            id: fileId,
            originalFilename: file.originalname,
            xlsxFilename: finalFilename,
            originalSize: file.size,
            xlsxSize: result.xlsxBuffer.length,
            sheets: result.sheetCount,
            tables: result.tableCount,
            rows: result.rowCount,
            cells: result.cellCount,
            buffer: result.xlsxBuffer,
            warnings: result.warnings,
            downloadUrl: `/api/v1/pdf-to-excel/jobs/${jobId}/download/${fileId}`,
            coverage: result.coverage
          });

          await new Promise(resolve => setImmediate(resolve));
        }

        if (outputFiles.length === 1) {
          isZip = false;
          primaryFilename = outputFiles[0].xlsxFilename;
          singleWorkbookBuffer = outputFiles[0].buffer;
        } else {
          isZip = true;
          primaryFilename = 'converted_excel_workbooks.zip';
          const zip = new JSZip();
          for (const item of outputFiles) {
            zip.file(item.xlsxFilename, item.buffer);
          }
          zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          });
          totalXlsxSize = zipBuffer.length;
        }
      }

      const job: PdfToExcelJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        mode: options.mode,
        totalOriginalSize,
        totalXlsxSize,
        files: outputFiles,
        singleWorkbookBuffer,
        singleWorkbookFilename: primaryFilename,
        zipBuffer,
        tables: allTables,
        warnings: Array.from(new Set(globalWarnings))
      };

      excelJobStore.set(jobId, job);

      const tableFiles: PdfToExcelTableFile[] = outputFiles.map(f => ({
        filename: f.xlsxFilename,
        sheets: f.sheets,
        tables: f.tables,
        rows: f.rows,
        cells: f.cells,
        sizeBytes: f.xlsxSize,
        formattedSize: formatBytes(f.xlsxSize),
        coverage: f.coverage,
        downloadUrl: outputFiles.length === 1 || options.multiFileOutput === 'one_workbook'
          ? `/api/v1/pdf-to-excel/jobs/${jobId}/download`
          : f.downloadUrl
      }));

      const responseData: PdfToExcelResponse = {
        jobId,
        isZip,
        downloadUrl: `/api/v1/pdf-to-excel/jobs/${jobId}/download`,
        filename: primaryFilename,
        sizeBytes: totalXlsxSize,
        formattedSize: formatBytes(totalXlsxSize),
        files: tableFiles,
        tables: allTables,
        warnings: job.warnings,
        coverage: outputFiles.length === 1 ? outputFiles[0].coverage : undefined
      };

      const response: ApiResponse<PdfToExcelResponse> = {
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
// GET /api/v1/pdf-to-excel/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToExcelRouter.get('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredExcelJobs();
    const { jobId } = req.params;
    const job = excelJobStore.get(jobId);

    if (!job) {
      throw new AppError(
        404,
        'JOB_NOT_FOUND',
        'Conversion job not found or has expired. Please convert your PDF again.'
      );
    }

    const tableFiles: PdfToExcelTableFile[] = job.files.map(f => ({
      filename: f.xlsxFilename,
      sheets: f.sheets,
      tables: f.tables,
      rows: f.rows,
      cells: f.cells,
      sizeBytes: f.xlsxSize,
      formattedSize: formatBytes(f.xlsxSize),
      downloadUrl: job.files.length === 1 || job.singleWorkbookBuffer
        ? `/api/v1/pdf-to-excel/jobs/${job.id}/download`
        : f.downloadUrl
    }));

    const isZip = !!job.zipBuffer;
    const filename = job.singleWorkbookFilename || (isZip ? 'converted_excel_workbooks.zip' : 'workbook.xlsx');

    const response: ApiResponse<PdfToExcelResponse> = {
      success: true,
      data: {
        jobId: job.id,
        isZip,
        downloadUrl: `/api/v1/pdf-to-excel/jobs/${job.id}/download`,
        filename,
        sizeBytes: job.totalXlsxSize,
        formattedSize: formatBytes(job.totalXlsxSize),
        files: tableFiles,
        tables: job.tables,
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
// GET /api/v1/pdf-to-excel/jobs/:jobId/download (Deletes job on download)
// -----------------------------------------------------------------------------
pdfToExcelRouter.get('/jobs/:jobId/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredExcelJobs();
    const { jobId } = req.params;
    const job = excelJobStore.get(jobId);

    if (!job) {
      throw new AppError(
        404,
        'DOWNLOAD_EXPIRED',
        'The download link has expired or was already downloaded. Please convert the document again.'
      );
    }

    // Ephemeral deletion on download
    excelJobStore.delete(jobId);

    if (job.singleWorkbookBuffer) {
      const filename = job.singleWorkbookFilename || 'workbook.xlsx';
      res.type(XLSX_MIME_TYPE);
      setContentDisposition(res, filename);
      res.setHeader('Content-Length', job.singleWorkbookBuffer.length);
      return res.status(200).send(job.singleWorkbookBuffer);
    }

    if (job.zipBuffer) {
      res.type('application/zip');
      setContentDisposition(res, 'converted_excel_workbooks.zip');
      res.setHeader('Content-Length', job.zipBuffer.length);
      return res.status(200).send(job.zipBuffer);
    }

    if (job.files.length === 1) {
      const file = job.files[0];
      res.type(XLSX_MIME_TYPE);
      setContentDisposition(res, file.xlsxFilename);
      res.setHeader('Content-Length', file.buffer.length);
      return res.status(200).send(file.buffer);
    }

    throw new AppError(500, 'DOWNLOAD_ERROR', 'File buffer unavailable for download.');
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/pdf-to-excel/jobs/:jobId/download/:fileId
// -----------------------------------------------------------------------------
pdfToExcelRouter.get('/jobs/:jobId/download/:fileId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredExcelJobs();
    const { jobId, fileId } = req.params;
    const job = excelJobStore.get(jobId);

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

    res.type(XLSX_MIME_TYPE);
    setContentDisposition(res, file.xlsxFilename);
    res.setHeader('Content-Length', file.buffer.length);
    return res.status(200).send(file.buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// DELETE /api/v1/pdf-to-excel/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToExcelRouter.delete('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const exists = excelJobStore.delete(jobId);

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
