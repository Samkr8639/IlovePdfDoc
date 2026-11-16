/**
 * Watermark Export Service
 * Production-grade client-side PDF watermark stamping engine with Form XObject
 * transparency groups, graphics-state isolation, q/Q balance repair, and metadata preservation.
 */

import { Injectable } from '@angular/core';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFPage,
  PDFRef,
  PDFStream,
  PDFRawStream,
  decodePDFRawStream
} from 'pdf-lib';
import { zipSync, Zippable } from 'fflate';
import {
  WatermarkExportWarning,
  WatermarkFileSettings,
  WatermarkProcessResult
} from '@paperflow/contracts';
import { screenPointToPdfPointCoords } from '@paperflow/contracts';
import { WatermarkLayoutService } from './watermark-layout.service';
import { WatermarkTextShaper } from './watermark-text-shaper';
import { WatermarkTokenService } from './watermark-token.service';
import { parseWatermarkPages } from './watermark-range-parser';
import { VisualPageBox, WatermarkPlacement } from './watermark-document-model';

export interface WatermarkExportOptions {
  onProgress?: (progress: { currentFile: number; totalFiles: number; currentPage: number; totalPages: number }) => void;
  shouldCancel?: () => boolean;
  fontkitFont?: any;
}

export interface StreamBalanceInfo {
  openQ: number;
  extraQ: number;
}

export function analyzeStreamGraphicsBalance(streamBytes: Uint8Array): StreamBalanceInfo {
  let openQ = 0;
  let extraQ = 0;
  let inString = false;
  let inHex = false;
  let inComment = false;
  let strParenDepth = 0;
  let escape = false;

  const len = streamBytes.length;
  for (let i = 0; i < len; i++) {
    const byte = streamBytes[i];

    if (inComment) {
      if (byte === 0x0a || byte === 0x0d) inComment = false;
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }

    if (byte === 0x5c && inString) {
      escape = true;
      continue;
    }

    if (byte === 0x28 && !inHex) {
      if (!inString) inString = true;
      strParenDepth++;
      continue;
    }

    if (byte === 0x29 && inString) {
      strParenDepth--;
      if (strParenDepth <= 0) {
        inString = false;
        strParenDepth = 0;
      }
      continue;
    }

    if (byte === 0x3c && !inString) {
      inHex = true;
      continue;
    }

    if (byte === 0x3e && inHex) {
      inHex = false;
      continue;
    }

    if (byte === 0x25 && !inString && !inHex) {
      inComment = true;
      continue;
    }

    if (!inString && !inHex && !inComment) {
      const prev = i > 0 ? streamBytes[i - 1] : 0x20;
      const next = i < len - 1 ? streamBytes[i + 1] : 0x20;
      const isWordBoundaryPrev = prev <= 0x20 || prev === 0x2f || prev === 0x5b || prev === 0x5d || prev === 0x3c || prev === 0x3e;
      const isWordBoundaryNext = next <= 0x20 || next === 0x2f || next === 0x5b || next === 0x5d || next === 0x3c || next === 0x3e;

      if (isWordBoundaryPrev && isWordBoundaryNext) {
        if (byte === 0x71) {
          openQ++;
        } else if (byte === 0x51) {
          if (openQ > 0) {
            openQ--;
          } else {
            extraQ++;
          }
        }
      }
    }
  }

  return { openQ, extraQ };
}

@Injectable({
  providedIn: 'root'
})
export class WatermarkExportService {
  private tokenService = new WatermarkTokenService();

  constructor(private layoutService: WatermarkLayoutService) {}

  /**
   * Applies watermark to a single PDF document in-memory.
   */
  async exportWatermarkedPdf(
    originalPdfBytes: Uint8Array,
    filename: string,
    settings: WatermarkFileSettings,
    options: WatermarkExportOptions = {}
  ): Promise<WatermarkProcessResult> {
    const warnings: WatermarkExportWarning[] = [];

    // Check for cancellation
    if (options.shouldCancel?.()) {
      throw new Error('Export cancelled by user.');
    }

    // Inspect raw sample for existing signatures, XFA, or PDF/A
    const rawSample = new TextDecoder('latin1').decode(originalPdfBytes.subarray(0, Math.min(65536, originalPdfBytes.length)));
    const hasRawSignatures = /\/ByteRange\b/.test(rawSample) && /\/Type\s*\/Sig\b|\/FT\s*\/Sig\b/.test(rawSample);
    if (hasRawSignatures) {
      warnings.push({
        type: 'signatures',
        message: 'This PDF has digital signatures. Adding a watermark will invalidate them.'
      });
    }

    // PDF/A / PDF/X detection
    if (rawSample.includes('pdfaid:part') || rawSample.includes('<pdfaid:part>')) {
      warnings.push({
        type: 'pdfa',
        message: 'Adding a watermark may make this file no longer conform to PDF/A.'
      });
    }
    if (rawSample.includes('pdfxid:') || rawSample.includes('GTS_PDFX')) {
      warnings.push({
        type: 'pdfx',
        message: 'Adding a watermark may make this file no longer conform to PDF/X.'
      });
    }

    // Load PDF without updating metadata
    const pdfDoc = await PDFDocument.load(originalPdfBytes, {
      ignoreEncryption: false,
      updateMetadata: false
    });

    // Check for XFA
    try {
      const form = pdfDoc.getForm();
      const xfa = form.acroForm.dict.lookup(PDFName.of('XFA'));
      if (xfa) {
        warnings.push({
          type: 'xfa',
          message: 'This document contains dynamic XFA form fields; visual appearance may vary.'
        });
      }
    } catch {
      // Ignore if no form present
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // CMYK color space check (R-047)
    let hasCmyk = rawSample.includes('/DeviceCMYK') || rawSample.includes('/DefaultCMYK');
    if (!hasCmyk) {
      try {
        for (const p of pages) {
          const res = p.node.Resources();
          if (res instanceof PDFDict) {
            const cs = res.lookup(PDFName.of('ColorSpace'));
            const csStr = cs ? cs.toString() : '';
            if (csStr.includes('DeviceCMYK') || csStr.includes('CMYK')) {
              hasCmyk = true;
              break;
            }
          }
        }
      } catch {}
    }

    if (hasCmyk) {
      warnings.push({
        type: 'cmyk',
        message: 'This document contains CMYK colors. In-browser watermarking processes in RGB, which may cause subtle color shifts.'
      });
    }

    // Resolve page selection
    const pageSelection = parseWatermarkPages(
      settings.common.pageMode,
      settings.common.customRange,
      settings.common.filterPreset,
      totalPages
    );

    if (pageSelection.clampedMessage) {
      warnings.push({
        type: 'clamped_pages',
        message: pageSelection.clampedMessage
      });
    }

    const selectedSet = new Set(pageSelection.pageIndices);
    const isText = settings.common.activeTab === 'text';

    // Initialize Optional Content Group (OCG) if requested (R-043)
    let ocgRef: PDFRef | null = null;
    if (settings.common.optionalContentLayer) {
      const ocgDict = pdfDoc.context.obj({
        Type: PDFName.of('OCG'),
        Name: 'Watermark'
      });
      ocgRef = pdfDoc.context.register(ocgDict);

      const dDict = pdfDoc.context.obj({
        Name: 'Default',
        BaseState: PDFName.of('ON'),
        ON: pdfDoc.context.obj([ocgRef]),
        Order: pdfDoc.context.obj([ocgRef])
      });

      const ocProps = pdfDoc.context.obj({
        OCGs: pdfDoc.context.obj([ocgRef]),
        D: dDict
      });
      pdfDoc.catalog.set(PDFName.of('OCProperties'), ocProps);
    }

    const opaquePages: number[] = [];

    // 1. Text or Image Watermark Preparation
    let textShaping: any = null;
    let embeddedImageRef: any = null;
    let imageWidthPt = 0;
    let imageHeightPt = 0;

    const rawTemplateText = settings.textConfig.text || 'CONFIDENTIAL';
    const hasPerPageToken = this.tokenService.hasPerPageToken(rawTemplateText);
    const evaluatedGlobalText = this.tokenService.evaluate(rawTemplateText, {
      pageNumber: 1,
      totalPages,
      filename
    });

    if (isText) {
      textShaping = WatermarkTextShaper.shapeText(evaluatedGlobalText, {
        fontSize: typeof settings.textConfig.fontSize === 'number' ? settings.textConfig.fontSize : 36,
        bold: settings.textConfig.bold,
        italic: settings.textConfig.italic,
        underline: settings.textConfig.underline,
        colorHex: settings.textConfig.color,
        strokeColorHex: settings.textConfig.strokeColor,
        strokeWidthPt: settings.textConfig.strokeWidth,
        fontFamily: settings.textConfig.fontFamily,
        fontkitFont: options.fontkitFont
      });

      if (textShaping.unsupportedChars && textShaping.unsupportedChars.length > 0) {
        warnings.push({
          type: 'unsupported_glyph',
          message: `Some characters could not be rendered with vector outlines: ${textShaping.unsupportedChars.join(', ')}`
        });
      }
    } else {
      if (settings.imageConfig.imageDataUrl) {
        const imageBytes = this.dataUrlToBytes(settings.imageConfig.imageDataUrl);
        const embedded = await pdfDoc.embedPng(imageBytes);
        embeddedImageRef = embedded.ref;
        imageWidthPt = settings.imageConfig.imageWidthPx * 0.75;
        imageHeightPt = settings.imageConfig.imageHeightPx * 0.75;
      }
    }

    // 2. ExtGState for Opacity
    const opacityValue = Number((settings.common.opacity / 100).toFixed(3));
    const extGStateDict = pdfDoc.context.obj({
      Type: 'ExtGState',
      ca: opacityValue,
      CA: opacityValue,
      BM: 'Normal',
      AIS: false
    });
    const gsRef = pdfDoc.context.register(extGStateDict);

    // 3. Process each page
    let watermarkedPagesCount = 0;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (options.shouldCancel?.()) {
        throw new Error('Export cancelled by user.');
      }

      const page = pages[pageIdx];
      const isIncluded = selectedSet.has(pageIdx);

      // Report progress
      options.onProgress?.({
        currentFile: 1,
        totalFiles: 1,
        currentPage: pageIdx + 1,
        totalPages
      });

      if (!isIncluded) {
        continue;
      }

      watermarkedPagesCount++;

      // Compute visual page box and layout
      const crop = page.getCropBox();
      const media = page.getMediaBox();
      const rot = page.getRotation().angle;
      const userUnit = (page.node as any).lookup(PDFName.of('UserUnit'))?.numberValue || 1.0;

      const visualPage: VisualPageBox = this.layoutService.computeVisualPageBox(
        [crop.x, crop.y, crop.x + crop.width, crop.y + crop.height],
        [media.x, media.y, media.x + media.width, media.y + media.height],
        rot,
        userUnit,
        pageIdx
      );

      const layout = this.layoutService.resolvePageLayout(
        visualPage,
        settings,
        true,
        textShaping
          ? {
              unitWidth: textShaping.unitWidth,
              unitHeight: textShaping.unitHeight,
              unscaledWidth: textShaping.maxWidth,
              unscaledHeight: textShaping.totalHeight
            }
          : null,
        embeddedImageRef ? { widthPt: imageWidthPt, heightPt: imageHeightPt } : null
      );

      if (layout.placements.length === 0) {
        continue;
      }

      const firstPlacement = layout.placements[0];
      const stampW = firstPlacement.width;
      const stampH = firstPlacement.height;

      // 4. Create Form XObject with Transparency Group
      let xobjOps = '';
      let xobjResources: any = undefined;

      if (isText) {
        const pageText = hasPerPageToken
          ? this.tokenService.evaluate(rawTemplateText, {
              pageNumber: pageIdx + 1,
              totalPages,
              filename
            })
          : evaluatedGlobalText;

        const resolvedSize = firstPlacement.fontSize || 36;
        const shapedForSize = WatermarkTextShaper.shapeText(pageText, {
          fontSize: resolvedSize,
          bold: settings.textConfig.bold,
          italic: settings.textConfig.italic,
          underline: settings.textConfig.underline,
          colorHex: settings.textConfig.color,
          strokeColorHex: settings.textConfig.strokeColor,
          strokeWidthPt: settings.textConfig.strokeWidth,
          fontFamily: settings.textConfig.fontFamily,
          fontkitFont: options.fontkitFont
        });
        xobjOps = shapedForSize.pdfPathOperators;
      } else if (embeddedImageRef) {
        xobjOps = `q ${stampW} 0 0 ${stampH} ${-stampW / 2} ${-stampH / 2} cm /IMG Do Q\n`;
        xobjResources = pdfDoc.context.obj({
          XObject: { IMG: embeddedImageRef }
        });
      }

      const xobjStream = pdfDoc.context.flateStream(xobjOps);
      const xobjDict = xobjStream.dict;
      xobjDict.set(PDFName.of('Type'), PDFName.of('XObject'));
      xobjDict.set(PDFName.of('Subtype'), PDFName.of('Form'));
      xobjDict.set(PDFName.of('BBox'), pdfDoc.context.obj([-stampW / 2, -stampH / 2, stampW / 2, stampH / 2]));

      // Group for uniform transparency
      const groupDict = pdfDoc.context.obj({
        Type: 'Group',
        S: 'Transparency',
        CS: 'DeviceRGB'
      });
      xobjDict.set(PDFName.of('Group'), groupDict);

      if (xobjResources) {
        xobjDict.set(PDFName.of('Resources'), xobjResources);
      }

      const xobjRef = pdfDoc.context.register(xobjStream);

      // Register XObject and ExtGState in page resources
      const wmName = `WM_${pageIdx}`;
      page.node.setXObject(PDFName.of(wmName), xobjRef);
      page.node.setExtGState(PDFName.of('GS_WM'), gsRef);

      // Check for opaque backdrop if Layer is Below (R-048)
      if (settings.common.layer === 'below' && this.isPageBackdropOpaque(page)) {
        opaquePages.push(pageIdx + 1);
      }

      // Register OCG in page resources if present (R-043)
      if (ocgRef) {
        let resources = page.node.get(PDFName.of('Resources'));
        if (!(resources instanceof PDFDict)) {
          resources = pdfDoc.context.obj({});
          page.node.set(PDFName.of('Resources'), resources);
        }
        let properties = (resources as PDFDict).get(PDFName.of('Properties'));
        if (!(properties instanceof PDFDict)) {
          properties = pdfDoc.context.obj({});
          (resources as PDFDict).set(PDFName.of('Properties'), properties);
        }
        (properties as PDFDict).set(PDFName.of('OC_WM'), ocgRef);
      }

      // 5. Build Watermark Page Stream Operators
      let wmOps = '';
      let emcCount = 0;

      // Mark as Artifact (R-042)
      if (settings.common.markAsArtifact) {
        wmOps += '/Artifact <</Type /Pagination /Subtype /Watermark>> BDC\n';
        emcCount++;
      }

      // Optional Content Group (R-043)
      if (settings.common.optionalContentLayer && ocgRef) {
        wmOps += '/OC /OC_WM BDC\n';
        emcCount++;
      }

      wmOps += 'q /GS_WM gs\n';

      const pageMeta = {
        pageIndex: pageIdx,
        widthPt: visualPage.visualWidth,
        heightPt: visualPage.visualHeight,
        rotation: rot,
        cropBoxXPt: visualPage.cropBox[0],
        cropBoxYPt: visualPage.cropBox[1],
        userUnit: visualPage.userUnit
      };

      for (const placement of layout.placements) {
        // Convert placement center to PDF unrotated CropBox coordinates
        const centerScreen = {
          x: placement.centerX,
          y: visualPage.visualHeight - placement.centerY
        };
        const centerPdf = screenPointToPdfPointCoords(centerScreen, pageMeta, 1.0, 1.0);

        const pageRot = ((rot % 360) + 360) % 360;
        const effectiveAngleDeg = pageRot - placement.rotation;
        const rad = (effectiveAngleDeg * Math.PI) / 180;
        const cos = Number(Math.cos(rad).toFixed(5));
        const sin = Number(Math.sin(rad).toFixed(5));

        wmOps += `q ${cos} ${sin} ${-sin} ${cos} ${centerPdf.xPt.toFixed(2)} ${centerPdf.yPt.toFixed(2)} cm /${wmName} Do Q\n`;
      }
      wmOps += 'Q\n';

      while (emcCount > 0) {
        wmOps += 'EMC\n';
        emcCount--;
      }

      const wmStream = pdfDoc.context.flateStream(wmOps);
      const wmRef = pdfDoc.context.register(wmStream);

      // 6. Graphics State Isolation & q/Q Balance Repair
      this.isolateAndLayerPageContents(pdfDoc, page, wmRef, settings.common.layer);
    }

    // Collect opaque page warning for Layer Below (R-048)
    if (opaquePages.length > 0 && settings.common.layer === 'below') {
      warnings.push({
        type: 'opaque_pages',
        message: `Watermark placed below content may be obscured on ${opaquePages.length} page(s) with opaque backgrounds: ${opaquePages.join(', ')}.`,
        pages: opaquePages
      });
    }

    // 7. Metadata Preservation: preserve original Creator & Producer; update only ModDate
    pdfDoc.setModificationDate(new Date());

    const outBytes = await pdfDoc.save({ useObjectStreams: true });

    return {
      filename: this.buildWatermarkedFilename(filename),
      pdfBytes: outBytes,
      totalPages,
      watermarkedPagesCount,
      warnings
    };
  }

  /**
   * Wraps original contents in q ... Q, balances unmatched q/Q, and layers watermark Over or Below.
   */
  private isolateAndLayerPageContents(
    pdfDoc: PDFDocument,
    page: PDFPage,
    wmStreamRef: PDFRef,
    layer: 'over' | 'below'
  ): void {
    const origContents = page.node.Contents();

    let streamRefs: PDFRef[] = [];
    let totalOpenQ = 0;
    let totalExtraQ = 0;

    if (origContents instanceof PDFArray) {
      for (let i = 0; i < origContents.size(); i++) {
        const ref = origContents.get(i);
        if (ref instanceof PDFRef) {
          streamRefs.push(ref);
          const stream = pdfDoc.context.lookup(ref);
          if (stream instanceof PDFRawStream || stream instanceof PDFStream) {
            const balance = analyzeStreamGraphicsBalance(stream.getContents());
            totalOpenQ += balance.openQ;
            totalExtraQ += balance.extraQ;
          }
        }
      }
    } else if (origContents instanceof PDFRef) {
      streamRefs.push(origContents);
      const stream = pdfDoc.context.lookup(origContents);
      if (stream instanceof PDFRawStream || stream instanceof PDFStream) {
        const balance = analyzeStreamGraphicsBalance(stream.getContents());
        totalOpenQ += balance.openQ;
        totalExtraQ += balance.extraQ;
      }
    }

    // Repair prefix if extra Q was detected in original content
    const prefixOps = totalExtraQ > 0 ? `${'q\n'.repeat(totalExtraQ)}q\n` : 'q\n';
    const suffixOps = totalOpenQ > 0 ? `\nQ${'\nQ'.repeat(totalOpenQ)}` : '\nQ';

    const qStream = pdfDoc.context.flateStream(prefixOps);
    const QStream = pdfDoc.context.flateStream(suffixOps);
    const qRef = pdfDoc.context.register(qStream);
    const QRef = pdfDoc.context.register(QStream);

    let finalStreams: PDFRef[] = [];

    if (layer === 'below') {
      // Below: Watermark stream is placed BEFORE original page contents
      finalStreams = [wmStreamRef, qRef, ...streamRefs, QRef];
    } else {
      // Over: Watermark stream is placed AFTER original page contents
      finalStreams = [qRef, ...streamRefs, QRef, wmStreamRef];
    }

    page.node.set(PDFName.of('Contents'), pdfDoc.context.obj(finalStreams));
  }

  /**
   * Processes multiple PDF files and packages them into a ZIP archive with unique filenames (R-037, R-038).
   */
  async exportMultipleFiles(
    files: Array<{ filename: string; pdfBytes: Uint8Array; settings: WatermarkFileSettings }>,
    options: WatermarkExportOptions = {}
  ): Promise<{ results: WatermarkProcessResult[]; zipBytes: Uint8Array; zipFilename: string }> {
    const results: WatermarkProcessResult[] = [];
    const zipData: Zippable = {};
    const seenNames = new Map<string, number>();

    for (let i = 0; i < files.length; i++) {
      if (options.shouldCancel?.()) {
        throw new Error('Export cancelled by user.');
      }

      const file = files[i];
      const singleOptions: WatermarkExportOptions = {
        ...options,
        onProgress: (p) => {
          options.onProgress?.({
            currentFile: i + 1,
            totalFiles: files.length,
            currentPage: p.currentPage,
            totalPages: p.totalPages
          });
        }
      };

      const result = await this.exportWatermarkedPdf(
        file.pdfBytes,
        file.filename,
        file.settings,
        singleOptions
      );

      // Unique filename resolution
      let outName = result.filename;
      const count = seenNames.get(outName) || 0;
      seenNames.set(outName, count + 1);
      if (count > 0) {
        const dotIdx = outName.lastIndexOf('.');
        outName = dotIdx > 0
          ? `${outName.substring(0, dotIdx)}-${count}${outName.substring(dotIdx)}`
          : `${outName}-${count}`;
        result.filename = outName;
      }

      results.push(result);
      zipData[outName] = result.pdfBytes;
    }

    const zipBytes = zipSync(zipData);
    return {
      results,
      zipBytes,
      zipFilename: 'watermarked-pdfs.zip'
    };
  }

  private isPageBackdropOpaque(page: PDFPage): boolean {
    try {
      const origContents = page.node.Contents();
      if (!origContents) return false;

      let contentsText = '';
      const inspectStream = (ref: any) => {
        const stream = page.doc.context.lookup(ref);
        if (stream instanceof PDFRawStream || stream instanceof PDFStream) {
          try {
            const decompressed = decodePDFRawStream(stream as any).decode();
            contentsText += new TextDecoder('latin1').decode(decompressed);
          } catch {
            contentsText += new TextDecoder('latin1').decode((stream as any).getContents());
          }
        }
      };

      if (origContents instanceof PDFArray) {
        for (let i = 0; i < origContents.size(); i++) {
          inspectStream(origContents.get(i));
        }
      } else {
        inspectStream(origContents);
      }

      // Detect full-page filled rectangle or image paint (R-048)
      const hasFullPageRect = /\b\d+\s+\d+\s+\d+\s+\d+\s+re\s+[fFbB]/i.test(contentsText);
      const hasImageDo = /\/([a-zA-Z0-9_-]+)\s+Do\b/.test(contentsText);
      return hasFullPageRect || hasImageDo;
    } catch {
      return false;
    }
  }

  buildWatermarkedFilename(originalFilename: string): string {
    if (!originalFilename) return 'watermarked.pdf';
    let base = originalFilename.replace(/\.[^/.]+$/, '');
    base = base.replace(/[\x00-\x1f\x7f/\\?%*:|"<>]/g, '');
    base = base.replace(/\.{2,}/g, '.');
    base = base.trim().replace(/\s+/g, '_');
    if (!base) base = 'document';
    if (base.length > 100) base = base.substring(0, 100);
    return `${base}-watermarked.pdf`;
  }

  private dataUrlToBytes(dataUrl: string): Uint8Array {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const BufferClass = (globalThis as any).Buffer;
    if (BufferClass) {
      return new Uint8Array(BufferClass.from(b64, 'base64'));
    }
    throw new Error('Base64 decode unavailable.');
  }
}
