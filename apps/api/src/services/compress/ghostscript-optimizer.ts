import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { CompressionProfile } from './types';

const execFileAsync = promisify(execFile);

let gsChecked = false;
let gsBinary: string | null = null;

/**
 * Probes once if Ghostscript binary (gswin64c or gs) exists on PATH
 */
export function findGhostscriptBinary(): string | null {
  if (!gsChecked) {
    const candidates = process.platform === 'win32' ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];
    const probeCmd = process.platform === 'win32' ? 'where.exe' : 'which';

    for (const bin of candidates) {
      try {
        execFileSync(probeCmd, [bin], { stdio: 'ignore' });
        gsBinary = bin;
        break;
      } catch {
        // continue search
      }
    }
    gsChecked = true;
  }
  return gsBinary;
}

/**
 * Checks if Ghostscript is explicitly enabled via environment variable
 */
export function isGhostscriptEngineEnabled(): boolean {
  return process.env.COMPRESS_ENGINE === 'ghostscript' && !!findGhostscriptBinary();
}

/**
 * Runs Ghostscript pdfwrite optimization (OFF by default, AGPL licensed)
 */
export async function runGhostscriptOptimization(
  inputBuffer: Buffer,
  profile: CompressionProfile,
  timeoutMs = 30000
): Promise<Buffer | null> {
  const binary = findGhostscriptBinary();
  if (!binary || process.env.COMPRESS_ENGINE !== 'ghostscript') {
    return null;
  }

  const tempId = crypto.randomUUID();
  const tempIn = path.join(os.tmpdir(), `gs_in_${tempId}.pdf`);
  const tempOut = path.join(os.tmpdir(), `gs_out_${tempId}.pdf`);

  try {
    await fs.promises.writeFile(tempIn, inputBuffer);

    let pdfSettings = '/ebook';
    if (profile.level === 'extreme') pdfSettings = '/screen';
    else if (profile.level === 'less') pdfSettings = '/printer';

    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${pdfSettings}`,
      '-dDownsampleColorImages=true',
      `-dColorImageResolution=${profile.maxDpi}`,
      '-dDownsampleGrayImages=true',
      `-dGrayImageResolution=${profile.maxDpi}`,
      '-dDownsampleMonoImages=true',
      `-dMonoImageResolution=${profile.maxDpi * 2}`,
      `-dJPEGQ=${profile.jpegQuality}`,
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${tempOut}`,
      tempIn
    ];

    await execFileAsync(binary, args, { timeout: timeoutMs });

    if (fs.existsSync(tempOut)) {
      const outBuf = await fs.promises.readFile(tempOut);
      return outBuf;
    }
  } catch {
    // If Ghostscript errors or fails, return null to fallback to native engine
  } finally {
    try {
      if (fs.existsSync(tempIn)) await fs.promises.unlink(tempIn);
      if (fs.existsSync(tempOut)) await fs.promises.unlink(tempOut);
    } catch {
      // Ignore cleanup error
    }
  }

  return null;
}
