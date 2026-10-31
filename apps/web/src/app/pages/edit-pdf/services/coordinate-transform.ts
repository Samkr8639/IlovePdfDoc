import { Injectable } from '@angular/core';
import { PageDimensions } from '../models/document-model';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PdfPoint {
  xPt: number;
  yPt: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfRect {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

@Injectable({
  providedIn: 'root'
})
export class CoordinateTransformService {
  /**
   * Converts a screen coordinate (pixels from top-left of canvas container)
   * to PDF point coordinate (origin bottom-left in points, 72 DPI)
   */
  screenPointToPdfPoint(
    screen: ScreenPoint,
    page: PageDimensions,
    zoom = 1.0
  ): PdfPoint {
    const safeZoom = Math.max(0.1, zoom);
    const unscaledX = screen.x / safeZoom;
    const unscaledY = screen.y / safeZoom;
    const rotation = ((page.rotation % 360) + 360) % 360;

    switch (rotation) {
      case 90:
        // Rotated 90 deg clockwise: display width is page.heightPt, display height is page.widthPt
        return {
          xPt: page.widthPt - unscaledY,
          yPt: page.heightPt - unscaledX
        };
      case 180:
        return {
          xPt: page.widthPt - unscaledX,
          yPt: unscaledY
        };
      case 270:
        return {
          xPt: unscaledY,
          yPt: unscaledX
        };
      case 0:
      default:
        return {
          xPt: unscaledX,
          yPt: page.heightPt - unscaledY
        };
    }
  }

  /**
   * Converts a PDF point coordinate (origin bottom-left) to screen pixel coordinate (origin top-left)
   */
  pdfPointToScreenPoint(
    pdf: PdfPoint,
    page: PageDimensions,
    zoom = 1.0
  ): ScreenPoint {
    const safeZoom = Math.max(0.1, zoom);
    const rotation = ((page.rotation % 360) + 360) % 360;

    let unscaledX = 0;
    let unscaledY = 0;

    switch (rotation) {
      case 90:
        unscaledX = (page.heightPt - pdf.yPt);
        unscaledY = (page.widthPt - pdf.xPt);
        break;
      case 180:
        unscaledX = (page.widthPt - pdf.xPt);
        unscaledY = pdf.yPt;
        break;
      case 270:
        unscaledX = pdf.yPt;
        unscaledY = pdf.xPt;
        break;
      case 0:
      default:
        unscaledX = pdf.xPt;
        unscaledY = page.heightPt - pdf.yPt;
        break;
    }

    return {
      x: unscaledX * safeZoom,
      y: unscaledY * safeZoom
    };
  }

  /**
   * Converts a screen rectangle to a PDF rectangle in points
   */
  screenRectToPdfRect(
    rect: ScreenRect,
    page: PageDimensions,
    zoom = 1.0
  ): PdfRect {
    const safeZoom = Math.max(0.1, zoom);
    const p1 = this.screenPointToPdfPoint({ x: rect.x, y: rect.y }, page, safeZoom);
    const p2 = this.screenPointToPdfPoint(
      { x: rect.x + rect.width, y: rect.y + rect.height },
      page,
      safeZoom
    );

    const minX = Math.min(p1.xPt, p2.xPt);
    const minY = Math.min(p1.yPt, p2.yPt);
    const maxX = Math.max(p1.xPt, p2.xPt);
    const maxY = Math.max(p1.yPt, p2.yPt);

    return {
      xPt: minX,
      yPt: minY,
      widthPt: Math.max(1, maxX - minX),
      heightPt: Math.max(1, maxY - minY)
    };
  }

  /**
   * Converts a PDF rectangle in points to a screen rectangle in pixels
   */
  pdfRectToScreenRect(
    rect: PdfRect,
    page: PageDimensions,
    zoom = 1.0
  ): ScreenRect {
    const safeZoom = Math.max(0.1, zoom);
    // PDF origin is bottom-left, top of rect is yPt + heightPt
    const topLeft = this.pdfPointToScreenPoint(
      { xPt: rect.xPt, yPt: rect.yPt + rect.heightPt },
      page,
      safeZoom
    );
    const bottomRight = this.pdfPointToScreenPoint(
      { xPt: rect.xPt + rect.widthPt, yPt: rect.yPt },
      page,
      safeZoom
    );

    const minX = Math.min(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const maxY = Math.max(topLeft.y, bottomRight.y);

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  /**
   * Returns the viewport dimensions (width, height in pixels) of a page accounting for rotation and zoom
   */
  getPageDisplaySize(page: PageDimensions, zoom = 1.0): { width: number; height: number } {
    const safeZoom = Math.max(0.1, zoom);
    const isSideways = page.rotation === 90 || page.rotation === 270;
    const wPt = isSideways ? page.heightPt : page.widthPt;
    const hPt = isSideways ? page.widthPt : page.heightPt;

    return {
      width: Math.round(wPt * safeZoom),
      height: Math.round(hPt * safeZoom)
    };
  }
}
