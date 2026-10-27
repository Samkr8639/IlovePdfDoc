import { ExtractedPdfDocument, PdfPageData, PdfTextItem } from './pdf-layout-extractor';

export type SemanticElementType =
  | 'title'
  | 'heading1'
  | 'heading2'
  | 'leadin_paragraph'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'table';

export interface SemanticTableRow {
  cells: string[];
}

export interface SemanticElement {
  type: SemanticElementType;
  pageNum: number;
  text?: string;
  leadIn?: string;
  num?: string;
  colStarts?: number[];
  rows?: SemanticTableRow[];
}

export interface ReconstructedDocument {
  title: string;
  elements: SemanticElement[];
  pageCount: number;
  runningHeader?: string;
}

interface VisualLine {
  y: number;
  items: PdfTextItem[];
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  chunks: PdfTextItem[];
  text: string;
}

/**
 * Reconstructs semantic document hierarchy, reading flow, tables, lists, and headings from extracted PDF page data.
 */
export function reconstructDocumentLayout(doc: ExtractedPdfDocument): ReconstructedDocument {
  const elements: SemanticElement[] = [];
  let docTitle = doc.detectedDocTitle || '';

  for (const page of doc.pages) {
    const rawItems = [...page.textItems];

    // Sort items top-to-bottom, left-to-right
    rawItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    // Group items into visual lines
    const lines: VisualLine[] = [];
    let curLine: VisualLine | null = null;

    for (const it of rawItems) {
      if (!curLine || Math.abs(curLine.y - it.y) > 3) {
        curLine = {
          y: it.y,
          items: [it],
          fontSize: it.fontSize,
          isBold: it.isBold,
          isItalic: it.isItalic,
          chunks: [],
          text: ''
        };
        lines.push(curLine);
      } else {
        curLine.items.push(it);
        if (it.fontSize > curLine.fontSize) curLine.fontSize = it.fontSize;
        if (it.isBold) curLine.isBold = true;
      }
    }

    // Merge adjacent inline spans on the same line if gap < 12pt
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      const merged: PdfTextItem[] = [];
      let cur: PdfTextItem | null = null;

      for (const it of line.items) {
        if (!cur) {
          cur = { ...it };
        } else if (it.x <= cur.x + cur.w + 12) {
          cur.str += ' ' + it.str;
          cur.w = (it.x + it.w) - cur.x;
        } else {
          merged.push(cur);
          cur = { ...it };
        }
      }
      if (cur) merged.push(cur);
      line.chunks = merged;
      line.text = line.items.map(it => it.str).join(' ').trim();
    }

    // Process lines on page
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const line = lines[lineIdx];

      // 1. Table Detection
      if (line.chunks.length >= 2) {
        const colStarts = line.chunks.map(c => c.x);

        // Check lookahead for matching column alignment
        let matchingLineCount = 0;
        let lookahead = lineIdx + 1;
        while (lookahead < Math.min(lineIdx + 5, lines.length)) {
          const nextL = lines[lookahead];
          const matches = nextL.chunks.filter(c => colStarts.some(cs => Math.abs(c.x - cs) < 25));
          if (matches.length >= 1 && nextL.fontSize <= 12) {
            matchingLineCount++;
          }
          lookahead++;
        }

        if (matchingLineCount >= 1) {
          const tableLines: VisualLine[] = [line];
          let scan = lineIdx + 1;

          while (scan < lines.length) {
            const curL = lines[scan];
            if (curL.fontSize > 13) break; // Big heading stops table
            if (lines[scan - 1].y - curL.y > 32) break; // Large gap stops table

            const hasColMatch = curL.chunks.some(c => colStarts.some(cs => Math.abs(c.x - cs) < 25));
            const spansMultipleCols = curL.chunks.length === 1 && curL.chunks[0].w > (colStarts[1] - colStarts[0] + 50);
            if (spansMultipleCols && !hasColMatch) break;

            if (hasColMatch || curL.chunks[0].x >= colStarts[1] - 25) {
              tableLines.push(curL);
              scan++;
            } else {
              break;
            }
          }

          // Build Table Rows
          const rows: SemanticTableRow[] = [];
          let curRow: { y: number; cells: string[] } | null = null;

          for (let tlIdx = 0; tlIdx < tableLines.length; tlIdx++) {
            const tl = tableLines[tlIdx];
            const prevL = tlIdx > 0 ? tableLines[tlIdx - 1] : null;

            const cellValues = Array(colStarts.length).fill('');
            for (const chk of tl.chunks) {
              let colIdx = 0;
              for (let c = colStarts.length - 1; c >= 0; c--) {
                if (chk.x >= colStarts[c] - 25) {
                  colIdx = c;
                  break;
                }
              }
              cellValues[colIdx] = (cellValues[colIdx] ? cellValues[colIdx] + ' ' : '') + chk.str;
            }

            const verticalDelta = prevL ? (prevL.y - tl.y) : 999;
            const isContinuation = curRow && verticalDelta <= 18.5;

            if (!isContinuation) {
              curRow = { y: tl.y, cells: [...cellValues] };
              rows.push(curRow);
            } else if (curRow) {
              for (let c = 0; c < colStarts.length; c++) {
                if (cellValues[c]) {
                  curRow.cells[c] = (curRow.cells[c] ? curRow.cells[c] + ' ' : '') + cellValues[c];
                }
              }
            }
          }

          // Check if this table is an immediate continuation of the previous table (e.g. split across pages)
          const lastEl = elements[elements.length - 1];
          const isTableContinuation =
            lastEl &&
            lastEl.type === 'table' &&
            lastEl.colStarts &&
            lastEl.colStarts.length === colStarts.length &&
            rows.length > 1 &&
            rows[0].cells.join('|') === lastEl.rows?.[0]?.cells.join('|');

          if (isTableContinuation && lastEl.rows) {
            // Append continuation rows (skip the repeated header row)
            for (let r = 1; r < rows.length; r++) {
              lastEl.rows.push(rows[r]);
            }
          } else {
            elements.push({
              type: 'table',
              pageNum: page.pageNumber,
              colStarts,
              rows
            });
          }

          lineIdx = scan;
          continue;
        }
      }

      // 2. Headings, Lists, Paragraphs
      const text = line.text;
      const fontSize = line.fontSize;

      if (fontSize >= 20) {
        if (!docTitle) docTitle = text;
        elements.push({
          type: 'title',
          text,
          pageNum: page.pageNumber
        });
      } else if (fontSize >= 15) {
        elements.push({
          type: 'heading1',
          text,
          pageNum: page.pageNumber
        });
      } else if (fontSize >= 13 || (line.isBold && (text.endsWith(':') || (text.length < 50 && !text.endsWith('.'))))) {
        elements.push({
          type: 'heading2',
          text,
          pageNum: page.pageNumber
        });
      } else if (text.startsWith('•') || text.startsWith('-') || text.startsWith('*')) {
        elements.push({
          type: 'bullet',
          text: text.replace(/^[•\-\*]\s*/, ''),
          pageNum: page.pageNumber
        });
      } else if (/^\d+\.\s+/.test(text)) {
        const numMatch = text.match(/^(\d+\.)\s+(.*)$/);
        elements.push({
          type: 'numbered',
          num: numMatch ? numMatch[1] : '',
          text: numMatch ? numMatch[2] : text,
          pageNum: page.pageNumber
        });
      } else {
        // Check for bold lead-in phrases (e.g. "The prototype. ", "Audit log. ")
        const leadInMatch = text.match(/^([A-Z][^.:]{1,35}[.:])\s+(.*)$/);
        const hasLeadInBold = leadInMatch && (line.items[0]?.isBold || line.items[0]?.fontName.includes('f3'));

        if (hasLeadInBold && leadInMatch) {
          elements.push({
            type: 'leadin_paragraph',
            leadIn: leadInMatch[1],
            text: leadInMatch[2],
            pageNum: page.pageNumber
          });
        } else {
          elements.push({
            type: 'paragraph',
            text,
            pageNum: page.pageNumber
          });
        }
      }

      lineIdx++;
    }
  }

  return {
    title: docTitle,
    elements,
    pageCount: doc.pageCount,
    runningHeader: doc.detectedDocTitle
  };
}
