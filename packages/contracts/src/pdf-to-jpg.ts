import { z } from 'zod';

export type PdfToJpgMode = 'convert_pages' | 'extract_images';

export type PdfToJpgQualityPreset = 'low' | 'medium' | 'high' | 'maximum' | 'custom';

export type PdfToJpgDpiPreset = 72 | 96 | 150 | 200 | 300 | 600 | 'custom';

export interface ConvertPagesOptions {
  pagesMode: 'all' | 'range';
  pageRange?: string;
  dpi: number;
  quality: number; // 0.40 - 1.00
  backgroundColor: string; // e.g. '#FFFFFF'
  arrangement: 'separate' | 'combined';
  includeAnnotations: boolean;
  embedDpi: boolean;
  grayscale: boolean;
}

export interface ExtractImagesOptions {
  minWidth: number;
  minHeight: number;
  keepOriginalJpegs: boolean;
  skipDuplicates: boolean;
  includeMasks: boolean;
  quality: number; // 0.40 - 1.00
  backgroundColor: string;
}

export interface PdfToJpgOptions {
  mode: PdfToJpgMode;
  convertPages: ConvertPagesOptions;
  extractImages: ExtractImagesOptions;
}

export interface ExtractedImageItem {
  id: string;
  filename: string;
  pageNumber: number;
  indexOnPage: number;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: 'image/jpeg';
  blob: Blob;
  previewUrl: string;
  usedOnPages: number[];
  isLossless: boolean;
  colorSpace?: string;
}

export interface ConvertedPageItem {
  pageNumber: number;
  filename: string;
  width: number;
  height: number;
  dpi: number;
  sizeBytes: number;
  blob: Blob;
  previewUrl: string;
  warning?: string;
}

export interface PdfToJpgConversionResult {
  jobId: string;
  mode: PdfToJpgMode;
  inputFilename: string;
  originalSizeBytes: number;
  pages: ConvertedPageItem[];
  images: ExtractedImageItem[];
  zipBlob?: Blob;
  zipFilename?: string;
  totalOutputSizeBytes: number;
  isSingleImage: boolean;
  singleImageBlob?: Blob;
  singleImageFilename?: string;
  singleImagePreviewUrl?: string;
  warnings: string[];
  processingTimeMs: number;
}

// Zod Schemas for Options validation
export const ConvertPagesOptionsSchema = z.object({
  pagesMode: z.enum(['all', 'range']).default('all'),
  pageRange: z.string().optional(),
  dpi: z.number().min(36).max(1200).default(150),
  quality: z.number().min(0.4).max(1.0).default(0.9),
  backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#FFFFFF'),
  arrangement: z.enum(['separate', 'combined']).default('separate'),
  includeAnnotations: z.boolean().default(true),
  embedDpi: z.boolean().default(true),
  grayscale: z.boolean().default(false)
});

export const ExtractImagesOptionsSchema = z.object({
  minWidth: z.number().min(0).max(1000).default(100),
  minHeight: z.number().min(0).max(1000).default(100),
  keepOriginalJpegs: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  includeMasks: z.boolean().default(false),
  quality: z.number().min(0.4).max(1.0).default(0.9),
  backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#FFFFFF')
});

export const PdfToJpgOptionsSchema = z.object({
  mode: z.enum(['convert_pages', 'extract_images']).default('convert_pages'),
  convertPages: ConvertPagesOptionsSchema,
  extractImages: ExtractImagesOptionsSchema
});

