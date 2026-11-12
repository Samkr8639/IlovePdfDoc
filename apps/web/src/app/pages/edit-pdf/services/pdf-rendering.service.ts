import { Injectable } from '@angular/core';
import { PageDimensions, TextEditElement } from '../models/document-model';
import { CoordinateTransformService } from './coordinate-transform';

@Injectable({
  providedIn: 'root'
})
export class PdfRenderingService {
  private activeRenderTasks = new Map<HTMLCanvasElement, any>();

  constructor(private transform: CoordinateTransformService) {}

  cancelAll(): void {
    for (const [canvas, task] of this.activeRenderTasks.entries()) {
      try {
        task.cancel();
      } catch {
        // ignore cancellation
      }
    }
    this.activeRenderTasks.clear();
  }

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
    const existingTask = this.activeRenderTasks.get(canvas);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch {
        // ignore
      }
      this.activeRenderTasks.delete(canvas);
    }

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
      const renderTask = pdfPage.render({ canvasContext: ctx, viewport });
      this.activeRenderTasks.set(canvas, renderTask);
      try {
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') {
          return null;
        }
        throw err;
      } finally {
        if (this.activeRenderTasks.get(canvas) === renderTask) {
          this.activeRenderTasks.delete(canvas);
        }
      }
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

    // Determine background color: use cached textEl.backgroundColor or sample from canvas
    if (!textEl.backgroundColor) {
      const firstLine = linesToWhiteout[0];
      const screenRect = this.transform.pdfRectToScreenRect(
        {
          xPt: Math.max(0, firstLine.xPt),
          yPt: firstLine.yPt,
          widthPt: firstLine.widthPt,
          heightPt: firstLine.heightPt
        },
        pageInfo,
        zoom
      );
      textEl.backgroundColor = this.detectBackgroundColor(
        ctx,
        Math.floor(screenRect.x * dpr),
        Math.floor(screenRect.y * dpr),
        Math.ceil(screenRect.width * dpr),
        Math.ceil(screenRect.height * dpr)
      );
    }

    ctx.fillStyle = textEl.backgroundColor || '#ffffff';

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

  /**
   * Samples the background color around a text region on the canvas so that
   * in-place text erasing blends seamlessly with highlights, colored rows, or tinted backgrounds.
   */
  detectBackgroundColor(
    ctx: CanvasRenderingContext2D,
    canvasX: number,
    canvasY: number,
    canvasW: number,
    canvasH: number
  ): string {
    try {
      const cWidth = ctx.canvas?.width || 0;
      const cHeight = ctx.canvas?.height || 0;
      if (typeof ctx.getImageData !== 'function' || cWidth === 0 || cHeight === 0 || canvasW <= 0 || canvasH <= 0) {
        return '#ffffff';
      }

      // Sample points along perimeter and just outside (margins) where glyph strokes are absent
      const samplePoints: { x: number; y: number }[] = [];

      const outTop = Math.max(0, canvasY - 2);
      const outBottom = Math.min(cHeight - 1, canvasY + canvasH + 1);
      const outLeft = Math.max(0, canvasX - 2);
      const outRight = Math.min(cWidth - 1, canvasX + canvasW + 1);

      // Top and bottom margin points
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = Math.min(cWidth - 1, Math.max(0, Math.floor(canvasX + (canvasW * i) / steps)));
        samplePoints.push({ x, y: outTop });
        samplePoints.push({ x, y: outBottom });
      }

      // Left and right margin points
      for (let j = 1; j < steps; j++) {
        const y = Math.min(cHeight - 1, Math.max(0, Math.floor(canvasY + (canvasH * j) / steps)));
        samplePoints.push({ x: outLeft, y });
        samplePoints.push({ x: outRight, y });
      }

      // Inside corners (almost always blank background even in full-width text)
      samplePoints.push({ x: Math.min(cWidth - 1, Math.max(0, canvasX + 1)), y: Math.min(cHeight - 1, Math.max(0, canvasY + 1)) });
      samplePoints.push({ x: Math.min(cWidth - 1, Math.max(0, canvasX + canvasW - 2)), y: Math.min(cHeight - 1, Math.max(0, canvasY + 1)) });
      samplePoints.push({ x: Math.min(cWidth - 1, Math.max(0, canvasX + 1)), y: Math.min(cHeight - 1, Math.max(0, canvasY + canvasH - 2)) });
      samplePoints.push({ x: Math.min(cWidth - 1, Math.max(0, canvasX + canvasW - 2)), y: Math.min(cHeight - 1, Math.max(0, canvasY + canvasH - 2)) });

      // Count colors into clusters
      const colorGroups: { r: number; g: number; b: number; count: number }[] = [];

      for (const pt of samplePoints) {
        const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
        if (!pixel || pixel[3] < 50) continue;

        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];

        let matched = false;
        for (const group of colorGroups) {
          const dist = Math.abs(group.r - r) + Math.abs(group.g - g) + Math.abs(group.b - b);
          if (dist < 24) {
            group.count++;
            matched = true;
            break;
          }
        }
        if (!matched) {
          colorGroups.push({ r, g, b, count: 1 });
        }
      }

      if (colorGroups.length > 0) {
        colorGroups.sort((a, b) => b.count - a.count);
        const best = colorGroups[0];
        if (best.r >= 250 && best.g >= 250 && best.b >= 250) {
          return '#ffffff';
        }
        return `rgb(${best.r}, ${best.g}, ${best.b})`;
      }
    } catch {
      // Fallback on canvas security/context error
    }
    return '#ffffff';
  }
}

