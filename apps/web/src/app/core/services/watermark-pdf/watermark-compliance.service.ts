import { Injectable } from '@angular/core';

export interface WatermarkComplianceReport {
  isPdfA: boolean;
  isPdfA1: boolean;
  isPdfX: boolean;
  hasSignatures: boolean;
  isEncrypted: boolean;
  hasXfa: boolean;
  hasCmyk: boolean;
  conformanceLevel: string | null;
  warningMessage: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkComplianceService {
  /**
   * Scans PDF byte array for PDF/A, PDF/X, digital signatures, encryption, XFA, and CMYK indicators.
   */
  checkCompliance(pdfBytes: Uint8Array): WatermarkComplianceReport {
    const report: WatermarkComplianceReport = {
      isPdfA: false,
      isPdfA1: false,
      isPdfX: false,
      hasSignatures: false,
      isEncrypted: false,
      hasXfa: false,
      hasCmyk: false,
      conformanceLevel: null,
      warningMessage: null
    };

    if (!pdfBytes || pdfBytes.length === 0) {
      return report;
    }

    try {
      const sampleSize = Math.min(pdfBytes.length, 512 * 1024);
      const textSample = new TextDecoder('latin1').decode(pdfBytes.subarray(0, sampleSize));

      // 1. Digital Signatures Check (R-044)
      const hasSig =
        /\/ByteRange\b/.test(textSample) &&
        (/\/Type\s*\/Sig\b/.test(textSample) || /\/FT\s*\/Sig\b/.test(textSample));
      if (hasSig) {
        report.hasSignatures = true;
      }

      // 2. Encryption / Password Check (R-045)
      if (/\/Encrypt\b/.test(textSample)) {
        report.isEncrypted = true;
      }

      // 3. Dynamic XFA Form Check (R-046)
      if (/\/XFA\b/.test(textSample)) {
        report.hasXfa = true;
      }

      // 4. CMYK Color Space Check (R-047)
      if (textSample.includes('/DeviceCMYK') || textSample.includes('/DefaultCMYK')) {
        report.hasCmyk = true;
      }

      // 5. PDF/A Checks (R-041)
      const pdfaPartMatch = textSample.match(/pdfaid:part[=>"'\s]+([1-4])/i);
      const isPdfA1Direct =
        textSample.includes('GTS_PDFA1') ||
        textSample.includes('PDF/A-1') ||
        (pdfaPartMatch && pdfaPartMatch[1] === '1');

      if (isPdfA1Direct) {
        report.isPdfA = true;
        report.isPdfA1 = true;
        report.conformanceLevel = 'PDF/A-1';
        report.warningMessage =
          'This PDF conforms to PDF/A-1. Adding a transparent watermark will convert it to standard PDF/1.7 and invalidate strict PDF/A-1 compliance.';
        return report;
      }

      if (pdfaPartMatch) {
        report.isPdfA = true;
        report.conformanceLevel = `PDF/A-${pdfaPartMatch[1]}`;
      }

      // 6. PDF/X Checks
      if (textSample.includes('GTS_PDFX') || textSample.includes('PDF/X-')) {
        report.isPdfX = true;
        report.warningMessage =
          'This PDF conforms to PDF/X print specifications. Watermarking may alter print profile conformance.';
      }
    } catch {
      // Non-blocking fallback
    }

    return report;
  }
}
