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
          case 'text':
            this.renderText(
              page,
              el as TextEditElement,
              fontRegular,
              fontBold,
              fontItalic,
              fontBoldItalic
            );
            break;
          case 'ocr-layer':
            this.renderOcrTextLayer(page, el as OcrTextLayerElement, fontRegular);
            break;
        }
      }
    }

    const exportedBytes = await pdfDoc.save();
    return new Blob([exportedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  private renderWhiteout(page: PDFPage, el: WhiteoutEditElement): void {
    page.drawRectangle({
      x: el.xPt,
      y: el.yPt,
      width: el.widthPt,
      height: el.heightPt,
      color: this.parseColor(el.fillColor || '#ffffff')
    });
  }

  private renderShape(page: PDFPage, el: ShapeEditElement): void {
    const strokeColor = el.strokeColor ? this.parseColor(el.strokeColor) : undefined;
    const fillColor = el.fillColor ? this.parseColor(el.fillColor) : undefined;
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
    }
  }

  private renderHighlight(page: PDFPage, el: HighlightEditElement): void {
    const color = this.parseColor(el.color || '#FFFF00');
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

      page.drawImage(embedded, {
        x: el.xPt,
        y: el.yPt,
        width: el.widthPt,
        height: el.heightPt
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
      const imageBytes = this.base64ToBytes(el.dataUrl);
      const embedded = await pdfDoc.embedPng(imageBytes);
      page.drawImage(embedded, {
        x: el.xPt,
        y: el.yPt,
        width: el.widthPt,
        height: el.heightPt
      });
    } catch {
      // Ignore corrupt signature data
    }
  }

  private renderDraw(page: PDFPage, el: DrawEditElement): void {
    if (!el.points || el.points.length < 2) return;
    const color = this.parseColor(el.strokeColor || '#000000');
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

    const color = this.parseColor(el.color || '#14213D');
    const size = el.fontSizePt || 14;

    page.drawText(el.text, {
      x: el.xPt,
      y: el.baselineY !== undefined ? el.baselineY : el.yPt,
      font,
      size,
      color
    });
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

  private parseColor(hex: string): Color {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
      const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
      const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
      return rgb(r, g, b);
    }
    if (cleanHex.length >= 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
      return rgb(r, g, b);
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
