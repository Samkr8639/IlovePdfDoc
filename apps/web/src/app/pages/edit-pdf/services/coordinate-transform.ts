import { Injectable } from '@angular/core';
import {
  getPdfPageDisplaySize,
  pdfPointToScreenPointCoords,
  pdfRectToScreenRectCoords,
  screenPointToPdfPointCoords,
  screenRectToPdfRectCoords
} from '@paperflow/contracts';
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
   * to PDF point coordinate (origin bottom-left MediaBox in points),
   * accounting for rotation (0/90/180/270), CropBox offset, UserUnit, zoom, and DPR.
   */
  screenPointToPdfPoint(
    screen: ScreenPoint,
    page: PageDimensions,
    zoom = 1.0,
    dpr = 1.0
  ): PdfPoint {
    return screenPointToPdfPointCoords(screen, page, zoom, dpr);
  }

  /**
   * Converts a PDF point coordinate (origin bottom-left MediaBox) to screen pixel coordinate
   * (origin top-left of rendered CropBox canvas).
   */
  pdfPointToScreenPoint(
    pdf: PdfPoint,
    page: PageDimensions,
    zoom = 1.0,
    dpr = 1.0
  ): ScreenPoint {
    return pdfPointToScreenPointCoords(pdf, page, zoom, dpr);
  }

  /** Converts a screen rectangle to a PDF rectangle in points. */
  screenRectToPdfRect(
    rect: ScreenRect,
    page: PageDimensions,
    zoom = 1.0,
    dpr = 1.0
  ): PdfRect {
    return screenRectToPdfRectCoords(rect, page, zoom, dpr);
  }

  /** Converts a PDF rectangle in points to a screen rectangle in pixels. */
  pdfRectToScreenRect(
    rect: PdfRect,
    page: PageDimensions,
    zoom = 1.0,
    dpr = 1.0
  ): ScreenRect {
    return pdfRectToScreenRectCoords(rect, page, zoom, dpr);
  }

  /** Returns viewport dimensions in CSS pixels accounting for rotation, UserUnit, and zoom. */
  getPageDisplaySize(page: PageDimensions, zoom = 1.0): { width: number; height: number } {
    return getPdfPageDisplaySize(page, zoom);
  }
}
