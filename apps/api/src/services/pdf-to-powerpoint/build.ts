import PptxGenJS from 'pptxgenjs';
import { PdfLayoutModel, LayoutPage } from '../pdf-layout';
import { OcrPageResult } from '../ocr';
import { PdfToPowerPointSlideSize, PdfToPowerPointMode } from '@paperflow/contracts';

export const BASELINE_RATIO = 0.8;
export const MIN_SLIDE_INCH = 1.0;
export const MAX_SLIDE_INCH = 56.0;
export const WIDESCREEN_WIDTH_INCH = 13.333333;
export const WIDESCREEN_HEIGHT_INCH = 7.5;

export interface BuildPptxOptions {
  slideSize?: PdfToPowerPointSlideSize;
  mode?: PdfToPowerPointMode;
  originalFilename?: string;
  ocrPages?: OcrPageResult[];
}

export interface BuildPptxResult {
  pptxBuffer: Buffer;
  slideCount: number;
  warnings: string[];
}

const STANDARD_OFFICE_FONTS = new Set([
  'Arial',
  'Calibri',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Garamond',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Cambria',
  'Segoe UI',
  'Arial Narrow'
]);

function cleanHex(color: string | undefined): string {
  if (!color) return '000000';
  const c = String(color).replace(/^#/, '').trim();
  if (c.length === 3) {
    return `${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toUpperCase();
  }
  if (c.length === 6) return c.toUpperCase();
  return '000000';
}

function resolveFont(fontName: string | undefined, generic?: string, fallbackFont = 'Calibri'): { fontFace: string; isStandard: boolean } {
  const lower = String(fontName || '').toLowerCase();
  if (/league\s*gothic/i.test(lower)) return { fontFace: 'Arial Narrow', isStandard: true };
  if (/montserrat/i.test(lower)) return { fontFace: 'Segoe UI', isStandard: true };
  if (/inter/i.test(lower)) return { fontFace: 'Calibri', isStandard: true };
  if (/roboto/i.test(lower)) return { fontFace: 'Segoe UI', isStandard: true };
  if (/open\s*sans/i.test(lower)) return { fontFace: 'Segoe UI', isStandard: true };
  if (/lato/i.test(lower)) return { fontFace: 'Calibri', isStandard: true };
  if (/poppins/i.test(lower)) return { fontFace: 'Segoe UI', isStandard: true };
  if (/arial|helvetica/i.test(lower)) return { fontFace: 'Arial', isStandard: true };
  if (/times|libertine|roman/i.test(lower)) return { fontFace: 'Times New Roman', isStandard: true };
  if (/courier|consolas|source\s*code|monaco/i.test(lower)) return { fontFace: 'Courier New', isStandard: true };
  if (/georgia/i.test(lower)) return { fontFace: 'Georgia', isStandard: true };
  if (/garamond/i.test(lower)) return { fontFace: 'Garamond', isStandard: true };
  if (/verdana/i.test(lower)) return { fontFace: 'Verdana', isStandard: true };
  if (/tahoma/i.test(lower)) return { fontFace: 'Tahoma', isStandard: true };
  if (/trebuchet/i.test(lower)) return { fontFace: 'Trebuchet MS', isStandard: true };
  if (/cambria/i.test(lower)) return { fontFace: 'Cambria', isStandard: true };
  if (/calibri/i.test(lower)) return { fontFace: 'Calibri', isStandard: true };

  if (generic === 'sans-serif') return { fontFace: 'Calibri', isStandard: true };
  if (generic === 'serif') return { fontFace: 'Times New Roman', isStandard: true };
  if (generic === 'monospace') return { fontFace: 'Courier New', isStandard: true };

  const face = fontName || fallbackFont;
  return { fontFace: face, isStandard: STANDARD_OFFICE_FONTS.has(face) };
}

/**
 * Builds a PowerPoint (.pptx) buffer from either the layout model (No OCR)
 * or OCR pages (OCR mode).
 */
export async function buildPptx(
  model: PdfLayoutModel,
  opts: BuildPptxOptions = {}
): Promise<BuildPptxResult> {
  const pptx = new PptxGenJS();
  const slideSize = opts.slideSize || 'match_pdf';
  const mode = opts.mode || 'no_ocr';
  const warnings: string[] = [];
  if (model.warnings && model.warnings.length > 0) {
    warnings.push(...model.warnings);
  }

  const nonStandardFonts = new Set<string>();

  // Determine primary presentation layout dimensions
  const primaryPage = model.pages[0] || { width: 612, height: 792 };
  const primaryW_in = primaryPage.width / 72;
  const primaryH_in = primaryPage.height / 72;

  let presWidth_in = primaryW_in;
  let presHeight_in = primaryH_in;

  if (slideSize === 'widescreen_16_9') {
    presWidth_in = WIDESCREEN_WIDTH_INCH;
    presHeight_in = WIDESCREEN_HEIGHT_INCH;
    pptx.defineLayout({
      name: 'WIDESCREEN_16_9',
      width: WIDESCREEN_WIDTH_INCH,
      height: WIDESCREEN_HEIGHT_INCH
    });
    pptx.layout = 'WIDESCREEN_16_9';
  } else {
    // Clamping to PowerPoint limits [1.0, 56.0] inches
    let initialScale = 1.0;
    if (primaryW_in > MAX_SLIDE_INCH || primaryH_in > MAX_SLIDE_INCH) {
      initialScale = Math.min(MAX_SLIDE_INCH / primaryW_in, MAX_SLIDE_INCH / primaryH_in);
      warnings.push(`Page 1 dimensions exceed PowerPoint maximum (56 in). Scaled uniformly to fit.`);
    } else if (primaryW_in < MIN_SLIDE_INCH || primaryH_in < MIN_SLIDE_INCH) {
      initialScale = Math.max(MIN_SLIDE_INCH / primaryW_in, MIN_SLIDE_INCH / primaryH_in);
      warnings.push(`Page 1 dimensions are below PowerPoint minimum (1 in). Scaled uniformly to fit.`);
    }
    presWidth_in = primaryW_in * initialScale;
    presHeight_in = primaryH_in * initialScale;

    pptx.defineLayout({
      name: 'CUSTOM_PDF',
      width: presWidth_in,
      height: presHeight_in
    });
    pptx.layout = 'CUSTOM_PDF';
  }

  // Set Presentation Metadata
  pptx.title = model.title || opts.originalFilename?.replace(/\.[^/.]+$/, '') || 'Presentation';
  pptx.author = '';
  pptx.company = '';

  const totalPages = mode === 'ocr' && opts.ocrPages && opts.ocrPages.length > 0
    ? opts.ocrPages.length
    : model.pages.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const slide = pptx.addSlide();

    // -------------------------------------------------------------------------
    // OCR MODE: Render high-fidelity background image + overlaid text boxes
    // -------------------------------------------------------------------------
    if (mode === 'ocr' && opts.ocrPages && opts.ocrPages[pageIdx]) {
      const ocrPage = opts.ocrPages[pageIdx];
      const pageW_in = ocrPage.widthPt / 72;
      const pageH_in = ocrPage.heightPt / 72;

      let scale = 1.0;
      let offsetX_in = 0;
      let offsetY_in = 0;

      if (slideSize === 'widescreen_16_9') {
        scale = Math.min(WIDESCREEN_WIDTH_INCH / pageW_in, WIDESCREEN_HEIGHT_INCH / pageH_in);
        const scaledW = pageW_in * scale;
        const scaledH = pageH_in * scale;
        offsetX_in = (WIDESCREEN_WIDTH_INCH - scaledW) / 2;
        offsetY_in = (WIDESCREEN_HEIGHT_INCH - scaledH) / 2;
      } else {
        scale = Math.min(presWidth_in / pageW_in, presHeight_in / pageH_in);
        const scaledW = pageW_in * scale;
        const scaledH = pageH_in * scale;
        offsetX_in = (presWidth_in - scaledW) / 2;
        offsetY_in = (presHeight_in - scaledH) / 2;
      }

      // Add full-slide background image for visual fidelity
      const bgBase64 = `image/png;base64,${ocrPage.pngBuffer.toString('base64')}`;
      slide.addImage({
        data: bgBase64,
        x: offsetX_in,
        y: offsetY_in,
        w: pageW_in * scale,
        h: pageH_in * scale,
        altText: `Scanned background for page ${pageIdx + 1}`
      });

      // Overlay editable text boxes from OCR lines
      for (const line of ocrPage.lines) {
        const x_in = offsetX_in + (line.xPt / 72) * scale;
        const y_in = offsetY_in + (line.yPt / 72) * scale;
        const w_in = (line.wPt / 72) * scale;
        const h_in = (line.hPt / 72) * scale;
        const fontSize = Math.max(1, Math.round((line.fontSizePt * scale) * 2) / 2);

        slide.addText(
          [
            {
              text: line.text,
              options: {
                fontFace: 'Calibri',
                fontSize,
                color: '000000'
              }
            }
          ],
          {
            x: x_in,
            y: y_in,
            w: Math.max(0.1, w_in),
            h: Math.max(0.1, h_in),
            margin: 0,
            valign: 'top',
            fit: 'none',
            wrap: false,
            align: 'left',
            paraSpaceBefore: 0,
            paraSpaceAfter: 0
          }
        );
      }
      continue;
    }

    // -------------------------------------------------------------------------
    // NO OCR MODE: Structured layout conversion (boxes -> lines -> images -> text)
    // -------------------------------------------------------------------------
    const page = model.pages[pageIdx];
    const pageW_in = page.width / 72;
    const pageH_in = page.height / 72;

    let scale = 1.0;
    let offsetX_in = 0;
    let offsetY_in = 0;

    if (slideSize === 'widescreen_16_9') {
      scale = Math.min(WIDESCREEN_WIDTH_INCH / pageW_in, WIDESCREEN_HEIGHT_INCH / pageH_in);
      const scaledW = pageW_in * scale;
      const scaledH = pageH_in * scale;
      offsetX_in = (WIDESCREEN_WIDTH_INCH - scaledW) / 2;
      offsetY_in = (WIDESCREEN_HEIGHT_INCH - scaledH) / 2;
    } else {
      // If page dimensions differ from primary slide layout
      scale = Math.min(presWidth_in / pageW_in, presHeight_in / pageH_in);
      const scaledW = pageW_in * scale;
      const scaledH = pageH_in * scale;
      offsetX_in = (presWidth_in - scaledW) / 2;
      offsetY_in = (presHeight_in - scaledH) / 2;
      if (Math.abs(pageW_in - presWidth_in) > 0.1 || Math.abs(pageH_in - presHeight_in) > 0.1) {
        warnings.push(`Page ${pageIdx + 1} dimensions differ from slide 1. Scaled uniformly to fit slide layout.`);
      }
    }

    // 1. Boxes (shaded rectangles and stroked outlines)
    for (const box of page.boxes || []) {
      const boxX_in = offsetX_in + (box.x / 72) * scale;
      const boxY_in = offsetY_in + (box.y / 72) * scale;
      const boxW_in = (box.w / 72) * scale;
      const boxH_in = (box.h / 72) * scale;

      const shapeOpts: PptxGenJS.ShapeProps = {
        x: boxX_in,
        y: boxY_in,
        w: Math.max(0.005, boxW_in),
        h: Math.max(0.005, boxH_in)
      };

      if (box.fill) {
        shapeOpts.fill = { color: cleanHex(box.fill) };
      } else {
        shapeOpts.fill = { type: 'none' };
      }

      if (box.stroke) {
        shapeOpts.line = {
          color: cleanHex(box.stroke),
          width: Math.max(0.5, (box.lw || 1) * scale)
        };
      } else {
        shapeOpts.line = { type: 'none' };
      }

      slide.addShape(pptx.ShapeType.rect, shapeOpts);
    }

    // 2. Lines (solid rules, dotted and dashed borders)
    for (const line of page.lines || []) {
      const isDotted = line.style === 'dotted';
      const isDashed = line.style === 'dashed';
      const dashType = isDotted ? 'sysDot' : (isDashed ? 'dash' : 'solid');
      const lineThicknessPt = Math.max(0.5, (line.thickness || 1) * scale);

      if (line.vertical) {
        slide.addShape(pptx.ShapeType.line, {
          x: offsetX_in + (line.x / 72) * scale,
          y: offsetY_in + (line.y / 72) * scale,
          w: 0,
          h: (line.h / 72) * scale,
          line: {
            color: cleanHex(line.color),
            width: lineThicknessPt,
            dashType
          }
        });
      } else {
        slide.addShape(pptx.ShapeType.line, {
          x: offsetX_in + (line.x / 72) * scale,
          y: offsetY_in + (line.y / 72) * scale,
          w: (line.w / 72) * scale,
          h: 0,
          line: {
            color: cleanHex(line.color),
            width: lineThicknessPt,
            dashType
          }
        });
      }
    }

    // 3. Images
    for (const img of page.images || []) {
      const imgX_in = offsetX_in + (img.x / 72) * scale;
      const imgY_in = offsetY_in + (img.y / 72) * scale;
      const imgW_in = (img.w / 72) * scale;
      const imgH_in = (img.h / 72) * scale;

      const base64Data = `image/png;base64,${img.png.toString('base64')}`;
      slide.addImage({
        data: base64Data,
        x: imgX_in,
        y: imgY_in,
        w: Math.max(0.01, imgW_in),
        h: Math.max(0.01, imgH_in),
        altText: `Image from page ${pageIdx + 1}`
      });
    }

    // 4. Text Blocks
    for (const block of page.blocks || []) {
      const isRightAligned = block.align === 'right';
      const isMultiLine = block.lines.length > 1;

      const lineHeightPt = (isMultiLine && block.pitch > 0) ? block.pitch : (block.fs * 1.25);
      const topPt = Math.max(0, block.y - (lineHeightPt * BASELINE_RATIO));
      const heightPt = isMultiLine
        ? (lineHeightPt * (block.lines.length - 1) + block.fs * 1.5)
        : Math.max(16, block.fs * 1.5);

      let xPt: number;
      let widthPt: number;

      if (isRightAligned) {
        const textWidth = block.width || 50;
        widthPt = Math.max(30, textWidth * 1.35 + 20);
        xPt = Math.max(0, (block.right || (block.x + block.width)) - widthPt);
      } else {
        xPt = block.x;
        // Make box wide towards the right edge so font substitutions never wrap or clip
        const rightEdgePt = page.width - 10;
        widthPt = Math.max(20, rightEdgePt - xPt);
      }

      const x_in = offsetX_in + (xPt / 72) * scale;
      const y_in = offsetY_in + (topPt / 72) * scale;
      const w_in = (widthPt / 72) * scale;
      const h_in = (heightPt / 72) * scale;

      const runs: PptxGenJS.TextProps[] = [];
      for (let lIdx = 0; lIdx < block.lines.length; lIdx++) {
        const line = block.lines[lIdx];
        for (let rIdx = 0; rIdx < line.length; rIdx++) {
          const run = line[rIdx];
          const { fontFace, isStandard } = resolveFont(run.font, run.generic);
          if (!isStandard && run.font) {
            nonStandardFonts.add(run.font);
          }

          const effectiveFs = Math.max(1, Math.round(((run.fs || block.fs) * scale) * 2) / 2);

          let textContent = run.text;
          if (lIdx > 0 && rIdx === 0 && !textContent.startsWith(' ')) {
            const prevLine = block.lines[lIdx - 1];
            const lastRun = prevLine[prevLine.length - 1];
            if (lastRun && !lastRun.text.endsWith(' ') && !lastRun.text.endsWith('-')) {
              textContent = ' ' + textContent;
            }
          }

          runs.push({
            text: textContent,
            options: {
              fontFace,
              fontSize: effectiveFs,
              bold: Boolean(run.bold),
              italic: Boolean(run.italic),
              color: cleanHex(run.color),
              breakLine: (lIdx > 0 && rIdx === 0)
            }
          });
        }
      }

      const lineSpacing = (isMultiLine && block.pitch > 0)
        ? Math.max(1, Math.round((block.pitch * scale) * 2) / 2)
        : undefined;

      slide.addText(runs, {
        x: x_in,
        y: y_in,
        w: Math.max(0.05, w_in),
        h: Math.max(0.05, h_in),
        margin: 0,
        valign: 'top',
        fit: 'none',
        wrap: false,
        align: isRightAligned ? 'right' : 'left',
        lineSpacing,
        paraSpaceBefore: 0,
        paraSpaceAfter: 0
      });
    }
  }

  // Add warning about non-embeddable fonts if any detected
  if (nonStandardFonts.size > 0) {
    warnings.push(
      `Document uses fonts that cannot be embedded in PowerPoint: ${Array.from(nonStandardFonts).join(', ')}. Microsoft PowerPoint will substitute them with installed system fonts.`
    );
  }

  const pptxBuffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;

  return {
    pptxBuffer,
    slideCount: totalPages,
    warnings
  };
}
