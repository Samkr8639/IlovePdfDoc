import { execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';
import { AppError } from '../../middleware/errorHandler';
import { OfficeConversionOptions, OfficeConversionResult, OfficeProfile } from './types';

const execFileAsync = promisify(execFile);

// ──────────────────────────────────────────────────────────────
// Configuration & Binary Detection
// ──────────────────────────────────────────────────────────────

export function getSofficeBinary(): string {
  if (process.env['SOFFICE_PATH']) {
    return process.env['SOFFICE_PATH'];
  }
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return 'soffice';
}

const DEFAULT_TIMEOUT_MS = parseInt(process.env['OFFICE_TO_PDF_TIMEOUT_MS'] || '90000', 10);

let libreOfficeVersion: string | null = null;
let libreOfficeAvailable = false;
let libreOfficeChecked = false;

export async function checkLibreOffice(): Promise<{ available: boolean; version: string | null }> {
  if (libreOfficeChecked) {
    return { available: libreOfficeAvailable, version: libreOfficeVersion };
  }
  try {
    const binary = getSofficeBinary();
    const { stdout } = await execFileAsync(binary, ['--version'], { timeout: 10000 });
    libreOfficeVersion = stdout.trim();
    libreOfficeAvailable = true;
  } catch {
    libreOfficeAvailable = false;
    libreOfficeVersion = null;
  }
  libreOfficeChecked = true;
  return { available: libreOfficeAvailable, version: libreOfficeVersion };
}

export function killProcessTree(pid: number): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Concurrency Pool
// ──────────────────────────────────────────────────────────────

export class OfficeConversionPool {
  private activeCount = 0;
  private queue: Array<() => void> = [];
  public readonly maxConcurrent: number;
  public readonly maxQueueSize: number;

  constructor(maxConcurrent = 2, maxQueueSize = 20) {
    this.maxConcurrent = parseInt(process.env['OFFICE_POOL_CONCURRENCY'] || String(maxConcurrent), 10);
    this.maxQueueSize = parseInt(process.env['OFFICE_POOL_MAX_QUEUE'] || String(maxQueueSize), 10);
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      const err = new AppError(499, 'CLIENT_DISCONNECTED', 'Request aborted by client');
      throw err;
    }

    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.activeCount--;
          this.dispatchNext();
        }
      };
    }

    if (this.queue.length >= this.maxQueueSize) {
      const err = new AppError(
        503,
        'SERVER_BUSY',
        'Server is busy converting office documents. Please retry in a few moments.'
      );
      (err as any).retryAfter = 5;
      throw err;
    }

    return new Promise((resolve, reject) => {
      const onAcquired = () => {
        signal?.removeEventListener('abort', abortHandler);
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.activeCount--;
            this.dispatchNext();
          }
        });
      };

      const abortHandler = () => {
        const idx = this.queue.indexOf(onAcquired);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(new AppError(499, 'CLIENT_DISCONNECTED', 'Request aborted by client'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      this.queue.push(onAcquired);
    });
  }

  private dispatchNext(): void {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      this.activeCount++;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const globalOfficePool = new OfficeConversionPool();

// ──────────────────────────────────────────────────────────────
// User Profile Generator (Security Hardening)
// ──────────────────────────────────────────────────────────────

export async function createIsolatedProfile(
  profileDir: string,
  profileType: OfficeProfile,
  allowRecalculation = false
): Promise<void> {
  const userDir = path.join(profileDir, 'user');
  await fs.promises.mkdir(userDir, { recursive: true });

  const recalcVal = allowRecalculation ? '1' : '0';

  const xcu = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- Macros disabled with highest security level -->
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="WarnExec" oor:op="fuse"><value>true</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>

  <!-- External link updating disabled -->
  <item oor:path="/org.openoffice.Office.Common/Security/ExternalLinks"><prop oor:name="LinkUpdateMode" oor:op="fuse"><value>0</value></prop></item>

  <!-- Calc load option: never recalculate formula results on load (use Excel's cached values) unless requested -->
  <item oor:path="/org.openoffice.Office.Calc/Calculate/Other"><prop oor:name="RecalculateOnLoad" oor:op="fuse"><value>${recalcVal}</value></prop></item>

  <!-- Disable UI tips, first-run wizards, and online update checks -->
  <item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="ShowTipOfTheDay" oor:op="fuse"><value>false</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="FirstRun" oor:op="fuse"><value>false</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/AutoInstall"><prop oor:name="Enabled" oor:op="fuse"><value>false</value></prop></item>
</oor:items>`;

  await fs.promises.writeFile(path.join(userDir, 'registrymodifications.xcu'), xcu, 'utf8');
}

// ──────────────────────────────────────────────────────────────
// Core Execution Runner
// ──────────────────────────────────────────────────────────────

export async function runSofficeConversion(
  buffer: Buffer,
  extension: string,
  prefix: string,
  options: OfficeConversionOptions
): Promise<OfficeConversionResult> {
  const { available } = await checkLibreOffice();
  if (!available) {
    throw new AppError(
      503,
      'ENGINE_UNAVAILABLE',
      'PDF conversion engine (LibreOffice) is not available on this server.'
    );
  }

  const releasePool = await globalOfficePool.acquire(options.abortSignal);

  const jobId = `${prefix}-${crypto.randomUUID()}`;
  const tmpDir = path.join(os.tmpdir(), jobId);
  const profileDir = path.join(os.tmpdir(), `${jobId}-profile`);

  let childProcess: ChildProcess | null = null;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });
    await fs.promises.mkdir(profileDir, { recursive: true });

    // Initialize hardened user profile
    await createIsolatedProfile(profileDir, options.profile, options.allowRecalculation);

    // Save input file with safe name
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    const inputPath = path.join(tmpDir, `input${ext}`);
    await fs.promises.writeFile(inputPath, buffer);

    const cleanProfile = profileDir.split(path.sep).join('/');
    const args = [
      `-env:UserInstallation=file:///${cleanProfile}`,
      '--headless',
      '--norestore',
      '--convert-to',
      options.filterString,
      '--outdir',
      tmpDir,
      inputPath
    ];

    const binary = getSofficeBinary();

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (childProcess && childProcess.pid) {
          killProcessTree(childProcess.pid);
        }
        reject(new AppError(499, 'CLIENT_DISCONNECTED', 'Conversion aborted by client'));
      };

      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          onAbort();
          return;
        }
        options.abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      timer = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (childProcess && childProcess.pid) {
          killProcessTree(childProcess.pid);
        }
        reject(
          new AppError(
            504,
            'CONVERSION_TIMEOUT',
            'Conversion timed out. The document may be too large or complex.'
          )
        );
      }, timeoutMs);

      childProcess = execFile(
        binary,
        args,
        {
          env: {
            ...process.env,
            http_proxy: 'http://127.0.0.1:0',
            https_proxy: 'http://127.0.0.1:0',
            HOME: profileDir
          }
        },
        (error) => {
          if (isSettled) return;
          isSettled = true;
          cleanup();

          if (error) {
            reject(
              new AppError(
                422,
                'CONVERSION_FAILED',
                `Conversion failed: ${error.message || 'LibreOffice process error'}`
              )
            );
            return;
          }
          resolve();
        }
      );
    });

    const basename = path.basename(inputPath, ext);
    const pdfPath = path.join(tmpDir, `${basename}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new AppError(
        422,
        'CONVERSION_FAILED',
        'Conversion produced no output PDF. The document may be damaged or unsupported.'
      );
    }

    const pdfBuffer = await fs.promises.readFile(pdfPath);
    if (!pdfBuffer || pdfBuffer.length < 100) {
      throw new AppError(422, 'CONVERSION_FAILED', 'Conversion produced an empty PDF.');
    }

    if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError(422, 'CONVERSION_FAILED', 'Conversion did not produce a valid PDF.');
    }

    const pageCount = estimatePageCount(pdfBuffer);

    return {
      pdfBuffer,
      pageCount,
      warnings: []
    };
  } finally {
    releasePool();
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function estimatePageCount(pdfBuffer: Buffer): number {
  try {
    const text = pdfBuffer.toString('latin1', 0, Math.min(pdfBuffer.length, 65536));
    const match = text.match(/\/Count\s+(\d+)/);
    if (match) return parseInt(match[1], 10);
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches) return pageMatches.length;
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
