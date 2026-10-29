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

const booleanLike = (defaultValue: boolean) =>
  z.preprocess(val => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true' || val === '1') return true;
      if (val.toLowerCase() === 'false' || val === '0') return false;
    }
    return val;
  }, z.boolean()).default(defaultValue);

export const PdfToExcelOptionsSchema = z.object({
  mode: z.enum(['no_ocr', 'ocr']).default('no_ocr'),
  sheetLayout: z.enum(['sheet_per_table', 'sheet_per_page', 'single_sheet']).default('sheet_per_page'),
  multiFileOutput: z.enum(['separate_workbooks', 'one_workbook']).default('separate_workbooks'),
  pages: z.string().optional(),
  detectTypes: booleanLike(true),
  keepFormatting: booleanLike(true),
  includeText: booleanLike(true),
  mergeAcrossPages: booleanLike(true)
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
  coverage?: number;
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
  coverage?: number;
}
