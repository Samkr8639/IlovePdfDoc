/**
 * Watermark Range Parser
 * Parses, validates, filters, and clamps page selections for Watermark PDF.
 */

import { WatermarkPageFilterPreset, WatermarkPageMode } from '@paperflow/contracts';

export interface WatermarkPageSelectionResult {
  isValid: boolean;
  pageIndices: number[]; // 0-based page indices
  selectedPagesCount: number;
  totalPages: number;
  errorMessage: string | null;
  clampedMessage: string | null;
  summaryText: string;
}

export function parseWatermarkPages(
  mode: WatermarkPageMode,
  customRange: string,
  filterPreset: WatermarkPageFilterPreset,
  totalPages: number
): WatermarkPageSelectionResult {
  if (totalPages <= 0) {
    return {
      isValid: false,
      pageIndices: [],
      selectedPagesCount: 0,
      totalPages: 0,
      errorMessage: 'Document has no pages.',
      clampedMessage: null,
      summaryText: '0 of 0 pages'
    };
  }

  // 1. Gather baseline page numbers (1-based)
  let candidatePages: number[] = [];
  let clampedPages: number[] = [];

  if (mode === 'all') {
    for (let p = 1; p <= totalPages; p++) {
      candidatePages.push(p);
    }
  } else {
    // Custom range parser: forgiving, handles "1-3, 5, 8-10", "3-1", whitespace, commas, dashes
    const trimmed = (customRange || '').trim();
    if (!trimmed) {
      return {
        isValid: false,
        pageIndices: [],
        selectedPagesCount: 0,
        totalPages,
        errorMessage: 'Please enter page numbers or ranges (e.g. 1-3, 5).',
        clampedMessage: null,
        summaryText: `0 of ${totalPages} pages`
      };
    }

    const tokens = trimmed.split(/[,;\s]+/).filter(t => t.length > 0);
    const parsedSet = new Set<number>();
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        const num = parseInt(token, 10);
        if (num <= 0) {
          invalidTokens.push(token);
        } else if (num > totalPages) {
          clampedPages.push(num);
        } else {
          parsedSet.add(num);
        }
      } else if (/^\d+-\d+$/.test(token)) {
        const [aStr, bStr] = token.split('-');
        let a = parseInt(aStr, 10);
        let b = parseInt(bStr, 10);
        if (a <= 0 || b <= 0) {
          invalidTokens.push(token);
          continue;
        }
        if (a > b) {
          // Normalize reverse range (e.g. 5-3 -> 3-5)
          const tmp = a;
          a = b;
          b = tmp;
        }
        for (let p = a; p <= b; p++) {
          if (p > totalPages) {
            clampedPages.push(p);
          } else {
            parsedSet.add(p);
          }
        }
      } else {
        invalidTokens.push(token);
      }
    }

    if (invalidTokens.length > 0) {
      return {
        isValid: false,
        pageIndices: [],
        selectedPagesCount: 0,
        totalPages,
        errorMessage: `Invalid page format: "${invalidTokens.join(', ')}". Use numbers and ranges like 1-3, 5.`,
        clampedMessage: null,
        summaryText: `0 of ${totalPages} pages`
      };
    }

    candidatePages = Array.from(parsedSet).sort((a, b) => a - b);

    if (candidatePages.length === 0) {
      return {
        isValid: false,
        pageIndices: [],
        selectedPagesCount: 0,
        totalPages,
        errorMessage: clampedPages.length > 0
          ? `Specified pages exceed total document page count (${totalPages}).`
          : 'No valid pages selected.',
        clampedMessage: clampedPages.length > 0
          ? `Pages beyond ${totalPages} were skipped.`
          : null,
        summaryText: `0 of ${totalPages} pages`
      };
    }
  }

  // 2. Apply filter presets (odd, even, first, last)
  let filteredPages = candidatePages;
  if (filterPreset === 'odd') {
    filteredPages = candidatePages.filter(p => p % 2 === 1);
  } else if (filterPreset === 'even') {
    filteredPages = candidatePages.filter(p => p % 2 === 0);
  } else if (filterPreset === 'first') {
    filteredPages = candidatePages.filter(p => p === 1);
  } else if (filterPreset === 'last') {
    filteredPages = candidatePages.filter(p => p === totalPages);
  }

  const pageIndices = filteredPages.map(p => p - 1);
  const clampedMessage = clampedPages.length > 0
    ? `Pages [${Array.from(new Set(clampedPages)).sort((a, b) => a - b).join(', ')}] exceed total (${totalPages}) and were clamped.`
    : null;

  return {
    isValid: pageIndices.length > 0,
    pageIndices,
    selectedPagesCount: pageIndices.length,
    totalPages,
    errorMessage: pageIndices.length === 0 ? 'No pages match the selected criteria.' : null,
    clampedMessage,
    summaryText: `Will be added to ${pageIndices.length} of ${totalPages} pages`
  };
}
