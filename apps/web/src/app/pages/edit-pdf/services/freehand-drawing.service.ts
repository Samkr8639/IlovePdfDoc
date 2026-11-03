import { Injectable } from '@angular/core';
import { DrawEditElement, DrawPoint, HighlightEditElement, PageDimensions } from '../models/document-model';
import { CoordinateTransformService, ScreenRect } from './coordinate-transform';
import { CanvasInteractionService } from './canvas-interaction.service';

export interface LiveHighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class FreehandDrawingService {
  private isDrawing = false;
  private currentDrawingScreenPoints: Array<{ x: number; y: number }> = [];

  private isHighlighting = false;
  private highlightPageIndex = 0;
  private highlightStartPos = { x: 0, y: 0 };

  constructor(
    private transform: CoordinateTransformService,
    private canvasInteraction: CanvasInteractionService
  ) {}

  // ---------------- Freehand Drawing ----------------

  startDrawing(screenX: number, screenY: number): string {
    this.isDrawing = true;
    this.currentDrawingScreenPoints = [{ x: screenX, y: screenY }];
    return `M ${screenX} ${screenY} L ${screenX + 0.1} ${screenY + 0.1}`;
  }

  moveDrawing(screenX: number, screenY: number): string | null {
    if (!this.isDrawing) return null;
    const pts = this.currentDrawingScreenPoints;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dist = Math.hypot(screenX - last.x, screenY - last.y);
      if (dist < 1.5) return null;
    }

    pts.push({ x: screenX, y: screenY });
    return this.canvasInteraction.smoothSplinePoints(pts);
  }

  finishDrawing(
    page: PageDimensions,
    zoom: number,
    color: string,
    strokeWidth: number
  ): DrawEditElement | null {
    if (!this.isDrawing) return null;
    this.isDrawing = false;
    const screenPts = this.currentDrawingScreenPoints;
    this.currentDrawingScreenPoints = [];

    if (!page || screenPts.length < 2) {
      return null;
    }

    const pdfPts: DrawPoint[] = screenPts.map(p =>
      this.transform.screenPointToPdfPoint({ x: p.x, y: p.y }, page, zoom)
    );

    const xs = pdfPts.map(p => p.xPt);
    const ys = pdfPts.map(p => p.yPt);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      id: `draw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'draw',
      xPt: minX,
      yPt: minY,
      widthPt: Math.max(8, maxX - minX),
      heightPt: Math.max(8, maxY - minY),
      points: pdfPts,
      strokeColor: color,
      strokeWidth
    };
  }

  cancelDrawing(): void {
    this.isDrawing = false;
    this.currentDrawingScreenPoints = [];
  }

  // ---------------- Highlight Area Drag Selection ----------------

  startHighlightDrag(
    pageIndex: number,
    clientX: number,
    clientY: number,
    pageRect: DOMRect
  ): LiveHighlightRect {
    const x = clientX - pageRect.left;
    const y = clientY - pageRect.top;

    this.isHighlighting = true;
    this.highlightPageIndex = pageIndex;
    this.highlightStartPos = { x, y };

    return { x, y, width: 0, height: 0, pageIndex };
  }

  moveHighlightDrag(
    clientX: number,
    clientY: number,
    pageRect: DOMRect
  ): LiveHighlightRect | null {
    if (!this.isHighlighting) return null;
    const curX = Math.max(0, Math.min(pageRect.width, clientX - pageRect.left));
    const curY = Math.max(0, Math.min(pageRect.height, clientY - pageRect.top));

    const left = Math.min(this.highlightStartPos.x, curX);
    const top = Math.min(this.highlightStartPos.y, curY);
    const width = Math.abs(curX - this.highlightStartPos.x);
    const height = Math.abs(curY - this.highlightStartPos.y);

    return {
      x: left,
      y: top,
      width,
      height,
      pageIndex: this.highlightPageIndex
    };
  }

  finishHighlightDrag(
    liveRect: LiveHighlightRect | null,
    page: PageDimensions,
    zoom: number,
    color: string,
    opacity: number
  ): HighlightEditElement | null {
    if (!this.isHighlighting) return null;
    this.isHighlighting = false;

    if (!liveRect || (liveRect.width <= 6 && liveRect.height <= 6)) {
      return null;
    }

    const pdfRect = this.transform.screenRectToPdfRect(
      { x: liveRect.x, y: liveRect.y, width: liveRect.width, height: liveRect.height },
      page,
      zoom
    );

    return {
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: this.highlightPageIndex,
      type: 'highlight',
      xPt: Math.round(pdfRect.xPt),
      yPt: Math.round(pdfRect.yPt),
      widthPt: Math.max(12, Math.round(pdfRect.widthPt)),
      heightPt: Math.max(8, Math.round(pdfRect.heightPt)),
      color,
      opacity
    };
  }
}

