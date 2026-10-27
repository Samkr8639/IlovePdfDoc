import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import zlib from 'zlib';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import {
  PDFDocument,
  PDFName,
  PDFRef,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFStream,
  PDFObject
} from 'pdf-lib';
import { CompressionProfile } from './types';

const execFileAsync = promisify(execFile);

let qpdfChecked = false;
let isQpdfInstalled = false;

/**
 * Checks once at startup if qpdf binary is available on system PATH
 */
export function checkQpdfAvailable(): boolean {
  if (!qpdfChecked) {
    try {
      const probeCmd = process.platform === 'win32' ? 'where.exe' : 'which';
      execFileSync(probeCmd, ['qpdf'], { stdio: 'ignore' });
      isQpdfInstalled = true;
    } catch {
      isQpdfInstalled = false;
    }
    qpdfChecked = true;
  }
  return isQpdfInstalled;
}

/**
 * Executes qpdf optimization with args array, timeout, and temporary file cleanup
 */
export async function runQpdfOptimization(
  inputBuffer: Buffer,
  timeoutMs = 15000
): Promise<Buffer | null> {
  if (!checkQpdfAvailable()) return null;

  const tempId = crypto.randomUUID();
  const tempIn = path.join(os.tmpdir(), `paperflow_in_${tempId}.pdf`);
  const tempOut = path.join(os.tmpdir(), `paperflow_out_${tempId}.pdf`);

  try {
    await fs.promises.writeFile(tempIn, inputBuffer);

    const args = [
      '--object-streams=generate',
      '--recompress-flate',
      '--compression-level=9',
      '--normalize-content=n',
      tempIn,
      tempOut
    ];

    await execFileAsync('qpdf', args, { timeout: timeoutMs });

    if (fs.existsSync(tempOut)) {
      const outBuffer = await fs.promises.readFile(tempOut);
      return outBuffer;
    }
  } catch {
    // If qpdf fails or times out, safely return null to keep pure JS output
  } finally {
    try {
      if (fs.existsSync(tempIn)) await fs.promises.unlink(tempIn);
      if (fs.existsSync(tempOut)) await fs.promises.unlink(tempOut);
    } catch {
      // Ignore temporary file cleanup errors
    }
  }

  return null;
}

/**
 * Performs comprehensive lossless structural optimization directly in pdf-lib
 */
export async function optimizePdfStructure(
  doc: PDFDocument,
  profile: CompressionProfile
): Promise<void> {
  const context = doc.context;
  const indirectObjects = context.enumerateIndirectObjects();

  // 1. Traverse reachability to identify and purge unreachable orphan objects
  const reachableRefs = new Set<string>();
  const queue: PDFObject[] = [];

  const trailer = (context as any).trailerInfo;
  if (trailer?.Root) {
    reachableRefs.add(trailer.Root.toString());
    queue.push(trailer.Root);
  }
  if (trailer?.Info && !profile.stripMetadata) {
    reachableRefs.add(trailer.Info.toString());
    queue.push(trailer.Info);
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    let actualObj: PDFObject = item;
    if (item instanceof PDFRef) {
      reachableRefs.add(item.toString());
      actualObj = context.lookup(item) as PDFObject;
    }

    if (!actualObj) continue;

    if (actualObj instanceof PDFDict) {
      for (const [, val] of actualObj.entries()) {
        if (val instanceof PDFRef) {
          if (!reachableRefs.has(val.toString())) {
            reachableRefs.add(val.toString());
            queue.push(val);
          }
        } else if (val instanceof PDFDict || val instanceof PDFArray) {
          queue.push(val);
        }
      }
    } else if (actualObj instanceof PDFArray) {
      for (let i = 0; i < actualObj.size(); i++) {
        const val = actualObj.get(i);
        if (val instanceof PDFRef) {
          if (!reachableRefs.has(val.toString())) {
            reachableRefs.add(val.toString());
            queue.push(val);
          }
        } else if (val instanceof PDFDict || val instanceof PDFArray) {
          queue.push(val);
        }
      }
    } else if (actualObj instanceof PDFRawStream || actualObj instanceof PDFStream) {
      if (actualObj.dict) {
        queue.push(actualObj.dict);
      }
    }
  }

  // Delete unreachable indirect objects
  for (const [ref] of indirectObjects) {
    if (!reachableRefs.has(ref.toString())) {
      context.delete(ref);
    }
  }

  // 2. Drop thumbnails, PieceInfo, and private application data
  for (const page of doc.getPages()) {
    const pageNode = page.node;
    if (pageNode.get(PDFName.of('Thumb'))) {
      pageNode.delete(PDFName.of('Thumb'));
    }
    if (profile.removePieceInfo && pageNode.get(PDFName.of('PieceInfo'))) {
      pageNode.delete(PDFName.of('PieceInfo'));
    }
  }

  const catalog = doc.catalog;
  if (profile.removePieceInfo && catalog.get(PDFName.of('PieceInfo'))) {
    catalog.delete(PDFName.of('PieceInfo'));
  }

  // 3. Strip metadata if extreme profile requested
  if (profile.stripMetadata) {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('');
    doc.setCreator('');
    if (catalog.get(PDFName.of('Metadata'))) {
      catalog.delete(PDFName.of('Metadata'));
    }
  }

  // 4. Optimize /DefaultRGB ICC profiles to standard DeviceRGB where safe
  if (profile.optimizeIcc) {
    for (const page of doc.getPages()) {
      const res = page.node.Resources();
      const csDict = res?.lookup(PDFName.of('ColorSpace'));
      if (csDict instanceof PDFDict) {
        const defaultRgb = csDict.get(PDFName.of('DefaultRGB'));
        if (defaultRgb instanceof PDFArray) {
          const first = defaultRgb.get(0)?.toString();
          if (first === '/ICCBased') {
            csDict.set(PDFName.of('DefaultRGB'), PDFName.of('DeviceRGB'));
          }
        }
      }
    }
  }

  // 5. Recompress uncompressed Flate content streams at level 9
  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const filter = obj.dict?.get(PDFName.of('Filter'))?.toString();
      if (filter?.includes('FlateDecode') && obj.contents && obj.contents.length > 512) {
        try {
          const uncompressed = zlib.inflateSync(Buffer.from(obj.contents));
          const recompressed = zlib.deflateSync(uncompressed, { level: 9 });
          if (recompressed.length < obj.contents.length) {
            (obj as any).contents = new Uint8Array(recompressed);
            obj.dict.set(PDFName.of('Length'), PDFName.of(recompressed.length.toString()));
          }
        } catch {
          // Keep original stream if already optimal or custom predictor
        }
      }
    }
  }
}
