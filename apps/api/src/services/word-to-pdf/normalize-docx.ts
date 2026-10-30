import JSZip from 'jszip';

const TR_HEIGHT = /<w:trHeight\b[^>]*\/?>/g;

export interface NormalizeResult {
  buffer: Buffer;
  fixes: {
    exactToAtLeast: number;
    partsChanged: string[];
  };
}

/**
 * LibreOffice draws cell borders/shading only up to a row's height when the row is
 * <w:trHeight w:hRule="exact">, even though the text overflows -> broken tables.
 */
export async function normalizeDocx(input: Buffer): Promise<NormalizeResult> {
  const zip = await JSZip.loadAsync(input);
  const fixes = { exactToAtLeast: 0, partsChanged: [] as string[] };
  const parts = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*|footnotes|endnotes|styles)\.xml$/.test(n)
  );
  for (const name of parts) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    let changed = 0;
    const out = xml.replace(TR_HEIGHT, (tag) => {
      if (!/w:hRule="exact"/.test(tag)) return tag;
      changed++;
      return tag.replace('w:hRule="exact"', 'w:hRule="atLeast"');
    });
    if (changed) {
      zip.file(name, out);
      fixes.exactToAtLeast += changed;
      fixes.partsChanged.push(name);
    }
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, fixes };
}
