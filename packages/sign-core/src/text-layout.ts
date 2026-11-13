/**
 * Shared WYSIWYG text layout engine for Sign PDF.
 * Ensures consistent line breaking, wrapping, alignment, and baselines
 * between the browser editor and the exported PDF.
 */

export interface TextLayoutLine {
  text: string;
  width: number;
  xOffset: number;
  yOffset: number;
}

export interface TextLayoutResult {
  lines: TextLayoutLine[];
  totalHeight: number;
  maxWidth: number;
  lineHeight: number;
  fontSize: number;
}

export interface TextLayoutOptions {
  text: string;
  fontSize: number;
  maxWidth: number;
  lineHeightMultiplier?: number;
  align?: 'left' | 'center' | 'right';
  /** Optional fontkit Font instance for exact sub-point glyph advances. */
  fontkitFont?: any;
}

/**
 * Fallback average character width ratios relative to fontSize (for Noto / sans-serif fonts).
 */
const DEFAULT_CHAR_RATIO = 0.55;
const CHAR_RATIOS: Record<string, number> = {
  ' ': 0.28,
  'i': 0.24,
  'l': 0.24,
  'j': 0.24,
  't': 0.32,
  'f': 0.32,
  'r': 0.36,
  'm': 0.88,
  'w': 0.78,
  'M': 0.92,
  'W': 0.92,
  'I': 0.28,
  '.': 0.28,
  ',': 0.28,
  ':': 0.28,
  ';': 0.28,
  '!': 0.30,
  '-': 0.35,
  '–': 0.55,
  '—': 1.0,
  '0': 0.58,
  '1': 0.52,
  '2': 0.58,
  '3': 0.58,
  '4': 0.58,
  '5': 0.58,
  '6': 0.58,
  '7': 0.58,
  '8': 0.58,
  '9': 0.58
};

/**
 * Measures the width of a string in points using fontkit if available,
 * or calibrated typographic metrics.
 */
export function measureStringWidth(text: string, fontSize: number, fontkitFont?: any): number {
  if (!text) return 0;

  if (fontkitFont && typeof fontkitFont.layout === 'function') {
    try {
      const run = fontkitFont.layout(text);
      const unitsPerEm = fontkitFont.unitsPerEm || 1000;
      const advanceWidth = run.advanceWidth || 0;
      return (advanceWidth / unitsPerEm) * fontSize;
    } catch {
      // Fallback to calibrated metrics if font layout fails on unencoded glyphs
    }
  }

  // Devanagari Unicode block (U+0900 - U+097F) typically takes ~0.72 em per character
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if (code >= 0x0900 && code <= 0x097F) {
      total += fontSize * 0.72;
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      // CJK ideographs
      total += fontSize * 1.0;
    } else {
      const ratio = CHAR_RATIOS[ch] ?? (code > 127 ? 0.65 : DEFAULT_CHAR_RATIO);
      total += fontSize * ratio;
    }
  }
  return total;
}

/**
 * Computes wrapped text lines, widths, offsets, and total box height.
 */
export function computeTextLayout(options: TextLayoutOptions): TextLayoutResult {
  const {
    text,
    fontSize,
    maxWidth: rawMaxWidth,
    lineHeightMultiplier = 1.25,
    align = 'left',
    fontkitFont
  } = options;

  const maxWidth = Math.max(20, rawMaxWidth || 200);
  const lineHeight = fontSize * lineHeightMultiplier;
  const rawParagraphs = (text || '').split(/\r?\n/);
  const layoutLines: TextLayoutLine[] = [];

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const para = rawParagraphs[pIdx];
    if (para === '') {
      // Empty line maintains vertical pitch
      layoutLines.push({
        text: '',
        width: 0,
        xOffset: 0,
        yOffset: layoutLines.length * lineHeight
      });
      continue;
    }

    // Split paragraph into words while preserving spaces
    const words = para.split(/(\s+)/);
    let currentLineText = '';
    let currentLineWidth = 0;

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      if (!word) continue;

      const wordWidth = measureStringWidth(word, fontSize, fontkitFont);

      // If word itself exceeds maxWidth, break it by character
      if (wordWidth > maxWidth) {
        if (currentLineText.length > 0) {
          layoutLines.push({
            text: currentLineText,
            width: currentLineWidth,
            xOffset: 0,
            yOffset: layoutLines.length * lineHeight
          });
          currentLineText = '';
          currentLineWidth = 0;
        }

        // Break word character-by-character
        for (let c = 0; c < word.length; c++) {
          const char = word[c];
          const charWidth = measureStringWidth(char, fontSize, fontkitFont);
          if (currentLineWidth + charWidth > maxWidth && currentLineText.length > 0) {
            layoutLines.push({
              text: currentLineText,
              width: currentLineWidth,
              xOffset: 0,
              yOffset: layoutLines.length * lineHeight
            });
            currentLineText = char;
            currentLineWidth = charWidth;
          } else {
            currentLineText += char;
            currentLineWidth += charWidth;
          }
        }
        continue;
      }

      if (currentLineWidth + wordWidth <= maxWidth || currentLineText.length === 0) {
        currentLineText += word;
        currentLineWidth += wordWidth;
      } else {
        // Wrap to next line
        layoutLines.push({
          text: currentLineText.trimEnd(),
          width: currentLineWidth,
          xOffset: 0,
          yOffset: layoutLines.length * lineHeight
        });
        // Start next line with non-whitespace or trimmed word
        currentLineText = word.trimStart();
        currentLineWidth = measureStringWidth(currentLineText, fontSize, fontkitFont);
      }
    }

    if (currentLineText.length > 0) {
      layoutLines.push({
        text: currentLineText,
        width: currentLineWidth,
        xOffset: 0,
        yOffset: layoutLines.length * lineHeight
      });
    }
  }

  // Calculate horizontal alignments per line
  let actualMaxLineWidth = 0;
  for (const line of layoutLines) {
    actualMaxLineWidth = Math.max(actualMaxLineWidth, line.width);
    if (align === 'center') {
      line.xOffset = Math.max(0, (maxWidth - line.width) / 2);
    } else if (align === 'right') {
      line.xOffset = Math.max(0, maxWidth - line.width);
    } else {
      line.xOffset = 0;
    }
  }

  const totalHeight = Math.max(lineHeight, layoutLines.length * lineHeight);

  return {
    lines: layoutLines,
    totalHeight,
    maxWidth,
    lineHeight,
    fontSize
  };
}

