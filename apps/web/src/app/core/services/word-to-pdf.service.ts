import { Injectable, inject } from '@angular/core';
import {
  WordToPdfOptions,
  WordToPdfJobResponse,
  ConvertedPdfFileItem
} from '@paperflow/contracts';
import { environment } from '../../../environments/environment';
import { BrowserPdfService, MergeResult } from './browser-pdf.service';

export interface ValidatedWordFile {
  id: string;
  file: File;
  name: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  isValid: boolean;
  error?: string;
}

export interface ConvertedWordToPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  pageCount: number;
  originalSizeBytes: number;
  pdfSizeBytes: number;
  formattedOriginalSize: string;
  formattedPdfSize: string;
  isZip: boolean;
  files: ConvertedPdfFileItem[];
  warnings: string[];
}

const SUPPORTED_EXTENSIONS = ['.doc', '.docx', '.odt', '.rtf'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable({
  providedIn: 'root'
})
export class WordToPdfService {
  private pdfService = inject(BrowserPdfService);

  /**
   * Pre-validates a single Word document file client-side
   */
  async validateFile(file: File): Promise<ValidatedWordFile> {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).substring(2, 9)}`;

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        id,
        file,
        name: file.name,
        extension: ext,
        sizeBytes: file.size,
        formattedSize: this.pdfService.formatBytes(file.size),
        isValid: false,
        error: `Unsupported file format '${ext}'. Please choose a .doc, .docx, .odt, or .rtf document.`
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
        isValid: false,
        error: `File '${file.name}' exceeds the maximum allowed size limit of 50 MB.`
      };
    }

    return {
      id,
      file,
      name: file.name,
      extension: ext,
      sizeBytes: file.size,
      formattedSize: this.pdfService.formatBytes(file.size),
      isValid: true
    };
  }

  /**
   * Sends Word files to backend conversion API
   */
  async convertToPdf(
    files: ValidatedWordFile[],
    options: WordToPdfOptions,
    onProgress?: (progress: number, message: string) => void,
    signal?: AbortSignal
  ): Promise<ConvertedWordToPdfResult> {
    if (!files || files.length === 0) {
      throw new Error('No Word documents selected for conversion.');
    }

    onProgress?.(15, 'Validating document structures...');
    await new Promise(r => setTimeout(r, 150));

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    onProgress?.(30, 'Uploading files to conversion engine...');

    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f.file);
    }
    formData.append('options', JSON.stringify(options));

    onProgress?.(55, 'Converting documents with high-fidelity formatting...');

    const baseUrl = environment.apiBaseUrl || 'http://localhost:4000/api/v1';
    const response = await fetch(`${baseUrl}/word-to-pdf/convert`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Conversion error (${response.status})`);
    }

    onProgress?.(80, 'Preparing PDF output for download...');

    const data = await response.json();
    const job: WordToPdfJobResponse = data.data;

    const host = baseUrl.replace(/\/api\/v1\/?$/, '');
    const downloadPath = job.isZip
      ? job.zipDownloadUrl || `/api/v1/word-to-pdf/jobs/${job.id}/download`
      : job.files[0]?.downloadUrl || `/api/v1/word-to-pdf/jobs/${job.id}/download`;

    const fullUrl = downloadPath.startsWith('http') ? downloadPath : `${host}${downloadPath}`;
    const fileRes = await fetch(fullUrl, { signal });

    if (!fileRes.ok) {
      throw new Error(`Failed to download converted PDF (${fileRes.status})`);
    }

    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);

    const firstItem = job.files[0];
    const totalOriginalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    onProgress?.(100, 'Conversion completed successfully!');

    return {
      blob,
      url,
      filename: job.isZip
        ? 'converted_pdfs.zip'
        : (firstItem?.pdfFilename || 'converted_document.pdf'),
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
