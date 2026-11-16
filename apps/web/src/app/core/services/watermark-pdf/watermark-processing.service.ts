/**
 * Watermark Processing Service
 * Orchestrates Web Worker PDF export with hardware-aware resource limits,
 * progress tracking, cancel support, and main-thread fallback.
 */

import { Injectable, inject } from '@angular/core';
import {
  WATERMARK_LIMITS,
  WatermarkFileSettings,
  WatermarkProcessResult
} from '@paperflow/contracts';
import { WatermarkExportService } from './watermark-export.service';

export interface ProcessingProgressEvent {
  currentFile: number;
  totalFiles: number;
  currentPage: number;
  totalPages: number;
  percent: number;
  message: string;
}

export interface ProcessingLimitInfo {
  isLowResource: boolean;
  maxFileSizeBytes: number;
  maxPages: number;
  maxFiles: number;
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkProcessingService {
  private exportService = inject(WatermarkExportService);
  private activeWorker: Worker | null = null;
  private currentCancelFlag = false;

  /**
   * Hardware limits detection based on deviceMemory and user agent.
   */
  getDeviceLimits(): ProcessingLimitInfo {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const deviceMem = nav && 'deviceMemory' in nav ? (nav as any).deviceMemory : 8;
    const isMobile =
      nav &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent || '');

    const isLowResource = (typeof deviceMem === 'number' && deviceMem <= 4) || Boolean(isMobile);

    return {
      isLowResource,
      maxFileSizeBytes: isLowResource
        ? WATERMARK_LIMITS.lowMemoryMaxFileSizeBytes
        : WATERMARK_LIMITS.desktopMaxFileSizeBytes,
      maxPages: isLowResource
        ? WATERMARK_LIMITS.lowMemoryMaxPages
        : WATERMARK_LIMITS.desktopMaxPages,
      maxFiles: WATERMARK_LIMITS.maxFiles
    };
  }

  /**
   * Validates file size and page count against device-aware limits.
   */
  validateFileLimits(fileSize: number, pageCount?: number): { valid: boolean; error?: string } {
    const limits = this.getDeviceLimits();
    const limitMb = Math.round(limits.maxFileSizeBytes / (1024 * 1024));

    if (fileSize > limits.maxFileSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds the ${limitMb} MB limit for this device.`
      };
    }

    if (typeof pageCount === 'number' && pageCount > limits.maxPages) {
      return {
        valid: false,
        error: `Document has ${pageCount} pages, which exceeds the ${limits.maxPages}-page limit for this device.`
      };
    }

    return { valid: true };
  }

  /**
   * Processes a PDF file through the Web Worker (with main-thread fallback).
   */
  async processWatermark(
    originalPdfBytes: Uint8Array,
    filename: string,
    settings: WatermarkFileSettings,
    fontBytes?: Uint8Array,
    onProgress?: (progress: ProcessingProgressEvent) => void
  ): Promise<WatermarkProcessResult> {
    this.currentCancelFlag = false;
    const runId = `wm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Try Web Worker first if supported
    if (typeof Worker !== 'undefined') {
      try {
        return await this.runWorkerExport(runId, originalPdfBytes, filename, settings, fontBytes, onProgress);
      } catch (workerErr: any) {
        if (this.currentCancelFlag) {
          throw new Error('Watermark processing was cancelled.');
        }
        console.warn('Worker export failed or unavailable, falling back to main-thread processing:', workerErr);
      }
    }

    // Main-thread fallback
    try {
      return await this.exportService.exportWatermarkedPdf(
        originalPdfBytes,
        filename,
        settings,
        {
          shouldCancel: () => this.currentCancelFlag,
          onProgress: p => {
            const pct = Math.round((p.currentPage / Math.max(1, p.totalPages)) * 100);
            onProgress?.({
              currentFile: p.currentFile,
              totalFiles: p.totalFiles,
              currentPage: p.currentPage,
              totalPages: p.totalPages,
              percent: pct,
              message: `Applying watermark to page ${p.currentPage} of ${p.totalPages}...`
            });
          }
        }
      );
    } catch (err: any) {
      if (this.currentCancelFlag) {
        throw new Error('Watermark processing was cancelled.');
      }
      this.handleAllocationError(err);
      throw err;
    }
  }

  /**
   * Cancels active processing and terminates worker immediately.
   */
  cancel(): void {
    this.currentCancelFlag = true;
    if (this.activeWorker) {
      try {
        this.activeWorker.terminate();
      } catch {
        // Ignore termination error
      }
      this.activeWorker = null;
    }
  }

  private runWorkerExport(
    runId: string,
    originalPdfBytes: Uint8Array,
    filename: string,
    settings: WatermarkFileSettings,
    fontBytes?: Uint8Array,
    onProgress?: (progress: ProcessingProgressEvent) => void
  ): Promise<WatermarkProcessResult> {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./watermark.worker.ts', import.meta.url), { type: 'module' });
        this.activeWorker = worker;
      } catch (e) {
        return reject(e);
      }

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (!msg || msg.runId !== runId) return;

        if (msg.type === 'progress') {
          const p = msg.progress;
          const pct = Math.round((p.currentPage / Math.max(1, p.totalPages)) * 100);
          onProgress?.({
            currentFile: p.currentFile,
            totalFiles: p.totalFiles,
            currentPage: p.currentPage,
            totalPages: p.totalPages,
            percent: pct,
            message: `Applying watermark to page ${p.currentPage} of ${p.totalPages}...`
          });
        } else if (msg.type === 'success') {
          this.activeWorker = null;
          worker.terminate();
          resolve(msg.result);
        } else if (msg.type === 'error') {
          this.activeWorker = null;
          worker.terminate();
          const err = new Error(msg.error || 'Worker export error.');
          this.handleAllocationError(err);
          reject(err);
        }
      };

      worker.onerror = (err: ErrorEvent) => {
        this.activeWorker = null;
        try {
          worker.terminate();
        } catch {}
        reject(new Error(err?.message || 'Worker encounter an unhandled error.'));
      };

      worker.postMessage({
        type: 'start_export',
        runId,
        originalPdfBytes,
        filename,
        settings,
        fontBytes
      });
    });
  }

  private handleAllocationError(err: any): void {
    const msg = String(err?.message || err || '').toLowerCase();
    if (
      msg.includes('out of memory') ||
      msg.includes('allocation') ||
      msg.includes('heap') ||
      msg.includes('array buffer allocation failed')
    ) {
      throw new Error('This file is too large for your device; try a smaller file or close other browser tabs.');
    }
  }
}
