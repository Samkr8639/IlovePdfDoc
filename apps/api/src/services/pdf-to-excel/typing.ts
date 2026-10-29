export type CellType = 'number' | 'date' | 'string';

export interface TypedCell {
  type: CellType;
  value: number | Date | string;
  numFmt?: string;
  warning?: string;
}

export type SeparatorConvention = 'standard' | 'indian' | 'decimal_comma';
export type DateConvention = 'dd/mm' | 'mm/dd' | 'yyyy-mm-dd' | 'ambiguous';

const CURRENCY_SYMBOLS: Record<string, string> = {
  '₹': '[$₹-4009] #,##0.00',
  'rs.': '[$₹-4009] #,##0.00',
  'inr': '[$₹-4009] #,##0.00',
  '$': '$#,##0.00',
  'usd': '$#,##0.00',
  '€': '[$€-2] #,##0.00',
  'eur': '[$€-2] #,##0.00',
  '£': '[$£-809] #,##0.00',
  'gbp': '[$£-809] #,##0.00'
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/**
 * Clean string:
 * - trim, normalise whitespace, NBSP, zero-width spaces
 * - remove soft hyphens
 * - fix line-wrap hyphenation only (e.g. "inter-\nface" -> "interface")
 * - truncate at 32,767 chars with warning
 */
export function cleanString(raw: string): { text: string; warning?: string } {
  if (!raw) return { text: '' };

  let s = raw
    .replace(/[\u00A0\u202F\u2007]/g, ' ') // NBSP to regular space
    .replace(/[\u200B\uFEFF]/g, '')        // zero-width spaces
    .replace(/\u00AD/g, '');               // soft hyphens

  // Fix line-wrap hyphenation: "word-\nnext" -> "wordnext"
  s = s.replace(/(\b[a-zA-Z]{2,})-\r?\n([a-zA-Z]{2,}\b)/g, '$1$2');

  s = s.trim();

  let warning: string | undefined;
  if (s.length > 32767) {
    s = s.substring(0, 32767);
    warning = 'Cell content exceeded 32,767 characters and was truncated.';
  }

  return { text: s, warning };
}

/**
 * Check if a string MUST stay text (never parsed as a number)
 */
export function mustStayText(s: string): boolean {
  if (!s) return true;

  // Leading zeros: "0123", "007", "+01" (except "0", "0.0", "0.00", etc.)
  if (/^0\d+/.test(s)) return true;

  // Scientific notation or codes like "1E5", "2E10"
  if (/^\d+[eE]\d+$/.test(s)) return true;

  // Numbers longer than 15 digits (IEEE 754 precision loss in Excel)
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length > 15) return true;

  // Alphanumeric codes, tax IDs, GSTIN, PAN, IFSC
  // GSTIN: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char
  if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i.test(s)) return true;
  // PAN: 5 letters + 4 digits + 1 letter
  if (/^[A-Z]{5}\d{4}[A-Z]{1}$/i.test(s)) return true;
  // IFSC: 4 letters + 0 + 6 alphanumeric
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(s)) return true;

  // Phone numbers with country code or separated blocks: "+91 98765 43210", "(123) 456-7890"
  if (s.startsWith('+') && digitsOnly.length >= 7 && digitsOnly.length <= 15) return true;
  if (/^(\+\d{1,3}[\s-]?)?(\(\d{2,5}\)|\d{2,5})[\s-]\d{3,5}[\s-]\d{4,5}$/.test(s)) return true;

  return false;
}

/**
 * Infer separator convention for a column from unambiguous numbers
 */
export function inferColumnSeparator(values: string[]): SeparatorConvention {
  let indianCount = 0;
  let decimalCommaCount = 0;
  let standardCount = 0;

  for (const raw of values) {
    const s = raw.trim();
    if (mustStayText(s)) continue;

    // Indian grouping: e.g. "1,23,456.78" or "12,34,567.89"
    if (/\b\d{1,2}(,\d{2})+,\d{3}(\.\d+)?\b/.test(s)) {
      indianCount++;
      continue;
    }

    // Decimal comma: e.g. "1.234,56" or "1234,56" or "45,50 €"
    if (/\b\d{1,3}(\.\d{3})+,\d+\b/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
      decimalCommaCount++;
      continue;
    }

    // Standard grouping: e.g. "1,234.56" or "1,234,567.89"
    if (/\b\d{1,3}(,\d{3})+\.\d+\b/.test(s)) {
      standardCount++;
    }
  }

  if (indianCount > 0 && indianCount >= decimalCommaCount) return 'indian';
  if (decimalCommaCount > 0 && decimalCommaCount > standardCount) return 'decimal_comma';
  return 'standard';
}

/**
 * Infer date convention for a column: dd/mm vs mm/dd
 */
export function inferColumnDateConvention(values: string[]): DateConvention {
  let ddmmEvidence = 0;
  let mmddEvidence = 0;

  for (const raw of values) {
    const s = raw.trim();
    // YYYY-MM-DD
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) {
      return 'yyyy-mm-dd';
    }

    const match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);

      if (p1 > 12 && p2 <= 12) {
        ddmmEvidence++;
      } else if (p2 > 12 && p1 <= 12) {
        mmddEvidence++;
      }
    }
  }

  if (mmddEvidence > 0 && mmddEvidence > ddmmEvidence) return 'mm/dd';
  // Default to dd/mm as requested in requirements
  return 'dd/mm';
}

/**
 * Parse date string into JavaScript Date and format
 */
export function parseDate(
  raw: string,
  convention: DateConvention = 'dd/mm'
): { date: Date; numFmt: string; warning?: string } | null {
  const s = raw.trim();
  if (!s || s.length < 6 || s.length > 25) return null;

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return { date: d, numFmt: 'yyyy-mm-dd' };
      }
    }
  }

  // 2. Named month format: e.g. "15 Jan 2024" or "15-January-2024" or "Jan 15, 2024"
  const namedMatch1 = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s\-]+(\d{2,4})$/);
  if (namedMatch1) {
    const day = parseInt(namedMatch1[1], 10);
    const monthStr = namedMatch1[2].toLowerCase();
    let year = parseInt(namedMatch1[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monthStr];
    if (month && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return { date: d, numFmt: 'dd-mmm-yyyy' };
      }
    }
  }

  const namedMatch2 = s.match(/^([A-Za-z]{3,9})[\s\-]+(\d{1,2}),?[\s\-]+(\d{2,4})$/);
  if (namedMatch2) {
    const monthStr = namedMatch2[1].toLowerCase();
    const day = parseInt(namedMatch2[2], 10);
    let year = parseInt(namedMatch2[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monthStr];
    if (month && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return { date: d, numFmt: 'mmm dd, yyyy' };
      }
    }
  }

  // 3. Numeric formats: DD/MM/YYYY or MM/DD/YYYY
  const numMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numMatch) {
    let p1 = parseInt(numMatch[1], 10);
    let p2 = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;

    let day: number;
    let month: number;
    let warning: string | undefined;

    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    } else {
      if (convention === 'mm/dd') {
        month = p1;
        day = p2;
      } else {
        day = p1;
        month = p2;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return { date: d, numFmt: 'dd/mm/yyyy', warning };
      }
    }
  }

  return null;
}

/**
 * Parse number string into numeric value and format
 */
export function parseNumber(
  raw: string,
  convention: SeparatorConvention = 'standard'
): { num: number; numFmt: string } | null {
  if (mustStayText(raw)) return null;

  let s = raw.trim();

  // 1. Detect currency
  let detectedFmt = '#,##0.00';
  for (const [sym, fmt] of Object.entries(CURRENCY_SYMBOLS)) {
    if (s.toLowerCase().startsWith(sym)) {
      detectedFmt = fmt;
      s = s.substring(sym.length).trim();
      break;
    } else if (s.toLowerCase().endsWith(sym)) {
      detectedFmt = fmt;
      s = s.substring(0, s.length - sym.length).trim();
      break;
    }
  }

  // 2. Detect percentage
  let isPercent = false;
  if (s.endsWith('%')) {
    isPercent = true;
    detectedFmt = '0.00%';
    s = s.slice(0, -1).trim();
  }

  // 3. Detect negatives: (1,234) or 1,234- or -1,234 or −1,234
  let isNegative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.endsWith('-') || s.endsWith('−')) {
    isNegative = true;
    s = s.slice(0, -1).trim();
  } else if (s.startsWith('-') || s.startsWith('−')) {
    isNegative = true;
    s = s.slice(1).trim();
  }

  // Normalise separators based on convention
  if (convention === 'decimal_comma') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (convention === 'indian') {
    s = s.replace(/,/g, '');
    if (detectedFmt === '#,##0.00') {
      detectedFmt = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
    }
  } else {
    s = s.replace(/,/g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }

  let val = parseFloat(s);
  if (isNaN(val)) return null;

  if (isNegative) val = -val;
  if (isPercent) val = val / 100;

  if (!raw.includes('.') && !raw.includes(',') && !isPercent && detectedFmt === '#,##0.00') {
    detectedFmt = '#,##0';
  }

  return { num: val, numFmt: detectedFmt };
}

/**
 * Type a full column of cells with consistency checks
 */
export function typeColumnCells(
  columnValues: string[],
  detectTypes = true
): TypedCell[] {
  if (!detectTypes) {
    return columnValues.map(v => {
      const { text, warning } = cleanString(v);
      return { type: 'string', value: text, warning };
    });
  }

  const convention = inferColumnSeparator(columnValues);
  const dateConvention = inferColumnDateConvention(columnValues);

  const preliminary: { type: CellType; value: any; numFmt?: string; warning?: string }[] = [];
  let numericCount = 0;
  let nonEmptyCount = 0;

  for (const raw of columnValues) {
    const { text, warning } = cleanString(raw);
    if (!text) {
      preliminary.push({ type: 'string', value: '' });
      continue;
    }

    nonEmptyCount++;

    const numResult = parseNumber(text, convention);
    if (numResult !== null) {
      numericCount++;
      preliminary.push({
        type: 'number',
        value: numResult.num,
        numFmt: numResult.numFmt,
        warning
      });
      continue;
    }

    const dateResult = parseDate(text, dateConvention);
    if (dateResult !== null) {
      preliminary.push({
        type: 'date',
        value: dateResult.date,
        numFmt: dateResult.numFmt,
        warning: dateResult.warning || warning
      });
      continue;
    }

    preliminary.push({ type: 'string', value: text, warning });
  }

  if (numericCount > 0 && nonEmptyCount > 0 && (numericCount / nonEmptyCount) < 0.6) {
    return columnValues.map(v => {
      const { text, warning } = cleanString(v);
      return { type: 'string', value: text, warning };
    });
  }

  return preliminary;
}
