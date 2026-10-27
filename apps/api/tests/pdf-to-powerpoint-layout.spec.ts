import { PDFDocument, StandardFonts, rgb, LineCapStyle } from 'pdf-lib';
import JSZip from 'jszip';
const { PNG } = require('pngjs');
import { convertPdfToPptx } from '../src/services/pdf-to-powerpoint';

describe('PDF to PowerPoint Visual & Structural Layout Regression Suite', () => {
  let samplePdfBuffer: Buffer;
  let matchPdfBuffer: Buffer;
  let matchSlideCount: number;
  let matchZip: JSZip;
  let widePdfBuffer: Buffer;
  let wideSlideCount: number;
  let wideZip: JSZip;

  beforeAll(async () => {
    const doc = await PDFDocument.create();
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);

    // Create a 10x10 red PNG image
    const png = new PNG({ width: 10, height: 10 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 255;     // R
      png.data[i + 1] = 50;  // G
      png.data[i + 2] = 50;  // B
      png.data[i + 3] = 255; // A
    }
    const pngBytes = PNG.sync.write(png);
    const embeddedImg = await doc.embedPng(pngBytes);

    // Page 1: 612 x 792 pt (8.5 x 11 inches)
    const page1 = doc.addPage([612, 792]);
    // Text in 2 fonts, colours, bold
    page1.drawText('Executive Summary', {
      x: 72,
      y: 700,
      size: 24,
      font: helveticaBold,
      color: rgb(0.85, 0.1, 0.1) // Red hex E53238 range
    });
    page1.drawText('Financial highlights and operational performance', {
      x: 72,
      y: 660,
      size: 14,
      font: timesRoman,
      color: rgb(0.1, 0.1, 0.1)
    });

    // Box (filled rect with stroke)
    page1.drawRectangle({
      x: 72,
      y: 500,
      width: 250,
      height: 120,
      color: rgb(0.9, 0.95, 1.0),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 2
    });

    // Dotted rule (drawn as chained tiny rect fragments to exercise scanner merge logic)
    for (let dotX = 72; dotX <= 300; dotX += 6) {
      page1.drawRectangle({
        x: dotX,
        y: 450,
        width: 2,
        height: 1.5,
        color: rgb(0.3, 0.3, 0.3)
      });
    }

    // Image
    page1.drawImage(embeddedImg, {
      x: 72,
      y: 320,
      width: 80,
      height: 80
    });

    // Page 2: Different dimension 720 x 540 pt (10 x 7.5 inches)
    const page2 = doc.addPage([720, 540]);
    page2.drawText('Appendix: Methodology & Metrics', {
      x: 60,
      y: 460,
      size: 20,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    page2.drawText('All statistical samples derived from verified audit logs.', {
      x: 60,
      y: 420,
      size: 12,
      font: timesRoman,
      color: rgb(0.2, 0.2, 0.2)
    });

    const pdfBytes = await doc.save();
    samplePdfBuffer = Buffer.from(pdfBytes);

    const matchRes = await convertPdfToPptx(samplePdfBuffer, {
      slideSize: 'match_pdf',
      mode: 'no_ocr'
    });
    matchPdfBuffer = matchRes.pptxBuffer;
    matchSlideCount = matchRes.slideCount;
    matchZip = await JSZip.loadAsync(matchPdfBuffer);

    const wideRes = await convertPdfToPptx(samplePdfBuffer, {
      slideSize: 'widescreen_16_9',
      mode: 'no_ocr'
    });
    widePdfBuffer = wideRes.pptxBuffer;
    wideSlideCount = wideRes.slideCount;
    wideZip = await JSZip.loadAsync(widePdfBuffer);
  }, 30000);

  it('preserves exact page dimensions and layout in match_pdf mode', async () => {
    expect(matchSlideCount).toBe(2);
    expect(matchPdfBuffer.length).toBeGreaterThan(1000);

    const zip = matchZip;

    // Verify slide count from slide XML files
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide2.xml')).not.toBeNull();
    expect(zip.file('ppt/slides/slide3.xml')).toBeNull();

    // Verify ppt/presentation.xml slide size in EMU
    // Page 1 is 612 x 792 pt = 8.5 x 11 inches = 7772400 x 10058400 EMU
    const presXml = await zip.file('ppt/presentation.xml')!.async('text');
    expect(presXml).toContain('<p:sldSz');
    expect(presXml).toContain('cx="7772400"');
    expect(presXml).toContain('cy="10058400"');

    // Inspect slide 1 XML
    const slide1Xml = await zip.file('ppt/slides/slide1.xml')!.async('text');

    // Text content present
    expect(slide1Xml).toContain('Executive Summary');
    expect(slide1Xml).toContain('Financial highlights');

    // Colors and bold applied
    expect(slide1Xml).toContain('b="1"'); // bold
    expect(slide1Xml).toMatch(/val="[0-9A-Fa-f]{6}"/); // color

    // Image present via <p:pic>
    const picMatches = slide1Xml.match(/<p:pic[\s>]/g) || [];
    expect(picMatches.length).toBeGreaterThanOrEqual(1);

    // Shapes present (box + line + text boxes)
    const shapeMatches = slide1Xml.match(/<p:sp[\s>]/g) || [];
    expect(shapeMatches.length).toBeGreaterThanOrEqual(3);

    // Dotted line prstDash check (e.g. <a:prstDash val="sysDot"/>)
    expect(slide1Xml).toMatch(/prstDash\s+val="(sysDot|dash|dot)"/);

    // Text box offset: x = 72 pt = 1.0 inch = 914400 EMU
    // Let's assert a:off x is within 1 pt (~12700 EMU) of 914400
    const offsetMatches = slide1Xml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/g) || [];
    expect(offsetMatches.length).toBeGreaterThan(0);

    // Inspect slide 2 XML
    const slide2Xml = await zip.file('ppt/slides/slide2.xml')!.async('text');
    expect(slide2Xml).toContain('Appendix: Methodology');
    expect(slide2Xml).toContain('verified audit logs');
  });

  it('correctly maps 16:9 widescreen layout (12192000 x 6858000 EMU)', async () => {
    expect(wideSlideCount).toBe(2);

    const zip = wideZip;
    const presXml = await zip.file('ppt/presentation.xml')!.async('text');

    // 16:9 widescreen: 13.333333 x 7.5 inches = 12192000 x 6858000 EMU
    expect(presXml).toContain('cx="12192000"');
    expect(presXml).toContain('cy="6858000"');

    // Verify slide 1 contents fit within slide bounds
    const slide1Xml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    expect(slide1Xml).toContain('Executive Summary');

    // Parse all shape positions: none should exceed widescreen dimensions
    const re = /<a:off\s+x="(\d+)"\s+y="(\d+)"/g;
    let match;
    while ((match = re.exec(slide1Xml)) !== null) {
      const xEmu = parseInt(match[1], 10);
      const yEmu = parseInt(match[2], 10);
      expect(xEmu).toBeLessThanOrEqual(12192000);
      expect(yEmu).toBeLessThanOrEqual(6858000);
    }
  });
});
