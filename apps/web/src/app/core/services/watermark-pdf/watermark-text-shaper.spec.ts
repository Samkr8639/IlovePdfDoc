import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as fontkit from '@pdf-lib/fontkit';
import { WatermarkTextShaper } from './watermark-text-shaper';

declare const require: any;

describe('WatermarkTextShaper', () => {
  let liberationBold: any;
  let devanagariFont: any;
  let arabicFont: any;

  beforeAll(() => {
    // Load bundled fonts for shaping tests via require if running in node/vitest
    try {
      const fs = require('fs');
      const path = require('path');
      const fk = (fontkit as any).default || fontkit;
      const libPath = path.resolve('public/standard_fonts/LiberationSans-Bold.ttf');
      if (fs.existsSync(libPath)) {
        liberationBold = fk.create(fs.readFileSync(libPath));
      }

      const devPath = path.resolve('public/fonts/sign/noto-sans-devanagari-devanagari-400-normal.woff');
      if (fs.existsSync(devPath)) {
        devanagariFont = fk.create(fs.readFileSync(devPath));
      }

      const arPath = path.resolve('public/fonts/sign/noto-sans-arabic-arabic-400-normal.woff');
      if (fs.existsSync(arPath)) {
        arabicFont = fk.create(fs.readFileSync(arPath));
      }
    } catch (e) {
      console.warn('Could not load some bundled test fonts from disk:', e);
    }
  });

  describe('sanitizeText', () => {
    it('strips control characters while preserving newline', () => {
      const input = 'CONFIDENTIAL\x00\x07\x1F\nAPPROVED\x08';
      const { text, strippedCount } = WatermarkTextShaper.sanitizeText(input);
      expect(text).toBe('CONFIDENTIAL\nAPPROVED');
      expect(strippedCount).toBe(4);
    });

    it('strips bidi override control characters', () => {
      const input = 'Hello\u202EWorld\u202C\u2066Test\u2069';
      const { text, strippedCount } = WatermarkTextShaper.sanitizeText(input);
      expect(text).toBe('HelloWorldTest');
      expect(strippedCount).toBe(4);
    });

    it('caps text at 500 characters', () => {
      const longInput = 'A'.repeat(600);
      const { text } = WatermarkTextShaper.sanitizeText(longInput);
      expect(text.length).toBe(500);
    });
  });

  describe('detectScripts', () => {
    it('detects Latin, Arabic, Hebrew, and Devanagari scripts', () => {
      const latin = WatermarkTextShaper.detectScripts('CONFIDENTIAL');
      expect(latin.scripts.has('latin')).toBe(true);
      expect(latin.hasRTL).toBe(false);

      const arabic = WatermarkTextShaper.detectScripts('مرحبا');
      expect(arabic.scripts.has('arabic')).toBe(true);
      expect(arabic.hasRTL).toBe(true);

      const dev = WatermarkTextShaper.detectScripts('नमस्ते');
      expect(dev.scripts.has('devanagari')).toBe(true);
      expect(dev.hasRTL).toBe(false);
    });

    it('flags unsupported colour emoji', () => {
      const res = WatermarkTextShaper.detectScripts('CONFIDENTIAL 🔥');
      expect(res.unsupportedChars.length).toBeGreaterThan(0);
      expect(res.unsupportedChars).toContain('🔥');
    });
  });

  describe('shapeText with fontkit', () => {
    it('shapes Latin text with LiberationSans-Bold into vector glyphs and PDF path operators', () => {
      if (!liberationBold) return;

      const res = WatermarkTextShaper.shapeText('CONFIDENTIAL', {
        fontSize: 36,
        bold: true,
        italic: false,
        underline: true,
        colorHex: '#4B5563',
        fontkitFont: liberationBold
      });

      expect(res.lines.length).toBe(1);
      expect(res.maxWidth).toBeGreaterThan(100);
      expect(res.totalHeight).toBeCloseTo(36 * 1.2, 1);
      expect(res.lines[0].glyphs.length).toBe(12);

      // Verify PDF path operators
      expect(res.pdfPathOperators).toContain('q\n');
      expect(res.pdfPathOperators).toContain('rg\n'); // Fill color
      expect(res.pdfPathOperators).toContain('RG\n'); // Faux bold stroke color
      expect(res.pdfPathOperators).toContain('B\n');  // Fill and stroke
      expect(res.pdfPathOperators).toContain('re f\n'); // Underline rectangle
      expect(res.pdfPathOperators).toContain('Q\n');
    });

    it('applies 12 degree shear matrix for faux italic', () => {
      if (!liberationBold) return;

      const res = WatermarkTextShaper.shapeText('DRAFT', {
        fontSize: 24,
        bold: false,
        italic: true,
        underline: false,
        colorHex: '#000000',
        fontkitFont: liberationBold
      });

      // tan(12°) ≈ 0.212557
      expect(res.pdfPathOperators).toContain('1 0 0.212557 1 0 0 cm\n');
    });

    it('shapes Devanagari conjuncts correctly with Noto Sans Devanagari', () => {
      if (!devanagariFont) return;

      const res = WatermarkTextShaper.shapeText('नमस्ते', {
        fontSize: 40,
        bold: false,
        italic: false,
        underline: false,
        colorHex: '#14213D',
        fontkitFont: devanagariFont
      });

      expect(res.maxWidth).toBeGreaterThan(0);
      expect(res.lines[0].glyphs.length).toBe(5);
      expect(res.pdfPathOperators).toContain('m\n');
      expect(res.pdfPathOperators).toContain('f\n');
    });

    it('shapes and reorders Arabic text with Noto Sans Arabic', () => {
      if (!arabicFont) return;

      const res = WatermarkTextShaper.shapeText('مرحبا', {
        fontSize: 30,
        bold: false,
        italic: false,
        underline: false,
        colorHex: '#0F766E',
        fontkitFont: arabicFont
      });

      expect(res.maxWidth).toBeGreaterThan(0);
      expect(res.lines[0].glyphs.length).toBeGreaterThan(0);
      expect(res.pdfPathOperators).toContain('m\n');
    });

    it('shapes multiline text and calculates line advances and heights', () => {
      if (!liberationBold) return;

      const res = WatermarkTextShaper.shapeText('TOP SECRET\nDO NOT COPY', {
        fontSize: 20,
        bold: true,
        italic: false,
        underline: false,
        colorHex: '#DC2626',
        fontkitFont: liberationBold
      });

      expect(res.lines.length).toBe(2);
      expect(res.totalHeight).toBeCloseTo(2 * 20 * 1.2, 1);
    });

    it('falls back gracefully to calibrated metrics when fontkit is not supplied', () => {
      const res = WatermarkTextShaper.shapeText('SAMPLE', {
        fontSize: 30,
        bold: false,
        italic: false,
        underline: false,
        colorHex: '#333333'
      });

      expect(res.lines.length).toBe(1);
      expect(res.lines[0].glyphs.length).toBe(6);
      expect(res.maxWidth).toBeGreaterThan(0);
      expect(res.unitsPerEm).toBe(1000);
    });

    it('renderToCanvas applies exact fontkit glyph scaling and does not draw oversized paths', () => {
      const fakeCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        transform: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn()
      };

      const result = {
        text: 'test',
        lines: [
          {
            lineText: 'test',
            width: 50,
            glyphs: [
              {
                glyphId: 1,
                advance: 12,
                xOffset: 0,
                yOffset: 0,
                commands: [],
                svgPath: 'M0 0 L100 100'
              }
            ]
          }
        ],
        maxWidth: 50,
        totalHeight: 40,
        fontSize: 36,
        unitsPerEm: 2048,
        unitWidth: 50 / 36,
        unitHeight: 40 / 36,
        pdfPathOperators: '',
        unsupportedChars: []
      };

      WatermarkTextShaper.renderToCanvas(fakeCtx, result, {
        fontSize: 36,
        bold: false,
        italic: false,
        underline: false,
        colorHex: '#000000'
      });

      // Expected glyphScale = 36 / 2048 ≈ 0.017578
      const expectedScale = 36 / 2048;
      expect(fakeCtx.scale).toHaveBeenCalledWith(
        expect.closeTo(expectedScale, 4),
        expect.closeTo(-expectedScale, 4)
      );
    });
  });
});
