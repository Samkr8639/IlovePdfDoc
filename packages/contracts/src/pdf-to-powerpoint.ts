import { z } from 'zod';

export type PdfToPowerPointMode = 'no_ocr' | 'ocr';
export type PdfToPowerPointSlideSize = 'match_pdf' | 'widescreen_16_9';

export interface PdfToPowerPointOptions {
  mode: PdfToPowerPointMode;
  slideSize?: PdfToPowerPointSlideSize;
  ocrLanguage?: string;
}

export const PdfToPowerPointOptionsSchema = z.object({
  mode: z.enum(['no_ocr', 'ocr']).default('no_ocr'),
  slideSize: z.enum(['match_pdf', 'widescreen_16_9']).default('match_pdf'),
  ocrLanguage: z.string().optional().default('eng')
});

export interface ConvertedPowerPointFileItem {
  id: string;
  originalFilename: string;
  powerpointFilename: string;
  originalSizeBytes: number;
  powerpointSizeBytes: number;
  formattedOriginalSize: string;
  formattedPowerpointSize: string;
  slideCount: number;
  modeUsed: PdfToPowerPointMode;
  slideSizeUsed: PdfToPowerPointSlideSize;
  downloadUrl: string;
  warnings: string[];
}

export interface PdfToPowerPointJobResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: number;
  expiresAt: number;
  mode: PdfToPowerPointMode;
  slideSize: PdfToPowerPointSlideSize;
  totalFiles: number;
  files: ConvertedPowerPointFileItem[];
  isZip: boolean;
  zipDownloadUrl?: string;
  warnings: string[];
}
