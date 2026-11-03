import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts, PDFPage, Color, PDFString } from 'pdf-lib';
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
  LinkEditElement,
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
              // If user edited this page text block, whiteout the old text first at its original position
              if (textEl.isPageTextLine && textEl.isEdited) {
                const linesToWhiteout = textEl.originalLines && textEl.originalLines.length > 0
                  ? textEl.originalLines
                  : [{
                      text: textEl.text,
                      xPt: (textEl.originalXPt !== undefined ? textEl.originalXPt : textEl.xPt) - 0.5,
                      yPt: textEl.originalYPt !== undefined ? textEl.originalYPt : textEl.yPt,
                      widthPt: (textEl.originalWidthPt !== undefined ? textEl.originalWidthPt : textEl.widthPt) + 1.0,
                      heightPt: textEl.originalHeightPt !== undefined ? textEl.originalHeightPt : textEl.heightPt
                    }];

                for (const line of linesToWhiteout) {
                  page.drawRectangle({
                    x: Math.max(0, line.xPt),
                    y: line.yPt,
                    width: line.widthPt,
                    height: line.heightPt,
                    color: rgb(1, 1, 1)
                  });
                }
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
            case 'link': {
              const linkEl = el as LinkEditElement;
              if (linkEl.url) {
                this.addLinkAnnotation(page, linkEl.url, linkEl.xPt, linkEl.yPt, linkEl.widthPt, linkEl.heightPt);
              }
              break;
            }
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

  private parseRichTextToLines(
    el: TextEditElement,
    defaultColor: Color
  ): Array<{ spans: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean; strikeout?: boolean; color?: Color; linkUrl?: string }> }> {
    const rawHtml = el.html;
    if (!rawHtml || !rawHtml.includes('<') || typeof DOMParser === 'undefined') {
      const lines = (el.text || '').split('\n');
      return lines.map(line => ({
        spans: [{
          text: line,
          bold: !!el.bold,
          italic: !!el.italic,
          underline: !!el.underline || !!el.linkUrl,
          strikeout: !!el.strikeout,
          color: el.linkUrl ? (this.parseColor('#2563EB') || defaultColor) : defaultColor,
          linkUrl: el.linkUrl
        }]
      }));
    }

    try {
      const parser = new DOMParser();
      const normalizedHtml = rawHtml
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/div>/gi, '\n</div>')
        .replace(/<\/p>/gi, '\n</p>');

      const doc = parser.parseFromString(`<body>${normalizedHtml}</body>`, 'text/html');
      const lines: Array<{ spans: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean; strikeout?: boolean; color?: Color; linkUrl?: string }> }> = [];
      let currentLineSpans: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean; strikeout?: boolean; color?: Color; linkUrl?: string }> = [];

      const traverse = (
        node: Node,
        boldState: boolean,
        italicState: boolean,
        underlineState: boolean,
        strikeoutState: boolean,
        colorState: Color,
        linkUrlState?: string
      ) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text) return;
          const parts = text.split('\n');
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              lines.push({ spans: currentLineSpans });
              currentLineSpans = [];
            }
            if (parts[i]) {
              const spanLink = linkUrlState || el.linkUrl;
              currentLineSpans.push({
                text: parts[i],
                bold: boldState,
                italic: italicState,
                underline: underlineState || !!spanLink,
                strikeout: strikeoutState,
                color: spanLink && colorState === defaultColor ? (this.parseColor('#2563EB') || colorState) : colorState,
                linkUrl: spanLink
              });
            }
          }
          return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const elem = node as HTMLElement;
          const tag = elem.tagName.toLowerCase();
          const isB: boolean = !!(
            boldState ||
            tag === 'b' ||
            tag === 'strong' ||
            elem.style.fontWeight === 'bold' ||
            parseInt(elem.style.fontWeight || '400', 10) >= 600
          );
          const isI: boolean = !!(
            italicState ||
            tag === 'i' ||
            tag === 'em' ||
            elem.style.fontStyle === 'italic'
          );
          const isU: boolean = !!(
            underlineState ||
            tag === 'u' ||
            (elem.style.textDecoration && elem.style.textDecoration.includes('underline'))
          );
          const isS: boolean = !!(
            strikeoutState ||
            tag === 's' ||
            tag === 'strike' ||
            tag === 'del' ||
            (elem.style.textDecoration && elem.style.textDecoration.includes('line-through'))
          );
          let col = colorState;
          if (elem.style.color) {
            const parsed = this.parseColor(elem.style.color);
            if (parsed) col = parsed;
          } else if (elem.getAttribute('color')) {
            const parsed = this.parseColor(elem.getAttribute('color') || '');
            if (parsed) col = parsed;
          }

          let link = linkUrlState;
          if (tag === 'a') {
            link = elem.getAttribute('href') || linkUrlState;
          }

          for (let child = elem.firstChild; child; child = child.nextSibling) {
            traverse(child, isB, isI, isU, isS, col, link);
          }
        }
      };

      traverse(doc.body, !!el.bold, !!el.italic, !!el.underline, !!el.strikeout, defaultColor, el.linkUrl);
      if (currentLineSpans.length > 0 || lines.length === 0) {
        lines.push({ spans: currentLineSpans });
      }

      return lines;
    } catch {
      const lines = (el.text || '').split('\n');
      return lines.map(line => ({
        spans: [{
          text: line,
          bold: !!el.bold,
          italic: !!el.italic,
          underline: !!el.underline || !!el.linkUrl,
          strikeout: !!el.strikeout,
          color: el.linkUrl ? (this.parseColor('#2563EB') || defaultColor) : defaultColor,
          linkUrl: el.linkUrl
        }]
      }));
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
    const baseColor = this.parseColor(el.color || '#14213D') || rgb(0.08, 0.13, 0.24);
    const size = el.fontSizePt || 14;
    const lineHeight = size * 1.35;
    const startY = el.baselineY !== undefined ? el.baselineY : (el.yPt + el.heightPt - size);
    const lineSpansList = this.parseRichTextToLines(el, baseColor);

    for (let i = 0; i < lineSpansList.length; i++) {
      const lineObj = lineSpansList[i];
      const currentY = startY - (i * lineHeight);
      let currentX = el.xPt;

      for (const span of lineObj.spans) {
        if (!span.text) continue;

        let font = regularFont;
        if (span.bold && span.italic) {
          font = boldItalicFont;
        } else if (span.bold) {
          font = boldFont;
        } else if (span.italic) {
          font = italicFont;
        }

        const spanColor = span.color || baseColor;

        try {
          page.drawText(span.text, {
            x: currentX,
            y: currentY,
            font,
            size,
            color: spanColor
          });
        } catch {
          const sanitized = span.text.replace(/[•●○▪▸]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
          try {
            page.drawText(sanitized, {
              x: currentX,
              y: currentY,
              font,
              size,
              color: spanColor
            });
          } catch {}
        }

        try {
          const spanWidth = font.widthOfTextAtSize(span.text, size);
          if (span.underline) {
            page.drawLine({
              start: { x: currentX, y: currentY - 2 },
              end: { x: currentX + spanWidth, y: currentY - 2 },
              color: spanColor,
              thickness: Math.max(0.75, size / 14)
            });
          }
          if (span.strikeout) {
            page.drawLine({
              start: { x: currentX, y: currentY + size * 0.35 },
              end: { x: currentX + spanWidth, y: currentY + size * 0.35 },
              color: spanColor,
              thickness: Math.max(0.75, size / 14)
            });
          }
          if (span.linkUrl) {
            this.addLinkAnnotation(page, span.linkUrl, currentX, currentY - 2, spanWidth, size + 4);
          }
          currentX += spanWidth;
        } catch {
          const approxWidth = size * span.text.length * 0.55;
          if (span.linkUrl) {
            this.addLinkAnnotation(page, span.linkUrl, currentX, currentY - 2, approxWidth, size + 4);
          }
          currentX += approxWidth;
        }
      }
    }
  }

  private addLinkAnnotation(
    page: PDFPage,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    try {
      const doc = page.doc;
      const linkAnnot = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, y, x + width, y + height],
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of(url)
        }
      });
      const annotRef = doc.context.register(linkAnnot);
      page.node.addAnnot(annotRef);
    } catch (e) {
      console.warn('Failed to add PDF link annotation:', e);
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
