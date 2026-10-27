export interface PageRange {
  from: number;
  to: number;
}

export interface SplitRangeParseResult {
  isValid: boolean;
  ranges: PageRange[];
  pageNumbers: number[];
  errors: string[];
  warnings: string[];
}

export class SplitRangeParser {
  /**
   * Parses page range expressions like "1, 3-5, 8" into structured page ranges and indices.
   *
   * @param expression Comma-separated page expression (e.g., "1, 3-5, 8-10")
   * @param totalPages Total pages of the loaded PDF document (used for bounds checking)
   */
  static parse(expression: string, totalPages: number): SplitRangeParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const ranges: PageRange[] = [];
    const pageSet = new Set<number>();
    const seenRanges = new Set<string>();

    if (!expression || !expression.trim()) {
      return {
        isValid: false,
        ranges: [],
        pageNumbers: [],
        errors: ['Page range expression cannot be empty.'],
        warnings: []
      };
    }

    if (totalPages < 1) {
      return {
        isValid: false,
        ranges: [],
        pageNumbers: [],
        errors: ['Document total pages must be at least 1.'],
        warnings: []
      };
    }

    const segments = expression.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (segments.length === 0) {
      return {
        isValid: false,
        ranges: [],
        pageNumbers: [],
        errors: ['No valid page ranges or numbers found.'],
        warnings: []
      };
    }

    for (const segment of segments) {
      if (segment.includes('-')) {
        const parts = segment.split('-');
        if (parts.length !== 2) {
          errors.push(`Invalid range format: "${segment}". Expected "start-end" (e.g. 1-5).`);
          continue;
        }

        const startStr = parts[0].trim();
        const endStr = parts[1].trim();

        if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
          errors.push(`Non-integer page values in range: "${segment}".`);
          continue;
        }

        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (start < 1) {
          errors.push(`Start page ${start} in "${segment}" cannot be less than 1.`);
          continue;
        }

        if (end < 1) {
          errors.push(`End page ${end} in "${segment}" cannot be less than 1.`);
          continue;
        }

        if (start > end) {
          errors.push(`Invalid range "${segment}": start page (${start}) cannot be greater than end page (${end}).`);
          continue;
        }

        if (start > totalPages) {
          errors.push(`Start page ${start} in "${segment}" exceeds document total (${totalPages}).`);
          continue;
        }

        if (end > totalPages) {
          errors.push(`End page ${end} in "${segment}" exceeds document total (${totalPages}).`);
          continue;
        }

        const rangeKey = `${start}-${end}`;
        if (seenRanges.has(rangeKey)) {
          warnings.push(`Duplicate range "${segment}" was specified.`);
        } else {
          seenRanges.add(rangeKey);
        }

        ranges.push({ from: start, to: end });
        for (let p = start; p <= end; p++) {
          if (pageSet.has(p)) {
            warnings.push(`Page ${p} is included in multiple ranges.`);
          }
          pageSet.add(p);
        }
      } else {
        if (!/^\d+$/.test(segment)) {
          errors.push(`Invalid page number: "${segment}". Only positive integers are allowed.`);
          continue;
        }

        const page = parseInt(segment, 10);

        if (page < 1) {
          errors.push(`Page number ${page} cannot be less than 1.`);
          continue;
        }

        if (page > totalPages) {
          errors.push(`Page number ${page} exceeds document total (${totalPages}).`);
          continue;
        }

        const rangeKey = `${page}-${page}`;
        if (seenRanges.has(rangeKey)) {
          warnings.push(`Duplicate page "${page}" was specified.`);
        } else {
          seenRanges.add(rangeKey);
        }

        ranges.push({ from: page, to: page });
        if (pageSet.has(page)) {
          warnings.push(`Page ${page} is included multiple times.`);
        }
        pageSet.add(page);
      }
    }

    const uniqueSortedPages = Array.from(pageSet).sort((a, b) => a - b);

    return {
      isValid: errors.length === 0 && ranges.length > 0,
      ranges,
      pageNumbers: uniqueSortedPages,
      errors,
      warnings: Array.from(new Set(warnings))
    };
  }

  /**
   * Formats an array of PageRange objects into a clean comma-separated string.
   */
  static formatRanges(ranges: PageRange[]): string {
    return ranges
      .map(r => (r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`))
      .join(', ');
  }

  /**
   * Splits total pages into fixed chunks (e.g. 10 pages in chunks of 3 -> [1-3, 4-6, 7-9, 10-10]).
   */
  static generateFixedRanges(totalPages: number, chunkSize: number): PageRange[] {
    if (totalPages < 1 || chunkSize < 1) return [];
    const ranges: PageRange[] = [];
    for (let start = 1; start <= totalPages; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalPages);
      ranges.push({ from: start, to: end });
    }
    return ranges;
  }
}
