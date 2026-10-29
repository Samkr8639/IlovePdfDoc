import { z } from 'zod';

export type PdfToExcelMode = 'no_ocr' | 'ocr';
export type SheetLayout = 'sheet_per_table' | 'sheet_per_page' | 'single_sheet';
export type MultiFileOutput = 'separate_workbooks' | 'one_workbook';

export interface PdfToExcelOptions {
  mode: PdfToExcelMode;
  sheetLayout: SheetLayout;
  multiFileOutput: MultiFileOutput;
  pages?: string;
  detectTypes: boolean;
  keepFormatting: boolean;
  includeText: boolean;
  mergeAcrossPages: boolean;
}

export const PdfToExcelOptionsSchema = z.object({
  mode: z.enum(['no_ocr', 'ocr']).default('no_ocr'),
  sheetLayout: z.enum(['sheet_per_table', 'sheet_per_page', 'single_sheet']).default('sheet_per_table'),
  multiFileOutput: z.enum(['separate_workbooks', 'one_workbook']).default('separate_workbooks'),
  pages: z.string().optional(),
  detectTypes: z.boolean().default(true),
  keepFormatting: z.boolean().default(true),
  includeText: z.boolean().default(false),
  mergeAcrossPages: z.boolean().default(true)
});

export interface PdfToExcelTable {
  file: string;
  page: number;
  sheet: string;
  rows: number;
  cols: number;
  method: 'lattice' | 'stream' | 'ocr';
  confidence: number;
  preview: string[][]; // max 15 rows x 10 cols
}

export interface PdfToExcelTableFile {
  filename: string;
  sheets: number;
  tables: number;
  rows: number;
  cells: number;
  downloadUrl?: string;
  sizeBytes?: number;
  formattedSize?: string;
}

export interface PdfToExcelResponse {
  jobId: string;
  isZip: boolean;
  downloadUrl: string;
  filename: string;
  sizeBytes: number;
  formattedSize?: string;
  files: PdfToExcelTableFile[];
  tables: PdfToExcelTable[];
  warnings: string[];
}
