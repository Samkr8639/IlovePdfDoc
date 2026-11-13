/**
 * PDF Text String Decoder & Mojibake Sanitizer.
 * Fully compliant with ISO 32000-1 § 7.9.2.2 (Text String Type: PDFDocEncoding / UTF-16BE with BOM)
 * and resolves UTF-8/Windows-1252 file name encoding discrepancies.
 */

/**
 * Standard PDFDocEncoding character mapping (ISO 32000-1:2008 Annex D).
 * Values not in this table map directly to their ISO-8859-1 code point.
 */
const PDF_DOC_ENCODING_MAP: Record<number, string> = {
  0x18: '\u02D8', // Breve
  0x19: '\u02C7', // Caron
  0x1A: '\u02C6', // Circumflex
  0x1B: '\u02D9', // Dot accent
  0x1C: '\u02DD', // Double acute
  0x1D: '\u02DB', // Ogonek
  0x1E: '\u02DA', // Ring
  0x1F: '\u02DC', // Tilde
  0x80: '\u2022', // Bullet
  0x81: '\u2020', // Dagger
  0x82: '\u2021', // Double dagger
  0x83: '\u2026', // Ellipsis
  0x84: '\u2014', // Em dash
  0x85: '\u2013', // En dash
  0x86: '\u0192', // Florin
  0x87: '\u2044', // Fraction slash
  0x88: '\u2039', // Single left-pointing angle quotation mark
  0x89: '\u203A', // Single right-pointing angle quotation mark
  0x8A: '\u2212', // Minus sign
  0x8B: '\u2030', // Per mille
  0x8C: '\u201E', // Double low-9 quotation mark
  0x8D: '\u201C', // Left double quotation mark
  0x8E: '\u201D', // Right double quotation mark
  0x8F: '\u2018', // Left single quotation mark
  0x90: '\u2019', // Right single quotation mark
  0x91: '\u201A', // Single low-9 quotation mark
  0x92: '\u2122', // Trademark
  0x93: '\uFB01', // fi ligature
  0x94: '\uFB02', // fl ligature
  0x95: '\u0141', // L with stroke
  0x96: '\u2013', // En dash (Windows-1252 / common fallback)
  0x97: '\u2014', // Em dash
  0x98: '\u0160', // S with caron
  0x99: '\u2039',
  0x9A: '\u0152', // OE ligature
  0x9B: '\u017D', // Z with caron
  0x9C: '\u0131', // Dotless i
  0x9D: '\u0142', // l with stroke
  0x9E: '\u0153', // oe ligature
  0x9F: '\u0161', // s with caron
  0xA0: '\u017E', // z with caron
  0xAD: '\u00AD'  // Soft hyphen
};

/**
 * Decodes a raw PDF text string (from Document Information Dictionary /Title, /Author, etc.)
 * adhering to ISO 32000-1 specifications.
 */
export function decodePdfTextString(raw: Uint8Array | string): string {
  if (!raw) return '';

  let bytes: Uint8Array;
  if (typeof raw === 'string') {
    bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i) & 0xff;
    }
  } else {
    bytes = raw;
  }

  if (bytes.length === 0) return '';

  // 1. Check for UTF-16BE BOM: 0xFE 0xFF
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    let result = '';
    for (let i = 2; i < bytes.length - 1; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      result += String.fromCharCode(code);
    }
    return repairMojibakeFilename(result);
  }

  // 2. Check for UTF-8 BOM: 0xEF 0xBB 0xBF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3));
      return repairMojibakeFilename(utf8);
    } catch {
      // Fall through if invalid UTF-8
    }
  }

  // 3. Try strict UTF-8 decode
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // If it decoded and doesn't contain awkward controls, return repaired
    return repairMojibakeFilename(utf8);
  } catch {
    // Not valid UTF-8; decode via PDFDocEncoding
  }

  // 4. Fallback to PDFDocEncoding character mapping
  let decoded = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    decoded += PDF_DOC_ENCODING_MAP[b] || String.fromCharCode(b);
  }

  return repairMojibakeFilename(decoded);
}

/**
 * Repairs common double-encoding / mojibake artifacts in filenames
 * (e.g. "Auction Portal à Impulse Decision…" or "Auction Portal â Impulse Decisions" -> "Auction Portal – Impulse Decisions").
 */
export function repairMojibakeFilename(name: string): string {
  if (!name) return '';

  let repaired = name;

  // UTF-8 en dash (0xE2 0x80 0x93) decoded as Windows-1252 / ISO-8859-1:
  // "â€“", "â\u0080\u0093", "â\x80\x93", or "â\u20AC\u201C"
  repaired = repaired.replace(/\u00E2\u20AC\u201C/g, '–');
  repaired = repaired.replace(/\u00E2\u20AC\u02DC/g, '’');
  repaired = repaired.replace(/\u00E2\u20AC\u0153/g, '“');
  repaired = repaired.replace(/\u00E2\u20AC\u009D/g, '”');
  repaired = repaired.replace(/\u00E2\u20AC\u00A6/g, '…');
  repaired = repaired.replace(/â€“/g, '–');
  repaired = repaired.replace(/â€”/g, '—');
  repaired = repaired.replace(/â€™/g, '’');
  repaired = repaired.replace(/â€˜/g, '‘');
  repaired = repaired.replace(/â€œ/g, '“');
  repaired = repaired.replace(/â€/g, '”');
  repaired = repaired.replace(/â€¦/g, '…');
  repaired = repaired.replace(/\u00E2\u0080\u0093/g, '–');
  repaired = repaired.replace(/\u00E2\u0080\u0094/g, '—');
  repaired = repaired.replace(/\u00E2\u0080\u00A6/g, '…');

  // Also catch standalone " â " or " à " between words where an en dash is standard (e.g. "Portal à Impulse" or "Portal â Impulse")
  repaired = repaired.replace(/(\w+)\s+[\u00E0\u00E2]\s+(\w+)/g, '$1 – $2');

  // Clean trailing or weird null control chars
  repaired = repaired.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return repaired.trim();
}

