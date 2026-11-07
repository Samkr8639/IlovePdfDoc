export type PageOrientationOption = 'auto' | 'portrait' | 'landscape';

export type PageSizeOption =
  | 'same-as-image'
  | 'a4'
  | 'a3'
  | 'a5'
  | 'letter'
  | 'legal'
  | 'tabloid'
  | 'custom';

export type MarginOption = 'none' | 'small' | 'big' | 'custom';

export type MeasurementUnit = 'mm' | 'in' | 'pt';

export type ImageFitOption = 'fit' | 'fill' | 'original';

export type ImageAlignmentOption = 'center' | 'top';

export type ImageQualityOption = 'original' | 'optimised' | 'small';

export type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp';

export interface ImageProbeResult {
  isValid: boolean;
  format?: SupportedImageFormat;
  mimeType?: string;
  widthPx: number;
  heightPx: number;
  dpiX: number;
  dpiY: number;
  hasDpi: boolean;
  exifOrientation: number; // 1 to 8 (1 is normal)
  colorComponents?: number; // 1 = gray, 3 = RGB/YCbCr, 4 = CMYK/YCCK
  isCmyk?: boolean;
  isAdobeYcck?: boolean;
  hasAlpha?: boolean;
  isAnimated?: boolean;
  hasIccProfile?: boolean;
  error?: string;
  megapixels: number;
}

export interface JpgToPdfImageItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  thumbnailUrl: string;
  probe: ImageProbeResult;
  manualRotationDeg: number; // 0, 90, 180, 270
}

export interface JpgToPdfOptions {
  orientation: PageOrientationOption;
  pageSize: PageSizeOption;
  customPageWidth: number;
  customPageHeight: number;
  customPageUnit: MeasurementUnit;
  margin: MarginOption;
  customMarginValue: number;
  customMarginUnit: MeasurementUnit;
  fit: ImageFitOption;
  alignment: ImageAlignmentOption;
  quality: ImageQualityOption;
  backgroundColor: string; // e.g. '#ffffff'
  mergeAll: boolean;
  removeExif: boolean;
  addPageNumbers: boolean;
  fixExifRotation: boolean;
  pdfTitle: string;
  pdfAuthor: string;
  dpiFallback: 72 | 96 | 150;
}

export interface ComputedPageLayout {
  pageWidthPt: number;
  pageHeightPt: number;
  isLandscape: boolean;
  marginLeftPt: number;
  marginRightPt: number;
  marginTopPt: number;
  marginBottomPt: number;
  contentBoxWidthPt: number;
  contentBoxHeightPt: number;
  // Position and dimension of image on the page
  drawXPt: number;
  drawYPt: number;
  drawWidthPt: number;
  drawHeightPt: number;
  // If fill mode requires clipping:
  isClipped: boolean;
  clipXPt?: number;
  clipYPt?: number;
  clipWidthPt?: number;
  clipHeightPt?: number;
  // Source crop or scale
  effectiveRotationDeg: number;
  needsHorizontalFlip: boolean;
  clampedDueToPdfLimit: boolean;
}

export interface JpgToPdfProgress {
  current: number;
  total: number;
  percent: number;
  message: string;
}

export interface JpgToPdfBuildResult {
  blob: Blob;
  downloadFilename: string;
  isZip: boolean;
  pageCount: number;
  failedCount: number;
  warnings: Array<{ fileName: string; reason: string }>;
  outputSizeBytes: number;
  durationMs: number;
}
