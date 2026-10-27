import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak
} from 'docx';
import JSZip from 'jszip';
import crypto from 'crypto';
import Tesseract from 'tesseract.js';
import { ApiResponse, PdfToWordMode, ConvertedWordFileItem, PdfToWordJobResponse } from '@paperflow/contracts';
import { AppError } from '../middleware/errorHandler';
import { convertPdfToDocx } from '../services/pdf-to-word';

export const pdfToWordRouter = Router();

// Multer memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10 // Max 10 files
  }
});

export interface WordOutputFileResult {
  id: string;
  originalFilename: string;
  wordFilename: string;
  originalSize: number;
  wordSize: number;
  pageCount: number;
  modeUsed: PdfToWordMode;
  buffer: Buffer;
  downloadUrl: string;
}

export interface PdfToWordJob {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: 'processing' | 'completed' | 'failed';
  mode: PdfToWordMode;
  totalOriginalSize: number;
  totalWordSize: number;
  files: WordOutputFileResult[];
  zipBuffer?: Buffer;
}

// In-memory job repository with auto-pruning (ephemeral 10-minute volatile retention)
const jobStore = new Map<string, PdfToWordJob>();
const JOB_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpiredJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (job.expiresAt <= now) {
      jobStore.delete(id);
    }
  }
}

/**
 * Validates a PDF file buffer against corruption, empty bytes, and encryption
 */
export async function validatePdfInput(buffer: Buffer, originalname: string): Promise<{ pageCount: number }> {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The selected file '${originalname}' is empty.`);
  }

  if (!originalname.toLowerCase().endsWith('.pdf')) {
    throw new AppError(400, 'INVALID_FILE_TYPE', `File '${originalname}' must have a .pdf extension.`);
  }

  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new AppError(400, 'INVALID_PDF_HEADER', `Only valid PDF files are supported. '${originalname}' is not a valid PDF.`);
  }

  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const count = doc.getPageCount();
    if (count === 0) {
      throw new AppError(422, 'EMPTY_PDF', `The PDF '${originalname}' contains no pages.`);
    }
    return { pageCount: count };
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const msg = String(err).toLowerCase();
    if (msg.includes('encrypt') || msg.includes('password')) {
      throw new AppError(422, 'PASSWORD_PROTECTED', `The PDF '${originalname}' is password-protected or encrypted. Please unlock it before converting.`);
    }
    throw new AppError(422, 'CORRUPTED_PDF', `The PDF '${originalname}' could not be parsed. It may be damaged or corrupted.`);
  }
}

export interface ExtractedPageContent {
  pageNumber: number;
  text: string;
  isScanned: boolean;
  lines: string[];
}

/**
 * Inspects PDF pages for extractable text layer vs scanned pages
 */
export async function extractPdfPageContents(
  buffer: Buffer,
  mode: PdfToWordMode,
  ocrLanguage = 'eng'
): Promise<ExtractedPageContent[]> {
  const pages: ExtractedPageContent[] = [];

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const parsedPages = result.pages || [];

    for (let i = 0; i < parsedPages.length; i++) {
      const pageNum = parsedPages[i].num || i + 1;
      const rawText = parsedPages[i].text || '';
      const trimmed = rawText.trim();
      const isScanned = trimmed.length < 15; // Fewer than 15 characters indicates image/scanned page

      let pageLines = trimmed
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      // If scanned and OCR mode is enabled, attempt OCR processing
      if (isScanned && mode === 'ocr') {
        try {
          // Attempt OCR with Tesseract
          const ocrResult = await Tesseract.recognize(buffer, ocrLanguage, {
            logger: () => {}
          });
          const ocrText = (ocrResult.data?.text || '').trim();
          if (ocrText.length > 0) {
            pageLines = ocrText
              .split(/\r?\n/)
              .map(l => l.trim())
              .filter(l => l.length > 0);
          }
        } catch {
          // If OCR fallback fails, proceed with best-effort text
        }
      }

      pages.push({
        pageNumber: pageNum,
        text: trimmed,
        isScanned,
        lines: pageLines
      });
    }

    // If parser returned 0 pages but pdf-lib confirmed pages exist
    if (pages.length === 0) {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      for (let p = 1; p <= doc.getPageCount(); p++) {
        pages.push({
          pageNumber: p,
          text: '',
          isScanned: true,
          lines: []
        });
      }
    }

    return pages;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(422, 'EXTRACTION_FAILED', `Failed to inspect PDF text layer: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Builds a genuine DOCX document using the docx library
 */
export async function buildDocxFromPages(
  pages: ExtractedPageContent[],
  originalFilename: string,
  mode: PdfToWordMode
): Promise<Buffer> {
  const docChildren: (Paragraph | Table)[] = [];

  // Check if document was entirely scanned with no text
  const totalTextLength = pages.reduce((acc, p) => acc + p.text.length, 0);
  const isAllScanned = totalTextLength === 0;

  if (isAllScanned && mode === 'no_ocr') {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Document: ${originalFilename}`,
            bold: true,
            size: 28,
            color: '0F172A'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: 'Notice: This document contains scanned images or non-selectable text.',
            italics: true,
            color: '64748B',
            size: 22
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'For full text recognition on scanned documents, please convert using OCR mode.',
            color: 'E53238',
            bold: true,
            size: 22
          })
        ]
      })
    );
  } else {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Add page break before page 2+
      if (i > 0) {
        docChildren.push(
          new Paragraph({
            children: [new PageBreak()]
          })
        );
      }

      // If page has no lines
      if (page.lines.length === 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[Page ${page.pageNumber}]`,
                italics: true,
                color: '94A3B8',
                size: 20
              })
            ]
          })
        );
        continue;
      }

      // Reconstruct paragraphs and headings
      for (const line of page.lines) {
        // Detect Heading 1 (Short, all uppercase or starts with title indicator)
        const isHeading1 = line.length < 60 && (line === line.toUpperCase() && /[A-Z]/.test(line));
        const isHeading2 = line.length < 80 && line.endsWith(':');
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');

        if (isHeading1) {
          docChildren.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
              children: [
                new TextRun({
                  text: line,
                  bold: true,
                  size: 28,
                  color: '0F172A'
                })
              ]
            })
          );
        } else if (isHeading2) {
          docChildren.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 },
              children: [
                new TextRun({
                  text: line,
                  bold: true,
                  size: 24,
                  color: '1E293B'
                })
              ]
            })
          );
        } else if (isBullet) {
          const cleanText = line.replace(/^[•\-\*]\s*/, '');
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: cleanText,
                  size: 22,
                  color: '1F2937'
                })
              ]
            })
          );
        } else {
          docChildren.push(
            new Paragraph({
              spacing: { after: 140, line: 276 },
              children: [
                new TextRun({
                  text: line,
                  size: 22,
                  color: '1F2937'
                })
              ]
            })
          );
        }
      }
    }
  }

  const doc = new Document({
    creator: 'PDF flow (I Love PDF & Doc)',
    title: originalFilename.replace(/\.[^/.]+$/, ''),
    description: 'Converted from PDF by PDF flow genuine DOCX converter',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: docChildren
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  // Validate output DOCX: must be non-empty and start with PK (OpenXML ZIP signature 0x50 0x4B)
  if (!buffer || buffer.length < 500) {
    throw new AppError(500, 'DOCX_GENERATION_FAILED', 'Failed to generate a valid Word document.');
  }

  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new AppError(500, 'INVALID_DOCX_OUTPUT', 'Output document signature is corrupted.');
  }

  return buffer;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// -----------------------------------------------------------------------------
// POST /api/v1/pdf-to-word/convert
// -----------------------------------------------------------------------------
pdfToWordRouter.post(
  '/convert',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      pruneExpiredJobs();

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError(400, 'NO_FILES_UPLOADED', 'Please select at least one PDF file to convert.');
      }

      const rawMode = req.body.mode as string;
      const mode: PdfToWordMode = rawMode === 'ocr' ? 'ocr' : 'no_ocr';
      const ocrLanguage = (req.body.ocrLanguage as string) || 'eng';

      const jobId = crypto.randomUUID();
      const outputFiles: WordOutputFileResult[] = [];
      let totalOriginalSize = 0;
      let totalWordSize = 0;

      for (const file of files) {
        await validatePdfInput(file.buffer, file.originalname);
        const { docxBuffer, pageCount } = await convertPdfToDocx(file.buffer, {
          mode,
          ocrLanguage,
          originalFilename: file.originalname
        });

        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const wordFilename = `${baseName}.docx`;
        const fileId = crypto.randomUUID();

        totalOriginalSize += file.size;
        totalWordSize += docxBuffer.length;

        outputFiles.push({
          id: fileId,
          originalFilename: file.originalname,
          wordFilename,
          originalSize: file.size,
          wordSize: docxBuffer.length,
          pageCount,
          modeUsed: mode,
          buffer: docxBuffer,
          downloadUrl: `/api/v1/pdf-to-word/jobs/${jobId}/download/${fileId}`
        });
      }

      // If multiple files, create a single ZIP file containing all DOCX outputs
      let zipBuffer: Buffer | undefined;
      if (outputFiles.length > 1) {
        const zip = new JSZip();
        for (const item of outputFiles) {
          zip.file(item.wordFilename, item.buffer);
        }
        zipBuffer = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }

      const job: PdfToWordJob = {
        id: jobId,
        createdAt: Date.now(),
        expiresAt: Date.now() + JOB_RETENTION_MS,
        status: 'completed',
        mode,
        totalOriginalSize,
        totalWordSize,
        files: outputFiles,
        zipBuffer
      };

      jobStore.set(jobId, job);

      const responseFiles: ConvertedWordFileItem[] = outputFiles.map(f => ({
        id: f.id,
        originalFilename: f.originalFilename,
        wordFilename: f.wordFilename,
        originalSizeBytes: f.originalSize,
        wordSizeBytes: f.wordSize,
        formattedOriginalSize: formatBytes(f.originalSize),
        formattedWordSize: formatBytes(f.wordSize),
        pageCount: f.pageCount,
        modeUsed: f.modeUsed,
        downloadUrl: outputFiles.length === 1 ? `/api/v1/pdf-to-word/jobs/${jobId}/download` : f.downloadUrl
      }));

      const responseData: PdfToWordJobResponse = {
        id: jobId,
        status: 'completed',
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        mode,
        totalFiles: outputFiles.length,
        files: responseFiles,
        isZip: outputFiles.length > 1,
        zipDownloadUrl: outputFiles.length > 1 ? `/api/v1/pdf-to-word/jobs/${jobId}/download` : undefined
      };

      const response: ApiResponse<PdfToWordJobResponse> = {
        success: true,
        data: responseData,
        meta: {
          requestId: req.headers['x-request-id'] as string || crypto.randomUUID(),
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
// GET /api/v1/pdf-to-word/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToWordRouter.get('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Conversion job not found or has expired. Please convert your PDF again.');
    }

    const responseFiles: ConvertedWordFileItem[] = job.files.map(f => ({
      id: f.id,
      originalFilename: f.originalFilename,
      wordFilename: f.wordFilename,
      originalSizeBytes: f.originalSize,
      wordSizeBytes: f.wordSize,
      formattedOriginalSize: formatBytes(f.originalSize),
      formattedWordSize: formatBytes(f.wordSize),
      pageCount: f.pageCount,
      modeUsed: f.modeUsed,
      downloadUrl: job.files.length === 1 ? `/api/v1/pdf-to-word/jobs/${job.id}/download` : f.downloadUrl
    }));

    const response: ApiResponse<PdfToWordJobResponse> = {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        mode: job.mode,
        totalFiles: job.files.length,
        files: responseFiles,
        isZip: job.files.length > 1,
        zipDownloadUrl: job.files.length > 1 ? `/api/v1/pdf-to-word/jobs/${job.id}/download` : undefined
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
// GET /api/v1/pdf-to-word/jobs/:jobId/download
// -----------------------------------------------------------------------------
pdfToWordRouter.get('/jobs/:jobId/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'DOWNLOAD_EXPIRED', 'The download link has expired or was not found. Please convert the document again.');
    }

    if (job.files.length === 1) {
      const file = job.files[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.wordFilename)}"`);
      res.setHeader('Content-Length', file.buffer.length);
      return res.status(200).send(file.buffer);
    }

    if (job.zipBuffer) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="converted_word_documents.zip"`);
      res.setHeader('Content-Length', job.zipBuffer.length);
      return res.status(200).send(job.zipBuffer);
    }

    throw new AppError(500, 'DOWNLOAD_ERROR', 'File buffer unavailable for download.');
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/pdf-to-word/jobs/:jobId/download/:fileId
// -----------------------------------------------------------------------------
pdfToWordRouter.get('/jobs/:jobId/download/:fileId', (req: Request, res: Response, next: NextFunction) => {
  try {
    pruneExpiredJobs();
    const { jobId, fileId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      throw new AppError(404, 'DOWNLOAD_EXPIRED', 'The download link has expired. Please convert your PDF again.');
    }

    const file = job.files.find(f => f.id === fileId);
    if (!file) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Requested file was not found in this conversion job.');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.wordFilename)}"`);
    res.setHeader('Content-Length', file.buffer.length);
    return res.status(200).send(file.buffer);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// DELETE /api/v1/pdf-to-word/jobs/:jobId
// -----------------------------------------------------------------------------
pdfToWordRouter.delete('/jobs/:jobId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const exists = jobStore.delete(jobId);

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
