import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PowerPointToPdfOptions, HandoutOptions } from '@paperflow/contracts';

export interface PostProcessOptions {
  options: PowerPointToPdfOptions;
  deckTitle?: string;
  originalName: string;
  slideTitles?: string[];
  maxPages?: number;
}

export interface PostProcessResult {
  pdfBuffer: Buffer;
  pageCount: number;
  warnings: string[];
}

const PAGE_SIZES = {
  a4_portrait: { width: 595.28, height: 841.89 },
  a4_landscape: { width: 841.89, height: 595.28 },
  letter_portrait: { width: 612.0, height: 792.0 },
  letter_landscape: { width: 792.0, height: 612.0 }
};

export async function postProcessPptPdf(
  inputPdfBuffer: Buffer,
  opts: PostProcessOptions
): Promise<PostProcessResult> {
  const warnings: string[] = [];
  const maxPages = opts.maxPages || parseInt(process.env['MAX_PDF_PAGES'] || '400', 10);

  // Validate PDF magic bytes
  if (
    inputPdfBuffer.length < 5 ||
    inputPdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-'
  ) {
    throw new Error('Invalid PDF output received from converter.');
  }

  const srcDoc = await PDFDocument.load(inputPdfBuffer, { ignoreEncryption: true });
  const rawPageCount = srcDoc.getPageCount();

  if (rawPageCount === 0) {
    throw new Error('PDF document has zero pages.');
  }

  let finalDoc: PDFDocument;

  // ────────────────────────────────────────────────────────────
  // 1. Handout Imposition
  // ────────────────────────────────────────────────────────────
  if (opts.options.layout === 'handout') {
    finalDoc = await PDFDocument.create();
    const handout = opts.options.handout || {
      perPage: 3,
      orientation: 'portrait',
      frames: false
    };

    const isLandscape = handout.orientation === 'landscape';
    const sheetDims = isLandscape ? PAGE_SIZES.a4_landscape : PAGE_SIZES.a4_portrait;
    const font = await finalDoc.embedFont(StandardFonts.Helvetica);

    const perPage = handout.perPage;
    let cols = 1;
    let rows = 1;
    let isThreePerPage = false;

    if (perPage === 1) {
      cols = 1;
      rows = 1;
    } else if (perPage === 2) {
      cols = isLandscape ? 2 : 1;
      rows = isLandscape ? 1 : 2;
    } else if (perPage === 3) {
      cols = 1;
      rows = 3;
      isThreePerPage = true; // Slides on left, ruled note lines on right
    } else if (perPage === 4) {
      cols = 2;
      rows = 2;
    } else if (perPage === 6) {
      cols = isLandscape ? 3 : 2;
      rows = isLandscape ? 2 : 3;
    } else if (perPage === 9) {
      cols = 3;
      rows = 3;
    }

    const marginX = 36;
    const marginY = 40;
    const footerHeight = 24;
    const availableW = sheetDims.width - marginX * 2;
    const availableH = sheetDims.height - marginY * 2 - footerHeight;

    const cellW = availableW / cols;
    const cellH = availableH / rows;
    const gutter = 12;

    const totalHandoutPages = Math.ceil(rawPageCount / perPage);

    for (let hp = 0; hp < totalHandoutPages; hp++) {
      const page = finalDoc.addPage([sheetDims.width, sheetDims.height]);
      const startIndex = hp * perPage;
      const endIndex = Math.min(startIndex + perPage, rawPageCount);

      for (let sIdx = startIndex; sIdx < endIndex; sIdx++) {
        const slot = sIdx - startIndex;
        const col = isThreePerPage ? 0 : slot % cols;
        const row = isThreePerPage ? slot : Math.floor(slot / cols);

        // In PDF coordinates, (0, 0) is bottom-left
        const slotX = marginX + col * cellW;
        const slotY = sheetDims.height - marginY - (row + 1) * cellH;

        const [embedded] = await finalDoc.embedPdf(srcDoc, [sIdx]);
        const origW = embedded.width;
        const origH = embedded.height;

        let maxSlideW = isThreePerPage ? (cellW * 0.55) - gutter : cellW - gutter * 2;
        let maxSlideH = cellH - gutter * 2;

        const scale = Math.min(maxSlideW / origW, maxSlideH / origH);
        const drawW = origW * scale;
        const drawH = origH * scale;

        const drawX = slotX + (maxSlideW - drawW) / 2 + gutter;
        const drawY = slotY + (cellH - drawH) / 2;

        page.drawPage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });

        // Draw frame around slide if requested
        if (handout.frames) {
          page.drawRectangle({
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
            borderColor: rgb(0.2, 0.2, 0.2),
            borderWidth: 0.75
          });
        }

        // For 3-per-page: draw ruled note lines on the right side
        if (isThreePerPage) {
          const linesStartX = slotX + cellW * 0.58;
          const linesEndX = slotX + cellW - gutter;
          const lineCount = 3;
          const lineSpacing = drawH / (lineCount + 1);

          for (let l = 1; l <= lineCount; l++) {
            const lineY = drawY + l * lineSpacing;
            page.drawLine({
              start: { x: linesStartX, y: lineY },
              end: { x: linesEndX, y: lineY },
              thickness: 0.5,
              color: rgb(0.7, 0.7, 0.7)
            });
          }
        }
      }

      // Footer page numbering
      const footerText = `Page ${hp + 1} of ${totalHandoutPages}`;
      const textWidth = font.widthOfTextAtSize(footerText, 9);
      page.drawText(footerText, {
        x: (sheetDims.width - textWidth) / 2,
        y: 18,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });
    }
  } else if (
    opts.options.layout === 'slides' &&
    opts.options.pageSize &&
    opts.options.pageSize !== 'as_slide'
  ) {
    // ────────────────────────────────────────────────────────────
    // 2. Uniform Slide Scaling to A4/Letter Landscape
    // ────────────────────────────────────────────────────────────
    finalDoc = await PDFDocument.create();
    const sheetDims =
      opts.options.pageSize === 'letter_landscape'
        ? PAGE_SIZES.letter_landscape
        : PAGE_SIZES.a4_landscape;

    const margin = 24; // 24pt margin
    const targetW = sheetDims.width - margin * 2;
    const targetH = sheetDims.height - margin * 2;

    for (let i = 0; i < rawPageCount; i++) {
      const page = finalDoc.addPage([sheetDims.width, sheetDims.height]);
      const [embedded] = await finalDoc.embedPdf(srcDoc, [i]);

      const scale = Math.min(targetW / embedded.width, targetH / embedded.height);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;

      const x = (sheetDims.width - drawW) / 2;
      const y = (sheetDims.height - drawH) / 2;

      page.drawPage(embedded, {
        x,
        y,
        width: drawW,
        height: drawH
      });
    }
  } else {
    // ────────────────────────────────────────────────────────────
    // 3. Direct Slides or Notes layout
    // ────────────────────────────────────────────────────────────
    finalDoc = srcDoc;
  }

  // ────────────────────────────────────────────────────────────
  // 4. Metadata Setting
  // ────────────────────────────────────────────────────────────
  const title = opts.deckTitle || opts.originalName.replace(/\.[^/.]+$/, '');
  finalDoc.setTitle(title);
  finalDoc.setProducer('PDFTailor (https://pdfflow.app)');
  finalDoc.setCreator('PDFTailor PowerPoint to PDF Converter');

  // ────────────────────────────────────────────────────────────
  // 5. Page Limit Guard
  // ────────────────────────────────────────────────────────────
  let finalPageCount = finalDoc.getPageCount();
  if (finalPageCount > maxPages) {
    // Remove pages beyond limit
    const pagesToRemove = finalPageCount - maxPages;
    for (let r = 0; r < pagesToRemove; r++) {
      finalDoc.removePage(finalDoc.getPageCount() - 1);
    }
    finalPageCount = maxPages;
    warnings.push(`Only the first ${maxPages} pages were converted.`);
  }

  const finalPdfBytes = await finalDoc.save();
  return {
    pdfBuffer: Buffer.from(finalPdfBytes),
    pageCount: finalPageCount,
    warnings
  };
}
