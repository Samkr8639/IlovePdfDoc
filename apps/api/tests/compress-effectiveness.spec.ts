import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFNumber, StandardFonts, rgb } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import {
  compressPdf,
  isGrayscaleImage,
  isBilevelScan,
  extractImageDisplayDimensions,
  COMPRESSION_PROFILES
} from '../src/services/compress';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

describe('Compress PDF Effectiveness & Optimizations', () => {
  describe('Unit Tests: Optimizations', () => {
    it('grayscale detection correctly classifies neutral vs colored RGB images', async () => {
      // 100x100 neutral gray buffer
      const grayRaw = Buffer.alloc(100 * 100 * 3, 128);
      expect(isGrayscaleImage(grayRaw, 3)).toBe(true);

      // 100x100 vibrant color buffer (red = 255, green = 20, blue = 20)
      const colorRaw = Buffer.alloc(100 * 100 * 3);
      for (let i = 0; i < colorRaw.length; i += 3) {
        colorRaw[i] = 255;
        colorRaw[i + 1] = 20;
        colorRaw[i + 2] = 20;
      }
      expect(isGrayscaleImage(colorRaw, 3)).toBe(false);
    });

    it('bilevel scan detection identifies high-contrast document scans', () => {
      // Scan simulation: 98% pixels near black (10) or near white (250)
      const scanRaw = Buffer.alloc(1000 * 3);
      for (let i = 0; i < scanRaw.length; i += 3) {
        const val = i % 10 === 0 ? 15 : 245; // 10% black text, 90% white background
        scanRaw[i] = val;
        scanRaw[i + 1] = val;
        scanRaw[i + 2] = val;
      }
      expect(isBilevelScan(scanRaw, 3)).toBe(true);

      // Continuous-tone photo simulation: midtones around 128
      const photoRaw = Buffer.alloc(1000 * 3, 128);
      expect(isBilevelScan(photoRaw, 3)).toBe(false);
    });

    it('extracts image display dimensions from content stream transformations', async () => {
      const doc = await PDFDocument.create();
      const imgBuf = await sharp({
        create: { width: 400, height: 400, channels: 3, background: { r: 50, g: 150, b: 250 } }
      }).jpeg().toBuffer();
      const img = await doc.embedJpg(imgBuf);
      const page = doc.addPage([600, 800]);

      // Draw image displayed at width: 200 pt, height: 150 pt
      page.drawImage(img, { x: 50, y: 500, width: 200, height: 150 });
      const bytes = await doc.save();

      const loaded = await PDFDocument.load(bytes);
      const dimsMap = extractImageDisplayDimensions(loaded);

      expect(dimsMap.size).toBe(1);
      const dims = Array.from(dimsMap.values())[0];
      expect(dims.scaleXPt).toBeCloseTo(200, 1);
      expect(dims.scaleYPt).toBeCloseTo(150, 1);

      // Effective DPI: 400 px / (200 pt / 72 pt/in) = 144 DPI
      const effDpiX = 400 / (dims.scaleXPt / 72);
      expect(Math.round(effDpiX)).toBe(144);
    });

    it('deduplicates identical image streams shared across multiple pages', async () => {
      const doc = await PDFDocument.create();
      const logoBuf = await sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
      }).jpeg({ quality: 90 }).toBuffer();

      // Embed same logo buffer into two separate images
      const img1 = await doc.embedJpg(logoBuf);
      const img2 = await doc.embedJpg(logoBuf);

      const p1 = doc.addPage([500, 500]);
      p1.drawImage(img1, { x: 50, y: 50, width: 200, height: 200 });

      const p2 = doc.addPage([500, 500]);
      p2.drawImage(img2, { x: 50, y: 50, width: 200, height: 200 });

      const origBytes = await doc.save();
      const origSize = origBytes.length;

      const result = await compressPdf(Buffer.from(origBytes), 'dedupe_test.pdf', { level: 'recommended' });
      expect(result.stats.imagesDeduplicated).toBeGreaterThanOrEqual(1);
      expect(result.compressedBuffer.length).toBeLessThan(origSize);
    });

    it('enforces never-larger rule: returns original buffer when compression does not reduce size', async () => {
      // Create minimal single-page PDF with tiny text
      const doc = await PDFDocument.create();
      const page = doc.addPage([200, 200]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Tiny', { x: 10, y: 100, size: 12, font, color: rgb(0, 0, 0) });
      const origBytes = Buffer.from(await doc.save({ useObjectStreams: true }));

      const res = await compressPdf(origBytes, 'tiny.pdf', { level: 'less' });
      expect(res.compressedBuffer.length).toBeLessThanOrEqual(origBytes.length);
      expect(res.stats.spaceSavedBytes).toBeGreaterThanOrEqual(0);
      expect(res.stats.savingsReason).toMatch(/already/i);
    });

    it('strips metadata on extreme level and preserves metadata on recommended level', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Confidential Proposal Title');
      doc.setAuthor('Secret Author');
      doc.setSubject('Classified Subject');
      const page = doc.addPage([400, 400]);
      page.drawText('Document content', { x: 50, y: 300, size: 14 });
      const origBytes = Buffer.from(await doc.save());

      // Extreme: metadata stripped
      const extremeRes = await compressPdf(origBytes, 'meta_ext.pdf', { level: 'extreme' });
      const extremeDoc = await PDFDocument.load(extremeRes.compressedBuffer);
      expect(extremeDoc.getTitle()).toBeFalsy();
      expect(extremeDoc.getAuthor()).toBeFalsy();

      // Recommended: metadata preserved
      const recRes = await compressPdf(origBytes, 'meta_rec.pdf', { level: 'recommended' });
      const recDoc = await PDFDocument.load(recRes.compressedBuffer);
      expect(recDoc.getTitle()).toBe('Confidential Proposal Title');
      expect(recDoc.getAuthor()).toBe('Secret Author');
    });
  });

  describe('Integration Tests: Real-World Fixtures', () => {
    it('photo-heavy brochure achieves >= 50% on recommended and >= 70% on extreme', async () => {
      const brochurePath = path.join(FIXTURES_DIR, 'sample-2-photo-brochure.pdf');
      const origBuf = fs.readFileSync(brochurePath);

      const recRes = await compressPdf(origBuf, 'brochure.pdf', { level: 'recommended' });
      expect(recRes.stats.reductionPercentage).toBeGreaterThanOrEqual(50);

      const extRes = await compressPdf(origBuf, 'brochure.pdf', { level: 'extreme' });
      expect(extRes.stats.reductionPercentage).toBeGreaterThanOrEqual(70);

      // Verify level hierarchy: extreme size < recommended size
      expect(extRes.compressedBuffer.length).toBeLessThan(recRes.compressedBuffer.length);
    });

    it('PowerPoint PNG backgrounds achieve >= 60% compression', async () => {
      const pptPath = path.join(FIXTURES_DIR, 'sample-4-powerpoint-png.pdf');
      const origBuf = fs.readFileSync(pptPath);

      const res = await compressPdf(origBuf, 'ppt.pdf', { level: 'recommended' });
      expect(res.stats.reductionPercentage).toBeGreaterThanOrEqual(60);
    });

    it('scanned 20-page document achieves >= 70% on extreme', async () => {
      const scanPath = path.join(FIXTURES_DIR, 'sample-1-scanned-20page.pdf');
      const origBuf = fs.readFileSync(scanPath);

      const extRes = await compressPdf(origBuf, 'scanned.pdf', { level: 'extreme' });
      expect(extRes.stats.reductionPercentage).toBeGreaterThanOrEqual(70);
    });

    it('text-only contract never inflates and returns friendly explanation', async () => {
      const textPath = path.join(FIXTURES_DIR, 'sample-3-text-contract.pdf');
      const origBuf = fs.readFileSync(textPath);

      const res = await compressPdf(origBuf, 'contract.pdf', { level: 'recommended' });
      expect(res.compressedBuffer.length).toBeLessThanOrEqual(origBuf.length);
      expect(res.stats.savingsReason).toMatch(/mostly text|already/i);
    });

    it('preserves selectable text content and page geometry after compression', async () => {
      const contractPath = path.join(FIXTURES_DIR, 'sample-3-text-contract.pdf');
      const origBuf = fs.readFileSync(contractPath);

      const res = await compressPdf(origBuf, 'contract.pdf', { level: 'recommended' });

      // 1. Verify page count and page dimensions with PDFDocument
      const origDoc = await PDFDocument.load(origBuf);
      const compDoc = await PDFDocument.load(res.compressedBuffer);

      expect(compDoc.getPageCount()).toBe(origDoc.getPageCount());

      for (let p = 0; p < origDoc.getPageCount(); p++) {
        const origSize = origDoc.getPage(p).getSize();
        const compSize = compDoc.getPage(p).getSize();
        expect(compSize.width).toBeCloseTo(origSize.width, 1);
        expect(compSize.height).toBeCloseTo(origSize.height, 1);
      }

      // 2. Verify extracted text content with PDFParse
      const origParser = new PDFParse({ data: origBuf });
      const compParser = new PDFParse({ data: res.compressedBuffer });

      const origParsed = await origParser.getText();
      const compParsed = await compParser.getText();

      expect(compParsed.text.trim()).toBe(origParsed.text.trim());
    });
  });
});
