import crypto from 'crypto';
import zlib from 'zlib';
import sharp, { Sharp } from 'sharp';
import {
  PDFDocument,
  PDFName,
  PDFRef,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFStream,
  PDFNumber
} from 'pdf-lib';
import { CompressionProfile } from './types';

export interface ImageOptimizationStats {
  imagesProcessed: number;
  imagesOptimized: number;
  imagesDeduplicated: number;
  bytesSaved: number;
}

/**
 * Multiplies two 2D affine transformation matrices: [a, b, c, d, e, f]
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
 * Scans page content streams to map image XObject references to their displayed width & height in points
 */
export function extractImageDisplayDimensions(
  doc: PDFDocument
): Map<string, { scaleXPt: number; scaleYPt: number }> {
  const displayMap = new Map<string, { scaleXPt: number; scaleYPt: number }>();
  const context = doc.context;
  const pages = doc.getPages();

  for (const page of pages) {
    const pageNode = page.node;
    const resDict = pageNode.Resources();
    const xobjDict = resDict?.lookup(PDFName.of('XObject'));

    const nameToRefMap = new Map<string, string>();
    if (xobjDict instanceof PDFDict) {
      for (const [k, v] of xobjDict.entries()) {
        const nameStr = k.toString().replace(/^\//, '');
        if (v instanceof PDFRef) {
          nameToRefMap.set(nameStr, v.toString());
        }
      }
    }

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

    const tokens = combinedText.split(/\s+/).filter(Boolean);
    const matrixStack: Array<[number, number, number, number, number, number]> = [
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
          if (scaleX > 0 && scaleY > 0) {
            const existing = displayMap.get(targetRef);
            if (!existing || (scaleX > existing.scaleXPt && scaleY > existing.scaleYPt)) {
              displayMap.set(targetRef, { scaleXPt: scaleX, scaleYPt: scaleY });
            }
          }
        }
      }
    }
  }

  return displayMap;
}

/**
 * Checks whether an RGB buffer is effectively grayscale
 */
export function isGrayscaleImage(rawBuf: Buffer, channels: number): boolean {
  if (channels === 1) return true;
  if (channels < 3) return false;

  const pixelCount = Math.floor(rawBuf.length / channels);
  const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
  let nonGrayCount = 0;
  let totalSampled = 0;

  for (let i = 0; i < pixelCount; i += sampleStep) {
    const offset = i * channels;
    const r = rawBuf[offset];
    const g = rawBuf[offset + 1];
    const b = rawBuf[offset + 2];

    if (Math.abs(r - g) > 5 || Math.abs(g - b) > 5 || Math.abs(r - b) > 5) {
      nonGrayCount++;
    }
    totalSampled++;
  }

  return totalSampled > 0 && nonGrayCount / totalSampled < 0.02; // 98%+ neutral
}

/**
 * Checks whether an image is a high-contrast document scan (>= 95% near black/white)
 */
export function isBilevelScan(rawBuf: Buffer, channels: number): boolean {
  const pixelCount = Math.floor(rawBuf.length / channels);
  const sampleStep = Math.max(1, Math.floor(pixelCount / 500));
  let extremeCount = 0;
  let totalSampled = 0;

  for (let i = 0; i < pixelCount; i += sampleStep) {
    const offset = i * channels;
    let lum: number;
    if (channels === 1) {
      lum = rawBuf[offset];
    } else {
      lum = 0.299 * rawBuf[offset] + 0.587 * rawBuf[offset + 1] + 0.114 * rawBuf[offset + 2];
    }

    if (lum < 45 || lum > 215) {
      extremeCount++;
    }
    totalSampled++;
  }

  return totalSampled > 0 && extremeCount / totalSampled >= 0.94;
}

/**
 * Re-encodes raster images with Sharp, MozJPEG, DPI downsampling, grayscale & deduplication
 */
export async function optimizeImageStreams(
  doc: PDFDocument,
  profile: CompressionProfile
): Promise<ImageOptimizationStats> {
  const stats: ImageOptimizationStats = {
    imagesProcessed: 0,
    imagesOptimized: 0,
    imagesDeduplicated: 0,
    bytesSaved: 0
  };

  const context = doc.context;
  const indirectObjects = context.enumerateIndirectObjects();
  const displayMap = extractImageDisplayDimensions(doc);

  // 1. DEDUPLICATION PHASE: Group identical stream contents by SHA-256 hash
  const hashToRefs = new Map<string, PDFRef[]>();
  const imageRefs: Array<{ ref: PDFRef; obj: PDFRawStream; dict: PDFDict }> = [];

  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
      const dict = (obj as any).dict instanceof PDFDict ? (obj as any).dict : undefined;
      const subtype = dict?.get(PDFName.of('Subtype'))?.toString();
      if (subtype === '/Image') {
        imageRefs.push({ ref, obj: obj as any, dict: dict! });
        const contents = (obj as any).contents;
        if (contents && contents.length > 0) {
          const hash = crypto.createHash('sha256').update(contents).digest('hex');
          const list = hashToRefs.get(hash) || [];
          list.push(ref);
          hashToRefs.set(hash, list);
        }
      }
    }
  }

  stats.imagesProcessed = imageRefs.length;

  // Deduplicate identical images across page resource dictionaries
  const redirectMap = new Map<string, PDFRef>();
  for (const [, refs] of hashToRefs.entries()) {
    if (refs.length > 1) {
      const canonical = refs[0];
      for (let i = 1; i < refs.length; i++) {
        redirectMap.set(refs[i].toString(), canonical);
        context.delete(refs[i]);
        stats.imagesDeduplicated++;
      }
    }
  }

  if (redirectMap.size > 0) {
    for (const page of doc.getPages()) {
      const xobj = page.node.Resources()?.lookup(PDFName.of('XObject'));
      if (xobj instanceof PDFDict) {
        for (const [k, v] of xobj.entries()) {
          if (v instanceof PDFRef) {
            const target = redirectMap.get(v.toString());
            if (target) {
              xobj.set(k, target);
            }
          }
        }
      }
    }
  }

  // 2. RE-ENCODING & DOWNSAMPLING PHASE
  for (const { ref, obj, dict } of imageRefs) {
    const refStr = ref.toString();
    if (redirectMap.has(refStr)) continue; // Was deduplicated and deleted

    // Yield to event loop between images
    await new Promise(resolve => setImmediate(resolve));

    const contents = obj.contents;
    if (!contents || contents.length < 10 * 1024) {
      continue; // Skip small icons / decorations (< 10 KB)
    }

    const origBytes = contents.length;
    const w = (dict.get(PDFName.of('Width')) as PDFNumber)?.asNumber();
    const h = (dict.get(PDFName.of('Height')) as PDFNumber)?.asNumber();
    if (!w || !h || w <= 0 || h <= 0) continue;

    const rawFilter = dict.get(PDFName.of('Filter'))?.toString() || '';
    const rawColorSpace = dict.get(PDFName.of('ColorSpace'))?.toString() || '';
    const smaskRef = dict.get(PDFName.of('SMask'));

    // Compute effective DPI based on page display matrix
    const placement = displayMap.get(refStr);
    let targetWidth = w;
    let targetHeight = h;

    if (placement && placement.scaleXPt > 0 && placement.scaleYPt > 0) {
      const dispWidthInches = placement.scaleXPt / 72;
      const dispHeightInches = placement.scaleYPt / 72;
      const effDpiX = w / dispWidthInches;
      const effDpiY = h / dispHeightInches;
      const effectiveDpi = Math.max(effDpiX, effDpiY);

      if (effectiveDpi > profile.maxDpi) {
        targetWidth = Math.max(16, Math.min(w, Math.round(dispWidthInches * profile.maxDpi)));
        targetHeight = Math.max(16, Math.min(h, Math.round(dispHeightInches * profile.maxDpi)));
      }
    }

    try {
      let sharpInstance: Sharp | null = null;
      let rawPixelBuffer: Buffer | null = null;
      let detectedChannels = 3;

      if (rawFilter.includes('DCTDecode')) {
        // Direct JPEG
        sharpInstance = sharp(Buffer.from(contents), { limitInputPixels: 268402689 });
      } else if (rawFilter.includes('FlateDecode')) {
        // Inflate Flate stream
        let inflated: Buffer;
        try {
          inflated = zlib.inflateSync(Buffer.from(contents));
        } catch {
          continue;
        }

        if (inflated.length === w * h * 3) {
          rawPixelBuffer = inflated;
          detectedChannels = 3;
          sharpInstance = sharp(inflated, {
            raw: { width: w, height: h, channels: 3 },
            limitInputPixels: 268402689
          });
        } else if (inflated.length === w * h * 4) {
          rawPixelBuffer = inflated;
          detectedChannels = 4;
          sharpInstance = sharp(inflated, {
            raw: { width: w, height: h, channels: 4 },
            limitInputPixels: 268402689
          });
        } else if (inflated.length === w * h) {
          rawPixelBuffer = inflated;
          detectedChannels = 1;
          sharpInstance = sharp(inflated, {
            raw: { width: w, height: h, channels: 1 },
            limitInputPixels: 268402689
          });
        } else {
          // Attempt standard image decoder fallback
          try {
            sharpInstance = sharp(inflated, { limitInputPixels: 268402689 });
          } catch {
            continue;
          }
        }
      } else {
        // Other filters (CCITT, JBIG2, JPX) - leave intact for fidelity unless standard sharp decodes
        try {
          sharpInstance = sharp(Buffer.from(contents), { limitInputPixels: 268402689 });
        } catch {
          continue;
        }
      }

      if (!sharpInstance) continue;

      // Extract metadata / channels
      const meta = await sharpInstance.metadata();
      const numChannels = meta.channels || detectedChannels;

      // Grayscale detection
      let isGray = numChannels === 1 || rawColorSpace.includes('DeviceGray');
      if (!isGray && rawPixelBuffer) {
        isGray = isGrayscaleImage(rawPixelBuffer, numChannels);
      } else if (!isGray && meta.space === 'b-w') {
        isGray = true;
      }

      if (isGray) {
        sharpInstance = sharpInstance.grayscale();
      }

      // Bilevel scan thresholding heuristic (for extreme mode or text scans)
      if (profile.enableBilevelThreshold && rawPixelBuffer && isBilevelScan(rawPixelBuffer, numChannels)) {
        sharpInstance = sharpInstance.threshold(160);
      }

      // Downscale if effective DPI > maxDpi
      if (targetWidth < w || targetHeight < h) {
        sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
          fit: 'fill',
          withoutEnlargement: true
        });
      }

      // Check if image has transparency SMask
      if (smaskRef instanceof PDFRef) {
        // Also downscale the SMask object to match target dimensions
        const smaskObj = context.lookup(smaskRef);
        if (smaskObj instanceof PDFRawStream && (targetWidth < w || targetHeight < h)) {
          try {
            const maskBuf = zlib.inflateSync(Buffer.from(smaskObj.contents));
            const maskResized = await sharp(maskBuf, { raw: { width: w, height: h, channels: 1 } })
              .resize(targetWidth, targetHeight, { fit: 'fill', withoutEnlargement: true })
              .raw()
              .toBuffer();
            const deflatedMask = zlib.deflateSync(maskResized, { level: 9 });
            (smaskObj as any).contents = new Uint8Array(deflatedMask);
            smaskObj.dict.set(PDFName.of('Width'), PDFNumber.of(targetWidth));
            smaskObj.dict.set(PDFName.of('Height'), PDFNumber.of(targetHeight));
            smaskObj.dict.set(PDFName.of('Length'), PDFNumber.of(deflatedMask.length));
          } catch {
            // Retain original mask if resize fails
          }
        }
      }

      // Re-encode to MozJPEG
      const mozjpegBuffer = await sharpInstance
        .jpeg({
          quality: profile.jpegQuality,
          mozjpeg: true,
          chromaSubsampling: isGray ? '4:4:4' : profile.chromaSubsampling
        })
        .toBuffer();

      // Skip rule: only replace if new size is smaller by >= 5%
      if (mozjpegBuffer.length <= origBytes * (1 - profile.minSavingsThreshold)) {
        (obj as any).contents = new Uint8Array(mozjpegBuffer);
        dict.set(PDFName.of('Width'), PDFNumber.of(targetWidth));
        dict.set(PDFName.of('Height'), PDFNumber.of(targetHeight));
        dict.set(PDFName.of('Length'), PDFNumber.of(mozjpegBuffer.length));
        dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        dict.set(PDFName.of('ColorSpace'), PDFName.of(isGray ? 'DeviceGray' : 'DeviceRGB'));
        dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
        dict.delete(PDFName.of('DecodeParms'));

        stats.imagesOptimized++;
        stats.bytesSaved += origBytes - mozjpegBuffer.length;
      }
    } catch {
      // In case of unsupported decode/color format, gracefully preserve original stream
      continue;
    }
  }

  return stats;
}
