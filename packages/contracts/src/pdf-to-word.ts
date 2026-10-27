export type PdfToWordMode = 'no_ocr' | 'ocr';

export interface PdfToWordOptions {
  mode: PdfToWordMode;
  ocrLanguage?: string;
}

export interface PdfPageAnalysis {
  pageNumber: number;
  hasText: boolean;
  charCount: number;
  wordCount: number;
  isScanned: boolean;
}

export interface PdfDocumentAnalysis {
  totalPages: number;
  digitalPages: number;
  scannedPages: number;
  isFullyScanned: boolean;
  isMixed: boolean;
  detectedTextSummary: string;
  pages: PdfPageAnalysis[];
}

export interface ConvertedWordFileItem {
  id: string;
  originalFilename: string;
  wordFilename: string;
  originalSizeBytes: number;
  wordSizeBytes: number;
  formattedOriginalSize: string;
  formattedWordSize: string;
  pageCount: number;
  modeUsed: PdfToWordMode;
  downloadUrl: string;
}

export interface PdfToWordJobResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: number;
  expiresAt: number;
  mode: PdfToWordMode;
  totalFiles: number;
  files: ConvertedWordFileItem[];
  isZip: boolean;
  zipDownloadUrl?: string;
}
