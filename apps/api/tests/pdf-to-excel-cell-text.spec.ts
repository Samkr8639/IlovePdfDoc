import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { analyzePdf } from '../src/services/pdf-layout';
import { detectTablesOnPage, joinCellText } from '../src/services/pdf-to-excel/detect';

describe('PDF to Excel: Cell Text Formatting & De-hyphenation (Step 4)', () => {
  describe('joinCellText unit logic', () => {
    it('joins wrapped lines with a space', () => {
      const line1 = 'Staff pick the note and their';
      const line2 = 'reader; the amount appears';
      expect(joinCellText(line1, line2)).toBe('Staff pick the note and their reader; the amount appears');
    });

    it('de-hyphenates words ending with hyphen (server- + driven -> server-driven)', () => {
      const line1 = 'Stripe Terminal, server-';
      const line2 = 'driven, smart readers (e.g.';
      expect(joinCellText(line1, line2)).toBe('Stripe Terminal, server-driven, smart readers (e.g.');
    });

    it('preserves newline for numbered list items', () => {
      const line1 = '1. Note signed; server stores it as unpaid';
      const line2 = '2. Customer pays on their phone';
      expect(joinCellText(line1, line2)).toBe('1. Note signed; server stores it as unpaid\n2. Customer pays on their phone');
    });

    it('preserves newline for bullet list items', () => {
      const line1 = '• First item in list';
      const line2 = '• Second item in list';
      expect(joinCellText(line1, line2)).toBe('• First item in list\n• Second item in list');
    });

    it('preserves newline when line pitch > 1.55x font size', () => {
      const line1 = 'Paragraph 1';
      const line2 = 'Paragraph 2';
      const seg1: any = { y: 100, fs: 10 };
      const seg2: any = { y: 120, fs: 10 }; // pitch = 20 > 15.5
      expect(joinCellText(line1, line2, seg1, seg2)).toBe('Paragraph 1\nParagraph 2');
    });
  });

  describe('fixture verification', () => {
    it('verifies Payments table cells are cleanly joined and de-hyphenated', async () => {
      const fixturePdfPath = path.resolve(__dirname, 'fixtures/dev-brief/source.pdf');
      const buf = fs.readFileSync(fixturePdfPath);
      const layout = await analyzePdf(buf);
      const p5 = layout.pages[4];
      const tables = detectTablesOnPage(p5, 5);

      const paymentsTable = tables.find(t =>
        t.grid[0]?.some(c => c?.text.toLowerCase().includes('stripe product'))
      );
      expect(paymentsTable).toBeDefined();

      // Card reader row is row 2
      const cardReaderRow = paymentsTable!.grid[2];
      const productCell = cardReaderRow[2]?.text || '';
      expect(productCell).toContain('server-driven');
      expect(productCell).not.toContain('server-\n');
      expect(productCell).not.toContain('server- driven');

      const howItWorksCell = cardReaderRow[1]?.text || '';
      expect(howItWorksCell).toContain('reader; the amount appears');
      expect(howItWorksCell).not.toContain('their\nreader');
    });
  });
});
