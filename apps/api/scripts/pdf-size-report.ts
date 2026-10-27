import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import {
  PDFDocument,
  PDFName,
  PDFRef,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFStream,
  PDFNumber,
  PDFString,
  PDFHexString,
  PDFObject
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ImageDetail {
  ref: string;
  name?: string;
  filter: string;
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  bytes: number;
  pageNumber?: number;
  displayedWidthPt?: number;
  displayedHeightPt?: number;
  effectiveDpiX?: number;
  effectiveDpiY?: number;
  effectiveDpi?: number;
}

export interface FontDetail {
  ref: string;
  baseFont: string;
  subtype: string;
  isEmbedded: boolean;
  isSubset: boolean;
  fontFileRef?: string;
  bytes: number;
}

export interface ContentStreamDetail {
  ref: string;
  pageNumber: number;
  isCompressed: boolean;
  filter: string;
  bytes: number;
  uncompressedBytes?: number;
}

export interface TopObjectDetail {
  ref: string;
  type: string;
  subtype?: string;
  filter?: string;
  sizeBytes: number;
  percentOfTotal: number;
  isOrphan: boolean;
}

export interface CategorySummary {
  category: string;
  count: number;
  totalBytes: number;
  percentOfTotal: number;
  details?: string;
}

export interface PdfSizeReport {
  filePath?: string;
  totalBytes: number;
  pageCount: number;
  categories: Record<string, CategorySummary>;
  images: ImageDetail[];
  fonts: FontDetail[];
  contentStreams: ContentStreamDetail[];
  duplicateObjects: Array<{ hash: string; sizeBytes: number; refs: string[] }>;
  orphanObjects: Array<{ ref: string; sizeBytes: number }>;
  top10Objects: TopObjectDetail[];
  externalToolOutput?: {
    qpdfAvailable: boolean;
    mutoolAvailable: boolean;
    details?: string;
  };
}

/**
 * Checks if a CLI binary is available on PATH
 */
function isBinaryAvailable(name: string): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    execFileSync(cmd, [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Matrix multiplication for 2D affine transforms: [a, b, c, d, e, f]
 */
function multiplyMatrix(
  m1: [number, number, number, number, number, number],
  m2: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

/**
 * Extracts image placement matrices per page using pdfjs-dist
 */
async function extractImagePlacementsFromPdfjs(buffer: Buffer): Promise<
  Map<string, { page: number; scaleXPt: number; scaleYPt: number; width: number; height: number }>
> {
  const placements = new Map<
    string,
    { page: number; scaleXPt: number; scaleYPt: number; width: number; height: number }
  >();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true
    });
    const pdfDoc = await loadingTask.promise;

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const ops = await page.getOperatorList();

      let matrixStack: Array<[number, number, number, number, number, number]> = [
        [1, 0, 0, 1, 0, 0]
      ];

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (fn === pdfjsLib.OPS.save) {
          const current = matrixStack[matrixStack.length - 1];
          matrixStack.push([...current]);
        } else if (fn === pdfjsLib.OPS.restore) {
          if (matrixStack.length > 1) {
            matrixStack.pop();
          }
        } else if (fn === pdfjsLib.OPS.transform) {
          const current = matrixStack[matrixStack.length - 1];
          const next = multiplyMatrix(current, args as [number, number, number, number, number, number]);
          matrixStack[matrixStack.length - 1] = next;
        } else if (
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintJpegXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject
        ) {
          const name = args[0] as string;
          const imgWidth = args[1] as number;
          const imgHeight = args[2] as number;
          const current = matrixStack[matrixStack.length - 1];
          const scaleX = Math.hypot(current[0], current[1]);
          const scaleY = Math.hypot(current[2], current[3]);

          placements.set(`${p}:${name}`, {
            page: p,
            scaleXPt: scaleX,
            scaleYPt: scaleY,
            width: imgWidth,
            height: imgHeight
          });
        }
      }
    }
  } catch {
    // If pdfjs fails to parse some operators, return whatever was captured
  }

  return placements;
}

/**
 * Analyzes the byte breakdown of a PDF document
 */
export async function analyzePdfSize(buffer: Buffer, filePath?: string): Promise<PdfSizeReport> {
  const totalBytes = buffer.length;
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const context = pdfDoc.context;
  const pageCount = pdfDoc.getPageCount();

  const indirectObjects = context.enumerateIndirectObjects();

  // 1. Traverse reachability to identify orphan/unused objects
  const reachableRefs = new Set<string>();
  const queue: PDFObject[] = [];

  const trailer = (context as any).trailerInfo;
  if (trailer?.Root) {
    reachableRefs.add(trailer.Root.toString());
    queue.push(trailer.Root);
  }
  if (trailer?.Info) {
    reachableRefs.add(trailer.Info.toString());
    queue.push(trailer.Info);
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    let actualObj: PDFObject = item;
    if (item instanceof PDFRef) {
      reachableRefs.add(item.toString());
      actualObj = context.lookup(item) as PDFObject;
    }

    if (!actualObj) continue;

    if (actualObj instanceof PDFDict) {
      for (const [, val] of actualObj.entries()) {
        if (val instanceof PDFRef) {
          if (!reachableRefs.has(val.toString())) {
            reachableRefs.add(val.toString());
            queue.push(val);
          }
        } else if (val instanceof PDFDict || val instanceof PDFArray) {
          queue.push(val);
        }
      }
    } else if (actualObj instanceof PDFArray) {
      for (let i = 0; i < actualObj.size(); i++) {
        const val = actualObj.get(i);
        if (val instanceof PDFRef) {
          if (!reachableRefs.has(val.toString())) {
            reachableRefs.add(val.toString());
            queue.push(val);
          }
        } else if (val instanceof PDFDict || val instanceof PDFArray) {
          queue.push(val);
        }
      }
    } else if (actualObj instanceof PDFRawStream || actualObj instanceof PDFStream) {
      if (actualObj.dict) {
        queue.push(actualObj.dict);
      }
    }
  }

  // 2. Identify duplicate stream objects by content hash
  const hashToRefs = new Map<string, { size: number; refs: string[] }>();
  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
      const contents = (obj as any).contents;
      if (contents && contents.length > 0) {
        const hash = crypto.createHash('sha256').update(contents).digest('hex');
        const existing = hashToRefs.get(hash);
        if (existing) {
          existing.refs.push(ref.toString());
        } else {
          hashToRefs.set(hash, { size: contents.length, refs: [ref.toString()] });
        }
      }
    }
  }

  const duplicateObjects: Array<{ hash: string; sizeBytes: number; refs: string[] }> = [];
  for (const [hash, data] of hashToRefs.entries()) {
    if (data.refs.length > 1) {
      duplicateObjects.push({
        hash,
        sizeBytes: data.size,
        refs: data.refs
      });
    }
  }

  // 3. Extract page-level image placement matrix by inspecting content streams directly
  const imageDisplayMap = new Map<
    string,
    { page: number; scaleXPt: number; scaleYPt: number }
  >();

  const pages = pdfDoc.getPages();
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const pageNum = pIdx + 1;
    const pageNode = page.node;

    // Build resource map of local name -> PDFRef for this page
    const resDict = pageNode.Resources();
    const xobjDict = resDict?.lookup(PDFName.of('XObject')) as PDFDict | undefined;
    const nameToRefMap = new Map<string, string>();
    if (xobjDict instanceof PDFDict) {
      for (const [k, v] of xobjDict.entries()) {
        const nameStr = k.toString().replace(/^\//, '');
        if (v instanceof PDFRef) {
          nameToRefMap.set(nameStr, v.toString());
        }
      }
    }

    // Decompress page contents and scan for cm + Do
    const contentsEntry = pageNode.get(PDFName.of('Contents'));
    const contentStreams: PDFRawStream[] = [];
    if (contentsEntry instanceof PDFRef) {
      const s = context.lookup(contentsEntry);
      if (s instanceof PDFRawStream || s instanceof PDFStream) contentStreams.push(s as any);
    } else if (contentsEntry instanceof PDFArray) {
      for (let i = 0; i < contentsEntry.size(); i++) {
        const s = context.lookup(contentsEntry.get(i));
        if (s instanceof PDFRawStream || s instanceof PDFStream) contentStreams.push(s as any);
      }
    }

    let combinedText = '';
    for (const cs of contentStreams) {
      if (cs.contents) {
        try {
          const filter = cs.dict.get(PDFName.of('Filter'))?.toString();
          if (filter?.includes('FlateDecode')) {
            combinedText += zlib.inflateSync(cs.contents).toString('latin1') + '\n';
          } else {
            combinedText += Buffer.from(cs.contents).toString('latin1') + '\n';
          }
        } catch {
          combinedText += Buffer.from(cs.contents).toString('latin1') + '\n';
        }
      }
    }

    // Tokenize / parse graphics matrix before Do
    const tokens = combinedText.split(/\s+/).filter(Boolean);
    let matrixStack: Array<[number, number, number, number, number, number]> = [
      [1, 0, 0, 1, 0, 0]
    ];

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (token === 'q') {
        const top = matrixStack[matrixStack.length - 1];
        matrixStack.push([...top]);
      } else if (token === 'Q') {
        if (matrixStack.length > 1) matrixStack.pop();
      } else if (token === 'cm' && t >= 6) {
        const a = parseFloat(tokens[t - 6]);
        const b = parseFloat(tokens[t - 5]);
        const c = parseFloat(tokens[t - 4]);
        const d = parseFloat(tokens[t - 3]);
        const e = parseFloat(tokens[t - 2]);
        const f = parseFloat(tokens[t - 1]);
        if (!isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(d) && !isNaN(e) && !isNaN(f)) {
          const top = matrixStack[matrixStack.length - 1];
          const next = multiplyMatrix(top, [a, b, c, d, e, f]);
          matrixStack[matrixStack.length - 1] = next;
        }
      } else if (token === 'Do' && t >= 1) {
        const xname = tokens[t - 1].replace(/^\//, '');
        const targetRef = nameToRefMap.get(xname);
        if (targetRef) {
          const top = matrixStack[matrixStack.length - 1];
          const scaleX = Math.hypot(top[0], top[1]);
          const scaleY = Math.hypot(top[2], top[3]);
          if (!imageDisplayMap.has(targetRef) || (scaleX > 0 && scaleY > 0)) {
            imageDisplayMap.set(targetRef, {
              page: pageNum,
              scaleXPt: scaleX,
              scaleYPt: scaleY
            });
          }
        }
      }
    }
  }

  // 4. Categorize each indirect object
  const images: ImageDetail[] = [];
  const fonts: FontDetail[] = [];
  const contentStreams: ContentStreamDetail[] = [];
  const orphanObjects: Array<{ ref: string; sizeBytes: number }> = [];

  const categoryTotals: Record<string, { count: number; totalBytes: number; details: string[] }> = {
    images: { count: 0, totalBytes: 0, details: [] },
    fonts: { count: 0, totalBytes: 0, details: [] },
    contentStreams: { count: 0, totalBytes: 0, details: [] },
    metadata: { count: 0, totalBytes: 0, details: [] },
    iccProfiles: { count: 0, totalBytes: 0, details: [] },
    attachments: { count: 0, totalBytes: 0, details: [] },
    thumbnails: { count: 0, totalBytes: 0, details: [] },
    javascript: { count: 0, totalBytes: 0, details: [] },
    privateData: { count: 0, totalBytes: 0, details: [] },
    structureAndOther: { count: 0, totalBytes: 0, details: [] }
  };

  const allObjects: TopObjectDetail[] = [];

  for (const [ref, obj] of indirectObjects) {
    const refStr = ref.toString();
    const isOrphan = !reachableRefs.has(refStr);
    const sizeBytes = typeof obj.sizeInBytes === 'function' ? obj.sizeInBytes() : 0;

    if (isOrphan) {
      orphanObjects.push({ ref: refStr, sizeBytes });
    }

    let assignedCategory = 'structureAndOther';
    let typeStr = 'Object';
    let subtypeStr: string | undefined;
    let filterStr: string | undefined;

    const dict = (obj as any).dict instanceof PDFDict ? (obj as any).dict : obj instanceof PDFDict ? obj : undefined;

    if (dict) {
      const rawType = dict.get(PDFName.of('Type'))?.toString();
      const rawSubtype = dict.get(PDFName.of('Subtype'))?.toString();
      const rawFilter = dict.get(PDFName.of('Filter'))?.toString();

      typeStr = rawType ? rawType.replace(/^\//, '') : obj.constructor.name;
      subtypeStr = rawSubtype ? rawSubtype.replace(/^\//, '') : undefined;
      filterStr = rawFilter ? rawFilter.replace(/^\//, '') : undefined;

      // Check for Image
      if (
        rawSubtype === '/Image' ||
        (rawType === '/XObject' && rawSubtype === '/Image')
      ) {
        assignedCategory = 'images';
        const w = (dict.get(PDFName.of('Width')) as PDFNumber)?.asNumber() || 0;
        const h = (dict.get(PDFName.of('Height')) as PDFNumber)?.asNumber() || 0;
        const cs = dict.get(PDFName.of('ColorSpace'))?.toString() || 'Unknown';
        const bpc = (dict.get(PDFName.of('BitsPerComponent')) as PDFNumber)?.asNumber() || 8;
        const streamBytes = (obj as any).contents?.length || sizeBytes;

        const placement = imageDisplayMap.get(refStr);
        let effDpiX: number | undefined;
        let effDpiY: number | undefined;
        let effDpi: number | undefined;

        if (placement && placement.scaleXPt > 0 && placement.scaleYPt > 0) {
          const dispWidthInches = placement.scaleXPt / 72;
          const dispHeightInches = placement.scaleYPt / 72;
          effDpiX = Math.round(w / dispWidthInches);
          effDpiY = Math.round(h / dispHeightInches);
          effDpi = Math.max(effDpiX, effDpiY);
        }

        images.push({
          ref: refStr,
          filter: filterStr || 'None',
          width: w,
          height: h,
          colorSpace: cs,
          bitsPerComponent: bpc,
          bytes: streamBytes,
          pageNumber: placement?.page,
          displayedWidthPt: placement ? Math.round(placement.scaleXPt * 10) / 10 : undefined,
          displayedHeightPt: placement ? Math.round(placement.scaleYPt * 10) / 10 : undefined,
          effectiveDpiX: effDpiX,
          effectiveDpiY: effDpiY,
          effectiveDpi: effDpi
        });
      }
      // Check for Font or FontDescriptor or FontFile
      else if (
        rawType === '/Font' ||
        rawType === '/FontDescriptor' ||
        dict.get(PDFName.of('FontFile')) ||
        dict.get(PDFName.of('FontFile2')) ||
        dict.get(PDFName.of('FontFile3'))
      ) {
        assignedCategory = 'fonts';
        if (rawType === '/Font') {
          const baseFont = dict.get(PDFName.of('BaseFont'))?.toString().replace(/^\//, '') || 'UnnamedFont';
          const isSubset = /^[A-Z]{6}\+/.test(baseFont);
          const fontDescRef = dict.get(PDFName.of('FontDescriptor'));
          let isEmbedded = false;
          let fontFileRef: string | undefined;

          if (fontDescRef instanceof PDFRef) {
            const fontDesc = context.lookup(fontDescRef) as PDFDict;
            if (fontDesc instanceof PDFDict) {
              const ff = fontDesc.get(PDFName.of('FontFile')) ||
                fontDesc.get(PDFName.of('FontFile2')) ||
                fontDesc.get(PDFName.of('FontFile3'));
              if (ff instanceof PDFRef) {
                isEmbedded = true;
                fontFileRef = ff.toString();
              }
            }
          }

          fonts.push({
            ref: refStr,
            baseFont,
            subtype: subtypeStr || 'Unknown',
            isEmbedded,
            isSubset,
            fontFileRef,
            bytes: sizeBytes
          });
        }
      }
      // Check for ICC Profile stream
      else if (dict.get(PDFName.of('N')) && rawFilter?.includes('FlateDecode') && dict.get(PDFName.of('Alternate'))) {
        assignedCategory = 'iccProfiles';
      }
      // Check for Metadata / XMP
      else if (rawType === '/Metadata' || rawSubtype === '/XML') {
        assignedCategory = 'metadata';
      }
      // Check for Attachments / Embedded files
      else if (rawType === '/Filespec' || dict.get(PDFName.of('EF'))) {
        assignedCategory = 'attachments';
      }
      // Check for JavaScript
      else if (rawType === '/JavaScript' || dict.get(PDFName.of('JS'))) {
        assignedCategory = 'javascript';
      }
      // Check for Page piece / Private info
      else if (dict.get(PDFName.of('PieceInfo'))) {
        assignedCategory = 'privateData';
      }
    }

    // Check if this object is a page content stream
    for (let p = 0; p < pages.length; p++) {
      const contentsEntry = pages[p].node.get(PDFName.of('Contents'));
      let isContent = false;
      if (contentsEntry instanceof PDFRef && contentsEntry.toString() === refStr) {
        isContent = true;
      } else if (contentsEntry instanceof PDFArray) {
        for (let i = 0; i < contentsEntry.size(); i++) {
          if (contentsEntry.get(i).toString() === refStr) {
            isContent = true;
            break;
          }
        }
      }
      if (isContent) {
        assignedCategory = 'contentStreams';
        const isCompressed = !!filterStr?.includes('FlateDecode');
        const streamBytes = (obj as any).contents?.length || sizeBytes;
        let uncompressedBytes: number | undefined;
        if (isCompressed && (obj as any).contents) {
          try {
            uncompressedBytes = zlib.inflateSync((obj as any).contents).length;
          } catch {
            // ignore
          }
        }
        contentStreams.push({
          ref: refStr,
          pageNumber: p + 1,
          isCompressed,
          filter: filterStr || 'None',
          bytes: streamBytes,
          uncompressedBytes
        });
        break;
      }
    }

    // Accumulate category totals
    categoryTotals[assignedCategory].count++;
    categoryTotals[assignedCategory].totalBytes += sizeBytes;

    allObjects.push({
      ref: refStr,
      type: typeStr,
      subtype: subtypeStr,
      filter: filterStr,
      sizeBytes,
      percentOfTotal: totalBytes > 0 ? (sizeBytes / totalBytes) * 100 : 0,
      isOrphan
    });
  }

  // Top 10 largest objects
  allObjects.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const top10Objects = allObjects.slice(0, 10);

  // Build categories summary map
  const categories: Record<string, CategorySummary> = {};
  for (const [key, val] of Object.entries(categoryTotals)) {
    categories[key] = {
      category: key,
      count: val.count,
      totalBytes: val.totalBytes,
      percentOfTotal: totalBytes > 0 ? (val.totalBytes / totalBytes) * 100 : 0
    };
  }

  // External tools check
  const qpdfAvail = isBinaryAvailable('qpdf');
  const mutoolAvail = isBinaryAvailable('mutool');

  return {
    filePath,
    totalBytes,
    pageCount,
    categories,
    images,
    fonts,
    contentStreams,
    duplicateObjects,
    orphanObjects,
    top10Objects,
    externalToolOutput: {
      qpdfAvailable: qpdfAvail,
      mutoolAvailable: mutoolAvail
    }
  };
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * CLI printer for the size report
 */
export function printReport(report: PdfSizeReport): void {
  console.log('='.repeat(80));
  console.log(`PDF SIZE BREAKDOWN REPORT`);
  if (report.filePath) console.log(`File: ${report.filePath}`);
  console.log(`Total Size: ${formatBytes(report.totalBytes)} (${report.totalBytes.toLocaleString()} bytes) | Pages: ${report.pageCount}`);
  console.log('='.repeat(80));

  console.log('\n--- 1. CATEGORY BREAKDOWN ---');
  console.log(
    'Category'.padEnd(22) +
    'Count'.padStart(8) +
    'Bytes'.padStart(14) +
    'Formatted'.padStart(12) +
    '% Total'.padStart(10)
  );
  console.log('-'.repeat(66));

  const sortedCats = Object.values(report.categories).sort((a, b) => b.totalBytes - a.totalBytes);
  for (const cat of sortedCats) {
    if (cat.count > 0 || cat.totalBytes > 0) {
      console.log(
        cat.category.padEnd(22) +
        cat.count.toString().padStart(8) +
        cat.totalBytes.toLocaleString().padStart(14) +
        formatBytes(cat.totalBytes).padStart(12) +
        `${cat.percentOfTotal.toFixed(1)}%`.padStart(10)
      );
    }
  }

  console.log('\n--- 2. IMAGES DETAIL (Raster XObjects) ---');
  if (report.images.length === 0) {
    console.log('No raster images found in document.');
  } else {
    console.log(
      'Ref'.padEnd(10) +
      'Filter'.padEnd(14) +
      'Pixels (WxH)'.padEnd(16) +
      'Page'.padEnd(6) +
      'Disp (pt)'.padEnd(14) +
      'Eff. DPI'.padEnd(10) +
      'Bytes'.padStart(12)
    );
    console.log('-'.repeat(82));
    for (const img of report.images) {
      const px = `${img.width}x${img.height}`;
      const disp = img.displayedWidthPt ? `${img.displayedWidthPt}x${img.displayedHeightPt}` : '-';
      const dpi = img.effectiveDpi ? `${img.effectiveDpi} DPI` : 'unplaced';
      console.log(
        img.ref.padEnd(10) +
        img.filter.padEnd(14) +
        px.padEnd(16) +
        (img.pageNumber ? String(img.pageNumber) : '-').padEnd(6) +
        disp.padEnd(14) +
        dpi.padEnd(10) +
        formatBytes(img.bytes).padStart(12)
      );
    }
  }

  console.log('\n--- 3. FONTS DETAIL ---');
  if (report.fonts.length === 0) {
    console.log('No font dictionaries or descriptors detected.');
  } else {
    console.log(
      'Ref'.padEnd(10) +
      'BaseFont'.padEnd(30) +
      'Subtype'.padEnd(14) +
      'Embedded?'.padEnd(12) +
      'Subsetted?'.padEnd(12)
    );
    console.log('-'.repeat(78));
    for (const f of report.fonts) {
      console.log(
        f.ref.padEnd(10) +
        f.baseFont.slice(0, 28).padEnd(30) +
        f.subtype.padEnd(14) +
        (f.isEmbedded ? 'YES' : 'NO').padEnd(12) +
        (f.isSubset ? 'YES' : 'NO (Full)').padEnd(12)
      );
    }
  }

  console.log('\n--- 4. DUPLICATE & ORPHAN OBJECTS ---');
  console.log(`Duplicate stream objects: ${report.duplicateObjects.length}`);
  for (const dup of report.duplicateObjects) {
    console.log(`  - Hash: ${dup.hash.slice(0, 12)}... (${formatBytes(dup.sizeBytes)}) shared by ${dup.refs.join(', ')}`);
  }
  console.log(`Orphan / Unreachable objects: ${report.orphanObjects.length}`);
  if (report.orphanObjects.length > 0) {
    const totalOrphanBytes = report.orphanObjects.reduce((acc, o) => acc + o.sizeBytes, 0);
    console.log(`  - Total orphan bytes: ${formatBytes(totalOrphanBytes)} across refs: ${report.orphanObjects.map(o => o.ref).join(', ')}`);
  }

  console.log('\n--- 5. TOP 10 LARGEST OBJECTS ---');
  console.log(
    'Rank'.padEnd(6) +
    'Ref'.padEnd(10) +
    'Type / Subtype'.padEnd(28) +
    'Filter'.padEnd(16) +
    'Bytes'.padStart(12) +
    '% of PDF'.padStart(10)
  );
  console.log('-'.repeat(82));
  report.top10Objects.forEach((obj, idx) => {
    const tStr = `${obj.type}${obj.subtype ? '/' + obj.subtype : ''}`;
    console.log(
      `#${idx + 1}`.padEnd(6) +
      obj.ref.padEnd(10) +
      tStr.slice(0, 26).padEnd(28) +
      (obj.filter || '-').slice(0, 14).padEnd(16) +
      formatBytes(obj.sizeBytes).padStart(12) +
      `${obj.percentOfTotal.toFixed(1)}%`.padStart(10)
    );
  });

  console.log('\n--- 6. SYSTEM UTILITIES ---');
  console.log(`qpdf available on PATH: ${report.externalToolOutput?.qpdfAvailable ? 'YES' : 'NO'}`);
  console.log(`mutool available on PATH: ${report.externalToolOutput?.mutoolAvailable ? 'YES' : 'NO'}`);
  console.log('='.repeat(80));
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('pdf-size-report.ts')) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: npx tsx apps/api/scripts/pdf-size-report.ts <file1.pdf> [file2.pdf ...]');
    process.exit(0);
  }

  (async () => {
    for (const p of args) {
      const fullPath = path.resolve(p);
      if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        continue;
      }
      const buf = fs.readFileSync(fullPath);
      const rep = await analyzePdfSize(buf, fullPath);
      printReport(rep);
    }
  })().catch(err => {
    console.error('Error generating PDF size report:', err);
    process.exit(1);
  });
}
