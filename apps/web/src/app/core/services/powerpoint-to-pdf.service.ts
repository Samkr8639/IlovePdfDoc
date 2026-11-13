import { Injectable, inject } from '@angular/core';
import {
  PowerPointToPdfOptions,
  PowerPointToPdfResponse,
  PowerPointToPdfFileItem
} from '@paperflow/contracts';
import { environment } from '../../../environments/environment';
import { BrowserPdfService } from './browser-pdf.service';
import { getDeckInfo, DeckInfo, revokeDeckThumbnail } from './deck-info';

export interface ValidatedPowerPointFile {
  id: string;
  file: File;
  name: string;
  extension: string;
  sizeBytes: number;
  formattedSize: string;
  deckInfo: DeckInfo;
  isValid: boolean;
  error?: string;
}

export interface ConvertedPowerPointToPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  pageCount: number;
  originalSizeBytes: number;
  pdfSizeBytes: number;
  formattedOriginalSize: string;
  formattedPdfSize: string;
  isZip: boolean;
  files: PowerPointToPdfFileItem[];
  warnings: string[];
}

const SUPPORTED_EXTENSIONS = ['.pptx', '.ppt', '.ppsx', '.pps', '.pptm', '.odp'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

@Injectable({
  providedIn: 'root'
})
export class PowerPointToPdfService {
  private pdfService = inject(BrowserPdfService);

  /**
   * Pre-validates a presentation file client-side and inspects slide count / thumbnail
   */
  async validateFile(file: File): Promise<ValidatedPowerPointFile> {
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
        deckInfo: { hiddenSlideCount: 0 },
        isValid: false,
        error: `Unsupported file type '${ext}'. Only PPTX, PPT, PPSX, PPS, PPTM, and ODP presentations are supported.`
      };
    }

    if (file.size === 0) {
      return {
        id,
        file,
        name: file.name,
        extension: ext,
        sizeBytes: 0,
        formattedSize: '0 B',
        deckInfo: { hiddenSlideCount: 0 },
        isValid: false,
        error: 'The uploaded file is empty (0 bytes).'
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
        deckInfo: { hiddenSlideCount: 0 },
        isValid: false,
        error: `File size exceeds the 100 MB limit (${this.pdfService.formatBytes(file.size)}).`
      };
    }

    // Client-side inspection of slide count and thumbnail
    const deckInfo = await getDeckInfo(file);

    return {
      id,
      file,
      name: file.name,
      extension: ext,
      sizeBytes: file.size,
      formattedSize: this.pdfService.formatBytes(file.size),
      deckInfo,
      isValid: true
    };
  }

  /**
   * Sends the presentations to the backend conversion endpoint and downloads the resulting PDF / ZIP
   */
  async convertToPdf(
    files: ValidatedPowerPointFile[],
    options: PowerPointToPdfOptions,
    onProgress?: (percent: number, message: string) => void,
    abortSignal?: AbortSignal
  ): Promise<ConvertedPowerPointToPdfResult> {
    const validFiles = files.filter((f) => f.isValid);
    if (validFiles.length === 0) {
      throw new Error('No valid presentation files available to convert.');
    }

    onProgress?.(15, 'Uploading presentation and preparing conversion...');

    const formData = new FormData();
    for (const f of validFiles) {
      formData.append('files', f.file, f.name);
    }
    formData.append('options', JSON.stringify(options));

    onProgress?.(35, 'Converting presentation slides in secure sandbox...');

    const baseUrl = environment.apiBaseUrl || '/api/v1';
    const apiUrl = `${baseUrl}/powerpoint-to-pdf/convert`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: abortSignal
    });

    if (!response.ok) {
      let errorMessage = 'Presentation conversion failed.';
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // use fallback statusText
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    onProgress?.(75, 'Processing slide layout and preparing output...');

    const result = (await response.json()) as { success: boolean; data: PowerPointToPdfResponse };
    const jobData = result.data;

    // Fetch the actual binary output file from the download URL
    onProgress?.(90, 'Downloading converted document...');
    const host = baseUrl.replace(/\/api\/v1\/?$/, '');
    const downloadPath = jobData.downloadUrl || `/api/v1/powerpoint-to-pdf/jobs/${jobData.jobId}/download`;
    const downloadFullUrl = downloadPath.startsWith('http') ? downloadPath : `${host}${downloadPath}`;
    const blobResponse = await fetch(downloadFullUrl, {
      signal: abortSignal
    });

    if (!blobResponse.ok) {
      throw new Error('Failed to retrieve the converted PDF output from the server.');
    }

    const outputBlob = await blobResponse.blob();
    const outputUrl = URL.createObjectURL(outputBlob);

    const originalTotalBytes = validFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
    const pdfTotalBytes = outputBlob.size;
    const totalPages = jobData.files.reduce((acc, f) => acc + f.pageCount, 0);

    onProgress?.(100, 'Conversion completed!');

    return {
      blob: outputBlob,
      url: outputUrl,
      filename: jobData.filename,
      pageCount: totalPages,
      originalSizeBytes: originalTotalBytes,
      pdfSizeBytes: pdfTotalBytes,
      formattedOriginalSize: this.pdfService.formatBytes(originalTotalBytes),
      formattedPdfSize: this.pdfService.formatBytes(pdfTotalBytes),
      isZip: jobData.isZip,
      files: jobData.files,
      warnings: jobData.warnings || []
    };
  }

  /**
   * Helper to clean up thumbnail URLs
   */
  cleanupThumbnails(files: ValidatedPowerPointFile[]): void {
    for (const f of files) {
      revokeDeckThumbnail(f.deckInfo);
    }
  }
}
