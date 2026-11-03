import { Injectable } from '@angular/core';
import {
  EditPdfOcrMode,
  EditPdfOcrResult,
  EditPdfOcrLine
} from '@paperflow/contracts';
import {
  EditElement,
  LowConfidenceWord,
  OcrTextLayerElement,
  TextEditElement,
  WhiteoutEditElement
} from '../models/document-model';

@Injectable({
  providedIn: 'root'
})
export class OcrWorkflowService {
  validatePageRange(
    mode: 'current' | 'all' | 'custom',
    customRange: string,
    totalPages: number
  ): { valid: boolean; error: string | null } {
    if (mode === 'current' || mode === 'all') {
      return { valid: true, error: null };
    }

    const rangeStr = customRange.trim();
    if (!rangeStr) {
      return { valid: false, error: 'Please specify page range (e.g. 1-3, 5).' };
    }

    const parts = rangeStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
          return {
            valid: false,
            error: `Invalid range '${trimmed}'. Valid pages are 1 to ${totalPages}.`
          };
        }
      } else {
        const pageNum = parseInt(trimmed, 10);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
          return {
            valid: false,
            error: `Page '${trimmed}' is out of bounds (1-${totalPages}).`
          };
        }
      }
    }

    return { valid: true, error: null };
  }

  parsePageIndices(
    mode: 'current' | 'all' | 'custom',
    customRange: string,
    totalPages: number,
    currentPageIndex: number
  ): number[] {
    if (mode === 'current') {
      return [currentPageIndex];
    }
    if (mode === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const indices = new Set<number>();
    const parts = customRange.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10) - 1;
        const end = parseInt(endStr, 10) - 1;
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < totalPages) indices.add(i);
        }
      } else {
        const p = parseInt(trimmed, 10) - 1;
        if (p >= 0 && p < totalPages) indices.add(p);
      }
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  convertOcrResultToElements(
    result: EditPdfOcrResult,
    targetPageIndices: number[],
    mode: EditPdfOcrMode
  ): {
    elements: EditElement[];
    lowConfidenceWords: LowConfidenceWord[];
    totalLines: number;
  } {
    const generatedElements: EditElement[] = [];
    const lowConfWords: LowConfidenceWord[] = [];
    let totalLines = 0;

    for (let i = 0; i < result.pages.length; i++) {
      const pageResult = result.pages[i];
      const actualPageIndex = targetPageIndices[i] ?? pageResult.index;

      if (mode === 'searchable') {
        const layerEl: OcrTextLayerElement = {
          id: `ocr-layer-${actualPageIndex}-${Date.now()}`,
          pageIndex: actualPageIndex,
          type: 'ocr-layer',
          xPt: 0,
          yPt: 0,
          widthPt: pageResult.widthPt,
          heightPt: pageResult.heightPt,
          lines: pageResult.lines,
          language: result.language,
          averageConfidence: result.averageConfidence
        };
        generatedElements.push(layerEl);
        totalLines += pageResult.lines.length;

        for (const line of pageResult.lines) {
          for (const word of line.words) {
            if (word.confidence < 60) {
              lowConfWords.push({
                text: word.text,
                pageIndex: actualPageIndex,
                bbox: word.bbox,
                confidence: word.confidence
              });
            }
          }
        }
      } else {
        interface OcrBlock {
          lines: EditPdfOcrLine[];
          x0: number;
          x1: number;
          y0: number;
          y1: number;
          fontSizePt: number;
          baselineY: number;
          avgConfidence: number;
        }

        const isBulletLine = (text: string) => {
          const t = text.trim();
          return /^[•\-\*\u2022\u25cf\u25cb\u25aa\u25b8\u2013\u2014]/.test(t);
        };

        const isSectionHeading = (text: string) => {
          const t = text.trim();
          return t.length >= 3 && t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t);
        };

        const ocrBlocks: OcrBlock[] = [];
        const sortedLines = [...pageResult.lines].sort((a, b) => b.bbox[1] - a.bbox[1]);

        for (const line of sortedLines) {
          totalLines++;
          const [lx0, ly0, lx1, ly1] = line.bbox;
          const fontSize = line.fontSizePt || 14;

          const isSegHeading = isSectionHeading(line.text);
          const isSegBullet = isBulletLine(line.text);

          let merged = false;

          if (!isSegHeading) {
            for (const b of ocrBlocks) {
              const firstL = b.lines[0];
              const lastL = b.lines[b.lines.length - 1];

              if (isSectionHeading(firstL.text)) {
                continue;
              }

              const blockHasBullets = b.lines.some(l => isBulletLine(l.text));
              if (!blockHasBullets && isSegBullet) {
                continue;
              }

              const deltaY = lastL.bbox[1] - line.bbox[1];
              const avgFont = (b.fontSizePt + fontSize) / 2;

              const isVerticallyAdjacent = deltaY >= (avgFont * 0.8) && deltaY <= (avgFont * 2.4);
              const overlap = Math.min(b.x1, lx1) - Math.max(b.x0, lx0);
              const minW = Math.min(b.x1 - b.x0, lx1 - lx0);
              const hasOverlap = overlap > 0 && (overlap / minW >= 0.45 || Math.abs(b.x0 - lx0) <= 20);
              const isSameFont = Math.abs(b.fontSizePt - fontSize) <= 2.5;

              if (isVerticallyAdjacent && hasOverlap && isSameFont) {
                b.lines.push(line);
                b.x0 = Math.min(b.x0, lx0);
                b.x1 = Math.max(b.x1, lx1);
                b.y0 = Math.min(b.y0, ly0);
                b.y1 = Math.max(b.y1, ly1);
                merged = true;
                break;
              }
            }
          }

          if (!merged) {
            ocrBlocks.push({
              lines: [line],
              x0: lx0,
              x1: lx1,
              y0: ly0,
              y1: ly1,
              fontSizePt: fontSize,
              baselineY: line.baselineY,
              avgConfidence: line.confidence
            });
          }

          for (const word of line.words) {
            if (word.confidence < 60) {
              lowConfWords.push({
                text: word.text,
                pageIndex: actualPageIndex,
                bbox: word.bbox,
                confidence: word.confidence
              });
            }
          }
        }

        for (const block of ocrBlocks) {
          const w = Math.max(30, block.x1 - block.x0 + 6);
          const h = Math.max(16, block.y1 - block.y0 + 4);
          const fullText = block.lines.map(l => l.text).join('\n');

          const coverEl: WhiteoutEditElement = {
            id: `ocr-cover-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'whiteout',
            xPt: Math.max(0, block.x0 - 2),
            yPt: Math.max(0, block.y0 - 2),
            widthPt: w + 4,
            heightPt: h + 4,
            fillColor: 'var(--pt-surface-white)'
          };

          const textEl: TextEditElement = {
            id: `ocr-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: actualPageIndex,
            type: 'text',
            xPt: block.x0,
            yPt: block.y0,
            widthPt: w,
            heightPt: h,
            text: fullText,
            fontFamily: 'Inter',
            fontSizePt: block.fontSizePt,
            color: 'var(--pt-navy)',
            baselineY: block.baselineY,
            isOcrLine: true,
            isPageTextLine: true,
            ocrConfidence: block.avgConfidence
          };

          generatedElements.push(coverEl, textEl);
        }
      }
    }

    return {
      elements: generatedElements,
      lowConfidenceWords: lowConfWords,
      totalLines
    };
  }
}
