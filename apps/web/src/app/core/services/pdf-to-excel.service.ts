import { Injectable, inject } from '@angular/core';
import {
  PdfToExcelMode,
  SheetLayout,
  MultiFileOutput,
  PdfToExcelOptions,
  PdfDocumentAnalysis,
  PdfToExcelResponse,
  PdfToExcelTable,
  PdfToExcelTableFile
} from '@paperflow/contracts';
import { BrowserPdfService, ValidatedPdfFile } from './browser-pdf.service';
import { environment } from '../../../environments/environment';

export interface ConvertedExcelResult {
  blob: Blob;
  url: string;
  filename: string;
  isZip: boolean;
  originalSizeBytes: number;
  excelSizeBytes: number;
  formattedOriginalSize: string;
  formattedSize: string;
  sheetCount: number;
  tableCount: number;
  rowCount: number;
  cellCount: number;
  files: PdfToExcelTableFile[];
  tables: PdfToExcelTable[];
  warnings: string[];
  modeUsed: PdfToExcelMode;
}

@Injectable({
  providedIn: 'root'
})
export class PdfToExcelService {
  private pdfService = inject(BrowserPdfService);

  /**
   * Validates a single PDF file for Excel conversion
   */
  async validatePdf(file: File): Promise<ValidatedPdfFile> {
    return this.pdfService.validatePdf(file);
  }

  /**
   * Inspects PDF content to determine if it contains extractable text or is a scanned document
   */
  async analyzePdf(file: File): Promise<PdfDocumentAnalysis> {
    return this.pdfService.analyzePdf(file);
  }

  /**
   * Checks if OCR processing is enabled in current environment
   */
  isOcrAvailable(): boolean {
    return (environment as { ocrEnabled?: boolean }).ocrEnabled !== false;
  }

  /**
   * Converts one or more PDF files into Excel (.xlsx) or a ZIP of workbooks
   */
  async convertToExcel(
    files: ValidatedPdfFile[],
    options: PdfToExcelOptions,
    onProgress?: (progress: number, message: string) => void,
    signal?: AbortSignal
  ): Promise<ConvertedExcelResult> {
    if (!files || files.length === 0) {
      throw new Error('No PDF files selected for conversion.');
    }

    onProgress?.(15, 'Validating document structures...');
    await new Promise(r => setTimeout(r, 100));

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    onProgress?.(30, 'Uploading files to Excel conversion engine...');

    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f.file);
    }
    formData.append('mode', options.mode);
    formData.append('sheetLayout', options.sheetLayout);
    formData.append('multiFileOutput', options.multiFileOutput);
    if (options.pages) {
      formData.append('pages', options.pages);
    }
    formData.append('detectTypes', String(options.detectTypes));
    formData.append('keepFormatting', String(options.keepFormatting));
    formData.append('includeText', String(options.includeText));
    formData.append('mergeAcrossPages', String(options.mergeAcrossPages));

    onProgress?.(
      50,
      options.mode === 'ocr'
        ? 'Running OCR optical table and text recognition...'
        : 'Detecting ruled & borderless tables, inferring cell types...'
    );

    const baseUrl = environment.apiBaseUrl || 'http://localhost:4000/api/v1';
    const response = await fetch(`${baseUrl}/pdf-to-excel/convert`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Conversion API error (${response.status})`);
    }

    onProgress?.(80, 'Generating Excel (.xlsx) workbook and formatting...');

    const data = await response.json();
    const job: PdfToExcelResponse = data.data;

    const host = baseUrl.replace(/\/api\/v1\/?$/, '');
    const downloadPath = job.downloadUrl.startsWith('http') ? job.downloadUrl : `${host}${job.downloadUrl}`;

    const fileRes = await fetch(downloadPath, { signal });
    if (!fileRes.ok) {
      throw new Error(`Failed to download converted Excel workbook (${fileRes.status})`);
    }

    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);

    const originalSize = files.reduce((acc, f) => acc + (f.sizeBytes || f.file.size), 0);
    const excelSize = blob.size;

    let totalSheets = 0;
    let totalTables = 0;
    let totalRows = 0;
    let totalCells = 0;

    for (const f of job.files || []) {
      totalSheets += f.sheets || 0;
      totalTables += f.tables || 0;
      totalRows += f.rows || 0;
      totalCells += f.cells || 0;
    }

    onProgress?.(100, 'Conversion completed successfully!');

    return {
      blob,
      url,
      filename: job.filename || (job.isZip ? 'converted_excel_workbooks.zip' : 'workbook.xlsx'),
      isZip: job.isZip,
      originalSizeBytes: originalSize,
      excelSizeBytes: excelSize,
      formattedOriginalSize: this.pdfService.formatBytes(originalSize),
      formattedSize: this.pdfService.formatBytes(excelSize),
      sheetCount: totalSheets || 1,
      tableCount: totalTables || job.tables?.length || 0,
      rowCount: totalRows,
      cellCount: totalCells,
      files: job.files || [],
      tables: job.tables || [],
      warnings: job.warnings || [],
      modeUsed: options.mode
    };
  }
}
