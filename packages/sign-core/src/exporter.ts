import 'regenerator-runtime/runtime';
import {
  Color,
  PDFDocument,
  PDFImage,
  PDFName,
  PDFNumber,
  PDFPage,
  PDFFont,
  StandardFonts,
  degrees,
  rgb
} from 'pdf-lib';
import * as fontkitModule from '@pdf-lib/fontkit';
import {
  PdfPageBoxMetrics,
  SIGN_FALLBACK_FONT_FILES,
  SIGN_SCRIPT_FONTS,
  SignFieldElement,
  normalizePageRotation,
  pdfRectToScreenRectCoords,
  screenPointToPdfPointCoords
} from '@paperflow/contracts';

const fontkit = (fontkitModule as any).default || fontkitModule;

export interface SignExportOptions {
  /** Resolves font bytes by fontId or woff filename (e.g. 'kalam' or 'noto-sans-latin-400-normal.woff'). */
  fontResolver?: (fontKey: string) => Promise<Uint8Array | null>;
  /** Optional PNG downscaler (e.g. canvas 3x @ 300 DPI cap) preserving alpha transparency. */
  downscalePng?: (pngBytes: Uint8Array, maxWidthPx: number, maxHeightPx: number) => Promise<Uint8Array>;
  /** Optional fallback rasterizer if a glyph cannot be encoded in any bundled font. */
  rasterizeTextFallback?: (text: string, sizePt: number, colorCss: string) => Promise<Uint8Array | null>;
  flattenFormFields?: boolean;
  appName?: string;
  documentTitle?: string;
}

export interface SignExportResult {
  pdfBytes: Uint8Array;
  warnings: string[];
  fieldsApplied: number;
  pagesSigned: number[];
}

const TOKEN_COLOR_MAP: Record<string, string> = {
  'var(--pt-navy)': '#14213D',
  'var(--pt-navy-deep)': '#0D1629',
  'var(--pt-teal-700)': '#0F766E',
  'var(--pt-teal-800)': '#0B5D57',
  'var(--pt-coral)': '#E05D44'
};

export function parseSignColorToHex(input?: string): string {
  if (!input) return '#14213D';
  const trimmed = input.trim();
  if (TOKEN_COLOR_MAP[trimmed]) return TOKEN_COLOR_MAP[trimmed];
  return trimmed;
}

export function hexToRgbColor(input?: string): Color {
  const clean = parseSignColorToHex(input).replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return rgb(r, g, b);
    }
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return rgb(r, g, b);
    }
  }
  return rgb(0.078, 0.129, 0.239); // #14213D
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const NodeBuffer = (globalThis as Record<string, unknown>)['Buffer'] as
    | { from(s: string, enc: string): Uint8Array }
    | undefined;
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (NodeBuffer) {
    return new Uint8Array(NodeBuffer.from(b64, 'base64'));
  }
  throw new Error('Base64 decoder unavailable in runtime.');
}

export function extractPageBoxMetrics(page: PDFPage, pageIndex: number): PdfPageBoxMetrics {
  const crop = page.getCropBox();
  const rot = normalizePageRotation(page.getRotation().angle || 0);
  const rawUserUnit = page.node.get(PDFName.of('UserUnit'));
  const userUnit = rawUserUnit instanceof PDFNumber ? Math.max(0.1, rawUserUnit.asNumber()) : 1.0;
  return {
    pageIndex,
    widthPt: crop.width,
    heightPt: crop.height,
    rotation: rot,
    cropBoxXPt: crop.x,
    cropBoxYPt: crop.y,
    userUnit
  };
}

/**
 * Computes draw anchor (x, y) and rotation in PDF MediaBox coordinates so a visual box
 * of size (visualWidthUserUnits x visualHeightUserUnits) renders identically at the
 * editor's visual bottom-left corner regardless of page /Rotate (0/90/180/270) or field rotation.
 */
function computeMediaDrawPlacement(
  visualX: number,
  visualY: number,
  visualW: number,
  visualH: number,
  pageMeta: PdfPageBoxMetrics,
  fieldRotDeg = 0
): { x: number; y: number; rotateDeg: number } {
  const unit = Math.max(0.1, pageMeta.userUnit ?? 1.0);
  // screenPointToPdfPointCoords converts zoom=1 visual px to unrotated MediaBox user units when dividing by userUnit
  const centerScreenX = visualX + visualW / 2;
  const centerScreenY = visualY + visualH / 2;
  const centerPdf = screenPointToPdfPointCoords(
    { x: centerScreenX * unit, y: centerScreenY * unit },
    pageMeta,
    1.0,
    1.0
  );

  const pageRot = normalizePageRotation(pageMeta.rotation);
  const effectiveAngleDeg = pageRot - fieldRotDeg;
  const rad = (effectiveAngleDeg * Math.PI) / 180;
  const dx = -(visualW / 2);
  const dy = -(visualH / 2);
  const anchorX = centerPdf.xPt + dx * Math.cos(rad) - dy * Math.sin(rad);
  const anchorY = centerPdf.yPt + dx * Math.sin(rad) + dy * Math.cos(rad);
  return { x: anchorX, y: anchorY, rotateDeg: effectiveAngleDeg };
}

/**
 * Pure cross-platform exporter (browser + Node) built on pdf-lib + @pdf-lib/fontkit.
 * Guarantees 1 pt positional accuracy across Rotate (0/90/180/270), CropBox offsets, UserUnit,
 * transparent PNG images, Unicode subset font embedding, and z-order preservation.
 */
export async function exportSignedPdf(
  originalPdfBytes: Uint8Array,
  fields: SignFieldElement[],
  options: SignExportOptions = {}
): Promise<SignExportResult> {
  const warnings: string[] = [];
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  pdfDoc.registerFontkit(fontkit);

  const appName = options.appName || 'PDFTailor';
  const existingTitle = pdfDoc.getTitle();
  if (!existingTitle && options.documentTitle) {
    pdfDoc.setTitle(options.documentTitle);
  }
  pdfDoc.setProducer(`${appName} Sign Engine`);
  if (!pdfDoc.getCreator()) {
    pdfDoc.setCreator(appName);
  }

  if (options.flattenFormFields) {
    try {
      const form = pdfDoc.getForm();
      if (form.getFields().length > 0) {
        form.flatten();
      }
    } catch {
      warnings.push('Could not flatten one or more interactive form fields; original fields were left intact.');
    }
  }

  const fontCache = new Map<string, PDFFont>();
  const stdHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const imageCache = new Map<string, PDFImage>();

  const loadFont = async (fontKey: string): Promise<PDFFont | null> => {
    if (fontCache.has(fontKey)) return fontCache.get(fontKey)!;
    if (!options.fontResolver) return null;
    try {
      const bytes = await options.fontResolver(fontKey);
      if (!bytes || bytes.length === 0) return null;
      const embedded = await pdfDoc.embedFont(bytes, { subset: true });
      fontCache.set(fontKey, embedded);
      return embedded;
    } catch {
      return null;
    }
  };

  const pickBestFont = async (text: string, preferredFontId?: string): Promise<{ font: PDFFont; usedFallback: boolean }> => {
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasNonAscii = /[^\x20-\x7E\xA0-\xFF]/.test(text);

    const candidates: string[] = [];
    if (hasDevanagari) {
      if (preferredFontId === 'kalam') {
        candidates.push(SIGN_FALLBACK_FONT_FILES.kalamDevanagari);
      }
      candidates.push(SIGN_FALLBACK_FONT_FILES.notoDevanagari);
    }
    if (hasArabic) {
      candidates.push(SIGN_FALLBACK_FONT_FILES.notoArabic);
    }
    if (hasCyrillic) {
      candidates.push(SIGN_FALLBACK_FONT_FILES.notoCyrillic);
    }
    if (preferredFontId) {
      const desc = SIGN_SCRIPT_FONTS.find(f => f.id === preferredFontId);
      if (desc) candidates.push(desc.woffFile);
      else candidates.push(preferredFontId);
    }
    candidates.push(SIGN_FALLBACK_FONT_FILES.notoLatin);
    if (hasNonAscii) {
      candidates.push(SIGN_FALLBACK_FONT_FILES.notoLatinExt);
    }

    for (let i = 0; i < candidates.length; i++) {
      const font = await loadFont(candidates[i]);
      if (!font) continue;
      try {
        font.encodeText(text);
        const preferredMatches =
          !preferredFontId ||
          candidates[i] === SIGN_SCRIPT_FONTS.find(f => f.id === preferredFontId)?.woffFile ||
          (hasDevanagari && preferredFontId === 'kalam' && candidates[i] === SIGN_FALLBACK_FONT_FILES.kalamDevanagari);
        return { font, usedFallback: !preferredMatches };
      } catch {
        // Try next candidate
      }
    }
    return { font: stdHelvetica, usedFallback: true };
  };

  const pages = pdfDoc.getPages();
  const sortedFields = [...fields].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const pagesSignedSet = new Set<number>();
  let fieldsApplied = 0;
  let warnedMissingGlyphs = false;

  for (const field of sortedFields) {
    if (field.pageIndex < 0 || field.pageIndex >= pages.length) continue;
    const page = pages[field.pageIndex];
    const pageMeta = extractPageBoxMetrics(page, field.pageIndex);
    const unit = Math.max(0.1, pageMeta.userUnit ?? 1.0);

    // Visual screen rect in 100% CSS points (1pt == 1px*userUnit)
    const visualRectScaled = pdfRectToScreenRectCoords(
      { xPt: field.xPt, yPt: field.yPt, widthPt: field.widthPt, heightPt: field.heightPt },
      pageMeta,
      1.0,
      1.0
    );
    const visualX = visualRectScaled.x / unit;
    const visualY = visualRectScaled.y / unit;
    const visualW = visualRectScaled.width / unit;
    const visualH = visualRectScaled.height / unit;
    const fieldRot = field.rotation ?? 0;

    if ((field.type === 'signature' || field.type === 'initials' || field.type === 'stamp') && field.imageDataUrl) {
      let bytes = dataUrlToBytes(field.imageDataUrl);
      // Downscale oversize images to <= 3x displayed size @ 300 DPI (300/72 = 4.167 px/pt)
      const maxPxW = Math.max(16, Math.round(visualW * (300 / 72) * 3));
      const maxPxH = Math.max(16, Math.round(visualH * (300 / 72) * 3));
      const cacheKey = `${field.imageDataUrl.slice(0, 64)}:${field.imageDataUrl.length}:${maxPxW}x${maxPxH}`;

      let embedded = imageCache.get(cacheKey);
      if (!embedded) {
        if (options.downscalePng) {
          bytes = await options.downscalePng(bytes, maxPxW, maxPxH);
        }
        embedded = await pdfDoc.embedPng(bytes);
        imageCache.set(cacheKey, embedded);
      }

      const imgAspect = embedded.width && embedded.height ? embedded.width / embedded.height : 1;
      const boxAspect = visualW > 0 && visualH > 0 ? visualW / visualH : 1;
      let drawW = visualW;
      let drawH = visualH;
      let offsetX = 0;
      let offsetY = 0;
      if (boxAspect > imgAspect) {
        drawW = visualH * imgAspect;
        offsetX = (visualW - drawW) / 2;
      } else {
        drawH = visualW / imgAspect;
        offsetY = (visualH - drawH) / 2;
      }

      const placement = computeMediaDrawPlacement(
        visualX + offsetX,
        visualY + offsetY,
        drawW,
        drawH,
        pageMeta,
        fieldRot
      );
      page.drawImage(embedded, {
        x: placement.x,
        y: placement.y,
        width: drawW,
        height: drawH,
        rotate: placement.rotateDeg ? degrees(placement.rotateDeg) : undefined
      });

      if (field.type === 'signature' && field.showSigningDetailsLine && field.signingDetailsText) {
        const captionSize = Math.max(7, Math.min(9.5, visualH * 0.16)) / unit;
        const { font } = await pickBestFont(field.signingDetailsText, 'noto-sans');
        const capPlacement = computeMediaDrawPlacement(
          visualX,
          visualY + visualH + 3 / unit,
          visualW,
          captionSize * 1.4,
          pageMeta,
          fieldRot
        );
        try {
          page.drawText(field.signingDetailsText, {
            x: capPlacement.x,
            y: capPlacement.y + captionSize * 0.25,
            size: captionSize,
            font,
            color: rgb(0.35, 0.4, 0.48),
            rotate: capPlacement.rotateDeg ? degrees(capPlacement.rotateDeg) : undefined
          });
        } catch {
          // Ignore caption glyph issues
        }
      }

      pagesSignedSet.add(field.pageIndex);
      fieldsApplied++;
      continue;
    }

    if (field.type === 'checkbox') {
      const checked = field.checked !== false;
      const color = hexToRgbColor(field.color || '#0F766E');
      const placement = computeMediaDrawPlacement(visualX, visualY, visualW, visualH, pageMeta, fieldRot);
      // Draw crisp border square + vector checkmark when checked
      page.drawRectangle({
        x: placement.x,
        y: placement.y,
        width: visualW,
        height: visualH,
        borderColor: color,
        borderWidth: Math.max(1, Math.min(2, visualW * 0.08)),
        color: checked ? rgb(0.902, 0.961, 0.953) : undefined,
        rotate: placement.rotateDeg ? degrees(placement.rotateDeg) : undefined
      });
      if (checked) {
        const p1 = computeMediaDrawPlacement(visualX + visualW * 0.2, visualY + visualH * 0.52, 1, 1, pageMeta, fieldRot);
        const p2 = computeMediaDrawPlacement(visualX + visualW * 0.44, visualY + visualH * 0.76, 1, 1, pageMeta, fieldRot);
        const p3 = computeMediaDrawPlacement(visualX + visualW * 0.82, visualY + visualH * 0.26, 1, 1, pageMeta, fieldRot);
        const thickness = Math.max(1.5, Math.min(3.5, visualW * 0.14));
        page.drawLine({ start: { x: p1.x, y: p1.y }, end: { x: p2.x, y: p2.y }, thickness, color });
        page.drawLine({ start: { x: p2.x, y: p2.y }, end: { x: p3.x, y: p3.y }, thickness, color });
      }
      pagesSignedSet.add(field.pageIndex);
      fieldsApplied++;
      continue;
    }

    // Text-based fields: name, date, text, or text fallback for signature/initials
    const content = (field.text || '').trim();
    if (!content) continue;
    const fontSizePt = (field.fontSizePt ?? Math.max(10, Math.min(28, visualH * 0.6))) / unit;
    const color = hexToRgbColor(field.color || '#14213D');
    const lines = content.split(/\r?\n/);

    const { font, usedFallback } = await pickBestFont(content, field.fontId || (field.type === 'signature' || field.type === 'initials' ? 'caveat' : undefined));
    if (usedFallback && field.fontId && !warnedMissingGlyphs) {
      warnings.push('Some text characters were rendered using a bundled Noto Unicode fallback font because the selected script font did not include those glyphs.');
      warnedMissingGlyphs = true;
    }

    let drewText = false;
    try {
      font.encodeText(content);
      const lineHeight = fontSizePt * 1.25;
      for (let li = 0; li < lines.length; li++) {
        const lineText = lines[li];
        if (!lineText) continue;
        const lineVisualY = visualY + fontSizePt * 0.15 + li * lineHeight;
        const linePlacement = computeMediaDrawPlacement(
          visualX + 2 / unit,
          lineVisualY,
          visualW,
          fontSizePt * 1.15,
          pageMeta,
          fieldRot
        );
        page.drawText(lineText, {
          x: linePlacement.x,
          y: linePlacement.y + fontSizePt * 0.2,
          size: fontSizePt,
          font,
          color,
          rotate: linePlacement.rotateDeg ? degrees(linePlacement.rotateDeg) : undefined
        });
      }
      drewText = true;
    } catch {
      // Fallback for characters (e.g. color emoji) unsupported even by Noto
      if (options.rasterizeTextFallback) {
        const pngBytes = await options.rasterizeTextFallback(content, fontSizePt * unit, parseSignColorToHex(field.color));
        if (pngBytes) {
          const embedded = await pdfDoc.embedPng(pngBytes);
          const placement = computeMediaDrawPlacement(visualX, visualY, visualW, visualH, pageMeta, fieldRot);
          page.drawImage(embedded, {
            x: placement.x,
            y: placement.y,
            width: visualW,
            height: visualH,
            rotate: placement.rotateDeg ? degrees(placement.rotateDeg) : undefined
          });
          drewText = true;
          warnings.push(`Unsupported PDF font glyphs in "${content.slice(0, 20)}" were rasterized cleanly as an embedded PNG.`);
        }
      }
      if (!drewText) {
        const sanitized = content.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
        const linePlacement = computeMediaDrawPlacement(visualX + 2 / unit, visualY + fontSizePt * 0.15, visualW, fontSizePt * 1.15, pageMeta, fieldRot);
        page.drawText(sanitized, {
          x: linePlacement.x,
          y: linePlacement.y + fontSizePt * 0.2,
          size: fontSizePt,
          font: stdHelvetica,
          color,
          rotate: linePlacement.rotateDeg ? degrees(linePlacement.rotateDeg) : undefined
        });
        warnings.push(`Some non-Latin characters in "${content.slice(0, 20)}" could not be embedded and were replaced with '?'.`);
      }
    }

    if (field.type === 'signature' && field.showSigningDetailsLine && field.signingDetailsText) {
      const capSize = 8 / unit;
      const capFont = await loadFont(SIGN_FALLBACK_FONT_FILES.notoLatin) || stdHelvetica;
      const capPlace = computeMediaDrawPlacement(visualX, visualY + visualH + 3 / unit, visualW, capSize * 1.4, pageMeta, fieldRot);
      try {
        page.drawText(field.signingDetailsText, {
          x: capPlace.x,
          y: capPlace.y + capSize * 0.2,
          size: capSize,
          font: capFont,
          color: rgb(0.35, 0.4, 0.48),
          rotate: capPlace.rotateDeg ? degrees(capPlace.rotateDeg) : undefined
        });
      } catch {}
    }

    pagesSignedSet.add(field.pageIndex);
    fieldsApplied++;
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    pdfBytes,
    warnings,
    fieldsApplied,
    pagesSigned: Array.from(pagesSignedSet).sort((a, b) => a - b)
  };
}
