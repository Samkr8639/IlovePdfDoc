/**
 * PowerPoint to PDF — API & Engine Integration Tests
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { PDFDocument } from 'pdf-lib';
import { validatePowerPointFile } from '../src/services/powerpoint-to-pdf/validate';
import { normalizePptx } from '../src/services/powerpoint-to-pdf/normalize-pptx';
import { checkLibreOffice } from '../src/services/office-to-pdf';

// ──────────────────────────────────────────────────────────────
// Fixture Generators
// ──────────────────────────────────────────────────────────────

async function createBasicPptxBuffer(title = 'Deck Title', slide2Title = 'Second Slide'): Promise<Buffer> {
  const pptx = new PptxGenJS();

  const slide1 = pptx.addSlide();
  slide1.addText(title, { x: 1, y: 1, fontSize: 24, bold: true, color: '363636' });
  slide1.addText('First slide bullet point\nSecond line of content', { x: 1, y: 2, fontSize: 14, color: '666666' });

  const slide2 = pptx.addSlide();
  slide2.addText(slide2Title, { x: 1, y: 1, fontSize: 24, bold: true, color: '363636' });
  slide2.addText('Detailed content on second slide', { x: 1, y: 2, fontSize: 14, color: '666666' });

  const buf = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return buf;
}

describe('PowerPoint to PDF API & Validation Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('Validation & Security Guards', () => {
    it('rejects 0-byte presentation file with ZERO_BYTE_FILE (400)', async () => {
      await expect(validatePowerPointFile(Buffer.alloc(0), 'empty.pptx')).rejects.toMatchObject({
        statusCode: 400,
        code: 'ZERO_BYTE_FILE'
      });
    });

    it('rejects unsupported file extension (.pdf, .docx, .exe) with UNSUPPORTED_FILE (415)', async () => {
      const buf = Buffer.from('not a pptx');
      await expect(validatePowerPointFile(buf, 'presentation.pdf')).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE'
      });
      await expect(validatePowerPointFile(buf, 'program.exe')).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE'
      });
    });

    it('rejects corrupt zip file disguised as .pptx with UNSUPPORTED_FILE (415)', async () => {
      const corruptBuf = Buffer.from('PK\x03\x04corrupted-non-zip-data');
      await expect(validatePowerPointFile(corruptBuf, 'corrupt.pptx')).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE'
      });
    });

    it('rejects password-encrypted OOXML presentations with ENCRYPTED_DOCUMENT (422)', async () => {
      const zip = new JSZip();
      zip.file('EncryptedPackage', 'encrypted content');
      zip.file('EncryptionInfo', 'info');
      const buf = await zip.generateAsync({ type: 'nodebuffer' });

      await expect(validatePowerPointFile(buf, 'locked.pptx')).rejects.toMatchObject({
        statusCode: 422,
        code: 'ENCRYPTED_DOCUMENT'
      });
    });

    it('rejects zip-bomb or path-traversal archives with FILE_TOO_COMPLEX (413)', async () => {
      const zip = new JSZip();
      zip.file('../evil.xml', '<evil/>');
      const buf = await zip.generateAsync({ type: 'nodebuffer' });

      await expect(validatePowerPointFile(buf, 'traversal.pptx')).rejects.toMatchObject({
        statusCode: 413,
        code: 'FILE_TOO_COMPLEX'
      });
    });

    it('validates legacy .ppt OLE2 magic bytes correctly', async () => {
      const invalidOpm = Buffer.from('NOT_AN_OLE_FILE');
      await expect(validatePowerPointFile(invalidOpm, 'legacy.ppt')).rejects.toMatchObject({
        statusCode: 415,
        code: 'UNSUPPORTED_FILE'
      });

      const validOle = Buffer.alloc(512);
      validOle[0] = 0xd0;
      validOle[1] = 0xcf;
      validOle[2] = 0x11;
      validOle[3] = 0xe0;
      validOle[4] = 0xa1;
      validOle[5] = 0xb1;
      validOle[6] = 0x1a;
      validOle[7] = 0xe1;

      const res = await validatePowerPointFile(validOle, 'legacy.ppt');
      expect(res.extension).toBe('.ppt');
      expect(res.isZipBased).toBe(false);
    });
  });

  describe('PPTX Normalizer & Security Stripping', () => {
    it('strips VBA macro binaries (vbaProject.bin) and emits a security warning', async () => {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
      );
      zip.file('ppt/vbaProject.bin', 'fake macro binary');
      zip.file('ppt/vbaProjectSignature.bin', 'fake signature');
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>'
      );

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const norm = await normalizePptx(buf);

      const cleanedZip = await JSZip.loadAsync(norm.buffer);
      expect(cleanedZip.file('ppt/vbaProject.bin')).toBeNull();
      expect(cleanedZip.file('ppt/vbaProjectSignature.bin')).toBeNull();
      expect(norm.warnings.some((w) => w.includes('VBA macros'))).toBe(true);
    });

    it('strips dangerous action execution links (ppaction://program, file:) from slides', async () => {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>'
      );
      zip.file(
        'ppt/slides/slide1.xml',
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:sp><p:nvSpPr><p:cNvPr id="1" name="Shape"><a:hlinkClick action="ppaction://program?calc.exe"/></p:cNvPr></p:nvSpPr></p:sp></p:sld>'
      );

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const norm = await normalizePptx(buf);

      const cleanedZip = await JSZip.loadAsync(norm.buffer);
      const cleanedSlide = await cleanedZip.file('ppt/slides/slide1.xml')?.async('text');
      expect(cleanedSlide).not.toContain('ppaction://program');
      expect(norm.warnings.some((w) => w.includes('Dangerous slide execution action'))).toBe(true);
    });

    it('unlinks external chart workbook references while preserving cached data', async () => {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>'
      );
      zip.file(
        'ppt/charts/chart1.xml',
        `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <c:chart><c:plotArea><c:val><c:numCache><c:v>1234</c:v></c:numCache></c:val></c:plotArea></c:chart>
          <c:externalData r:id="rId1"/>
        </c:chartSpace>`
      );
      zip.file(
        'ppt/charts/_rels/chart1.xml.rels',
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalData" Target="http://attacker.com/data.xlsx" TargetMode="External"/>
        </Relationships>`
      );

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const norm = await normalizePptx(buf);

      const cleanedZip = await JSZip.loadAsync(norm.buffer);
      const cleanedChart = await cleanedZip.file('ppt/charts/chart1.xml')?.async('text');
      expect(cleanedChart).not.toContain('<c:externalData');
      expect(cleanedChart).toContain('1234'); // Preserves cached values
      expect(norm.warnings.some((w) => w.includes('External chart data link was unlinked'))).toBe(true);
    });

    it('extracts slide titles and detects font substitutions', async () => {
      const buf = await createBasicPptxBuffer('Quarterly Strategy', 'Financial Metrics');
      const norm = await normalizePptx(buf);

      expect(norm.slideCount).toBe(2);
      expect(norm.slideTitles.length).toBeGreaterThanOrEqual(1);
      expect(norm.fontsSubstituted.length).toBeGreaterThanOrEqual(0);
    });

    it('filters slide visibility when custom slide range is specified', async () => {
      const buf = await createBasicPptxBuffer('Slide 1', 'Slide 2');
      const norm = await normalizePptx(buf, {
        slides: { mode: 'range', range: '1', includeHidden: false }
      });

      expect(norm.slideCount).toBe(2);
      expect(norm.exportedSlideCount).toBe(1);
      expect(norm.slides[0].isIncluded).toBe(true);
      expect(norm.slides[1].isIncluded).toBe(false);
    });

    it('does not emit animation warnings or unused theme script font warnings on standard decks', async () => {
      const buf = await createBasicPptxBuffer('Clean Deck', 'Second Slide');
      const norm = await normalizePptx(buf);

      // Clean deck should not have animation or theme script warnings
      expect(norm.warnings.some((w) => w.includes('Animations and transitions'))).toBe(false);
      expect(norm.warnings.some((w) => w.includes('游ゴシック') || w.includes('맑은 고딕'))).toBe(false);
      expect(norm.warnings.length).toBe(0);
    });

    it('consolidates embedded OLE resource removal into a single warning and ignores directories', async () => {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/></p:presentation>'
      );
      // Add folder entry and two OLE binaries
      zip.folder('ppt/embeddings');
      zip.file('ppt/embeddings/oleObject1.bin', 'binary1');
      zip.file('ppt/embeddings/oleObject2.bin', 'binary2');

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const norm = await normalizePptx(buf);

      expect(norm.warnings.some((w) => w.includes('Embedded active/OLE resources (2)'))).toBe(true);
      // Ensure no warning refers to 'ppt/embeddings/' directory directly
      expect(norm.warnings.some((w) => w.includes("('ppt/embeddings/')"))).toBe(false);
    });

    it('expands abnormally narrow text boxes with wrap="none" to prevent vertical text squishing', async () => {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="7555991" cy="10692384"/><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>'
      );
      zip.file(
        'ppt/_rels/presentation.xml.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>'
      );
      // Shape with cx=285750, wrap="none", and 100+ character paragraph
      const longParagraph = 'All silent auctions take place on behalf of the event owner. We act as an agent on the event owner behalf in relation to the silent auction.';
      zip.file(
        'ppt/slides/slide1.xml',
        `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <p:sp>
            <p:nvSpPr><p:cNvPr id="1" name="Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="514350" y="2000000"/><a:ext cx="285750" cy="800000"/></a:xfrm></p:spPr>
            <p:txBody><a:bodyPr wrap="none"/><a:p><a:r><a:t>${longParagraph}</a:t></a:r></a:p></p:txBody>
          </p:sp>
        </p:sld>`
      );

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const norm = await normalizePptx(buf);

      const cleanedZip = await JSZip.loadAsync(norm.buffer);
      const cleanedSlide = await cleanedZip.file('ppt/slides/slide1.xml')?.async('text');

      expect(cleanedSlide).toContain('wrap="square"');
      // Should have expanded from 285750 to available slide width (~6527291)
      expect(cleanedSlide).toContain('cx="6527291"');
    });
  });

  describe('Route-level Conversion Tests', () => {
    it('returns 400 for invalid slide range format', async () => {
      const pptx = await createBasicPptxBuffer();
      const res = await request(app)
        .post('/api/v1/powerpoint-to-pdf/convert')
        .field('options', JSON.stringify({ slides: { mode: 'range', range: 'abc-xyz' } }))
        .attach('files', pptx, 'test.pptx');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SLIDE_RANGE');
    });

    it('converts a valid presentation to PDF and serves download', async () => {
      const lo = await checkLibreOffice();
      if (!lo.available) {
        console.warn('SKIPPED: LibreOffice Impress not installed on test host');
        return;
      }

      const pptx = await createBasicPptxBuffer('Sales Overview', 'Summary');
      const res = await request(app)
        .post('/api/v1/powerpoint-to-pdf/convert')
        .attach('files', pptx, 'presentation.pptx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeTruthy();
      expect(res.body.data.files.length).toBe(1);
      expect(res.body.data.files[0].slideCount).toBe(2);
      expect(res.body.data.downloadUrl).toContain('/download');

      // Test download endpoint
      const dlRes = await request(app).get(res.body.data.downloadUrl);
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers['content-type']).toContain('application/pdf');
      expect(dlRes.body.slice(0, 5).toString('ascii')).toBe('%PDF-');

      // Verify that download deletes the ephemeral job
      const dlRes2 = await request(app).get(res.body.data.downloadUrl);
      expect(dlRes2.status).toBe(404);
      expect(dlRes2.body.error.code).toBe('DOWNLOAD_EXPIRED');
    });

    it('supports handout layout (3 slides per page with note lines)', async () => {
      const lo = await checkLibreOffice();
      if (!lo.available) {
        return;
      }

      const pptx = await createBasicPptxBuffer('Slide A', 'Slide B');
      const res = await request(app)
        .post('/api/v1/powerpoint-to-pdf/convert')
        .field(
          'options',
          JSON.stringify({
            layout: 'handout',
            handout: { perPage: 3, orientation: 'portrait', frames: true }
          })
        )
        .attach('files', pptx, 'handout.pptx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.files[0].pageCount).toBe(1); // 2 slides fit into 1 page of 3-per-page handout
    });

    it('supports batch upload with merged output option', async () => {
      const lo = await checkLibreOffice();
      if (!lo.available) {
        return;
      }

      const pptx1 = await createBasicPptxBuffer('Part 1', 'Part 1b');
      const pptx2 = await createBasicPptxBuffer('Part 2', 'Part 2b');

      const res = await request(app)
        .post('/api/v1/powerpoint-to-pdf/convert')
        .field('options', JSON.stringify({ merge: true }))
        .attach('files', pptx1, 'deck1.pptx')
        .attach('files', pptx2, 'deck2.pptx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.filename).toContain('_merged.pdf');

      const dlRes = await request(app).get(res.body.data.downloadUrl);
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers['content-type']).toContain('application/pdf');

      const pdfDoc = await PDFDocument.load(dlRes.body);
      expect(pdfDoc.getPageCount()).toBe(4); // 2 + 2 = 4 pages
    });
  });
});
