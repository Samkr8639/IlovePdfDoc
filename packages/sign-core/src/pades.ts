import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';

const SIGNATURE_HEX_CAPACITY = 16384; // 8,192 raw DER bytes reserved inside /Contents <...>
const BYTE_RANGE_PLACEHOLDER = '[0000000000 0000000000 0000000000 0000000000]';

export interface DetachedPdfSignOptions {
  signerName: string;
  reason?: string;
  location?: string;
  contactInfo?: string;
  signingDate?: Date;
  pageIndex?: number;
  /** Optional invisible widget bounds [xPt, yPt, wPt, hPt]. Defaults to [0,0,0,0] because visual appearance is already drawn by exportSignedPdf. */
  widgetRectPt?: [number, number, number, number];
}

export interface DetachedPdfSignResult {
  signedPdfBytes: Uint8Array;
  byteRange: [number, number, number, number];
}

function formatPdfDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `D:${yyyy}${mm}${dd}${hh}${mi}${ss}+00'00'`;
}

function bytesToLatin1(bytes: Uint8Array): string {
  // Chunk conversion prevents stack overflow on multi-megabyte PDFs
  const chunks: string[] = [];
  const step = 32768;
  for (let i = 0; i < bytes.length; i += step) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step))));
  }
  return chunks.join('');
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Adds a PDF AcroForm /Sig placeholder (/Filter /Adobe.PPKLite, /SubFilter /adbe.pkcs7.detached),
 * computes exact ISO 32000 /ByteRange offsets, invokes `signDetached` over the concatenated signed ranges,
 * and writes the resulting DER CMS SignedData into /Contents without shifting offsets.
 */
export async function applyDetachedPdfSignature(
  pdfBytes: Uint8Array,
  options: DetachedPdfSignOptions,
  signDetached: (dataToSign: Uint8Array) => Promise<Uint8Array>
): Promise<DetachedPdfSignResult> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const pageIdx = Math.max(0, Math.min(doc.getPageCount() - 1, options.pageIndex ?? 0));
  const page = doc.getPage(pageIdx);
  const signingDate = options.signingDate || new Date();

  const byteRangeArr = doc.context.obj([
    PDFNumber.of(0),
    PDFNumber.of(0),
    PDFNumber.of(0),
    PDFNumber.of(0)
  ]);

  const sigDict = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRangeArr,
    Contents: PDFHexString.of('0'.repeat(SIGNATURE_HEX_CAPACITY)),
    Name: PDFString.of(options.signerName || 'Digital Signer'),
    Reason: PDFString.of(options.reason || 'Document signed electronically'),
    Location: PDFString.of(options.location || 'PDFTailor'),
    M: PDFString.of(formatPdfDate(signingDate))
  });
  const sigRef = doc.context.register(sigDict);

  const rect = options.widgetRectPt || [0, 0, 0, 0];
  const widgetDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: sigRef,
    T: PDFString.of(`PDFTailorSig_${Date.now()}`),
    F: 4,
    P: page.ref
  });
  const widgetRef = doc.context.register(widgetDict);

  const existingAnnots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existingAnnots) {
    existingAnnots.push(widgetRef);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([widgetRef]));
  }

  let acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (!acroForm) {
    acroForm = doc.context.obj({ Fields: [] });
    doc.catalog.set(PDFName.of('AcroForm'), acroForm);
  }
  const fieldsArr = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray) || doc.context.obj([]);
  fieldsArr.push(widgetRef);
  acroForm.set(PDFName.of('Fields'), fieldsArr);
  acroForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  // Add marker placeholder in ByteRange string BEFORE saving? We locate `/ByteRange [ 0 0 0 0 ]` created by pdf-lib!
  // Wait: reserve fixed BYTE_RANGE_PLACEHOLDER width directly via raw literal on /ByteRange or replace exact match:
  // Re-save after inspecting exact ByteRange string? Better: use large 10-digit placeholder numbers inside PDFArray!
  sigDict.set(
    PDFName.of('ByteRange'),
    doc.context.obj([
      PDFNumber.of(1000000000),
      PDFNumber.of(1000000000),
      PDFNumber.of(1000000000),
      PDFNumber.of(1000000000)
    ])
  );

  const rawPdf = new Uint8Array(await doc.save({ useObjectStreams: false }));
  const text = bytesToLatin1(rawPdf);

  const brMarker = '/ByteRange [ 1000000000 1000000000 1000000000 1000000000 ]';
  const brIndex = text.lastIndexOf(brMarker);
  if (brIndex === -1) {
    throw new Error('Failed to locate /ByteRange placeholder in PDF output.');
  }

  const zeroContentsNeedle = '<' + '0'.repeat(SIGNATURE_HEX_CAPACITY) + '>';
  const contentsStart = text.lastIndexOf(zeroContentsNeedle);
  if (contentsStart === -1) {
    throw new Error('Failed to locate /Contents placeholder in PDF signature dictionary.');
  }
  const contentsEnd = contentsStart + zeroContentsNeedle.length; // index right after '>'

  const range1Len = contentsStart;
  const range2Start = contentsEnd;
  const range2Len = rawPdf.length - range2Start;
  const byteRange: [number, number, number, number] = [0, range1Len, range2Start, range2Len];

  const actualBr = `/ByteRange [ 0 ${range1Len} ${range2Start} ${range2Len} ]`;
  if (actualBr.length > brMarker.length) {
    throw new Error('Calculated /ByteRange exceeds reserved placeholder width.');
  }
  const paddedBr = actualBr.padEnd(brMarker.length, ' ');
  for (let i = 0; i < paddedBr.length; i++) {
    rawPdf[brIndex + i] = paddedBr.charCodeAt(i);
  }

  // Extract concatenated byte slices excluding `<...>` in /Contents
  const dataToSign = new Uint8Array(range1Len + range2Len);
  dataToSign.set(rawPdf.subarray(0, range1Len), 0);
  dataToSign.set(rawPdf.subarray(range2Start), range1Len);

  const cmsDer = await signDetached(dataToSign);
  const cmsHex = bytesToHex(cmsDer);
  if (cmsHex.length > SIGNATURE_HEX_CAPACITY) {
    throw new Error(`PKCS#7 signature (${cmsHex.length / 2} bytes) exceeds reserved /Contents slot.`);
  }

  const paddedHex = cmsHex.padEnd(SIGNATURE_HEX_CAPACITY, '0');
  const hexContentOffset = contentsStart + 1;
  for (let i = 0; i < paddedHex.length; i++) {
    rawPdf[hexContentOffset + i] = paddedHex.charCodeAt(i);
  }

  return { signedPdfBytes: rawPdf, byteRange };
}

/** Extracts `/ByteRange` signed bytes + raw DER `/Contents` from a signed PDF for external verification. */
export function extractPdfSignaturePayload(pdfBytes: Uint8Array): {
  byteRange: [number, number, number, number];
  signedData: Uint8Array;
  cmsDer: Uint8Array;
} {
  const text = bytesToLatin1(pdfBytes);
  const brMatch = text.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  if (!brMatch) {
    throw new Error('No /ByteRange found in PDF.');
  }
  const byteRange: [number, number, number, number] = [
    Number(brMatch[1]),
    Number(brMatch[2]),
    Number(brMatch[3]),
    Number(brMatch[4])
  ];

  // Locate `<...>` immediately between end of range 1 and start of range 2
  const hexSlice = text.slice(byteRange[1], byteRange[2]).trim();
  if (!hexSlice.startsWith('<') || !hexSlice.endsWith('>')) {
    throw new Error('Malformed /Contents hex slice between /ByteRange bounds.');
  }
  const hexBody = hexSlice.slice(1, -1).replace(/\s+/g, '');
  const rawDer = new Uint8Array(hexBody.length / 2);
  for (let i = 0; i < rawDer.length; i++) {
    rawDer[i] = parseInt(hexBody.slice(i * 2, i * 2 + 2), 16);
  }

  // Trim trailing zero-padding from ASN.1 SEQUENCE outer DER length
  let derLen = rawDer.length;
  if (rawDer[0] === 0x30) {
    if ((rawDer[1] & 0x80) === 0) {
      derLen = 2 + rawDer[1];
    } else {
      const octs = rawDer[1] & 0x7f;
      let contentLen = 0;
      for (let i = 0; i < octs; i++) contentLen = (contentLen << 8) | rawDer[2 + i];
      derLen = 2 + octs + contentLen;
    }
  }

  const signedData = new Uint8Array(byteRange[1] + byteRange[3]);
  signedData.set(pdfBytes.subarray(byteRange[0], byteRange[0] + byteRange[1]), 0);
  signedData.set(pdfBytes.subarray(byteRange[2], byteRange[2] + byteRange[3]), byteRange[1]);

  return {
    byteRange,
    signedData,
    cmsDer: rawDer.subarray(0, Math.min(derLen, rawDer.length))
  };
}
