/**
 * Page range parsing and validation utilities for PDF to JPG.
 */
export interface RangeParseResult {
  valid: boolean;
  pages: number[];
  error?: string;
}

/**
 * Parses a user range string like "1-3, 5, 8-10" into a sorted array of unique 1-based page numbers.
 */
export function parsePageRange(rangeStr: string, totalPages?: number): RangeParseResult {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return { valid: false, pages: [], error: 'Please enter at least one page number or range.' };
  }

  // Syntax check: only numbers, commas, dashes and whitespace allowed
  const validPattern = /^(\s*\d+(\s*-\s*\d+)?\s*,)*\s*\d+(\s*-\s*\d+)?\s*$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, pages: [], error: 'Invalid range syntax. Use format like 1-3, 5, 8-10.' };
  }

  const selectedPages = new Set<number>();
  const tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        return { valid: false, pages: [], error: `Invalid range token "${token}".` };
      }
      if (start <= 0 || end <= 0) {
        return { valid: false, pages: [], error: 'Page numbers must be 1 or greater.' };
      }
      if (start > end) {
        return { valid: false, pages: [], error: `Start page (${start}) cannot be greater than end page (${end}).` };
      }
      if (totalPages && (start > totalPages || end > totalPages)) {
        return { valid: false, pages: [], error: `Range exceeds document page count (${totalPages} pages).` };
      }

      for (let p = start; p <= end; p++) {
        selectedPages.add(p);
      }
    } else {
      const num = parseInt(token, 10);
      if (isNaN(num)) {
        return { valid: false, pages: [], error: `Invalid page number "${token}".` };
      }
      if (num <= 0) {
        return { valid: false, pages: [], error: 'Page numbers must be 1 or greater.' };
      }
      if (totalPages && num > totalPages) {
        return { valid: false, pages: [], error: `Page ${num} exceeds document page count (${totalPages} pages).` };
      }
      selectedPages.add(num);
    }
  }

  const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
  if (sortedPages.length === 0) {
    return { valid: false, pages: [], error: 'No valid pages selected.' };
  }

  return { valid: true, pages: sortedPages };
}

/**
 * Formats a sorted array of page numbers into a compact human-readable range string (e.g. "1-3, 5, 8-10").
 */
export function formatPageRange(pages: number[]): string {
  if (!pages || pages.length === 0) return '';
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
      prev = cur;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);

  return ranges.join(', ');
}

