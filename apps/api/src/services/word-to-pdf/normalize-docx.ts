import JSZip from 'jszip';

const TR_HEIGHT = /<w:trHeight\b[^>]*\/?>/g;

export interface NormalizeResult {
  buffer: Buffer;
  fixes: {
    exactToAtLeast: number;
    framesNormalized: number;
    partsChanged: string[];
  };
}

/**
 * Normalizes DOCX XML for LibreOffice conversion fidelity:
 * 1. Standard tables: LibreOffice clips cell borders and shading to row height when
 *    a row has <w:trHeight w:hRule="exact">, even though text overflows -> switch to w:hRule="atLeast".
 * 2. Absolute-frame tables/lines: Documents using <w:framePr> with empty content and collapsed
 *    line spacing (w:line="20") cause LibreOffice to collapse the frame height to ~5.7 pt -> expand
 *    the line spacing to match w:h so borders and shading render at their full height (42 pt, 26 pt, etc.).
 */
export async function normalizeDocx(input: Buffer): Promise<NormalizeResult> {
  const zip = await JSZip.loadAsync(input);
  const fixes = {
    exactToAtLeast: 0,
    framesNormalized: 0,
    partsChanged: [] as string[]
  };

  const parts = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes|styles)\.xml$/.test(n)
  );

  for (const name of parts) {
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async('string');
    let changed = 0;

    // 1. Table rows: switch exact heights to atLeast
    xml = xml.replace(TR_HEIGHT, (tag) => {
      if (!/w:hRule="exact"/.test(tag)) return tag;
      fixes.exactToAtLeast++;
      changed++;
      return tag.replace('w:hRule="exact"', 'w:hRule="atLeast"');
    });

    // 2. Absolute frames: fix collapsed empty frames (header shading boxes and vertical borders)
    // When a paragraph has <w:framePr w:h="X"> and collapsed spacing (e.g. w:line="20"),
    // expand w:line and font size to match w:h so LibreOffice renders the full height.
    xml = xml.replace(
      /<w:p\b([\s\S]*?)<\/w:p>/g,
      (fullParagraph) => {
        // Only process paragraphs with framePr and height
        const frameMatch = /<w:framePr\b[^>]*\bw:h="(\d+)"[^>]*\/?>/.exec(fullParagraph);
        if (!frameMatch) return fullParagraph;

        const hVal = frameMatch[1];
        const hNum = parseInt(hVal, 10);
        if (isNaN(hNum) || hNum <= 0) return fullParagraph;

        // Check if paragraph is an empty decoration (borders, lines, shading fills)
        const texts = [...fullParagraph.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(m => m[1]);
        const hasVisibleText = texts.join('').trim().length > 0;
        if (hasVisibleText) return fullParagraph;

        // Has collapsed line spacing (e.g. w:line="20" or lineRule="exactly")
        if (fullParagraph.includes('w:line="20"') || (fullParagraph.includes('w:shd') && fullParagraph.includes('w:lineRule='))) {
          fixes.framesNormalized++;
          changed++;

          let updated = fullParagraph;
          // Update framePr hRule if exact
          updated = updated.replace(/(<w:framePr\b[^>]*)\bw:hRule="exact"/, '$1w:hRule="atLeast"');

          // Update spacing line height to match frame height
          if (/<w:spacing\b[^>]*\/?>/.test(updated)) {
            updated = updated.replace(/<w:spacing\b[^>]*\/?>/, `<w:spacing w:after="0" w:before="0" w:line="${hVal}" w:lineRule="exact"/>`);
          }

          return updated;
        }

        return fullParagraph;
      }
    );

    if (changed > 0) {
      zip.file(name, xml);
      fixes.partsChanged.push(name);
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, fixes };
}
