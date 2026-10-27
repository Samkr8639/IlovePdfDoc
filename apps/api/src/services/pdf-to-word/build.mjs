import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  BorderStyle,
  ShadingType,
  AlignmentType,
  HeightRule,
  FrameAnchorType,
  FrameWrap,
  LineRuleType,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType
} from 'docx';

function cleanHex(color) {
  if (!color) return '000000';
  const c = String(color).replace(/^#/, '').trim();
  if (c.length === 3) {
    return `${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toUpperCase();
  }
  if (c.length === 6) return c.toUpperCase();
  return '000000';
}

function sanitizeXmlText(str) {
  if (!str) return '';
  return str
    .replace(/\u0000/g, '-')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]/g, '');
}

function resolveFont(fontName, generic, fontMap = {}, fallbackFont = 'Calibri') {
  if (fontMap[fontName]) return fontMap[fontName];

  const lower = String(fontName || '').toLowerCase();
  if (/league\s*gothic/i.test(lower)) return 'Arial Narrow';
  if (/montserrat/i.test(lower)) return 'Segoe UI';
  if (/inter/i.test(lower)) return 'Calibri';
  if (/roboto/i.test(lower)) return 'Segoe UI';
  if (/open\s*sans/i.test(lower)) return 'Segoe UI';
  if (/lato/i.test(lower)) return 'Calibri';
  if (/poppins/i.test(lower)) return 'Segoe UI';
  if (/arial|helvetica/i.test(lower)) return 'Arial';
  if (/times|libertine|roman/i.test(lower)) return 'Times New Roman';
  if (/courier|consolas|source\s*code|monaco/i.test(lower)) return 'Courier New';
  if (/georgia/i.test(lower)) return 'Georgia';
  if (/garamond/i.test(lower)) return 'Garamond';
  if (/verdana/i.test(lower)) return 'Verdana';
  if (/tahoma/i.test(lower)) return 'Tahoma';
  if (/trebuchet/i.test(lower)) return 'Trebuchet MS';
  if (/cambria/i.test(lower)) return 'Cambria';
  if (/calibri/i.test(lower)) return 'Calibri';

  if (generic === 'sans-serif') return 'Calibri';
  if (generic === 'serif') return 'Times New Roman';
  if (generic === 'monospace') return 'Courier New';

  return fontName || fallbackFont;
}

/**
 * STEP 2: Builds a Word .docx document buffer from the layout model.
 * Each PDF page becomes a single docx section with 0 margins and exact dimensions.
 */
export async function buildDocx(model, opts = {}) {
  const baselineRatio = opts.baselineRatio ?? 0.8;
  const fontMap = opts.fontMap || {};
  const fallbackFont = opts.fallbackFont || 'Arial';
  const embedFonts = opts.embedFonts || [];

  const sections = [];

  for (let pageIdx = 0; pageIdx < model.pages.length; pageIdx++) {
    const page = model.pages[pageIdx];
    const pageWidthTwips = Math.round(page.width * 20);
    const pageHeightTwips = Math.round(page.height * 20);

    const children = [];

    // 1. Boxes (shaded rects and stroked frames)
    for (const box of page.boxes || []) {
      const hasStroke = Boolean(box.stroke);
      const boxFrame = {
        type: 'absolute',
        position: {
          x: Math.round(box.x * 20),
          y: Math.round(box.y * 20)
        },
        width: Math.max(20, Math.round(box.w * 20)),
        height: Math.max(20, Math.round(box.h * 20)),
        rule: hasStroke ? HeightRule.ATLEAST : HeightRule.EXACT,
        anchor: {
          horizontal: FrameAnchorType.PAGE,
          vertical: FrameAnchorType.PAGE
        },
        wrap: FrameWrap.NONE
      };

      const pOpts = {
        frame: boxFrame,
        spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACTLY }
      };

      if (box.fill) {
        pOpts.shading = {
          type: ShadingType.CLEAR,
          fill: cleanHex(box.fill)
        };
      }

      if (box.stroke) {
        const borderSize = Math.max(2, Math.round((box.lw || 1) * 8));
        const borderDef = {
          style: BorderStyle.SINGLE,
          size: borderSize,
          color: cleanHex(box.stroke)
        };
        pOpts.border = {
          top: borderDef,
          bottom: borderDef,
          left: borderDef,
          right: borderDef
        };
      }

      children.push(new Paragraph(pOpts));
    }

    // 2. Lines (solid rules and dotted/dashed borders)
    for (const line of page.lines || []) {
      const isSolid = !line.style || line.style === 'solid';

      if (isSolid) {
        // Solid lines are rendered as filled rectangles (shading) so they remain permanently crisp and visible at ANY zoom level
        const thicknessTwips = Math.max(15, Math.round((line.thickness || (line.vertical ? line.w : line.h) || 0.75) * 20));
        const lineFrame = {
          type: 'absolute',
          position: {
            x: Math.round(line.x * 20),
            y: Math.round(line.y * 20)
          },
          width: line.vertical ? thicknessTwips : Math.max(20, Math.round(line.w * 20)),
          height: line.vertical ? Math.max(20, Math.round(line.h * 20)) : thicknessTwips,
          rule: HeightRule.EXACT,
          anchor: {
            horizontal: FrameAnchorType.PAGE,
            vertical: FrameAnchorType.PAGE
          },
          wrap: FrameWrap.NONE
        };

        const pOpts = {
          frame: lineFrame,
          shading: {
            type: ShadingType.CLEAR,
            fill: cleanHex(line.color)
          },
          spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACTLY },
          children: [
            new TextRun({ text: '', size: 2 })
          ]
        };

        children.push(new Paragraph(pOpts));
      } else {
        // Dotted or dashed lines
        let bStyle = BorderStyle.SINGLE;
        if (line.style === 'dotted') bStyle = BorderStyle.DOTTED;
        else if (line.style === 'dashed') bStyle = BorderStyle.DASHED;

        const borderSize = Math.max(2, Math.round((line.thickness || 1) * 8));
        const borderDef = {
          style: bStyle,
          size: borderSize,
          color: cleanHex(line.color)
        };

        const lineFrame = {
          type: 'absolute',
          position: {
            x: Math.round(line.x * 20),
            y: Math.round(line.y * 20)
          },
          width: Math.max(20, Math.round(line.w * 20)),
          height: line.vertical ? Math.max(20, Math.round(line.h * 20)) : 20,
          rule: HeightRule.EXACT,
          anchor: {
            horizontal: FrameAnchorType.PAGE,
            vertical: FrameAnchorType.PAGE
          },
          wrap: FrameWrap.NONE
        };

        const pOpts = {
          frame: lineFrame,
          spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACTLY },
          children: [
            new TextRun({ text: '', size: 2 })
          ]
        };

        if (line.vertical) {
          pOpts.border = { left: borderDef };
        } else {
          // Top border positions the line strictly at line.y (not shifted by paragraph height)
          pOpts.border = { top: borderDef };
        }

        children.push(new Paragraph(pOpts));
      }
    }

    // 3. Text Blocks
    for (const block of page.blocks || []) {
      const isRightAligned = block.align === 'right';
      const isMultiLine = block.lines.length > 1;

      let frameX, frameW;

      if (isRightAligned) {
        const textWidth = block.width || 50;
        frameW = Math.max(30, textWidth * 1.25 + 15);
        frameX = Math.max(0, block.right - frameW);
      } else {
        frameX = block.x;
        // Check ONLY blocks on the exact same row (same baseline ±0.45*fs) to the right
        let maxRightX = page.width - 15;
        for (const other of page.blocks || []) {
          if (other === block) continue;
          const sameRow = Math.abs(other.y - block.y) <= 0.45 * Math.min(block.fs, other.fs);
          if (sameRow && other.x > block.x + 5) {
            maxRightX = Math.min(maxRightX, other.x - 5);
          }
        }

        if (isMultiLine || block.width > page.width * 0.45) {
          // Multi-line paragraphs or wide lines take the full available width up to right margin
          frameW = Math.max(30, maxRightX - frameX);
        } else {
          // Single-line column element: allow up to 35% growth for substitute fonts, capped by next column
          const neededW = Math.max(24, Math.min(maxRightX - frameX, block.width * 1.35 + 24));
          frameW = Math.min(maxRightX - frameX, neededW);
        }
      }

      const allBlockText = block.lines.map(l => l.map(r => r.text).join('')).join('');
      const blockCharLen = allBlockText.trim().length;

      // For single-line titles/headings, calculate maximum safe font size so it NEVER wraps in Word
      let blockEffectiveFs = block.fs;
      if (block.lines.length === 1 && blockCharLen > 3) {
        const isAllCaps = allBlockText === allBlockText.toUpperCase() && /[A-Z]/.test(allBlockText);
        const charRatio = isAllCaps ? 0.55 : 0.46;
        // Text must fit within 88% of frame width to guarantee zero wrapping across any font/OS
        const maxAllowedFs = (frameW * 0.88) / (blockCharLen * charRatio);
        if (maxAllowedFs < blockEffectiveFs) {
          blockEffectiveFs = maxAllowedFs;
        }
      }

      const lineHeightPt = (isMultiLine && block.pitch > 0) ? block.pitch : (blockEffectiveFs * 1.25);
      // Headroom above baseline: ascent is ~0.85-0.95 * fs. Using 0.95 ensures capital letters and ascenders are never cropped
      const topPt = Math.max(0, block.y - (blockEffectiveFs * 0.95));
      // Frame height gives ample room for ascenders, descenders, and accents without vertical clipping
      const heightPt = isMultiLine
        ? (lineHeightPt * (block.lines.length - 1) + blockEffectiveFs * 1.55)
        : Math.max(16, blockEffectiveFs * 1.55);

      const runs = [];
      for (let lIdx = 0; lIdx < block.lines.length; lIdx++) {
        const line = block.lines[lIdx];
        for (let rIdx = 0; rIdx < line.length; rIdx++) {
          const run = line[rIdx];
          const font = resolveFont(run.font, run.generic, fontMap, fallbackFont);

          let effectiveFs = run.fs;
          if (block.lines.length === 1 && blockCharLen > 3 && blockEffectiveFs < block.fs) {
            effectiveFs = run.fs * (blockEffectiveFs / block.fs);
          }

          const sizeHalfPoints = Math.max(4, Math.round(effectiveFs * 2));

          let textContent = run.text;
          // If first run of a continuation line, ensure clean separation from previous line
          if (lIdx > 0 && rIdx === 0 && !textContent.startsWith(' ')) {
            const prevLine = block.lines[lIdx - 1];
            const lastRun = prevLine[prevLine.length - 1];
            if (lastRun && !lastRun.text.endsWith(' ') && !lastRun.text.endsWith('-')) {
              textContent = ' ' + textContent;
            }
          }

          runs.push(
            new TextRun({
              text: sanitizeXmlText(textContent),
              break: (lIdx > 0 && rIdx === 0) ? 1 : undefined,
              font: { name: font },
              size: sizeHalfPoints,
              bold: Boolean(run.bold),
              italics: Boolean(run.italic),
              color: cleanHex(run.color)
            })
          );
        }
      }

      const textParagraph = new Paragraph({
        frame: {
          type: 'absolute',
          position: {
            x: Math.round(frameX * 20),
            y: Math.round(topPt * 20)
          },
          width: Math.max(20, Math.round(frameW * 20)),
          height: Math.max(20, Math.round(heightPt * 20)),
          rule: HeightRule.ATLEAST,
          anchor: {
            horizontal: FrameAnchorType.PAGE,
            vertical: FrameAnchorType.PAGE
          },
          wrap: FrameWrap.NONE
        },
        spacing: {
          line: isMultiLine ? Math.round(Math.max(blockEffectiveFs * 1.3, lineHeightPt) * 20) : undefined,
          lineRule: isMultiLine ? LineRuleType.AT_LEAST : LineRuleType.AUTO,
          before: 0,
          after: 0
        },
        alignment: isRightAligned ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: runs
      });

      children.push(textParagraph);
    }

    // 4. Floating Images on anchor paragraph
    // CRITICAL GOTCHA: Section break attaches to the last paragraph of the section.
    // If the last paragraph has a frame, Word/LibreOffice drop section contents.
    // Therefore, the last paragraph MUST be a plain non-frame spacer paragraph.
    // Floating images (behind document) are attached to this anchor paragraph.
    const imageRuns = [];
    for (const img of page.images || []) {
      imageRuns.push(
        new ImageRun({
          data: img.png,
          transformation: {
            width: Math.round((img.w * 96) / 72),
            height: Math.round((img.h * 96) / 72)
          },
          floating: {
            horizontalPosition: {
              relative: HorizontalPositionRelativeFrom.PAGE,
              offset: Math.round(img.x * 12700)
            },
            verticalPosition: {
              relative: VerticalPositionRelativeFrom.PAGE,
              offset: Math.round(img.y * 12700)
            },
            wrap: {
              type: TextWrappingType.NONE
            },
            behindDocument: true,
            allowOverlap: true
          }
        })
      );
    }

    const anchorParagraph = new Paragraph({
      spacing: {
        line: 20,
        lineRule: LineRuleType.EXACTLY,
        before: 0,
        after: 0
      },
      children: [
        ...imageRuns,
        new TextRun({ text: '', size: 2 })
      ]
    });

    children.push(anchorParagraph);

    // Create Section
    sections.push({
      properties: {
        page: {
          size: {
            width: pageWidthTwips,
            height: pageHeightTwips
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            header: 0,
            footer: 0
          }
        }
      },
      children
    });
  }

  const docOpts = {
    title: model.meta?.title || 'Converted Document',
    sections
  };

  if (embedFonts.length > 0) {
    docOpts.fonts = embedFonts;
  }

  const doc = new Document(docOpts);
  return await Packer.toBuffer(doc);
}
