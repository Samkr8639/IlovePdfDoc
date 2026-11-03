import { Injectable } from '@angular/core';
import { PageDimensions, TextEditElement } from '../models/document-model';
import { CoordinateTransformService } from './coordinate-transform';

@Injectable({
  providedIn: 'root'
})
export class PdfRenderingService {
  constructor(private transform: CoordinateTransformService) {}

  async generateThumbnails(pdfDoc: any): Promise<Map<number, string>> {
    const thumbs = new Map<number, string>();
    if (!pdfDoc) return thumbs;

    const total = pdfDoc.numPages;
    for (let i = 1; i <= total; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.18 });
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbs.set(i - 1, offscreen.toDataURL('image/jpeg', 0.8));
        }
      } catch {
        // Fallback to CSS doc lines for thumbnail
      }
    }
    return thumbs;
  }

  async renderPageToCanvas(
    pdfDoc: any,
    pageInfo: PageDimensions,
    canvas: HTMLCanvasElement,
    dpr: number,
    zoom: number
  ): Promise<CanvasRenderingContext2D | null> {
    const pdfPage = await pdfDoc.getPage(pageInfo.pageIndex + 1);
    const display = this.transform.getPageDisplaySize(pageInfo, zoom);
    const unscaledViewport = pdfPage.getViewport({ scale: 1.0, rotation: pageInfo.rotation || 0 });
    const scale = (display.width / unscaledViewport.width) * dpr;
    const viewport = pdfPage.getViewport({ scale, rotation: pageInfo.rotation || 0 });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${display.width}px`;
    canvas.style.height = `${display.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      return ctx;
    }
    return null;
  }

  whiteoutOriginalText(
    textEl: TextEditElement,
    ctx: CanvasRenderingContext2D,
    pageInfo: PageDimensions,
    dpr: number,
    zoom: number
  ): void {
    const linesToWhiteout = textEl.originalLines && textEl.originalLines.length > 0
      ? textEl.originalLines
      : [{
          text: textEl.text,
          xPt: (textEl.originalXPt !== undefined ? textEl.originalXPt : textEl.xPt) - 0.5,
          yPt: textEl.originalYPt !== undefined ? textEl.originalYPt : textEl.yPt,
          widthPt: (textEl.originalWidthPt !== undefined ? textEl.originalWidthPt : textEl.widthPt) + 1.0,
          heightPt: textEl.originalHeightPt !== undefined ? textEl.originalHeightPt : textEl.heightPt
        }];

    ctx.fillStyle = '#ffffff';

    for (const line of linesToWhiteout) {
      const screenRect = this.transform.pdfRectToScreenRect(
        {
          xPt: Math.max(0, line.xPt),
          yPt: line.yPt,
          widthPt: line.widthPt,
          heightPt: line.heightPt
        },
        pageInfo,
        zoom
      );

      ctx.fillRect(
        Math.floor(screenRect.x * dpr),
        Math.floor(screenRect.y * dpr),
        Math.ceil(screenRect.width * dpr),
        Math.ceil(screenRect.height * dpr)
      );
    }
  }
}

