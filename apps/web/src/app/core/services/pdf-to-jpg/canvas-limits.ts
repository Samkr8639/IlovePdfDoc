/**
 * Canvas memory and dimension limit detection to prevent browser crashes on huge pages or mobile devices.
 */

export interface SafeDpiResult {
  safeDpi: number;
  isReduced: boolean;
  originalDpi: number;
  widthPx: number;
  heightPx: number;
  warning?: string;
}

// Known browser limits:
// iOS Safari canvas max area: 16.7M pixels (4096 x 4096)
// Chromium max area: 268M pixels (16384 x 16384)
// Firefox max area: 472M pixels
// Max single dimension for canvas in browsers: typically 16,384px or 32,767px
// Max JPEG standard dimension: 65,535px
const SAFE_DESKTOP_MAX_AREA = 100_000_000; // 100M pixels (very generous, safe for 600 DPI A4)
const SAFE_MOBILE_MAX_AREA = 16_777_216; // 16.7M pixels (iOS limit)
const MAX_CANVAS_DIMENSION = 16_384;
const MAX_JPEG_DIMENSION = 65_535;

/**
 * Detects whether the current device is mobile/tablet with restricted canvas memory.
 */
export function isMobileOrRestrictedEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return isIos || isAndroid;
}

/**
 * Returns the maximum safe canvas area in pixels for the current browser/device.
 */
export function getMaxSafeCanvasArea(): number {
  if (isMobileOrRestrictedEnvironment()) {
    return SAFE_MOBILE_MAX_AREA;
  }
  return SAFE_DESKTOP_MAX_AREA;
}

/**
 * Calculates the safe rendering DPI for a given page dimension so that the resulting
 * pixel canvas does not exceed safe browser memory limits or canvas size limits.
 */
export function calculateSafeRenderDpi(
  widthPt: number,
  heightPt: number,
  requestedDpi: number
): SafeDpiResult {
  const maxArea = getMaxSafeCanvasArea();
  let currentDpi = Math.max(36, requestedDpi);

  let widthPx = Math.round((widthPt * currentDpi) / 72);
  let heightPx = Math.round((heightPt * currentDpi) / 72);

  // Check if exceeds dimension or area limits
  const exceedsDimension = widthPx > MAX_CANVAS_DIMENSION || heightPx > MAX_CANVAS_DIMENSION;
  const exceedsArea = widthPx * heightPx > maxArea;

  if (!exceedsDimension && !exceedsArea) {
    return {
      safeDpi: currentDpi,
      isReduced: false,
      originalDpi: requestedDpi,
      widthPx,
      heightPx
    };
  }

  // Reduce DPI to fit within limits
  let scaleFactor = 1.0;
  if (exceedsDimension) {
    const maxDim = Math.max(widthPx, heightPx);
    scaleFactor = Math.min(scaleFactor, (MAX_CANVAS_DIMENSION - 64) / maxDim);
  }
  if (widthPx * heightPx * scaleFactor * scaleFactor > maxArea) {
    scaleFactor = Math.min(scaleFactor, Math.sqrt((maxArea * 0.95) / (widthPx * heightPx)));
  }

  const safeDpi = Math.max(36, Math.floor(currentDpi * scaleFactor));
  widthPx = Math.round((widthPt * safeDpi) / 72);
  heightPx = Math.round((heightPt * safeDpi) / 72);

  return {
    safeDpi,
    isReduced: true,
    originalDpi: requestedDpi,
    widthPx,
    heightPx,
    warning: `Resolution adjusted from ${requestedDpi} DPI to ${safeDpi} DPI due to device canvas limits.`
  };
}

/**
 * Checks if combining multiple page heights exceeds the JPEG 65,535px dimension limit.
 */
export function checkCombinedHeightLimit(
  totalHeightPx: number,
  maxWidthPx: number
): { safe: boolean; maxAllowedHeight: number; exceedsByPx: number } {
  const safe = totalHeightPx <= MAX_JPEG_DIMENSION && maxWidthPx <= MAX_CANVAS_DIMENSION;
  return {
    safe,
    maxAllowedHeight: MAX_JPEG_DIMENSION,
    exceedsByPx: Math.max(0, totalHeightPx - MAX_JPEG_DIMENSION)
  };
}
