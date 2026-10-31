import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PDFDocument } from 'pdf-lib';
import {
  EditPdfOcrOptions,
  EditPdfOcrJobStatus,
  EditPdfOcrResult,
  ApiResponse
} from '@paperflow/contracts';
import { ServerActionGuard } from '../../../core/guards/server-action.guard';
import { environment } from '../../../../environments/environment';

export interface OcrProgressUpdate {
  runId: string;
  progress: number;
  page?: number;
  pages?: number;
  statusText: string;
}

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private http = inject(HttpClient);
  private serverActionGuard = inject(ServerActionGuard);

  private activeAbortController: AbortController | null = null;
  private currentActiveRunId: string | null = null;
  private activeJobId: string | null = null;

  /**
   * Builds a new PDF containing strictly and only the requested page indices
   * Guarantees non-selected pages never leave the client's browser.
   */
  async buildPageSubsetPdf(
    originalPdfBytes: ArrayBuffer | Uint8Array,
    pageIndexes: number[]
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
    const subDoc = await PDFDocument.create();

    const validIndices = pageIndexes.filter(
      idx => idx >= 0 && idx < srcDoc.getPageCount()
    );

    if (validIndices.length === 0) {
      throw new Error('No valid pages selected for OCR processing.');
    }

    const copiedPages = await subDoc.copyPages(srcDoc, validIndices);
    for (const page of copiedPages) {
      subDoc.addPage(page);
    }

    return await subDoc.save();
  }

  /**
   * Executes OCR on the specified PDF page subset with explicit user consent check
   */
  async executeOcr(
    pdfSubsetBytes: Uint8Array,
    options: EditPdfOcrOptions,
    onProgress?: (update: OcrProgressUpdate) => void
  ): Promise<EditPdfOcrResult> {
    // 1. Mandatory security guard: verify explicit user consent
    this.serverActionGuard.assertConsent('edit-pdf-ocr');

    // 2. Set up run-id guard to prevent race conditions or late responses
    const runId = `ocr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.currentActiveRunId = runId;

    this.activeAbortController?.abort();
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const apiUrl = environment.apiBaseUrl || 'http://localhost:4000';

    try {
      onProgress?.({
        runId,
        progress: 5,
        statusText: 'Connecting to OCR service...'
      });

      // 3. Prepare multipart payload
      const formData = new FormData();
      const pdfBlob = new Blob([pdfSubsetBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'subset.pdf');
      formData.append('options', JSON.stringify(options));

      const submitResponse = await fetch(`${apiUrl}/api/v1/edit-pdf/ocr`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      });

      if (!submitResponse.ok) {
        const errorJson = await submitResponse.json().catch(() => null);
        const errorMsg =
          errorJson?.error?.message ||
          `OCR initiation failed with status ${submitResponse.status}`;
        throw new Error(errorMsg);
      }

      const submitData = (await submitResponse.json()) as ApiResponse<{ jobId: string }>;
      const jobId = submitData.data.jobId;
      this.activeJobId = jobId;

      // 4. Poll job status with exponential backoff
      let delayMs = 600;
      const maxPollAttempts = 150; // ~3-4 minutes max
      let attempts = 0;

      while (attempts < maxPollAttempts) {
        if (abortController.signal.aborted || this.currentActiveRunId !== runId) {
          throw new Error('OCR job was cancelled');
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(2500, Math.round(delayMs * 1.25));
        attempts++;

        const statusResponse = await fetch(`${apiUrl}/api/v1/edit-pdf/ocr/jobs/${jobId}`, {
          signal: abortController.signal
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check OCR job progress (status ${statusResponse.status})`);
        }

        const statusData = (await statusResponse.json()) as ApiResponse<EditPdfOcrJobStatus>;
        const jobStatus = statusData.data;

        // Check run-id guard
        if (this.currentActiveRunId !== runId) {
          throw new Error('OCR run was superseded by a newer action');
        }

        onProgress?.({
          runId,
          progress: jobStatus.progress,
          page: jobStatus.page,
          pages: jobStatus.pages,
          statusText:
            jobStatus.state === 'running'
              ? `Recognizing page ${jobStatus.page || 1} of ${jobStatus.pages || 1}...`
              : 'Processing text layout...'
        });

        if (jobStatus.state === 'done') {
          break;
        } else if (jobStatus.state === 'failed') {
          throw new Error(jobStatus.error || 'OCR recognition failed on the server');
        } else if (jobStatus.state === 'cancelled') {
          throw new Error('OCR job was cancelled');
        }
      }

      // 5. Fetch final structured result
      const resultResponse = await fetch(
        `${apiUrl}/api/v1/edit-pdf/ocr/jobs/${jobId}/result`,
        { signal: abortController.signal }
      );

      if (!resultResponse.ok) {
        throw new Error('Failed to retrieve OCR recognition result');
      }

      const resultData = (await resultResponse.json()) as ApiResponse<EditPdfOcrResult>;

      if (this.currentActiveRunId !== runId) {
        throw new Error('OCR run was superseded');
      }

      return resultData.data;
    } catch (err: unknown) {
      if (abortController.signal.aborted || this.currentActiveRunId !== runId) {
        throw new Error('OCR job was cancelled');
      }
      throw err;
    } finally {
      if (this.currentActiveRunId === runId) {
        this.activeAbortController = null;
        this.activeJobId = null;
      }
    }
  }

  /**
   * Cancels active OCR operation and notifies the backend to purge memory
   */
  async cancel(): Promise<void> {
    this.currentActiveRunId = null;
    this.activeAbortController?.abort();
    this.activeAbortController = null;

    if (this.activeJobId) {
      const jobId = this.activeJobId;
      this.activeJobId = null;
      const apiUrl = environment.apiBaseUrl || 'http://localhost:4000';
      try {
        await fetch(`${apiUrl}/api/v1/edit-pdf/ocr/jobs/${jobId}`, {
          method: 'DELETE'
        });
      } catch {
        // Ignore deletion errors on client abort
      }
    }
  }
}
