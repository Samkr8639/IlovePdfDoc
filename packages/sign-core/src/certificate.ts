import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AuditLogEntry } from '@paperflow/contracts';

export interface CertificateSignerSummary {
  name: string;
  email: string;
  status: string;
  signedAtUtc?: string;
  ip?: string;
  userAgent?: string;
}

export interface CertificateOfCompletionInput {
  requestId: string;
  title: string;
  senderName: string;
  senderEmail: string;
  createdAtUtc: string;
  completedAtUtc: string;
  originalSha256: string;
  finalSha256: string;
  signers: CertificateSignerSummary[];
  auditLog: AuditLogEntry[];
  appName?: string;
}

function safeAscii(value: string): string {
  return (value || '').replace(/[^\x20-\x7E]/g, '?');
}

/**
 * Appends a branded PDFTailor Certificate of Completion page (plus truncated audit event table)
 * to an already-signed PDF, or builds a standalone certificate PDF.
 */
export async function appendCertificateOfCompletionPage(
  signedPdfBytes: Uint8Array | null,
  input: CertificateOfCompletionInput
): Promise<Uint8Array> {
  const doc = signedPdfBytes
    ? await PDFDocument.load(signedPdfBytes, { ignoreEncryption: true })
    : await PDFDocument.create();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.078, 0.129, 0.239); // #14213D
  const teal = rgb(0.059, 0.463, 0.431); // #0F766E
  const muted = rgb(0.294, 0.333, 0.388); // #4B5563
  const border = rgb(0.894, 0.906, 0.925); // #E4E7EC
  const appName = input.appName || 'PDFTailor';

  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  let y = 795;

  // Header band
  page.drawRectangle({ x: 40, y: y - 16, width: 515.28, height: 38, color: navy });
  page.drawText(`${safeAscii(appName)} - Certificate of Completion`, {
    x: 54,
    y: y - 3,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  y -= 44;

  // Request metadata block
  page.drawText(safeAscii(input.title), { x: 40, y, size: 13, font: fontBold, color: navy });
  y -= 18;
  page.drawText(`Request ID: ${safeAscii(input.requestId)}`, { x: 40, y, size: 9, font: fontRegular, color: muted });
  page.drawText(`Completed UTC: ${safeAscii(input.completedAtUtc)}`, { x: 310, y, size: 9, font: fontRegular, color: muted });
  y -= 14;
  page.drawText(`Originator: ${safeAscii(input.senderName)} <${safeAscii(input.senderEmail)}>`, {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: muted
  });
  y -= 18;

  // Integrity hashes
  page.drawRectangle({ x: 40, y: y - 38, width: 515.28, height: 42, color: rgb(0.965, 0.973, 0.98), borderColor: border, borderWidth: 1 });
  page.drawText(`Original PDF SHA-256: ${safeAscii(input.originalSha256)}`, {
    x: 50,
    y: y - 13,
    size: 8,
    font: fontRegular,
    color: navy
  });
  page.drawText(`Signed PDF SHA-256:   ${safeAscii(input.finalSha256)}`, {
    x: 50,
    y: y - 28,
    size: 8,
    font: fontRegular,
    color: navy
  });
  y -= 58;

  // Signers summary table
  page.drawText('Signer Record', { x: 40, y, size: 11, font: fontBold, color: teal });
  y -= 16;
  for (const s of input.signers) {
    if (y < 140) break;
    page.drawRectangle({ x: 40, y: y - 28, width: 515.28, height: 32, borderColor: border, borderWidth: 1 });
    page.drawText(`${safeAscii(s.name)} <${safeAscii(s.email)}>`, { x: 50, y: y - 10, size: 9.5, font: fontBold, color: navy });
    page.drawText(`Status: ${safeAscii(s.status)}  |  UTC: ${safeAscii(s.signedAtUtc || '-')}`, {
      x: 50,
      y: y - 22,
      size: 8.5,
      font: fontRegular,
      color: muted
    });
    if (s.ip) {
      page.drawText(`IP: ${safeAscii(s.ip)}`, { x: 410, y: y - 22, size: 8.5, font: fontRegular, color: muted });
    }
    y -= 36;
  }

  y -= 8;
  page.drawText('Tamper-Evident Audit Events (Hash-Chained)', { x: 40, y, size: 10.5, font: fontBold, color: teal });
  y -= 14;
  for (const ev of input.auditLog.slice(0, 14)) {
    if (y < 80) break;
    const line = `#${ev.seq} ${safeAscii(ev.timestampUtc)}  ${safeAscii(ev.eventType.toUpperCase())}  ${safeAscii(ev.signerEmail || '')}  [${safeAscii(ev.entryHash.slice(0, 12))}]`;
    page.drawText(line, { x: 42, y, size: 7.5, font: fontRegular, color: muted });
    y -= 11;
  }

  page.drawText(
    'Electronic Record Notice: This Certificate of Completion records simple electronic signature events and SHA-256 document hashes; it is not a qualified/Aadhaar eSign certificate.',
    { x: 40, y: 42, size: 7.5, font: fontRegular, color: muted, maxWidth: 515 }
  );

  doc.setProducer(`${appName} Sign Engine`);
  return await doc.save({ useObjectStreams: true });
}
