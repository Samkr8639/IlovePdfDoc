import { LayoutPage, LayoutLine, LayoutBox, LayoutSegment, TextRun } from '../pdf-layout';
import { PdfToExcelOptions } from '@paperflow/contracts';

export interface DetectedCell {
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  runs?: TextRun[];
  isHeader?: boolean;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface TableBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DetectedTable {
  id: string;
  page: number;
  file?: string;
  bbox: TableBoundingBox;
  rows: number;
  cols: number;
  grid: (DetectedCell | null)[][];
  cells: DetectedCell[];
  title?: string;
  method: 'lattice' | 'stream' | 'ocr';
  confidence: number;
  headerRows: number;
  hasHeader: boolean;
  colWidths?: number[];
  demotedToText?: boolean;
}

interface InternalLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  vertical: boolean;
  thickness: number;
  color?: string;
}

/**
 * Snap coordinates within a given tolerance
 */
function snapValue(val: number, points: number[], tolerance = 1.5): number {
  for (const p of points) {
    if (Math.abs(val - p) <= tolerance) {
      return p;
    }
  }
  return val;
}

/**
 * Collect horizontal and vertical line segments from layout lines and boxes
 */
function extractRulingLines(page: LayoutPage): { hLines: InternalLine[]; vLines: InternalLine[] } {
  const hLines: InternalLine[] = [];
  const vLines: InternalLine[] = [];

  // 1. Collect lines from page.lines
  if (page.lines && page.lines.length > 0) {
    for (const l of page.lines) {
      const isVertical = l.vertical || (l.h > l.w && l.h >= 5 && l.w <= 4);
      const isHorizontal = !l.vertical || (l.w > l.h && l.w >= 5 && l.h <= 4);

      if (isVertical) {
        vLines.push({
          x0: l.x,
          y0: l.y,
          x1: l.x,
          y1: l.y + l.h,
          vertical: true,
          thickness: l.thickness || 1,
          color: l.color
        });
      } else if (isHorizontal) {
        hLines.push({
          x0: l.x,
          y0: l.y,
          x1: l.x + l.w,
          y1: l.y,
          vertical: false,
          thickness: l.thickness || 1,
          color: l.color
        });
      }
    }
  }

  // 2. Collect 4 edges from stroked and filled boxes (excluding full-page white backgrounds)
  if (page.boxes && page.boxes.length > 0) {
    for (const b of page.boxes) {
      if (b.w <= 0 || b.h <= 0) continue;
      // Skip page backgrounds (white or nearly page-sized)
      const isPageBg = (b.w >= page.width - 10 && b.h >= page.height - 10);
      const isWhite = !b.fill || b.fill.toUpperCase() === '#FFFFFF' || b.fill.toUpperCase() === '#FFF';
      if (isPageBg && isWhite) continue;

      const lw = b.lw || 1;
      // Top horizontal line
      hLines.push({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y, vertical: false, thickness: lw, color: b.stroke || b.fill });
      // Bottom horizontal line
      hLines.push({ x0: b.x, y0: b.y + b.h, x1: b.x + b.w, y1: b.y + b.h, vertical: false, thickness: lw, color: b.stroke || b.fill });
      // Left vertical line
      vLines.push({ x0: b.x, y0: b.y, x1: b.x, y1: b.y + b.h, vertical: true, thickness: lw, color: b.stroke || b.fill });
      // Right vertical line
      vLines.push({ x0: b.x + b.w, y0: b.y, x1: b.x + b.w, y1: b.y + b.h, vertical: true, thickness: lw, color: b.stroke || b.fill });
    }
  }

  // 3. Snap coordinates
  const uniqueY: number[] = [];
  for (const hl of hLines) {
    hl.y0 = snapValue(hl.y0, uniqueY, 1.5);
    hl.y1 = hl.y0;
    if (!uniqueY.includes(hl.y0)) uniqueY.push(hl.y0);
  }

  const uniqueX: number[] = [];
  for (const vl of vLines) {
    vl.x0 = snapValue(vl.x0, uniqueX, 1.5);
    vl.x1 = vl.x0;
    if (!uniqueX.includes(vl.x0)) uniqueX.push(vl.x0);
  }

  // Merge collinear horizontal lines that touch or have gap <= 2.5 pt
  const mergedHLines: InternalLine[] = [];
  const hByY = new Map<number, InternalLine[]>();
  for (const hl of hLines) {
    const list = hByY.get(hl.y0) || [];
    list.push(hl);
    hByY.set(hl.y0, list);
  }

  for (const [, list] of hByY.entries()) {
    list.sort((a, b) => a.x0 - b.x0);
    let current = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      if (next.x0 <= current.x1 + 2.5) {
        current.x1 = Math.max(current.x1, next.x1);
      } else {
        mergedHLines.push(current);
        current = { ...next };
      }
    }
    mergedHLines.push(current);
  }

  // Merge collinear vertical lines that touch or have gap <= 2.5 pt
  const mergedVLines: InternalLine[] = [];
  const vByX = new Map<number, InternalLine[]>();
  for (const vl of vLines) {
    const list = vByX.get(vl.x0) || [];
    list.push(vl);
    vByX.set(vl.x0, list);
  }

  for (const [, list] of vByX.entries()) {
    list.sort((a, b) => a.y0 - b.y0);
    let current = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      if (next.y0 <= current.y1 + 2.5) {
        current.y1 = Math.max(current.y1, next.y1);
      } else {
        mergedVLines.push(current);
        current = { ...next };
      }
    }
    mergedVLines.push(current);
  }

  return { hLines: mergedHLines, vLines: mergedVLines };
}

/**
 * Check if a horizontal line segment exists roughly spanning [x0, x1] at y
 */
function hasHBorder(hLines: InternalLine[], y: number, x0: number, x1: number, tol = 2.0): boolean {
  const reqLen = x1 - x0;
  for (const hl of hLines) {
    if (Math.abs(hl.y0 - y) <= tol) {
      const overlapStart = Math.max(x0, hl.x0);
      const overlapEnd = Math.min(x1, hl.x1);
      if (overlapEnd - overlapStart >= 0.7 * reqLen) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a vertical line segment exists roughly spanning [y0, y1] at x
 */
function hasVBorder(vLines: InternalLine[], x: number, y0: number, y1: number, tol = 2.0): boolean {
  const reqLen = y1 - y0;
  for (const vl of vLines) {
    if (Math.abs(vl.x0 - x) <= tol) {
      const overlapStart = Math.max(y0, vl.y0);
      const overlapEnd = Math.min(y1, vl.y1);
      if (overlapEnd - overlapStart >= 0.7 * reqLen) {
        return true;
      }
    }
  }
  return false;
}

/**
 * LATTICE (ruled tables) detection
 */
export function detectLatticeTables(page: LayoutPage, pageNumber: number): DetectedTable[] {
  const { hLines, vLines } = extractRulingLines(page);
  if (hLines.length < 2 || vLines.length < 2) {
    return [];
  }

  // Find line intersection points
  const intersections: { x: number; y: number }[] = [];
  for (const hl of hLines) {
    for (const vl of vLines) {
      if (
        vl.x0 >= hl.x0 - 2.5 &&
        vl.x0 <= hl.x1 + 2.5 &&
        hl.y0 >= vl.y0 - 2.5 &&
        hl.y0 <= vl.y1 + 2.5
      ) {
        intersections.push({ x: vl.x0, y: hl.y0 });
      }
    }
  }

  if (intersections.length < 4) return [];

  const allX = Array.from(new Set(intersections.map(p => p.x))).sort((a, b) => a - b);
  const allY = Array.from(new Set(intersections.map(p => p.y))).sort((a, b) => a - b);

  const clusteredX: number[] = [];
  for (const x of allX) {
    const existing = clusteredX.find(cx => Math.abs(cx - x) <= 2.0);
    if (!existing) clusteredX.push(x);
  }
  clusteredX.sort((a, b) => a - b);

  const clusteredY: number[] = [];
  for (const y of allY) {
    const existing = clusteredY.find(cy => Math.abs(cy - y) <= 2.0);
    if (!existing) clusteredY.push(y);
  }
  clusteredY.sort((a, b) => a - b);

  if (clusteredX.length < 2 || clusteredY.length < 2) return [];

  interface RawGridCell {
    c: number;
    r: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  }

  const rawCells: RawGridCell[] = [];
  for (let r = 0; r < clusteredY.length - 1; r++) {
    const y0 = clusteredY[r];
    const y1 = clusteredY[r + 1];
    if (y1 - y0 < 5) continue;

    for (let c = 0; c < clusteredX.length - 1; c++) {
      const x0 = clusteredX[c];
      const x1 = clusteredX[c + 1];
      if (x1 - x0 < 8) continue;

      const top = hasHBorder(hLines, y0, x0, x1);
      const bottom = hasHBorder(hLines, y1, x0, x1);
      const left = hasVBorder(vLines, x0, y0, y1);
      const right = hasVBorder(vLines, x1, y0, y1);

      const hasSide = (left || right);
      const hasHoriz = (top || bottom);
      const borderCount = (top ? 1 : 0) + (bottom ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);

      // Must have both horizontal and vertical bounds to be part of a real table grid
      if (borderCount >= 3 || (borderCount === 2 && hasSide && hasHoriz)) {
        rawCells.push({ c, r, x0, y0, x1, y1, top, bottom, left, right });
      }
    }
  }

  if (rawCells.length < 4) return [];

  // Cluster raw cells into connected table components
  const visited = new Set<number>();
  const tableComponents: RawGridCell[][] = [];

  for (let i = 0; i < rawCells.length; i++) {
    if (visited.has(i)) continue;
    const comp: RawGridCell[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const currIdx = queue.shift()!;
      const curr = rawCells[currIdx];
      comp.push(curr);

      for (let j = 0; j < rawCells.length; j++) {
        if (visited.has(j)) continue;
        const other = rawCells[j];
        // Adjacent cells in the grid: either same row and adjacent cols, or same col and adjacent rows
        const isHorizNeighbor = Math.abs(curr.y0 - other.y0) <= 2 && Math.abs(curr.y1 - other.y1) <= 2 &&
          (Math.abs(curr.x1 - other.x0) <= 3 || Math.abs(other.x1 - curr.x0) <= 3);
        const isVertNeighbor = Math.abs(curr.x0 - other.x0) <= 2 && Math.abs(curr.x1 - other.x1) <= 2 &&
          (Math.abs(curr.y1 - other.y0) <= 3 || Math.abs(other.y1 - curr.y0) <= 3);

        if (isHorizNeighbor || isVertNeighbor) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    if (comp.length >= 4) {
      tableComponents.push(comp);
    }
  }

  const detectedTables: DetectedTable[] = [];

  for (let tIdx = 0; tIdx < tableComponents.length; tIdx++) {
    const comp = tableComponents[tIdx];

    const tableX = Array.from(new Set(comp.flatMap(cell => [cell.x0, cell.x1]))).sort((a, b) => a - b);
    const tableY = Array.from(new Set(comp.flatMap(cell => [cell.y0, cell.y1]))).sort((a, b) => a - b);

    const numRows = tableY.length - 1;
    const numCols = tableX.length - 1;

    if (numRows < 2 || numCols < 2) continue;

    const minX = tableX[0];
    const maxX = tableX[tableX.length - 1];
    const minY = tableY[0];
    const maxY = tableY[tableY.length - 1];

    const grid: (DetectedCell | null)[][] = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => null)
    );

    const cellCovered = Array.from({ length: numRows }, () => Array.from({ length: numCols }, () => false));
    const cells: DetectedCell[] = [];
    let enclosedCellCount = 0;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (cellCovered[r][c]) continue;

        const x0 = tableX[c];
        const y0 = tableY[r];

        let colSpan = 1;
        while (c + colSpan < numCols) {
          const rightX = tableX[c + colSpan];
          if (hasVBorder(vLines, rightX, y0, tableY[r + 1], 2.0)) {
            break;
          }
          colSpan++;
        }

        let rowSpan = 1;
        while (r + rowSpan < numRows) {
          const bottomY = tableY[r + rowSpan];
          if (hasHBorder(hLines, bottomY, x0, tableX[c + colSpan], 2.0)) {
            break;
          }
          rowSpan++;
        }

        const x1 = tableX[c + colSpan];
        const y1 = tableY[r + rowSpan];

        const hasTop = hasHBorder(hLines, y0, x0, x1);
        const hasBottom = hasHBorder(hLines, y1, x0, x1);
        const hasLeft = hasVBorder(vLines, x0, y0, y1);
        const hasRight = hasVBorder(vLines, x1, y0, y1);
        if (hasTop && hasBottom && hasLeft && hasRight) {
          enclosedCellCount += colSpan * rowSpan;
        }

        const cell: DetectedCell = {
          row: r,
          col: c,
          colSpan: colSpan > 1 ? colSpan : undefined,
          rowSpan: rowSpan > 1 ? rowSpan : undefined,
          x0,
          y0,
          x1,
          y1,
          text: ''
        };

        for (let dr = 0; dr < rowSpan; dr++) {
          for (let dc = 0; dc < colSpan; dc++) {
            cellCovered[r + dr][c + dc] = true;
            grid[r + dr][c + dc] = cell;
          }
        }
        cells.push(cell);
      }
    }

    const totalSlots = numRows * numCols;
    const enclosureRatio = enclosedCellCount / Math.max(1, totalSlots);
    if (enclosureRatio < 0.5) {
      continue;
    }

    assignTextToGrid(cells, page.segments || []);
    const { hasHeader, headerRows } = detectHeaderRow(grid, page);

    const filledCells = cells.filter(cell => cell.text.trim().length > 0).length;
    const fillRatio = filledCells / Math.max(1, cells.length);
    const confidence = Math.min(1, Math.max(0, 0.5 * enclosureRatio + 0.5 * fillRatio));
    const title = findTableTitle(page, minY, minX, maxX);

    detectedTables.push({
      id: `table_p${pageNumber}_l${tIdx + 1}`,
      page: pageNumber,
      bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY },
      rows: numRows,
      cols: numCols,
      grid,
      cells,
      title,
      method: 'lattice',
      confidence,
      headerRows,
      hasHeader,
      colWidths: tableX.slice(1).map((x, i) => x - tableX[i])
    });
  }

  return detectedTables;
}

/**
 * Assign text segments to cells
 */
function assignTextToGrid(cells: DetectedCell[], segments: LayoutSegment[]): void {
  const sortedSegments = [...segments].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const seg of sortedSegments) {
    const segText = seg.text || seg.runs?.map(r => r.text).join('') || '';
    if (!segText.trim()) continue;

    const segY = seg.yb || seg.y;
    const segX0 = seg.x0 !== undefined ? seg.x0 : seg.x;
    const segX1 = seg.x1 !== undefined ? seg.x1 : (seg.x + (seg.width || 0));
    const segCenterX = (segX0 + segX1) / 2;

    let matchedCell = cells.find(c =>
      segCenterX >= c.x0 - 2 &&
      segCenterX <= c.x1 + 2 &&
      segY >= c.y0 - 2 &&
      segY <= c.y1 + 4
    );

    if (!matchedCell) {
      matchedCell = cells.find(c => {
        const xOverlap = Math.max(0, Math.min(segX1, c.x1) - Math.max(segX0, c.x0));
        const yOverlap = segY >= c.y0 - 1 && segY <= c.y1 + 3;
        return yOverlap && xOverlap >= 0.5 * (segX1 - segX0);
      });
    }

    if (matchedCell) {
      if (matchedCell.text) {
        matchedCell.text += '\n' + segText.trim();
      } else {
        matchedCell.text = segText.trim();
      }
      if (!matchedCell.runs) matchedCell.runs = [];
      if (seg.runs) matchedCell.runs.push(...seg.runs);

      if (seg.runs && seg.runs.length > 0) {
        if (seg.runs[0].bold) matchedCell.bold = true;
        if (seg.runs[0].italic) matchedCell.italic = true;
      }
    }
  }

  for (const c of cells) {
    c.text = c.text.trim();
  }
}

/**
 * STREAM (borderless tables) detection
 */
export function detectStreamTables(
  page: LayoutPage,
  pageNumber: number,
  existingLatticeBBoxes: TableBoundingBox[] = []
): DetectedTable[] {
  const segments = page.segments || [];
  if (segments.length < 6) return [];

  const candidateSegments = segments.filter(seg => {
    const cx = (seg.x + (seg.right || seg.x + seg.width)) / 2;
    const cy = seg.y;
    return !existingLatticeBBoxes.some(b =>
      cx >= b.x0 - 2 && cx <= b.x1 + 2 && cy >= b.y0 - 2 && cy <= b.y1 + 2
    );
  });

  if (candidateSegments.length < 6) return [];

  const rows: { y: number; fs: number; segments: LayoutSegment[] }[] = [];
  const sorted = [...candidateSegments].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const seg of sorted) {
    const fs = seg.fs || 10;
    const row = rows.find(r => Math.abs(r.y - seg.y) <= 0.35 * Math.min(r.fs, fs));
    if (row) {
      row.segments.push(seg);
      row.y = (row.y * (row.segments.length - 1) + seg.y) / row.segments.length;
    } else {
      rows.push({ y: seg.y, fs, segments: [seg] });
    }
  }

  for (const r of rows) {
    r.segments.sort((a, b) => a.x - b.x);
  }

  const multiColRowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].segments.length >= 2) {
      multiColRowIndices.push(i);
    }
  }

  if (multiColRowIndices.length < 3) return [];

  const tableRowGroups: typeof rows[] = [];
  let currentGroup: typeof rows = [rows[multiColRowIndices[0]]];

  for (let i = 1; i < multiColRowIndices.length; i++) {
    const prevRow = currentGroup[currentGroup.length - 1];
    const currRow = rows[multiColRowIndices[i]];
    const gap = currRow.y - prevRow.y;
    const maxGap = 2.5 * Math.max(prevRow.fs, currRow.fs);

    if (gap <= maxGap) {
      currentGroup.push(currRow);
    } else {
      if (currentGroup.length >= 3) {
        tableRowGroups.push(currentGroup);
      }
      currentGroup = [currRow];
    }
  }
  if (currentGroup.length >= 3) {
    tableRowGroups.push(currentGroup);
  }

  const detectedTables: DetectedTable[] = [];

  for (let gIdx = 0; gIdx < tableRowGroups.length; gIdx++) {
    const group = tableRowGroups[gIdx];

    const allIntervals = group.flatMap(r =>
      r.segments.map(s => ({
        x0: s.x0 !== undefined ? s.x0 : s.x,
        x1: s.x1 !== undefined ? s.x1 : (s.x + (s.width || 0))
      }))
    );

    const minX = Math.min(...allIntervals.map(i => i.x0));
    const maxX = Math.max(...allIntervals.map(i => i.x1));
    const minY = group[0].y - group[0].fs;
    const maxY = group[group.length - 1].y + 4;

    const leftEdges = allIntervals.map(i => i.x0).sort((a, b) => a - b);
    const clusteredLefts: number[] = [];
    for (const le of leftEdges) {
      const match = clusteredLefts.find(c => Math.abs(c - le) <= 8.0);
      if (!match) clusteredLefts.push(le);
    }
    clusteredLefts.sort((a, b) => a - b);

    if (clusteredLefts.length < 2) continue;

    const validColLefts: number[] = [];
    for (const cl of clusteredLefts) {
      let count = 0;
      for (const r of group) {
        if (r.segments.some(s => Math.abs(s.x - cl) <= 10.0)) {
          count++;
        }
      }
      if (count >= 2 || count >= 0.4 * group.length) {
        validColLefts.push(cl);
      }
    }

    if (validColLefts.length < 2) continue;

    const numCols = validColLefts.length;
    const numRows = group.length;

    const colBounds: { x0: number; x1: number }[] = [];
    for (let c = 0; c < numCols; c++) {
      const x0 = validColLefts[c] - 2;
      const x1 = c < numCols - 1 ? (validColLefts[c + 1] - 4) : (maxX + 4);
      colBounds.push({ x0, x1 });
    }

    const grid: (DetectedCell | null)[][] = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => null)
    );
    const cells: DetectedCell[] = [];

    let alignedSegmentsCount = 0;
    let totalSegmentsInGroup = 0;

    for (let r = 0; r < numRows; r++) {
      const rowData = group[r];
      totalSegmentsInGroup += rowData.segments.length;

      for (let c = 0; c < numCols; c++) {
        const bounds = colBounds[c];
        const segsInCol = rowData.segments.filter(s => {
          const sx = s.x0 !== undefined ? s.x0 : s.x;
          const sRight = s.x1 !== undefined ? s.x1 : (s.x + (s.width || 0));
          const scx = (sx + sRight) / 2;
          return scx >= bounds.x0 && scx <= bounds.x1;
        });

        if (segsInCol.length > 0) {
          alignedSegmentsCount += segsInCol.length;
        }

        const cellText = segsInCol.map(s => s.text || s.runs?.map(rn => rn.text).join('') || '').join(' ').trim();
        const cellRuns = segsInCol.flatMap(s => s.runs || []);

        const cell: DetectedCell = {
          row: r,
          col: c,
          x0: bounds.x0,
          y0: rowData.y - rowData.fs,
          x1: bounds.x1,
          y1: rowData.y + 4,
          text: cellText,
          runs: cellRuns,
          bold: cellRuns.some(rn => rn.bold),
          italic: cellRuns.some(rn => rn.italic)
        };

        grid[r][c] = cell;
        cells.push(cell);
      }
    }

    const alignmentRatio = alignedSegmentsCount / Math.max(1, totalSegmentsInGroup);
    if (alignmentRatio < 0.65) continue;

    const { hasHeader, headerRows } = detectHeaderRow(grid, page);
    const filledCount = cells.filter(cell => cell.text.trim().length > 0).length;
    const fillRatio = filledCount / Math.max(1, cells.length);
    const confidence = Math.min(0.95, Math.max(0.35, 0.5 * alignmentRatio + 0.5 * fillRatio));
    const title = findTableTitle(page, minY, minX, maxX);

    detectedTables.push({
      id: `table_p${pageNumber}_s${gIdx + 1}`,
      page: pageNumber,
      bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY },
      rows: numRows,
      cols: numCols,
      grid,
      cells,
      title,
      method: 'stream',
      confidence,
      headerRows,
      hasHeader,
      colWidths: colBounds.map(b => b.x1 - b.x0)
    });
  }

  return detectedTables;
}

/**
 * Detect whether the first row is a header
 */
function detectHeaderRow(
  grid: (DetectedCell | null)[][],
  page: LayoutPage
): { hasHeader: boolean; headerRows: number } {
  if (grid.length < 2) return { hasHeader: false, headerRows: 0 };

  const firstRow = grid[0].filter((c): c is DetectedCell => c !== null && c.text.trim().length > 0);
  const secondRow = grid[1].filter((c): c is DetectedCell => c !== null && c.text.trim().length > 0);

  if (firstRow.length === 0) return { hasHeader: false, headerRows: 0 };

  const boldCount = firstRow.filter(c => c.bold || (c.runs && c.runs.some(r => r.bold))).length;
  if (boldCount >= 0.5 * firstRow.length) {
    for (const c of grid[0]) {
      if (c) c.isHeader = true;
    }
    return { hasHeader: true, headerRows: 1 };
  }

  if (page.boxes && page.boxes.length > 0 && firstRow.length > 0) {
    const firstCell = firstRow[0];
    const isShaded = page.boxes.some(b =>
      b.fill &&
      b.fill.toUpperCase() !== '#FFFFFF' &&
      b.fill.toUpperCase() !== '#FFF' &&
      Math.abs(b.y - firstCell.y0) <= 5 &&
      b.h >= (firstCell.y1 - firstCell.y0) * 0.7
    );
    if (isShaded) {
      for (const c of grid[0]) {
        if (c) c.isHeader = true;
      }
      return { hasHeader: true, headerRows: 1 };
    }
  }

  if (secondRow.length > 0) {
    const fs1 = Math.max(...firstRow.flatMap(c => c.runs?.map(r => r.fs) || [10]));
    const fs2 = Math.max(...secondRow.flatMap(c => c.runs?.map(r => r.fs) || [10]));
    if (fs1 > fs2 * 1.15) {
      for (const c of grid[0]) {
        if (c) c.isHeader = true;
      }
      return { hasHeader: true, headerRows: 1 };
    }
  }

  return { hasHeader: false, headerRows: 0 };
}

/**
 * Search for table title text immediately above the table bounding box
 */
function findTableTitle(page: LayoutPage, tableTopY: number, tableX0: number, tableX1: number): string | undefined {
  const segments = page.segments || [];
  const candidateSegments = segments.filter(seg => {
    const sy = seg.yb || seg.y;
    const sx = seg.x0 !== undefined ? seg.x0 : seg.x;
    return sy < tableTopY && sy >= tableTopY - 32 && sx >= tableX0 - 20 && sx <= tableX1 + 20;
  });

  if (candidateSegments.length > 0) {
    candidateSegments.sort((a, b) => (b.yb || b.y) - (a.yb || a.y));
    const titleText = candidateSegments[0].text || candidateSegments[0].runs?.map(r => r.text).join('') || '';
    const clean = titleText.replace(/[\[\]:*?/\\]/g, ' ').trim();
    if (clean.length > 0 && clean.length <= 60) {
      return clean;
    }
  }

  return undefined;
}

/**
 * Main detection pipeline for a single page
 */
export function detectTablesOnPage(page: LayoutPage, pageNumber: number): DetectedTable[] {
  const latticeTables = detectLatticeTables(page, pageNumber);
  const latticeBBoxes = latticeTables.map(t => t.bbox);
  const streamTables = detectStreamTables(page, pageNumber, latticeBBoxes);

  const allTables = [...latticeTables, ...streamTables].sort((a, b) => a.bbox.y0 - b.bbox.y0);

  for (const t of allTables) {
    if (t.confidence < 0.35) {
      t.demotedToText = true;
    }
  }

  return allTables;
}

/**
 * Cross-page table merging
 */
export function mergeCrossPageTables(
  pageTables: { pageNumber: number; tables: DetectedTable[] }[],
  mergeAcrossPages = true
): DetectedTable[] {
  if (!mergeAcrossPages || pageTables.length < 2) {
    return pageTables.flatMap(pt => pt.tables);
  }

  const result: DetectedTable[] = [];

  for (let pIdx = 0; pIdx < pageTables.length; pIdx++) {
    const { pageNumber, tables } = pageTables[pIdx];

    for (const currTable of tables) {
      if (result.length > 0) {
        const prevTable = result[result.length - 1];
        const isConsecutivePage = (pageNumber === prevTable.page + 1);
        const sameColCount = (currTable.cols === prevTable.cols);

        const colPosMatch = !currTable.colWidths || !prevTable.colWidths ||
          currTable.colWidths.every((w, idx) => Math.abs(w - (prevTable.colWidths?.[idx] || 0)) <= 4.0);

        const startsNearTop = currTable.bbox.y0 <= 150;

        if (isConsecutivePage && sameColCount && colPosMatch && startsNearTop) {
          const prevHeaderTexts = prevTable.grid[0]?.map(c => c?.text.trim().toLowerCase() || '') || [];
          const currFirstRowTexts = currTable.grid[0]?.map(c => c?.text.trim().toLowerCase() || '') || [];

          const isRepeatedHeader = prevHeaderTexts.length > 0 &&
            prevHeaderTexts.every((txt, idx) => txt === currFirstRowTexts[idx]);

          const startRow = isRepeatedHeader ? 1 : 0;
          const newRowsCount = prevTable.rows + (currTable.rows - startRow);
          const extendedGrid = [...prevTable.grid];

          for (let r = startRow; r < currTable.rows; r++) {
            const rowCells = currTable.grid[r].map(c => {
              if (!c) return null;
              return {
                ...c,
                row: prevTable.rows + (r - startRow)
              };
            });
            extendedGrid.push(rowCells);
          }

          prevTable.grid = extendedGrid;
          prevTable.rows = newRowsCount;
          prevTable.cells = extendedGrid.flat().filter((c): c is DetectedCell => c !== null);
          prevTable.bbox.y1 = currTable.bbox.y1;
          continue;
        }
      }

      result.push(currTable);
    }
  }

  return result;
}
