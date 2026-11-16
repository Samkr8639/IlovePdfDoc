/**
 * Watermark PDF Contracts & Models
 * Authoritative types, limits, and defaults for the Watermark PDF tool.
 */

export type WatermarkTab = 'text' | 'image';

export type WatermarkGridPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkLayer = 'over' | 'below';

export type WatermarkPageMode = 'all' | 'custom';

export type WatermarkPageFilterPreset = 'all' | 'odd' | 'even' | 'first' | 'last';

export type WatermarkMarginUnit = 'mm' | 'pt' | 'in';

export interface TextWatermarkConfig {
  text: string;
  fontFamily: string;
  fontSize: number | 'auto';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface ImageWatermarkConfig {
  imageDataUrl: string | null;
  imageWidthPx: number;
  imageHeightPx: number;
  widthPercent: number;
  useOriginalDpi: boolean;
  removeWhiteBg: boolean;
  tolerance: number;
}

export interface WatermarkCommonConfig {
  activeTab: WatermarkTab;
  position: WatermarkGridPosition;
  customXPercent: number; // 0 to 100
  customYPercent: number; // 0 to 100
  useCustomPosition: boolean;
  marginMm: number; // 0 to 100
  marginUnit: WatermarkMarginUnit;
  opacity: number; // 5 to 100
  rotation: number; // -180 to 180
  mosaic: boolean;
  horizontalGapMm: number; // 0 to 200
  verticalGapMm: number; // 0 to 200
  stagger: boolean;
  pageMode: WatermarkPageMode;
  customRange: string;
  filterPreset: WatermarkPageFilterPreset;
  layer: WatermarkLayer;
  markAsArtifact: boolean;
  optionalContentLayer: boolean;
}

export interface WatermarkFileSettings {
  textConfig: TextWatermarkConfig;
  imageConfig: ImageWatermarkConfig;
  common: WatermarkCommonConfig;
}

export interface WatermarkPreset {
  id: string;
  name: string;
  createdAt: number;
  settings: WatermarkFileSettings;
  imageDataUrl?: string | null;
}

export const WATERMARK_LIMITS = {
  desktopMaxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
  desktopMaxPages: 500,
  lowMemoryMaxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
  lowMemoryMaxPages: 200,
  maxFiles: 10,
  maxImageSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxImageDimensionPx: 5000,
  maxImageMegapixels: 25,
  maxTextLength: 500,
  maxMosaicTilesPerPage: 400,
  minFontSizePt: 6,
  maxFontSizePt: 400,
  defaultMosaicFontSizePt: 36
} as const;

export const WATERMARK_DEFAULT_SETTINGS: WatermarkFileSettings = {
  textConfig: {
    text: '',
    fontFamily: 'Noto Sans',
    fontSize: 'auto',
    bold: true,
    italic: false,
    underline: false,
    color: '#4B5563', // neutral grey token
    strokeColor: undefined,
    strokeWidth: 0
  },
  imageConfig: {
    imageDataUrl: null,
    imageWidthPx: 0,
    imageHeightPx: 0,
    widthPercent: 40,
    useOriginalDpi: false,
    removeWhiteBg: false,
    tolerance: 30
  },
  common: {
    activeTab: 'text',
    position: 'center',
    customXPercent: 50,
    customYPercent: 50,
    useCustomPosition: false,
    marginMm: 10,
    marginUnit: 'mm',
    opacity: 50,
    rotation: 45,
    mosaic: false,
    horizontalGapMm: 20,
    verticalGapMm: 20,
    stagger: true,
    pageMode: 'all',
    customRange: '',
    filterPreset: 'all',
    layer: 'over',
    markAsArtifact: true,
    optionalContentLayer: false
  }
};

export interface WatermarkExportWarning {
  type: 'pdfa' | 'pdfx' | 'signatures' | 'encrypted' | 'xfa' | 'cmyk' | 'opaque_pages' | 'clamped_pages' | 'unsupported_glyph';
  message: string;
  pages?: number[];
}

export interface WatermarkProcessResult {
  filename: string;
  pdfBytes: Uint8Array;
  totalPages: number;
  watermarkedPagesCount: number;
  warnings: WatermarkExportWarning[];
}
