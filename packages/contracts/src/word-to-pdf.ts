// ============================================================
// Word to PDF — Shared types & Zod schemas
// ============================================================

export type WordToPdfOutput = 'pdf' | 'pdfa';
export type WordToPdfImageQuality = 'standard' | 'smaller';

export interface WordToPdfOptions {
  output?: WordToPdfOutput;
  imageQuality?: WordToPdfImageQuality;
  embedBookmarks?: boolean;
  useTaggedPdf?: boolean;
  exportHyperlinks?: boolean;
}

export interface ConvertedPdfFileItem {
  id: string;
  originalFilename: string;
  pdfFilename: string;
  originalSizeBytes: number;
  pdfSizeBytes: number;
  formattedOriginalSize: string;
  formattedPdfSize: string;
  pageCount: number;
  downloadUrl: string;
  fontsSubstituted?: string[];
}

export interface WordToPdfJobResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: number;
  expiresAt: number;
  totalFiles: number;
  files: ConvertedPdfFileItem[];
  isZip: boolean;
  zipDownloadUrl?: string;
  warnings: string[];
}

