/**
 * Word to PDF conversion service using LibreOffice headless.
 *
 * Security principles:
 *  - Only execFile() with an args array is used — never exec() / shell string
 *  - Each job gets an isolated temp directory with a unique profile
 *  - No outbound network calls from LibreOffice (macros disabled, no online updates)
 *  - Temp dirs are always cleaned up (finally blocks)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';
import { AppError } from '../../middleware/errorHandler';

const execFileAsync = promisify(execFile);

// ──────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────

const SOFFICE_PATH =
  process.env['SOFFICE_PATH'] ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
    : 'soffice');

const CONVERSION_TIMEOUT_MS = parseInt(process.env['WORD_TO_PDF_TIMEOUT_MS'] || '90000', 10);

// ──────────────────────────────────────────────────────────────
// LibreOffice availability detection
// ──────────────────────────────────────────────────────────────

let libreOfficeVersion: string | null = null;
let libreOfficeAvailable = false;
let libreOfficeChecked = false;

export async function checkLibreOffice(): Promise<{ available: boolean; version: string | null }> {
  if (libreOfficeChecked) {
    return { available: libreOfficeAvailable, version: libreOfficeVersion };
  }
  try {
    const { stdout } = await execFileAsync(SOFFICE_PATH, ['--version'], { timeout: 10000 });
    libreOfficeVersion = stdout.trim();
    libreOfficeAvailable = true;
  } catch {
    libreOfficeAvailable = false;
    libreOfficeVersion = null;
  }
  libreOfficeChecked = true;
  return { available: libreOfficeAvailable, version: libreOfficeVersion };
}

// ──────────────────────────────────────────────────────────────
// Input Validation
// ──────────────────────────────────────────────────────────────

export interface ValidatedWordFile {
  buffer: Buffer;
  originalname: string;
  extension: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.doc', '.docx', '.odt', '.rtf']);
const SUPPORTED_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/rtf'
]);

export function validateWordFile(
  buffer: Buffer,
  originalname: string,
  mimetype?: string
): void {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'ZERO_BYTE_FILE', `The file '${originalname}' is empty.`);
  }

  const ext = path.extname(originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      `Unsupported file type '${ext}'. Please upload a .doc, .docx, .odt, or .rtf file.`
    );
  }

  // Mime type is advisory — do not block on it since browsers report inconsistently
  if (mimetype && !SUPPORTED_MIMES.has(mimetype) && mimetype !== 'application/octet-stream') {
    // warn but allow through — LibreOffice is the real validator
  }

  // ZIP signature check for .docx / .odt (OOXML/ODF are both ZIP archives)
  if (ext === '.docx' || ext === '.odt') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid ${ext.toUpperCase()} document.`
      );
    }
  }

  // OLE2 magic for .doc
  if (ext === '.doc') {
    if (
      buffer[0] !== 0xd0 || buffer[1] !== 0xcf ||
      buffer[2] !== 0x11 || buffer[3] !== 0xe0
    ) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid .doc file.`
      );
    }
  }

  // RTF magic
  if (ext === '.rtf') {
    const start = buffer.subarray(0, 5).toString('ascii');
    if (!start.startsWith('{\\rtf')) {
      throw new AppError(
        415,
        'INVALID_FILE_CONTENT',
        `The file '${originalname}' does not appear to be a valid RTF document.`
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Conversion
// ──────────────────────────────────────────────────────────────

export interface ConversionResult {
  pdfBuffer: Buffer;
  pageCount: number;
  fontsSubstituted: string[];
  warnings: string[];
}

export interface ConversionOptions {
  output?: 'pdf' | 'pdfa';
  imageQuality?: 'standard' | 'smaller';
  embedBookmarks?: boolean;
  useTaggedPdf?: boolean;
  exportHyperlinks?: boolean;
}

export async function convertWordToPdf(
  buffer: Buffer,
  originalname: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const { available } = await checkLibreOffice();
  if (!available) {
    throw new AppError(
      503,
      'ENGINE_UNAVAILABLE',
      'PDF conversion engine (LibreOffice) is not available on this server.'
    );
  }

  const jobId = `wtp-${crypto.randomUUID()}`;
  const tmpDir = path.join(os.tmpdir(), jobId);
  const profileDir = path.join(os.tmpdir(), `${jobId}-profile`);

  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });
    await fs.promises.mkdir(profileDir, { recursive: true });

    // Save input file with its proper extension
    const ext = path.extname(originalname).toLowerCase() || '.docx';
    const inputPath = path.join(tmpDir, `input${ext}`);
    await fs.promises.writeFile(inputPath, buffer);

    // Build LibreOffice filter options for PDF export
    const filterOpts = buildFilterOptions(options);
    const filterString = `pdf:writer_pdf_Export:${JSON.stringify(filterOpts)}`;

    // Build the LibreOffice command arguments (NO shell string — args array only)
    const args = [
      `--env:UserInstallation=file:///${profileDir.replace(/\\/g, '/')}`,
      '--headless',
      '--norestore',
      '--nofirststartwizard',
      '--convert-to',
      filterString,
      '--outdir',
      tmpDir,
      inputPath
    ];

    await execFileAsync(SOFFICE_PATH, args, {
      timeout: CONVERSION_TIMEOUT_MS,
      env: {
        ...process.env,
        // Prevent LibreOffice from connecting to the network
        http_proxy: 'http://127.0.0.1:0',
        https_proxy: 'http://127.0.0.1:0',
        HOME: profileDir
      }
    });

    // Locate the output PDF (LibreOffice uses the same basename)
    const basename = path.basename(inputPath, ext);
    const pdfPath = path.join(tmpDir, `${basename}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new AppError(
        422,
        'CONVERSION_FAILED',
        `Conversion produced no output for '${originalname}'. The file may be corrupted or in an unsupported format.`
      );
    }

    const pdfBuffer = await fs.promises.readFile(pdfPath);

    if (!pdfBuffer || pdfBuffer.length < 100) {
      throw new AppError(
        422,
        'CONVERSION_FAILED',
        `Conversion of '${originalname}' produced an empty PDF.`
      );
    }

    if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError(
        422,
        'CONVERSION_FAILED',
        `Conversion of '${originalname}' did not produce a valid PDF.`
      );
    }

    // Best-effort page count via %% markers (LibreOffice includes /Pages in cross-reference)
    const pageCount = estimatePageCount(pdfBuffer);

    return {
      pdfBuffer,
      pageCount,
      fontsSubstituted: [], // LibreOffice does not easily expose font substitutions
      warnings: []
    };
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const e = err as NodeJS.ErrnoException & { code?: string; statusCode?: number; killed?: boolean };

    if (e.statusCode) throw err;

    if (e.killed || String(e.message).toLowerCase().includes('timed out')) {
      throw new AppError(
        504,
        'CONVERSION_TIMEOUT',
        `Conversion of '${originalname}' timed out. Please try with a simpler document.`
      );
    }

    throw new AppError(
      422,
      'CONVERSION_FAILED',
      `Failed to convert '${originalname}': ${e.message || 'Unknown error'}`
    );
  } finally {
    // Always clean up temp dirs
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function buildFilterOptions(options: ConversionOptions): Record<string, unknown> {
  const opts: Record<string, unknown> = {};

  // PDF/A compliance
  if (options.output === 'pdfa') {
    opts['SelectPdfVersion'] = 1; // PDF/A-1b
    opts['UseTaggedPDF'] = true;
  }

  // Image quality
  if (options.imageQuality === 'smaller') {
    opts['ReduceImageResolution'] = true;
    opts['MaxImageResolution'] = 150;
    opts['Quality'] = 75;
  } else {
    opts['Quality'] = 90;
  }

  // Bookmarks
  if (options.embedBookmarks !== undefined) {
    opts['ExportBookmarks'] = options.embedBookmarks;
  }

  // Tagged PDF (accessibility)
  if (options.useTaggedPdf !== undefined) {
    opts['UseTaggedPDF'] = options.useTaggedPdf;
  }

  // Hyperlinks
  if (options.exportHyperlinks !== undefined) {
    opts['ExportLinksRelativeFsys'] = false;
  }

  return opts;
}

function estimatePageCount(pdfBuffer: Buffer): number {
  try {
    // Look for /Count N in the /Pages dictionary — a best-effort count
    const text = pdfBuffer.toString('latin1', 0, Math.min(pdfBuffer.length, 65536));
    const match = text.match(/\/Count\s+(\d+)/);
    if (match) return parseInt(match[1], 10);
  } catch {
    // ignore
  }
  return 1;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

