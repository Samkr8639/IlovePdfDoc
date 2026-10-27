import { Injectable, inject } from '@angular/core';
import {
  PdfToPowerPointMode,
  PdfToPowerPointSlideSize,
  PdfToPowerPointOptions,
  PdfDocumentAnalysis,
  PdfToPowerPointJobResponse
} from '@paperflow/contracts';
import { BrowserPdfService, ValidatedPdfFile } from './browser-pdf.service';
import { environment } from '../../../environments/environment';

export interface ConvertedPowerPointResult {
  blob: Blob;
  url: string;
  filename: string;
  slideCount: number;
  originalSizeBytes: number;
  pptxSizeBytes: number;
  formattedOriginalSize: string;
  formattedSize: string;
  isZip: boolean;
  warnings: string[];
  modeUsed: PdfToPowerPointMode;
  slideSizeUsed: PdfToPowerPointSlideSize;
}

@Injectable({
  providedIn: 'root'
})
export class PdfToPowerPointService {
  private pdfService = inject(BrowserPdfService);

  /**
   * Validates a single PDF file for PowerPoint conversion
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
   * Converts one or more PDF files into PowerPoint (.pptx) or a ZIP of .pptx presentations
   */
  async convertToPowerPoint(
    files: ValidatedPdfFile[],
    options: PdfToPowerPointOptions,
    onProgress?: (progress: number, message: string) => void,
    signal?: AbortSignal
  ): Promise<ConvertedPowerPointResult> {
    if (!files || files.length === 0) {
      throw new Error('No PDF files selected for conversion.');
    }

    onProgress?.(15, 'Validating document structures...');
    await new Promise(r => setTimeout(r, 100));

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    onProgress?.(30, 'Uploading files to PowerPoint conversion engine...');

    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f.file);
    }
    formData.append('mode', options.mode);
    if (options.slideSize) {
      formData.append('slideSize', options.slideSize);
    }
    if (options.ocrLanguage) {
      formData.append('ocrLanguage', options.ocrLanguage);
    }

    onProgress?.(
      50,
      options.mode === 'ocr'
        ? 'Running OCR optical text recognition & background generation...'
        : 'Extracting layouts, vectors, fonts & positioning slide elements...'
    );

    const baseUrl = environment.apiBaseUrl || 'http://localhost:4000/api/v1';
    const response = await fetch(`${baseUrl}/pdf-to-powerpoint/convert`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Conversion API error (${response.status})`);
    }

    onProgress?.(80, 'Packaging genuine Microsoft PowerPoint presentation...');

    const data = await response.json();
    const job: PdfToPowerPointJobResponse = data.data;

    // Fetch the generated PPTX or ZIP blob
    const host = baseUrl.replace(/\/api\/v1\/?$/, '');
    const firstItem = job.files && job.files.length > 0 ? job.files[0] : null;
    const downloadPath = job.isZip
      ? (job.zipDownloadUrl || `/api/v1/pdf-to-powerpoint/jobs/${job.id}/download`)
      : (firstItem?.downloadUrl || `/api/v1/pdf-to-powerpoint/jobs/${job.id}/download`);

    const downloadUrl = `${host}${downloadPath}`;
    const fileRes = await fetch(downloadUrl, { signal });

    if (!fileRes.ok) {
      throw new Error(`Failed to download converted PowerPoint presentation (${fileRes.status})`);
    }

    const blob = await fileRes.blob();
    const url = URL.createObjectURL(blob);

    const originalSize = job.files.reduce((a, b) => a + (b.originalSizeBytes || 0), 0);
    const pptxSize = blob.size;
    const totalSlideCount = job.files.reduce((a, b) => a + (b.slideCount || 0), 0);

    // Merge global and file-level warnings
    const combinedWarnings = Array.from(
      new Set([
        ...(job.warnings || []),
        ...job.files.flatMap(f => f.warnings || [])
      ])
    );

    onProgress?.(100, 'Conversion completed successfully!');

    return {
      blob,
      url,
      filename: job.isZip
        ? 'converted_powerpoint_presentations.zip'
        : (firstItem?.powerpointFilename || firstItem?.pptxFilename || 'presentation.pptx'),
      slideCount: totalSlideCount || 1,
      originalSizeBytes: originalSize,
      pptxSizeBytes: pptxSize,
      formattedOriginalSize: this.pdfService.formatBytes(originalSize),
      formattedSize: this.pdfService.formatBytes(pptxSize),
      isZip: job.isZip,
      warnings: combinedWarnings,
      modeUsed: job.mode,
      slideSizeUsed: job.slideSize
    };
  }
}
