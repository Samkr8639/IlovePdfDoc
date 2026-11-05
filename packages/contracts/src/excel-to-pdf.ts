// ============================================================
// Excel to PDF — Shared types & Zod schemas
// ============================================================

import { z } from 'zod';

export type ExcelToPdfOutput = 'pdf' | 'pdfa';
export type ExcelPageSize = 'as_file' | 'a4' | 'letter' | 'legal' | 'a3';
export type ExcelOrientation = 'as_file' | 'auto' | 'portrait' | 'landscape';
export type ExcelScalingMode = 'as_file' | 'fit_width' | 'fit_page' | 'custom';
export type ExcelMargins = 'as_file' | 'narrow' | 'normal' | 'wide';
export type PageSize = ExcelPageSize;
export type Orientation = ExcelOrientation;
export type ScalingMode = ExcelScalingMode;
export type Margins = ExcelMargins;
export type ExcelSheetSelectionMode = 'all' | 'first' | 'selected';

export interface ExcelSheetSelectionOptions {
  mode: ExcelSheetSelectionMode;
  names?: string[];
  includeHidden?: boolean;
}

export interface ExcelToPdfOptions {
  output?: ExcelToPdfOutput;
  sheets?: ExcelSheetSelectionOptions;
  pageSize?: ExcelPageSize;
  orientation?: ExcelOrientation;
  scaling?: ExcelScalingMode;
  customScale?: number; // 10 to 400
  margins?: ExcelMargins;
  gridlines?: boolean;
  headings?: boolean;
  repeatHeader?: boolean;
  pageNumbers?: boolean;
  bookmarks?: boolean;
  trimEmpty?: boolean;
  merge?: boolean;
}

export const excelSheetSelectionSchema = z.object({
  mode: z.enum(['all', 'first', 'selected']).default('all'),
  names: z.array(z.string().min(1).max(255)).optional(),
  includeHidden: z.boolean().default(false)
});

export const excelToPdfOptionsSchema = z.object({
  output: z.enum(['pdf', 'pdfa']).default('pdf'),
  sheets: excelSheetSelectionSchema.default({ mode: 'all', includeHidden: false }),
  pageSize: z.enum(['as_file', 'a4', 'letter', 'legal', 'a3']).default('as_file'),
  orientation: z.enum(['as_file', 'auto', 'portrait', 'landscape']).default('as_file'),
  scaling: z.enum(['as_file', 'fit_width', 'fit_page', 'custom']).default('as_file'),
  customScale: z.number().int().min(10).max(400).optional(),
  margins: z.enum(['as_file', 'narrow', 'normal', 'wide']).default('as_file'),
  gridlines: z.boolean().default(false),
  headings: z.boolean().default(false),
  repeatHeader: z.boolean().default(true),
  pageNumbers: z.boolean().default(false),
  bookmarks: z.boolean().default(true),
  trimEmpty: z.boolean().default(true),
  merge: z.boolean().default(false)
});

export interface ExcelSheetInfo {
  name: string;
  pages: number;
}

export interface ConvertedExcelFileItem {
  id: string;
  inputName: string;
  outputName: string;
  originalSizeBytes: number;
  pdfSizeBytes: number;
  formattedOriginalSize: string;
  formattedPdfSize: string;
  pageCount: number;
  sheets: ExcelSheetInfo[];
  downloadUrl: string;
  fontsSubstituted: Array<{ requested: string; used: string }>;
}

export interface ExcelToPdfJobResponse {
  jobId: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: number;
  expiresAt: number;
  totalFiles: number;
  isZip: boolean;
  downloadUrl: string;
  zipDownloadUrl?: string;
  filename: string;
  sizeBytes: number;
  files: ConvertedExcelFileItem[];
  warnings: string[];
}
