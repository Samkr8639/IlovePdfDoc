import { Injectable } from '@angular/core';
import { DrawPoint, PageDimensions } from '../models/document-model';
import { CoordinateTransformService, ScreenRect } from './coordinate-transform';

@Injectable({
  providedIn: 'root'
})
export class CanvasInteractionService {
  constructor(private transform: CoordinateTransformService) {}

  calculateDragMove(
    dxScreen: number,
    dyScreen: number,
    zoom: number,
    startPos: { xPt: number; yPt: number }
  ): { xPt: number; yPt: number } {
    const dxPt = dxScreen / zoom;
    const dyPt = -dyScreen / zoom;
    return {
      xPt: Math.round(startPos.xPt + dxPt),
      yPt: Math.round(startPos.yPt + dyPt)
    };
  }

  calculateResize(
    handle: string,
    dx: number,
    dy: number,
    startScreen: ScreenRect,
    isPreserveAspect: boolean,
    page: PageDimensions,
    zoom: number
  ): { xPt: number; yPt: number; widthPt: number; heightPt: number } {
    let newLeft = startScreen.x;
    let newTop = startScreen.y;
    let newWidth = startScreen.width;
    let newHeight = startScreen.height;

    if (isPreserveAspect) {
      const aspect = (startScreen.width > 0 && startScreen.height > 0)
        ? (startScreen.width / startScreen.height)
        : 1;

      if (handle === 'se') {
        newWidth = Math.max(20, startScreen.width + dx);
        newHeight = Math.max(16, newWidth / aspect);
      } else if (handle === 'sw') {
        newWidth = Math.max(20, startScreen.width - dx);
        newLeft = startScreen.x + startScreen.width - newWidth;
        newHeight = Math.max(16, newWidth / aspect);
      } else if (handle === 'ne') {
        newWidth = Math.max(20, startScreen.width + dx);
        newHeight = Math.max(16, newWidth / aspect);
        newTop = startScreen.y + startScreen.height - newHeight;
      } else if (handle === 'nw') {
        newWidth = Math.max(20, startScreen.width - dx);
        newLeft = startScreen.x + startScreen.width - newWidth;
        newHeight = Math.max(16, newWidth / aspect);
        newTop = startScreen.y + startScreen.height - newHeight;
      } else if (handle === 'e' || handle === 'w') {
        if (handle === 'e') {
          newWidth = Math.max(20, startScreen.width + dx);
        } else {
          newWidth = Math.max(20, startScreen.width - dx);
          newLeft = startScreen.x + startScreen.width - newWidth;
        }
        newHeight = Math.max(16, newWidth / aspect);
      } else if (handle === 's' || handle === 'n') {
        if (handle === 's') {
          newHeight = Math.max(16, startScreen.height + dy);
        } else {
          newHeight = Math.max(16, startScreen.height - dy);
          newTop = startScreen.y + startScreen.height - newHeight;
        }
        newWidth = Math.max(20, newHeight * aspect);
      }
    } else {
      if (handle.includes('e')) {
        newWidth = Math.max(20, startScreen.width + dx);
      }
      if (handle.includes('s')) {
        newHeight = Math.max(16, startScreen.height + dy);
      }
      if (handle.includes('w')) {
        const potentialW = startScreen.width - dx;
        if (potentialW >= 20) {
          newLeft = startScreen.x + dx;
          newWidth = potentialW;
        } else {
          newLeft = startScreen.x + startScreen.width - 20;
          newWidth = 20;
        }
      }
      if (handle.includes('n')) {
        const potentialH = startScreen.height - dy;
        if (potentialH >= 16) {
          newTop = startScreen.y + dy;
          newHeight = potentialH;
        } else {
          newTop = startScreen.y + startScreen.height - 16;
          newHeight = 16;
        }
      }
    }

    const newPdfRect = this.transform.screenRectToPdfRect(
      { x: newLeft, y: newTop, width: newWidth, height: newHeight },
      page,
      zoom
    );

    return {
      xPt: Math.round(newPdfRect.xPt),
      yPt: Math.round(newPdfRect.yPt),
      widthPt: Math.max(10, Math.round(newPdfRect.widthPt)),
      heightPt: Math.max(8, Math.round(newPdfRect.heightPt))
    };
  }

  smoothSplinePoints(pts: Array<{ x: number; y: number }>): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.1} ${pts[0].y + 0.1}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      path += ` Q ${pts[i].x} ${pts[i].y}, ${midX} ${midY}`;
    }
    const last = pts[pts.length - 1];
    path += ` L ${last.x} ${last.y}`;
    return path;
  }
}
