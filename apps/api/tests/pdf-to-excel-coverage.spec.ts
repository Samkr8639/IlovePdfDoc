import { describe, it, expect } from '@jest/globals';
import ExcelJS from 'exceljs';
import {
  extractNormalisedWords,
  computeCoverage,
  applyCoverageGuard
} from '../src/services/pdf-to-excel/coverage';

describe('PDF to Excel: Coverage Guard (Step 1)', () => {
  describe('extractNormalisedWords', () => {
    it('normalises punctuation, casing, and unicode text correctly', () => {
      const text = 'Impulse Decisions – Auction Portal! Server-driven (e.g. BBPOS WisePOS E).';
      const words = extractNormalisedWords(text);
      expect(words).toContain('impulse');
      expect(words).toContain('decisions');
      expect(words).toContain('auction');
      expect(words).toContain('portal');
      expect(words).toContain('server');
      expect(words).toContain('driven');
      expect(words).toContain('bbpos');
    });

    it('returns empty array for empty or whitespace text', () => {
      expect(extractNormalisedWords('')).toEqual([]);
      expect(extractNormalisedWords('   \n\t  ')).toEqual([]);
    });
  });

  describe('computeCoverage', () => {
    it('returns 100% when all PDF words are present in workbook', () => {
      const pdfText = 'Invoice 1042 Total USD 500 Date 2026-10-29';
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Invoice', 1042]);
      ws.addRow(['Total', 'USD 500']);
      ws.addRow(['Date', '2026-10-29']);

      const { coverage, missingWords } = computeCoverage(pdfText, wb);
      expect(coverage).toBe(100);
      expect(missingWords.length).toBe(0);
    });

    it('computes accurate coverage % when some words are missing', () => {
      const pdfText = 'Event Staff member Promissory note Retracted lot Settings Audit entry Extra details not in table';
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      // Only add half the words
      ws.addRow(['Promissory note', 'Retracted lot', 'Settings', 'Audit entry']);

      const { coverage, missingWords } = computeCoverage(pdfText, wb);
      expect(coverage).toBeLessThan(98);
      expect(missingWords).toContain('event');
      expect(missingWords).toContain('staff');
      expect(missingWords).toContain('member');
    });
  });

  describe('applyCoverageGuard', () => {
    it('appends missing text to a Text sheet and generates warning if coverage < 98%', async () => {
      const pdfTextByPage = [
        { page: 1, text: 'Heading\nTable text here\nLost footer details that were dropped by detection' }
      ];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Data');
      ws.addRow(['Heading']);
      ws.addRow(['Table text here']);
      // Notice: "Lost footer details that were dropped by detection" is missing from the workbook

      const warnings: string[] = [];
      const result = await applyCoverageGuard(wb, pdfTextByPage, warnings);

      expect(result.coverage).toBeLessThan(98);
      expect(warnings.some(w => w.includes('Coverage warning') || w.includes('coverage is'))).toBe(true);
      
      const textSheet = wb.getWorksheet('Text');
      expect(textSheet).toBeDefined();
      
      // Verify text sheet contains the missing text
      let foundMissingText = false;
      textSheet?.eachRow(row => {
        row.eachCell(cell => {
          if (String(cell.value).includes('Lost footer details')) {
            foundMissingText = true;
          }
        });
      });
      expect(foundMissingText).toBe(true);
    });

    it('does not append Text sheet if coverage is >= 98%', async () => {
      const pdfTextByPage = [
        { page: 1, text: 'Capability Master manager Team member' }
      ];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Data');
      ws.addRow(['Capability', 'Master manager', 'Team member']);

      const warnings: string[] = [];
      const result = await applyCoverageGuard(wb, pdfTextByPage, warnings);

      expect(result.coverage).toBeGreaterThanOrEqual(98);
      expect(wb.getWorksheet('Text')).toBeUndefined();
      expect(warnings.length).toBe(0);
    });
  });

  describe('convertPdfToExcel Integration with Coverage', () => {
    it('returns coverage percentage in conversion result and API response', async () => {
      const { PDFDocument, rgb } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      page.drawText('Sample Table Content A B C D', { x: 50, y: 350, size: 12 });
      const pdfBytes = await pdfDoc.save();

      const { convertPdfToExcel } = await import('../src/services/pdf-to-excel');
      const result = await convertPdfToExcel(Buffer.from(pdfBytes), {
        mode: 'no_ocr',
        sheetLayout: 'sheet_per_table',
        multiFileOutput: 'separate_workbooks',
        detectTypes: true,
        keepFormatting: true,
        includeText: true,
        mergeAcrossPages: true
      });

      expect(typeof result.coverage).toBe('number');
      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage).toBeLessThanOrEqual(100);
    });
  });
});
