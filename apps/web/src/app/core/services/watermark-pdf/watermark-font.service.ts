import { Injectable } from '@angular/core';
import { WatermarkTextShaper } from './watermark-text-shaper';

export type WatermarkDetectedScript =
  | 'latin'
  | 'indic'
  | 'arabic'
  | 'hebrew'
  | 'thai'
  | 'cjk'
  | 'unknown';

export interface FontPackInfo {
  script: WatermarkDetectedScript;
  name: string;
  recommendedFontFamily: string;
  url?: string;
  isRtl: boolean;
}

const SCRIPT_METADATA: Record<WatermarkDetectedScript, FontPackInfo> = {
  latin: {
    script: 'latin',
    name: 'Latin / Cyrillic / Greek',
    recommendedFontFamily: 'Liberation Sans',
    url: '/standard_fonts/LiberationSans-Regular.ttf',
    isRtl: false
  },
  indic: {
    script: 'indic',
    name: 'Indic (Devanagari, Bengali, Tamil, etc.)',
    recommendedFontFamily: 'Noto Sans Devanagari',
    isRtl: false
  },
  arabic: {
    script: 'arabic',
    name: 'Arabic / Persian / Urdu',
    recommendedFontFamily: 'Noto Sans Arabic',
    isRtl: true
  },
  hebrew: {
    script: 'hebrew',
    name: 'Hebrew',
    recommendedFontFamily: 'Noto Sans Hebrew',
    isRtl: true
  },
  thai: {
    script: 'thai',
    name: 'Thai',
    recommendedFontFamily: 'Noto Sans Thai',
    isRtl: false
  },
  cjk: {
    script: 'cjk',
    name: 'Chinese / Japanese / Korean (CJK)',
    recommendedFontFamily: 'Noto Sans CJK',
    isRtl: false
  },
  unknown: {
    script: 'unknown',
    name: 'Standard Unicode',
    recommendedFontFamily: 'Liberation Sans',
    url: '/standard_fonts/LiberationSans-Regular.ttf',
    isRtl: false
  }
};

@Injectable({
  providedIn: 'root'
})
export class WatermarkFontService {
  private fontCache = new Map<string, Uint8Array>();
  private fontkitCache = new Map<string, any>();

  /**
   * Resolves the exact font asset URL based on font family, bold/italic style, and detected Unicode script.
   */
  resolveFontUrl(family = 'Noto Sans', bold = false, italic = false, text = ''): string {
    const script = this.detectScript(text);
    if (script === 'indic') {
      return '/fonts/sign/noto-sans-devanagari-devanagari-400-normal.woff';
    }
    if (script === 'arabic') {
      return '/fonts/sign/noto-sans-arabic-arabic-400-normal.woff';
    }

    const fam = (family || '').toLowerCase().trim();
    if (fam.includes('liberation')) {
      if (bold && italic) return '/standard_fonts/LiberationSans-BoldItalic.ttf';
      if (bold) return '/standard_fonts/LiberationSans-Bold.ttf';
      if (italic) return '/standard_fonts/LiberationSans-Italic.ttf';
      return '/standard_fonts/LiberationSans-Regular.ttf';
    }
    if (fam.includes('kalam')) {
      return '/fonts/sign/kalam-latin-400-normal.woff';
    }
    if (fam.includes('caveat')) {
      return '/fonts/sign/caveat-latin-600-normal.woff';
    }
    if (fam.includes('dancing')) {
      return '/fonts/sign/dancing-script-latin-600-normal.woff';
    }
    if (fam.includes('great') || fam.includes('vibes')) {
      return '/fonts/sign/great-vibes-latin-400-normal.woff';
    }

    // Default / Noto Sans / fallback
    if (/[\u0400-\u04FF]/.test(text)) {
      return '/fonts/sign/noto-sans-cyrillic-400-normal.woff';
    }
    return '/fonts/sign/noto-sans-latin-400-normal.woff';
  }

  /**
   * Detects whether the string contains colored emoji characters.
   * Note: Standard PDF vector fonts do not render color bitmap/COLR emoji.
   */
  hasEmoji(text: string): boolean {
    if (!text) return false;
    // Regex for emoji symbols and pictographs
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
    return emojiRegex.test(text);
  }

  /**
   * Detects the dominant non-Latin Unicode script in the string.
   */
  detectScript(text: string): WatermarkDetectedScript {
    if (!text) return 'latin';

    // CJK Unified Ideographs & Hangul / Kana
    if (/[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/.test(text)) {
      return 'cjk';
    }

    // Indic Scripts (Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala)
    if (/[\u0900-\u0D7F]/.test(text)) {
      return 'indic';
    }

    // Arabic & Persian & Urdu
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
      return 'arabic';
    }

    // Hebrew
    if (/[\u0590-\u05FF]/.test(text)) {
      return 'hebrew';
    }

    // Thai
    if (/[\u0E00-\u0E7F]/.test(text)) {
      return 'thai';
    }

    return 'latin';
  }

  /**
   * Returns metadata and recommended fonts for the given script
   */
  getScriptInfo(script: WatermarkDetectedScript): FontPackInfo {
    return SCRIPT_METADATA[script] || SCRIPT_METADATA.latin;
  }

  /**
   * Lazy-loads a font pack buffer from the standard fonts repository
   */
  async loadFontBuffer(url: string): Promise<Uint8Array | null> {
    if (this.fontCache.has(url)) {
      return this.fontCache.get(url)!;
    }

    try {
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const resp = await fetch(url);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          this.fontCache.set(url, bytes);
          return bytes;
        }
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Loads or retrieves a cached fontkit instance for the given font URL
   */
  async loadFontkitInstance(url: string): Promise<any> {
    if (this.fontkitCache.has(url)) {
      return this.fontkitCache.get(url);
    }
    const bytes = await this.loadFontBuffer(url);
    if (!bytes) return null;
    try {
      const font = WatermarkTextShaper.loadFontkit(bytes);
      if (font) {
        this.fontkitCache.set(url, font);
      }
      return font;
    } catch {
      return null;
    }
  }
}
