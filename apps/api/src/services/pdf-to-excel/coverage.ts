import ExcelJS from 'exceljs';

/**
 * Normalises text into an array of lowercase alphanumeric words/tokens.
 */
export function extractNormalisedWords(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  return matches || [];
}

/**
 * Extracts all normalised words from all cells in an ExcelJS workbook.
 */
export function extractWorkbookWords(wb: ExcelJS.Workbook): { words: string[]; wordCounts: Map<string, number> } {
  const words: string[] = [];
  const wordCounts = new Map<string, number>();

  wb.eachSheet(sheet => {
    sheet.eachRow(row => {
      row.eachCell(cell => {
        let cellStr = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object') {
            // Handle rich text or formula objects
            if ('richText' in (cell.value as any)) {
              cellStr = (cell.value as any).richText.map((t: any) => t.text).join(' ');
            } else if ('result' in (cell.value as any)) {
              cellStr = String((cell.value as any).result || '');
            } else {
              cellStr = String(cell.value);
            }
          } else {
            cellStr = String(cell.value);
          }
        }

        const cellWords = extractNormalisedWords(cellStr);
        for (const w of cellWords) {
          words.push(w);
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
      });
    });
  });

  return { words, wordCounts };
}

export interface CoverageResult {
  coverage: number;
  totalPdfWords: number;
  matchedWords: number;
  missingWords: string[];
}

/**
 * Compares normalised words between PDF text and ExcelJS workbook.
 */
export function computeCoverage(pdfText: string, wb: ExcelJS.Workbook): CoverageResult {
  const pdfWords = extractNormalisedWords(pdfText);
  if (pdfWords.length === 0) {
    return {
      coverage: 100,
      totalPdfWords: 0,
      matchedWords: 0,
      missingWords: []
    };
  }

  const { wordCounts: wbWordCounts } = extractWorkbookWords(wb);
  // Clone workbook counts so we can decrement as we match
  const availableCounts = new Map<string, number>(wbWordCounts);

  let matched = 0;
  const missingWords: string[] = [];
  const missingSet = new Set<string>();

  for (const w of pdfWords) {
    const available = availableCounts.get(w) || 0;
    if (available > 0) {
      matched++;
      availableCounts.set(w, available - 1);
    } else {
      if (!missingSet.has(w)) {
        missingSet.add(w);
        missingWords.push(w);
      }
    }
  }

  const coverage = Math.round((matched / pdfWords.length) * 1000) / 10;

  return {
    coverage,
    totalPdfWords: pdfWords.length,
    matchedWords: matched,
    missingWords
  };
}

/**
 * Coverage guard:
 * Compares words in the workbook with the source PDF page text.
 * If coverage is below 98%, appends the missing text to a 'Text' sheet and adds a warning.
 */
export async function applyCoverageGuard(
  wb: ExcelJS.Workbook,
  pdfTextByPage: { page: number; text: string }[],
  warnings: string[]
): Promise<CoverageResult> {
  const fullPdfText = pdfTextByPage.map(p => p.text).join('\n');
  const result = computeCoverage(fullPdfText, wb);

  if (result.coverage < 98) {
    warnings.push(
      `Coverage warning: Document text coverage is ${result.coverage}% (< 98%). Missing content has been preserved in the 'Text' sheet.`
    );

    // Identify which lines across pages contain missing words
    const missingSet = new Set(result.missingWords);
    const missingLinesByPage: { page: number; lines: string[] }[] = [];

    for (const pageItem of pdfTextByPage) {
      const pageLines = pageItem.text.split('\n');
      const linesWithMissingText: string[] = [];

      for (const line of pageLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const lineWords = extractNormalisedWords(trimmed);
        const hasMissing = lineWords.some(w => missingSet.has(w));
        if (hasMissing) {
          linesWithMissingText.push(trimmed);
        }
      }

      if (linesWithMissingText.length > 0) {
        missingLinesByPage.push({ page: pageItem.page, lines: linesWithMissingText });
      }
    }

    // Find or create 'Text' sheet
    let textSheet = wb.getWorksheet('Text');
    if (!textSheet) {
      textSheet = wb.addWorksheet('Text');
      textSheet.getColumn(1).width = 85;
    }

    let nextRow = textSheet.rowCount + 1;
    if (nextRow > 1) {
      nextRow += 1; // blank line separation
    }

    const bannerRow = textSheet.getRow(nextRow++);
    bannerRow.getCell(1).value = `--- Recovered Content (Coverage: ${result.coverage}%) ---`;
    bannerRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFB91C1C' } };

    for (const pageBlock of missingLinesByPage) {
      const pageTitleRow = textSheet.getRow(nextRow++);
      pageTitleRow.getCell(1).value = `Page ${pageBlock.page}:`;
      pageTitleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, italic: true };

      for (const line of pageBlock.lines) {
        const row = textSheet.getRow(nextRow++);
        row.getCell(1).value = line;
        row.getCell(1).alignment = { wrapText: true };
      }
      nextRow++; // space after page
    }
  }

  return result;
}
