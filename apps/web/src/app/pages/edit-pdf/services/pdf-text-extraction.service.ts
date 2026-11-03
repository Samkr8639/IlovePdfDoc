import { Injectable } from '@angular/core';
import { PageDimensions, TextEditElement, TextLineBounds } from '../models/document-model';

export interface GlyphItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface LineSegment {
  text: string;
  x0: number;
  x1: number;
  width: number;
  baselineY: number;
  fontSize: number;
  y0: number;
  y1: number;
}

export interface TextBlock {
  lines: LineSegment[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  fontSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdfTextExtractionService {
  buildLineSegment(
    items: Array<{ text: string; x: number; width: number; fontSize: number; height: number }>,
    baselineY: number
  ): LineSegment {
    let fullText = '';
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      if (j > 0) {
        const prev = items[j - 1];
        const gap = it.x - (prev.x + prev.width);
        if (gap > 1.5) {
          fullText += ' ';
        }
      }
      fullText += it.text;
    }

    const minX = Math.min(...items.map(it => it.x));
    const maxX = Math.max(...items.map(it => it.x + it.width));
    const maxFont = Math.max(...items.map(it => it.fontSize));
    const fontSize = Math.round(maxFont * 10) / 10;
    const y0 = baselineY - fontSize * 0.22;
    const y1 = baselineY + fontSize * 0.78;

    return {
      text: fullText,
      x0: minX,
      x1: maxX,
      width: Math.max(10, maxX - minX),
      baselineY,
      fontSize,
      y0,
      y1
    };
  }

  isBulletLine(text: string): boolean {
    const t = text.trim();
    return /^[•\-\*\u2022\u25cf\u25cb\u25aa\u25b8\u2013\u2014]/.test(t);
  }

  isSectionHeading(text: string): boolean {
    const t = text.trim();
    return t.length >= 3 && t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t);
  }

  clusterLineSegmentsIntoBlocks(lineSegments: LineSegment[]): TextBlock[] {
    const textBlocks: TextBlock[] = [];

    // Sort line segments from top to bottom (in PDF coordinates, higher baselineY is higher)
    const sorted = [...lineSegments].sort((a, b) => b.baselineY - a.baselineY);

    for (const seg of sorted) {
      if (!seg.text.trim()) continue;

      const isSegHeading = this.isSectionHeading(seg.text);
      const isSegBullet = this.isBulletLine(seg.text);

      let merged = false;

      if (!isSegHeading) {
        for (const block of textBlocks) {
          const firstLine = block.lines[0];
          const lastLine = block.lines[block.lines.length - 1];

          if (this.isSectionHeading(firstLine.text)) {
            continue;
          }

          const blockHasBullets = block.lines.some(l => this.isBulletLine(l.text));
          if (!blockHasBullets && isSegBullet) {
            continue;
          }

          // Do NOT merge table cells, invoice summary rows, or short standalone labels
          const isShortOrTableCell = (text: string, w: number) => {
            const words = text.trim().split(/\s+/);
            return words.length <= 4 && w < 160;
          };
          if (isShortOrTableCell(lastLine.text, lastLine.width) || isShortOrTableCell(seg.text, seg.width)) {
            continue;
          }

          const deltaY = lastLine.baselineY - seg.baselineY;
          const avgFont = (lastLine.fontSize + seg.fontSize) / 2;

          const isVerticallyAdjacent = deltaY >= (avgFont * 0.8) && deltaY <= (avgFont * 1.8);

          const overlap = Math.min(block.x1, seg.x1) - Math.max(block.x0, seg.x0);
          const minW = Math.min(block.x1 - block.x0, seg.width);
          const hasColumnOverlap = overlap > 0 && (overlap / minW >= 0.65 || Math.abs(block.x0 - seg.x0) <= 8);

          const isSameFontSize = Math.abs(lastLine.fontSize - seg.fontSize) <= 1.5;

          if (isVerticallyAdjacent && hasColumnOverlap && isSameFontSize) {
            block.lines.push(seg);
            block.x0 = Math.min(block.x0, seg.x0);
            block.x1 = Math.max(block.x1, seg.x1);
            block.y0 = Math.min(block.y0, seg.y0);
            block.y1 = Math.max(block.y1, seg.y1);
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        textBlocks.push({
          lines: [seg],
          x0: seg.x0,
          x1: seg.x1,
          y0: seg.y0,
          y1: seg.y1,
          fontSize: seg.fontSize
        });
      }
    }

    return textBlocks;
  }

  async extractTextForSinglePage(pdfDoc: any, page: PageDimensions): Promise<TextEditElement[]> {
    if (!pdfDoc) return [];

    const pdfPage = await pdfDoc.getPage(page.pageIndex + 1);
    const textContent = await pdfPage.getTextContent();
    const rawItems = (textContent.items || []).filter(
      (it: any) => it.str && it.str.trim().length > 0
    );

    if (rawItems.length === 0) {
      return [];
    }

    // 1. Convert raw PDF items to structured glyph objects
    const glyphs: GlyphItem[] = rawItems.map((item: any) => {
      const tx = item.transform[4];
      const ty = item.transform[5];
      const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
      const width = item.width || (fontSize * item.str.length * 0.55);
      const height = item.height || fontSize;
      return { text: item.str, x: tx, y: ty, width, height, fontSize };
    });

    const baselineRows: Array<{ baselineY: number; items: GlyphItem[] }> = [];
    for (const g of glyphs) {
      const row = baselineRows.find(r => Math.abs(r.baselineY - g.y) <= 3.0);
      if (row) {
        row.items.push(g);
      } else {
        baselineRows.push({ baselineY: g.y, items: [g] });
      }
    }

    // 2. Within each baseline row, sort left-to-right and split into LineSegments by large horizontal gaps
    const lineSegments: LineSegment[] = [];

    for (const row of baselineRows) {
      row.items.sort((a, b) => a.x - b.x);

      let currentSegmentItems: GlyphItem[] = [];

      for (let i = 0; i < row.items.length; i++) {
        const item = row.items[i];
        if (currentSegmentItems.length === 0) {
          currentSegmentItems.push(item);
          continue;
        }

        const prev = currentSegmentItems[currentSegmentItems.length - 1];
        const gap = item.x - (prev.x + prev.width);

        const maxGap = Math.max(16, prev.fontSize * 2.0);
        if (gap > maxGap) {
          lineSegments.push(this.buildLineSegment(currentSegmentItems, row.baselineY));
          currentSegmentItems = [item];
        } else {
          currentSegmentItems.push(item);
        }
      }

      if (currentSegmentItems.length > 0) {
        lineSegments.push(this.buildLineSegment(currentSegmentItems, row.baselineY));
      }
    }

    // 3. Semantic Block Clustering
    const textBlocks = this.clusterLineSegmentsIntoBlocks(lineSegments);

    const generatedElements: TextEditElement[] = [];

    for (let idx = 0; idx < textBlocks.length; idx++) {
      const block = textBlocks[idx];
      const fullBlockText = block.lines.map(l => l.text).join('\n');
      if (!fullBlockText.trim()) continue;

      const xPt = block.x0;
      const widthPt = Math.max(20, block.x1 - block.x0 + 4);
      const heightPt = Math.max(block.fontSize, block.y1 - block.y0);
      const yPt = block.y0;
      const baselineY = block.lines[0].baselineY;
      const fontSizePt = Math.round(block.fontSize * 10) / 10;

      const originalLines: TextLineBounds[] = block.lines.map(l => ({
        text: l.text,
        xPt: l.x0 - 0.5,
        yPt: l.y0,
        widthPt: l.width + 1.0,
        heightPt: Math.max(l.fontSize * 0.95, l.y1 - l.y0)
      }));

      const textEl: TextEditElement = {
        id: `page-text-${page.pageIndex}-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: page.pageIndex,
        type: 'text',
        isPageTextLine: true,
        isEdited: false,
        originalText: fullBlockText,
        originalXPt: xPt,
        originalYPt: yPt,
        originalWidthPt: widthPt,
        originalHeightPt: heightPt,
        originalLines,
        xPt,
        yPt,
        baselineY,
        widthPt,
        heightPt,
        text: fullBlockText,
        fontFamily: 'Inter',
        fontSizePt,
        color: 'var(--pt-navy)'
      };

      generatedElements.push(textEl);
    }

    return generatedElements;
  }
}

