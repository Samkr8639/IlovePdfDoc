import JSZip from 'jszip';

export interface DeckInfo {
  slideCount?: number;
  hiddenSlideCount: number;
  thumbnailUrl?: string;
}

/**
 * Inspects a presentation file client-side in the browser using JSZip and DOMParser
 * WITHOUT uploading the file to the server.
 */
export async function getDeckInfo(file: File): Promise<DeckInfo> {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  // Legacy binary or ODF formats: fallback to default without client-side inspection
  if (['.ppt', '.pps', '.odp'].includes(ext)) {
    return { hiddenSlideCount: 0 };
  }

  // OOXML formats: .pptx, .pptm, .ppsx
  if (['.pptx', '.pptm', '.ppsx'].includes(ext)) {
    try {
      const zip = await JSZip.loadAsync(file);

      let slideCount: number | undefined;
      let hiddenSlideCount = 0;
      let thumbnailUrl: string | undefined;

      // 1. Try reading slide count from docProps/app.xml
      const appXml = await zip.file('docProps/app.xml')?.async('text');
      if (appXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(appXml, 'application/xml');
        const slidesEl = doc.getElementsByTagName('Slides')[0] || doc.getElementsByTagNameNS('*', 'Slides')[0];
        if (slidesEl && slidesEl.textContent) {
          const parsed = parseInt(slidesEl.textContent.trim(), 10);
          if (!isNaN(parsed) && parsed > 0) {
            slideCount = parsed;
          }
        }
      }

      // Fallback: count slide XML files
      if (!slideCount) {
        const slideFiles = Object.keys(zip.files).filter(
          (k) => k.startsWith('ppt/slides/slide') && k.endsWith('.xml')
        );
        if (slideFiles.length > 0) {
          slideCount = slideFiles.length;
        }
      }

      // 2. Count hidden slides in ppt/presentation.xml
      const presXml = await zip.file('ppt/presentation.xml')?.async('text');
      if (presXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(presXml, 'application/xml');
        const sldIdEls = Array.from(doc.getElementsByTagName('p:sldId')).concat(
          Array.from(doc.getElementsByTagNameNS('*', 'sldId'))
        );
        for (const el of sldIdEls) {
          const showAttr = el.getAttribute('show');
          if (showAttr === '0' || showAttr === 'false') {
            hiddenSlideCount++;
          }
        }
      }

      // 3. Extract embedded thumbnail (docProps/thumbnail.jpeg)
      const thumbFile = zip.file('docProps/thumbnail.jpeg');
      if (thumbFile) {
        const thumbBytes = await thumbFile.async('uint8array');
        // Validate JPEG magic bytes: FF D8 FF
        if (thumbBytes.length > 3 && thumbBytes[0] === 0xff && thumbBytes[1] === 0xd8 && thumbBytes[2] === 0xff) {
          const blob = new Blob([thumbBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });
          thumbnailUrl = URL.createObjectURL(blob);
        }
      }

      return {
        slideCount,
        hiddenSlideCount,
        thumbnailUrl
      };
    } catch (err) {
      console.warn('Failed to inspect PPTX deck in browser:', err);
      return { hiddenSlideCount: 0 };
    }
  }

  return { hiddenSlideCount: 0 };
}

export function revokeDeckThumbnail(deck: DeckInfo): void {
  if (deck.thumbnailUrl) {
    try {
      URL.revokeObjectURL(deck.thumbnailUrl);
    } catch {
      // ignore
    }
    deck.thumbnailUrl = undefined;
  }
}
