import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFNumber } from 'pdf-lib';

const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures');

/**
 * Creates a noisy black & white / grayscale scanned document page image
 */
async function createScannedPageImage(pageNum: number, width = 1200, height = 1600): Promise<Buffer> {
  const svgLines: string[] = [];
  svgLines.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
  // Slight off-white scan paper background
  svgLines.push(`<rect width="${width}" height="${height}" fill="#fdfbf7"/>`);

  // Document scan header
  svgLines.push(`<text x="80" y="100" font-family="Courier, monospace" font-size="28" font-weight="bold" fill="#111111">CONFIDENTIAL MEDICAL REPORT - ARCHIVE PAGE ${pageNum}</text>`);
  svgLines.push(`<line x1="80" y1="120" x2="${width - 80}" y2="120" stroke="#333333" stroke-width="2"/>`);

  // Multiple paragraphs of dense scanned text
  for (let row = 0; row < 36; row++) {
    const y = 160 + row * 38;
    const indent = row % 6 === 0 ? 120 : 80;
    const words = [
      `Section ${pageNum}.${row + 1}: The patient presented with persistent standard clinical symptoms.`,
      `Diagnostic evaluation indicates nominal baseline parameters across all observed telemetry indicators.`,
      `Follow-up protocol designated according to hospital regulation standard 408-B.`,
      `Verified by presiding physician on record. Laboratory reference samples indexed and retained.`
    ];
    const text = words[row % words.length];
    svgLines.push(`<text x="${indent}" y="${y}" font-family="Courier, monospace" font-size="18" fill="#181818">${text}</text>`);
  }

  // Stamp at the bottom
  svgLines.push(`<rect x="${width - 320}" y="${height - 180}" width="220" height="90" fill="none" stroke="#666666" stroke-width="3" stroke-dasharray="6,4"/>`);
  svgLines.push(`<text x="${width - 300}" y="${height - 130}" font-family="Courier, monospace" font-size="20" font-weight="bold" fill="#444444">OFFICIAL RECORD</text>`);
  svgLines.push(`<text x="${width - 280}" y="${height - 105}" font-family="Courier, monospace" font-size="14" fill="#666666">PAGE ${pageNum} OF 20</text>`);

  svgLines.push(`</svg>`);

  const svgBuf = Buffer.from(svgLines.join('\n'));

  // Render to JPEG with high quality to simulate scan sensor noise
  return sharp(svgBuf)
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Creates high resolution photo buffer for brochure
 */
async function createPhotoBuffer(width = 1800, height = 1200, color1 = '#1e3a8a', color2 = '#0d9488'): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
      <circle cx="${width / 3}" cy="${height / 2}" r="${height / 3}" fill="#ffffff" fill-opacity="0.25" />
      <circle cx="${(2 * width) / 3}" cy="${height / 3}" r="${height / 4}" fill="#ffffff" fill-opacity="0.3" />
      <polygon points="${width / 4},${height * 0.8} ${width / 2},${height * 0.25} ${(3 * width) / 4},${height * 0.8}" fill="#ffffff" fill-opacity="0.2" />
      <text x="${width / 2}" y="${height / 2 + 30}" font-family="sans-serif" font-size="72" font-weight="900" fill="#ffffff" text-anchor="middle">HIGH-RES PRODUCT PHOTOGRAPHY</text>
    </svg>
  `;
  return sharp(Buffer.from(svg))
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Creates large opaque PNG background for slides
 */
async function createSlideBackgroundPng(width = 1920, height = 1080, slideNum: number): Promise<Buffer> {
  const colors = [
    ['#0f172a', '#3b82f6'],
    ['#1e1b4b', '#6366f1'],
    ['#064e3b', '#10b981'],
    ['#701a75', '#ec4899'],
    ['#451a03', '#f59e0b']
  ];
  const [c1, c2] = colors[(slideNum - 1) % colors.length];

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rgrad" cx="50%" cy="50%" r="75%">
          <stop offset="0%" style="stop-color:${c2};stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:${c1};stop-opacity:1" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#rgrad)" />
      <circle cx="200" cy="200" r="350" fill="#ffffff" fill-opacity="0.06" />
      <circle cx="${width - 200}" cy="${height - 200}" r="400" fill="#ffffff" fill-opacity="0.05" />
      <path d="M 0,${height * 0.7} Q ${width * 0.5},${height * 0.4} ${width},${height * 0.7} L ${width},${height} L 0,${height} Z" fill="#ffffff" fill-opacity="0.08" />
    </svg>
  `;
  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 4 }) // standard unoptimized PNG
    .toBuffer();
}

/**
 * 1. Scanned 20-Page Document PDF
 */
async function generateScanned20PagePdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-1-scanned-20page.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('Archived Scanned Records (20 Pages)');

  for (let i = 1; i <= 20; i++) {
    const imgBuf = await createScannedPageImage(i, 1200, 1600);
    const img = await doc.embedJpg(imgBuf);
    // 8.5 x 11 inches in PDF points: 612 x 792
    const page = doc.addPage([612, 792]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: 612,
      height: 792
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * 2. Photo-Heavy Brochure PDF
 */
async function generatePhotoBrochurePdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-2-photo-brochure.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('PaperFlow Enterprise Solutions Brochure');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // 4 pages, each with 2 large high-res photos
  for (let p = 1; p <= 4; p++) {
    const page = doc.addPage([612, 792]);

    page.drawText(`PAPERFLOW BROCHURE - EDITION ${p}`, {
      x: 50,
      y: 740,
      size: 20,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.4)
    });

    page.drawText('High-Performance Document Engineering for Cloud and On-Premise Workloads', {
      x: 50,
      y: 715,
      size: 11,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3)
    });

    // Embed 2 high-res photos per page
    const photo1Buf = await createPhotoBuffer(1800, 1200, '#1e3a8a', '#0d9488');
    const photo1 = await doc.embedJpg(photo1Buf);
    // Displayed in a 250 x 170 pt box -> Effective DPI ~ 518 DPI!
    page.drawImage(photo1, {
      x: 50,
      y: 510,
      width: 240,
      height: 160
    });

    const photo2Buf = await createPhotoBuffer(1800, 1200, '#b45309', '#be123c');
    const photo2 = await doc.embedJpg(photo2Buf);
    page.drawImage(photo2, {
      x: 320,
      y: 510,
      width: 240,
      height: 160
    });

    page.drawText('Feature Showcase A', { x: 50, y: 485, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Enterprise-grade PDF optimization engine reduces storage footprints by up to 85% without perceptible raster degradation or loss of structural typography.', {
      x: 50,
      y: 460,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 240,
      lineHeight: 14
    });

    page.drawText('Feature Showcase B', { x: 320, y: 485, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Dynamic stream downsampling, automatic RGB to DeviceGray conversion, and aggressive Flate re-encoding ensure compliant delivery across secure email pipelines.', {
      x: 320,
      y: 460,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 240,
      lineHeight: 14
    });

    // Lower half layout photo
    const photo3Buf = await createPhotoBuffer(1800, 900, '#047857', '#0369a1');
    const photo3 = await doc.embedJpg(photo3Buf);
    page.drawImage(photo3, {
      x: 50,
      y: 160,
      width: 512,
      height: 220
    });

    page.drawText(`Page ${p} of 4 | Confidential Marketing Material`, {
      x: 50,
      y: 40,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * 3. Text-Only Contract PDF (No raster images)
 */
async function generateTextContractPdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-3-text-contract.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('Master Services Agreement & Statement of Work');
  doc.setAuthor('Legal Counsel');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  for (let p = 1; p <= 6; p++) {
    const page = doc.addPage([612, 792]);

    page.drawText(`MASTER SERVICES AGREEMENT - SECTION ${p}`, {
      x: 50,
      y: 740,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });

    page.drawLine({
      start: { x: 50, y: 725 },
      end: { x: 562, y: 725 },
      thickness: 1,
      color: rgb(0.4, 0.4, 0.4)
    });

    let currentY = 700;
    for (let c = 1; c <= 8; c++) {
      page.drawText(`Article ${p}.${c}: Representation, Covenants and Mutual Warranties`, {
        x: 50,
        y: currentY,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2)
      });
      currentY -= 18;

      const clauseText =
        `The Parties hereby mutually agree and covenant that all services rendered hereunder shall strictly conform with industry benchmarks and governing commercial statutes. Neither party shall be liable for incidental, special, or consequential damages resulting from operational interruptions or third-party telecommunication failures. All proprietary disclosures shall remain strictly confidential during the term hereof and for a period of five (5) years following termination.`;

      page.drawText(clauseText, {
        x: 50,
        y: currentY,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.25, 0.25, 0.25),
        maxWidth: 512,
        lineHeight: 14
      });
      currentY -= 52;
    }

    page.drawText(`Page ${p} of 6 - Contract Ref #MSA-2026-X89`, {
      x: 50,
      y: 35,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024).toFixed(1)} KB`);
}

/**
 * 4. PowerPoint-Exported PDF with Big PNG Backgrounds
 */
async function generatePowerPointPngPdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-4-powerpoint-png.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('Executive Strategy Deck - Q4 Presentation');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // 5 slides in 16:9 widescreen format (960 x 540 pt)
  for (let s = 1; s <= 5; s++) {
    const page = doc.addPage([960, 540]);

    // Embed heavy PNG background (FlateDecode)
    const pngBuf = await createSlideBackgroundPng(1920, 1080, s);
    const bgImg = await doc.embedPng(pngBuf);
    page.drawImage(bgImg, {
      x: 0,
      y: 0,
      width: 960,
      height: 540
    });

    // Slide Title & Content
    page.drawText(`STRATEGIC PILLAR ${s}: CLOUD INFRASTRUCTURE ACCELERATION`, {
      x: 60,
      y: 460,
      size: 22,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page.drawText(`Quarterly Roadmap and Architecture Milestones (Slide ${s} of 5)`, {
      x: 60,
      y: 430,
      size: 13,
      font: fontRegular,
      color: rgb(0.9, 0.9, 0.9)
    });

    const bullets = [
      '• Transitioned 100% of PDF processing workloads to distributed asynchronous workers.',
      '• Implemented zero-copy streaming pipeline reducing memory allocations by 45%.',
      '• Expanded regional edge points of presence across North America and Europe.',
      '• Certified ISO-27001 and SOC-2 Type II audit compliance with automated reporting.'
    ];

    let by = 360;
    for (const b of bullets) {
      page.drawText(b, {
        x: 80,
        y: by,
        size: 14,
        font: fontRegular,
        color: rgb(0.95, 0.95, 0.95)
      });
      by -= 38;
    }
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * 5. PDF with Full (Non-Subset) Embedded Font
 */
async function generateFullFontPdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-5-full-font.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('Document with Full Embedded TrueType Font File');

  // Load Arial font from Windows
  const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
  let fontBytes: Buffer;
  if (fs.existsSync(fontPath)) {
    fontBytes = fs.readFileSync(fontPath);
  } else {
    // Fallback: create synthetic 200KB font stream
    fontBytes = Buffer.alloc(256 * 1024, 0x41);
  }

  const compressedFont = zlib.deflateSync(fontBytes);

  const fontStreamRef = doc.context.nextRef();
  const fontStream = doc.context.stream(compressedFont, {
    Length1: PDFNumber.of(fontBytes.length),
    Filter: PDFName.of('FlateDecode')
  });
  doc.context.assign(fontStreamRef, fontStream);

  const fontDescRef = doc.context.nextRef();
  const fontDesc = doc.context.obj({
    Type: PDFName.of('FontDescriptor'),
    FontName: PDFName.of('ArialMT'),
    Flags: PDFNumber.of(32),
    FontBBox: [-665, -325, 2000, 1006],
    ItalicAngle: PDFNumber.of(0),
    Ascent: PDFNumber.of(728),
    Descent: PDFNumber.of(-210),
    CapHeight: PDFNumber.of(728),
    FontFile2: fontStreamRef
  });
  doc.context.assign(fontDescRef, fontDesc);

  const fontRef = doc.context.nextRef();
  const fontDict = doc.context.obj({
    Type: PDFName.of('Font'),
    Subtype: PDFName.of('TrueType'),
    BaseFont: PDFName.of('ArialMT'), // Non-subset name (no 6-letter prefix!)
    FirstChar: PDFNumber.of(32),
    LastChar: PDFNumber.of(255),
    Widths: doc.context.obj(new Array(224).fill(600)),
    FontDescriptor: fontDescRef
  });
  doc.context.assign(fontRef, fontDict);

  // Add 3 pages
  for (let p = 1; p <= 3; p++) {
    const page = doc.addPage([612, 792]);
    const res = page.node.Resources();
    const fontRes = doc.context.obj({ F1: fontRef });
    res.set(PDFName.of('Font'), fontRes);

    const stdFont = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(`DOCUMENT WITH FULL NON-SUBSET EMBEDDED FONT - PAGE ${p}`, {
      x: 50,
      y: 730,
      size: 14,
      font: stdFont,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawText('This document embeds the complete TrueType font program (ArialMT, ~1MB) rather than a subset.', {
      x: 50,
      y: 700,
      size: 11,
      font: stdFont,
      color: rgb(0.3, 0.3, 0.3)
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024).toFixed(1)} KB`);
}

/**
 * 6. PDF Exported from Word with ICC Profiles
 */
async function generateWordIccPdf(): Promise<void> {
  const target = path.join(FIXTURES_DIR, 'sample-6-word-icc.pdf');
  console.log(`Generating ${path.basename(target)}...`);
  const doc = await PDFDocument.create();
  doc.setTitle('Word Export Document with Embedded sRGB ICC Profile');
  doc.setCreator('Microsoft® Word for Microsoft 365');
  doc.setProducer('Microsoft® Word 365 PDF Export');

  // Load real sRGB ICM profile from Windows System directory if present
  const iccPath = 'C:\\Windows\\System32\\spool\\drivers\\color\\sRGB Color Space Profile.icm';
  let iccBytes: Buffer;
  if (fs.existsSync(iccPath)) {
    iccBytes = fs.readFileSync(iccPath);
  } else {
    // Generate synthetic 128KB profile data
    iccBytes = Buffer.from('sRGB Profile Header' + 'X'.repeat(128 * 1024));
  }

  const compressedIcc = zlib.deflateSync(iccBytes);
  const iccProfileRef = doc.context.nextRef();
  const iccStream = doc.context.stream(compressedIcc, {
    N: PDFNumber.of(3),
    Alternate: PDFName.of('DeviceRGB'),
    Filter: PDFName.of('FlateDecode')
  });
  doc.context.assign(iccProfileRef, iccStream);

  // XMP Metadata packet
  const xmpPacket = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Microsoft Word 365</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Word Export Document with ICC Profile</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const metaStreamRef = doc.context.nextRef();
  const metaStream = doc.context.stream(Buffer.from(xmpPacket, 'utf8'), {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML')
  });
  doc.context.assign(metaStreamRef, metaStream);
  (doc.catalog as any).set(PDFName.of('Metadata'), metaStreamRef);

  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman);

  for (let p = 1; p <= 4; p++) {
    const page = doc.addPage([612, 792]);
    const csArray = doc.context.obj([PDFName.of('ICCBased'), iccProfileRef]);
    const csDict = doc.context.obj({ DefaultRGB: csArray });
    page.node.Resources().set(PDFName.of('ColorSpace'), csDict);

    page.drawText(`Microsoft Word Export Simulation - Page ${p}`, {
      x: 72,
      y: 720,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.3)
    });

    page.drawText(
      `This PDF contains an embedded ICC profile dictionary (/DefaultRGB -> /ICCBased stream) and standard XML/XMP document metadata commonly exported by desktop word processors. Notice how standard stream-only optimizers fail to strip or downscale colour profile streams unless specifically instructed.`,
      {
        x: 72,
        y: 680,
        size: 11,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: 468,
        lineHeight: 16
      }
    );
  }

  const bytes = await doc.save();
  fs.writeFileSync(target, bytes);
  console.log(`✓ Created ${path.basename(target)}: ${(bytes.length / 1024).toFixed(1)} KB`);
}

async function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  console.log('Generating PDF test fixtures in:', FIXTURES_DIR);
  await generateScanned20PagePdf();
  await generatePhotoBrochurePdf();
  await generateTextContractPdf();
  await generatePowerPointPngPdf();
  await generateFullFontPdf();
  await generateWordIccPdf();
  console.log('\nAll 6 test fixtures generated successfully!');
}

main().catch(err => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
