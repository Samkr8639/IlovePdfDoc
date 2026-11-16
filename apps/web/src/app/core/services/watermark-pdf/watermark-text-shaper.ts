/**
 * Watermark Text Shaper
 * Vector outline extraction, complex script shaping, bidi reordering,
 * and parity generation between PDF path operators and Canvas Path2D.
 */

import 'regenerator-runtime/runtime';
import bidiFactory from 'bidi-js';
import * as fontkit from '@pdf-lib/fontkit';

export interface GlyphPathCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'curveTo' | 'closePath';
  args: number[];
}

export interface PositionedGlyph {
  glyphId: number;
  advance: number;
  xOffset: number;
  yOffset: number;
  commands: GlyphPathCommand[];
  svgPath: string;
}

export interface ShapedLine {
  lineText: string;
  width: number;
  glyphs: PositionedGlyph[];
}

export interface TextShapingResult {
  text: string;
  lines: ShapedLine[];
  maxWidth: number;
  totalHeight: number;
  fontSize: number;
  unitsPerEm: number;
  unitWidth: number;
  unitHeight: number;
  pdfPathOperators: string;
  unsupportedChars: string[];
}

export interface TextShapingOptions {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  colorHex: string;
  strokeColorHex?: string;
  strokeWidthPt?: number;
  fontkitFont?: any;
}

const bidi = bidiFactory();

export class WatermarkTextShaper {
  private static fontCache = new Map<string, any>();

  /**
   * Loads a fontkit font object from raw font bytes.
   */
  static loadFontkit(fontBuffer: Uint8Array): any {
    const fk = (fontkit as any).default || fontkit;
    return fk.create(fontBuffer);
  }

  /**
   * Strips control characters (except newline \n) and bidi override characters.
   * Caps text at 500 characters.
   */
  static sanitizeText(input: string): { text: string; strippedCount: number } {
    if (!input) return { text: '', strippedCount: 0 };

    let cleaned = '';
    let stripped = 0;

    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);

      // Keep newline \n (code 10)
      if (code === 10) {
        cleaned += '\n';
        continue;
      }

      // Strip C0 control characters (0x00 - 0x1F, 0x7F)
      if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) {
        stripped++;
        continue;
      }

      // Strip Unicode bidi overrides & direction isolates (U+202A-U+202E, U+2066-U+2069, U+200E, U+200F)
      if (
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069) ||
        code === 0x200e ||
        code === 0x200f
      ) {
        stripped++;
        continue;
      }

      cleaned += input[i];
    }

    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 500);
    }

    return { text: cleaned, strippedCount: stripped };
  }

  /**
   * Detects Unicode scripts and flags RTL languages or unsupported emojis.
   */
  static detectScripts(text: string): { scripts: Set<string>; hasRTL: boolean; unsupportedChars: string[] } {
    const scripts = new Set<string>();
    let hasRTL = false;
    const unsupportedChars: string[] = [];

    for (const char of text) {
      const code = char.codePointAt(0) || 0;

      if ((code >= 0x0041 && code <= 0x024f) || (code >= 0x1e00 && code <= 0x1eff)) {
        scripts.add('latin');
      } else if (code >= 0x0600 && code <= 0x06ff) {
        scripts.add('arabic');
        hasRTL = true;
      } else if (code >= 0x0590 && code <= 0x05ff) {
        scripts.add('hebrew');
        hasRTL = true;
      } else if (code >= 0x0900 && code <= 0x097f) {
        scripts.add('devanagari');
      } else if (code >= 0x0980 && code <= 0x09ff) {
        scripts.add('bengali');
      } else if (code >= 0x0a00 && code <= 0x0a7f) {
        scripts.add('gurmukhi');
      } else if (code >= 0x0a80 && code <= 0x0aff) {
        scripts.add('gujarati');
      } else if (code >= 0x0b80 && code <= 0x0bff) {
        scripts.add('tamil');
      } else if (code >= 0x0c00 && code <= 0x0c7f) {
        scripts.add('telugu');
      } else if (code >= 0x0c80 && code <= 0x0cff) {
        scripts.add('kannada');
      } else if (code >= 0x0d00 && code <= 0x0d7f) {
        scripts.add('malayalam');
      } else if (code >= 0x0e00 && code <= 0x0e7f) {
        scripts.add('thai');
      } else if (code >= 0x0400 && code <= 0x04ff) {
        scripts.add('cyrillic');
      } else if (code >= 0x4e00 && code <= 0x9fff) {
        scripts.add('cjk');
      } else if (code >= 0x1f300 && code <= 0x1f9ff) {
        unsupportedChars.push(char);
      }
    }

    if (scripts.size === 0) {
      scripts.add('latin');
    }

    return { scripts, hasRTL, unsupportedChars };
  }

  /**
   * Shapes text lines using fontkit, handling bidi reordering for RTL scripts.
   */
  static shapeText(rawText: string, options: TextShapingOptions): TextShapingResult {
    const { text } = this.sanitizeText(rawText);
    const { fontkitFont, fontSize, bold, italic, underline, colorHex, strokeColorHex, strokeWidthPt } = options;
    const { hasRTL, unsupportedChars } = this.detectScripts(text);

    const rawLines = text.split('\n');
    const shapedLines: ShapedLine[] = [];
    const unitsPerEm = fontkitFont?.unitsPerEm || 1000;
    const scale = fontSize / unitsPerEm;

    let maxLineWidth = 0;

    for (const rawLine of rawLines) {
      let lineToShape = rawLine;

      if (hasRTL && lineToShape.trim().length > 0) {
        try {
          const embedding = bidi.getEmbeddingLevels(lineToShape);
          lineToShape = bidi.getReorderedString(lineToShape, embedding);
        } catch {
          // Keep raw line if bidi reordering fails
        }
      }

      if (fontkitFont && typeof fontkitFont.layout === 'function') {
        try {
          const run = fontkitFont.layout(lineToShape);
          let currentX = 0;
          const glyphs: PositionedGlyph[] = [];

          for (let i = 0; i < run.glyphs.length; i++) {
            const g = run.glyphs[i];
            const pos = run.positions[i] || { xAdvance: g.advanceWidth, xOffset: 0, yOffset: 0 };
            const advance = (pos.xAdvance || g.advanceWidth || 0) * scale;
            const xOffset = (pos.xOffset || 0) * scale;
            const yOffset = (pos.yOffset || 0) * scale;

            let commands: GlyphPathCommand[] = [];
            let svgPath = '';

            if (g.path) {
              svgPath = typeof g.path.toSVG === 'function' ? g.path.toSVG() : '';
              if (Array.isArray(g.path.commands)) {
                commands = g.path.commands;
              }
            }

            glyphs.push({
              glyphId: g.id || 0,
              advance,
              xOffset: currentX + xOffset,
              yOffset,
              commands,
              svgPath
            });

            currentX += advance;
          }

          const lineWidth = currentX;
          if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;

          shapedLines.push({
            lineText: lineToShape,
            width: lineWidth,
            glyphs
          });
          continue;
        } catch {
          // Fall back to calibrated character metrics below if fontkit layout throws
        }
      }

      // Fallback calibrated metrics when fontkit is not loaded
      let fallbackLineWidth = 0;
      const fallbackGlyphs: PositionedGlyph[] = [];

      for (let i = 0; i < lineToShape.length; i++) {
        const char = lineToShape[i];
        const advance = char === ' ' ? fontSize * 0.28 : fontSize * 0.58;
        fallbackGlyphs.push({
          glyphId: i,
          advance,
          xOffset: fallbackLineWidth,
          yOffset: 0,
          commands: [],
          svgPath: ''
        });
        fallbackLineWidth += advance;
      }

      if (fallbackLineWidth > maxLineWidth) maxLineWidth = fallbackLineWidth;
      shapedLines.push({
        lineText: lineToShape,
        width: fallbackLineWidth,
        glyphs: fallbackGlyphs
      });
    }

    const lineHeight = fontSize * 1.2;
    const totalHeight = Math.max(lineHeight, shapedLines.length * lineHeight);
    const unitWidth = maxLineWidth > 0 ? maxLineWidth / fontSize : 1;
    const unitHeight = totalHeight > 0 ? totalHeight / fontSize : 1.2;

    // Build PDF path operators
    const pdfOperators = this.buildPdfPathOperators(shapedLines, {
      fontSize,
      unitsPerEm,
      bold,
      italic,
      underline,
      colorHex,
      strokeColorHex,
      strokeWidthPt,
      maxLineWidth,
      lineHeight,
      totalHeight
    });

    return {
      text,
      lines: shapedLines,
      maxWidth: maxLineWidth,
      totalHeight,
      fontSize,
      unitsPerEm,
      unitWidth,
      unitHeight,
      pdfPathOperators: pdfOperators,
      unsupportedChars
    };
  }

  /**
   * Converts shaped lines and glyph paths into PDF path operators.
   */
  static buildPdfPathOperators(
    lines: ShapedLine[],
    params: {
      fontSize: number;
      unitsPerEm: number;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      colorHex: string;
      strokeColorHex?: string;
      strokeWidthPt?: number;
      maxLineWidth: number;
      lineHeight: number;
      totalHeight: number;
    }
  ): string {
    const {
      fontSize,
      unitsPerEm,
      bold,
      italic,
      underline,
      colorHex,
      strokeColorHex,
      strokeWidthPt,
      maxLineWidth,
      lineHeight,
      totalHeight
    } = params;

    const rgb = this.hexToRgb(colorHex);
    const scale = fontSize / unitsPerEm;

    let ops = 'q\n';

    // Faux italic: 12° shear matrix [1, 0, tan(12°), 1, 0, 0]
    if (italic) {
      const shear = Number(Math.tan((12 * Math.PI) / 180).toFixed(6));
      ops += `1 0 ${shear} 1 0 0 cm\n`;
    }

    // Set fill color
    ops += `${rgb.r} ${rgb.g} ${rgb.b} rg\n`;

    // Faux bold or custom outline setup
    const isFauxBold = bold;
    const customStroke = typeof strokeWidthPt === 'number' && strokeWidthPt > 0;

    let effectiveStrokeWidth = 0;
    if (customStroke) {
      effectiveStrokeWidth = strokeWidthPt!;
      const sRgb = strokeColorHex ? this.hexToRgb(strokeColorHex) : rgb;
      ops += `${sRgb.r} ${sRgb.g} ${sRgb.b} RG\n`;
      ops += `${effectiveStrokeWidth.toFixed(2)} w\n`;
      ops += '1 J 1 j\n'; // Round cap & round join for smooth outlines
    } else if (isFauxBold) {
      effectiveStrokeWidth = fontSize * 0.025; // ~2.5% font size
      ops += `${rgb.r} ${rgb.g} ${rgb.b} RG\n`;
      ops += `${effectiveStrokeWidth.toFixed(2)} w\n`;
      ops += '1 J 1 j\n';
    }

    // Paint lines centered around origin (0, 0)
    // Top line baseline is at totalHeight / 2 - fontSize * 0.85
    const startBaselineY = totalHeight / 2 - fontSize * 0.85;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const baselineY = startBaselineY - lineIdx * lineHeight;

      // Center line horizontally: left edge = -line.width / 2
      const lineStartX = -line.width / 2;

      for (const glyph of line.glyphs) {
        if (!glyph.commands || glyph.commands.length === 0) continue;

        const gx = lineStartX + glyph.xOffset;
        const gy = baselineY + glyph.yOffset;

        let curX = 0;
        let curY = 0;

        for (const cmd of glyph.commands) {
          if (cmd.command === 'moveTo') {
            const x = Number((gx + cmd.args[0] * scale).toFixed(3));
            const y = Number((gy + cmd.args[1] * scale).toFixed(3));
            ops += `${x} ${y} m\n`;
            curX = x;
            curY = y;
          } else if (cmd.command === 'lineTo') {
            const x = Number((gx + cmd.args[0] * scale).toFixed(3));
            const y = Number((gy + cmd.args[1] * scale).toFixed(3));
            ops += `${x} ${y} l\n`;
            curX = x;
            curY = y;
          } else if (cmd.command === 'quadraticCurveTo') {
            // Convert quadratic (cp, end) to cubic control points
            const cpx = gx + cmd.args[0] * scale;
            const cpy = gy + cmd.args[1] * scale;
            const endx = gx + cmd.args[2] * scale;
            const endy = gy + cmd.args[3] * scale;

            const cp1x = Number((curX + (2 / 3) * (cpx - curX)).toFixed(3));
            const cp1y = Number((curY + (2 / 3) * (cpy - curY)).toFixed(3));
            const cp2x = Number((endx + (2 / 3) * (cpx - endx)).toFixed(3));
            const cp2y = Number((endy + (2 / 3) * (cpy - endy)).toFixed(3));
            const ex = Number(endx.toFixed(3));
            const ey = Number(endy.toFixed(3));

            ops += `${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey} c\n`;
            curX = ex;
            curY = ey;
          } else if (cmd.command === 'curveTo') {
            const cp1x = Number((gx + cmd.args[0] * scale).toFixed(3));
            const cp1y = Number((gy + cmd.args[1] * scale).toFixed(3));
            const cp2x = Number((gx + cmd.args[2] * scale).toFixed(3));
            const cp2y = Number((gy + cmd.args[3] * scale).toFixed(3));
            const ex = Number((gx + cmd.args[4] * scale).toFixed(3));
            const ey = Number((gy + cmd.args[5] * scale).toFixed(3));

            ops += `${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey} c\n`;
            curX = ex;
            curY = ey;
          } else if (cmd.command === 'closePath') {
            ops += 'h\n';
          }
        }

        // Draw operator: 'B' (fill and stroke) if faux bold / outline; 'f' (fill) otherwise
        if (isFauxBold || customStroke) {
          ops += 'B\n';
        } else {
          ops += 'f\n';
        }
      }

      // Underline rectangle if enabled
      if (underline && line.width > 0) {
        const ulY = Number((baselineY - fontSize * 0.15).toFixed(3));
        const ulH = Number((fontSize * 0.06).toFixed(3));
        const ulX = Number(lineStartX.toFixed(3));
        const ulW = Number(line.width.toFixed(3));
        ops += `${ulX} ${ulY} ${ulW} ${ulH} re f\n`;
      }
    }

    ops += 'Q\n';
    return ops;
  }

  /**
   * Draws shaped text onto an HTML Canvas 2D context with exact parity to PDF vector operators.
   */
  static renderToCanvas(
    ctx: CanvasRenderingContext2D,
    result: TextShapingResult,
    options: TextShapingOptions
  ): void {
    const { fontSize, bold, italic, underline, colorHex, strokeColorHex, strokeWidthPt } = options;
    const { lines, totalHeight } = result;
    const uPerEm = result.unitsPerEm || 1000;
    const glyphScale = fontSize / uPerEm;

    ctx.save();

    if (italic) {
      const shear = Math.tan((12 * Math.PI) / 180);
      ctx.transform(1, 0, shear, 1, 0, 0);
    }

    ctx.fillStyle = colorHex;

    const isFauxBold = bold;
    const customStroke = typeof strokeWidthPt === 'number' && strokeWidthPt > 0;

    const lineHeight = fontSize * 1.2;
    // In Canvas 2D, Y points downwards. Center of watermark is (0, 0).
    const startBaselineY = -(totalHeight / 2) + fontSize * 0.85;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const baselineY = startBaselineY + lineIdx * lineHeight;
      const lineStartX = -line.width / 2;

      const hasSvgGlyphs = line.glyphs.some(g => Boolean(g.svgPath));

      if (hasSvgGlyphs) {
        for (const glyph of line.glyphs) {
          if (!glyph.svgPath) continue;

          ctx.save();
          // Translate to glyph position. Invert Y because font coordinate system has Y pointing up.
          ctx.translate(lineStartX + glyph.xOffset, baselineY - glyph.yOffset);
          ctx.scale(glyphScale, -glyphScale);

          if (customStroke) {
            ctx.strokeStyle = strokeColorHex || colorHex;
            ctx.lineWidth = strokeWidthPt! / glyphScale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          } else if (isFauxBold) {
            ctx.strokeStyle = colorHex;
            ctx.lineWidth = (fontSize * 0.025) / glyphScale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }

          if (typeof Path2D !== 'undefined') {
            const path = new Path2D(glyph.svgPath);
            ctx.fill(path);
            if (isFauxBold || customStroke) {
              ctx.stroke(path);
            }
          }
          ctx.restore();
        }
      } else if (line.lineText) {
        // Fallback when fontkit vector path is unavailable
        ctx.save();
        const fontStyle = italic ? 'italic' : 'normal';
        const fontWeight = bold ? 'bold' : 'normal';
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px sans-serif`;
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(line.lineText, 0, baselineY);
        if (customStroke) {
          ctx.strokeStyle = strokeColorHex || colorHex;
          ctx.lineWidth = strokeWidthPt!;
          ctx.strokeText(line.lineText, 0, baselineY);
        }
        ctx.restore();
      }

      if (underline && line.width > 0) {
        const ulY = baselineY + fontSize * 0.15;
        const ulH = fontSize * 0.06;
        ctx.fillRect(lineStartX, ulY, line.width, ulH);
      }
    }

    ctx.restore();
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 0.29, g: 0.33, b: 0.39 }; // #4B5563
    return {
      r: Number((((num >> 16) & 255) / 255).toFixed(3)),
      g: Number((((num >> 8) & 255) / 255).toFixed(3)),
      b: Number(((num & 255) / 255).toFixed(3))
    };
  }
}
