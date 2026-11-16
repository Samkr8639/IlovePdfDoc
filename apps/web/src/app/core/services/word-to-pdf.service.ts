import { Injectable, inject } from '@angular/core';
import {
  WordToPdfOptions,
  WordToPdfJobResponse,
  ConvertedPdfFileItem
} from '@paperflow/contracts';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
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

  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  private async convertSingleDocxClientSide(
    file: File,
    onProgress?: (msg: string) => void
  ): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
    onProgress?.('Extracting document structures...');
    const zip = await JSZip.loadAsync(file);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error(`File '${file.name}' does not contain word/document.xml.`);
    }

    const xmlText = await docXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.querySelector('body');
    if (!body) {
      throw new Error('Invalid Word XML body structure.');
    }

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Standard Letter
    const pageHeight = 792;
    const margin = 54;
    const printableWidth = pageWidth - margin * 2; // 504 pt

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    const ensureSpace = (needed: number) => {
      if (currentY - needed < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
    };

    const children = Array.from(body.childNodes);
    for (const node of children) {
      if (node.nodeType !== 1) continue;
      const elem = node as Element;
      const tagName = elem.tagName.toLowerCase();

      if (tagName.endsWith('p')) {
        if (elem.querySelector('w\\:br[w\\:type="page"], br[type="page"]')) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }

        const pStyle = elem.querySelector('w\\:pStyle, pStyle')?.getAttribute('w:val') || '';
        let fontSize = 10.5;
        let isBold = false;
        let spaceBefore = 2;
        let spaceAfter = 4;

        if (/heading\s*1/i.test(pStyle) || pStyle === '1') {
          fontSize = 18;
          isBold = true;
          spaceBefore = 14;
          spaceAfter = 6;
        } else if (/heading\s*2/i.test(pStyle) || pStyle === '2') {
          fontSize = 14;
          isBold = true;
          spaceBefore = 10;
          spaceAfter = 4;
        } else if (/heading\s*3/i.test(pStyle) || pStyle === '3') {
          fontSize = 12;
          isBold = true;
          spaceBefore = 8;
          spaceAfter = 3;
        } else if (/title/i.test(pStyle)) {
          fontSize = 22;
          isBold = true;
          spaceBefore = 18;
          spaceAfter = 8;
        }

        const text = (elem.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) {
          currentY -= 6;
          continue;
        }

        if (spaceBefore > 0) {
          ensureSpace(spaceBefore);
          currentY -= spaceBefore;
        }

        const fontToUse = isBold ? fontBold : fontRegular;
        const lines = this.wrapText(text, fontToUse, fontSize, printableWidth);
        const lineHeight = fontSize * 1.35;

        for (const line of lines) {
          ensureSpace(lineHeight);
          page.drawText(line, {
            x: margin,
            y: currentY - fontSize,
            size: fontSize,
            font: fontToUse,
            color: rgb(0.12, 0.15, 0.2)
          });
          currentY -= lineHeight;
        }

        currentY -= spaceAfter;
      } else if (tagName.endsWith('tbl')) {
        const rows = Array.from(elem.querySelectorAll('w\\:tr, tr'));
        if (rows.length === 0) continue;

        const firstRowCells = Array.from(rows[0].querySelectorAll('w\\:tc, tc'));
        const numCols = Math.max(1, firstRowCells.length);
        const colWidth = printableWidth / numCols;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('w\\:tc, tc'));
          const cellTexts = cells.map(c => (c.textContent || '').replace(/\s+/g, ' ').trim());
          const cellLineArrays = cellTexts.map(t =>
            this.wrapText(t, fontRegular, 9, colWidth - 10)
          );
          const maxLines = Math.max(1, ...cellLineArrays.map(l => l.length));
          const rowHeight = maxLines * 12 + 10;

          ensureSpace(rowHeight);

          for (let c = 0; c < cells.length; c++) {
            const cellX = margin + c * colWidth;
            page.drawRectangle({
              x: cellX,
              y: currentY - rowHeight,
              width: colWidth,
              height: rowHeight,
              borderWidth: 0.75,
              borderColor: rgb(0.82, 0.86, 0.90),
              color: rgb(0.99, 0.99, 1.0)
            });

            let lineY = currentY - 5;
            for (const line of cellLineArrays[c]) {
              page.drawText(line, {
                x: cellX + 5,
                y: lineY - 9,
                size: 9,
                font: fontRegular,
                color: rgb(0.15, 0.18, 0.22)
              });
              lineY -= 12;
            }
          }

          currentY -= rowHeight;
        }

        currentY -= 8;
      }
    }

    const totalPages = pdfDoc.getPageCount();
    for (let p = 0; p < totalPages; p++) {
      const pObj = pdfDoc.getPage(p);
      pObj.drawText(`Page ${p + 1} of ${totalPages}`, {
        x: pageWidth / 2 - 25,
        y: 24,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.55, 0.6, 0.65)
      });
    }

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, pageCount: totalPages };
  }

  private async convertDocxFilesClientSide(
    files: ValidatedWordFile[],
    options: WordToPdfOptions,
    onProgress?: (progress: number, message: string) => void
  ): Promise<ConvertedWordToPdfResult> {
    const convertedItems: ConvertedPdfFileItem[] = [];
    const pdfBuffers: Array<{ filename: string; bytes: Uint8Array; pageCount: number }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const pct = Math.round(60 + (i / files.length) * 35);
      onProgress?.(pct, `Converting "${f.name}" in browser sandbox (${i + 1}/${files.length})...`);

      const { pdfBytes, pageCount } = await this.convertSingleDocxClientSide(f.file);
      const cleanBase = f.name.replace(/\.[^/.]+$/, '');
      const pdfFilename = `${cleanBase}.pdf`;

      pdfBuffers.push({ filename: pdfFilename, bytes: pdfBytes, pageCount });
      convertedItems.push({
        id: `pdf-${Date.now()}-${i}`,
        originalFilename: f.name,
        pdfFilename,
        originalSizeBytes: f.sizeBytes,
        pdfSizeBytes: pdfBytes.byteLength,
        formattedOriginalSize: f.formattedSize,
        formattedPdfSize: this.pdfService.formatBytes(pdfBytes.byteLength),
        pageCount,
        downloadUrl: ''
      });
    }

    onProgress?.(98, 'Packaging converted document...');

    let finalBlob: Blob;
    let finalFilename: string;
    const isZip = files.length > 1;

    if (isZip) {
      const zip = new JSZip();
      for (const item of pdfBuffers) {
        zip.file(item.filename, item.bytes);
      }
      finalBlob = await zip.generateAsync({ type: 'blob' });
      finalFilename = 'converted_documents.zip';
    } else {
      finalBlob = new Blob([pdfBuffers[0].bytes as any], { type: 'application/pdf' });
      finalFilename = pdfBuffers[0].filename;
    }

    const url = URL.createObjectURL(finalBlob);
    const totalOriginalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    onProgress?.(100, 'Conversion completed successfully!');

    return {
      blob: finalBlob,
      url,
      filename: finalFilename,
      pageCount: convertedItems.reduce((acc, item) => acc + item.pageCount, 0),
      originalSizeBytes: totalOriginalSize,
      pdfSizeBytes: finalBlob.size,
      formattedOriginalSize: this.pdfService.formatBytes(totalOriginalSize),
      formattedPdfSize: this.pdfService.formatBytes(finalBlob.size),
      isZip,
      files: convertedItems,
      warnings: ['Converted directly in your browser sandbox without uploading to external servers.']
    };
  }

  /**
   * Converts Word documents to PDF, using high-fidelity backend service with automatic
   * in-browser client-side fallback for .docx files if offline or network is unavailable.
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
    await new Promise(r => setTimeout(r, 100));

    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled by user', 'AbortError');
    }

    onProgress?.(30, 'Connecting to conversion engine...');

    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f.file);
    }
    formData.append('options', JSON.stringify(options));

    const baseUrl = environment.apiBaseUrl || '/api/v1';
    let backendSuccess = false;
    let job: WordToPdfJobResponse | null = null;
    let finalBlob: Blob | null = null;

    try {
      const response = await fetch(`${baseUrl}/word-to-pdf/convert`, {
        method: 'POST',
        body: formData,
        signal
      });

      if (response.ok) {
        onProgress?.(80, 'Preparing PDF output for download...');
        const data = await response.json();
        job = data.data;

        const host = baseUrl.replace(/\/api\/v1\/?$/, '');
        const downloadPath = job!.isZip
          ? job!.zipDownloadUrl || `/api/v1/word-to-pdf/jobs/${job!.id}/download`
          : job!.files[0]?.downloadUrl || `/api/v1/word-to-pdf/jobs/${job!.id}/download`;

        const fullUrl = downloadPath.startsWith('http') ? downloadPath : `${host}${downloadPath}`;
        const fileRes = await fetch(fullUrl, { signal });
        if (fileRes.ok) {
          finalBlob = await fileRes.blob();
          backendSuccess = true;
        }
      }
    } catch (fetchErr: any) {
      if (signal?.aborted || fetchErr?.name === 'AbortError') {
        throw fetchErr;
      }
      // Backend fetch failed (server offline, network error, or 502/503)
    }

    if (backendSuccess && job && finalBlob) {
      const url = URL.createObjectURL(finalBlob);
      const firstItem = job.files[0];
      const totalOriginalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

      onProgress?.(100, 'Conversion completed successfully!');

      return {
        blob: finalBlob,
        url,
        filename: job.isZip
          ? 'converted_pdfs.zip'
          : (firstItem?.pdfFilename || 'converted_document.pdf'),
        pageCount: firstItem?.pageCount || 1,
        originalSizeBytes: totalOriginalSize,
        pdfSizeBytes: finalBlob.size,
        formattedOriginalSize: this.pdfService.formatBytes(totalOriginalSize),
        formattedPdfSize: this.pdfService.formatBytes(finalBlob.size),
        isZip: job.isZip,
        files: job.files,
        warnings: job.warnings || []
      };
    }

    // Backend unavailable or failed: check if files are .docx for client-side in-browser fallback
    const allDocx = files.every(f => f.extension === '.docx');
    if (!allDocx) {
      const hasLegacy = files.some(f => f.extension === '.doc');
      if (hasLegacy) {
        throw new Error(
          'Unable to connect to conversion server. Please check your network connection or save your .doc document as modern .docx format for instant browser-side conversion.'
        );
      }
      throw new Error(
        'Unable to connect to conversion server. Please check your network connection and try again.'
      );
    }

    // Client-side in-browser conversion for .docx files
    onProgress?.(55, 'Converting documents directly in browser sandbox...');
    try {
      return await this.convertDocxFilesClientSide(files, options, onProgress);
    } catch (fallbackErr: any) {
      if (signal?.aborted) throw fallbackErr;
      throw new Error(
        'Unable to complete document conversion. Please verify your document formatting or save as standard .docx.'
      );
    }
  }
}
