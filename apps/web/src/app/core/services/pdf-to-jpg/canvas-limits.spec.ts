import { describe, it, expect } from 'vitest';
import { calculateSafeRenderDpi, checkCombinedHeightLimit } from './canvas-limits';

describe('canvas-limits', () => {
  it('returns requested DPI for standard A4 page at 150 DPI', () => {
    // A4 is 595 x 842 pt
    const res = calculateSafeRenderDpi(595, 842, 150);
    expect(res.isReduced).toBe(false);
    expect(res.safeDpi).toBe(150);
    expect(res.widthPx).toBe(Math.round((595 * 150) / 72));
    expect(res.heightPx).toBe(Math.round((842 * 150) / 72));
    expect(res.warning).toBeUndefined();
  });

  it('clamps DPI gracefully when page dimensions exceed maximum canvas limits', () => {
    // Huge architectural drawing (e.g. 5000 x 5000 pt at 600 DPI = 41666 x 41666 px!)
    const res = calculateSafeRenderDpi(5000, 5000, 600);
    expect(res.isReduced).toBe(true);
    expect(res.safeDpi).toBeLessThan(600);
    expect(res.widthPx).toBeLessThanOrEqual(16384);
    expect(res.heightPx).toBeLessThanOrEqual(16384);
    expect(res.warning).toContain('Resolution adjusted');
  });

  it('detects when combined page height exceeds JPEG 65535px dimension limit', () => {
    const normal = checkCombinedHeightLimit(10000, 2000);
    expect(normal.safe).toBe(true);

    const exceeded = checkCombinedHeightLimit(70000, 2000);
    expect(exceeded.safe).toBe(false);
    expect(exceeded.exceedsByPx).toBe(70000 - 65535);
  });
});

