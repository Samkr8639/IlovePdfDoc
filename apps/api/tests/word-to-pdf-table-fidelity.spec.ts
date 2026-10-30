import JSZip from 'jszip';
import { normalizeDocx } from '../src/services/word-to-pdf/normalize-docx';
import { convertWordToPdf, checkLibreOffice } from '../src/services/word-to-pdf';
import { analyzePdf } from '../src/services/pdf-layout';
import { createTableDocxWithExactHeight } from './helpers/create-table-docx';

describe('Word to PDF Table Fidelity Normalizer', () => {
  describe('normalizeDocx unit tests', () => {
    it('should switch fixed-height rows (w:hRule="exact") to "atLeast"', async () => {
      const docxBuf = await createTableDocxWithExactHeight('exact');
      const res = await normalizeDocx(docxBuf);

      expect(res.fixes.exactToAtLeast).toBe(2);
      expect(res.fixes.partsChanged).toContain('word/document.xml');

      const zip = await JSZip.loadAsync(res.buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).not.toContain('w:hRule="exact"');
      expect(xml).toContain('w:hRule="atLeast"');
    });

    it('should not alter documents without exact row heights', async () => {
      const docxBuf = await createTableDocxWithExactHeight('atLeast');
      const res = await normalizeDocx(docxBuf);

      expect(res.fixes.exactToAtLeast).toBe(0);
      expect(res.fixes.partsChanged.length).toBe(0);
    });
  });

  describe('Conversion fidelity and decoration height test', () => {
    it('should expand cell borders and shading to at least text height and >= 12 pt', async () => {
      const { available } = await checkLibreOffice();
      if (!available) {
        console.warn('Skipping LibreOffice integration test: LibreOffice not available.');
        return;
      }

      const docxBuf = await createTableDocxWithExactHeight('exact');
      const conv = await convertWordToPdf(docxBuf, 'table-test.docx');

      // Warning should be present
      expect(conv.warnings).toContain(
        'Fixed-height table rows were adjusted so borders and shading display correctly.'
      );

      // Analyze the generated PDF
      const layout = await analyzePdf(conv.pdfBuffer);
      expect(layout.pages.length).toBeGreaterThanOrEqual(1);
      const page1 = layout.pages[0];

      // Check vertical borders: no vertical border should be shorter than 12 pt
      const vertLines = page1.lines.filter(l => l.vertical || (l.h > l.w && l.h >= 10));
      for (const line of vertLines) {
        const length = Math.max(line.h, line.w);
        expect(length).toBeGreaterThanOrEqual(12);
      }

      // Check header shading boxes: must be at least 12 pt tall
      const shadedBoxes = page1.boxes.filter(b => b.fill && b.fill !== '#FFFFFF');
      expect(shadedBoxes.length).toBeGreaterThanOrEqual(1);
      for (const box of shadedBoxes) {
        expect(box.h).toBeGreaterThanOrEqual(12);
      }
    }, 45000);
  });
});
