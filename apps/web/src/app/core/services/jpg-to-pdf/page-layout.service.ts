import { Injectable } from '@angular/core';
import {
  ComputedPageLayout,
  JpgToPdfImageItem,
  JpgToPdfOptions,
  MeasurementUnit,
  PageSizeOption
} from './jpg-to-pdf.models';

export const MM_TO_PT = 72 / 25.4; // 2.834645669291339 pt per mm
export const INCH_TO_PT = 72;
export const MAX_PDF_PAGE_DIM_PT = 14400; // PDF 1.7 specification limit (200 inches)

export interface MiniPreviewStyle {
  pageContainer: {
    aspectRatio: string;
    backgroundColor: string;
  };
  marginBox: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  imageWrapper: {
    position: 'absolute';
    left: string;
    top: string;
    width: string;
    height: string;
    overflow: 'hidden';
  };
  imageElement: {
    width: string;
    height: string;
    objectFit: 'contain' | 'cover' | 'scale-down';
    objectPosition: string;
    transform: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PageLayoutService {
  /**
   * Computes the exact geometric layout in PDF points for a single image item.
   */
  computeLayout(item: JpgToPdfImageItem, options: JpgToPdfOptions): ComputedPageLayout {
    // 1. Determine effective image rotation and dimensions
    const { effectiveRotationDeg, needsHorizontalFlip } = this.calculateEffectiveRotation(item, options);
    const isRotated90or270 = effectiveRotationDeg === 90 || effectiveRotationDeg === 270;

    const naturalWidthPx = isRotated90or270 ? item.probe.heightPx : item.probe.widthPx;
    const naturalHeightPx = isRotated90or270 ? item.probe.widthPx : item.probe.heightPx;

    // 2. Determine DPI
    const dpi = this.resolveDpi(item, options);

    // Natural dimensions in points at this DPI
    const imageNaturalWidthPt = (naturalWidthPx / dpi) * 72;
    const imageNaturalHeightPt = (naturalHeightPx / dpi) * 72;

    // 3. Compute Margin in Points
    const marginPt = this.resolveMarginPt(options);

    // 4. Calculate Base Page Dimensions
    let pageWidthPt: number;
    let pageHeightPt: number;
    let clampedDueToPdfLimit = false;

    if (options.pageSize === 'same-as-image') {
      // Page size equals image natural size + margins on every side
      pageWidthPt = imageNaturalWidthPt + marginPt * 2;
      pageHeightPt = imageNaturalHeightPt + marginPt * 2;
    } else {
      const standard = this.getStandardPageDimensionsPt(options.pageSize, options);
      let baseW = standard.width;
      let baseH = standard.height;

      // Orientation adjustment
      let isTargetLandscape = false;
      if (options.orientation === 'auto') {
        isTargetLandscape = naturalWidthPx > naturalHeightPx;
      } else if (options.orientation === 'landscape') {
        isTargetLandscape = true;
      } else {
        isTargetLandscape = false;
      }

      if (isTargetLandscape) {
        pageWidthPt = Math.max(baseW, baseH);
        pageHeightPt = Math.min(baseW, baseH);
      } else {
        pageWidthPt = Math.min(baseW, baseH);
        pageHeightPt = Math.max(baseW, baseH);
      }
    }

    // 5. Clamp to 14,400 points PDF limit if exceeded
    if (pageWidthPt > MAX_PDF_PAGE_DIM_PT || pageHeightPt > MAX_PDF_PAGE_DIM_PT) {
      clampedDueToPdfLimit = true;
      const maxDim = Math.max(pageWidthPt, pageHeightPt);
      const scaleFactor = MAX_PDF_PAGE_DIM_PT / maxDim;
      pageWidthPt *= scaleFactor;
      pageHeightPt *= scaleFactor;
    }

    // 6. Compute Safe Margins (ensuring content area is at least 20% of page)
    const maxAllowedMarginX = (pageWidthPt * 0.4);
    const maxAllowedMarginY = (pageHeightPt * 0.4);
    const safeMarginX = Math.min(marginPt, maxAllowedMarginX);
    const safeMarginY = Math.min(marginPt, maxAllowedMarginY);

    const marginLeftPt = safeMarginX;
    const marginRightPt = safeMarginX;
    const marginTopPt = safeMarginY;
    const marginBottomPt = safeMarginY;

    const contentBoxWidthPt = Math.max(1, pageWidthPt - marginLeftPt - marginRightPt);
    const contentBoxHeightPt = Math.max(1, pageHeightPt - marginTopPt - marginBottomPt);

    // 7. Calculate Image Placement inside Content Box
    let drawWidthPt = contentBoxWidthPt;
    let drawHeightPt = contentBoxHeightPt;
    let isClipped = false;
    let clipXPt: number | undefined;
    let clipYPt: number | undefined;
    let clipWidthPt: number | undefined;
    let clipHeightPt: number | undefined;

    const imgAspect = naturalWidthPx / naturalHeightPx;
    const boxAspect = contentBoxWidthPt / contentBoxHeightPt;

    if (options.fit === 'fit') {
      if (imgAspect > boxAspect) {
        // Image is wider than box -> fit width
        drawWidthPt = contentBoxWidthPt;
        drawHeightPt = contentBoxWidthPt / imgAspect;
      } else {
        // Image is taller than box -> fit height
        drawHeightPt = contentBoxHeightPt;
        drawWidthPt = contentBoxHeightPt * imgAspect;
      }
    } else if (options.fit === 'fill') {
      // Cover the content box (or page if no margin)
      if (imgAspect > boxAspect) {
        // Fill height, crop sides
        drawHeightPt = contentBoxHeightPt;
        drawWidthPt = contentBoxHeightPt * imgAspect;
      } else {
        // Fill width, crop top/bottom
        drawWidthPt = contentBoxWidthPt;
        drawHeightPt = contentBoxWidthPt / imgAspect;
      }
      isClipped = true;
      clipXPt = marginLeftPt;
      clipYPt = marginBottomPt;
      clipWidthPt = contentBoxWidthPt;
      clipHeightPt = contentBoxHeightPt;
    } else {
      // 'original': 1:1 at DPI, scaled down only if larger than content box
      let origW = imageNaturalWidthPt;
      let origH = imageNaturalHeightPt;
      if (origW > contentBoxWidthPt || origH > contentBoxHeightPt) {
        const scale = Math.min(contentBoxWidthPt / origW, contentBoxHeightPt / origH);
        origW *= scale;
        origH *= scale;
      }
      drawWidthPt = origW;
      drawHeightPt = origH;
    }

    // Alignment: Center horizontally
    const drawXPt = marginLeftPt + (contentBoxWidthPt - drawWidthPt) / 2;

    // Alignment: Vertical (Center or Top)
    // Note: PDF coordinate system has Y=0 at bottom!
    let drawYPt: number;
    if (options.alignment === 'top') {
      // Top of image coincides with top of content box
      drawYPt = pageHeightPt - marginTopPt - drawHeightPt;
    } else {
      // Center vertically in content box
      drawYPt = marginBottomPt + (contentBoxHeightPt - drawHeightPt) / 2;
    }

    return {
      pageWidthPt,
      pageHeightPt,
      isLandscape: pageWidthPt > pageHeightPt,
      marginLeftPt,
      marginRightPt,
      marginTopPt,
      marginBottomPt,
      contentBoxWidthPt,
      contentBoxHeightPt,
      drawXPt,
      drawYPt,
      drawWidthPt,
      drawHeightPt,
      isClipped,
      clipXPt,
      clipYPt,
      clipWidthPt,
      clipHeightPt,
      effectiveRotationDeg,
      needsHorizontalFlip,
      clampedDueToPdfLimit
    };
  }

  /**
   * Generates CSS styles for the live card preview.
   * Matches the computed PDF layout 1:1 visually.
   */
  computeMiniPreviewStyle(layout: ComputedPageLayout, options: JpgToPdfOptions): MiniPreviewStyle {
    const { pageWidthPt, pageHeightPt, marginLeftPt, marginRightPt, marginTopPt, marginBottomPt } = layout;

    const leftPct = (marginLeftPt / pageWidthPt) * 100;
    const rightPct = (marginRightPt / pageWidthPt) * 100;
    const topPct = (marginTopPt / pageHeightPt) * 100;
    const bottomPct = (marginBottomPt / pageHeightPt) * 100;

    const imgLeftPct = (layout.drawXPt / pageWidthPt) * 100;
    const imgWidthPct = (layout.drawWidthPt / pageWidthPt) * 100;

    // Convert PDF bottom-up Y to CSS top-down percentage
    const imgTopPt = pageHeightPt - (layout.drawYPt + layout.drawHeightPt);
    const imgTopPct = (imgTopPt / pageHeightPt) * 100;
    const imgHeightPct = (layout.drawHeightPt / pageHeightPt) * 100;

    let objectFit: 'contain' | 'cover' | 'scale-down' = 'contain';
    if (options.fit === 'fill') {
      objectFit = 'cover';
    } else if (options.fit === 'original') {
      objectFit = 'scale-down';
    }

    const objectPosition = options.alignment === 'top' ? 'center top' : 'center center';

    let transform = `rotate(${layout.effectiveRotationDeg}deg)`;
    if (layout.needsHorizontalFlip) {
      transform += ' scaleX(-1)';
    }

    return {
      pageContainer: {
        aspectRatio: `${pageWidthPt} / ${pageHeightPt}`,
        backgroundColor: options.backgroundColor || '#ffffff'
      },
      marginBox: {
        top: `${topPct}%`,
        right: `${rightPct}%`,
        bottom: `${bottomPct}%`,
        left: `${leftPct}%`
      },
      imageWrapper: {
        position: 'absolute',
        left: `${imgLeftPct}%`,
        top: `${imgTopPct}%`,
        width: `${imgWidthPct}%`,
        height: `${imgHeightPct}%`,
        overflow: 'hidden'
      },
      imageElement: {
        width: '100%',
        height: '100%',
        objectFit,
        objectPosition,
        transform
      }
    };
  }

  /**
   * Estimates total output PDF size in bytes based on input items and quality setting.
   */
  estimateTotalSize(items: JpgToPdfImageItem[], options: JpgToPdfOptions): number {
    let totalBytes = 0;
    for (const item of items) {
      const srcSize = item.sizeBytes;
      if (options.quality === 'original') {
        if (item.probe.format === 'jpeg') {
          // Direct lossless DCT embed: ~file size + 2KB PDF object overhead
          totalBytes += srcSize + 2048;
        } else {
          // Non-JPEG is re-encoded as JPEG 0.92: ~60-80% of uncompressed raw
          const rawBytes = item.probe.widthPx * item.probe.heightPx * 3;
          totalBytes += Math.min(srcSize, rawBytes * 0.15) + 2048;
        }
      } else if (options.quality === 'optimised') {
        // Downsample to 200 DPI and JPEG 0.85
        totalBytes += Math.min(srcSize * 0.6, 600 * 1024) + 2048;
      } else {
        // 'small': Downsample to 150 DPI and JPEG 0.70
        totalBytes += Math.min(srcSize * 0.35, 300 * 1024) + 2048;
      }
    }
    // PDF document dictionary and xref overhead
    return Math.round(totalBytes + items.length * 512 + 4096);
  }

  /**
   * Formats estimated bytes into a human-readable string (e.g., "≈ 3.4 MB").
   */
  formatEstimatedSize(bytes: number): string {
    if (bytes < 1024) return `≈ ${bytes} B`;
    if (bytes < 1024 * 1024) return `≈ ${(bytes / 1024).toFixed(0)} KB`;
    return `≈ ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resolveDpi(item: JpgToPdfImageItem, options: JpgToPdfOptions): number {
    if (item.probe.hasDpi && item.probe.dpiX >= 72 && item.probe.dpiX <= 600) {
      return item.probe.dpiX;
    }
    return options.dpiFallback || 96;
  }

  private resolveMarginPt(options: JpgToPdfOptions): number {
    switch (options.margin) {
      case 'none':
        return 0;
      case 'small':
        return 10 * MM_TO_PT; // 10 mm ≈ 28.35 pt
      case 'big':
        return 20 * MM_TO_PT; // 20 mm ≈ 56.69 pt
      case 'custom':
        return this.toPt(options.customMarginValue, options.customMarginUnit);
      default:
        return 0;
    }
  }

  private getStandardPageDimensionsPt(
    pageSize: PageSizeOption,
    options: JpgToPdfOptions
  ): { width: number; height: number } {
    switch (pageSize) {
      case 'a4':
        return { width: 210 * MM_TO_PT, height: 297 * MM_TO_PT }; // 595.28 x 841.89
      case 'a3':
        return { width: 297 * MM_TO_PT, height: 420 * MM_TO_PT }; // 841.89 x 1190.55
      case 'a5':
        return { width: 148 * MM_TO_PT, height: 210 * MM_TO_PT }; // 419.53 x 595.28
      case 'letter':
        return { width: 8.5 * INCH_TO_PT, height: 11 * INCH_TO_PT }; // 612 x 792
      case 'legal':
        return { width: 8.5 * INCH_TO_PT, height: 14 * INCH_TO_PT }; // 612 x 1008
      case 'tabloid':
        return { width: 11 * INCH_TO_PT, height: 17 * INCH_TO_PT }; // 792 x 1224
      case 'custom': {
        const w = Math.max(20 * MM_TO_PT, this.toPt(options.customPageWidth, options.customPageUnit));
        const h = Math.max(20 * MM_TO_PT, this.toPt(options.customPageHeight, options.customPageUnit));
        return { width: w, height: h };
      }
      default:
        return { width: 210 * MM_TO_PT, height: 297 * MM_TO_PT };
    }
  }

  private toPt(value: number, unit: MeasurementUnit): number {
    const val = isNaN(value) ? 0 : Math.max(0, value);
    switch (unit) {
      case 'mm':
        return val * MM_TO_PT;
      case 'in':
        return val * INCH_TO_PT;
      case 'pt':
        return val;
      default:
        return val * MM_TO_PT;
    }
  }

  private calculateEffectiveRotation(
    item: JpgToPdfImageItem,
    options: JpgToPdfOptions
  ): { effectiveRotationDeg: number; needsHorizontalFlip: boolean } {
    let exifDeg = 0;
    let needsHorizontalFlip = false;

    if (options.fixExifRotation && item.probe.exifOrientation > 1) {
      switch (item.probe.exifOrientation) {
        case 2:
          needsHorizontalFlip = true;
          break;
        case 3:
          exifDeg = 180;
          break;
        case 4:
          exifDeg = 180;
          needsHorizontalFlip = true;
          break;
        case 5:
          exifDeg = 90;
          needsHorizontalFlip = true;
          break;
        case 6:
          exifDeg = 90;
          break;
        case 7:
          exifDeg = 270;
          needsHorizontalFlip = true;
          break;
        case 8:
          exifDeg = 270;
          break;
      }
    }

    const manualDeg = item.manualRotationDeg || 0;
    const effectiveRotationDeg = (exifDeg + manualDeg) % 360;

    return { effectiveRotationDeg, needsHorizontalFlip };
  }
}

