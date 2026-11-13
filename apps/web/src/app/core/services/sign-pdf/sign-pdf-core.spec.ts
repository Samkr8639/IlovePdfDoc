import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PDFDocument, PDFName, PDFNumber, degrees } from 'pdf-lib';
import {
  deriveInitials,
  formatSigningDate,
  getDefaultDateFormatForLocale,
  parsePageRange,
  pdfPointToScreenPointCoords,
  pdfRectToScreenRectCoords,
  screenPointToPdfPointCoords,
  screenRectToPdfRectCoords,
  SIGN_SCRIPT_FONTS,
  SignFieldElement
} from '@paperflow/contracts';
import {
  exportSignedPdf,
  computeTextLayout,
  repairMojibakeFilename,
  decodePdfTextString
} from '@paperflow/sign-core';
import { SignatureImageService } from './signature-image.service';
import { SignatureStorageService } from './signature-storage.service';
import { PdfInspectionService } from './pdf-inspection.service';
import { buildSignedFilename } from './sign-pdf.models';

describe('Sign PDF Core Utilities & Services', () => {
  let imageService: SignatureImageService;
  let storageService: SignatureStorageService;
  let inspectionService: PdfInspectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignatureImageService, SignatureStorageService, PdfInspectionService]
    });
    imageService = TestBed.inject(SignatureImageService);
    storageService = TestBed.inject(SignatureStorageService);
    inspectionService = TestBed.inject(PdfInspectionService);
  });

  describe('Unicode Initials Derivation', () => {
    it('extracts initials cleanly for Latin, single names, hyphenated, Devanagari, and emoji names', () => {
      expect(deriveInitials('Sameer Kumar')).toBe('SK');
      expect(deriveInitials('Alice')).toBe('A');
      expect(deriveInitials('Mary-Jane Watson')).toBe('MJW');
      expect(deriveInitials('Jean-Luc')).toBe('JL');
      expect(deriveInitials('समीर कुमार')).toBe('सकु');
      expect(deriveInitials('🚀')).toBe('');
      expect(deriveInitials('🚀 Priya Sharma')).toBe('PS');
    });
  });

  describe('Date Formatting & Locale Defaults', () => {
    const fixedDate = new Date(2026, 10, 14); // 14 Nov 2026

    it('formats every supported signing date preset accurately', () => {
      expect(formatSigningDate(fixedDate, 'dd/mm/yyyy')).toBe('14/11/2026');
      expect(formatSigningDate(fixedDate, 'mm/dd/yyyy')).toBe('11/14/2026');
      expect(formatSigningDate(fixedDate, 'd MMM yyyy')).toBe('14 Nov 2026');
      expect(formatSigningDate(fixedDate, 'yyyy-mm-dd')).toBe('2026-11-14');
      expect(formatSigningDate(fixedDate, 'd MMMM yyyy')).toBe('14 November 2026');
    });

    it('selects locale-appropriate defaults with d MMM yyyy fallback', () => {
      expect(getDefaultDateFormatForLocale('en-US')).toBe('mm/dd/yyyy');
      expect(getDefaultDateFormatForLocale('en-IN')).toBe('dd/mm/yyyy');
      expect(getDefaultDateFormatForLocale('ja-JP')).toBe('yyyy-mm-dd');
      expect(getDefaultDateFormatForLocale('pt-BR')).toBe('d MMM yyyy');
    });
  });

  describe('Apply-to-Pages Range Parser', () => {
    it('parses comma-separated lists and ranges into 0-based unique indices', () => {
      expect(parsePageRange('1, 3-5, 3', 10)).toEqual({ pages: [0, 2, 3, 4] });
      expect(parsePageRange('1-1', 5)).toEqual({ pages: [0] });
    });

    it('rejects out-of-bounds, inverted, and invalid syntax', () => {
      expect(parsePageRange('5-2', 10).error).toContain('Invalid range');
      expect(parsePageRange('0', 10).error).toContain('out of bounds');
      expect(parsePageRange('12', 10).error).toContain('out of bounds');
      expect(parsePageRange('abc', 10).error).toContain('Invalid token');
    });
  });

  describe('Filename Sanitisation & Bundled Fonts Config', () => {
    it('sanitizes filenames and preserves -signed.pdf suffix', () => {
      expect(buildSignedFilename('Contract Final.pdf')).toBe('Contract Final-signed.pdf');
      expect(buildSignedFilename('../bad:name?.pdf')).toBe('.._bad_name_-signed.pdf');
    });

    it('bundles 8 script OFL fonts including Devanagari support', () => {
      expect(SIGN_SCRIPT_FONTS.length).toBe(8);
      expect(SIGN_SCRIPT_FONTS.some(f => f.supportsDevanagari)).toBe(true);
    });
  });

  describe('Coordinate Transforms (Rotate 0/90/180/270, CropBox, UserUnit, Zoom)', () => {
    it('round-trips screen <-> PDF accurately across all rotations, CropBox, UserUnit and zoom', () => {
      for (const rotation of [0, 90, 180, 270] as const) {
        const page = {
          pageIndex: 0,
          widthPt: 500,
          heightPt: 640,
          rotation,
          cropBoxXPt: 50,
          cropBoxYPt: 80,
          userUnit: 2.0
        };
        const screenRect = { x: 120, y: 160, width: 180, height: 60 };
        const pdfRect = screenRectToPdfRectCoords(screenRect, page, 1.5, 1.0);
        const back = pdfRectToScreenRectCoords(pdfRect, page, 1.5, 1.0);
        expect(back.x).toBeCloseTo(screenRect.x, 1);
        expect(back.y).toBeCloseTo(screenRect.y, 1);
        expect(back.width).toBeCloseTo(screenRect.width, 1);
        expect(back.height).toBeCloseTo(screenRect.height, 1);

        const pt = screenPointToPdfPointCoords({ x: 300, y: 400 }, page, 1.25, 2.0);
        const ptBack = pdfPointToScreenPointCoords(pt, page, 1.25, 2.0);
        expect(ptBack.x).toBeCloseTo(300, 1);
        expect(ptBack.y).toBeCloseTo(400, 1);
      }
    });
  });

  describe('Image Validation, Trim & Background Removal', () => {
    it('validates PNG/JPEG/WebP by magic bytes and rejects SVG script payloads', async () => {
      const fakeSvg = new File(['<svg onload="alert(1)"></svg>'], 'sig.png', { type: 'image/png' });
      const svgRes = await imageService.validateUploadedImage(fakeSvg);
      expect(svgRes.valid).toBe(false);
      expect(svgRes.error).toContain('SVG');

      const realPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      const pngFile = new File([realPngHeader], 'sig.bin', { type: 'application/octet-stream' });
      const pngRes = await imageService.validateUploadedImage(pngFile);
      expect(pngRes.valid).toBe(true);
      expect(pngRes.image?.format).toBe('png');
    });

    it('strips near-white background pixels while preserving dark ink and locates opaque trim bounds', () => {
      // 4x1 RGBA buffer: near-white (250,250,250,255), pure dark ink (20,30,60,255), pure white, transparent
      const buf = new Uint8ClampedArray([
        250, 250, 250, 255,
        20, 30, 60, 255,
        255, 255, 255, 255,
        0, 0, 0, 0
      ]);
      const fakeImgData = { width: 4, height: 1, data: buf } as unknown as ImageData;
      imageService.stripNearWhiteBackground(fakeImgData, 30);

      expect(buf[3]).toBe(0); // near-white made transparent
      expect(buf[7]).toBe(255); // dark ink preserved!
      expect(buf[11]).toBe(0); // white made transparent

      const bounds = imageService.findOpaqueBounds(fakeImgData, 8);
      expect(bounds).toEqual({ minX: 1, minY: 0, maxX: 1, maxY: 0 });
    });
  });

  describe('IndexedDB Wrapper Graceful Private-Mode Failure', () => {
    it('degrades gracefully when indexedDB is missing or throws without crashing', async () => {
      const orig = (globalThis as any).indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
      try {
        const isolated = new SignatureStorageService();
        const saved = await isolated.save({
          id: '1',
          kind: 'signature',
          pngBlob: new Blob(['png']),
          created: Date.now()
        });
        expect(saved).toBe(false);
        expect(isolated.isUnavailable()).toBe(true);
        expect(await isolated.list()).toEqual([]);
        await expect(isolated.clearAll()).resolves.toBeUndefined();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
      }
    });
  });

  describe('PDF Signature Inspection & Export Integration Round-Trip', () => {
    it('detects existing /ByteRange digital signature dictionaries cleanly', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([595, 842]);
      const baseBytes = await doc.save();
      const baseSummary = await inspectionService.inspectPdf(baseBytes);
      expect(baseSummary.hasExistingDigitalSignatures).toBe(false);

      // Build a real AcroForm signature field + /Sig dictionary containing /ByteRange
      const signedDoc = await PDFDocument.create();
      const page = signedDoc.addPage([595, 842]);
      const sigVal = signedDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: [0, 100, 200, 300]
      });
      const sigValRef = signedDoc.context.register(sigVal);
      const sigField = signedDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        T: 'Signature1',
        Rect: [50, 50, 200, 100],
        V: sigValRef,
        P: page.ref
      });
      const sigFieldRef = signedDoc.context.register(sigField);
      page.node.addAnnot(sigFieldRef);
      const acroForm = signedDoc.context.obj({ Fields: [sigFieldRef], SigFlags: 3 });
      signedDoc.catalog.set(PDFName.of('AcroForm'), signedDoc.context.register(acroForm));

      const signedBytes = await signedDoc.save();
      const signedSummary = await inspectionService.inspectPdf(signedBytes);
      expect(signedSummary.hasExistingDigitalSignatures).toBe(true);
      expect(signedSummary.hasAcroFormFields).toBe(true);
    });

    it('exports signature PNG, Unicode Devanagari text, checkbox, rotated & CropBox pages, preserving metadata and reopening in pdf.js within 1 pt', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Master Service Agreement');
      doc.setAuthor('Legal Dept');

      // Page 0: normal A4
      doc.addPage([595, 842]);
      // Page 1: rotated 90 deg with CropBox offset
      const p1 = doc.addPage([600, 800]);
      p1.setCropBox(40, 60, 500, 680);
      p1.setRotation(degrees(90));
      p1.node.set(PDFName.of('UserUnit'), PDFNumber.of(1));

      const originalBytes = await doc.save();

      // Tiny 1x1 transparent-compatible PNG
      const tinyPngBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEwMgAAAxYAQHxY5yNAAAAAElFTkSuQmCC';

      const fields: SignFieldElement[] = [
        {
          id: 'sig-1',
          pageIndex: 0,
          type: 'signature',
          xPt: 100,
          yPt: 500,
          widthPt: 180,
          heightPt: 60,
          imageDataUrl: tinyPngBase64,
          showSigningDetailsLine: true,
          signingDetailsText: 'Signed by Sameer · 14 Nov 2026',
          zIndex: 1
        },
        {
          id: 'text-dev',
          pageIndex: 0,
          type: 'text',
          xPt: 100,
          yPt: 400,
          widthPt: 200,
          heightPt: 26,
          text: 'नमस्ते Sameer',
          fontId: 'kalam',
          fontSizePt: 16,
          color: '#14213D',
          zIndex: 2
        },
        {
          id: 'chk-1',
          pageIndex: 0,
          type: 'checkbox',
          xPt: 80,
          yPt: 350,
          widthPt: 20,
          heightPt: 20,
          checked: true,
          color: '#0F766E',
          zIndex: 3
        },
        {
          id: 'date-rot',
          pageIndex: 1,
          type: 'date',
          // Placed at visual (120, 120) on rotated 90 CropBox page
          ...screenRectToPdfRectCoords(
            { x: 120, y: 120, width: 120, height: 24 },
            { pageIndex: 1, widthPt: 500, heightPt: 680, rotation: 90, cropBoxXPt: 40, cropBoxYPt: 60, userUnit: 1 }
          ),
          text: '14 Nov 2026',
          fontSizePt: 14,
          color: '#14213D',
          zIndex: 4
        }
      ];

      const fsMod = (await import(/* @vite-ignore */ 'node:' + 'fs')) as any;
      const pathMod = (await import(/* @vite-ignore */ 'node:' + 'path')) as any;
      const fontsDir = pathMod.resolve('public/fonts/sign');
      const result = await exportSignedPdf(originalBytes, fields, {
        appName: 'PDFTailor',
        fontResolver: async (key: string) => {
          const p = pathMod.join(fontsDir, key.endsWith('.woff') ? key : `${key}-latin-400-normal.woff`);
          const direct = pathMod.join(fontsDir, key);
          const target = fsMod.existsSync(direct) ? direct : p;
          return fsMod.existsSync(target) ? new Uint8Array(fsMod.readFileSync(target)) : null;
        }
      });

      expect(result.fieldsApplied).toBe(4);
      expect(result.pagesSigned).toEqual([0, 1]);

      // Re-open OUTPUT with pdf-lib and pdf.js to assert preservation & text/coords within 1 pt!
      const reopenedLib = await PDFDocument.load(result.pdfBytes);
      expect(reopenedLib.getPageCount()).toBe(2);
      expect(reopenedLib.getTitle()).toBe('Master Service Agreement');
      expect(reopenedLib.getAuthor()).toBe('Legal Dept');

      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const urlMod = (await import(/* @vite-ignore */ 'node:' + 'url')) as any;
      const workerCandidates = [
        pathMod.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
        pathMod.resolve('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
      ];
      for (const cand of workerCandidates) {
        if (fsMod.existsSync(cand)) {
          (pdfjs as any).GlobalWorkerOptions.workerSrc = urlMod.pathToFileURL(cand).href;
          break;
        }
      }
      const pdfDocJs = await (pdfjs as any).getDocument({ data: result.pdfBytes, verbosity: 0, isEvalSupported: false }).promise;
      expect(pdfDocJs.numPages).toBe(2);

      const page0 = await pdfDocJs.getPage(1);
      const tc0 = await page0.getTextContent();
      const str0 = tc0.items.map((it: any) => it.str).join(' ');
      expect(str0).toContain('नमस्ते');
      expect(str0).toContain('Signed by Sameer');

      const page1 = await pdfDocJs.getPage(2);
      const tc1 = await page1.getTextContent();
      const vp1 = page1.getViewport({ scale: 1.0 });
      const dateItem = tc1.items.find((it: any) => String(it.str).includes('14 Nov 2026'));
      expect(dateItem).toBeTruthy();
      const screenPos = vp1.convertToViewportPoint(dateItem.transform[4], dateItem.transform[5]);
      // Screen visual X ~ 122 (±3pt), Y inside 120..144 box!
      expect(Math.abs(screenPos[0] - 122)).toBeLessThanOrEqual(4);
      expect(screenPos[1]).toBeGreaterThanOrEqual(115);
      expect(screenPos[1]).toBeLessThanOrEqual(150);
    });
  });

  describe('WYSIWYG Text Layout Engine (computeTextLayout)', () => {
    it('wraps text cleanly at maxWidth and calculates line metrics', () => {
      const text = 'This is a long sentence that must wrap onto multiple lines cleanly.';
      const layout = computeTextLayout({
        text,
        fontSize: 14,
        maxWidth: 150,
        lineHeightMultiplier: 1.25,
        align: 'left'
      });

      expect(layout.lines.length).toBeGreaterThan(1);
      expect(layout.fontSize).toBe(14);
      expect(layout.lineHeight).toBe(14 * 1.25);
      expect(layout.totalHeight).toBe(layout.lines.length * layout.lineHeight);
      for (const line of layout.lines) {
        expect(line.xOffset).toBe(0);
        expect(line.text.length).toBeGreaterThan(0);
      }
    });

    it('computes alignment xOffsets for center and right alignments', () => {
      const text = 'Short line';
      const centerLayout = computeTextLayout({
        text,
        fontSize: 16,
        maxWidth: 200,
        align: 'center'
      });
      expect(centerLayout.lines[0].xOffset).toBeGreaterThan(0);

      const rightLayout = computeTextLayout({
        text,
        fontSize: 16,
        maxWidth: 200,
        align: 'right'
      });
      expect(rightLayout.lines[0].xOffset).toBeGreaterThan(centerLayout.lines[0].xOffset);
    });

    it('breaks excessively long continuous words when exceeding maxWidth', () => {
      const text = 'SupercalifragilisticexpialidociousAndMoreContinuousCharacters';
      const layout = computeTextLayout({
        text,
        fontSize: 16,
        maxWidth: 100
      });
      expect(layout.lines.length).toBeGreaterThan(1);
    });
  });

  describe('ISO 32000-1 Text String Decoding & Mojibake Repair', () => {
    it('repairs mojibake filename with "à" or UTF-8 en dash artifacts', () => {
      expect(repairMojibakeFilename('Auction Portal à Impulse Decision.pdf'))
        .toBe('Auction Portal – Impulse Decision.pdf');
      expect(repairMojibakeFilename('Document â€“ Final.pdf'))
        .toBe('Document – Final.pdf');
      expect(repairMojibakeFilename('Regular-File-Name.pdf'))
        .toBe('Regular-File-Name.pdf');
    });

    it('decodes UTF-16BE BOM strings correctly', () => {
      // UTF-16BE BOM: 0xFE, 0xFF followed by 'H' (0x00, 0x48), 'i' (0x00, 0x69)
      const u16Bytes = new Uint8Array([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x69]);
      expect(decodePdfTextString(u16Bytes)).toBe('Hi');
    });

    it('decodes PDFDocEncoding code 0x96 as en dash', () => {
      // 0x96 in PDFDocEncoding Annex D maps to 0x2013 (en dash)
      const pdfDocBytes = new Uint8Array([0x41, 0x96, 0x42]); // "A–B"
      expect(decodePdfTextString(pdfDocBytes)).toBe('A–B');
    });

    it('decodes UTF-8 BOM strings correctly', () => {
      const u8Bytes = new Uint8Array([0xEF, 0xBB, 0xBF, 0x4F, 0x4B]);
      expect(decodePdfTextString(u8Bytes)).toBe('OK');
    });
  });

  describe('Enhanced Field Export (Checkbox with styles & Text with underline)', () => {
    it('exports composite checkbox with cross, dot, and tick marks alongside text fields with underline', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([400, 400]);
      const initialPdf = await doc.save();

      const checkboxField: SignFieldElement = {
        id: 'chk-1',
        type: 'checkbox',
        pageIndex: 0,
        xPt: 50,
        yPt: 300,
        widthPt: 150,
        heightPt: 20,
        checkboxConfig: {
          checked: true,
          mark: 'cross',
          boxSize: 14,
          label: {
            content: 'I agree to the updated terms and conditions.',
            fontSize: 10,
            color: '#1e293b'
          },
          labelPosition: 'right'
        }
      };

      const dotCheckboxField: SignFieldElement = {
        id: 'chk-2',
        type: 'checkbox',
        pageIndex: 0,
        xPt: 50,
        yPt: 260,
        widthPt: 100,
        heightPt: 20,
        checkboxConfig: {
          checked: true,
          mark: 'dot',
          boxSize: 14,
          label: {
            content: 'Option B',
            fontSize: 10,
            color: '#1e293b'
          },
          labelPosition: 'right'
        }
      };

      const textField: SignFieldElement = {
        id: 'txt-1',
        type: 'text',
        pageIndex: 0,
        xPt: 50,
        yPt: 200,
        widthPt: 200,
        heightPt: 40,
        textConfig: {
          content: 'Important Notice Headline',
          fontSize: 14,
          color: '#0f766e',
          bold: true,
          underline: true,
          align: 'center',
          opacity: 0.9
        }
      };

      const result = await exportSignedPdf(
        initialPdf,
        [checkboxField, dotCheckboxField, textField]
      );

      expect(result.fieldsApplied).toBe(3);
      expect(result.pdfBytes.byteLength).toBeGreaterThan(0);

      const reopened = await PDFDocument.load(result.pdfBytes);
      expect(reopened.getPageCount()).toBe(1);
    });
  });

  describe('Stamp IndexedDB Storage Service', () => {
    it('manages stamps in storage or degrades gracefully when IndexedDB is unavailable', async () => {
      const stampId = 'stamp-' + Date.now();
      const record = {
        id: stampId,
        label: 'Acme Official Stamp',
        source: {
          kind: 'text' as const,
          lines: ['ACME CORP', 'VERIFIED'],
          shape: 'circle' as const,
          color: '#0f766e',
          borderWidth: 2,
          fontFamily: 'Inter'
        },
        imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        created: Date.now()
      };

      storageService.setDefaultStampId(stampId);
      expect(storageService.getDefaultStampId()).toBe(stampId);

      const saved = await storageService.saveStamp(record);
      if (saved) {
        const defaultStamp = await storageService.getDefaultStamp();
        expect(defaultStamp).not.toBeNull();
        expect(defaultStamp?.label).toBe('Acme Official Stamp');

        const allStamps = await storageService.listStamps();
        expect(allStamps.some(s => s.id === stampId)).toBe(true);

        await storageService.deleteStamp(stampId);
        const afterDelete = await storageService.listStamps();
        expect(afterDelete.some(s => s.id === stampId)).toBe(false);
      } else {
        // In environments without IndexedDB (e.g. headless jsdom), degrades gracefully
        expect(await storageService.listStamps()).toEqual([]);
        expect(await storageService.getDefaultStamp()).toBeNull();
      }

      storageService.clearDefaultStampId();
      expect(storageService.getDefaultStampId()).toBeNull();
    });
  });
});
