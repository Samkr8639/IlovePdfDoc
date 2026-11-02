import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts, PDFPage, Color } from 'pdf-lib';
import {
  EditElement,
  PageDimensions,
  TextEditElement,
  ImageEditElement,
  DrawEditElement,
  ShapeEditElement,
  HighlightEditElement,
  WhiteoutEditElement,
  SignEditElement,
  OcrTextLayerElement
} from '../models/document-model';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  /**
   * Applies all editor elements onto the original PDF document and returns the resulting PDF Blob
   */
  async exportPdf(
    originalBytes: ArrayBuffer | Uint8Array,
    pageDimensions: PageDimensions[],
    elements: EditElement[]
  ): Promise<Blob> {
    const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    const pages = pdfDoc.getPages();

    // Group elements by page index
    const elementsByPage = new Map<number, EditElement[]>();
    for (const el of elements) {
      const list = elementsByPage.get(el.pageIndex) || [];
      list.push(el);
      elementsByPage.set(el.pageIndex, list);
    }

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageElements = elementsByPage.get(i) || [];

      // Sort elements by z-index or visual rendering order
      // Whiteouts and OCR layers first, then shapes, highlights, images, text, signatures
      for (const el of pageElements) {
        try {
          switch (el.type) {
            case 'whiteout':
              this.renderWhiteout(page, el as WhiteoutEditElement);
              break;
            case 'shape':
              this.renderShape(page, el as ShapeEditElement);
              break;
            case 'highlight':
              this.renderHighlight(page, el as HighlightEditElement);
              break;
            case 'image':
              await this.renderImage(pdfDoc, page, el as ImageEditElement);
              break;
            case 'sign':
              await this.renderSignature(pdfDoc, page, el as SignEditElement);
              break;
            case 'draw':
              this.renderDraw(page, el as DrawEditElement);
              break;
            case 'text': {
              const textEl = el as TextEditElement;
              // Skip unedited page text elements (they are already in the original PDF)
              if (textEl.isPageTextLine && !textEl.isEdited) {
                break;
              }
              // If user edited this page text block, whiteout the old text first
              if (textEl.isPageTextLine && textEl.isEdited) {
                page.drawRectangle({
                  x: Math.max(0, textEl.xPt - 2),
                  y: Math.max(0, textEl.yPt - 1),
                  width: textEl.widthPt + 4,
                  height: textEl.heightPt + 2,
                  color: rgb(1, 1, 1)
                });
              }
              this.renderText(
                page,
                textEl,
                fontRegular,
                fontBold,
                fontItalic,
                fontBoldItalic
              );
              break;
            }
            case 'ocr-layer':
              this.renderOcrTextLayer(page, el as OcrTextLayerElement, fontRegular);
              break;
          }
        } catch (elErr) {
          console.warn(`Error rendering element ${el.id} (${el.type}) on export:`, elErr);
        }
      }
    }

    const exportedBytes = await pdfDoc.save();
    return new Blob([exportedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  private static readonly COLOR_MAP: Record<string, string> = {
    'var(--pt-navy)': '#14213D',
    'var(--pt-navy-hover)': '#1D2E54',
    'var(--pt-navy-deep)': '#0D1629',
    'var(--pt-teal-700)': '#0F766E',
    'var(--pt-teal-800)': '#0B5D57',
    'var(--pt-teal-600)': '#14B8A6',
    'var(--pt-teal-100)': '#CCEBE6',
    'var(--pt-teal-50)': '#E6F5F3',
    'var(--pt-coral)': '#E05D44',
    'var(--pt-coral-hover)': '#C54E37',
    'var(--pt-coral-subtle)': '#FDF3F1',
    'var(--pt-amber)': '#D97706',
    'var(--pt-emerald)': '#059669',
    'var(--pt-surface-white)': '#FFFFFF',
    'var(--pt-canvas-pure)': '#FFFFFF',
    'var(--pt-subtle-bg)': '#F6F8FA',
    'var(--pt-text-headline)': '#111827',
    'var(--pt-text-body)': '#374151',
    'var(--pt-muted)': '#4B5563',
    'yellow': '#FFFF00',
    'black': '#000000',
    'white': '#FFFFFF',
    'red': '#FF0000',
    'blue': '#0000FF',
    'green': '#008000',
    'teal': '#0F766E',
    'coral': '#E05D44',
    'amber': '#D97706',
    'navy': '#14213D'
  };

  private resolveColorToCss(colorStr?: string): string {
    if (!colorStr) return '#000000';
    const trimmed = colorStr.trim();
    if (PdfExportService.COLOR_MAP[trimmed]) {
      return PdfExportService.COLOR_MAP[trimmed];
    }
    const lower = trimmed.toLowerCase();
    if (PdfExportService.COLOR_MAP[lower]) {
      return PdfExportService.COLOR_MAP[lower];
    }
    if (lower.startsWith('var(')) {
      for (const [key, val] of Object.entries(PdfExportService.COLOR_MAP)) {
        const varName = key.replace('var(', '').replace(')', '');
        if (lower.includes(varName)) {
          return val;
        }
      }
    }
    return trimmed;
  }

  private renderWhiteout(page: PDFPage, el: WhiteoutEditElement): void {
    const color = this.parseColor(el.fillColor || '#ffffff') || rgb(1, 1, 1);
    page.drawRectangle({
      x: el.xPt,
      y: el.yPt,
      width: el.widthPt,
      height: el.heightPt,
      color
    });
  }

  private renderShape(page: PDFPage, el: ShapeEditElement): void {
    const strokeColor = el.strokeColor ? (this.parseColor(el.strokeColor) || rgb(0, 0, 0)) : undefined;
    const fillColor = this.parseColor(el.fillColor);
    const borderWidth = el.strokeWidth || 1;

    if (el.shapeType === 'rectangle') {
      page.drawRectangle({
        x: el.xPt,
        y: el.yPt,
        width: el.widthPt,
        height: el.heightPt,
        borderColor: strokeColor,
        borderWidth,
        color: fillColor
      });
    } else if (el.shapeType === 'circle') {
      const radius = Math.min(el.widthPt, el.heightPt) / 2;
      page.drawCircle({
        x: el.xPt + radius,
        y: el.yPt + radius,
        size: radius,
        borderColor: strokeColor,
        borderWidth,
        color: fillColor
      });
    } else if (el.shapeType === 'line') {
      page.drawLine({
        start: { x: el.xPt, y: el.yPt },
        end: { x: el.xPt + el.widthPt, y: el.yPt + el.heightPt },
        color: strokeColor || rgb(0, 0, 0),
        thickness: borderWidth
      });
    } else if (el.shapeType === 'arrow') {
      const startX = el.xPt;
      const startY = el.yPt;
      const endX = el.xPt + el.widthPt;
      const endY = el.yPt + el.heightPt;
      const arrowColor = strokeColor || rgb(0, 0, 0);

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        color: arrowColor,
        thickness: borderWidth
      });

      const angle = Math.atan2(endY - startY, endX - startX);
      const headLen = Math.max(8, borderWidth * 3);
      page.drawLine({
        start: { x: endX, y: endY },
        end: {
          x: endX - headLen * Math.cos(angle - Math.PI / 6),
          y: endY - headLen * Math.sin(angle - Math.PI / 6)
        },
        color: arrowColor,
        thickness: borderWidth
      });
      page.drawLine({
        start: { x: endX, y: endY },
        end: {
          x: endX - headLen * Math.cos(angle + Math.PI / 6),
          y: endY - headLen * Math.sin(angle + Math.PI / 6)
        },
        color: arrowColor,
        thickness: borderWidth
      });
    } else if (el.shapeType === 'star') {
      page.drawRectangle({
        x: el.xPt,
        y: el.yPt,
        width: el.widthPt,
        height: el.heightPt,
        borderColor: strokeColor,
        borderWidth,
        color: fillColor
      });
    }
  }

  private renderHighlight(page: PDFPage, el: HighlightEditElement): void {
    const color = this.parseColor(el.color || '#D97706') || rgb(0.85, 0.47, 0.02);
    page.drawRectangle({
      x: el.xPt,
      y: el.yPt,
      width: el.widthPt,
      height: el.heightPt,
      color,
      opacity: el.opacity || 0.35
    });
  }

  private async renderImage(
    pdfDoc: PDFDocument,
    page: PDFPage,
    el: ImageEditElement
  ): Promise<void> {
    try {
      const imageBytes = this.base64ToBytes(el.dataUrl);
      const isPng = el.dataUrl.includes('image/png');
      const embedded = isPng
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);

      // Compute proportional display rectangle matching CSS object-fit: contain
      const imgAspect = (embedded.width && embedded.height) ? (embedded.width / embedded.height) : 1;
      const boxAspect = (el.widthPt > 0 && el.heightPt > 0) ? (el.widthPt / el.heightPt) : 1;
      let drawW = el.widthPt;
      let drawH = el.heightPt;
      let drawX = el.xPt;
      let drawY = el.yPt;

      if (boxAspect > imgAspect) {
        // Bounding box is wider than image: letterbox sides, center horizontally
        drawW = el.heightPt * imgAspect;
        drawX = el.xPt + (el.widthPt - drawW) / 2;
      } else {
        // Bounding box is taller than image: letterbox top/bottom, center vertically
        drawH = el.widthPt / imgAspect;
        drawY = el.yPt + (el.heightPt - drawH) / 2;
      }

      page.drawImage(embedded, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH
      });
    } catch {
      // Ignore corrupt images on export
    }
  }

  private async renderSignature(
    pdfDoc: PDFDocument,
    page: PDFPage,
    el: SignEditElement
  ): Promise<void> {
    try {
      if (el.dataUrl && el.dataUrl.startsWith('data:image/')) {
        const imageBytes = this.base64ToBytes(el.dataUrl);
        const embedded = await pdfDoc.embedPng(imageBytes);

        // Compute proportional display rectangle matching CSS object-fit: contain
        const imgAspect = (embedded.width && embedded.height) ? (embedded.width / embedded.height) : 1;
        const boxAspect = (el.widthPt > 0 && el.heightPt > 0) ? (el.widthPt / el.heightPt) : 1;
        let drawW = el.widthPt;
        let drawH = el.heightPt;
        let drawX = el.xPt;
        let drawY = el.yPt;

        if (boxAspect > imgAspect) {
          drawW = el.heightPt * imgAspect;
          drawX = el.xPt + (el.widthPt - drawW) / 2;
        } else {
          drawH = el.widthPt / imgAspect;
          drawY = el.yPt + (el.heightPt - drawH) / 2;
        }

        page.drawImage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });
      } else {
        // High-DPI offscreen canvas render for cursive / styled text signatures
        const textToRender = el.signatureText || el.dataUrl || 'Signature';
        const offscreen = document.createElement('canvas');
        const scale = 3;
        offscreen.width = Math.round(Math.max(60, el.widthPt) * scale);
        offscreen.height = Math.round(Math.max(25, el.heightPt) * scale);
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          const font = el.fontFamily || "'Dancing Script', 'Brush Script MT', cursive";
          const fontSize = el.fontSizePt || Math.round(el.heightPt * 0.65);
          ctx.font = `${fontSize}px ${font}`;
          ctx.fillStyle = this.resolveColorToCss(el.color || '#14213D');
          ctx.textBaseline = 'middle';
          ctx.fillText(textToRender, 6, el.heightPt / 2);

          const dataUrl = offscreen.toDataURL('image/png');
          const imageBytes = this.base64ToBytes(dataUrl);
          const embedded = await pdfDoc.embedPng(imageBytes);
          page.drawImage(embedded, {
            x: el.xPt,
            y: el.yPt,
            width: el.widthPt,
            height: el.heightPt
          });
        }
      }
    } catch {
      // Ignore corrupt signature data
    }
  }

  private renderDraw(page: PDFPage, el: DrawEditElement): void {
    if (!el.points || el.points.length < 2) return;
    const color = this.parseColor(el.strokeColor || '#000000') || rgb(0, 0, 0);
    const thickness = el.strokeWidth || 2;

    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      page.drawLine({
        start: { x: p1.xPt, y: p1.yPt },
        end: { x: p2.xPt, y: p2.yPt },
        color,
        thickness
      });
    }
  }

  private renderText(
    page: PDFPage,
    el: TextEditElement,
    regularFont: any,
    boldFont: any,
    italicFont: any,
    boldItalicFont: any
  ): void {
    let font = regularFont;
    if (el.bold && el.italic) {
      font = boldItalicFont;
    } else if (el.bold) {
      font = boldFont;
    } else if (el.italic) {
      font = italicFont;
    }

    const color = this.parseColor(el.color || '#14213D') || rgb(0.08, 0.13, 0.24);
    const size = el.fontSizePt || 14;
    const lineHeight = size * 1.35;
    const lines = (el.text || '').split('\n');
    const startY = el.baselineY !== undefined ? el.baselineY : (el.yPt + el.heightPt - size);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) continue;
      const currentY = startY - (i * lineHeight);

      try {
        page.drawText(lineText, {
          x: el.xPt,
          y: currentY,
          font,
          size,
          color
        });
      } catch {
        // Fallback for characters outside standard WinAnsi font charset (e.g. custom bullets or unicode symbols)
        const sanitized = lineText.replace(/[•●○▪▸]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
        try {
          page.drawText(sanitized, {
            x: el.xPt,
            y: currentY,
            font,
            size,
            color
          });
        } catch {
          // Fallback ignore if still unencodable
        }
      }

      if (el.underline) {
        try {
          const textWidth = font.widthOfTextAtSize(lineText, size);
          page.drawLine({
            start: { x: el.xPt, y: currentY - 2 },
            end: { x: el.xPt + textWidth, y: currentY - 2 },
            color,
            thickness: Math.max(0.75, size / 14)
          });
        } catch {
          // Fallback if width computation fails on custom characters
        }
      }
    }
  }

  /**
   * Renders invisible text layer (Searchable PDF text mode 3 / opacity 0)
   * The text is searchable and selectable in PDF viewers, while visually keeping the page original
   */
  private renderOcrTextLayer(
    page: PDFPage,
    el: OcrTextLayerElement,
    font: any
  ): void {
    if (!el.lines) return;

    for (const line of el.lines) {
      if (!line.text || !line.bbox) continue;
      const [x0, y0] = line.bbox;
      const size = line.fontSizePt || 12;

      page.drawText(line.text, {
        x: x0,
        y: line.baselineY || y0,
        font,
        size,
        color: rgb(0, 0, 0),
        opacity: 0 // Invisible text layer: selectable & searchable, 0 visual disruption
      });
    }
  }

  private parseColor(colorStr?: string): Color | undefined {
    if (!colorStr) return undefined;
    const resolved = this.resolveColorToCss(colorStr);
    const clean = resolved.trim().toLowerCase();

    if (clean === 'transparent' || clean === 'none') {
      return undefined;
    }

    if (clean.startsWith('rgb')) {
      const match = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = Math.min(1, Math.max(0, Number(match[1]) / 255));
        const g = Math.min(1, Math.max(0, Number(match[2]) / 255));
        const b = Math.min(1, Math.max(0, Number(match[3]) / 255));
        return rgb(r, g, b);
      }
    }

    const cleanHex = clean.replace('#', '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
      const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
      const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return rgb(r, g, b);
      }
    }
    if (cleanHex.length >= 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return rgb(r, g, b);
      }
    }
    return rgb(0, 0, 0);
  }

  private base64ToBytes(dataUrl: string): Uint8Array {
    const base64Index = dataUrl.indexOf(',');
    const base64 = base64Index >= 0 ? dataUrl.substring(base64Index + 1) : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
