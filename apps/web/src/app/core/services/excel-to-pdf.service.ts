import { Injectable, inject } from '@angular/core';
import {
  ExcelToPdfOptions,
  ExcelToPdfJobResponse,
  ConvertedExcelFileItem
} from '@paperflow/contracts';
import { environment } from '../../../environments/environment';
import { BrowserPdfService } from './browser-pdf.service';
import { getSpreadsheetSheetNames, SheetInfo } from './sheet-names';

export interface ValidatedExcelFile {
  id: string;
  file: File;
  name: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  sheets: SheetInfo[];
  isValid: boolean;
  error?: string;
}

export interface ConvertedExcelToPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  pageCount: number;
  originalSizeBytes: number;
  pdfSizeBytes: number;
  formattedOriginalSize: string;
  formattedPdfSize: string;
  isZip: boolean;
  files: ConvertedExcelFileItem[];
  warnings: string[];
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.ods', '.csv', '.tsv'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable({
  providedIn: 'root'
})
export class ExcelToPdfService {
  private pdfService = inject(BrowserPdfService);

  /**
   * Pre-validates an Excel / spreadsheet file client-side and extracts sheet names
   */
  async validateFile(file: File): Promise<ValidatedExcelFile> {
    const ext = (file.name.substring(file.name.lastIndexOf('.')) || '').toLowerCase();
    const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).substring(2, 9)}`;

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        id,
        file,
        name: file.name,
        extension: ext,
        sizeBytes: file.size,
        formattedSize: this.pdfService.formatBytes(file.size),
        sheets: [],
        isValid: false,
        error: `Unsupported file format '${ext}'. Please choose an Excel (.xlsx, .xlsm, .xls), OpenDocument (.ods), or delimited text (.csv, .tsv) file.`
      };
    }

    if (file.size === 0) {
      return {
        id,
        file,
        name: file.name,
        extension: ext,
        sizeBytes: file.size,
        formattedSize: this.pdfService.formatBytes(file.size),
        sheets: [],
        isValid: false,
        error: `File '${file.name}' is empty (0 bytes).`
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        id,
        file,
        name: file.name,
        extension: ext,
        sizeBytes: file.size,
        formattedSize: this.pdfService.formatBytes(file.size),
        sheets: [],
        isValid: false,
        error: `File '${file.name}' exceeds the maximum allowed size limit of 50 MB.`
      };
    }

    let sheets: SheetInfo[] = [];
    try {
      sheets = await getSpreadsheetSheetNames(file);
    } catch {
      sheets = [{ name: 'Sheet1', hidden: false }];
    }

    return {
      id,
      file,
      name: file.name,
      extension: ext,
      sizeBytes: file.size,
      formattedSize: this.pdfService.formatBytes(file.size),
      sheets,
      isValid: true
    };
  }

  /**
   * Sends spreadsheets to backend conversion API
   */
  async convertToPdf(
    files: ValidatedExcelFile[],
    options: ExcelToPdfOptions,
    onProgress?: (progress: number, message: string) => void,
    signal?: AbortSignal
  ): Promise<ConvertedExcelToPdfResult> {
    if (!files || files.length === 0) {
      throw new Error('No spreadsheet files selected for conversion.');
    }

    onProgress?.(10, 'Inspecting spreadsheet structures & sheets...');
    await new Promise(r => setTimeout(r, 120));

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    onProgress?.(25, 'Uploading spreadsheets to secure conversion engine...');

    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f.file);
    }
    formData.append('options', JSON.stringify(options));

    onProgress?.(50, 'Converting tables, applying page scaling & pagination...');

    const baseUrl = environment.apiBaseUrl || 'http://localhost:4000/api/v1';
    const response = await fetch(`${baseUrl}/excel-to-pdf/convert`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Conversion error (${response.status})`);
    }

    onProgress?.(80, 'Finalizing PDF layout and bookmarks...');

    const data = await response.json();
    const job: ExcelToPdfJobResponse = data.data;

    const host = baseUrl.replace(/\/api\/v1\/?$/, '');
    const downloadPath = job.downloadUrl || `/api/v1/excel-to-pdf/jobs/${job.jobId}/download`;
    const fullUrl = downloadPath.startsWith('http') ? downloadPath : `${host}${downloadPath}`;

    const fileRes = await fetch(fullUrl, { signal });
    if (!fileRes.ok) {
      throw new Error(`Failed to download converted document (${fileRes.status})`);
    }

    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);

    const firstItem = job.files[0];
    const totalOriginalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    onProgress?.(100, 'Conversion completed successfully!');

    return {
      blob,
      url,
      filename: job.filename || (job.isZip ? 'converted-spreadsheets.zip' : `${firstItem?.outputName || 'spreadsheet.pdf'}`),
      pageCount: firstItem?.pageCount || 1,
      originalSizeBytes: totalOriginalSize,
      pdfSizeBytes: blob.size,
      formattedOriginalSize: this.pdfService.formatBytes(totalOriginalSize),
      formattedPdfSize: this.pdfService.formatBytes(blob.size),
      isZip: job.isZip,
      files: job.files,
      warnings: job.warnings || []
    };
  }
}
