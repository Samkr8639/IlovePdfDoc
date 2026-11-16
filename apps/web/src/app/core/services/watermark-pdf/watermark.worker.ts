/// <reference lib="webworker" />
/**
 * Watermark Export Dedicated Web Worker
 * Off-main-thread processing for PDF loading, shaping, watermarking, and saving.
 */

import { WatermarkLayoutService } from './watermark-layout.service';
import { WatermarkExportService } from './watermark-export.service';
import * as fontkit from '@pdf-lib/fontkit';

const layoutService = new WatermarkLayoutService();
const exportService = new WatermarkExportService(layoutService);

addEventListener('message', async (event: MessageEvent) => {
  const data = event.data;
  if (!data || data.type !== 'start_export') return;

  const { runId, originalPdfBytes, filename, settings, fontBytes } = data;

  try {
    let loadedFont: any = undefined;
    if (fontBytes && fontBytes.length > 0) {
      const fk = (fontkit as any).default || fontkit;
      try {
        loadedFont = fk.create(fontBytes);
      } catch {
        // Fall back to calibrated metrics if font parsing fails
      }
    }

    const result = await exportService.exportWatermarkedPdf(
      originalPdfBytes,
      filename,
      settings,
      {
        fontkitFont: loadedFont,
        onProgress: progress => {
          postMessage({
            type: 'progress',
            runId,
            progress
          });
        }
      }
    );

    postMessage(
      {
        type: 'success',
        runId,
        result
      },
      [result.pdfBytes.buffer]
    );
  } catch (err: any) {
    const errorMsg = String(err?.message || err || 'Watermark export failed.');
    postMessage({
      type: 'error',
      runId,
      error: errorMsg
    });
  }
});
