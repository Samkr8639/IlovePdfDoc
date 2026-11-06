import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { PowerPointToPdfOptions } from '@paperflow/contracts';

export interface SlideInfo {
  index: number; // 1-based
  id: string;
  rId: string;
  filename: string;
  title: string;
  isHidden: boolean;
  isIncluded: boolean;
}

export interface FontSubstitution {
  requested: string;
  used: string;
}

export interface NormalizePptxResult {
  buffer: Buffer;
  slideCount: number;
  exportedSlideCount: number;
  slides: SlideInfo[];
  slideTitles: string[];
  warnings: string[];
  fontsSubstituted: FontSubstitution[];
  fontsMissing: string[];
}

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false, // Prevents entity expansion / billion laughs
  allowBooleanAttributes: true
};

const XML_BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false,
  suppressBooleanAttributes: false
};

const FONT_SUBSTITUTION_MAP: Record<string, string> = {
  'calibri': 'Carlito',
  'calibri light': 'Carlito',
  'cambria': 'Caladea',
  'cambria math': 'Caladea',
  'aptos': 'Carlito',
  'aptos display': 'Carlito',
  'aptos light': 'Carlito',
  'aptos semibold': 'Carlito',
  'arial': 'Liberation Sans',
  'arial black': 'Liberation Sans',
  'arial narrow': 'Liberation Sans Narrow',
  'times new roman': 'Liberation Serif',
  'times': 'Liberation Serif',
  'courier new': 'Liberation Mono',
  'courier': 'Liberation Mono',
  'segoe ui': 'Open Sans',
  'segoe ui semibold': 'Open Sans',
  'segoe ui light': 'Open Sans',
  'verdana': 'DejaVu Sans',
  'tahoma': 'DejaVu Sans',
  'georgia': 'DejaVu Serif',
  'trebuchet ms': 'Liberation Sans',
  'century gothic': 'Liberation Sans',
  'franklin gothic': 'Noto Sans',
  'franklin gothic medium': 'Noto Sans',
  'gill sans': 'Noto Sans',
  'gill sans mt': 'Noto Sans',
  'gotham': 'Open Sans',
  'futura': 'Open Sans',
  'helvetica': 'Liberation Sans',
  'helvetica neue': 'Liberation Sans',
  'consolas': 'Liberation Mono',
  'impact': 'Liberation Sans',
  'comic sans ms': 'Liberation Sans'
};

const KNOWN_OPEN_FONTS = new Set([
  'carlito',
  'caladea',
  'liberation sans',
  'liberation sans narrow',
  'liberation serif',
  'liberation mono',
  'dejavu sans',
  'dejavu serif',
  'open sans',
  'roboto',
  'lato',
  'montserrat',
  'poppins',
  'source sans',
  'source sans pro',
  'source sans 3',
  'source serif pro',
  'inter',
  'raleway',
  'playfair display',
  'merriweather',
  'noto sans',
  'noto serif',
  'noto color emoji',
  'pt sans',
  'pt serif',
  'ubuntu',
  'oswald'
]);

export function parseSlideRange(rangeStr: string, totalSlides: number): Set<number> {
  const result = new Set<number>();
  if (!rangeStr || !rangeStr.trim()) {
    for (let i = 1; i <= totalSlides; i++) result.add(i);
    return result;
  }

  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        for (let i = start; i <= Math.min(end, totalSlides); i++) {
          result.add(i);
        }
      }
    } else {
      const single = parseInt(part, 10);
      if (!isNaN(single) && single > 0 && single <= totalSlides) {
        result.add(single);
      }
    }
  }

  if (result.size === 0) {
    for (let i = 1; i <= totalSlides; i++) result.add(i);
  }

  return result;
}

export async function normalizePptx(
  buffer: Buffer,
  options: PowerPointToPdfOptions = {}
): Promise<NormalizePptxResult> {
  const zip = await JSZip.loadAsync(buffer);
  const warnings: string[] = [];
  const fontsSubstituted: FontSubstitution[] = [];
  const fontsMissing: string[] = [];
  let hasAnimationsOrTransitions = false;

  // ────────────────────────────────────────────────────────────
  // 1. Security Stripping (defense in depth)
  // ────────────────────────────────────────────────────────────

  // 1.1 Remove VBA project and signature files
  const vbaFiles = ['ppt/vbaProject.bin', 'ppt/vbaProjectSignature.bin'];
  let removedVbaCount = 0;
  for (const vba of vbaFiles) {
    if (zip.file(vba)) {
      zip.remove(vba);
      removedVbaCount++;
    }
  }
  if (removedVbaCount > 0) {
    warnings.push('Embedded VBA macros were removed for security.');
  }

  // 1.2 Remove ActiveX, OLE embeddings, and webextensions
  let removedOleCount = 0;
  for (const name of Object.keys(zip.files)) {
    if (
      name.startsWith('ppt/activeX/') ||
      name.startsWith('ppt/ctrlProps/') ||
      name.startsWith('ppt/embeddings/') ||
      name.startsWith('ppt/webextensions/') ||
      name.startsWith('ppt/taskpanes/')
    ) {
      const isDir = name.endsWith('/');
      zip.remove(name);
      if (!isDir) {
        removedOleCount++;
      }
    }
  }
  if (removedOleCount > 0) {
    warnings.push(`Embedded active/OLE resources (${removedOleCount}) were removed for security.`);
  }

  // 1.3 Sanitize Relationships (TargetMode="External")
  for (const name of Object.keys(zip.files)) {
    if (name.endsWith('.rels')) {
      const relsFile = zip.file(name);
      if (relsFile) {
        const relsXml = await relsFile.async('text');
        if (relsXml.includes('TargetMode="External"')) {
          const parser = new XMLParser(XML_PARSER_OPTIONS);
          const builder = new XMLBuilder(XML_BUILDER_OPTIONS);
          try {
            const parsed = parser.parse(relsXml);
            if (parsed.Relationships && parsed.Relationships.Relationship) {
              const relList = Array.isArray(parsed.Relationships.Relationship)
                ? parsed.Relationships.Relationship
                : [parsed.Relationships.Relationship];

              const filteredRelList = relList.filter((rel: any) => {
                if (rel['@_TargetMode'] === 'External') {
                  const target = String(rel['@_Target'] || '').toLowerCase();
                  // Allow only safe web hyperlinks (http, https, mailto)
                  if (
                    target.startsWith('http://') ||
                    target.startsWith('https://') ||
                    target.startsWith('mailto:')
                  ) {
                    return true;
                  }
                  warnings.push(`Neutralized unsafe external hyperlink target: ${target}`);
                  return false;
                }
                return true;
              });

              parsed.Relationships.Relationship = filteredRelList;
              zip.file(name, builder.build(parsed));
            }
          } catch {
            // Ignore parse errors on secondary rels
          }
        }
      }
    }
  }

  // 1.4 Neutralize external chart workbook links while preserving cached data
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('ppt/charts/chart') && name.endsWith('.xml')) {
      const chartFile = zip.file(name);
      if (chartFile) {
        let chartXml = await chartFile.async('text');
        if (chartXml.includes('<c:externalData') || chartXml.includes('<c:externalData/')) {
          // Remove the <c:externalData .../> element
          chartXml = chartXml.replace(/<c:externalData\b[^>]*(\/>|>[\s\S]*?<\/c:externalData>)/gi, '');
          zip.file(name, chartXml);
          warnings.push('External chart data link was unlinked; cached chart values were preserved.');

          // Remove relationship in chart's rels
          const chartRelsName = name.replace('ppt/charts/', 'ppt/charts/_rels/') + '.rels';
          const chartRelsFile = zip.file(chartRelsName);
          if (chartRelsFile) {
            let relsXml = await chartRelsFile.async('text');
            // Remove relationships of type externalData / package
            relsXml = relsXml.replace(/<Relationship\b[^>]*externalData[^>]*\/>/gi, '');
            relsXml = relsXml.replace(/<Relationship\b[^>]*oleObject[^>]*\/>/gi, '');
            zip.file(chartRelsName, relsXml);
          }
        }
      }
    }
  }

  // 1.5 Sanitize dangerous action attributes in slides/layouts/masters
  for (const name of Object.keys(zip.files)) {
    if (
      (name.startsWith('ppt/slides/') ||
        name.startsWith('ppt/slideLayouts/') ||
        name.startsWith('ppt/slideMasters/')) &&
      name.endsWith('.xml')
    ) {
      const slideFile = zip.file(name);
      if (slideFile) {
        let xml = await slideFile.async('text');
        let modified = false;

        // Strip ppaction://program, ppaction://macro, ppaction://hlinkfile, ppaction://ole, javascript:, file:
        const dangerousActionRegex = /action="(ppaction:\/\/(?:program|macro|hlinkfile|ole)|javascript:|file:)[^"]*"/gi;
        if (dangerousActionRegex.test(xml)) {
          xml = xml.replace(dangerousActionRegex, 'action=""');
          modified = true;
          warnings.push(`Dangerous slide execution action in '${name}' was removed for security.`);
        }

        if (modified) {
          zip.file(name, xml);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 2. Parse Presentation Structure & Slide Titles
  // ────────────────────────────────────────────────────────────

  const presentationFile = zip.file('ppt/presentation.xml');
  const presentationRelsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const slides: SlideInfo[] = [];
  const slideTitles: string[] = [];

  if (presentationFile) {
    const presXml = await presentationFile.async('text');
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const builder = new XMLBuilder(XML_BUILDER_OPTIONS);

    const sldSzMatch = presXml.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
    const slideWidth = sldSzMatch ? parseInt(sldSzMatch[1], 10) : 9144000;

    // Check for embedded fonts list
    if (presXml.includes('<p:embeddedFontLst') || presXml.includes('<p:embeddedFontLst/')) {
      warnings.push(
        'This presentation embeds fonts that cannot be used; install the fonts or expect substitutions.'
      );
    }

    // Map rIds to slide filenames
    const rIdToSlideFile: Record<string, string> = {};
    if (presentationRelsFile) {
      const relsXml = await presentationRelsFile.async('text');
      try {
        const parsedRels = parser.parse(relsXml);
        if (parsedRels.Relationships && parsedRels.Relationships.Relationship) {
          const relList = Array.isArray(parsedRels.Relationships.Relationship)
            ? parsedRels.Relationships.Relationship
            : [parsedRels.Relationships.Relationship];
          for (const r of relList) {
            const id = r['@_Id'];
            const target = r['@_Target'];
            if (id && target && target.includes('slides/slide')) {
              // Target can be 'slides/slide1.xml' or '../slides/slide1.xml'
              const normTarget = target.replace(/^\.\.\//, '').replace(/^ppt\//, '');
              rIdToSlideFile[id] = normTarget.startsWith('ppt/') ? normTarget : `ppt/${normTarget}`;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    try {
      const parsedPres = parser.parse(presXml);
      const sldIdLst = parsedPres['p:presentation']?.['p:sldIdLst']?.['p:sldId'];
      const rawSlides = Array.isArray(sldIdLst) ? sldIdLst : sldIdLst ? [sldIdLst] : [];
      const totalSlides = rawSlides.length;

      // Determine slide range to include
      const allowedRange =
        options.slides?.mode === 'range' && options.slides?.range
          ? parseSlideRange(options.slides.range, totalSlides)
          : null;

      const includeHidden = !!options.slides?.includeHidden;

      for (let i = 0; i < totalSlides; i++) {
        const raw = rawSlides[i];
        const slideIndex = i + 1;
        const id = String(raw['@_id'] || `sld-${slideIndex}`);
        const rId = String(raw['@_r:id'] || '');
        const slideFile = rIdToSlideFile[rId] || `ppt/slides/slide${slideIndex}.xml`;

        // Check if slide is marked as hidden
        const isHidden = raw['@_show'] === '0' || raw['@_show'] === 0 || raw['@_show'] === false;

        // Determine inclusion
        let isIncluded = true;
        if (allowedRange && !allowedRange.has(slideIndex)) {
          isIncluded = false;
        } else if (isHidden && !includeHidden) {
          isIncluded = false;
        }

        // Extract title from slide XML
        let title = `Slide ${slideIndex}`;
        const sldContentFile = zip.file(slideFile);
        if (sldContentFile) {
          let sldXml = await sldContentFile.async('text');
          let sldModified = false;

          // Normalize squished / narrow text boxes (common in presentations converted from HTML or created with wrap="none")
          // In PowerPoint, wrap="none" allows text to overflow horizontally without wrapping.
          // In LibreOffice Impress, text is constrained by the shape's cx width. If cx is abnormally narrow (< 1.1 in / 1,000,000 EMU)
          // while containing substantial text (> 60 chars) and wrap="none", it squishes into a 0.3-inch column down the margin.
          // Expanding cx to the available slide width (slideWidth - x - rightMargin) and setting wrap="square" ensures clean, full-width wrapping.
          const shapeRegex = /<p:sp>[\s\S]*?<\/p:sp>/g;
          sldXml = sldXml.replace(shapeRegex, (sp) => {
            const hasWrapNone = /wrap="none"/i.test(sp);
            const offMatch = sp.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
            const extMatch = sp.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
            if (offMatch && extMatch) {
              const x = parseInt(offMatch[1], 10);
              const cx = parseInt(extMatch[1], 10);
              const textMatches = sp.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || [];
              const textLen = textMatches.reduce((acc, m) => acc + m.length, 0);

              if (hasWrapNone && textLen > 60 && cx < 1000000 && x < slideWidth) {
                const rightMargin = 514350; // standard 0.56 in margin
                const targetCx = Math.max(cx, slideWidth - x - rightMargin);
                let fixedSp = sp.replace(/<a:ext\s+cx="\d+"\s+cy="(\d+)"/, `<a:ext cx="${targetCx}" cy="$1"`);
                fixedSp = fixedSp.replace(/wrap="none"/g, 'wrap="square"');
                sldModified = true;
                return fixedSp;
              }
            }
            return sp;
          });

          if (sldModified) {
            zip.file(slideFile, sldXml);
          }

          // Check if slide has animations or transitions
          if (
            isIncluded &&
            (sldXml.includes('<p:transition') ||
              (sldXml.includes('<p:timing') &&
                (sldXml.includes('<p:anim') ||
                  sldXml.includes('<p:bldLst') ||
                  sldXml.includes('<p:seq') ||
                  sldXml.includes('<p:par'))))
          ) {
            hasAnimationsOrTransitions = true;
          }

          // Look for title placeholder
          const titleMatch = sldXml.match(/<p:ph\b[^>]*(?:type="(?:title|ctrTitle)")[^>]*>[\s\S]*?<\/p:ph>/i);
          if (titleMatch) {
            // Find nearby text <a:t>
            const nearbyText = sldXml.match(/<a:t\b[^>]*>(.*?)<\/a:t>/i);
            if (nearbyText && nearbyText[1].trim()) {
              title = nearbyText[1].trim();
            }
          } else {
            // Fallback to first non-empty <a:t>
            const firstText = sldXml.match(/<a:t\b[^>]*>(.*?)<\/a:t>/i);
            if (firstText && firstText[1].trim()) {
              title = firstText[1].trim();
            }
          }
        }

        slides.push({
          index: slideIndex,
          id,
          rId,
          filename: slideFile,
          title,
          isHidden,
          isIncluded
        });

        if (isIncluded) {
          slideTitles.push(title);
        }

        // Update show attribute in presentation.xml:
        // LibreOffice Impress respects show="0" when ExportHiddenSlides is false
        if (!isIncluded) {
          raw['@_show'] = '0';
        } else {
          // If included and previously hidden, remove show="0" so it exports
          if (raw['@_show'] === '0') {
            delete raw['@_show'];
          }
        }
      }

      if (hasAnimationsOrTransitions) {
        warnings.push('Animations and transitions were omitted from the PDF export.');
      }

      // Re-serialize presentation.xml with updated visibility
      zip.file('ppt/presentation.xml', builder.build(parsedPres));
    } catch {
      // Fallback if parsing failed
    }
  }

  // ────────────────────────────────────────────────────────────
  // 3. Font Analysis & Substitutions
  // ────────────────────────────────────────────────────────────

  // 3.1 Resolve theme major and minor Latin fonts from theme1.xml (if present)
  let themeMajorLatin = 'Calibri Light';
  let themeMinorLatin = 'Calibri';
  const themeFile = zip.file('ppt/theme/theme1.xml');
  if (themeFile) {
    const themeXml = await themeFile.async('text');
    const majorMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
    if (majorMatch && majorMatch[1] && !majorMatch[1].startsWith('+')) {
      themeMajorLatin = majorMatch[1].trim();
    }
    const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
    if (minorMatch && minorMatch[1] && !minorMatch[1].startsWith('+')) {
      themeMinorLatin = minorMatch[1].trim();
    }
  }

  // 3.2 Only collect Latin fonts actually referenced on exported slides
  const requestedFonts = new Set<string>();

  for (const slide of slides) {
    if (!slide.isIncluded) continue;
    const file = zip.file(slide.filename);
    if (file) {
      const text = await file.async('text');
      // Look for typeface declarations inside <a:latin typeface="...">
      const matches = text.match(/<a:latin\s+[^>]*typeface="([^"]+)"/gi);
      if (matches) {
        for (const m of matches) {
          const tf = m.match(/typeface="([^"]+)"/i);
          if (tf && tf[1]) {
            let fontName = tf[1].trim();
            if (fontName === '+mj-lt') {
              fontName = themeMajorLatin;
            } else if (fontName === '+mn-lt') {
              fontName = themeMinorLatin;
            } else if (fontName.startsWith('+')) {
              continue;
            }
            if (fontName) {
              requestedFonts.add(fontName);
            }
          }
        }
      }
    }
  }

  for (const font of requestedFonts) {
    const lower = font.toLowerCase();
    if (FONT_SUBSTITUTION_MAP[lower]) {
      const sub = FONT_SUBSTITUTION_MAP[lower];
      fontsSubstituted.push({ requested: font, used: sub });
    } else if (!KNOWN_OPEN_FONTS.has(lower)) {
      fontsMissing.push(font);
      warnings.push(`Font '${font}' was not found in installed system fonts and was substituted.`);
    }
  }

  const normalizedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const slideCount = slides.length;
  const exportedSlideCount = slides.filter((s) => s.isIncluded).length;

  return {
    buffer: normalizedBuffer,
    slideCount,
    exportedSlideCount,
    slides,
    slideTitles,
    warnings,
    fontsSubstituted,
    fontsMissing
  };
}

