import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import {
  PdfPageBoxMetrics,
  SIGN_ERROR_CODES,
  SIGN_PDF_LIMITS,
  normalizePageRotation
} from '@paperflow/contracts';
import { AppError } from '../../middleware/errorHandler';

export interface SanitisedPdfResult {
  cleanBytes: Uint8Array;
  pageCount: number;
  pagesMeta: PdfPageBoxMetrics[];
  strippedActiveContentCount: number;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.byteLength < 5) return false;
  for (let i = 0; i < 5; i++) {
    if (bytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Validates magic header, size, encryption status, and page bounds,
 * and strips potentially executable PDF structures (/JS, /JavaScript, /OpenAction, /AA, /Launch, /EmbeddedFiles).
 */
export async function sanitiseUploadedPdf(rawBytes: Uint8Array): Promise<SanitisedPdfResult> {
  if (!rawBytes || rawBytes.byteLength === 0) {
    throw new AppError(
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.status,
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.code,
      'Uploaded PDF file is empty.'
    );
  }

  if (rawBytes.byteLength > SIGN_PDF_LIMITS.serverMaxFileSizeBytes) {
    throw new AppError(
      SIGN_ERROR_CODES.FILE_TOO_LARGE.status,
      SIGN_ERROR_CODES.FILE_TOO_LARGE.code,
      'PDF exceeds the 25 MB limit for signature requests.'
    );
  }

  if (!hasPdfMagicBytes(rawBytes)) {
    throw new AppError(
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.status,
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.code,
      'Invalid PDF file signature (%PDF- magic bytes missing).'
    );
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(rawBytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('encrypt') || err?.name === 'EncryptedPDFError') {
      throw new AppError(
        SIGN_ERROR_CODES.ENCRYPTED_DOCUMENT.status,
        SIGN_ERROR_CODES.ENCRYPTED_DOCUMENT.code,
        'Password-protected PDFs cannot be sent for signature requests. Decrypt or unlock the PDF first.'
      );
    }
    throw new AppError(
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.status,
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.code,
      'Uploaded PDF could not be parsed.'
    );
  }

  if (doc.isEncrypted) {
    throw new AppError(
      SIGN_ERROR_CODES.ENCRYPTED_DOCUMENT.status,
      SIGN_ERROR_CODES.ENCRYPTED_DOCUMENT.code,
      'Encrypted PDFs are not supported for signature requests.'
    );
  }

  const pageCount = doc.getPageCount();
  if (pageCount < 1) {
    throw new AppError(
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.status,
      SIGN_ERROR_CODES.UNSUPPORTED_FILE.code,
      'PDF contains zero pages.'
    );
  }
  if (pageCount > SIGN_PDF_LIMITS.serverMaxPages) {
    throw new AppError(
      SIGN_ERROR_CODES.TOO_MANY_PAGES.status,
      SIGN_ERROR_CODES.TOO_MANY_PAGES.code,
      `Signature requests support up to ${SIGN_PDF_LIMITS.serverMaxPages} pages.`
    );
  }

  let stripped = 0;

  // Strip catalog-level scripts, launch actions, and embedded files
  const catalog = doc.catalog;
  for (const keyName of ['OpenAction', 'AA', 'JS', 'JavaScript']) {
    const key = PDFName.of(keyName);
    if (catalog.has(key)) {
      catalog.delete(key);
      stripped++;
    }
  }

  const namesObj = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  if (namesObj) {
    for (const sub of ['JavaScript', 'EmbeddedFiles']) {
      const subKey = PDFName.of(sub);
      if (namesObj.has(subKey)) {
        namesObj.delete(subKey);
        stripped++;
      }
    }
  }

  // Strip page-level triggers (/AA) & inspect active annotations (/Launch, /JavaScript)
  const pages = doc.getPages();
  const pagesMeta: PdfPageBoxMetrics[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page.node.has(PDFName.of('AA'))) {
      page.node.delete(PDFName.of('AA'));
      stripped++;
    }

    const annots = doc.context.lookupMaybe(page.node.get(PDFName.of('Annots')), PDFArray);
    if (annots) {
      for (let idx = annots.size() - 1; idx >= 0; idx--) {
        const annotDict = doc.context.lookupMaybe(annots.get(idx), PDFDict);
        if (!annotDict) continue;
        const actionDict = annotDict.lookupMaybe(PDFName.of('A'), PDFDict);
        if (actionDict) {
          const s = actionDict.get(PDFName.of('S'))?.toString();
          if (s === '/JavaScript' || s === '/Launch' || s === '/SubmitForm' || s === '/ImportData') {
            annotDict.delete(PDFName.of('A'));
            stripped++;
          }
        }
        if (annotDict.has(PDFName.of('AA'))) {
          annotDict.delete(PDFName.of('AA'));
          stripped++;
        }
      }
    }

    const crop = page.getCropBox();
    const rawRot = page.getRotation().angle;
    const rawUserUnit = (page.node.get(PDFName.of('UserUnit')) as any)?.asNumber?.();
    pagesMeta.push({
      pageIndex: i,
      widthPt: crop.width,
      heightPt: crop.height,
      rotation: normalizePageRotation(rawRot),
      cropBoxXPt: crop.x,
      cropBoxYPt: crop.y,
      userUnit: typeof rawUserUnit === 'number' && rawUserUnit > 0 ? rawUserUnit : 1.0
    });
  }

  const cleanBytes = await doc.save({ useObjectStreams: true });
  return {
    cleanBytes,
    pageCount,
    pagesMeta,
    strippedActiveContentCount: stripped
  };
}
