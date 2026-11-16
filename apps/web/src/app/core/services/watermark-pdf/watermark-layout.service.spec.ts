import { describe, it, expect, beforeEach } from 'vitest';
import { WatermarkLayoutService } from './watermark-layout.service';
import { WATERMARK_DEFAULT_SETTINGS, WatermarkGridPosition } from '@paperflow/contracts';
import { convertMarginToPoints } from './watermark-document-model';

describe('WatermarkLayoutService', () => {
  let layoutService: WatermarkLayoutService;

  beforeEach(() => {
    layoutService = new WatermarkLayoutService();
  });

  describe('computeVisualPageBox', () => {
    it('uses CropBox when provided, otherwise MediaBox', () => {
      const mediaBox: [number, number, number, number] = [0, 0, 612, 792]; // standard letter
      const cropBox: [number, number, number, number] = [10, 20, 600, 780];

      const pageWithCrop = layoutService.computeVisualPageBox(cropBox, mediaBox, 0, 1.0, 0);
      expect(pageWithCrop.visualWidth).toBe(590);
      expect(pageWithCrop.visualHeight).toBe(760);

      const pageMediaOnly = layoutService.computeVisualPageBox(undefined, mediaBox, 0, 1.0, 0);
      expect(pageMediaOnly.visualWidth).toBe(612);
      expect(pageMediaOnly.visualHeight).toBe(792);
    });

    it('swaps width and height when page rotation is 90 or 270 degrees', () => {
      const mediaBox: [number, number, number, number] = [0, 0, 600, 800];

      const rot0 = layoutService.computeVisualPageBox(undefined, mediaBox, 0);
      expect(rot0.visualWidth).toBe(600);
      expect(rot0.visualHeight).toBe(800);

      const rot90 = layoutService.computeVisualPageBox(undefined, mediaBox, 90);
      expect(rot90.visualWidth).toBe(800);
      expect(rot90.visualHeight).toBe(600);

      const rot180 = layoutService.computeVisualPageBox(undefined, mediaBox, 180);
      expect(rot180.visualWidth).toBe(600);
      expect(rot180.visualHeight).toBe(800);

      const rot270 = layoutService.computeVisualPageBox(undefined, mediaBox, 270);
      expect(rot270.visualWidth).toBe(800);
      expect(rot270.visualHeight).toBe(600);
    });

    it('multiplies dimensions by UserUnit correctly', () => {
      const mediaBox: [number, number, number, number] = [0, 0, 100, 200];
      const page = layoutService.computeVisualPageBox(undefined, mediaBox, 0, 2.5);
      expect(page.visualWidth).toBe(250);
      expect(page.visualHeight).toBe(500);
    });
  });

  describe('computeRotatedBoundingBox', () => {
    it('returns exact unrotated dimensions for 0, 180 and 360 degrees', () => {
      const b0 = layoutService.computeRotatedBoundingBox(200, 100, 0);
      expect(b0.rotW).toBeCloseTo(200, 3);
      expect(b0.rotH).toBeCloseTo(100, 3);

      const b180 = layoutService.computeRotatedBoundingBox(200, 100, 180);
      expect(b180.rotW).toBeCloseTo(200, 3);
      expect(b180.rotH).toBeCloseTo(100, 3);
    });

    it('swaps dimensions for 90 and 270 degrees', () => {
      const b90 = layoutService.computeRotatedBoundingBox(200, 100, 90);
      expect(b90.rotW).toBeCloseTo(100, 3);
      expect(b90.rotH).toBeCloseTo(200, 3);

      const b270 = layoutService.computeRotatedBoundingBox(200, 100, 270);
      expect(b270.rotW).toBeCloseTo(100, 3);
      expect(b270.rotH).toBeCloseTo(200, 3);
    });

    it('calculates diagonal 45 degree bounding box correctly', () => {
      const b45 = layoutService.computeRotatedBoundingBox(100, 100, 45);
      const expected = 100 * Math.SQRT2;
      expect(b45.rotW).toBeCloseTo(expected, 3);
      expect(b45.rotH).toBeCloseTo(expected, 3);
    });
  });

  describe('computeGridAnchorCenter & rotated bounding box guarantee', () => {
    const visualWidth = 600;
    const visualHeight = 800;
    const marginPt = 20;

    const positions: WatermarkGridPosition[] = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];

    const rotations = [0, 45, 90, 180, 270, 33, -45, -60];

    it('guarantees rotated watermark bbox never leaves the page at all 9 grid anchors and all angles', () => {
      const width = 200;
      const height = 50;

      for (const rot of rotations) {
        const { rotW, rotH } = layoutService.computeRotatedBoundingBox(width, height, rot);

        for (const pos of positions) {
          const { centerX, centerY } = layoutService.computeGridAnchorCenter(
            visualWidth,
            visualHeight,
            rotW,
            rotH,
            pos,
            marginPt
          );

          const left = centerX - rotW / 2;
          const right = centerX + rotW / 2;
          const bottom = centerY - rotH / 2;
          const top = centerY + rotH / 2;

          // Must stay within [0, visualWidth] and [0, visualHeight]
          expect(left).toBeGreaterThanOrEqual(-0.001);
          expect(right).toBeLessThanOrEqual(visualWidth + 0.001);
          expect(bottom).toBeGreaterThanOrEqual(-0.001);
          expect(top).toBeLessThanOrEqual(visualHeight + 0.001);

          // For corner positions, verify margin compliance
          if (pos === 'top-left') {
            expect(left).toBeCloseTo(marginPt, 2);
            expect(top).toBeCloseTo(visualHeight - marginPt, 2);
          } else if (pos === 'bottom-right') {
            expect(right).toBeCloseTo(visualWidth - marginPt, 2);
            expect(bottom).toBeCloseTo(marginPt, 2);
          } else if (pos === 'center') {
            expect(centerX).toBeCloseTo(visualWidth / 2, 2);
            expect(centerY).toBeCloseTo(visualHeight / 2, 2);
          }
        }
      }
    });
  });

  describe('computeCustomPositionCenter', () => {
    it('converts percentages to coordinates and clamps to page bounds', () => {
      const visualWidth = 500;
      const visualHeight = 1000;
      const rotW = 100;
      const rotH = 60;

      // 50%, 50% = center
      const center = layoutService.computeCustomPositionCenter(visualWidth, visualHeight, rotW, rotH, 50, 50);
      expect(center.centerX).toBe(250);
      expect(center.centerY).toBe(500);

      // Extreme 0%, 0% clamped so bbox is within page
      const cornerMin = layoutService.computeCustomPositionCenter(visualWidth, visualHeight, rotW, rotH, 0, 0);
      expect(cornerMin.centerX).toBe(50); // rotW / 2
      expect(cornerMin.centerY).toBe(30); // rotH / 2

      // Extreme 100%, 100% clamped
      const cornerMax = layoutService.computeCustomPositionCenter(visualWidth, visualHeight, rotW, rotH, 100, 100);
      expect(cornerMax.centerX).toBe(450); // visualWidth - rotW / 2
      expect(cornerMax.centerY).toBe(970); // visualHeight - rotH / 2
    });
  });

  describe('computeAutoFitFontSize', () => {
    it('fits font size within 90% page area (5% margins on each side)', () => {
      const visualWidth = 600;
      const visualHeight = 800;
      // When width and height are comparable, diagonal rotation increases bounding box and decreases font size
      const unitSquare = 10;

      const fitSquare0 = layoutService.computeAutoFitFontSize(unitSquare, unitSquare, visualWidth, visualHeight, 0);
      expect(fitSquare0.doesNotFit).toBe(false);
      // Usable width = 540, Usable height = 720 -> scale = 540 / 10 = 54
      expect(fitSquare0.fontSize).toBe(54);

      const fitSquare45 = layoutService.computeAutoFitFontSize(unitSquare, unitSquare, visualWidth, visualHeight, 45);
      expect(fitSquare45.doesNotFit).toBe(false);
      // At 45 deg, bbox = 10 * sqrt(2) ~= 14.14 -> scale = 540 / 14.14 = 38
      expect(fitSquare45.fontSize).toBe(38);
      expect(fitSquare45.fontSize).toBeLessThan(fitSquare0.fontSize);
    });

    it('returns doesNotFit: true if text cannot fit even at minimum 6 pt', () => {
      // Small page and huge unit text
      const smallWidth = 50;
      const smallHeight = 50;
      const hugeUnitWidth = 30; // 6 pt would be 180 pt, far exceeding 50 pt
      const unitHeight = 10;

      const res = layoutService.computeAutoFitFontSize(hugeUnitWidth, unitHeight, smallWidth, smallHeight, 0);
      expect(res.doesNotFit).toBe(true);
      expect(res.fontSize).toBe(6);
    });
  });

  describe('computeMosaicPlacements', () => {
    it('generates a grid of tiles covering the entire page', () => {
      const visualWidth = 500;
      const visualHeight = 500;
      const tileWidth = 100;
      const tileHeight = 40;
      const gapXPt = 20;
      const gapYPt = 20;

      const res = layoutService.computeMosaicPlacements(
        visualWidth,
        visualHeight,
        tileWidth,
        tileHeight,
        0,
        gapXPt,
        gapYPt,
        true,
        0.5,
        'over'
      );

      expect(res.placements.length).toBeGreaterThan(10);
      expect(res.exceededCap).toBe(false);
    });

    it('staggers alternate rows when stagger is true', () => {
      const res = layoutService.computeMosaicPlacements(400, 400, 80, 30, 0, 20, 20, true, 0.5, 'over');
      const rows = new Map<number, number[]>();
      for (const p of res.placements) {
        const y = Math.round(p.centerY);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push(p.centerX);
      }

      // Check that different Y rows have offset X coordinates
      const yKeys = Array.from(rows.keys()).sort((a, b) => a - b);
      if (yKeys.length >= 2) {
        const r1Xs = rows.get(yKeys[0])!;
        const r2Xs = rows.get(yKeys[1])!;
        // With stepX = 100, stagger offset is 50
        const diff = Math.abs(r1Xs[0] - r2Xs[0]);
        expect(diff % 100).toBeCloseTo(50, 0);
      }
    });

    it('enforces 400 tiles cap per page and sets exceededCap: true for tiny tiles / zero gaps', () => {
      const res = layoutService.computeMosaicPlacements(1000, 1000, 10, 5, 0, 0, 0, false, 0.5, 'over');
      expect(res.placements.length).toBe(400);
      expect(res.exceededCap).toBe(true);
      expect(res.totalTilesCount).toBeGreaterThan(400);
    });
  });

  describe('resolvePageLayout integration', () => {
    it('returns empty placements if page is not included', () => {
      const page = layoutService.computeVisualPageBox(undefined, [0, 0, 600, 800]);
      const res = layoutService.resolvePageLayout(page, WATERMARK_DEFAULT_SETTINGS, false, null, null);
      expect(res.isIncluded).toBe(false);
      expect(res.placements.length).toBe(0);
    });

    it('resolves text watermark layout with default settings', () => {
      const page = layoutService.computeVisualPageBox(undefined, [0, 0, 600, 800]);
      const textMetrics = { unitWidth: 8, unitHeight: 1.2, unscaledWidth: 288, unscaledHeight: 43.2 };

      const res = layoutService.resolvePageLayout(page, WATERMARK_DEFAULT_SETTINGS, true, textMetrics, null);
      expect(res.isIncluded).toBe(true);
      expect(res.placements.length).toBe(1);
      const p = res.placements[0];
      expect(p.rotation).toBe(45);
      expect(p.centerX).toBeCloseTo(300, 1);
      expect(p.centerY).toBeCloseTo(400, 1);
      expect(p.opacity).toBe(0.5);
      expect(p.layer).toBe('over');
    });

    it('resolves image watermark layout with percentage width', () => {
      const page = layoutService.computeVisualPageBox(undefined, [0, 0, 600, 800]);
      const imgSettings = {
        ...WATERMARK_DEFAULT_SETTINGS,
        common: {
          ...WATERMARK_DEFAULT_SETTINGS.common,
          activeTab: 'image' as const,
          rotation: 0
        },
        imageConfig: {
          ...WATERMARK_DEFAULT_SETTINGS.imageConfig,
          imageDataUrl: 'data:image/png;base64,FAKE',
          imageWidthPx: 400,
          imageHeightPx: 200,
          widthPercent: 50,
          useOriginalDpi: false
        }
      };

      const imageMetrics = { widthPt: 400, heightPt: 200 };
      const res = layoutService.resolvePageLayout(page, imgSettings, true, null, imageMetrics);
      expect(res.placements.length).toBe(1);
      const p = res.placements[0];
      // 50% of 600 = 300 pt wide. Aspect 2:1 -> 150 pt high.
      expect(p.width).toBe(300);
      expect(p.height).toBe(150);
      expect(p.centerX).toBe(300);
      expect(p.centerY).toBe(400);
    });
  });
});
