import { Injectable } from '@angular/core';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
import { PdfPageBoxMetrics, SIGN_PDF_LIMITS } from '@paperflow/contracts';
import { extractPageBoxMetrics } from '@paperflow/sign-core';
import { PdfInspectionSummary } from './sign-pdf.models';

@Injectable({
  providedIn: 'root'
})
export class PdfInspectionService {
  /** Validates PDF magic bytes and size limit without trusting file extensions. */
  validatePdfMagicAndSize(file: File, bytes: Uint8Array, maxBytes: number = SIGN_PDF_LIMITS.clientMaxFileSizeBytes): void {
    if (!file || bytes.length === 0) {
      throw new Error('The selected file is empty.');
    }
    if (bytes.length > maxBytes) {
      const limitMb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(`File exceeds maximum allowed size (${limitMb} MB).`);
    }
    const headerSlice = bytes.subarray(0, Math.min(1024, bytes.length));
    const headerStr = new TextDecoder('latin1').decode(headerSlice);
    if (!headerStr.includes('%PDF-')) {
      throw new Error('Invalid PDF file header (%PDF- signature missing).');
    }
  }

  /**
   * Inspects raw PDF bytes for existing digital signatures (/ByteRange / /Sig / /FT /Sig),
   * interactive AcroForm fields, encryption, and exact CropBox / UserUnit / Rotate per page.
   */
  async inspectPdf(bytes: Uint8Array): Promise<PdfInspectionSummary> {
    const rawSample = new TextDecoder('latin1').decode(bytes);
    const hasRawSignatureMarkers = /\/ByteRange\b/.test(rawSample) && /\/Type\s*\/Sig\b|\/FT\s*\/Sig\b/.test(rawSample);

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.toLowerCase().includes('encrypted')) {
        return {
          pageCount: 0,
          hasExistingDigitalSignatures: hasRawSignatureMarkers,
          hasAcroFormFields: false,
          acroFormFieldCount: 0,
          isEncrypted: true,
          pagesMeta: []
        };
      }
      throw new Error('Could not parse PDF structure. The file may be damaged.');
    }

    const pages = pdfDoc.getPages();
    if (pages.length > SIGN_PDF_LIMITS.clientMaxPages) {
      throw new Error(`This PDF has ${pages.length} pages, which exceeds the ${SIGN_PDF_LIMITS.clientMaxPages}-page limit.`);
    }

    let acroFormFieldCount = 0;
    let hasSigField = hasRawSignatureMarkers;

    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      acroFormFieldCount = fields.length;
      for (const f of fields) {
        const dict = f.acroField.dict;
        if (dict instanceof PDFDict) {
          const ft = dict.lookup(PDFName.of('FT'));
          if (ft && ft.toString() === '/Sig') {
            hasSigField = true;
          }
          const v = dict.lookup(PDFName.of('V'));
          if (v instanceof PDFDict && v.lookup(PDFName.of('ByteRange'))) {
            hasSigField = true;
          }
        }
      }
    } catch {
      // Malformed/non-standard AcroForm ignored safely; raw marker check still applies
    }

    const pagesMeta: PdfPageBoxMetrics[] = pages.map((p, idx) => extractPageBoxMetrics(p, idx));
    return {
      pageCount: pages.length,
      hasExistingDigitalSignatures: hasSigField,
      hasAcroFormFields: acroFormFieldCount > 0,
      acroFormFieldCount,
      isEncrypted: false,
      pagesMeta
    };
  }
}
