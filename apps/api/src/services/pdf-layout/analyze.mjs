import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PNG } from 'pngjs';

// Matrix math helpers for 2D affine transforms
function mul(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function apply(m, x, y) {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5]
  };
}

function det(m) {
  return m[0] * m[3] - m[1] * m[2];
}

function parseColor(args) {
  if (!args || args.length === 0) return '#000000';
  if (typeof args[0] === 'string') {
    return args[0].startsWith('#') ? args[0].toUpperCase() : `#${args[0]}`.toUpperCase();
  }
  if (args.length >= 3) {
    const c = (v) => {
      const n = (v <= 1 && v >= 0) ? Math.round(v * 255) : Math.round(v);
      return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    };
    return `#${c(args[0])}${c(args[1])}${c(args[2])}`.toUpperCase();
  }
  return '#000000';
}

function cleanFontName(rawName) {
  if (!rawName) return { family: 'Arial', bold: false, italic: false };
  const stripped = rawName.replace(/^[A-Z]{6}\+/, '');
  const bold = /bold|black|heavy|semibold|demi/i.test(stripped);
  const italic = /italic|oblique/i.test(stripped);
  let family = stripped
    .replace(/-(Regular|Bold|Italic|Light|Thin|Medium|Black|SemiBold|BoldItalic|Oblique).*$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/MT$/i, '')
    .trim();
  if (!family) family = 'Arial';
  return { family, bold, italic, stripped };
}

function sanitizePdfText(str) {
  if (!str) return '';
  // In PDFs (such as Stripe/Chromium generated invoices), glyph 0 (\u0000) is used for '-' or '–'
  let s = str.replace(/\u0000/g, '-');
  // Strip XML 1.0 illegal control characters
  s = s.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]/g, '');
  return s;
}

/**
 * STEP 1: Scans a PDF buffer and produces a layout model with exact points.
 */
export async function analyzePdf(buffer, opts = {}) {
  const warnings = [];
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    useSystemFonts: false,
    fontExtraProperties: true,
    isEvalSupported: false
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];
  let detectedTitle = '';

  try {
    const metadata = await pdfDoc.getMetadata();
    if (metadata?.info?.Title) {
      detectedTitle = String(metadata.info.Title).trim();
    }
  } catch {
    // Ignore metadata retrieval errors
  }

  const OPS = pdfjsLib.OPS;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const view = page.view; // [x1, y1, x2, y2]
    const pageWidth = view[2] - view[0];
    const pageHeight = view[3] - view[1];

    const opList = await page.getOperatorList();
    const fnArray = opList.fnArray;
    const argsArray = opList.argsArray;

    // Graphics state tracking
    let ctm = [1, 0, 0, 1, 0, 0];
    let tm = [1, 0, 0, 1, 0, 0];
    let fillColor = '#000000';
    let strokeColor = '#000000';
    let lineWidth = 1.0;
    let dashArray = [];
    let dashPhase = 0;
    const stateStack = [];

    // Text color anchors: key(round(x*2), round(y*2)) -> hex color
    const anchors = new Map();

    const rawRects = [];
    const images = [];
    let skippedComplexShapesCount = 0;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];

      if (fn === OPS.save) {
        stateStack.push({
          ctm: [...ctm],
          fillColor,
          strokeColor,
          lineWidth,
          dashArray: [...dashArray],
          dashPhase
        });
      } else if (fn === OPS.restore) {
        if (stateStack.length > 0) {
          const s = stateStack.pop();
          ctm = s.ctm;
          fillColor = s.fillColor;
          strokeColor = s.strokeColor;
          lineWidth = s.lineWidth;
          dashArray = s.dashArray;
          dashPhase = s.dashPhase;
        }
      } else if (fn === OPS.transform) {
        ctm = mul(ctm, args);
      } else if (fn === OPS.setFillRGBColor) {
        fillColor = parseColor(args);
      } else if (fn === OPS.setStrokeRGBColor) {
        strokeColor = parseColor(args);
      } else if (fn === OPS.setLineWidth) {
        lineWidth = args[0] || 1.0;
      } else if (fn === OPS.setGState) {
        // args is array of [[key, val]]
        if (Array.isArray(args[0])) {
          for (const item of args[0]) {
            if (Array.isArray(item)) {
              const [k, v] = item;
              if (k === 'LW') lineWidth = Number(v) || lineWidth;
              if (k === 'D') {
                dashArray = v[0] || [];
                dashPhase = v[1] || 0;
              }
            }
          }
        }
      } else if (fn === OPS.beginText) {
        tm = [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.setTextMatrix) {
        // pdf.js v6 wraps Float32Array
        const raw = Array.from(args.length === 1 && (args[0] instanceof Float32Array || Array.isArray(args[0]) || args[0].length === 6) ? args[0] : args);
        tm = raw;
      } else if (fn === OPS.moveText) {
        tm = mul(tm, [1, 0, 0, 1, args[0], args[1]]);
      } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
        const m = mul(ctm, tm);
        const k = `${Math.round(m[4] * 2)},${Math.round(m[5] * 2)}`;
        anchors.set(k, fillColor);
      } else if (fn === OPS.constructPath) {
        const paintOp = args[0];
        // console.log('Hit constructPath:', paintOp, 'subpaths:', args[1]?.length);
        if (paintOp === OPS.endPath) continue;

        const isFill = (paintOp === OPS.fill || paintOp === OPS.eoFill || paintOp === OPS.fillStroke || paintOp === OPS.eoFillStroke);
        const isStroke = (paintOp === OPS.stroke || paintOp === OPS.fillStroke || paintOp === OPS.eoFillStroke);

        if (!isFill && !isStroke) {
          // console.log('Neither fill nor stroke:', paintOp);
          continue;
        }

        const subpaths = args[1] || [];
        for (const sp of subpaths) {
          let idx = 0;
          const pts = [];
          let hasCurves = false;

          while (idx < sp.length) {
            const cmd = sp[idx];
            if (cmd === 0 || cmd === 1) { // moveTo, lineTo
              const rawPt = apply(ctm, sp[idx + 1], sp[idx + 2]);
              pts.push({
                x: rawPt.x - view[0],
                y: pageHeight - (rawPt.y - view[1])
              });
              idx += 3;
            } else if (cmd === 2) { // curveTo
              hasCurves = true;
              const rawPt = apply(ctm, sp[idx + 5], sp[idx + 6]);
              pts.push({
                x: rawPt.x - view[0],
                y: pageHeight - (rawPt.y - view[1])
              });
              idx += 7;
            } else if (cmd === 3 || cmd === 4) { // close / quadTo
              idx += 1;
            } else {
              idx += 1;
            }
          }

          if (pts.length < 2) continue;

          const minX = Math.min(...pts.map(p => p.x));
          const maxX = Math.max(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y));
          const maxY = Math.max(...pts.map(p => p.y));
          const w = Math.max(0.1, maxX - minX);
          const h = Math.max(0.1, maxY - minY);

          // Check if axis-aligned rect (4-5 points without curves)
          const isAxisAligned = !hasCurves && (pts.length >= 4 && pts.length <= 6);
          const isRoundedBox = hasCurves && pts.length >= 4 && w > 8 && h > 8;

          if (isAxisAligned || isRoundedBox) {
            // console.log('Pushing to rawRects:', minX, minY, w, h);
            rawRects.push({
              x: minX,
              y: minY,
              w,
              h,
              isFill,
              fillColor,
              isStroke,
              strokeColor,
              lineWidth: lineWidth * Math.sqrt(Math.abs(det(ctm)))
            });
          } else {
            skippedComplexShapesCount++;
          }
        }
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
        try {
          const id = args[0];
          let imgObj = null;

          if (typeof id === 'string' && id.startsWith('g_')) {
            imgObj = await new Promise((res) => page.commonObjs.get(id, res));
          } else if (typeof id === 'string') {
            imgObj = await new Promise((res) => page.objs.get(id, res));
          } else if (id && typeof id === 'object') {
            imgObj = id;
          }

          if (imgObj && imgObj.width > 0 && imgObj.height > 0 && imgObj.data) {
            const png = new PNG({ width: imgObj.width, height: imgObj.height });
            if (imgObj.kind === 3) { // RGBA32
              png.data = Buffer.from(imgObj.data);
            } else if (imgObj.kind === 2) { // RGB24
              let sIdx = 0, dIdx = 0;
              while (sIdx < imgObj.data.length && dIdx < png.data.length) {
                png.data[dIdx++] = imgObj.data[sIdx++];
                png.data[dIdx++] = imgObj.data[sIdx++];
                png.data[dIdx++] = imgObj.data[sIdx++];
                png.data[dIdx++] = 255;
              }
            } else if (imgObj.kind === 1) { // Grayscale / 1bpp
              let sIdx = 0, dIdx = 0;
              while (sIdx < imgObj.data.length && dIdx < png.data.length) {
                const v = imgObj.data[sIdx++];
                png.data[dIdx++] = v;
                png.data[dIdx++] = v;
                png.data[dIdx++] = v;
                png.data[dIdx++] = 255;
              }
            } else {
              // Generic fallback
              png.data.fill(0);
            }

            const pngBuffer = PNG.sync.write(png);
            const c0 = apply(ctm, 0, 0);
            const c1 = apply(ctm, 1, 1);
            const imgX = Math.min(c0.x, c1.x) - view[0];
            const imgY = pageHeight - (Math.max(c0.y, c1.y) - view[1]);
            const imgW = Math.abs(c1.x - c0.x);
            const imgH = Math.abs(c1.y - c0.y);

            images.push({
              x: imgX,
              y: imgY,
              w: imgW,
              h: imgH,
              png: pngBuffer
            });
          }
        } catch (err) {
          warnings.push(`Page ${pageNum}: Image decode skipped - ${err.message}`);
        }
      }
    }

    if (skippedComplexShapesCount > 0) {
      warnings.push(`Page ${pageNum}: ${skippedComplexShapesCount} curved/complex vector shapes skipped`);
    }

    // Process rawRects into lines and boxes
    const lines = [];
    const boxes = [];
    const tinyDotFragments = [];

    for (const r of rawRects) {
      // Skip white background fills
      if (r.isFill && (r.fillColor === '#FFFFFF' || r.fillColor === '#FFF') && !r.isStroke) {
        continue;
      }

      // 1. Tiny filled rects (dash/dot fragments)
      if (r.isFill && r.w < 3 && r.h < 2.5 && !r.isStroke) {
        tinyDotFragments.push({
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          color: r.fillColor
        });
        continue;
      }

      // 2. Filled rect with min(w, h) <= 2.2 -> solid line
      if (r.isFill && Math.min(r.w, r.h) <= 2.2 && !r.isStroke) {
        const isVert = r.w < r.h;
        lines.push({
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          vertical: isVert,
          color: r.fillColor,
          style: 'solid',
          thickness: isVert ? r.w : r.h
        });
        continue;
      }

      // 3. General box (fill and/or stroke)
      const boxObj = {
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h
      };
      if (r.isFill && r.fillColor !== '#FFFFFF') {
        boxObj.fill = r.fillColor;
      }
      if (r.isStroke) {
        boxObj.stroke = r.strokeColor;
        boxObj.lw = Math.max(0.5, r.lineWidth);
      }
      if (boxObj.fill || boxObj.stroke) {
        boxes.push(boxObj);
      }
    }

    // Group and chain tiny dot fragments into dotted/dashed lines
    const dotGroups = new Map();
    for (const d of tinyDotFragments) {
      const k = `${Math.round(d.y * 4)}_${Math.round(d.h * 100)}_${d.color}`;
      if (!dotGroups.has(k)) dotGroups.set(k, []);
      dotGroups.get(k).push(d);
    }

    for (const [, rects] of dotGroups.entries()) {
      rects.sort((a, b) => a.x - b.x);
      let chain = [rects[0]];

      const emitChain = (ch) => {
        if (ch.length >= 3) {
          const first = ch[0];
          const last = ch[ch.length - 1];
          const totalW = (last.x + last.w) - first.x;
          const avgPitch = totalW / (ch.length - 1);
          const style = (first.w <= first.h * 1.6 || avgPitch < 3) ? 'dotted' : 'dashed';
          lines.push({
            x: first.x,
            y: first.y,
            w: totalW,
            h: first.h,
            vertical: false,
            color: first.color,
            style,
            thickness: Math.max(0.5, first.h)
          });
        } else {
          // Merge contiguous solid segments that touch or have gap <= 1.5pt
          const merged = [];
          for (const item of ch) {
            if (merged.length > 0) {
              const last = merged[merged.length - 1];
              const gap = item.x - (last.x + last.w);
              if (gap <= 1.5 && last.color === item.color && Math.abs(last.h - item.h) <= 0.5) {
                last.w = (item.x + item.w) - last.x;
                continue;
              }
            }
            merged.push({ ...item });
          }
          for (const item of merged) {
            lines.push({
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              vertical: false,
              color: item.color,
              style: 'solid',
              thickness: Math.max(0.5, item.h)
            });
          }
        }
      };

      for (let i = 1; i < rects.length; i++) {
        const curr = chain[chain.length - 1];
        const next = rects[i];
        const gap = next.x - (curr.x + curr.w);
        if (gap <= Math.max(6 * curr.w, 4)) {
          chain.push(next);
        } else {
          emitChain(chain);
          chain = [next];
        }
      }
      if (chain.length > 0) emitChain(chain);
    }

    // Resolve fonts from textContent.styles
    const textContent = await page.getTextContent();
    const fontMap = new Map();

    for (const [key, style] of Object.entries(textContent.styles)) {
      let fontObj = null;
      try {
        fontObj = await new Promise((res) => {
          const timer = setTimeout(() => res(null), 1500);
          page.commonObjs.get(key, (data) => {
            clearTimeout(timer);
            res(data);
          });
        });
      } catch {
        // Fallback to name parsing
      }

      const rawFontName = fontObj?.name || style.fontFamily || 'Arial';
      const parsed = cleanFontName(rawFontName);
      fontMap.set(key, {
        rawFont: rawFontName,
        family: parsed.family,
        bold: fontObj?.bold !== undefined ? fontObj.bold : parsed.bold,
        italic: fontObj?.italic !== undefined ? fontObj.italic : parsed.italic,
        generic: fontObj?.fallbackName || (style.sansSerif ? 'sans-serif' : 'serif')
      });
    }

    // Process Text Items
    const rawItems = [];
    for (const item of textContent.items) {
      const sanitized = sanitizePdfText(item.str);
      if (!sanitized || sanitized.trim() === '') continue;

      const fs = Math.hypot(item.transform[0], item.transform[1]);
      const x = item.transform[4] - view[0];
      const baselineY = pageHeight - (item.transform[5] - view[1]);
      const width = item.width;
      const right = x + width;

      // Color lookup from anchors
      const kX = Math.round(item.transform[4] * 2);
      const kY = Math.round(item.transform[5] * 2);
      let color = anchors.get(`${kX},${kY}`);

      if (!color) {
        for (let dx = -1; dx <= 1 && !color; dx++) {
          for (let dy = -1; dy <= 1 && !color; dy++) {
            color = anchors.get(`${kX + dx},${kY + dy}`);
          }
        }
      }
      color = color || '#000000';

      const fInfo = fontMap.get(item.fontName) || {
        family: 'Arial',
        rawFont: item.fontName,
        bold: false,
        italic: false,
        generic: 'sans-serif'
      };

      rawItems.push({
        text: sanitized,
        x,
        y: baselineY,
        width,
        right,
        fs,
        font: fInfo.family,
        rawFont: fInfo.rawFont,
        generic: fInfo.generic,
        bold: fInfo.bold,
        italic: fInfo.italic,
        color
      });
    }

    // Sort items by baseline y, then x
    rawItems.sort((a, b) => a.y - b.y || a.x - b.x);

    // Group items into rows by baseline (tolerance 0.3 * fs)
    const rows = [];
    for (const it of rawItems) {
      let r = rows.find(row => Math.abs(row.y - it.y) <= 0.3 * Math.min(row.fs, it.fs));
      if (!r) {
        r = { y: it.y, fs: it.fs, items: [] };
        rows.push(r);
      }
      r.items.push(it);
    }

    // Sort each row by x
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
    }

    // Split rows into segments when horizontal gap > 1.0 * fs
    const segments = [];
    for (const r of rows) {
      if (r.items.length === 0) continue;
      let seg = [r.items[0]];

      for (let i = 1; i < r.items.length; i++) {
        const prev = seg[seg.length - 1];
        const curr = r.items[i];
        const gap = curr.x - prev.right;

        if (gap > 1.0 * Math.max(prev.fs, curr.fs)) {
          segments.push(seg);
          seg = [curr];
        } else {
          seg.push(curr);
        }
      }
      if (seg.length > 0) segments.push(seg);
    }

    // In each segment, merge adjacent runs of identical style, insert space if gap > 0.12 * fs
    const processedSegments = [];
    for (const seg of segments) {
      const runs = [];
      let currentRun = { ...seg[0] };

      for (let i = 1; i < seg.length; i++) {
        const prev = seg[i - 1];
        const next = seg[i];
        const gap = next.x - prev.right;

        const sameStyle =
          currentRun.font === next.font &&
          Math.abs(currentRun.fs - next.fs) < 0.2 &&
          currentRun.color === next.color &&
          currentRun.bold === next.bold &&
          currentRun.italic === next.italic;

        const needsSpace = gap > 0.12 * Math.max(prev.fs, next.fs) &&
          !currentRun.text.endsWith(' ') &&
          !next.text.startsWith(' ');

        if (sameStyle) {
          if (needsSpace) currentRun.text += ' ';
          currentRun.text += next.text;
          currentRun.width = next.right - currentRun.x;
          currentRun.right = next.right;
        } else {
          runs.push(currentRun);
          currentRun = { ...next };
          if (needsSpace) {
            currentRun.text = ' ' + currentRun.text;
          }
        }
      }
      runs.push(currentRun);

      const segX = runs[0].x;
      const segRight = runs[runs.length - 1].right;
      const segY = runs[0].y;
      const segFs = runs[0].fs;

      processedSegments.push({
        x: segX,
        y: segY,
        width: segRight - segX,
        right: segRight,
        fs: segFs,
        runs
      });
    }

    // Identify multi-segment rows (rows that share baseline with another segment)
    // Multi-segment rows (columns, labels + values, tables, list numbers) must never be greedily merged across rows
    const multiSegmentIndices = new Set();
    for (let i = 0; i < processedSegments.length; i++) {
      for (let j = i + 1; j < processedSegments.length; j++) {
        const s1 = processedSegments[i];
        const s2 = processedSegments[j];
        if (Math.abs(s1.y - s2.y) <= 0.45 * Math.min(s1.fs, s2.fs)) {
          multiSegmentIndices.add(i);
          multiSegmentIndices.add(j);
        }
      }
    }

    // Group segments into multi-line blocks
    // Safe multi-line grouping ONLY for true isolated paragraphs:
    // 1. Neither the first segment nor candidates share their row with any other segment
    // 2. Same left x (±2.5pt)
    // 3. Same font size (±15%)
    // 4. Consecutive vertical pitch between 0.9*fs and 1.7*fs
    const blocks = [];
    const usedSegmentIndices = new Set();

    for (let i = 0; i < processedSegments.length; i++) {
      if (usedSegmentIndices.has(i)) continue;

      const firstSeg = processedSegments[i];
      usedSegmentIndices.add(i);

      const blockLines = [firstSeg.runs];
      let lastY = firstSeg.y;
      let initialPitch = null;
      let maxWidth = firstSeg.width;
      let maxRight = firstSeg.right;

      // Only attempt to merge multi-line paragraphs if this segment is NOT part of a multi-segment row
      if (!multiSegmentIndices.has(i)) {
        for (let j = i + 1; j < processedSegments.length; j++) {
          if (usedSegmentIndices.has(j)) continue;

          const candidate = processedSegments[j];

          // If the candidate is part of a multi-segment row, or is too far down, stop grouping
          if (multiSegmentIndices.has(j)) break;

          const currentPitch = candidate.y - lastY;
          if (currentPitch > 1.8 * firstSeg.fs) break; // Gap too large, paragraph ended

          const sameLeft = Math.abs(candidate.x - firstSeg.x) <= 2.5;
          const sameFs = Math.abs(candidate.fs - firstSeg.fs) <= 0.15 * firstSeg.fs;

          if (sameLeft && sameFs && currentPitch >= 0.85 * firstSeg.fs && currentPitch <= 1.75 * firstSeg.fs) {
            if (initialPitch === null || Math.abs(currentPitch - initialPitch) <= 0.12 * initialPitch) {
              if (initialPitch === null) initialPitch = currentPitch;
              blockLines.push(candidate.runs);
              lastY = candidate.y;
              maxWidth = Math.max(maxWidth, candidate.width);
              maxRight = Math.max(maxRight, candidate.right);
              usedSegmentIndices.add(j);
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }

      blocks.push({
        x: firstSeg.x,
        y: firstSeg.y, // baseline of first line
        pitch: initialPitch || (firstSeg.fs * 1.2),
        fs: firstSeg.fs,
        width: maxWidth,
        right: maxRight,
        align: 'left',
        lines: blockLines
      });
    }

    // Right-aligned columns: single-line block gets align:'right' when another
    // single-line block shares its right edge (±1.5pt) but has a different left edge (>3pt).
    // MUST satisfy:
    // 1. Column is not a full-width paragraph (width < pageWidth * 0.42)
    // 2. Right edge is on the right side of the page (right > pageWidth * 0.4)
    // 3. Left edge is NOT on the left margin (x > 50)
    for (let i = 0; i < blocks.length; i++) {
      const b1 = blocks[i];
      if (b1.lines.length !== 1) continue;
      if (b1.width >= pageWidth * 0.42) continue;
      if (b1.right <= pageWidth * 0.4) continue;
      if (b1.x <= 50) continue;

      for (let j = 0; j < blocks.length; j++) {
        if (i === j) continue;
        const b2 = blocks[j];
        if (b2.lines.length !== 1) continue;
        if (b2.width >= pageWidth * 0.42) continue;
        if (b2.right <= pageWidth * 0.4) continue;
        if (b2.x <= 50) continue;

        const sameRight = Math.abs(b1.right - b2.right) <= 1.5;
        const diffLeft = Math.abs(b1.x - b2.x) > 3.0;
        const verticalDist = Math.abs(b1.y - b2.y);

        if (sameRight && diffLeft && verticalDist < pageHeight * 0.5) {
          b1.align = 'right';
          b2.align = 'right';
        }
      }
    }

    // Consolidate touching/contiguous collinear horizontal line segments into single rules
    const consolidatedLines = [];
    const hLines = lines.filter(l => !l.vertical).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const hl of hLines) {
      if (consolidatedLines.length > 0) {
        const last = consolidatedLines[consolidatedLines.length - 1];
        const sameY = Math.abs(last.y - hl.y) <= 0.8;
        const sameColor = last.color === hl.color;
        const gap = hl.x - (last.x + last.w);
        if (sameY && sameColor && gap <= 1.5 && Math.abs(last.thickness - hl.thickness) <= 0.5) {
          last.w = (hl.x + hl.w) - last.x;
          last.h = Math.max(last.h, hl.h);
          continue;
        }
      }
      consolidatedLines.push({ ...hl });
    }
    for (const vl of lines.filter(l => l.vertical)) {
      consolidatedLines.push(vl);
    }

    const pageSegments = processedSegments.map(seg => ({
      x: seg.x,
      y: seg.y,
      x0: seg.x,
      x1: seg.right,
      yb: seg.y,
      width: seg.width,
      right: seg.right,
      fs: seg.fs,
      text: seg.runs.map(r => r.text).join(''),
      runs: seg.runs
    }));

    pages.push({
      width: pageWidth,
      height: pageHeight,
      blocks,
      lines: consolidatedLines,
      boxes,
      images,
      segments: pageSegments
    });

    try {
      page.cleanup();
    } catch {
      // ignore cleanup error
    }
  }

  try {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  } catch {
    // ignore cleanup error
  }

  const title = detectedTitle || opts.title || 'Converted Document';
  return {
    title,
    pages,
    meta: {
      title
    },
    warnings
  };
}
