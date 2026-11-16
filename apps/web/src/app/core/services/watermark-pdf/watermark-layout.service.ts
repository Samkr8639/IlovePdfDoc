/**
 * Watermark Layout Service
 * Pure geometric and layout calculations used identically by Preview and Export.
 * All units are in PDF points (1/72 inch). Origin is bottom-left.
 */

import { Injectable } from '@angular/core';
import {
  WATERMARK_LIMITS,
  WatermarkFileSettings,
  WatermarkGridPosition
} from '@paperflow/contracts';
import {
  convertMarginToPoints,
  VisualPageBox,
  WatermarkPageLayout,
  WatermarkPlacement
} from './watermark-document-model';

export interface AutoFitResult {
  fontSize: number;
  doesNotFit: boolean;
}

export interface RotatedBoundingBox {
  rotW: number;
  rotH: number;
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkLayoutService {
  /**
   * Calculates the visible page box in points after CropBox (fallback MediaBox),
   * rotation (0, 90, 180, 270), and UserUnit scaling are applied.
   */
  computeVisualPageBox(
    cropBox: [number, number, number, number] | undefined,
    mediaBox: [number, number, number, number],
    rotation = 0,
    userUnit = 1.0,
    pageIndex = 0
  ): VisualPageBox {
    const rawBox = cropBox && cropBox.length === 4 ? cropBox : mediaBox;
    const minX = Math.min(rawBox[0], rawBox[2]);
    const minY = Math.min(rawBox[1], rawBox[3]);
    const maxX = Math.max(rawBox[0], rawBox[2]);
    const maxY = Math.max(rawBox[1], rawBox[3]);

    const unit = userUnit > 0 ? userUnit : 1.0;
    const rawWidth = (maxX - minX) * unit;
    const rawHeight = (maxY - minY) * unit;

    const normRot = ((rotation % 360) + 360) % 360;
    const isRotatedQuarter = normRot === 90 || normRot === 270;

    const visualWidth = isRotatedQuarter ? rawHeight : rawWidth;
    const visualHeight = isRotatedQuarter ? rawWidth : rawHeight;

    return {
      pageIndex,
      cropBox: [minX, minY, maxX, maxY],
      mediaBox,
      rotation: normRot,
      userUnit: unit,
      visualWidth,
      visualHeight
    };
  }

  /**
   * Computes the axis-aligned bounding box of a rotated rectangle.
   */
  computeRotatedBoundingBox(width: number, height: number, rotationDeg: number): RotatedBoundingBox {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    return {
      rotW: width * cos + height * sin,
      rotH: width * sin + height * cos
    };
  }

  /**
   * Computes the center (X, Y) for a 3x3 grid position anchor.
   * Uses the rotated bounding box to guarantee that the rotated watermark stays
   * strictly inside the page inset by margin.
   */
  computeGridAnchorCenter(
    visualWidth: number,
    visualHeight: number,
    rotW: number,
    rotH: number,
    position: WatermarkGridPosition,
    marginPt: number
  ): { centerX: number; centerY: number } {
    let rawX: number;
    let rawY: number;

    // Horizontal placement
    if (position === 'top-left' || position === 'middle-left' || position === 'bottom-left') {
      rawX = marginPt + rotW / 2;
    } else if (position === 'top-right' || position === 'middle-right' || position === 'bottom-right') {
      rawX = visualWidth - marginPt - rotW / 2;
    } else {
      rawX = visualWidth / 2;
    }

    // Vertical placement (origin bottom-left: 0 is bottom, visualHeight is top)
    if (position === 'top-left' || position === 'top-center' || position === 'top-right') {
      rawY = visualHeight - marginPt - rotH / 2;
    } else if (position === 'bottom-left' || position === 'bottom-center' || position === 'bottom-right') {
      rawY = marginPt + rotH / 2;
    } else {
      rawY = visualHeight / 2;
    }

    // Ensure center stays within page boundaries even with extreme margins
    const minX = Math.min(rotW / 2, visualWidth / 2);
    const maxX = Math.max(visualWidth - rotW / 2, visualWidth / 2);
    const minY = Math.min(rotH / 2, visualHeight / 2);
    const maxY = Math.max(visualHeight - rotH / 2, visualHeight / 2);

    return {
      centerX: Math.max(minX, Math.min(maxX, rawX)),
      centerY: Math.max(minY, Math.min(maxY, rawY))
    };
  }

  /**
   * Computes center (X, Y) from custom percentages (0-100%).
   * Clamps inside page boundary so the rotated bounding box stays fully visible.
   */
  computeCustomPositionCenter(
    visualWidth: number,
    visualHeight: number,
    rotW: number,
    rotH: number,
    customXPercent: number,
    customYPercent: number
  ): { centerX: number; centerY: number } {
    const rawX = (Math.max(0, Math.min(100, customXPercent)) / 100) * visualWidth;
    const rawY = (Math.max(0, Math.min(100, customYPercent)) / 100) * visualHeight;

    const minX = Math.min(rotW / 2, visualWidth / 2);
    const maxX = Math.max(visualWidth - rotW / 2, visualWidth / 2);
    const minY = Math.min(rotH / 2, visualHeight / 2);
    const maxY = Math.max(visualHeight - rotH / 2, visualHeight / 2);

    return {
      centerX: Math.max(minX, Math.min(maxX, rawX)),
      centerY: Math.max(minY, Math.min(maxY, rawY))
    };
  }

  /**
   * Calculates the largest font size whose rotated bounding box fits inside the page
   * minus 5% margin on each side (90% usable page width & height).
   */
  computeAutoFitFontSize(
    unitWidth: number,
    unitHeight: number,
    visualWidth: number,
    visualHeight: number,
    rotationDeg: number
  ): AutoFitResult {
    if (unitWidth <= 0 || unitHeight <= 0) {
      return { fontSize: 36, doesNotFit: false };
    }

    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    const rotW1 = unitWidth * cos + unitHeight * sin;
    const rotH1 = unitWidth * sin + unitHeight * cos;

    const usableWidth = visualWidth * 0.9;
    const usableHeight = visualHeight * 0.9;

    const scaleW = usableWidth / rotW1;
    const scaleH = usableHeight / rotH1;
    const maxScale = Math.min(scaleW, scaleH);

    if (maxScale < WATERMARK_LIMITS.minFontSizePt) {
      return {
        fontSize: WATERMARK_LIMITS.minFontSizePt,
        doesNotFit: true
      };
    }

    const fitSize = Math.max(
      WATERMARK_LIMITS.minFontSizePt,
      Math.min(WATERMARK_LIMITS.maxFontSizePt, Math.floor(maxScale))
    );

    return {
      fontSize: fitSize,
      doesNotFit: false
    };
  }

  /**
   * Generates mosaic tile placements covering the page, rotated about the page center.
   * Caps at 400 tiles per page.
   */
  computeMosaicPlacements(
    visualWidth: number,
    visualHeight: number,
    tileWidth: number,
    tileHeight: number,
    rotationDeg: number,
    gapXPt: number,
    gapYPt: number,
    stagger: boolean,
    opacity: number,
    layer: 'over' | 'below'
  ): { placements: WatermarkPlacement[]; totalTilesCount: number; exceededCap: boolean } {
    const placements: WatermarkPlacement[] = [];
    const stepX = tileWidth + Math.max(0, gapXPt);
    const stepY = tileHeight + Math.max(0, gapYPt);

    if (stepX <= 0 || stepY <= 0 || tileWidth <= 0 || tileHeight <= 0) {
      return { placements: [], totalTilesCount: 0, exceededCap: false };
    }

    const radius = Math.hypot(visualWidth, visualHeight) / 2;
    const numCols = Math.ceil(radius / stepX) + 2;
    const numRows = Math.ceil(radius / stepY) + 2;

    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const pageCenterX = visualWidth / 2;
    const pageCenterY = visualHeight / 2;

    const { rotW, rotH } = this.computeRotatedBoundingBox(tileWidth, tileHeight, rotationDeg);

    let totalTiles = 0;
    let exceededCap = false;

    for (let row = -numRows; row <= numRows; row++) {
      const staggerShift = stagger && Math.abs(row) % 2 === 1 ? stepX / 2 : 0;

      for (let col = -numCols; col <= numCols; col++) {
        const localX = col * stepX + staggerShift;
        const localY = row * stepY;

        // Rotate local coordinate about pattern origin (0, 0)
        const rx = localX * cos - localY * sin;
        const ry = localX * sin + localY * cos;

        const cx = pageCenterX + rx;
        const cy = pageCenterY + ry;

        // Check if rotated bounding box intersects the visible page rectangle [0, visualWidth] x [0, visualHeight]
        const minTx = cx - rotW / 2;
        const maxTx = cx + rotW / 2;
        const minTy = cy - rotH / 2;
        const maxTy = cy + rotH / 2;

        const intersects = maxTx >= 0 && minTx <= visualWidth && maxTy >= 0 && minTy <= visualHeight;

        if (intersects) {
          totalTiles++;
          if (placements.length < WATERMARK_LIMITS.maxMosaicTilesPerPage) {
            placements.push({
              centerX: cx,
              centerY: cy,
              width: tileWidth,
              height: tileHeight,
              rotatedWidth: rotW,
              rotatedHeight: rotH,
              rotation: rotationDeg,
              opacity,
              layer
            });
          } else {
            exceededCap = true;
          }
        }
      }
    }

    return {
      placements,
      totalTilesCount: totalTiles,
      exceededCap
    };
  }

  /**
   * Resolves the full layout for a given page and watermark configuration.
   */
  resolvePageLayout(
    visualPage: VisualPageBox,
    settings: WatermarkFileSettings,
    isIncluded: boolean,
    textMetrics: { unitWidth: number; unitHeight: number; unscaledWidth: number; unscaledHeight: number } | null,
    imageMetrics: { widthPt: number; heightPt: number } | null
  ): WatermarkPageLayout {
    if (!isIncluded) {
      return {
        pageIndex: visualPage.pageIndex,
        visualPage,
        isIncluded: false,
        placements: [],
        isMosaic: false,
        totalTilesCount: 0,
        exceededTileCap: false,
        doesNotFit: false
      };
    }

    const { common, textConfig, imageConfig } = settings;
    const isText = common.activeTab === 'text';

    let stampWidth = 0;
    let stampHeight = 0;
    let resolvedFontSize: number | undefined;
    let doesNotFit = false;

    if (isText) {
      if (!textMetrics || textMetrics.unscaledWidth <= 0 || textMetrics.unscaledHeight <= 0) {
        return {
          pageIndex: visualPage.pageIndex,
          visualPage,
          isIncluded: true,
          placements: [],
          isMosaic: false,
          totalTilesCount: 0,
          exceededTileCap: false,
          doesNotFit: false
        };
      }

      if (common.mosaic) {
        resolvedFontSize = WATERMARK_LIMITS.defaultMosaicFontSizePt;
        stampWidth = textMetrics.unitWidth * resolvedFontSize;
        stampHeight = textMetrics.unitHeight * resolvedFontSize;
      } else if (textConfig.fontSize === 'auto') {
        const fit = this.computeAutoFitFontSize(
          textMetrics.unitWidth,
          textMetrics.unitHeight,
          visualPage.visualWidth,
          visualPage.visualHeight,
          common.rotation
        );
        resolvedFontSize = fit.fontSize;
        doesNotFit = fit.doesNotFit;
        stampWidth = textMetrics.unitWidth * resolvedFontSize;
        stampHeight = textMetrics.unitHeight * resolvedFontSize;
      } else {
        resolvedFontSize = typeof textConfig.fontSize === 'number' ? textConfig.fontSize : 36;
        stampWidth = textMetrics.unitWidth * resolvedFontSize;
        stampHeight = textMetrics.unitHeight * resolvedFontSize;
      }
    } else {
      // Image watermark sizing
      if (!imageMetrics || imageMetrics.widthPt <= 0 || imageMetrics.heightPt <= 0) {
        return {
          pageIndex: visualPage.pageIndex,
          visualPage,
          isIncluded: true,
          placements: [],
          isMosaic: false,
          totalTilesCount: 0,
          exceededTileCap: false,
          doesNotFit: false
        };
      }

      if (imageConfig.useOriginalDpi) {
        // 96 DPI: 1 px = 72 / 96 pt = 0.75 pt
        stampWidth = imageConfig.imageWidthPx * 0.75;
        stampHeight = imageConfig.imageHeightPx * 0.75;
      } else {
        const pct = Math.max(5, Math.min(100, imageConfig.widthPercent)) / 100;
        stampWidth = visualPage.visualWidth * pct;
        const aspect = imageMetrics.heightPt / imageMetrics.widthPt;
        stampHeight = stampWidth * aspect;
      }
    }

    const { rotW, rotH } = this.computeRotatedBoundingBox(stampWidth, stampHeight, common.rotation);

    if (common.mosaic) {
      const gapXPt = convertMarginToPoints(common.horizontalGapMm, 'mm');
      const gapYPt = convertMarginToPoints(common.verticalGapMm, 'mm');

      const mosaicRes = this.computeMosaicPlacements(
        visualPage.visualWidth,
        visualPage.visualHeight,
        stampWidth,
        stampHeight,
        common.rotation,
        gapXPt,
        gapYPt,
        common.stagger,
        common.opacity / 100,
        common.layer
      );

      // Attach resolved font size to placements
      if (resolvedFontSize) {
        mosaicRes.placements.forEach(p => (p.fontSize = resolvedFontSize));
      }

      return {
        pageIndex: visualPage.pageIndex,
        visualPage,
        isIncluded: true,
        placements: mosaicRes.placements,
        isMosaic: true,
        totalTilesCount: mosaicRes.totalTilesCount,
        exceededTileCap: mosaicRes.exceededCap,
        doesNotFit
      };
    }

    // Single watermark placement
    const marginPt = convertMarginToPoints(common.marginMm, common.marginUnit);
    let center: { centerX: number; centerY: number };

    if (common.useCustomPosition) {
      center = this.computeCustomPositionCenter(
        visualPage.visualWidth,
        visualPage.visualHeight,
        rotW,
        rotH,
        common.customXPercent,
        common.customYPercent
      );
    } else {
      center = this.computeGridAnchorCenter(
        visualPage.visualWidth,
        visualPage.visualHeight,
        rotW,
        rotH,
        common.position,
        marginPt
      );
    }

    const singlePlacement: WatermarkPlacement = {
      centerX: center.centerX,
      centerY: center.centerY,
      width: stampWidth,
      height: stampHeight,
      rotatedWidth: rotW,
      rotatedHeight: rotH,
      rotation: common.rotation,
      fontSize: resolvedFontSize,
      opacity: common.opacity / 100,
      layer: common.layer
    };

    return {
      pageIndex: visualPage.pageIndex,
      visualPage,
      isIncluded: true,
      placements: [singlePlacement],
      isMosaic: false,
      totalTilesCount: 1,
      exceededTileCap: false,
      doesNotFit
    };
  }
}
